using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AgamiPatha.Api.Models;
using AgamiPatha.Api.Services;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Authorize(Roles = "buyer")]
[Route("api/report")]
public class CareerReportController(CareerReportService reports) : ControllerBase
{
    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        var status = await reports.StatusAsync(buyerId, ct);
        return Ok(status);
    }

    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] CareerReportRequestDto? body, CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        var (status, message, report) = await reports.GenerateAsync(buyerId, body ?? new CareerReportRequestDto(), ct);
        if (report is not null)
        {
            return Ok(report);
        }

        return StatusCode(status, new { message });
    }

    private string? BuyerId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return string.IsNullOrWhiteSpace(id) ? null : id;
    }
}
