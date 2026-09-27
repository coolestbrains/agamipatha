using System.Text.Json;
using System.Text.Json.Serialization;

namespace AgamiPatha.Api.Models;

public class CareerNodeDto
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string ShortTitle { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Field { get; set; } = "";
    public string Duration { get; set; } = "";
    public string TypicalAge { get; set; } = "";
    public string Summary { get; set; } = "";
    public List<string> WhatYouStudy { get; set; } = [];
    public List<string> Exams { get; set; } = [];
    public List<string> Skills { get; set; } = [];
    public string Outlook { get; set; } = "";
    public string? SalaryHint { get; set; }
    public string? CostGovt { get; set; }
    public string? CostPvt { get; set; }
    public List<string>? Workplaces { get; set; }
    public List<string>? Institutes { get; set; }
    public List<string>? Certifications { get; set; }
    public int? ExperienceYearsMin { get; set; }
    public int? ExperienceYearsTypical { get; set; }
    public string? EntryLevel { get; set; }
    public List<string>? FeederRoles { get; set; }

    public static CareerNodeDto From(CareerNodeRecord r) => new()
    {
        Id = r.Id,
        Title = r.Title,
        ShortTitle = r.ShortTitle,
        Kind = r.Kind,
        Field = r.Field,
        Duration = r.Duration,
        TypicalAge = r.TypicalAge,
        Summary = r.Summary,
        WhatYouStudy = Parse(r.WhatYouStudyJson),
        Exams = Parse(r.ExamsJson),
        Skills = Parse(r.SkillsJson),
        Outlook = r.Outlook,
        SalaryHint = r.SalaryHint,
        CostGovt = r.CostGovt,
        CostPvt = r.CostPvt,
        Workplaces = string.IsNullOrWhiteSpace(r.WorkplacesJson) ? null : Parse(r.WorkplacesJson),
        Institutes = string.IsNullOrWhiteSpace(r.InstitutesJson) ? null : Parse(r.InstitutesJson),
        Certifications = string.IsNullOrWhiteSpace(r.CertificationsJson) ? null : Parse(r.CertificationsJson),
        ExperienceYearsMin = r.ExperienceYearsMin,
        ExperienceYearsTypical = r.ExperienceYearsTypical,
        EntryLevel = string.IsNullOrWhiteSpace(r.EntryLevel) ? null : r.EntryLevel,
        FeederRoles = string.IsNullOrWhiteSpace(r.FeederRolesJson) ? null : Parse(r.FeederRolesJson)
    };

    public CareerNodeRecord ToRecord(bool stampCreate = false) => new()
    {
        Id = Id.Trim(),
        Title = Title.Trim(),
        ShortTitle = string.IsNullOrWhiteSpace(ShortTitle) ? Title : ShortTitle.Trim(),
        Kind = Kind.Trim(),
        Field = Field.Trim(),
        Duration = Duration.Trim(),
        TypicalAge = TypicalAge.Trim(),
        Summary = Summary.Trim(),
        WhatYouStudyJson = JsonSerializer.Serialize(WhatYouStudy),
        ExamsJson = JsonSerializer.Serialize(Exams),
        SkillsJson = JsonSerializer.Serialize(Skills),
        Outlook = Outlook.Trim(),
        SalaryHint = SalaryHint,
        CostGovt = CostGovt,
        CostPvt = CostPvt,
        WorkplacesJson = Workplaces is null ? null : JsonSerializer.Serialize(Workplaces),
        InstitutesJson = Institutes is { Count: > 0 } ? JsonSerializer.Serialize(Institutes) : null,
        CertificationsJson = Certifications is { Count: > 0 } ? JsonSerializer.Serialize(Certifications) : null,
        ExperienceYearsMin = ExperienceYearsMin,
        ExperienceYearsTypical = ExperienceYearsTypical,
        EntryLevel = string.IsNullOrWhiteSpace(EntryLevel) ? null : EntryLevel.Trim(),
        FeederRolesJson = FeederRoles is { Count: > 0 } ? JsonSerializer.Serialize(FeederRoles) : null,
        CreatedAtUtc = stampCreate ? DateTime.UtcNow : null
    };

    private static List<string> Parse(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }
}

public class CareerEdgeDto
{
    public int Id { get; set; }
    public string From { get; set; } = "";
    public string To { get; set; } = "";
    public string Via { get; set; } = "";
    public string Notes { get; set; } = "";

    public static CareerEdgeDto FromRecord(CareerEdgeRecord r) => new()
    {
        Id = r.Id,
        From = r.FromId,
        To = r.ToId,
        Via = r.Via,
        Notes = r.Notes
    };
}

public class CatalogDto
{
    public List<CareerNodeDto> Nodes { get; set; } = [];
    public List<CareerEdgeDto> Edges { get; set; } = [];
}

