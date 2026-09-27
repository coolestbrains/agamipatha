using Microsoft.AspNetCore.Mvc;
using AgamiPatha.Api.Services;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Route("api")]
public class CatalogController(PathService paths, StatsService stats) : ControllerBase
{
    [HttpGet("catalog")]
    public async Task<IActionResult> Catalog() => Ok(await paths.GetCatalogAsync());

    [HttpGet("paths")]
    public async Task<IActionResult> Path([FromQuery] string from, [FromQuery] string to)
    {
        if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to))
        {
            return BadRequest(new { message = "from and to are required." });
        }

        var result = await paths.FindRoutesAsync(from, to);
        await stats.RecordSearchAsync();
        await stats.RecordInterestAsync(to, kind: "goal");
        if (result is null || result.Routes.Count == 0)
        {
            return NotFound(new { message = "No mapped route connects those two points." });
        }

        return Ok(result);
    }

    [HttpGet("options")]
    public async Task<IActionResult> Options([FromQuery] string from)
    {
        if (string.IsNullOrWhiteSpace(from))
        {
            return BadRequest(new { message = "from is required." });
        }

        var result = await paths.OptionsAsync(from);
        if (result.From is null)
        {
            return NotFound(new { message = "Unknown qualification." });
        }

        return Ok(result);
    }
}
