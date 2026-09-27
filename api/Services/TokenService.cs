using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace AgamiPatha.Api.Services;

public class TokenService(IConfiguration config)
{
    public string CreateToken()
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Admin:JwtKey"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            claims: [new Claim(ClaimTypes.Role, "admin"), new Claim("role", "admin")],
            expires: DateTime.UtcNow.AddYears(10),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string CreateBuyerToken(string buyerId, string name)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Admin:JwtKey"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            claims:
            [
                new Claim(ClaimTypes.NameIdentifier, buyerId),
                new Claim(ClaimTypes.Name, name),
                new Claim(ClaimTypes.Role, "buyer"),
                new Claim("role", "buyer")
            ],
            expires: DateTime.UtcNow.AddYears(10),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
