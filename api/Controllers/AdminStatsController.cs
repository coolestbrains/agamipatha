using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AgamiPatha.Api.Services;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/stats")]
public class AdminStatsController(StatsService stats) : ControllerBase
{
    [HttpGet("series")]
    public async Task<IActionResult> Series([FromQuery] string metric)
    {
        var result = await stats.SeriesAsync(metric);
        if (result is null)
        {
            return BadRequest(new { message = "Unknown metric." });
        }

        return Ok(result);
    }
}
