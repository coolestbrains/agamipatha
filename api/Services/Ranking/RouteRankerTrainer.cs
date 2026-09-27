using Microsoft.EntityFrameworkCore;
using Microsoft.ML;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;
using AgamiPatha.Api.Services;

namespace AgamiPatha.Api.Services.Ranking;

public static class RouteRankerTrainer
{
    public static async Task TrainAsync(IServiceProvider services, IWebHostEnvironment env, ILogger logger)
    {
        var db = services.GetRequiredService<AppDbContext>();
        var paths = services.GetRequiredService<PathService>();
        var stats = services.GetRequiredService<StatsService>();
        var nodes = await db.Nodes.AsNoTracking().ToDictionaryAsync(n => n.Id);
        var outgoing = (await db.Edges.AsNoTracking().ToListAsync())
            .GroupBy(e => e.FromId)
            .ToDictionary(g => g.Key, g => g.ToList());
        Dictionary<string, int> trending;
        try
        {
            trending = (await stats.TrendingAsync(10))
                .Select((n, i) => (n.Id, i))
                .ToDictionary(x => x.Id, x => x.i, StringComparer.OrdinalIgnoreCase);
        }
        catch
        {
            trending = FeatureRouteRanker.PopularityRanks(outgoing);
        }

        var rows = await LoadChoiceRowsAsync(db, paths, nodes, outgoing, trending, logger);
        if (rows.Count < 8)
        {
            logger.LogInformation("RouteChoices is thin ({Count} rows); adding a bootstrap ranking set.", rows.Count);
            rows.AddRange(BootstrapRows(nodes, outgoing, trending));
        }

        var ml = new MLContext(seed: 1);
        var data = ml.Data.LoadFromEnumerable(rows);
        var pipeline = ml.Transforms.Concatenate(
                "Features",
                nameof(RouteRankRow.HopCount),
                nameof(RouteRankRow.DirectFromStart),
                nameof(RouteRankRow.SameField),
                nameof(RouteRankRow.TrendingOverlap),
                nameof(RouteRankRow.ComputingBonus))
            .Append(ml.Ranking.Trainers.LightGbm(
                labelColumnName: nameof(RouteRankRow.Label),
                featureColumnName: "Features",
                rowGroupColumnName: nameof(RouteRankRow.GroupId),
                numberOfLeaves: 8,
                numberOfIterations: 40,
                minimumExampleCountPerLeaf: 1));

        logger.LogInformation("Training LightGbm route ranker on {Count} examples.", rows.Count);
        var model = pipeline.Fit(data);

        var dest = Path.Combine(env.ContentRootPath, "Seed", "route-ranker.zip");
        Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
        ml.Model.Save(model, data.Schema, dest);
        logger.LogInformation("Wrote {Path}. Restart the API to serve the ML ranker.", dest);
    }

    private static async Task<List<RouteRankRow>> LoadChoiceRowsAsync(
        AppDbContext db,
        PathService paths,
        Dictionary<string, CareerNodeRecord> nodes,
        Dictionary<string, List<CareerEdgeRecord>> outgoing,
        Dictionary<string, int> trending,
        ILogger logger)
    {
        var choices = await db.RouteChoices.AsNoTracking()
            .OrderByDescending(c => c.OccurredAtUtc)
            .ToListAsync();
        var preferred = new Dictionary<(string From, string To), string>();
        foreach (var choice in choices)
        {
            var key = (choice.FromId, choice.ToId);
            if (!preferred.ContainsKey(key))
            {
                preferred[key] = choice.Via ?? "";
            }
        }

        var rows = new List<RouteRankRow>();
        uint group = 1;
        foreach (var pair in preferred)
        {
            var candidates = await paths.FindUnrankedCandidatesAsync(pair.Key.From, pair.Key.To);
            if (candidates.Count < 2)
            {
                continue;
            }

            var context = new RouteRankContext
            {
                FromId = pair.Key.From,
                ToId = pair.Key.To,
                Candidates = candidates,
                Nodes = nodes,
                Outgoing = outgoing
            };
            var direct = FeatureRouteRanker.DirectFromStart(context);
            var wanted = (pair.Value ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var added = 0;
            foreach (var candidate in candidates)
            {
                var token = RouteFeatureScorer.ViaToken(candidate.Ids, nodes);
                var hit = string.Equals(token, pair.Value, StringComparison.OrdinalIgnoreCase)
                    || (wanted.Length > 0 && wanted.All(id => candidate.Ids.Contains(id, StringComparer.OrdinalIgnoreCase)));
                var features = RouteFeatureScorer.Score(
                    candidate.Ids, pair.Key.From, pair.Key.To, nodes, direct, trending);
                rows.Add(ToRow(features, hit ? 1f : 0f, group));
                added++;
            }

            if (added >= 2)
            {
                group++;
            }
            else
            {
                rows.RemoveRange(rows.Count - added, added);
            }
        }

        logger.LogInformation("Built {Count} labeled ranking rows from RouteChoices.", rows.Count);
        return rows;
    }

    private static List<RouteRankRow> BootstrapRows(
        Dictionary<string, CareerNodeRecord> nodes,
        Dictionary<string, List<CareerEdgeRecord>> outgoing,
        Dictionary<string, int> trending)
    {
        var rows = new List<RouteRankRow>();
        var rng = new Random(7);
        var ids = nodes.Keys.ToList();
        if (ids.Count < 4)
        {
            return rows;
        }

        uint group = 10_000;
        for (var g = 0; g < 24; g++, group++)
        {
            var from = ids[rng.Next(ids.Count)];
            var to = ids[rng.Next(ids.Count)];
            var context = new RouteRankContext
            {
                FromId = from,
                ToId = to,
                Candidates = [],
                Nodes = nodes,
                Outgoing = outgoing
            };
            var direct = FeatureRouteRanker.DirectFromStart(context);
            var groupRows = new List<(RouteFeatureScorer.Features Feat, RouteRankRow Row)>();
            for (var i = 0; i < 4; i++)
            {
                var hops = 1 + rng.Next(5);
                var path = new List<string> { from };
                for (var h = 0; h < hops - 1; h++)
                {
                    path.Add(ids[rng.Next(ids.Count)]);
                }
                path.Add(to);
                var features = RouteFeatureScorer.Score(path, from, to, nodes, direct, trending);
                groupRows.Add((features, ToRow(features, 0, group)));
            }

            var best = groupRows.Max(x => x.Feat.Score);
            foreach (var item in groupRows)
            {
                item.Row.Label = item.Feat.Score >= best ? 1f : 0f;
                rows.Add(item.Row);
            }
        }

        return rows;
    }

    private static RouteRankRow ToRow(RouteFeatureScorer.Features features, float label, uint group) => new()
    {
        HopCount = features.HopCount,
        DirectFromStart = features.DirectFromStart,
        SameField = features.SameField,
        TrendingOverlap = features.TrendingOverlap,
        ComputingBonus = features.ComputingBonus,
        Label = label,
        GroupId = group
    };
}
