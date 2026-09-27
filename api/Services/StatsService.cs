using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Services;

public class StatsService(AppDbContext db)
{
    public async Task<SiteStatsDto> SnapshotAsync()
    {
        await EnsureRowAsync();
        var row = await db.SiteStats.AsNoTracking().FirstAsync(s => s.Id == 1);
        var qualifications = await db.Nodes.CountAsync(n => n.Kind != "profession" && n.Kind != "entrance-exam");
        var professions = await db.Nodes.CountAsync(n => n.Kind == "profession");
        var start = StartOfTodayIstUtc();
        var guestsToday = await db.GuestVisits.CountAsync(v => v.OccurredAtUtc >= start);
        var searchesToday = await db.SearchVisits.CountAsync(v => v.OccurredAtUtc >= start);
        var qualificationsToday = await db.Nodes.CountAsync(n => n.Kind != "profession" && n.Kind != "entrance-exam" && n.CreatedAtUtc >= start);
        var professionsToday = await db.Nodes.CountAsync(n => n.Kind == "profession" && n.CreatedAtUtc >= start);
        var purchases = await db.StoreOrders.CountAsync(o => o.Status == "paid");
        var purchasesToday = await db.StoreOrders.CountAsync(o =>
            o.Status == "paid" && (o.PaidAtUtc ?? o.CreatedAtUtc) >= start);
        var registered = await db.StoreBuyers.CountAsync();
        var registeredToday = await db.StoreBuyers.CountAsync(b => b.CreatedAtUtc >= start);
        var connection = db.Database.GetDbConnection();
        var storedIn = string.IsNullOrWhiteSpace(connection.Database)
            ? connection.DataSource
            : $"{connection.DataSource} / {connection.Database}";
        return new SiteStatsDto(
            row.SearchCount,
            row.GuestVisitCount,
            guestsToday,
            searchesToday,
            qualifications,
            professions,
            qualificationsToday,
            professionsToday,
            purchases,
            purchasesToday,
            registered,
            registeredToday,
            storedIn);
    }

