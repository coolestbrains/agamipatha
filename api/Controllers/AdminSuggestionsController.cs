using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/suggestions")]
public class AdminSuggestionsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CatalogSuggestionDto>>> List(CancellationToken ct)
    {
        var rows = await db.CatalogSuggestions.AsNoTracking()
            .OrderByDescending(s => s.CreatedAtUtc)
            .ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var row = await db.CatalogSuggestions.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (row is null)
        {
            return NotFound();
        }

        db.CatalogSuggestions.Remove(row);
        await db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }

    private static CatalogSuggestionDto ToDto(CatalogSuggestionRecord row) => new()
    {
        Id = row.Id,
        Slot = row.Slot,
        Kind = row.Kind,
        Title = row.Title,
        Notes = row.Notes,
        FromId = row.FromId,
        FromTitle = row.FromTitle,
        CreatedAtUtc = row.CreatedAtUtc
    };
}
