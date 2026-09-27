using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Services.Ranking;

public static class RouteFeatureScorer
{
    public static readonly HashSet<string> ComputingIds =
    [
        "btech-cse", "btech-it", "btech-ai", "bca", "mca", "bsc-cs", "bsc-it"
    ];

    public sealed class Features
    {
        public float HopCount { get; init; }
        public float DirectFromStart { get; init; }
        public float SameField { get; init; }
        public float TrendingOverlap { get; init; }
        public float ComputingBonus { get; init; }
        public int Score { get; init; }
        public string Reason { get; init; } = "";
        public List<string> Details { get; init; } = [];
    }

    public static Features Score(
        IReadOnlyList<string> ids,
        string fromId,
        string toId,
        IReadOnlyDictionary<string, CareerNodeRecord> nodes,
        IReadOnlySet<string> directFromStart,
        IReadOnlyDictionary<string, int> trendingRank)
    {
        var hops = Math.Max(0, ids.Count - 1);
        var destIsDirect = hops == 1;
        var hopScore = Math.Max(0, 12 - hops) * 10;
        if (hops == 1)
        {
            hopScore += 20;
        }

        nodes.TryGetValue(fromId, out var start);
        nodes.TryGetValue(toId, out var dest);
        var sameField = 0;
        if (start is not null && dest is not null &&
            !string.IsNullOrWhiteSpace(start.Field) &&
            string.Equals(start.Field, dest.Field, StringComparison.OrdinalIgnoreCase))
        {
            sameField = 22;
        }
        else if (dest is not null && ids.Skip(1).Any(id =>
                     nodes.TryGetValue(id, out var hop) &&
                     string.Equals(hop.Field, dest.Field, StringComparison.OrdinalIgnoreCase)))
        {
            sameField = 10;
        }

        var directBonus = destIsDirect ? 45 : 0;
        if (!destIsDirect && ids.Count > 1 && directFromStart.Contains(ids[1]))
        {
            directBonus = 12;
        }

        var trendingOverlap = 0;
        foreach (var id in ids.Skip(1).Where(id => !id.Equals(toId, StringComparison.OrdinalIgnoreCase)))
        {
            if (trendingRank.TryGetValue(id, out var rank))
            {
                trendingOverlap += Math.Max(0, 100 - rank);
            }
        }

        var computing = 0;
        if (ids.Contains("btech-cse", StringComparer.OrdinalIgnoreCase)) computing += 8;
        if (ids.Contains("btech-ai", StringComparer.OrdinalIgnoreCase)) computing += 6;
        if (ids.Contains("btech-it", StringComparer.OrdinalIgnoreCase)) computing += 5;
        if (ids.Contains("mca", StringComparer.OrdinalIgnoreCase)) computing += 2;
        if (ids.Any(id => ComputingIds.Contains(id))) computing += 4;
        if (IsComputingDestination(dest))
        {
            if (ids.Contains("hs-pcm", StringComparer.OrdinalIgnoreCase) ||
                ids.Contains("hs-pcmb", StringComparer.OrdinalIgnoreCase))
            {
                computing += 20;
            }
            else if (ids.Contains("hs-pcb", StringComparer.OrdinalIgnoreCase))
            {
                computing += 4;
            }
        }

        var score = hopScore + sameField + directBonus + trendingOverlap + computing;
        var feederBonus = 0;
        if (IsExperiencedDestination(dest))
        {
            var feeders = ParseFeederRoles(dest);
            if (feeders.Count > 0 && ids.Any(id => feeders.Contains(id)))
            {
                feederBonus = 35;
            }
            else if (ids.Any(id =>
                         nodes.TryGetValue(id, out var hop) &&
                         hop.Kind == "profession" &&
                         !id.Equals(toId, StringComparison.OrdinalIgnoreCase)))
            {
                feederBonus = 18;
            }
            else if (destIsDirect && start?.Kind is not null && start.Kind != "profession")
            {
                feederBonus = -12;
            }
        }

        score += feederBonus;
        var reason = BuildReason(ids, toId, start, destIsDirect, sameField, trendingOverlap, nodes, trendingRank, feederBonus);
        var details = BuildDetails(
            ids, toId, start, dest, destIsDirect, sameField, trendingOverlap, computing, hops, nodes, trendingRank, feederBonus);

        return new Features
        {
            HopCount = hops,
            DirectFromStart = destIsDirect ? 1f : 0f,
            SameField = sameField,
            TrendingOverlap = trendingOverlap,
            ComputingBonus = computing,
            Score = score,
            Reason = reason,
            Details = details
        };
    }

