using Microsoft.AspNetCore.Mvc;
using AgamiPatha.Api.Models;
using AgamiPatha.Api.Services;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Route("api/chat")]
public class ChatController(ChatService chat) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Ask([FromBody] ChatRequestDto? body, CancellationToken ct)
    {
        var key = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "anon";
        var (ok, reply, status) = await chat.AskAsync(body ?? new ChatRequestDto(), key, ct);
        if (!ok)
        {
            return StatusCode(status, new { message = reply });
        }

        return Ok(new ChatReplyDto { Reply = reply });
    }
}
