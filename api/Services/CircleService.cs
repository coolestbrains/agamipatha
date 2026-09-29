using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Services;

public class CircleService(AppDbContext db)
{
    private static readonly HashSet<string> AllowedTags =
    [
        "exam-prep",
        "application-checklist",
        "fee-reality-check",
        "stream-advice",
        "motivation",
        "study-buddy",
        "internship-tips",
        "career-switch",
    ];

    private static readonly HashSet<string> Audiences = ["student", "professional", "parent", "guardian", "explore"];

    public async Task<(int Status, string? Message, PathProfileDto? Profile)> GetMyProfileAsync(
        string buyerId,
        CancellationToken ct)
    {
        var profile = await db.PathProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.BuyerId == buyerId, ct);
        if (profile is null)
        {
            return (404, "Join Path Circle to meet peers on your career path.", null);
        }

        return (200, null, await ToProfileDtoAsync(profile, ct));
    }

    public async Task<(int Status, string? Message, PathProfileDto? Profile)> UpsertProfileAsync(
        string buyerId,
        PathProfileUpsertDto body,
        CancellationToken ct)
    {
        var buyer = await db.StoreBuyers.AsNoTracking().FirstOrDefaultAsync(b => b.Id == buyerId, ct);
        if (buyer is null)
        {
            return (401, "Sign in to join Path Circle.", null);
        }

        var standingId = (body.StandingNodeId ?? "").Trim();
        var goalId = (body.GoalNodeId ?? "").Trim();
        if (string.IsNullOrWhiteSpace(standingId) || string.IsNullOrWhiteSpace(goalId))
        {
            return (400, "Choose your current standing and career goal.", null);
        }

        var standing = await db.Nodes.AsNoTracking().FirstOrDefaultAsync(n => n.Id == standingId, ct);
        var goal = await db.Nodes.AsNoTracking().FirstOrDefaultAsync(n => n.Id == goalId, ct);
        if (standing is null || goal is null)
        {
            return (400, "Standing or goal was not found in the catalogue.", null);
        }

        var display = (body.DisplayName ?? "").Trim();
        if (display.Length < 2)
        {
            display = FirstName(buyer.Name);
        }

        display = display[..Math.Min(display.Length, 80)];
        var audience = NormalizeAudience(body.Audience);
        var help = SanitizeTags(body.HelpOffers);
        var looking = SanitizeTags(body.LookingFor);
        var bio = (body.Bio ?? "").Trim();
        if (bio.Length > 500)
        {
            bio = bio[..500];
        }

        var headline = (body.Headline ?? "").Trim();
        if (string.IsNullOrWhiteSpace(headline))
        {
            headline = $"{standing.ShortTitle} → {goal.ShortTitle}";
        }

        headline = headline[..Math.Min(headline.Length, 160)];
        var city = string.IsNullOrWhiteSpace(body.City) ? null : body.City.Trim()[..Math.Min(body.City.Trim().Length, 80)];
        var under18 = body.Under18;
        var shareMobile = under18 ? false : body.ShareMobile;
        var shareEmail = under18 ? false : body.ShareEmail;

        var now = DateTime.UtcNow;
        var profile = await db.PathProfiles.FirstOrDefaultAsync(p => p.BuyerId == buyerId, ct);
        if (profile is null)
        {
            profile = new PathProfileRecord
            {
                BuyerId = buyerId,
                InviteCode = await NewInviteCodeAsync(ct),
                CreatedAtUtc = now,
            };
            db.PathProfiles.Add(profile);
        }

        var circleRole = StoreBuyerService.NormalizeCircleRole(body.CircleRole ?? buyer.CircleRole);

        profile.DisplayName = display;
        profile.Headline = headline;
        profile.City = city;
        profile.StandingNodeId = standingId;
        profile.GoalNodeId = goalId;
        profile.Audience = audience;
        profile.CircleRole = circleRole;
        profile.Bio = bio;
        profile.HelpOffersJson = JsonSerializer.Serialize(help);
        profile.LookingForJson = JsonSerializer.Serialize(looking);
        profile.IsDiscoverable = body.IsDiscoverable;
        profile.ShareEmail = shareEmail;
        profile.ShareMobile = shareMobile;
        profile.Under18 = under18;
        profile.UpdatedAtUtc = now;
        if (string.IsNullOrWhiteSpace(profile.InviteCode))
        {
            profile.InviteCode = await NewInviteCodeAsync(ct);
        }

        await db.SaveChangesAsync(ct);
        return (200, null, await ToProfileDtoAsync(profile, ct));
    }

    public async Task<(int Status, object Payload)> ListPeersAsync(
        string buyerId,
        string? goalId,
        string? standingId,
        bool mentorMode,
        CancellationToken ct)
    {
        var me = await db.PathProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.BuyerId == buyerId, ct);
        if (me is null)
        {
            return (400, new { message = "Create your Path Circle profile first." });
        }

        if (mentorMode && !await HasActiveSubscriptionAsync(buyerId, ct))
        {
            return (402, SubscriptionRequired());
        }

        if (mentorMode)
        {
            return await ListMentorPeersAsync(buyerId, me, ct);
        }

        var goal = string.IsNullOrWhiteSpace(goalId) ? me.GoalNodeId : goalId.Trim();
        var standing = string.IsNullOrWhiteSpace(standingId) ? me.StandingNodeId : standingId.Trim();

        var blocked = await BlockedBuyerIdsAsync(buyerId, ct);
        var relations = await RelationMapAsync(buyerId, ct);

        var candidates = await db.PathProfiles.AsNoTracking()
            .Where(p => p.IsDiscoverable && p.BuyerId != buyerId && p.GoalNodeId == goal)
            .OrderByDescending(p => p.UpdatedAtUtc)
            .Take(120)
            .ToListAsync(ct);

        var nodeIds = candidates
            .SelectMany(p => new[] { p.StandingNodeId, p.GoalNodeId })
            .Append(standing)
            .Append(goal)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var nodes = await db.Nodes.AsNoTracking()
            .Where(n => nodeIds.Contains(n.Id))
            .ToDictionaryAsync(n => n.Id, StringComparer.OrdinalIgnoreCase, ct);
        var myStandingField = nodes.TryGetValue(standing, out var mine) ? mine.Field : "";

        var cards = new List<PathPeerCardDto>();
        foreach (var peer in candidates)
        {
            if (blocked.Contains(peer.BuyerId))
            {
                continue;
            }

            relations.TryGetValue(peer.BuyerId, out var rel);
            if (rel.Status is "blocked" or "declined")
            {
                continue;
            }

            var score = 40;
            if (string.Equals(peer.StandingNodeId, standing, StringComparison.OrdinalIgnoreCase))
            {
                score += 40;
            }
            else if (nodes.TryGetValue(peer.StandingNodeId, out var theirStanding)
                     && !string.IsNullOrWhiteSpace(myStandingField)
                     && string.Equals(theirStanding.Field, myStandingField, StringComparison.OrdinalIgnoreCase))
            {
                score += 20;
            }

            if (ParseTags(peer.HelpOffersJson).Intersect(ParseTags(me.LookingForJson), StringComparer.OrdinalIgnoreCase).Any())
            {
                score += 10;
            }

            if (ParseTags(peer.LookingForJson).Intersect(ParseTags(me.HelpOffersJson), StringComparer.OrdinalIgnoreCase).Any())
            {
                score += 8;
            }

            if (!string.IsNullOrWhiteSpace(peer.Bio))
            {
                score += 4;
            }

            if (!string.IsNullOrWhiteSpace(peer.City))
            {
                score += 2;
            }

            cards.Add(new PathPeerCardDto
            {
                BuyerId = peer.BuyerId,
                DisplayName = peer.DisplayName,
                Headline = peer.Headline,
                City = peer.Under18 ? null : peer.City,
                StandingNodeId = peer.StandingNodeId,
                StandingTitle = NodeLabel(nodes.GetValueOrDefault(peer.StandingNodeId), peer.StandingNodeId),
                GoalNodeId = peer.GoalNodeId,
                GoalTitle = NodeLabel(nodes.GetValueOrDefault(peer.GoalNodeId), peer.GoalNodeId),
                Audience = peer.Audience,
                Bio = peer.Bio,
                HelpOffers = ParseTags(peer.HelpOffersJson),
                LookingFor = ParseTags(peer.LookingForJson),
                MatchScore = score,
                Relation = rel.Status ?? "none",
                RequestId = rel.RequestId,
            });
        }

        return (200, cards.OrderByDescending(c => c.MatchScore).ThenBy(c => c.DisplayName).Take(40).ToList());
    }

    public async Task<(int Status, string? Message, PathConnectRequestDto? Request)> CreateRequestAsync(
        string buyerId,
        PathConnectRequestCreateDto body,
        CancellationToken ct)
    {
        if (!await HasActiveSubscriptionAsync(buyerId, ct))
        {
            return (402, "Subscribe to Path Circle mentors (₹199/month) to connect with people.", null);
        }

        var toId = (body.ToBuyerId ?? "").Trim();
        if (string.IsNullOrWhiteSpace(toId) || toId == buyerId)
        {
            return (400, "Choose someone else to connect with.", null);
        }

        var me = await db.PathProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.BuyerId == buyerId, ct);
        var them = await db.PathProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.BuyerId == toId && p.IsDiscoverable, ct);
        if (me is null || them is null)
        {
            return (400, "Both people need an active Path Circle profile.", null);
        }

        if ((await BlockedBuyerIdsAsync(buyerId, ct)).Contains(toId))
        {
            return (400, "You cannot connect with this person.", null);
        }

        var existing = await db.PathConnectRequests.FirstOrDefaultAsync(
            r => (r.FromBuyerId == buyerId && r.ToBuyerId == toId) || (r.FromBuyerId == toId && r.ToBuyerId == buyerId),
            ct);
        if (existing is not null)
        {
            if (existing.Status == "accepted")
            {
                return (400, "You are already connected.", null);
            }

            if (existing.Status == "blocked")
            {
                return (400, "This connection is blocked.", null);
            }

            if (existing.Status == "pending")
            {
                return (400, "A connect request is already pending.", null);
            }

            existing.FromBuyerId = buyerId;
            existing.ToBuyerId = toId;
            existing.Status = "pending";
            existing.Note = TrimNote(body.Note);
            existing.CreatedAtUtc = DateTime.UtcNow;
            existing.ResolvedAtUtc = null;
            await db.SaveChangesAsync(ct);
            return (200, null, await ToRequestDtoAsync(existing, buyerId, ct));
        }

        var row = new PathConnectRequestRecord
        {
            FromBuyerId = buyerId,
            ToBuyerId = toId,
            Status = "pending",
            Note = TrimNote(body.Note),
            CreatedAtUtc = DateTime.UtcNow,
        };
        db.PathConnectRequests.Add(row);
        await db.SaveChangesAsync(ct);
        return (200, null, await ToRequestDtoAsync(row, buyerId, ct));
    }

    public async Task<(int Status, string? Message, PathConnectRequestDto? Request)> ResolveRequestAsync(
        string buyerId,
        int requestId,
        string action,
        CancellationToken ct)
    {
        var row = await db.PathConnectRequests.FirstOrDefaultAsync(r => r.Id == requestId, ct);
        if (row is null)
        {
            return (404, "Request not found.", null);
        }

        var accept = action.Equals("accept", StringComparison.OrdinalIgnoreCase);
        var decline = action.Equals("decline", StringComparison.OrdinalIgnoreCase);
        if (!accept && !decline)
        {
            return (400, "Use accept or decline.", null);
        }

        if (row.ToBuyerId != buyerId)
        {
            return (403, "Only the recipient can respond to this request.", null);
        }

        if (row.Status != "pending")
        {
            return (400, "This request is no longer pending.", null);
        }

        if (accept && !await HasActiveSubscriptionAsync(buyerId, ct))
        {
            return (402, "Subscribe to Path Circle mentors (₹199/month) to connect with people.", null);
        }

        row.Status = accept ? "accepted" : "declined";
        row.ResolvedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return (200, null, await ToRequestDtoAsync(row, buyerId, ct));
    }

    public async Task<List<PathConnectRequestDto>> ListRequestsAsync(string buyerId, CancellationToken ct)
    {
        var rows = await db.PathConnectRequests.AsNoTracking()
            .Where(r => (r.FromBuyerId == buyerId || r.ToBuyerId == buyerId) && r.Status == "pending")
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(50)
            .ToListAsync(ct);
        var list = new List<PathConnectRequestDto>();
        foreach (var row in rows)
        {
            list.Add(await ToRequestDtoAsync(row, buyerId, ct));
        }

        return list;
    }

    public async Task<List<PathConnectionDto>> ListConnectionsAsync(string buyerId, CancellationToken ct)
    {
        var rows = await db.PathConnectRequests.AsNoTracking()
            .Where(r => r.Status == "accepted" && (r.FromBuyerId == buyerId || r.ToBuyerId == buyerId))
            .OrderByDescending(r => r.ResolvedAtUtc ?? r.CreatedAtUtc)
            .Take(100)
            .ToListAsync(ct);

        var otherIds = rows.Select(r => r.FromBuyerId == buyerId ? r.ToBuyerId : r.FromBuyerId).Distinct().ToList();
        var profiles = await db.PathProfiles.AsNoTracking()
            .Where(p => otherIds.Contains(p.BuyerId))
            .ToDictionaryAsync(p => p.BuyerId, StringComparer.OrdinalIgnoreCase, ct);
        var buyers = await db.StoreBuyers.AsNoTracking()
            .Where(b => otherIds.Contains(b.Id))
            .ToDictionaryAsync(b => b.Id, StringComparer.OrdinalIgnoreCase, ct);
        var nodeIds = profiles.Values.SelectMany(p => new[] { p.StandingNodeId, p.GoalNodeId }).Distinct().ToList();
        var nodes = await db.Nodes.AsNoTracking()
            .Where(n => nodeIds.Contains(n.Id))
            .ToDictionaryAsync(n => n.Id, StringComparer.OrdinalIgnoreCase, ct);

        var list = new List<PathConnectionDto>();
        foreach (var row in rows)
        {
            var otherId = row.FromBuyerId == buyerId ? row.ToBuyerId : row.FromBuyerId;
            if (!profiles.TryGetValue(otherId, out var profile))
            {
                continue;
            }

            buyers.TryGetValue(otherId, out var buyer);
            list.Add(new PathConnectionDto
            {
                RequestId = row.Id,
                BuyerId = otherId,
                DisplayName = profile.DisplayName,
                Headline = profile.Headline,
                City = profile.Under18 ? null : profile.City,
                StandingTitle = NodeLabel(nodes.GetValueOrDefault(profile.StandingNodeId), profile.StandingNodeId),
                GoalTitle = NodeLabel(nodes.GetValueOrDefault(profile.GoalNodeId), profile.GoalNodeId),
                Audience = profile.Audience,
                HelpOffers = ParseTags(profile.HelpOffersJson),
                LookingFor = ParseTags(profile.LookingForJson),
                Email = profile.ShareEmail && !profile.Under18 ? buyer?.Email : null,
                Mobile = profile.ShareMobile && !profile.Under18 ? buyer?.Mobile : null,
                ConnectedAtUtc = row.ResolvedAtUtc ?? row.CreatedAtUtc,
            });
        }

        return list;
    }

    public async Task<(int Status, string? Message)> BlockAsync(string buyerId, string targetBuyerId, CancellationToken ct)
    {
        var target = (targetBuyerId ?? "").Trim();
        if (string.IsNullOrWhiteSpace(target) || target == buyerId)
        {
            return (400, "Choose someone to block.");
        }

        var row = await db.PathConnectRequests.FirstOrDefaultAsync(
            r => (r.FromBuyerId == buyerId && r.ToBuyerId == target) || (r.FromBuyerId == target && r.ToBuyerId == buyerId),
            ct);
        if (row is null)
        {
            row = new PathConnectRequestRecord
            {
                FromBuyerId = buyerId,
                ToBuyerId = target,
                Status = "blocked",
                CreatedAtUtc = DateTime.UtcNow,
                ResolvedAtUtc = DateTime.UtcNow,
            };
            db.PathConnectRequests.Add(row);
        }
        else
        {
            row.Status = "blocked";
            row.ResolvedAtUtc = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return (200, null);
    }

    public async Task<(int Status, string? Message)> ReportAsync(string buyerId, PathReportDto body, CancellationToken ct)
    {
        var target = (body.TargetBuyerId ?? "").Trim();
        var reason = (body.Reason ?? "").Trim();
        if (string.IsNullOrWhiteSpace(target) || target == buyerId)
        {
            return (400, "Choose someone to report.");
        }

        if (reason.Length < 8)
        {
            return (400, "Add a short reason (at least 8 characters).");
        }

        if (reason.Length > 400)
        {
            reason = reason[..400];
        }

        db.PathCircleReports.Add(new PathCircleReportRecord
        {
            ReporterBuyerId = buyerId,
            TargetBuyerId = target,
            Reason = reason,
            CreatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
        return (200, null);
    }

    public async Task<PathProfileDto?> FindByInviteAsync(string code, CancellationToken ct)
    {
        var invite = (code ?? "").Trim();
        if (string.IsNullOrWhiteSpace(invite))
        {
            return null;
        }

        var profile = await db.PathProfiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.InviteCode == invite && p.IsDiscoverable, ct);
        return profile is null ? null : await ToProfileDtoAsync(profile, ct);
    }

    public async Task<(int Status, object Body)> ListMessagesAsync(
        string buyerId,
        string withBuyerId,
        CancellationToken ct)
    {
        if (!await HasActiveSubscriptionAsync(buyerId, ct))
        {
            return (402, SubscriptionRequired());
        }

        var withId = (withBuyerId ?? "").Trim();
        if (withId.Length == 0 || withId == buyerId)
        {
            return (400, new { message = "Choose a connection to chat with." });
        }

        if (!await IsConnectedAsync(buyerId, withId, ct))
        {
            return (403, new { message = "You can chat only after both of you accept a connect request." });
        }

        var rows = await db.PathMessages.AsNoTracking()
            .Where(m =>
                (m.FromBuyerId == buyerId && m.ToBuyerId == withId)
                || (m.FromBuyerId == withId && m.ToBuyerId == buyerId))
            .OrderBy(m => m.CreatedAtUtc)
            .Take(200)
            .ToListAsync(ct);

        var list = rows.Select(m => new PathMessageDto
        {
            Id = m.Id,
            FromBuyerId = m.FromBuyerId,
            ToBuyerId = m.ToBuyerId,
            Body = m.Body,
            CreatedAtUtc = m.CreatedAtUtc,
            Mine = m.FromBuyerId == buyerId,
        }).ToList();

        return (200, list);
    }

    public async Task<(int Status, object Body)> SendMessageAsync(
        string buyerId,
        PathMessageCreateDto body,
        CancellationToken ct)
    {
        if (!await HasActiveSubscriptionAsync(buyerId, ct))
        {
            return (402, SubscriptionRequired());
        }

        var toId = (body.ToBuyerId ?? "").Trim();
        var text = (body.Body ?? "").Trim();
        if (toId.Length == 0 || toId == buyerId)
        {
            return (400, new { message = "Choose someone to message." });
        }

        if (text.Length == 0)
        {
            return (400, new { message = "Write a message." });
        }

        if (text.Length > 2000)
        {
            text = text[..2000];
        }

        if (!await IsConnectedAsync(buyerId, toId, ct))
        {
            return (403, new { message = "You can chat only after both of you accept a connect request." });
        }

        var row = new PathMessageRecord
        {
            FromBuyerId = buyerId,
            ToBuyerId = toId,
            Body = text,
            CreatedAtUtc = DateTime.UtcNow,
        };
        db.PathMessages.Add(row);
        await db.SaveChangesAsync(ct);

        return (200, new PathMessageDto
        {
            Id = row.Id,
            FromBuyerId = row.FromBuyerId,
            ToBuyerId = row.ToBuyerId,
            Body = row.Body,
            CreatedAtUtc = row.CreatedAtUtc,
            Mine = true,
        });
    }

    public async Task<PathCircleStatsDto> AdminStatsAsync(CancellationToken ct)
    {
        var reports = await db.PathCircleReports.AsNoTracking()
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(40)
            .ToListAsync(ct);
        var ids = reports.SelectMany(r => new[] { r.ReporterBuyerId, r.TargetBuyerId }).Distinct().ToList();
        var names = await db.PathProfiles.AsNoTracking()
            .Where(p => ids.Contains(p.BuyerId))
            .ToDictionaryAsync(p => p.BuyerId, p => p.DisplayName, StringComparer.OrdinalIgnoreCase, ct);
        var buyers = await db.StoreBuyers.AsNoTracking()
            .Where(b => ids.Contains(b.Id))
            .ToDictionaryAsync(b => b.Id, b => b.Name, StringComparer.OrdinalIgnoreCase, ct);

        return new PathCircleStatsDto
        {
            Profiles = await db.PathProfiles.CountAsync(ct),
            Discoverable = await db.PathProfiles.CountAsync(p => p.IsDiscoverable, ct),
            PendingRequests = await db.PathConnectRequests.CountAsync(r => r.Status == "pending", ct),
            AcceptedConnections = await db.PathConnectRequests.CountAsync(r => r.Status == "accepted", ct),
            Reports = await db.PathCircleReports.CountAsync(ct),
            RecentReports = reports.Select(r => new PathCircleReportRowDto
            {
                Id = r.Id,
                ReporterBuyerId = r.ReporterBuyerId,
                ReporterName = names.GetValueOrDefault(r.ReporterBuyerId) ?? buyers.GetValueOrDefault(r.ReporterBuyerId) ?? r.ReporterBuyerId,
                TargetBuyerId = r.TargetBuyerId,
                TargetName = names.GetValueOrDefault(r.TargetBuyerId) ?? buyers.GetValueOrDefault(r.TargetBuyerId) ?? r.TargetBuyerId,
                Reason = r.Reason,
                CreatedAtUtc = r.CreatedAtUtc,
            }).ToList(),
        };
    }

    private async Task<PathProfileDto> ToProfileDtoAsync(PathProfileRecord profile, CancellationToken ct)
    {
        var nodes = await db.Nodes.AsNoTracking()
            .Where(n => n.Id == profile.StandingNodeId || n.Id == profile.GoalNodeId)
            .ToDictionaryAsync(n => n.Id, StringComparer.OrdinalIgnoreCase, ct);
        return new PathProfileDto
        {
            BuyerId = profile.BuyerId,
            DisplayName = profile.DisplayName,
            Headline = profile.Headline,
            City = profile.City,
            StandingNodeId = profile.StandingNodeId,
            StandingTitle = NodeLabel(nodes.GetValueOrDefault(profile.StandingNodeId), profile.StandingNodeId),
            GoalNodeId = profile.GoalNodeId,
            GoalTitle = NodeLabel(nodes.GetValueOrDefault(profile.GoalNodeId), profile.GoalNodeId),
            Audience = profile.Audience,
            CircleRole = profile.CircleRole,
            Bio = profile.Bio,
            HelpOffers = ParseTags(profile.HelpOffersJson),
            LookingFor = ParseTags(profile.LookingForJson),
            IsDiscoverable = profile.IsDiscoverable,
            ShareEmail = profile.ShareEmail,
            ShareMobile = profile.ShareMobile,
            Under18 = profile.Under18,
            InviteCode = profile.InviteCode,
            UpdatedAtUtc = profile.UpdatedAtUtc,
        };
    }

    private async Task<PathConnectRequestDto> ToRequestDtoAsync(
        PathConnectRequestRecord row,
        string viewerId,
        CancellationToken ct)
    {
        var otherId = row.FromBuyerId == viewerId ? row.ToBuyerId : row.FromBuyerId;
        var other = await db.PathProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.BuyerId == otherId, ct);
        var nodeIds = new List<string>();
        if (other is not null)
        {
            nodeIds.Add(other.StandingNodeId);
            nodeIds.Add(other.GoalNodeId);
        }

        var nodes = nodeIds.Count == 0
            ? new Dictionary<string, CareerNodeRecord>(StringComparer.OrdinalIgnoreCase)
            : await db.Nodes.AsNoTracking()
                .Where(n => nodeIds.Contains(n.Id))
                .ToDictionaryAsync(n => n.Id, StringComparer.OrdinalIgnoreCase, ct);

        return new PathConnectRequestDto
        {
            Id = row.Id,
            Direction = row.FromBuyerId == viewerId ? "outgoing" : "incoming",
            OtherBuyerId = otherId,
            OtherDisplayName = other?.DisplayName ?? "Peer",
            OtherHeadline = other?.Headline ?? "",
            GoalTitle = other is null ? "" : NodeLabel(nodes.GetValueOrDefault(other.GoalNodeId)),
            StandingTitle = other is null ? "" : NodeLabel(nodes.GetValueOrDefault(other.StandingNodeId)),
            Status = row.Status,
            Note = row.Note,
            CreatedAtUtc = row.CreatedAtUtc,
        };
    }

    private async Task<(int Status, object Payload)> ListMentorPeersAsync(
        string buyerId,
        PathProfileRecord me,
        CancellationToken ct)
    {
        var myRole = StoreBuyerService.NormalizeCircleRole(me.CircleRole);
        var blocked = await BlockedBuyerIdsAsync(buyerId, ct);
        var relations = await RelationMapAsync(buyerId, ct);

        List<PathProfileRecord> candidates;
        if (myRole == "guide")
        {
            candidates = await db.PathProfiles.AsNoTracking()
                .Where(p =>
                    p.IsDiscoverable
                    && p.BuyerId != buyerId
                    && p.CircleRole == "aspirant"
                    && (p.GoalNodeId == me.StandingNodeId || p.GoalNodeId == me.GoalNodeId))
                .OrderByDescending(p => p.UpdatedAtUtc)
                .Take(120)
                .ToListAsync(ct);
        }
        else
        {
            candidates = await db.PathProfiles.AsNoTracking()
                .Where(p =>
                    p.IsDiscoverable
                    && p.BuyerId != buyerId
                    && p.CircleRole == "guide"
                    && (p.StandingNodeId == me.GoalNodeId || p.GoalNodeId == me.GoalNodeId))
                .OrderByDescending(p => p.UpdatedAtUtc)
                .Take(120)
                .ToListAsync(ct);
        }

        var nodeIds = candidates
            .SelectMany(p => new[] { p.StandingNodeId, p.GoalNodeId })
            .Append(me.StandingNodeId)
            .Append(me.GoalNodeId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var nodes = await db.Nodes.AsNoTracking()
            .Where(n => nodeIds.Contains(n.Id))
            .ToDictionaryAsync(n => n.Id, StringComparer.OrdinalIgnoreCase, ct);

        var cards = new List<PathPeerCardDto>();
        foreach (var peer in candidates)
        {
            if (blocked.Contains(peer.BuyerId))
            {
                continue;
            }

            relations.TryGetValue(peer.BuyerId, out var rel);
            if (rel.Status is "blocked" or "declined")
            {
                continue;
            }

            var score = 50;
            if (myRole == "aspirant")
            {
                if (string.Equals(peer.StandingNodeId, me.GoalNodeId, StringComparison.OrdinalIgnoreCase))
                {
                    score += 30;
                }

                if (string.Equals(peer.GoalNodeId, me.GoalNodeId, StringComparison.OrdinalIgnoreCase))
                {
                    score += 15;
                }
            }
            else
            {
                if (string.Equals(peer.GoalNodeId, me.StandingNodeId, StringComparison.OrdinalIgnoreCase))
                {
                    score += 30;
                }

                if (string.Equals(peer.GoalNodeId, me.GoalNodeId, StringComparison.OrdinalIgnoreCase))
                {
                    score += 15;
                }
            }

            cards.Add(new PathPeerCardDto
            {
                BuyerId = peer.BuyerId,
                DisplayName = peer.DisplayName,
                Headline = peer.Headline,
                City = peer.Under18 ? null : peer.City,
                StandingNodeId = peer.StandingNodeId,
                StandingTitle = NodeLabel(nodes.GetValueOrDefault(peer.StandingNodeId), peer.StandingNodeId),
                GoalNodeId = peer.GoalNodeId,
                GoalTitle = NodeLabel(nodes.GetValueOrDefault(peer.GoalNodeId), peer.GoalNodeId),
                Audience = peer.Audience,
                Bio = peer.Bio,
                HelpOffers = ParseTags(peer.HelpOffersJson),
                LookingFor = ParseTags(peer.LookingForJson),
                MatchScore = score,
                Relation = rel.Status ?? "none",
                RequestId = rel.RequestId,
            });
        }

        return (200, cards.OrderByDescending(c => c.MatchScore).ThenBy(c => c.DisplayName).Take(40).ToList());
    }

    private async Task<bool> HasActiveSubscriptionAsync(string buyerId, CancellationToken ct) =>
        await db.BuyerSubscriptions.AsNoTracking()
            .AnyAsync(
                s => s.BuyerId == buyerId && s.Status == "active" && s.PeriodEndUtc > DateTime.UtcNow,
                ct);

    private static object SubscriptionRequired() =>
        new { message = "Subscribe to Path Circle mentors (₹199/month) to use this feature." };

    private async Task<bool> IsConnectedAsync(string buyerId, string otherId, CancellationToken ct) =>
        await db.PathConnectRequests.AsNoTracking()
            .AnyAsync(
                r => r.Status == "accepted"
                     && ((r.FromBuyerId == buyerId && r.ToBuyerId == otherId)
                         || (r.FromBuyerId == otherId && r.ToBuyerId == buyerId)),
                ct);

    private async Task<HashSet<string>> BlockedBuyerIdsAsync(string buyerId, CancellationToken ct)
    {
        var rows = await db.PathConnectRequests.AsNoTracking()
            .Where(r => r.Status == "blocked" && (r.FromBuyerId == buyerId || r.ToBuyerId == buyerId))
            .Select(r => new { r.FromBuyerId, r.ToBuyerId })
            .ToListAsync(ct);
        return rows
            .Select(r => r.FromBuyerId == buyerId ? r.ToBuyerId : r.FromBuyerId)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private async Task<Dictionary<string, (string Status, int? RequestId)>> RelationMapAsync(
        string buyerId,
        CancellationToken ct)
    {
        var rows = await db.PathConnectRequests.AsNoTracking()
            .Where(r => r.FromBuyerId == buyerId || r.ToBuyerId == buyerId)
            .ToListAsync(ct);
        var map = new Dictionary<string, (string Status, int? RequestId)>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
        {
            var other = row.FromBuyerId == buyerId ? row.ToBuyerId : row.FromBuyerId;
            map[other] = (row.Status, row.Id);
        }

        return map;
    }

    private async Task<string> NewInviteCodeAsync(CancellationToken ct)
    {
        for (var i = 0; i < 8; i++)
        {
            var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
            if (!await db.PathProfiles.AnyAsync(p => p.InviteCode == code, ct))
            {
                return code;
            }
        }

        return Guid.NewGuid().ToString("N")[..10];
    }

    private static List<string> SanitizeTags(IEnumerable<string>? tags) =>
        (tags ?? [])
            .Select(t => (t ?? "").Trim().ToLowerInvariant())
            .Where(t => AllowedTags.Contains(t))
            .Distinct()
            .Take(6)
            .ToList();

    private static List<string> ParseTags(string json)
    {
        try
        {
            return SanitizeTags(JsonSerializer.Deserialize<List<string>>(json ?? "[]"));
        }
        catch
        {
            return [];
        }
    }

    private static string NormalizeAudience(string? audience)
    {
        var value = (audience ?? "student").Trim().ToLowerInvariant();
        if (value is "guardian")
        {
            return "parent";
        }

        if (value is "explore")
        {
            return "professional";
        }

        return Audiences.Contains(value) ? value : "student";
    }

    private static string NodeLabel(CareerNodeRecord? node, string fallback = "")
    {
        if (node is null)
        {
            return fallback;
        }

        return string.IsNullOrWhiteSpace(node.ShortTitle) ? node.Title : node.ShortTitle;
    }

    private static string FirstName(string name)
    {
        var part = (name ?? "").Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        return string.IsNullOrWhiteSpace(part) ? "Peer" : part;
    }

    private static string? TrimNote(string? note)
    {
        var value = (note ?? "").Trim();
        if (value.Length == 0)
        {
            return null;
        }

        return value.Length <= 240 ? value : value[..240];
    }
}
