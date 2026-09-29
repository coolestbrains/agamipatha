using System.ComponentModel.DataAnnotations;

namespace AgamiPatha.Api.Models;

public class CareerNodeRecord
{
    [Key]
    [MaxLength(80)]
    public string Id { get; set; } = "";

    [MaxLength(160)]
    public string Title { get; set; } = "";

    [MaxLength(80)]
    public string ShortTitle { get; set; } = "";

    [MaxLength(40)]
    public string Kind { get; set; } = "";

    [MaxLength(80)]
    public string Field { get; set; } = "";

    [MaxLength(80)]
    public string Duration { get; set; } = "";

    [MaxLength(80)]
    public string TypicalAge { get; set; } = "";

    public string Summary { get; set; } = "";
    public string WhatYouStudyJson { get; set; } = "[]";
    public string ExamsJson { get; set; } = "[]";
    public string SkillsJson { get; set; } = "[]";
    public string Outlook { get; set; } = "";
    public string? SalaryHint { get; set; }
    public string? CostGovt { get; set; }
    public string? CostPvt { get; set; }
    public string? WorkplacesJson { get; set; }
    public string? InstitutesJson { get; set; }
    public string? CertificationsJson { get; set; }

    /// <summary>Minimum years of relevant work usually expected before this title (professions).</summary>
    public int? ExperienceYearsMin { get; set; }

    /// <summary>Typical years before this title is realistic (professions).</summary>
    public int? ExperienceYearsTypical { get; set; }

    /// <summary>campus | early | experienced</summary>
    [MaxLength(20)]
    public string? EntryLevel { get; set; }

    /// <summary>JSON array of feeder profession ids.</summary>
    public string? FeederRolesJson { get; set; }

    /// <summary>Set when an admin creates the node. Seeded rows stay null so they are not counted as “added today”.</summary>
    public DateTime? CreatedAtUtc { get; set; }
}

public class CareerEdgeRecord
{
    public int Id { get; set; }

    [MaxLength(80)]
    public string FromId { get; set; } = "";

    [MaxLength(80)]
    public string ToId { get; set; } = "";

    [MaxLength(200)]
    public string Via { get; set; } = "";

    public string Notes { get; set; } = "";
}

/// <summary>
/// Running totals persisted in SQL Server (DefaultConnection).
/// Qualifications and professions are counted from the Nodes table, not stored here.
/// </summary>
public class SiteStatsRecord
{
    public int Id { get; set; }
    public long SearchCount { get; set; }
    public long GuestVisitCount { get; set; }
}

public class GuestVisitRecord
{
    public int Id { get; set; }
    public DateTime OccurredAtUtc { get; set; }

    [MaxLength(64)]
    public string VisitorKey { get; set; } = "";

    [MaxLength(10)]
    public string DayIst { get; set; } = "";
}

public class SearchVisitRecord
{
    public int Id { get; set; }
    public DateTime OccurredAtUtc { get; set; }
}

public class NodeInterestRecord
{
    public int Id { get; set; }

    [MaxLength(80)]
    public string NodeId { get; set; } = "";

    [MaxLength(20)]
    public string Kind { get; set; } = "";

    public DateTime OccurredAtUtc { get; set; }
}

public class RouteChoiceRecord
{
    public int Id { get; set; }

    [MaxLength(80)]
    public string FromId { get; set; } = "";

    [MaxLength(80)]
    public string ToId { get; set; } = "";

    [MaxLength(400)]
    public string Via { get; set; } = "";

    public DateTime OccurredAtUtc { get; set; }
}

public class StoreBuyerRecord
{
    [Key]
    [MaxLength(80)]
    public string Id { get; set; } = "";

    [MaxLength(80)]
    public string Name { get; set; } = "";

    [MaxLength(200)]
    public string? Email { get; set; }

    [MaxLength(20)]
    public string? Mobile { get; set; }

    [MaxLength(400)]
    public string PasswordHash { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; }

    /// <summary>aspirant | guide</summary>
    [MaxLength(20)]
    public string CircleRole { get; set; } = "aspirant";

    [MaxLength(80)]
    public string? StandingNodeId { get; set; }

