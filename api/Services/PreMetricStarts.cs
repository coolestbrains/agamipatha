using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Services;

/// <summary>
/// Nursery–Class 9 are standing only. Mapped routes always start at Class 10 (Metric).
/// </summary>
internal static class PreMetricStarts
{
    public const string MetricId = "metric";

    private static readonly HashSet<string> Ids = new(StringComparer.OrdinalIgnoreCase)
    {
        "nursery", "lkg", "ukg",
        "class-1", "class-2", "class-3", "class-4", "class-5",
        "class-6", "class-7", "class-8", "class-9",
    };

    public static string GraphFromId(string? fromId, IReadOnlyDictionary<string, CareerNodeRecord>? nodes = null)
    {
        var id = (fromId ?? "").Trim();
        if (id.Length == 0)
        {
            return id;
        }
        if (Ids.Contains(id))
        {
            return MetricId;
        }
        if (nodes is not null
            && nodes.TryGetValue(id, out var node)
            && string.Equals(node.Kind, "school", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(id, MetricId, StringComparison.OrdinalIgnoreCase))
        {
            return MetricId;
        }
        return id;
    }
}
