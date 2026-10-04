using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Route("api/suggestions")]
public class SuggestionsController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CatalogSuggestionRequestDto? body, CancellationToken ct)
    {
        var title = (body?.Title ?? "").Trim();
        if (title.Length is < 2 or > 160)
        {
            return BadRequest(new { message = "Enter a name between 2 and 160 characters." });
        }

        var slot = (body?.Slot ?? "").Trim().ToLowerInvariant();
        if (slot is not ("start" or "goal" or "path"))
        {
            slot = "goal";
        }

        var kind = (body?.Kind ?? "").Trim().ToLowerInvariant();
        if (kind is not ("qualification" or "profession"))
        {
            kind = slot == "start" ? "qualification" : "profession";
        }

        var notes = (body?.Notes ?? "").Trim();
        if (notes.Length > 500)
        {
            notes = notes[..500];
        }

        db.CatalogSuggestions.Add(new CatalogSuggestionRecord
        {
            Slot = slot,
            Kind = kind,
            Title = title,
            Notes = notes,
            FromId = (body?.FromId ?? "").Trim(),
            FromTitle = (body?.FromTitle ?? "").Trim(),
            CreatedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync(ct);
        return Ok(new { ok = true });
    }
}
