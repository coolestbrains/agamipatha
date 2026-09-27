using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;
using AgamiPatha.Api.Services.Ranking;

namespace AgamiPatha.Api.Services;

public class PathService(AppDbContext db, IRouteRanker ranker)
{
    private static readonly object GraphGate = new();
    private static GraphSnap? Graph;
    private static DateTime GraphAt;

    private sealed record GraphSnap(
        Dictionary<string, CareerNodeRecord> Nodes,
        Dictionary<string, List<CareerEdgeRecord>> Outgoing);

    public static void InvalidateGraph()
    {
        lock (GraphGate)
        {
            Graph = null;
        }
    }

    public async Task<CatalogDto> GetCatalogAsync()
    {
        var nodes = await db.Nodes.AsNoTracking().OrderBy(n => n.Title).ToListAsync();
        var edges = await db.Edges.AsNoTracking().ToListAsync();
        return new CatalogDto
        {
            Nodes = nodes.Select(CareerNodeDto.From).ToList(),
            Edges = edges.Select(CareerEdgeDto.FromRecord).ToList()
        };
    }

    public async Task<PathSetDto?> FindRoutesAsync(string fromId, string toId)
    {
        var graph = await LoadGraphAsync();
        var nodes = graph.Nodes;
        fromId = PreMetricStarts.GraphFromId(fromId, nodes);
        if (!nodes.ContainsKey(fromId) || !nodes.ContainsKey(toId))
        {
            return null;
        }

        if (fromId == toId)
        {
            var only = BuildPath(nodes, [fromId], new Dictionary<string, CareerEdgeRecord>(), 0);
            only.Title = "Already there";
            only.Spine = nodes[fromId].ShortTitle;
            return new PathSetDto { Routes = [only], RouteCount = 1 };
        }

        var outgoing = graph.Outgoing;
        var ranked = YenKShortest(outgoing, fromId, toId, 8)
            .Where(ids => Plausible(ids, toId))
            .Select(ids => (Ids: ids, Incoming: IncomingFor(ids, outgoing)))
            .ToList();
        if (ranked.Count == 0)
        {
            return null;
        }

        var chosen = DistinctRoutes(ranked, nodes);
        var ordered = await ranker.RankAsync(new RouteRankContext
        {
            FromId = fromId,
            ToId = toId,
            Candidates = chosen.Select(item => new RouteCandidate
            {
                Ids = item.Ids,
                Incoming = item.Incoming
            }).ToList(),
            Nodes = nodes,
            Outgoing = outgoing
        });
        var routes = ordered.Select((item, i) =>
        {
            var dto = BuildPath(nodes, item.Ids, item.Incoming, Math.Max(0, ordered.Count - 1));
            dto.Title = RouteTitle(item.Ids, nodes);
            dto.Spine = string.Join(" → ", item.Ids.Select(id => nodes[id].ShortTitle));
            dto.Recommended = ordered.Count > 1 && i == 0;
            dto.Score = item.Score;
            dto.RecommendReason = item.Reason;
            dto.RecommendDetails = item.Details.Count > 0
                ? [.. item.Details]
                : string.IsNullOrWhiteSpace(item.Reason) ? [] : [item.Reason];
            if (dto.Recommended)
            {
                var fromName = nodes[fromId].ShortTitle;
                var toName = nodes[toId].ShortTitle;
                dto.RecommendDetails.Insert(0,
                    $"Ranked first among {ordered.Count} mapped routes from {fromName} to {toName}.");
            }
            return dto;
        }).ToList();

        return new PathSetDto
        {
            Routes = routes,
            RouteCount = routes.Count,
            RecommendedIndex = 0
        };
    }

    public async Task<IReadOnlyList<RouteCandidate>> FindUnrankedCandidatesAsync(string fromId, string toId)
    {
        var graph = await LoadGraphAsync();
        var nodes = graph.Nodes;
        fromId = PreMetricStarts.GraphFromId(fromId, nodes);
        if (!nodes.ContainsKey(fromId) || !nodes.ContainsKey(toId) || fromId == toId)
        {
            return [];
        }

        var outgoing = graph.Outgoing;
        var ranked = YenKShortest(outgoing, fromId, toId, 8)
            .Where(ids => Plausible(ids, toId))
            .Select(ids => (Ids: ids, Incoming: IncomingFor(ids, outgoing)))
            .ToList();
        if (ranked.Count == 0)
        {
            return [];
        }

        return DistinctRoutes(ranked, nodes)
            .Select(item => new RouteCandidate { Ids = item.Ids, Incoming = item.Incoming })
            .ToList();
    }

