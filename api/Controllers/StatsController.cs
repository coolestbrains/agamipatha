using Microsoft.AspNetCore.Mvc;
using AgamiPatha.Api.Models;
using AgamiPatha.Api.Services;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Route("api/stats")]
public class StatsController(StatsService stats) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await stats.SnapshotAsync());

    [HttpPost("visit")]
    public async Task<IActionResult> Visit([FromBody] GuestVisitRequest? body)
    {
        await stats.RecordGuestVisitAsync(
            body?.VisitorKey,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString());
        return Ok(await stats.SnapshotAsync());
    }

    [HttpGet("trending")]
    public async Task<IActionResult> Trending() => Ok(await stats.TrendingAsync(10));

    [HttpGet("destinations")]
    public async Task<IActionResult> Destinations([FromQuery] string from)
    {
        if (string.IsNullOrWhiteSpace(from))
        {
            return BadRequest(new { message = "from is required." });
        }

        return Ok(await stats.PopularDestinationsAsync(from, 12));
    }

    [HttpPost("interest")]
    public async Task<IActionResult> Interest([FromBody] NodeInterestRequest? body)
    {
        await stats.RecordInterestAsync(body?.NodeId, body?.FromId, body?.ToId, body?.Via, body?.Kind);
        return Ok();
    }
}
