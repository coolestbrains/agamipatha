using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Services;

public class CareerReportService(
    HttpClient http,
    AppDbContext db,
    PathService paths,
    StoreService store,
    IConfiguration config,
    ILogger<CareerReportService> logger)
{
    private const string DisclaimerText =
        "This report is for guidance only. It is not official counselling, admission advice, or a guarantee of outcomes. "
        + "Verify fees, exam dates, cut-offs, and eligibility on official and institutional sources before you decide.";

    private static readonly ConcurrentDictionary<string, Queue<DateTime>> Hits = new();
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public async Task<CareerReportStatusDto> StatusAsync(string buyerId, CancellationToken ct)
    {
        var sub = await ActiveSubscriptionAsync(buyerId, ct);
        var buyer = await db.StoreBuyers.AsNoTracking().FirstOrDefaultAsync(b => b.Id == buyerId, ct);
        var profile = await db.PathProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.BuyerId == buyerId, ct);
        var aiCredits = buyer?.AiCredits ?? 0;
        return new CareerReportStatusDto
        {
            SubscriptionActive = sub.Active,
            PeriodEndUtc = sub.PeriodEndUtc,
            HasProfile = profile is not null,
            StandingNodeId = profile?.StandingNodeId ?? buyer?.StandingNodeId,
            GoalNodeId = profile?.GoalNodeId ?? buyer?.GoalNodeId,
            DisplayName = profile?.DisplayName ?? buyer?.Name,
            AiCredits = aiCredits,
            ReportCostCredits = StoreService.ReportCostCredits,
        };
    }

    public async Task<(int Status, string? Message, CareerReportDto? Report)> GenerateAsync(
        string buyerId,
        CareerReportRequestDto request,
        CancellationToken ct)
    {
        var sub = await ActiveSubscriptionAsync(buyerId, ct);
        if (!sub.Active)
        {
            return (402, "Subscribe to Path Circle mentors (₹199/month) to generate AI career reports.", null);
        }

        if (!Allow(buyerId))
        {
            return (429, "You can generate up to 5 career reports per hour. Try again in a little while.", null);
        }

        var buyer = await db.StoreBuyers.AsNoTracking().FirstOrDefaultAsync(b => b.Id == buyerId, ct);
        if (buyer is null)
        {
            return (401, "Sign in to generate a report.", null);
        }

        var profile = await db.PathProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.BuyerId == buyerId, ct);
        var fromId = FirstNonEmpty(request.FromId, profile?.StandingNodeId, buyer.StandingNodeId)?.Trim() ?? "";
        var toId = FirstNonEmpty(request.ToId, profile?.GoalNodeId, buyer.GoalNodeId)?.Trim() ?? "";
        if (fromId.Length == 0 || toId.Length == 0)
        {
            return (400, "Pick a starting qualification and a goal career, or set them on My Path / Path Circle profile.", null);
        }

        var pathSet = await paths.FindRoutesAsync(fromId, toId);
        if (pathSet is null || pathSet.Routes.Count == 0)
        {
            return (404, "No mapped route found between those nodes. Try another goal or standing on the planner.", null);
        }

        var via = (request.Via ?? "").Trim();
        var route = PickRoute(pathSet, via);
        var voice = NormalizeVoice(request.Voice);
        var nodes = route.Steps.Select(s => s.Node).ToList();
        var fromNode = nodes[0];
        var toNode = nodes[^1];

        var displayName = FirstNonEmpty(profile?.DisplayName, buyer.Name) ?? "Reader";
        string? city = profile?.City;
        if (profile?.Under18 == true)
        {
            city = null;
        }

        var circleRole = FirstNonEmpty(profile?.CircleRole, buyer.CircleRole) ?? "aspirant";
        var audience = profile?.Audience ?? "student";
        var overview = BuildOverview(route);
        var stages = route.Steps.Select(BuildStage).ToList();
        var facts = BuildFactsBlock(route, fromNode, toNode, overview);
        var aiAvailable = HasAiKeys();
        var creditsCharged = 0;
        var needsAiTopUp = false;
        CareerReportAiDto ai;
        if (aiAvailable && buyer.AiCredits >= StoreService.ReportCostCredits)
        {
            try
            {
                ai = await CallAiNarrativeAsync(facts, voice, ct);
                if (ai.UsedAi)
                {
                    await store.GrantAiCreditsAsync(
                        buyerId,
                        -StoreService.ReportCostCredits,
                        "report-ai",
                        null,
                        ct);
                    creditsCharged = StoreService.ReportCostCredits;
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Career report LLM failed for {BuyerId}", buyerId);
                ai = TemplateAi(route, fromNode, toNode, voice);
            }
        }
        else
        {
            ai = TemplateAi(route, fromNode, toNode, voice);
            if (aiAvailable && buyer.AiCredits < StoreService.ReportCostCredits)
            {
                needsAiTopUp = true;
            }
        }

        var creditsRemaining = await db.StoreBuyers.AsNoTracking()
            .Where(b => b.Id == buyerId)
            .Select(b => b.AiCredits)
            .FirstOrDefaultAsync(ct);

        var slugFrom = Slug(fromNode.Id);
        var slugTo = Slug(toNode.Id);
        var report = new CareerReportDto
        {
            DisplayName = displayName,
            City = string.IsNullOrWhiteSpace(city) ? null : city.Trim(),
            CircleRole = circleRole,
            Audience = audience,
            StandingTitle = fromNode.Title,
            GoalTitle = toNode.Title,
            Spine = route.Spine,
            TotalLabel = route.TotalLabel,
            Overview = overview,
            Stages = stages,
            Ai = ai,
            NextDoors =
            [
                "Join Path Circle (included with your mentor subscription) to connect with peers and guides on the same route.",
                "Browse free career ebooks on the AgamiPatha Online Store for stream choice and path planners.",
            ],
            Disclaimer = DisclaimerText,
            GeneratedAtUtc = DateTime.UtcNow,
            Filename = $"agamipatha-career-report-{slugFrom}-to-{slugTo}.pdf",
            Voice = voice,
            AiAvailable = aiAvailable,
            CreditsRemaining = creditsRemaining,
            ReportCostCredits = StoreService.ReportCostCredits,
            CreditsCharged = creditsCharged,
            NeedsAiTopUp = needsAiTopUp,
        };

        return (200, null, report);
    }

    private static CareerPathDto PickRoute(PathSetDto set, string via)
    {
        if (!string.IsNullOrWhiteSpace(via))
        {
            var match = set.Routes.FirstOrDefault(r =>
                string.Equals(ViaToken(r), via, StringComparison.OrdinalIgnoreCase));
            if (match is not null)
            {
                return match;
            }
        }

        var idx = Math.Clamp(set.RecommendedIndex, 0, set.Routes.Count - 1);
        return set.Routes[idx];
    }

    private static string ViaToken(CareerPathDto route)
    {
        if (route.Steps.Count <= 2)
        {
            return "";
        }

        var mids = route.Steps.Skip(1).Take(route.Steps.Count - 2).Select(s => s.Node.Id);
        return string.Join(",", mids);
    }

    private static List<string> BuildOverview(CareerPathDto route)
    {
        var lines = new List<string>
        {
            $"Route: {route.Spine}",
            $"Length: {route.TotalLabel}.",
        };
        if (!string.IsNullOrWhiteSpace(route.RecommendReason))
        {
            lines.Add(route.RecommendReason.Trim());
        }

        foreach (var detail in route.RecommendDetails.Take(4))
        {
            if (!string.IsNullOrWhiteSpace(detail))
            {
                lines.Add(detail.Trim());
            }
        }

        return lines;
    }

    private static CareerReportStageDto BuildStage(PathStepDto step)
    {
        var node = step.Node;
        var kickerParts = new List<string>();
        if (!string.IsNullOrWhiteSpace(node.Kind))
        {
            kickerParts.Add(node.Kind);
        }

        if (!string.IsNullOrWhiteSpace(node.Field))
        {
            kickerParts.Add(node.Field);
        }

        if (!string.IsNullOrWhiteSpace(node.Duration))
        {
            kickerParts.Add(node.Duration);
        }

        if (!string.IsNullOrWhiteSpace(node.TypicalAge))
        {
            kickerParts.Add($"Typical age {node.TypicalAge}");
        }

        var groups = new List<CareerReportStageGroupDto>();
        AddGroup(groups, "What you study", node.WhatYouStudy);
        AddGroup(groups, "Exams", node.Exams);
        AddGroup(groups, "Skills", node.Skills);
        var costItems = new List<string>();
        if (!string.IsNullOrWhiteSpace(node.CostGovt))
        {
            costItems.Add($"Government / aided (indicative): {node.CostGovt}");
        }

        if (!string.IsNullOrWhiteSpace(node.CostPvt))
        {
            costItems.Add($"Private (indicative): {node.CostPvt}");
        }

        AddGroup(groups, "Typical cost", costItems);
        AddGroup(groups, "Institutes", node.Institutes);
        AddGroup(groups, "Workplaces", node.Workplaces);
        if (!string.IsNullOrWhiteSpace(node.SalaryHint))
        {
            AddGroup(groups, "Pay outlook", [node.SalaryHint]);
        }

        if (!string.IsNullOrWhiteSpace(node.Outlook))
        {
            AddGroup(groups, "Outlook", [node.Outlook]);
        }

        return new CareerReportStageDto
        {
            Title = $"Step {step.StepIndex}: {node.Title}",
            Kicker = string.Join(" · ", kickerParts),
            Summary = node.Summary,
            Groups = groups,
        };
    }

    private static void AddGroup(List<CareerReportStageGroupDto> groups, string label, List<string>? items)
    {
        if (items is not { Count: > 0 })
        {
            return;
        }

        var clean = items.Where(i => !string.IsNullOrWhiteSpace(i)).Select(i => i.Trim()).ToList();
        if (clean.Count == 0)
        {
            return;
        }

        groups.Add(new CareerReportStageGroupDto { Label = label, Items = clean });
    }

    private static string BuildFactsBlock(
        CareerPathDto route,
        CareerNodeDto fromNode,
        CareerNodeDto toNode,
        List<string> overview)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"From: {fromNode.Title}");
        sb.AppendLine($"Goal: {toNode.Title}");
        sb.AppendLine($"Spine: {route.Spine}");
        sb.AppendLine($"Steps: {route.TotalLabel}");
        foreach (var line in overview)
        {
            sb.AppendLine("- ").Append(line);
        }

        foreach (var stage in route.Steps)
        {
            var n = stage.Node;
            sb.AppendLine().Append("## ").Append(n.Title);
            if (!string.IsNullOrWhiteSpace(n.Summary))
            {
                sb.AppendLine().Append(n.Summary);
            }

            AppendFactList(sb, "Study", n.WhatYouStudy);
            AppendFactList(sb, "Exams", n.Exams);
            AppendFactList(sb, "Skills", n.Skills);
            if (!string.IsNullOrWhiteSpace(n.CostGovt))
            {
                sb.AppendLine($"Cost (govt hint): {n.CostGovt}");
            }

            if (!string.IsNullOrWhiteSpace(n.CostPvt))
            {
                sb.AppendLine($"Cost (private hint): {n.CostPvt}");
            }

            AppendFactList(sb, "Institutes", n.Institutes);
            AppendFactList(sb, "Workplaces", n.Workplaces);
            if (!string.IsNullOrWhiteSpace(n.SalaryHint))
            {
                sb.AppendLine($"Salary hint: {n.SalaryHint}");
            }
        }

        return sb.ToString();
    }

    private static void AppendFactList(StringBuilder sb, string label, List<string>? items)
    {
        if (items is not { Count: > 0 })
        {
            return;
        }

        sb.Append(label).Append(": ");
        sb.AppendLine(string.Join("; ", items.Take(12)));
    }

    private async Task<CareerReportAiDto> CallAiNarrativeAsync(string facts, string voice, CancellationToken ct)
    {
        var system = BuildSystemPrompt(voice);
        var user = """
            Using ONLY the catalogue facts below, return a single JSON object with exactly these keys:
            intro (string), fit (string), risks (array of strings), actions30 (array of strings), actions90 (array of strings).
            No markdown, no code fences, no extra keys.
            """ + "\n\n" + facts;

        var raw = await CallModelAsync(system, user, ct);
        var parsed = ParseAiJson(raw);
        if (parsed is null)
        {
            throw new InvalidOperationException("Could not parse LLM JSON.");
        }

        parsed.UsedAi = true;
        return parsed;
    }

    private static string BuildSystemPrompt(string voice)
    {
        var tone = voice switch
        {
            "parent" =>
                "Write for a parent or guardian planning for their child in India. Use clear, reassuring language.",
            "explore" =>
                "Write for someone exploring options without commitment. Be neutral and exploratory.",
            _ => "Write for a student or early-career learner in India. Use direct, encouraging second person.",
        };

        return """
            You are AgamiPatha, an Indian career path guide.
            """ + tone + """
            
            Use ONLY the facts provided. Do NOT invent fees, ranks, cut-offs, exam dates, or admission guarantees.
            If something is uncertain, say to verify on official sites.
            Keep intro and fit to 2-4 sentences each. Provide 3-5 risks and 3-5 actions for 30 days and 90 days.
            Output JSON only.
            """;
    }

    private static CareerReportAiDto TemplateAi(
        CareerPathDto route,
        CareerNodeDto fromNode,
        CareerNodeDto toNode,
        string voice)
    {
        var you = voice == "parent" ? "Your child" : "You";
        var intro =
            $"{you} are mapping from {fromNode.ShortTitle} toward {toNode.ShortTitle}. "
            + $"This AgamiPatha route ({route.TotalLabel}) follows: {route.Spine}.";
        var fit =
            route.RecommendReason.Length > 0
                ? route.RecommendReason
                : $"The catalogue links these stages in a plausible Indian education and career sequence toward {toNode.Title}.";

        var risks = new List<string>
        {
            "Exam pressure and changing eligibility rules — confirm the latest pattern on official exam sites.",
            "Cost can vary widely by college and city; treat catalogue cost hints as indicative only.",
            "Competition for seats and roles — plan backups and parallel skills early.",
        };

        var actions30 = new List<string>
        {
            $"List the next exam or admission milestone after {fromNode.ShortTitle} and its official website.",
            "Talk to one person already on this path (senior, alumni, or Path Circle peer) about what surprised them.",
            "Block weekly time for the hardest subject or skill on the next step of this route.",
        };

        var actions90 = new List<string>
        {
            "Walk every step on the AgamiPatha planner and note exams, duration, and cost for each stage.",
            "Compare one alternate route on AgamiPatha if your goal or stream changes.",
            "Join Path Circle or download a free AgamiPatha ebook if you want a written planner alongside this report.",
        };

        return new CareerReportAiDto
        {
            Intro = intro,
            Fit = fit,
            Risks = risks,
            Actions30 = actions30,
            Actions90 = actions90,
            UsedAi = false,
        };
    }

    private async Task<string> CallModelAsync(string system, string user, CancellationToken ct)
    {
        var groq = FirstNonEmpty(config["Chat:GroqApiKey"], config["GROQ_API_KEY"], Environment.GetEnvironmentVariable("GROQ_API_KEY"));
        if (!string.IsNullOrWhiteSpace(groq))
        {
            var model = FirstNonEmpty(config["Chat:GroqModel"], "llama-3.1-8b-instant")!;
            return await OpenAiCompatAsync(
                "https://api.groq.com/openai/v1/chat/completions",
                groq,
                model,
                system,
                user,
                ct);
        }

        var gemini = FirstNonEmpty(config["Chat:GeminiApiKey"], config["GEMINI_API_KEY"], Environment.GetEnvironmentVariable("GEMINI_API_KEY"));
        if (!string.IsNullOrWhiteSpace(gemini))
        {
            return await GeminiAsync(gemini, system, user, ct);
        }

        throw new InvalidOperationException("No LLM API key configured.");
    }

    private async Task<string> OpenAiCompatAsync(
        string url,
        string apiKey,
        string model,
        string system,
        string user,
        CancellationToken ct)
    {
        var messages = new object[]
        {
            new { role = "system", content = system },
            new { role = "user", content = Clip(user, 12000) },
        };
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        req.Content = JsonContent(new { model, messages, temperature = 0.35, max_tokens = 900 });
        using var res = await http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"OpenAI-compat {res.StatusCode}: {Clip(raw, 300)}");
        }

        var parsed = JsonSerializer.Deserialize<OpenAiChatResponse>(raw, JsonOpts);
        return parsed?.Choices?.FirstOrDefault()?.Message?.Content ?? "";
    }

    private async Task<string> GeminiAsync(string apiKey, string system, string user, CancellationToken ct)
    {
        var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key="
                  + Uri.EscapeDataString(apiKey);
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Content = JsonContent(new
        {
            system_instruction = new { parts = new[] { new { text = system } } },
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = Clip(user, 12000) } } },
            },
            generationConfig = new { temperature = 0.35, maxOutputTokens = 900 },
        });
        using var res = await http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Gemini {res.StatusCode}: {Clip(raw, 300)}");
        }

        using var doc = JsonDocument.Parse(raw);
        return doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString() ?? "";
    }

    private static CareerReportAiDto? ParseAiJson(string raw)
    {
        var json = ExtractJsonObject(raw);
        if (json is null)
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            return new CareerReportAiDto
            {
                Intro = GetString(root, "intro"),
                Fit = GetString(root, "fit"),
                Risks = GetStringList(root, "risks"),
                Actions30 = GetStringList(root, "actions30"),
                Actions90 = GetStringList(root, "actions90"),
                UsedAi = true,
            };
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? ExtractJsonObject(string raw)
    {
        var trimmed = raw.Trim();
        if (trimmed.StartsWith('{'))
        {
            return trimmed;
        }

        var fence = Regex.Match(trimmed, @"```(?:json)?\s*(\{[\s\S]*?\})\s*```", RegexOptions.IgnoreCase);
        if (fence.Success)
        {
            return fence.Groups[1].Value;
        }

        var start = trimmed.IndexOf('{');
        var end = trimmed.LastIndexOf('}');
        if (start >= 0 && end > start)
        {
            return trimmed[start..(end + 1)];
        }

        return null;
    }

    private static string GetString(JsonElement root, string name) =>
        root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String
            ? el.GetString()?.Trim() ?? ""
            : "";

    private static List<string> GetStringList(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var el) || el.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return el.EnumerateArray()
            .Where(x => x.ValueKind == JsonValueKind.String)
            .Select(x => x.GetString()?.Trim() ?? "")
            .Where(x => x.Length > 0)
            .Take(8)
            .ToList();
    }

    private async Task<(bool Active, DateTime? PeriodEndUtc)> ActiveSubscriptionAsync(
        string buyerId,
        CancellationToken ct)
    {
        var row = await db.BuyerSubscriptions.AsNoTracking()
            .Where(s => s.BuyerId == buyerId && s.Status == "active" && s.PeriodEndUtc > DateTime.UtcNow)
            .OrderByDescending(s => s.PeriodEndUtc)
            .FirstOrDefaultAsync(ct);
        return (row is not null, row?.PeriodEndUtc);
    }

    private static bool Allow(string buyerId)
    {
        var now = DateTime.UtcNow;
        var q = Hits.GetOrAdd(buyerId, _ => new Queue<DateTime>());
        lock (q)
        {
            while (q.Count > 0 && now - q.Peek() > TimeSpan.FromHours(1))
            {
                q.Dequeue();
            }

            if (q.Count >= 5)
            {
                return false;
            }

            q.Enqueue(now);
            return true;
        }
    }

    private bool HasAiKeys()
    {
        var groq = FirstNonEmpty(config["Chat:GroqApiKey"], config["GROQ_API_KEY"], Environment.GetEnvironmentVariable("GROQ_API_KEY"));
        var gemini = FirstNonEmpty(config["Chat:GeminiApiKey"], config["GEMINI_API_KEY"], Environment.GetEnvironmentVariable("GEMINI_API_KEY"));
        return !string.IsNullOrWhiteSpace(groq) || !string.IsNullOrWhiteSpace(gemini);
    }

    private static string NormalizeVoice(string? voice)
    {
        var v = (voice ?? "").Trim().ToLowerInvariant();
        return v switch
        {
            "parent" or "guardian" => "parent",
            "explore" or "explorer" => "explore",
            _ => "student",
        };
    }

    private static string Slug(string id) =>
        Regex.Replace(id.Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');

    private static StringContent JsonContent(object value) =>
        new(JsonSerializer.Serialize(value, JsonOpts), Encoding.UTF8, "application/json");

    private static string Clip(string value, int max) =>
        value.Length <= max ? value : value[..max] + "…";

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));

    private sealed class OpenAiChatResponse
    {
        public List<OpenAiChoice>? Choices { get; set; }
    }

    private sealed class OpenAiChoice
    {
        public OpenAiMessage? Message { get; set; }
    }

    private sealed class OpenAiMessage
    {
        public string? Content { get; set; }
    }
}