    public async Task<OptionsDto> OptionsAsync(string fromId)
    {
        fromId = PreMetricStarts.GraphFromId(fromId);
        var from = await db.Nodes.AsNoTracking().FirstOrDefaultAsync(n => n.Id == fromId);
        if (from is null)
        {
            return new OptionsDto();
        }

        var nodes = await db.Nodes.AsNoTracking().ToDictionaryAsync(n => n.Id);
        var outgoing = await LoadOutgoingAsync();
        var next = new List<NextStepDto>();
        if (outgoing.TryGetValue(fromId, out var direct))
        {
            next = direct
                .Where(e => nodes.ContainsKey(e.ToId))
                .Select(e => new NextStepDto
                {
                    Node = CareerNodeDto.From(nodes[e.ToId]),
                    Edge = CareerEdgeDto.FromRecord(e)
                })
                .OrderBy(n => n.Node.Title)
                .ToList();
        }

        var professions = new List<CareerNodeDto>();
        var seen = new HashSet<string> { fromId };
        var queue = new Queue<string>();
        queue.Enqueue(fromId);
        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (!outgoing.TryGetValue(current, out var list))
            {
                continue;
            }

            foreach (var edge in list)
            {
                if (!seen.Add(edge.ToId) || !nodes.TryGetValue(edge.ToId, out var rec))
                {
                    continue;
                }

                if (rec.Kind == "profession")
                {
                    professions.Add(CareerNodeDto.From(rec));
                }

                queue.Enqueue(edge.ToId);
            }
        }

