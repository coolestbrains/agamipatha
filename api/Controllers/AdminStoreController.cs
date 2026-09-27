using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AgamiPatha.Api.Models;
using AgamiPatha.Api.Services;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/store")]
public class AdminStoreController(StoreService store, StoreBuyerService buyers) : ControllerBase
{
    [HttpGet("sales")]
    public async Task<IActionResult> Sales(CancellationToken ct) => Ok(await store.SalesAsync(ct));

    [HttpPut("buyers/{id}")]
    public async Task<IActionResult> UpdateBuyer(string id, [FromBody] AdminStoreBuyerUpdateDto? body, CancellationToken ct)
    {
        var (status, message, _) = await buyers.UpdateAsync(id, body ?? new AdminStoreBuyerUpdateDto(), ct);
        return status == 200 ? Ok(await store.SalesAsync(ct)) : StatusCode(status, new { message });
    }

    [HttpPost("buyers/{id}/password")]
    public async Task<IActionResult> SetPassword(string id, [FromBody] AdminStoreBuyerPasswordDto? body, CancellationToken ct)
    {
        var (status, message) = await buyers.SetPasswordAsync(id, body?.Password ?? "", ct);
        return status == 200 ? Ok(new { ok = true }) : StatusCode(status, new { message });
    }

    [HttpDelete("buyers/{id}")]
    public async Task<IActionResult> DeleteBuyer(string id, CancellationToken ct)
    {
        var (status, message) = await buyers.DeleteAsync(id, ct);
        return status == 200 ? Ok(await store.SalesAsync(ct)) : StatusCode(status, new { message });
    }

    [HttpGet("ebooks")]
    public IActionResult Ebooks() => Ok(store.EbookCovers());

    [HttpPost("ebooks/{productId}/cover")]
    [RequestSizeLimit(3 * 1024 * 1024)]
    public async Task<IActionResult> UploadCover(string productId, IFormFile? file, CancellationToken ct)
    {
        var (status, payload) = await store.UploadCoverAsync(productId, file, ct);
        return StatusCode(status, payload);
    }

    [HttpDelete("orders/{id}")]
    public async Task<IActionResult> DeleteOrder(string id, CancellationToken ct)
    {
        var (status, message) = await store.DeleteOrderAsync(id, ct);
        return status == 200 ? Ok(await store.SalesAsync(ct)) : StatusCode(status, new { message });
    }

    [HttpDelete("sales")]
    public async Task<IActionResult> Clear(CancellationToken ct)
    {
        var removed = await store.ClearOrdersAsync(ct);
        return Ok(new { removed });
    }
}