    public async Task RecordSearchAsync()
    {
        await EnsureRowAsync();
        await db.Database.ExecuteSqlRawAsync(
            "UPDATE SiteStats SET SearchCount = SearchCount + 1 WHERE Id = 1");
        db.SearchVisits.Add(new SearchVisitRecord { OccurredAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();
    }

    public async Task RecordGuestVisitAsync(string? visitorKey = null, string? ip = null, string? userAgent = null)
    {
        var key = NormalizeVisitorKey(visitorKey);
        if (key.Length == 0)
        {
            key = FallbackVisitorKey(ip, userAgent);
        }

        if (key.Length == 0)
        {
            return;
        }

        var day = TodayIstDate();
        if (key.Length > 0 &&
            await db.GuestVisits.AsNoTracking().AnyAsync(v => v.VisitorKey == key && v.DayIst == day))
        {
            return;
        }

        await EnsureRowAsync();
        db.GuestVisits.Add(new GuestVisitRecord
        {
            OccurredAtUtc = DateTime.UtcNow,
            VisitorKey = key,
            DayIst = day
        });
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            return;
        }

        await db.Database.ExecuteSqlRawAsync(
            "UPDATE SiteStats SET GuestVisitCount = GuestVisitCount + 1 WHERE Id = 1");
    }

    public async Task RecordInterestAsync(
        string? nodeId,
        string? fromId = null,
        string? toId = null,
        string? via = null,
        string? kind = null)
    {
        var from = (fromId ?? "").Trim();
        var to = (toId ?? "").Trim();
        var id = (nodeId ?? "").Trim();
        var tag = (kind ?? "").Trim().ToLowerInvariant();
        if (tag.Length == 0)
        {
            if (to.Length > 0 && (id.Length == 0 || string.Equals(id, to, StringComparison.OrdinalIgnoreCase)))
            {
                tag = "goal";
            }
            else if (id.Length > 0)
            {
                tag = "detail";
            }
        }

        if (id.Length > 0)
        {
            var exists = await db.Nodes.AsNoTracking().AnyAsync(n => n.Id == id);
            if (exists)
            {
                db.NodeInterest.Add(new NodeInterestRecord
                {
                    NodeId = id,
                    Kind = tag,
                    OccurredAtUtc = DateTime.UtcNow
                });
            }
        }

        if (from.Length > 0 && to.Length > 0)
        {
            db.RouteChoices.Add(new RouteChoiceRecord
            {
                FromId = from,
                ToId = to,
                Via = (via ?? "").Trim(),
                OccurredAtUtc = DateTime.UtcNow
            });
        }

        if (db.ChangeTracker.HasChanges())
        {
            await db.SaveChangesAsync();
        }
    }

    public async Task<List<CareerNodeDto>> TrendingAsync(int limit = 10)
    {
        var take = Math.Clamp(limit, 1, 10);
        var since = DateTime.UtcNow.AddDays(-30);
        var hits = new Dictionary<string, (int Hits, DateTime Last)>(StringComparer.OrdinalIgnoreCase);

        void AddHit(string nodeId, int weight, DateTime last)
        {
            var id = (nodeId ?? "").Trim();
            if (id.Length == 0)
            {
                return;
            }

            if (hits.TryGetValue(id, out var prev))
            {
                hits[id] = (prev.Hits + weight, last > prev.Last ? last : prev.Last);
            }
            else
            {
                hits[id] = (weight, last);
            }
        }

        var goals = await db.NodeInterest.AsNoTracking()
            .Where(e => e.OccurredAtUtc >= since && e.Kind == "goal")
            .GroupBy(e => e.NodeId)
            .Select(g => new { NodeId = g.Key, Hits = g.Count(), Last = g.Max(x => x.OccurredAtUtc) })
            .ToListAsync();
        foreach (var row in goals)
        {
            AddHit(row.NodeId, row.Hits * 3, row.Last);
        }

        var destinations = await db.RouteChoices.AsNoTracking()
            .Where(e => e.OccurredAtUtc >= since)
            .GroupBy(e => e.ToId)
            .Select(g => new { NodeId = g.Key, Hits = g.Count(), Last = g.Max(x => x.OccurredAtUtc) })
            .ToListAsync();
        foreach (var row in destinations)
        {
            AddHit(row.NodeId, row.Hits * 3, row.Last);
        }

        var ranked = hits
            .Select(kv => new { NodeId = kv.Key, kv.Value.Hits, kv.Value.Last })
            .OrderByDescending(x => x.Hits)
            .ThenByDescending(x => x.Last)
            .ToList();

        var nodes = await db.Nodes.AsNoTracking().ToDictionaryAsync(n => n.Id);
        var result = new List<CareerNodeDto>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void TryAdd(string nodeId)
        {
            if (!seen.Add(nodeId) || !nodes.TryGetValue(nodeId, out var rec))
            {
                return;
            }

            if (rec.Kind is "entrance-exam")
            {
                return;
            }

            result.Add(CareerNodeDto.From(rec));
        }

        foreach (var row in ranked)
        {
            TryAdd(row.NodeId);
            if (result.Count >= take)
            {
                return result;
            }
        }

        var popular = await db.Edges.AsNoTracking()
            .GroupBy(e => e.ToId)
            .Select(g => new { NodeId = g.Key, Hits = g.Count() })
            .OrderByDescending(x => x.Hits)
            .Take(60)
            .ToListAsync();

        foreach (var row in popular)
        {
            TryAdd(row.NodeId);
            if (result.Count >= take)
            {
                break;
            }
        }

        if (result.Count < take)
        {
            foreach (var rec in nodes.Values.Where(n => n.Kind == "profession").OrderBy(n => n.Title))
            {
                TryAdd(rec.Id);
                if (result.Count >= take)
                {
                    break;
                }
            }
        }

        return result;
    }

    public async Task<List<CareerNodeDto>> PopularDestinationsAsync(string fromId, int limit = 10)
    {
        var take = Math.Clamp(limit, 1, 16);
        var nodes = await db.Nodes.AsNoTracking().ToDictionaryAsync(n => n.Id);
        var from = PreMetricStarts.GraphFromId(fromId, nodes);
        var result = new List<CareerNodeDto>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (from.Length > 0)
        {
            seen.Add(from);
        }

        void TryAdd(string nodeId)
        {
            var id = (nodeId ?? "").Trim();
            if (id.Length == 0 || !seen.Add(id) || !nodes.TryGetValue(id, out var rec))
            {
                return;
            }

            if (rec.Kind is "entrance-exam")
            {
                return;
            }

            result.Add(CareerNodeDto.From(rec));
        }

        if (from.Length > 0)
        {
            var searched = await db.RouteChoices.AsNoTracking()
                .Where(e => e.FromId == from)
                .GroupBy(e => e.ToId)
                .Select(g => new { ToId = g.Key, Hits = g.Count(), Last = g.Max(x => x.OccurredAtUtc) })
                .OrderByDescending(x => x.Hits)
                .ThenByDescending(x => x.Last)
                .Take(40)
                .ToListAsync();
            foreach (var row in searched)
            {
                TryAdd(row.ToId);
                if (result.Count >= take)
                {
                    return result;
                }
            }

            var edges = await db.Edges.AsNoTracking().ToListAsync();
            var outgoing = edges
                .GroupBy(e => e.FromId)
                .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);
            if (outgoing.TryGetValue(from, out var direct))
            {
                foreach (var edge in direct.OrderBy(e => nodes.TryGetValue(e.ToId, out var n) && n.Kind == "profession" ? 0 : 1))
                {
                    TryAdd(edge.ToId);
                    if (result.Count >= take)
                    {
                        return result;
                    }
                }

                var queue = new Queue<string>();
                var walk = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { from };
                queue.Enqueue(from);
                var professions = new List<string>();
                while (queue.Count > 0)
                {
                    var current = queue.Dequeue();
                    if (!outgoing.TryGetValue(current, out var list))
                    {
                        continue;
                    }

                    foreach (var edge in list)
                    {
                        if (!walk.Add(edge.ToId) || !nodes.TryGetValue(edge.ToId, out var rec))
                        {
                            continue;
                        }

                        if (rec.Kind == "profession")
                        {
                            professions.Add(rec.Id);
                        }
                        else
                        {
                            queue.Enqueue(edge.ToId);
                        }
                    }
                }

                foreach (var id in professions)
                {
                    TryAdd(id);
                    if (result.Count >= take)
                    {
                        return result;
                    }
                }
            }
        }

        foreach (var node in await TrendingAsync(take))
        {
            TryAdd(node.Id);
            if (result.Count >= take)
            {
                break;
            }
        }

        return result;
    }

