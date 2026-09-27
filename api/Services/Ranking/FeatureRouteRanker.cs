using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Services.Ranking;

public class FeatureRouteRanker : IRouteRanker
{
    public async Task<IReadOnlyList<RankedRoute>> RankAsync(RouteRankContext context, CancellationToken ct = default)
    {
        var trending = await LoadTrendingRanksAsync(context, ct);
        var direct = DirectFromStart(context);
        var scored = context.Candidates
            .Select(candidate =>
            {
                var features = RouteFeatureScorer.Score(
                    candidate.Ids,
                    context.FromId,
                    context.ToId,
                    context.Nodes,
                    direct,
                    trending);
                return new RankedRoute
                {
                    Ids = candidate.Ids,
                    Incoming = candidate.Incoming,
                    Score = features.Score,
                    Reason = features.Reason,
                    Details = features.Details
                };
            })
            .OrderByDescending(r => r.Score)
            .ThenBy(r => r.Ids.Count)
            .ThenBy(r => string.Join('>', r.Ids), StringComparer.OrdinalIgnoreCase)
            .ToList();
        return scored;
    }

    private Task<Dictionary<string, int>> LoadTrendingRanksAsync(RouteRankContext context, CancellationToken ct)
    {
        // Use the in-memory graph. A live TrendingAsync query here made /paths hang.
        return Task.FromResult(PopularityRanks(context.Outgoing));
    }

    internal static HashSet<string> DirectFromStart(RouteRankContext context)
    {
        if (!context.Outgoing.TryGetValue(context.FromId, out var edges))
        {
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        return edges.Select(e => e.ToId).ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    internal static Dictionary<string, int> PopularityRanks(
        IReadOnlyDictionary<string, List<CareerEdgeRecord>> outgoing)
    {
        return outgoing.Values
            .SelectMany(list => list)
            .GroupBy(e => e.ToId, StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(g => g.Count())
            .Select((g, i) => (g.Key, i))
            .ToDictionary(x => x.Key, x => x.i, StringComparer.OrdinalIgnoreCase);
    }
}
