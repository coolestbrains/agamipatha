using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/edges")]
public class AdminEdgesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var edges = await db.Edges.AsNoTracking().OrderBy(e => e.FromId).ThenBy(e => e.ToId).ToListAsync();
        return Ok(edges.Select(CareerEdgeDto.FromRecord));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CareerEdgeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.From) || string.IsNullOrWhiteSpace(dto.To))
        {
            return BadRequest(new { message = "From and to are required." });
        }

        if (!await db.Nodes.AnyAsync(n => n.Id == dto.From) || !await db.Nodes.AnyAsync(n => n.Id == dto.To))
        {
            return BadRequest(new { message = "Both endpoints must be existing nodes." });
        }

        if (await db.Edges.AnyAsync(e => e.FromId == dto.From && e.ToId == dto.To))
        {
            return Conflict(new { message = "That connection already exists." });
        }

        var rec = new CareerEdgeRecord
        {
            FromId = dto.From,
            ToId = dto.To,
            Via = dto.Via ?? "",
            Notes = dto.Notes ?? ""
        };
        db.Edges.Add(rec);
        await db.SaveChangesAsync();
        return Ok(CareerEdgeDto.FromRecord(rec));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CareerEdgeDto dto)
    {
        var rec = await db.Edges.FindAsync(id);
        if (rec is null)
        {
            return NotFound();
        }

        rec.FromId = dto.From;
        rec.ToId = dto.To;
        rec.Via = dto.Via ?? "";
        rec.Notes = dto.Notes ?? "";
        await db.SaveChangesAsync();
        return Ok(CareerEdgeDto.FromRecord(rec));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var rec = await db.Edges.FindAsync(id);
        if (rec is null)
        {
            return NotFound();
        }

        db.Edges.Remove(rec);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