public class PathStepDto
{
    public CareerNodeDto Node { get; set; } = new();
    public CareerEdgeDto? Incoming { get; set; }
    public int StepIndex { get; set; }
}

public class CareerPathDto
{
    public string Title { get; set; } = "";
    public string Spine { get; set; } = "";
    public List<PathStepDto> Steps { get; set; } = [];
    public string TotalLabel { get; set; } = "";
    public int AlternateCount { get; set; }
    public bool Recommended { get; set; }
    public int Score { get; set; }
    public string RecommendReason { get; set; } = "";
    public List<string> RecommendDetails { get; set; } = [];
}

public class PathSetDto
{
    public List<CareerPathDto> Routes { get; set; } = [];
    public int RouteCount { get; set; }
    public int RecommendedIndex { get; set; }
}

public class NextStepDto
{
    public CareerNodeDto Node { get; set; } = new();
    public CareerEdgeDto Edge { get; set; } = new();
}

public class OptionsDto
{
    public CareerNodeDto? From { get; set; }
    public List<NextStepDto> Next { get; set; } = [];
    public List<CareerNodeDto> Professions { get; set; } = [];
}

public class GuestVisitRequest
{
    public string? VisitorKey { get; set; }
}

public class StatPointDto
{
    public string Date { get; set; } = "";
    public long Daily { get; set; }
    public long Value { get; set; }
}

public class StatSeriesDto
{
    public string Metric { get; set; } = "";
    public string Label { get; set; } = "";
    public long Total { get; set; }
    public List<StatPointDto> Points { get; set; } = [];
}

public class NodeInterestRequest
{
    public string NodeId { get; set; } = "";
    public string? FromId { get; set; }
    public string? ToId { get; set; }
    public string? Via { get; set; }
    public string? Kind { get; set; }
}

public class LoginRequest
{
    public string? Login { get; set; }
    public string Password { get; set; } = "";
}

public class LoginResponse
{
    public string Token { get; set; } = "";
    public string? BuyerToken { get; set; }
    public string? BuyerName { get; set; }
}

public class SeedFile
{
    [JsonPropertyName("nodes")]
    public List<CareerNodeDto> Nodes { get; set; } = [];

    [JsonPropertyName("edges")]
    public List<SeedEdge> Edges { get; set; } = [];
}

public class SeedEdge
{
    [JsonPropertyName("from")]
    public string From { get; set; } = "";

    [JsonPropertyName("to")]
    public string To { get; set; } = "";

    [JsonPropertyName("via")]
    public string Via { get; set; } = "";

    [JsonPropertyName("notes")]
    public string Notes { get; set; } = "";
}

public class AdminPathHopDto
{
    public string NodeId { get; set; } = "";
    public string Via { get; set; } = "";
    public string Notes { get; set; } = "";
}

public class AdminPathSaveDto
{
    public List<AdminPathHopDto> Steps { get; set; } = [];
    public List<string>? PreviousNodeIds { get; set; }
    public bool RemoveDroppedHops { get; set; }
}

public class AdminPathSaveResultDto
{
    public int Upserted { get; set; }
    public int Removed { get; set; }
    public string Spine { get; set; } = "";
    public List<CareerEdgeDto> Edges { get; set; } = [];
}

public class ChatTurnDto
{
    public string Role { get; set; } = "";
    public string Content { get; set; } = "";
}

public class ChatRequestDto
{
    public string Message { get; set; } = "";
    public List<ChatTurnDto>? History { get; set; }
    public string? NodeId { get; set; }
    public string? FromId { get; set; }
    public string? ToId { get; set; }
}

public class ChatReplyDto
{
    public string Reply { get; set; } = "";
}

public class StoreProductConfig
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Kind { get; set; } = "";
    public int PricePaise { get; set; }
    public string File { get; set; } = "";
    public string Cover { get; set; } = "";
}

public class StoreProductDto
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Kind { get; set; } = "";
    public int PricePaise { get; set; }
    public string PriceLabel { get; set; } = "";
    public string Cover { get; set; } = "";
    public string File { get; set; } = "";
    public bool HasUploadedCover { get; set; }
    public long CoverVersion { get; set; }
    public bool HasPdf { get; set; }
    public bool OnSale { get; set; }
}

public class AdminEbookCoverDto
{
    public string ProductId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Cover { get; set; } = "";
    public bool HasUploadedCover { get; set; }
    public long CoverVersion { get; set; }
}

public class StoreCatalogDto
{
    public bool Configured { get; set; }
    public bool TestMode { get; set; }
    public string KeyId { get; set; } = "";
    public string Currency { get; set; } = "INR";
    public List<StoreProductDto> Products { get; set; } = [];
}

