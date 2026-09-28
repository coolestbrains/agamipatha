using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AgamiPatha.Api.Models;
using AgamiPatha.Api.Services;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Authorize(Roles = "buyer")]
[Route("api/circle")]
public class CircleController(CircleService circle) : ControllerBase
{
    [HttpGet("profile/me")]
    public async Task<IActionResult> MyProfile(CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        var (status, message, profile) = await circle.GetMyProfileAsync(buyerId, ct);
        return status == 200 ? Ok(profile) : StatusCode(status, new { message });
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpsertProfile([FromBody] PathProfileUpsertDto? body, CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        var (status, message, profile) = await circle.UpsertProfileAsync(buyerId, body ?? new PathProfileUpsertDto(), ct);
        return status == 200 ? Ok(profile) : StatusCode(status, new { message });
    }

    [HttpGet("peers")]
    public async Task<IActionResult> Peers([FromQuery] string? goalId, [FromQuery] string? standingId, CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        var (status, payload) = await circle.ListPeersAsync(buyerId, goalId, standingId, ct);
        return StatusCode(status, payload);
    }

    [HttpGet("requests")]
    public async Task<ActionResult<List<PathConnectRequestDto>>> Requests(CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        return await circle.ListRequestsAsync(buyerId, ct);
    }

    [HttpPost("requests")]
    public async Task<IActionResult> CreateRequest([FromBody] PathConnectRequestCreateDto? body, CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        var (status, message, request) = await circle.CreateRequestAsync(buyerId, body ?? new PathConnectRequestCreateDto(), ct);
        return status == 200 ? Ok(request) : StatusCode(status, new { message });
    }

    [HttpPost("requests/{id:int}/accept")]
    public async Task<IActionResult> Accept(int id, CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        var (status, message, request) = await circle.ResolveRequestAsync(buyerId, id, "accept", ct);
        return status == 200 ? Ok(request) : StatusCode(status, new { message });
    }

    [HttpPost("requests/{id:int}/decline")]
    public async Task<IActionResult> Decline(int id, CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        var (status, message, request) = await circle.ResolveRequestAsync(buyerId, id, "decline", ct);
        return status == 200 ? Ok(request) : StatusCode(status, new { message });
    }

    [HttpGet("connections")]
    public async Task<ActionResult<List<PathConnectionDto>>> Connections(CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        return await circle.ListConnectionsAsync(buyerId, ct);
    }

    [HttpPost("block")]
    public async Task<IActionResult> Block([FromBody] PathReportDto? body, CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        var (status, message) = await circle.BlockAsync(buyerId, body?.TargetBuyerId ?? "", ct);
        return status == 200 ? Ok(new { ok = true }) : StatusCode(status, new { message });
    }

    [HttpPost("report")]
    public async Task<IActionResult> Report([FromBody] PathReportDto? body, CancellationToken ct)
    {
        var buyerId = BuyerId();
        if (buyerId is null)
        {
            return Unauthorized();
        }

        var (status, message) = await circle.ReportAsync(buyerId, body ?? new PathReportDto(), ct);
        return status == 200 ? Ok(new { ok = true }) : StatusCode(status, new { message });
    }

    [AllowAnonymous]
    [HttpGet("invite/{code}")]
    public async Task<IActionResult> Invite(string code, CancellationToken ct)
    {
        var profile = await circle.FindByInviteAsync(code, ct);
        return profile is null ? NotFound(new { message = "Invite not found." }) : Ok(profile);
    }

    private string? BuyerId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return string.IsNullOrWhiteSpace(id) ? null : id;
    }
}
