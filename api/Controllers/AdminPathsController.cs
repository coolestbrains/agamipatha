using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/paths")]
public class AdminPathsController(AppDbContext db, ILogger<AdminPathsController> logger) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Save([FromBody] AdminPathSaveDto dto)
    {
        var steps = dto.Steps ?? [];
        if (steps.Count < 2)
        {
            return BadRequest(new { message = "A path needs at least two steps." });
        }

        var ids = steps.Select(s => (s.NodeId ?? "").Trim()).ToList();
        if (ids.Any(string.IsNullOrWhiteSpace))
        {
            return BadRequest(new { message = "Choose a qualification or profession for every step." });
        }

        if (ids.Distinct(StringComparer.OrdinalIgnoreCase).Count() != ids.Count)
        {
            return BadRequest(new { message = "A path cannot repeat the same node." });
        }

        for (var i = 1; i < ids.Count; i++)
        {
            if (string.Equals(ids[i - 1], ids[i], StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Consecutive steps must be different." });
            }
        }

        var existing = await db.Nodes.AsNoTracking()
            .Where(n => ids.Contains(n.Id))
            .ToDictionaryAsync(n => n.Id, StringComparer.OrdinalIgnoreCase);
        var missing = ids.Where(id => !existing.ContainsKey(id)).ToList();
        if (missing.Count > 0)
        {
            return BadRequest(new { message = $"Unknown nodes: {string.Join(", ", missing)}" });
        }

        var upserted = 0;
        var saved = new List<CareerEdgeRecord>();
        for (var i = 1; i < steps.Count; i++)
        {
            var from = ids[i - 1];
            var to = ids[i];
            var via = steps[i].Via?.Trim() ?? "";
            var notes = steps[i].Notes?.Trim() ?? "";
            var rec = await db.Edges.FirstOrDefaultAsync(e => e.FromId == from && e.ToId == to);
            if (rec is null)
            {
                rec = new CareerEdgeRecord
                {
                    FromId = from,
                    ToId = to,
                    Via = via,
                    Notes = notes
                };
                db.Edges.Add(rec);
            }
            else
            {
                rec.Via = via;
                rec.Notes = notes;
            }

            saved.Add(rec);
            upserted++;
        }

        var removed = 0;
        if (dto.RemoveDroppedHops && dto.PreviousNodeIds is { Count: >= 2 })
        {
            var nextPairs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (var i = 1; i < ids.Count; i++)
            {
                nextPairs.Add($"{ids[i - 1]}->{ids[i]}");
            }

            var previous = dto.PreviousNodeIds.Where(id => !string.IsNullOrWhiteSpace(id)).ToList();
            for (var i = 1; i < previous.Count; i++)
            {
                var key = $"{previous[i - 1]}->{previous[i]}";
                if (nextPairs.Contains(key))
                {
                    continue;
                }

                var rec = await db.Edges.FirstOrDefaultAsync(e => e.FromId == previous[i - 1] && e.ToId == previous[i]);
                if (rec is null)
                {
                    continue;
                }

                db.Edges.Remove(rec);
                removed++;
            }
        }

        await db.SaveChangesAsync();
        await ExamPathExpander.ExpandAsync(db, logger);
        var spine = string.Join(" → ", ids.Select(id => existing.GetValueOrDefault(id)?.ShortTitle ?? id));
        return Ok(new AdminPathSaveResultDto
        {
            Upserted = upserted,
            Removed = removed,
            Spine = spine,
            Edges = saved.Select(CareerEdgeDto.FromRecord).ToList()
        });
    }
}