    [MaxLength(80)]
    public string? GoalNodeId { get; set; }
}

public class StoreOrderRecord
{
    [Key]
    [MaxLength(80)]
    public string Id { get; set; } = "";

    [MaxLength(80)]
    public string? BuyerId { get; set; }

    [MaxLength(80)]
    public string ProductId { get; set; } = "";

    public int AmountPaise { get; set; }

    [MaxLength(10)]
    public string Currency { get; set; } = "INR";

    [MaxLength(80)]
    public string RazorpayOrderId { get; set; } = "";

    [MaxLength(80)]
    public string? RazorpayPaymentId { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "created";

    [MaxLength(80)]
    public string? DownloadToken { get; set; }

    [MaxLength(200)]
    public string? BuyerEmail { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? PaidAtUtc { get; set; }
}

public class BuyerSubscriptionRecord
{
    [Key]
    [MaxLength(80)]
    public string Id { get; set; } = "";

    [MaxLength(80)]
    public string BuyerId { get; set; } = "";

    /// <summary>active | expired | canceled</summary>
    [MaxLength(20)]
    public string Status { get; set; } = "active";

    public int AmountPaise { get; set; }

    [MaxLength(10)]
    public string Currency { get; set; } = "INR";

    [MaxLength(80)]
    public string? RazorpayOrderId { get; set; }

    [MaxLength(80)]
    public string? RazorpayPaymentId { get; set; }

    public DateTime PeriodStartUtc { get; set; }

    public DateTime PeriodEndUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}

public class PathMessageRecord
{
    public int Id { get; set; }

    [MaxLength(80)]
    public string FromBuyerId { get; set; } = "";

    [MaxLength(80)]
    public string ToBuyerId { get; set; } = "";

    [MaxLength(2000)]
    public string Body { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? ReadAtUtc { get; set; }
}

public class CatalogSuggestionRecord
{
    public int Id { get; set; }

    [MaxLength(20)]
    public string Slot { get; set; } = "";

    [MaxLength(40)]
    public string Kind { get; set; } = "";

    [MaxLength(160)]
    public string Title { get; set; } = "";

    [MaxLength(500)]
    public string Notes { get; set; } = "";

    [MaxLength(80)]
    public string FromId { get; set; } = "";

    [MaxLength(160)]
    public string FromTitle { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; }
}

public class PathProfileRecord
{
    [Key]
    [MaxLength(80)]
    public string BuyerId { get; set; } = "";

    [MaxLength(80)]
    public string DisplayName { get; set; } = "";

    [MaxLength(160)]
    public string Headline { get; set; } = "";

    [MaxLength(80)]
    public string? City { get; set; }

    [MaxLength(80)]
    public string StandingNodeId { get; set; } = "";

    [MaxLength(80)]
    public string GoalNodeId { get; set; } = "";

    [MaxLength(20)]
    public string Audience { get; set; } = "student";

    /// <summary>aspirant | guide</summary>
    [MaxLength(20)]
    public string CircleRole { get; set; } = "aspirant";

    [MaxLength(500)]
    public string Bio { get; set; } = "";

    public string HelpOffersJson { get; set; } = "[]";

    public string LookingForJson { get; set; } = "[]";

    public bool IsDiscoverable { get; set; } = true;

    public bool ShareEmail { get; set; }

    public bool ShareMobile { get; set; } = true;

    public bool Under18 { get; set; }

    [MaxLength(32)]
    public string InviteCode { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }
}

public class PathConnectRequestRecord
{
    public int Id { get; set; }

    [MaxLength(80)]
    public string FromBuyerId { get; set; } = "";

    [MaxLength(80)]
    public string ToBuyerId { get; set; } = "";

    /// <summary>pending | accepted | declined | blocked</summary>
    [MaxLength(20)]
    public string Status { get; set; } = "pending";

    [MaxLength(240)]
    public string? Note { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? ResolvedAtUtc { get; set; }
}

public class PathCircleReportRecord
{
    public int Id { get; set; }

    [MaxLength(80)]
    public string ReporterBuyerId { get; set; } = "";

    [MaxLength(80)]
    public string TargetBuyerId { get; set; } = "";

    [MaxLength(400)]
    public string Reason { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; }
}
