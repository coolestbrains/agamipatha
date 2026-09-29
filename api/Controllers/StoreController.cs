using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AgamiPatha.Api.Models;
using AgamiPatha.Api.Services;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Route("api/store")]
public class StoreController(StoreService store) : ControllerBase
{
    [HttpGet("products")]
    public ActionResult<StoreCatalogDto> Products() => store.Catalog();

    [HttpPost("orders")]
    public async Task<IActionResult> CreateOrder([FromBody] StoreOrderRequestDto? body, CancellationToken ct)
    {
        var buyerId = User.IsInRole("buyer") ? User.FindFirstValue(ClaimTypes.NameIdentifier) : null;
        var (status, payload) = await store.CreateOrderAsync(body ?? new StoreOrderRequestDto(), buyerId, ct);
        return StatusCode(status, payload);
    }

    [HttpPost("verify")]
    public async Task<IActionResult> Verify([FromBody] StoreVerifyRequestDto? body, CancellationToken ct)
    {
        var (status, payload) = await store.VerifyAsync(body ?? new StoreVerifyRequestDto(), ct);
        return StatusCode(status, payload);
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] StoreRegisterRequestDto? body, CancellationToken ct)
    {
        var (status, payload) = await store.RegisterAsync(body ?? new StoreRegisterRequestDto(), ct);
        return StatusCode(status, payload);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] StoreLoginRequestDto? body, CancellationToken ct)
    {
        var (status, payload) = await store.LoginAsync(body ?? new StoreLoginRequestDto(), ct);
        return StatusCode(status, payload);
    }

    [Authorize(Roles = "buyer")]
    [HttpGet("purchases")]
    public async Task<ActionResult<List<StorePurchaseDto>>> Purchases(CancellationToken ct)
    {
        var buyerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(buyerId))
        {
            return Unauthorized();
        }

        return await store.PurchasesForBuyerAsync(buyerId, ct);
    }

    [Authorize(Roles = "buyer")]
    [HttpGet("my-orders")]
    public async Task<ActionResult<List<StoreBuyerOrderDto>>> MyOrders(CancellationToken ct)
    {
        var buyerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(buyerId))
        {
            return Unauthorized();
        }

        return await store.OrdersForBuyerAsync(buyerId, ct);
    }

    [Authorize(Roles = "buyer")]
    [HttpPost("claim")]
    public async Task<IActionResult> Claim([FromBody] StoreClaimRequestDto? body, CancellationToken ct)
    {
        var buyerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(buyerId))
        {
            return Unauthorized();
        }

        var (status, payload) = await store.ClaimFreeAsync(buyerId, body ?? new StoreClaimRequestDto(), ct);
        return StatusCode(status, payload);
    }

    [Authorize(Roles = "buyer")]
    [HttpGet("subscription")]
    public async Task<IActionResult> Subscription(CancellationToken ct)
    {
        var buyerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(buyerId))
        {
            return Unauthorized();
        }

        return Ok(await store.GetSubscriptionAsync(buyerId, ct));
    }

    [Authorize(Roles = "buyer")]
    [HttpPost("subscription/order")]
    public async Task<IActionResult> SubscriptionOrder(CancellationToken ct)
    {
        var buyerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(buyerId))
        {
            return Unauthorized();
        }

        var (status, payload) = await store.CreateSubscriptionOrderAsync(buyerId, ct);
        return StatusCode(status, payload);
    }

    [Authorize(Roles = "buyer")]
    [HttpPost("subscription/verify")]
    public async Task<IActionResult> SubscriptionVerify([FromBody] StoreVerifyRequestDto? body, CancellationToken ct)
    {
        var buyerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(buyerId))
        {
            return Unauthorized();
        }

        var (status, payload) = await store.VerifySubscriptionAsync(buyerId, body ?? new StoreVerifyRequestDto(), ct);
        return StatusCode(status, payload);
    }

    [HttpGet("download/{token}")]
    public async Task<IActionResult> Download(string token, CancellationToken ct)
    {
        var (status, message, path, fileName) = await store.ResolveDownloadAsync(token, ct);
        if (path is null || fileName is null)
        {
            return StatusCode(status, new { message });
        }

        var ext = Path.GetExtension(fileName);
        var contentType = ext.Equals(".pdf", StringComparison.OrdinalIgnoreCase)
            ? "application/pdf"
            : "application/octet-stream";
        return PhysicalFile(path, contentType, fileName);
    }

    [HttpGet("covers/{productId}")]
    public IActionResult Cover(string productId)
    {
        var (status, message, path, fileName) = store.ResolveCoverFile(productId);
        if (path is null || fileName is null)
        {
            return StatusCode(status, new { message });
        }

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var contentType = ext switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
        return PhysicalFile(path, contentType);
    }
}