    public async Task<StatSeriesDto?> SeriesAsync(string? metric)
    {
        var key = (metric ?? "").Trim().ToLowerInvariant();
        return key switch
        {
            "searches" => EventSeries(
                "searches",
                "Searches",
                await db.SearchVisits.AsNoTracking().Select(v => v.OccurredAtUtc).ToListAsync(),
                (await EnsureSnapshotRowAsync()).SearchCount),
            "guests" or "guestvisits" => EventSeries(
                "guests",
                "Guest visits",
                await db.GuestVisits.AsNoTracking().Select(v => v.OccurredAtUtc).ToListAsync(),
                (await EnsureSnapshotRowAsync()).GuestVisitCount),
            "qualifications" => await NodeSeriesAsync(
                "qualifications",
                "Qualifications",
                n => n.Kind != "profession" && n.Kind != "entrance-exam"),
            "professions" => await NodeSeriesAsync(
                "professions",
                "Professions",
                n => n.Kind == "profession"),
            "purchases" => EventSeries(
                "purchases",
                "Purchases",
                await db.StoreOrders.AsNoTracking()
                    .Where(o => o.Status == "paid")
                    .Select(o => o.PaidAtUtc ?? o.CreatedAtUtc)
                    .ToListAsync(),
                await db.StoreOrders.CountAsync(o => o.Status == "paid")),
            "registered" => EventSeries(
                "registered",
                "Registered",
                await db.StoreBuyers.AsNoTracking().Select(b => b.CreatedAtUtc).ToListAsync(),
                await db.StoreBuyers.CountAsync()),
            _ => null
        };
    }