public class StoreOrderRequestDto
{
    public string ProductId { get; set; } = "";
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Mobile { get; set; }
    public string? Password { get; set; }
}

public class StoreLoginRequestDto
{
    public string Login { get; set; } = "";
    public string Password { get; set; } = "";
}

public class StoreRegisterRequestDto
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Mobile { get; set; }
    public string? Password { get; set; }
}

public class StorePurchaseDto
{
    public string ProductId { get; set; } = "";
    public string Title { get; set; } = "";
    public string FileName { get; set; } = "";
    public string DownloadToken { get; set; } = "";
}

public class StoreBuyerOrderDto
{
    public string OrderId { get; set; } = "";
    public string ProductId { get; set; } = "";
    public string Title { get; set; } = "";
    public string FileName { get; set; } = "";
    public string DownloadToken { get; set; } = "";
    public string Status { get; set; } = "";
    public int AmountPaise { get; set; }
    public string AmountLabel { get; set; } = "";
    public string Currency { get; set; } = "INR";
    public DateTime PlacedAtUtc { get; set; }
}

public class StoreBuyerAuthDto
{
    public string Token { get; set; } = "";
    public string BuyerName { get; set; } = "";
    public string? AdminToken { get; set; }
    public List<StorePurchaseDto> Purchases { get; set; } = [];
}

public class StoreOrderDto
{
    public string OrderId { get; set; } = "";
    public int Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string KeyId { get; set; } = "";
    public string ProductTitle { get; set; } = "";
    public bool TestMode { get; set; }
}

public class StoreVerifyRequestDto
{
    public string OrderId { get; set; } = "";
    public string PaymentId { get; set; } = "";
    public string Signature { get; set; } = "";
}

public class StoreVerifyDto
{
    public string DownloadToken { get; set; } = "";
    public string ProductTitle { get; set; } = "";
    public string FileName { get; set; } = "";
    public string? Token { get; set; }
    public string? BuyerName { get; set; }
}

public class AdminStoreProductSalesDto
{
    public string ProductId { get; set; } = "";
    public string Title { get; set; } = "";
    public int BooksPurchased { get; set; }
    public int AmountPaise { get; set; }
    public string AmountLabel { get; set; } = "";
}

public class AdminStoreOrderRowDto
{
    public string Id { get; set; } = "";
    public string ProductId { get; set; } = "";
    public string ProductTitle { get; set; } = "";
    public int AmountPaise { get; set; }
    public string AmountLabel { get; set; } = "";
    public string Currency { get; set; } = "INR";
    public string BuyerId { get; set; } = "";
    public string BuyerName { get; set; } = "";
    public string BuyerEmail { get; set; } = "";
    public DateTime PaidAtUtc { get; set; }
    public string PaymentId { get; set; } = "";
}

public class AdminStoreBuyerPurchaseDto
{
    public string OrderId { get; set; } = "";
    public string ProductId { get; set; } = "";
    public string Title { get; set; } = "";
    public int Count { get; set; }
    public int AmountPaise { get; set; }
    public string AmountLabel { get; set; } = "";
    public DateTime PaidAtUtc { get; set; }
}

public class AdminStoreBuyerRowDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Mobile { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public bool IsAdmin { get; set; }
    public int BooksPurchased { get; set; }
    public int AmountPaise { get; set; }
    public string AmountLabel { get; set; } = "";
    public List<AdminStoreBuyerPurchaseDto> Purchases { get; set; } = [];
}

public class AdminStoreBuyerUpdateDto
{
    public string Name { get; set; } = "";
    public string? Email { get; set; }
    public string? Mobile { get; set; }
}

public class AdminStoreBuyerPasswordDto
{
    public string Password { get; set; } = "";
}

public class AdminStoreSalesDto
{
    public int BuyerCount { get; set; }
    public int BooksPurchased { get; set; }
    public int AmountReceivedPaise { get; set; }
    public string AmountReceivedLabel { get; set; } = "";
    public string Currency { get; set; } = "INR";
    public int BooksToday { get; set; }
    public int AmountTodayPaise { get; set; }
    public string AmountTodayLabel { get; set; } = "";
    public List<AdminStoreProductSalesDto> Products { get; set; } = [];
    public List<AdminStoreBuyerRowDto> Buyers { get; set; } = [];
    public List<AdminStoreOrderRowDto> Recent { get; set; } = [];
}

public class CatalogSuggestionRequestDto
{
    public string Slot { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Notes { get; set; }
    public string? FromId { get; set; }
    public string? FromTitle { get; set; }
}

public class CatalogSuggestionDto
{
    public int Id { get; set; }
    public string Slot { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Title { get; set; } = "";
    public string Notes { get; set; } = "";
    public string FromId { get; set; } = "";
    public string FromTitle { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}
