using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Services;

public class ChatService(
    HttpClient http,
    AppDbContext db,
    IConfiguration config,
    ILogger<ChatService> logger)
{
    private static readonly ConcurrentDictionary<string, Queue<DateTime>> Hits = new();
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public async Task<(bool Ok, string Reply, int Status)> AskAsync(
        ChatRequestDto body,
        string clientKey,
        CancellationToken ct)
    {
        var message = (body.Message ?? "").Trim();
        if (message.Length is 0)
        {
            return (false, "Ask a question first.", 400);
        }

        if (message.Length > 2000)
        {
            return (false, "Keep the question under 2,000 characters.", 400);
        }

        if (!Allow(clientKey))
        {
            return (false, "Too many questions in a short time. Wait a minute and try again.", 429);
        }

        var facts = await BuildFactsAsync(message, body.NodeId, body.FromId, body.ToId, ct);
        var system = """
            You are AgamiPatha, a self-serve career guide for students and professionals in India.
            Answer any question the user asks. Be concise (a few short paragraphs or bullets).
            For Indian education and careers, prefer the catalogue facts when they are relevant.
            Do not invent official cut-offs, fees, ranks, or exam dates. Say when something needs checking on the official site.
            When a path would help, mention they can plan it themselves on AgamiPatha: starting qualification → goal.
            If the question is not about careers, still answer helpfully.
            """;
        if (!string.IsNullOrWhiteSpace(facts))
        {
            system += "\n\nCatalogue facts you may use:\n" + facts;
        }

        var history = (body.History ?? [])
            .Where(t => t.Role is "user" or "assistant")
            .Select(t => new ChatTurnDto
            {
                Role = t.Role,
                Content = (t.Content ?? "").Trim()
            })
            .Where(t => t.Content.Length > 0)
            .TakeLast(8)
            .ToList();

        try
        {
            var reply = await CallModelAsync(system, history, message, ct);
            if (!string.IsNullOrWhiteSpace(reply))
            {
                return (true, Combine(reply.Trim(), facts), 200);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Chat model call failed");
        }

        try
        {
            var ddg = await DuckDuckGoAsync(message, ct);
            if (!string.IsNullOrWhiteSpace(ddg))
            {
                return (true, Combine(ddg, facts), 200);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "DuckDuckGo fallback failed");
        }

        var fallback = LocalFallback(message, facts);
        return (true, fallback, 200);
    }

    private async Task<string> CallModelAsync(
        string system,
        List<ChatTurnDto> history,
        string message,
        CancellationToken ct)
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
                history,
                message,
                ct);
        }

        var gemini = FirstNonEmpty(config["Chat:GeminiApiKey"], config["GEMINI_API_KEY"], Environment.GetEnvironmentVariable("GEMINI_API_KEY"));
        if (!string.IsNullOrWhiteSpace(gemini))
        {
            return await GeminiAsync(gemini, system, history, message, ct);
        }

        return await PollinationsAsync(system, history, message, ct);
    }

    private async Task<string> OpenAiCompatAsync(
        string url,
        string apiKey,
        string model,
        string system,
        List<ChatTurnDto> history,
        string message,
        CancellationToken ct)
    {
        var messages = new List<object> { new { role = "system", content = system } };
        foreach (var turn in history)
        {
            messages.Add(new { role = turn.Role, content = Clip(turn.Content, 1500) });
        }

        messages.Add(new { role = "user", content = message });
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        req.Content = JsonContent(new { model, messages, temperature = 0.4, max_tokens = 700 });
        using var res = await http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"OpenAI-compat {res.StatusCode}: {Clip(raw, 300)}");
        }

        var parsed = JsonSerializer.Deserialize<OpenAiChatResponse>(raw, JsonOpts);
        return parsed?.Choices?.FirstOrDefault()?.Message?.Content ?? "";
    }

    private async Task<string> GeminiAsync(
        string apiKey,
        string system,
        List<ChatTurnDto> history,
        string message,
        CancellationToken ct)
    {
        var contents = new List<object>();
        foreach (var turn in history)
        {
            contents.Add(new
            {
                role = turn.Role == "assistant" ? "model" : "user",
                parts = new[] { new { text = Clip(turn.Content, 1500) } }
            });
        }

        contents.Add(new { role = "user", parts = new[] { new { text = message } } });
        var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + Uri.EscapeDataString(apiKey);
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Content = JsonContent(new
        {
            system_instruction = new { parts = new[] { new { text = system } } },
            contents,
            generationConfig = new { temperature = 0.4, maxOutputTokens = 700 }
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

    private async Task<string> PollinationsAsync(
        string system,
        List<ChatTurnDto> history,
        string message,
        CancellationToken ct)
    {
        var getUrl = "https://text.pollinations.ai/" + Uri.EscapeDataString(Clip(message, 400));
        using var get = new HttpRequestMessage(HttpMethod.Get, getUrl);
        get.Headers.Authorization = null;
        using var getRes = await http.SendAsync(get, ct);
        var body = await getRes.Content.ReadAsStringAsync(ct);
        if (getRes.IsSuccessStatusCode && LooksLikeAnswer(body))
        {
            return body.Trim();
        }

        throw new HttpRequestException($"Pollinations {getRes.StatusCode}: {Clip(body, 240)}");
    }

    private async Task<string> DuckDuckGoAsync(string message, CancellationToken ct)
    {
        var url = "https://api.duckduckgo.com/?q=" + Uri.EscapeDataString(message) + "&format=json&no_html=1&skip_disambig=1";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        using var res = await http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        var answer = root.TryGetProperty("Answer", out var a) ? a.GetString() : null;
        if (!string.IsNullOrWhiteSpace(answer))
        {
            return answer;
        }

        var abs = root.TryGetProperty("AbstractText", out var t) ? t.GetString() : null;
        if (!string.IsNullOrWhiteSpace(abs))
        {
            var source = root.TryGetProperty("AbstractSource", out var s) ? s.GetString() : null;
            return string.IsNullOrWhiteSpace(source) ? abs : abs + "\n\nSource: " + source;
        }

        if (root.TryGetProperty("RelatedTopics", out var related) && related.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in related.EnumerateArray())
            {
                if (item.TryGetProperty("Text", out var text))
                {
                    var line = text.GetString();
                    if (!string.IsNullOrWhiteSpace(line))
                    {
                        return line;
                    }
                }
            }
        }

        return "";
    }

    private static bool LooksLikeAnswer(string body) =>
        !string.IsNullOrWhiteSpace(body)
        && !body.TrimStart().StartsWith('<')
        && !body.Contains("\"error\"", StringComparison.Ordinal)
        && !body.Contains("Payment Required", StringComparison.Ordinal);

    private async Task<string> BuildFactsAsync(
        string question,
        string? nodeId,
        string? fromId,
        string? toId,
        CancellationToken ct)
    {
        var wanted = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var id in new[] { nodeId, fromId, toId })
        {
            if (!string.IsNullOrWhiteSpace(id))
            {
                wanted.Add(id.Trim());
            }
        }

        var stop = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "about", "after", "being", "become", "becoming", "from", "have", "help", "india",
            "indian", "into", "just", "like", "more", "please", "some", "tell", "than",
            "that", "them", "then", "there", "this", "want", "what", "when", "where",
            "which", "will", "with", "your", "does", "make", "take", "also", "only",
            "plus", "minus", "very", "much"
        };
        var words = question
            .Split([' ', ',', '.', '?', '!', '/', '-', ':', ';', '(', ')'], StringSplitOptions.RemoveEmptyEntries)
            .Select(w => w.Trim())
            .Where(w => w.Length >= 4 && !stop.Contains(w))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(8)
            .ToList();

        var all = await db.Nodes.AsNoTracking().ToListAsync(ct);
        var matches = all
            .Select(n =>
            {
                var hay = $"{n.Title} {n.ShortTitle} {n.Field}";
                var hits = words.Count(w => hay.Contains(w, StringComparison.OrdinalIgnoreCase));
                var titleHits = words.Count(w => n.Title.Contains(w, StringComparison.OrdinalIgnoreCase));
                var score = (wanted.Contains(n.Id) ? 100 : 0) + titleHits * 5 + hits;
                return (n, score, titleHits);
            })
            .Where(x => x.score > 0 && (wanted.Count > 0 || x.titleHits > 0))
            .OrderByDescending(x => x.score)
            .Take(6)
            .Select(x => x.n)
            .ToList();

        if (matches.Count == 0)
        {
            return "";
        }

        var sb = new StringBuilder();
        foreach (var n in matches.Take(8))
        {
            sb.Append("- ").Append(n.Title).Append(" (").Append(n.Kind).Append(", ").Append(n.Field).Append("): ");
            sb.Append(Clip(n.Summary, 220));
            if (!string.IsNullOrWhiteSpace(n.Duration))
            {
                sb.Append(" Duration: ").Append(n.Duration).Append('.');
            }

            if (!string.IsNullOrWhiteSpace(n.SalaryHint))
            {
                sb.Append(" Pay hint: ").Append(n.SalaryHint).Append('.');
            }

            sb.Append('\n');
        }

        return sb.ToString();
    }

    private static string Combine(string reply, string facts)
    {
        if (string.IsNullOrWhiteSpace(facts))
        {
            return reply;
        }

        if (reply.Contains("catalogue", StringComparison.OrdinalIgnoreCase)
            || reply.Contains("AgamiPatha", StringComparison.OrdinalIgnoreCase))
        {
            return reply;
        }

        return reply + "\n\nFrom the AgamiPatha catalogue:\n" + facts;
    }

    private static string LocalFallback(string question, string facts)
    {
        if (!string.IsNullOrWhiteSpace(facts))
        {
            return "The live assistant is busy, but here is what AgamiPatha has on related qualifications and jobs:\n\n"
                + facts
                + "\nUse Plan a path on the home page to see the steps between where you are and a goal. Try the chat again in a moment.";
        }

        return "I could not reach the free assistant just now. Ask about a qualification or profession in AgamiPatha, or try again shortly. You can also pick a start and a goal on the home page to see a mapped route.";
    }

    private static bool Allow(string key)
    {
        var now = DateTime.UtcNow;
        var q = Hits.GetOrAdd(key, _ => new Queue<DateTime>());
        lock (q)
        {
            while (q.Count > 0 && now - q.Peek() > TimeSpan.FromMinutes(10))
            {
                q.Dequeue();
            }

            if (q.Count >= 30)
            {
                return false;
            }

            q.Enqueue(now);
            return true;
        }
    }

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
