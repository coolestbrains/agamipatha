using Microsoft.ML;
using Microsoft.ML.Data;

namespace AgamiPatha.Api.Services.Ranking;

public class RouteRankRow
{
    public float HopCount { get; set; }
    public float DirectFromStart { get; set; }
    public float SameField { get; set; }
    public float TrendingOverlap { get; set; }
    public float ComputingBonus { get; set; }
    public float Label { get; set; }

    [KeyType(100000)]
    public uint GroupId { get; set; }
}

public class RouteRankPrediction
{
    public float Score { get; set; }
}

public sealed class MlRouteRanker : IRouteRanker
{
    private readonly FeatureRouteRanker _fallback;
    private readonly ILogger<MlRouteRanker> _logger;
    private readonly MLContext _ml = new(seed: 1);
    private readonly ITransformer? _model;
    private readonly object _gate = new();
    private PredictionEngine<RouteRankRow, RouteRankPrediction>? _engine;

    public MlRouteRanker(
        FeatureRouteRanker fallback,
        string zipPath,
        ILogger<MlRouteRanker> logger)
    {
        _fallback = fallback;
        _logger = logger;
        try
        {
            using var stream = File.OpenRead(zipPath);
            _model = _ml.Model.Load(stream, out _);
            _logger.LogInformation("Loaded ML route ranker from {Path}.", zipPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not load route ranker from {Path}; using feature ranker.", zipPath);
            _model = null;
        }
    }

    public static string? FindModelPath(IWebHostEnvironment env)
    {
        var candidates = new[]
        {
            Path.Combine(env.ContentRootPath, "Seed", "route-ranker.zip"),
            Path.Combine(AppContext.BaseDirectory, "Seed", "route-ranker.zip")
        };
        return candidates.FirstOrDefault(File.Exists);
    }

    public async Task<IReadOnlyList<RankedRoute>> RankAsync(RouteRankContext context, CancellationToken ct = default)
    {
        var fallback = await _fallback.RankAsync(context, ct);
        if (_model is null || context.Candidates.Count < 2)
        {
            return fallback;
        }

        try
        {
            var trending = FeatureRouteRanker.PopularityRanks(context.Outgoing);
            var direct = FeatureRouteRanker.DirectFromStart(context);
            var reasons = fallback.ToDictionary(
                r => string.Join('>', r.Ids),
                r => r,
                StringComparer.OrdinalIgnoreCase);

            var scored = new List<RankedRoute>(context.Candidates.Count);
            foreach (var candidate in context.Candidates)
            {
                var features = RouteFeatureScorer.Score(
                    candidate.Ids,
                    context.FromId,
                    context.ToId,
                    context.Nodes,
                    direct,
                    trending);
                var predicted = Predict(new RouteRankRow
                {
                    HopCount = features.HopCount,
                    DirectFromStart = features.DirectFromStart,
                    SameField = features.SameField,
                    TrendingOverlap = features.TrendingOverlap,
                    ComputingBonus = features.ComputingBonus,
                    GroupId = 1
                });
                var key = string.Join('>', candidate.Ids);
                reasons.TryGetValue(key, out var prior);
                scored.Add(new RankedRoute
                {
                    Ids = candidate.Ids,
                    Incoming = candidate.Incoming,
                    Score = (int)Math.Round(predicted * 100),
                    Reason = prior?.Reason ?? features.Reason,
                    Details = prior?.Details is { Count: > 0 } ? prior.Details : features.Details
                });
            }

            return scored
                .OrderByDescending(r => r.Score)
                .ThenBy(r => r.Ids.Count)
                .ThenBy(r => string.Join('>', r.Ids), StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ML route ranking failed; using feature ranker.");
            return fallback;
        }
    }

    private float Predict(RouteRankRow row)
    {
        lock (_gate)
        {
            _engine ??= _ml.Model.CreatePredictionEngine<RouteRankRow, RouteRankPrediction>(_model);
            return _engine.Predict(row).Score;
        }
    }
}