    public static string ViaToken(IReadOnlyList<string> ids, IReadOnlyDictionary<string, CareerNodeRecord> nodes)
    {
        var skip = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "school", "higher-secondary", "profession"
        };
        var mid = ids
            .Where(id => nodes.TryGetValue(id, out var n) && !skip.Contains(n.Kind))
            .ToList();
        return mid.Count == 0 ? string.Join(',', ids) : string.Join(',', mid);
    }

    private static string BuildReason(
        IReadOnlyList<string> ids,
        string toId,
        CareerNodeRecord? start,
        bool destIsDirect,
        int sameField,
        int trendingOverlap,
        IReadOnlyDictionary<string, CareerNodeRecord> nodes,
        IReadOnlyDictionary<string, int> trendingRank,
        int feederBonus)
    {
        var parts = new List<string>();
        if (destIsDirect && start is not null)
        {
            parts.Add($"Direct from {start.ShortTitle}");
        }
        else if (ids.Count > 2)
        {
            var hop = nodes.TryGetValue(ids[1], out var first) ? first.ShortTitle : ids[1];
            parts.Add($"Via {hop}");
        }

        if (sameField > 0)
        {
            parts.Add("same field");
        }

        if (trendingOverlap > 0)
        {
            var hot = ids.Skip(1).FirstOrDefault(id =>
                !id.Equals(toId, StringComparison.OrdinalIgnoreCase) && trendingRank.ContainsKey(id));
            parts.Add(hot is not null && nodes.TryGetValue(hot, out var n) ? $"trending {n.ShortTitle}" : "trending");
        }

        if (feederBonus >= 35)
        {
            parts.Add("includes feeder role");
        }

        return parts.Count == 0 ? "Shorter mapped route" : string.Join(" · ", parts);
    }

    private static List<string> BuildDetails(
        IReadOnlyList<string> ids,
        string toId,
        CareerNodeRecord? start,
        CareerNodeRecord? dest,
        bool destIsDirect,
        int sameField,
        int trendingOverlap,
        int computing,
        int hops,
        IReadOnlyDictionary<string, CareerNodeRecord> nodes,
        IReadOnlyDictionary<string, int> trendingRank,
        int feederBonus)
    {
        var details = new List<string>();
        var startName = start?.ShortTitle ?? "your start";
        var destName = dest?.ShortTitle ?? "this destination";

        if (IsExperiencedDestination(dest))
        {
            details.Add($"{destName} usually needs {ExperienceLabel(dest)} of relevant work — it is rarely a first campus title.");
            if (feederBonus >= 35)
            {
                var feeders = ParseFeederRoles(dest);
                var hit = ids.FirstOrDefault(id => feeders.Contains(id));
                if (hit is not null && nodes.TryGetValue(hit, out var feeder))
                {
                    details.Add($"This route includes {feeder.Title}, a usual feeder role before {destName}.");
                }
            }
            else if (feederBonus < 0)
            {
                details.Add($"A direct hop into {destName} from a qualification is mapped, but expect feeder-role years in practice.");
            }
        }

        if (destIsDirect)
        {
            details.Add($"{destName} is a direct next step from {startName} — one hop, with no extra degree in between.");
        }
        else
        {
            details.Add($"This route reaches {destName} in {hops} steps, which ranked ahead of longer mapped alternatives.");
            if (ids.Count > 2 && nodes.TryGetValue(ids[1], out var first))
            {
                details.Add($"The first hop is {first.Title}, a usual next qualification from {startName}.");
            }
        }

        if (sameField >= 22 && start is not null && dest is not null)
        {
            details.Add($"{startName} and {destName} sit in the same field ({dest.Field}), so the skills line up.");
        }
        else if (sameField > 0 && dest is not null)
        {
            details.Add($"A hop on this route stays in {dest.Field}, which matches the destination.");
        }

        if (trendingOverlap > 0)
        {
            var hot = ids.Skip(1)
                .Where(id => !id.Equals(toId, StringComparison.OrdinalIgnoreCase) && trendingRank.ContainsKey(id))
                .Select(id => nodes.TryGetValue(id, out var n) ? n.ShortTitle : id)
                .ToList();
            if (hot.Count > 0)
            {
                details.Add($"It includes {string.Join(" and ", hot.Take(3))}, which people are exploring more often right now.");
            }
        }

        if (ids.Contains("hs-pcm", StringComparer.OrdinalIgnoreCase) ||
            ids.Contains("hs-pcmb", StringComparer.OrdinalIgnoreCase))
        {
            details.Add("It goes through Class 12 PCM, the usual science stream into computing and engineering careers.");
        }

        if (computing > 0 && ids.Any(id => ComputingIds.Contains(id)))
        {
            var degree = ids.First(id => ComputingIds.Contains(id));
            var label = nodes.TryGetValue(degree, out var n) ? n.ShortTitle : degree;
            details.Add($"It uses {label}, a computing qualification that commonly leads to this kind of role.");
        }

        if (details.Count == 0)
        {
            details.Add("Among the mapped options, this was the shortest plausible route in the career graph.");
        }

        return details;
    }

    private static bool IsExperiencedDestination(CareerNodeRecord? dest) =>
        dest is not null &&
        dest.Kind == "profession" &&
        (string.Equals(dest.EntryLevel, "experienced", StringComparison.OrdinalIgnoreCase) ||
         dest.ExperienceYearsMin is > 0);

    private static string ExperienceLabel(CareerNodeRecord? dest)
    {
        if (dest is null)
        {
            return "several years";
        }

        var min = dest.ExperienceYearsMin;
        var typical = dest.ExperienceYearsTypical;
        if (min is int m && typical is int t && t != m)
        {
            return $"about {m}–{t} years";
        }

        if (min is int onlyMin)
        {
            return $"about {onlyMin}+ years";
        }

        if (typical is int onlyTyp)
        {
            return $"about {onlyTyp} years";
        }

        return "relevant work experience";
    }

    private static HashSet<string> ParseFeederRoles(CareerNodeRecord? dest)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (dest is null || string.IsNullOrWhiteSpace(dest.FeederRolesJson))
        {
            return set;
        }

        try
        {
            var list = System.Text.Json.JsonSerializer.Deserialize<List<string>>(dest.FeederRolesJson);
            if (list is null)
            {
                return set;
            }

            foreach (var id in list.Where(id => !string.IsNullOrWhiteSpace(id)))
            {
                set.Add(id.Trim());
            }
        }
        catch
        {
            // ignore bad seed JSON
        }

        return set;
    }

    private static bool IsComputingDestination(CareerNodeRecord? dest)
    {
        if (dest is null)
        {
            return false;
        }

        if (dest.Field is "Computing" or "Technology")
        {
            return true;
        }

        return dest.Id is "software-engineer" or "ml-engineer" or "game-developer"
            or "full-stack-developer" or "cloud-engineer" or "cloud-architect" or "devops-engineer"
            or "data-scientist" or "data-analyst";
    }
}
