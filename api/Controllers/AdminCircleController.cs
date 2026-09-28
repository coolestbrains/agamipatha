using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AgamiPatha.Api.Services;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/circle")]
public class AdminCircleController(CircleService circle) : ControllerBase
{
    [HttpGet("stats")]
    public async Task<IActionResult> Stats(CancellationToken ct) => Ok(await circle.AdminStatsAsync(ct));
}
