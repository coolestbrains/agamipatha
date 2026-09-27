using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Services.Ranking;

public sealed class RouteCandidate
{
    public required List<string> Ids { get; init; }
    public required Dictionary<string, CareerEdgeRecord> Incoming { get; init; }
}

public sealed class RankedRoute
{
    public required List<string> Ids { get; init; }
    public required Dictionary<string, CareerEdgeRecord> Incoming { get; init; }
    public int Score { get; init; }
    public string Reason { get; init; } = "";
    public List<string> Details { get; init; } = [];
}

public sealed class RouteRankContext
{
    public required string FromId { get; init; }
    public required string ToId { get; init; }
    public required IReadOnlyList<RouteCandidate> Candidates { get; init; }
    public required IReadOnlyDictionary<string, CareerNodeRecord> Nodes { get; init; }
    public required IReadOnlyDictionary<string, List<CareerEdgeRecord>> Outgoing { get; init; }
}

public interface IRouteRanker
{
    Task<IReadOnlyList<RankedRoute>> RankAsync(RouteRankContext context, CancellationToken ct = default);
}
