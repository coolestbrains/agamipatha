using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Data;

public static class ExamPathExpander
{
    private static readonly Regex KnownExam = new(
        """
        \b(
            neet(?:-ug|-pg)?|jee(?:\s*main|\s*advanced)?|gate|cat|clat|cuet|nata|bitsat|nda|
            upsc|ibps|sbi|gpat|nift|nid|uceed|ceed|ailet|lsat|xat|cmat|snap|nmat|icar|
            jam|csir|ugc-?net|ctet|\btet\b|leet|jelet|ini-?cet|afcat|\bcds\b|next|fmge|
            niper|nchm|gmat|gre|\bcet\b|ca\s*foundation|cs\s*executive|cma\s*foundation
        )\b
        """,
        RegexOptions.IgnoreCase | RegexOptions.IgnorePatternWhitespace | RegexOptions.Compiled);

    public static async Task ExpandAsync(AppDbContext db, ILogger logger)
    {
        var nodes = await db.Nodes.ToListAsync();
        var byId = nodes.ToDictionary(n => n.Id, StringComparer.OrdinalIgnoreCase);
        var edges = await db.Edges.ToListAsync();
        var insertedNodes = 0;
        var split = 0;

        foreach (var edge in edges.ToList())
        {
            if (byId.TryGetValue(edge.FromId, out var from) && from.Kind == "entrance-exam")
            {
                continue;
            }

            if (byId.TryGetValue(edge.ToId, out var to) && to.Kind == "entrance-exam")
            {
                continue;
            }

            if (!IsMandatoryEntrance(edge.Via))
            {
                continue;
            }

            var examId = ExamId(edge.Via);
            if (!byId.TryGetValue(examId, out var exam))
            {
                exam = CreateExamNode(examId, edge.Via);
                db.Nodes.Add(exam);
                byId[examId] = exam;
                insertedNodes++;
            }

            if (!edges.Any(e => e.FromId == edge.FromId && e.ToId == examId)
                && !db.Edges.Local.Any(e => e.FromId == edge.FromId && e.ToId == examId))
            {
                db.Edges.Add(new CareerEdgeRecord
                {
                    FromId = edge.FromId,
                    ToId = examId,
                    Via = "Appear for exam",
                    Notes = $"Sit {exam.ShortTitle} before the next qualification or profession."
                });
            }

            if (!edges.Any(e => e.FromId == examId && e.ToId == edge.ToId)
                && !db.Edges.Local.Any(e => e.FromId == examId && e.ToId == edge.ToId))
            {
                db.Edges.Add(new CareerEdgeRecord
                {
                    FromId = examId,
                    ToId = edge.ToId,
                    Via = edge.Via,
                    Notes = string.IsNullOrWhiteSpace(edge.Notes)
                        ? $"{exam.ShortTitle} is mandatory for this step."
                        : edge.Notes
                });
            }

            db.Edges.Remove(edge);
            split++;
        }

        var examCostGovt = "Exam form typically ₹1,000–₹3,500 (national / state papers)";
        var examCostPvt = "Optional private coaching ₹20,000–₹2 lakh / cycle";
        var costRefresh = 0;
        foreach (var exam in byId.Values.Where(n => n.Kind == "entrance-exam"))
        {
            if (string.IsNullOrWhiteSpace(exam.CostGovt))
            {
                exam.CostGovt = examCostGovt;
                exam.CostPvt = examCostPvt;
                costRefresh++;
            }
        }

        if (insertedNodes > 0 || split > 0 || costRefresh > 0)
        {
            await db.SaveChangesAsync();
        }

        logger.LogInformation(
            "Entrance-exam expansion: added {ExamNodes} exam nodes, split {Hops} mandatory hops, and filled costs on {CostNodes} exam nodes.",
            insertedNodes,
            split,
            costRefresh);
    }

    public static bool IsMandatoryEntrance(string? via)
    {
        if (string.IsNullOrWhiteSpace(via))
        {
            return false;
        }

        var lower = via.Trim().ToLowerInvariant();
        if (lower.StartsWith("same ") || lower is "direct" or "apply" or "admission" or "campus")
        {
            return false;
        }

        if (lower.Contains("board") && !lower.Contains("entrance"))
        {
            return false;
        }

        if ((lower.Contains("campus") || lower.Contains("placement")) && !KnownExam.IsMatch(via))
        {
            return false;
        }

        return KnownExam.IsMatch(via) || lower.Contains("entrance");
    }

    public static string ExamId(string via)
    {
        var slug = Regex.Replace(via.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        if (slug.Length > 64)
        {
            slug = slug[..64].Trim('-');
        }

        return "exam-" + slug;
    }

    private static CareerNodeRecord CreateExamNode(string id, string via)
    {
        var title = via.Trim();
        return new CareerNodeRecord
        {
            Id = id,
            Title = title,
            ShortTitle = title.Length > 28 ? title[..28].Trim() : title,
            Kind = "entrance-exam",
            Field = "Entrance exam",
            Duration = "Exam cycle",
            TypicalAge = "—",
            Summary = $"{title} is a mandatory entrance exam for the next qualification or profession on this route.",
            WhatYouStudyJson = "[]",
            ExamsJson = System.Text.Json.JsonSerializer.Serialize(new[] { title }),
            SkillsJson = "[\"Exam strategy\",\"Time management\"]",
            Outlook = "Rank, cutoff, and eligibility decide admission to the next step.",
            CostGovt = "Exam form typically ₹1,000–₹3,500 (national / state papers)",
            CostPvt = "Optional private coaching ₹20,000–₹2 lakh / cycle",
            CreatedAtUtc = null
        };
    }
}
