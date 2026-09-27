using Microsoft.AspNetCore.Mvc;
using AgamiPatha.Api.Models;
using AgamiPatha.Api.Services;

namespace AgamiPatha.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(TokenService tokens, StoreBuyerService buyers) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var login = string.IsNullOrWhiteSpace(request.Login) ? buyers.AdminEmail() : request.Login;
        var (status, message, buyer) = await buyers.LoginAsync(
            new StoreLoginRequestDto { Login = login, Password = request.Password ?? "" },
            ct);
        if (buyer is null)
        {
            return StatusCode(status == 200 ? 401 : status, new { message = message ?? "Wrong email or password." });
        }

        if (!buyers.IsAdminBuyer(buyer))
        {
            return Unauthorized(new { message = "That account is not an admin." });
        }

        return Ok(new LoginResponse
        {
            Token = tokens.CreateToken(),
            BuyerToken = tokens.CreateBuyerToken(buyer.Id, buyer.Name),
            BuyerName = buyer.Name
        });
    }
}
