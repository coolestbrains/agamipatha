using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/nodes")]
public class AdminNodesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var nodes = await db.Nodes.AsNoTracking().OrderBy(n => n.Kind).ThenBy(n => n.Title).ToListAsync();
        return Ok(nodes.Select(CareerNodeDto.From));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id)
    {
        var rec = await db.Nodes.FindAsync(id);
        return rec is null ? NotFound() : Ok(CareerNodeDto.From(rec));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CareerNodeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Id) || string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest(new { message = "Id and title are required." });
        }

        if (await db.Nodes.AnyAsync(n => n.Id == dto.Id))
        {
            return Conflict(new { message = "A node with this id already exists." });
        }

        db.Nodes.Add(dto.ToRecord(stampCreate: true));
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] CareerNodeDto dto)
    {
        var rec = await db.Nodes.FindAsync(id);
        if (rec is null)
        {
            return NotFound();
        }

        rec.Title = dto.Title.Trim();
        rec.ShortTitle = string.IsNullOrWhiteSpace(dto.ShortTitle) ? dto.Title : dto.ShortTitle.Trim();
        rec.Kind = dto.Kind.Trim();
        rec.Field = dto.Field.Trim();
        rec.Duration = dto.Duration.Trim();
        rec.TypicalAge = dto.TypicalAge.Trim();
        rec.Summary = dto.Summary.Trim();
        rec.WhatYouStudyJson = System.Text.Json.JsonSerializer.Serialize(dto.WhatYouStudy ?? []);
        rec.ExamsJson = System.Text.Json.JsonSerializer.Serialize(dto.Exams ?? []);
        rec.SkillsJson = System.Text.Json.JsonSerializer.Serialize(dto.Skills ?? []);
        rec.Outlook = dto.Outlook.Trim();
        rec.SalaryHint = dto.SalaryHint;
        rec.CostGovt = dto.CostGovt;
        rec.CostPvt = dto.CostPvt;
        rec.WorkplacesJson = dto.Workplaces is null ? null : System.Text.Json.JsonSerializer.Serialize(dto.Workplaces);
        rec.InstitutesJson = dto.Institutes is { Count: > 0 } ? System.Text.Json.JsonSerializer.Serialize(dto.Institutes) : null;
        rec.CertificationsJson = dto.Certifications is { Count: > 0 } ? System.Text.Json.JsonSerializer.Serialize(dto.Certifications) : null;
        rec.ExperienceYearsMin = dto.ExperienceYearsMin;
        rec.ExperienceYearsTypical = dto.ExperienceYearsTypical;
        rec.EntryLevel = string.IsNullOrWhiteSpace(dto.EntryLevel) ? null : dto.EntryLevel.Trim();
        rec.FeederRolesJson = dto.FeederRoles is { Count: > 0 } ? System.Text.Json.JsonSerializer.Serialize(dto.FeederRoles) : null;
        await db.SaveChangesAsync();
        return Ok(CareerNodeDto.From(rec));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var rec = await db.Nodes.FindAsync(id);
        if (rec is null)
        {
            return NotFound();
        }

        var edges = db.Edges.Where(e => e.FromId == id || e.ToId == id);
        db.Edges.RemoveRange(edges);
        db.Nodes.Remove(rec);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