        return new OptionsDto
        {
            From = CareerNodeDto.From(from),
            Next = next,
            Professions = professions.OrderBy(p => p.Field).ThenBy(p => p.Title).ToList()
        };
    }

    private static List<List<string>> YenKShortest(
        Dictionary<string, List<CareerEdgeRecord>> outgoing,
        string fromId,
        string toId,
        int k)
    {
        var shortest = ShortestPath(outgoing, fromId, toId, [], []);
        if (shortest is null)
        {
            return [];
        }

        var accepted = new List<List<string>> { shortest };
        var seen = new HashSet<string> { string.Join('>', shortest) };
        var candidates = new List<List<string>>();

        for (var ki = 1; ki < k; ki++)
        {
            var prev = accepted[^1];
            for (var i = 0; i < prev.Count - 1; i++)
            {
                var spur = prev[i];
                var root = prev.Take(i + 1).ToList();
                var bannedEdges = new HashSet<(string From, string To)>();
                foreach (var path in accepted)
                {
                    if (path.Count > i && path.Take(i + 1).SequenceEqual(root))
                    {
                        bannedEdges.Add((path[i], path[i + 1]));
                    }
                }

                var bannedNodes = root.Take(i).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var spurPath = ShortestPath(outgoing, spur, toId, bannedEdges, bannedNodes);
                if (spurPath is null || spurPath.Count < 2)
                {
                    continue;
                }

                var combined = root.Take(i).Concat(spurPath).ToList();
                var key = string.Join('>', combined);
                if (seen.Add(key))
                {
                    candidates.Add(combined);
                }
            }

            if (candidates.Count == 0)
            {
                break;
            }

            candidates.Sort((a, b) => a.Count.CompareTo(b.Count));
            accepted.Add(candidates[0]);
            candidates.RemoveAt(0);
        }

        return accepted;
    }

    private static List<string>? ShortestPath(
        Dictionary<string, List<CareerEdgeRecord>> outgoing,
        string fromId,
        string toId,
        HashSet<(string From, string To)> bannedEdges,
        HashSet<string> bannedNodes)
    {
        if (fromId == toId)
        {
            return [fromId];
        }

        var parent = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { fromId };
        var queue = new Queue<string>();
        queue.Enqueue(fromId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (current == toId)
            {
                break;
            }

            if (!outgoing.TryGetValue(current, out var list))
            {
                continue;
            }

            foreach (var edge in list)
            {
                if (bannedEdges.Contains((current, edge.ToId)))
                {
                    continue;
                }

                if (edge.ToId != fromId && bannedNodes.Contains(edge.ToId))
                {
                    continue;
                }

                if (!seen.Add(edge.ToId))
                {
                    continue;
                }

                parent[edge.ToId] = current;
                queue.Enqueue(edge.ToId);
            }
        }

        if (!parent.ContainsKey(toId))
        {
            return null;
        }

        var ids = new List<string>();
        var cursor = toId;
        ids.Add(cursor);
        var guard = 0;
        while (!string.Equals(cursor, fromId, StringComparison.OrdinalIgnoreCase))
        {
            if (++guard > 512 || !parent.TryGetValue(cursor, out var next))
            {
                return null;
            }
            cursor = next;
            ids.Add(cursor);
        }

        ids.Reverse();
        return ids;
    }

    private static Dictionary<string, CareerEdgeRecord> IncomingFor(
        List<string> ids,
        Dictionary<string, List<CareerEdgeRecord>> outgoing)
    {
        var incoming = new Dictionary<string, CareerEdgeRecord>(StringComparer.OrdinalIgnoreCase);
        for (var i = 1; i < ids.Count; i++)
        {
            if (!outgoing.TryGetValue(ids[i - 1], out var list))
            {
                continue;
            }

            var edge = list.FirstOrDefault(e => e.ToId == ids[i]);
            if (edge is not null)
            {
                incoming[ids[i]] = edge;
            }
        }

        return incoming;
    }

    private static List<(List<string> Ids, Dictionary<string, CareerEdgeRecord> Incoming)> DistinctRoutes(
        List<(List<string> Ids, Dictionary<string, CareerEdgeRecord> Incoming)> found,
        Dictionary<string, CareerNodeRecord> nodes)
    {
        var groups = found
            .GroupBy(item => string.Join('>', item.Ids.Select(Family)))
            .Select(g => g.OrderBy(item => RouteScore(item.Ids)).ThenBy(item => item.Ids.Count).First())
            .OrderBy(item => item.Ids.Count)
            .ThenBy(item => RouteTitle(item.Ids, nodes))
            .Take(10)
            .ToList();
        return groups;
    }

    private static bool Plausible(List<string> ids, string toId)
    {
        var set = ids.ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (toId is "software-engineer" or "ml-engineer" or "game-developer")
        {
            if (set.Contains("mtech") && !set.Overlaps(RouteFeatureScorer.ComputingIds))
            {
                return false;
            }
        }

        return true;
    }

    private static string Family(string id)
    {
        if (id.StartsWith("btech-", StringComparison.OrdinalIgnoreCase))
        {
            return "btech";
        }

        return id switch
        {
            "hs-pcm" or "hs-pcmb" => "hs-pcm",
            "bcom" or "bcom-hons" => "bcom",
            "bba" or "bms" => "bba",
            _ => id
        };
    }

    private static int RouteScore(List<string> ids)
    {
        var score = ids.Count * 10;
        if (ids.Contains("btech-cse")) score -= 8;
        if (ids.Contains("btech-ai")) score -= 6;
        if (ids.Contains("btech-it")) score -= 5;
        if (ids.Contains("mca")) score -= 2;
        return score;
    }

    private static string RouteTitle(List<string> ids, Dictionary<string, CareerNodeRecord> nodes)
    {
        var skip = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "school", "higher-secondary", "profession"
        };
        var mid = ids
            .Skip(1)
            .Take(Math.Max(0, ids.Count - 2))
            .Select(id => nodes[id])
            .Where(n => !skip.Contains(n.Kind))
            .ToList();
        if (mid.Count == 0)
        {
            mid = ids.Skip(1).Take(Math.Max(0, ids.Count - 2)).Select(id => nodes[id]).ToList();
        }

        if (mid.Count == 0)
        {
            return "Direct";
        }

        if (mid.Count == 1)
        {
            return $"Via {mid[0].Title}";
        }

        if (mid.Count == 2)
        {
            return $"Via {mid[0].ShortTitle}, then {mid[1].ShortTitle}";
        }

        return $"Via {string.Join(" · ", mid.Take(3).Select(n => n.ShortTitle))}";
    }

    private static CareerPathDto BuildPath(
        Dictionary<string, CareerNodeRecord> nodes,
        List<string> ids,
        Dictionary<string, CareerEdgeRecord> incoming,
        int alternateCount)
    {
        var steps = ids.Select((id, i) => new PathStepDto
        {
            Node = CareerNodeDto.From(nodes[id]),
            Incoming = incoming.TryGetValue(id, out var e) ? CareerEdgeDto.FromRecord(e) : null,
            StepIndex = i + 1
        }).ToList();
        var hops = Math.Max(0, steps.Count - 1);
        return new CareerPathDto
        {
            Steps = steps,
            AlternateCount = alternateCount,
            TotalLabel = hops switch
            {
                0 => "Current stage",
                1 => "1 step",
                _ => $"{hops} steps"
            }
        };
    }

    private async Task<GraphSnap> LoadGraphAsync()
    {
        lock (GraphGate)
        {
            if (Graph is not null && DateTime.UtcNow - GraphAt < TimeSpan.FromMinutes(5))
            {
                return Graph;
            }
        }

        var nodes = await db.Nodes.AsNoTracking().ToDictionaryAsync(n => n.Id);
        var outgoing = await LoadOutgoingAsync();
        var snap = new GraphSnap(nodes, outgoing);
        lock (GraphGate)
        {
            Graph = snap;
            GraphAt = DateTime.UtcNow;
        }
        return snap;
    }

    private async Task<Dictionary<string, List<CareerEdgeRecord>>> LoadOutgoingAsync()
    {
        var edges = await db.Edges.AsNoTracking().ToListAsync();
        return edges
            .GroupBy(e => e.FromId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);
    }
}