    /// <summary>Calendar day in India Standard Time, as UTC for comparisons.</summary>
    public static DateTime StartOfTodayIstUtc()
    {
        var tz = IstZone();
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var startLocal = DateTime.SpecifyKind(local.Date, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(startLocal, tz);
    }

    private static string TodayIstDate()
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, IstZone());
        return local.ToString("yyyy-MM-dd");
    }

    private static TimeZoneInfo IstZone() =>
        TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");

    private static string NormalizeVisitorKey(string? value)
    {
        var key = (value ?? "").Trim();
        if (key.Length < 8)
        {
            return "";
        }

        return key.Length > 64 ? key[..64] : key;
    }

    private static string FallbackVisitorKey(string? ip, string? userAgent)
    {
        var raw = $"{(ip ?? "").Trim()}|{(userAgent ?? "").Trim()}";
        if (raw.Length < 4)
        {
            return "";
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(hash)[..32].ToLowerInvariant();
    }

    private async Task EnsureRowAsync()
    {
        await EnsureSnapshotRowAsync();
    }

    private async Task<SiteStatsRecord> EnsureSnapshotRowAsync()
    {
        var row = await db.SiteStats.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1);
        if (row is not null)
        {
            return row;
        }

        row = new SiteStatsRecord { Id = 1 };
        db.SiteStats.Add(row);
        await db.SaveChangesAsync();
        return row;
    }

    private async Task<StatSeriesDto> NodeSeriesAsync(
        string metric,
        string label,
        Func<CareerNodeRecord, bool> match)
    {
        var nodes = await db.Nodes.AsNoTracking().ToListAsync();
        var chosen = nodes.Where(match).ToList();
        var dates = chosen.Where(n => n.CreatedAtUtc.HasValue).Select(n => n.CreatedAtUtc!.Value).ToList();
        return EventSeries(metric, label, dates, chosen.Count);
    }

    private StatSeriesDto EventSeries(string metric, string label, List<DateTime> occurredUtc, long reportedTotal)
    {
        var today = TodayIst();
        var daily = new Dictionary<DateOnly, int>();
        foreach (var utc in occurredUtc)
        {
            var day = ToIstDate(utc);
            daily[day] = daily.GetValueOrDefault(day) + 1;
        }

        var opening = Math.Max(0, reportedTotal - occurredUtc.Count);
        var points = FillDays(daily, opening, today);
        var last = points.Count > 0 ? points[^1].Value : opening;
        return new StatSeriesDto
        {
            Metric = metric,
            Label = label,
            Total = Math.Max(reportedTotal, last),
            Points = points
        };
    }

    private static List<StatPointDto> FillDays(Dictionary<DateOnly, int> daily, long opening, DateOnly today)
    {
        if (daily.Count == 0)
        {
            return
            [
                new StatPointDto
                {
                    Date = today.ToString("yyyy-MM-dd"),
                    Daily = 0,
                    Value = opening
                }
            ];
        }

        var start = daily.Keys.Min();
        if (today.DayNumber - start.DayNumber > 180)
        {
            var window = today.AddDays(-180);
            opening += daily.Where(kv => kv.Key < window).Sum(kv => kv.Value);
            start = window;
        }

        var points = new List<StatPointDto>();
        var run = opening;
        for (var day = start; day <= today; day = day.AddDays(1))
        {
            var add = daily.GetValueOrDefault(day);
            run += add;
            points.Add(new StatPointDto
            {
                Date = day.ToString("yyyy-MM-dd"),
                Daily = add,
                Value = run
            });
        }

        return points;
    }

    private static DateOnly TodayIst()
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, IstZone());
        return DateOnly.FromDateTime(local);
    }

    private static DateOnly ToIstDate(DateTime utc)
    {
        var value = utc.Kind == DateTimeKind.Local ? utc.ToUniversalTime() : DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        var local = TimeZoneInfo.ConvertTimeFromUtc(value, IstZone());
        return DateOnly.FromDateTime(local);
    }
}

public record SiteStatsDto(
    long Searches,
    long GuestVisits,
    long GuestsToday,
    long SearchesToday,
    int Qualifications,
    int Professions,
    int QualificationsToday,
    int ProfessionsToday,
    int Purchases,
    int PurchasesToday,
    int Registered,
    int RegisteredToday,
    string StoredIn);
