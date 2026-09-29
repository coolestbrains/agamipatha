using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Services;

public class StoreBuyerService(AppDbContext db, IConfiguration config)
{
    private static readonly Regex EmailPattern = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);
    private static readonly Regex NamePattern = new(@"^[\p{L}][\p{L}\s.'’\-]*$", RegexOptions.Compiled);
    private static readonly Regex MobilePattern = new(@"^[6-9]\d{9}$", RegexOptions.Compiled);
    public const string DefaultAdminEmail = "admin@agamipatha.com";
    public const string DefaultAdminLogin = "admin";
    private const string FirstAdminPassword = "agamipatha-admin";

    public async Task<(int Status, string? Message, StoreBuyerRecord? Buyer)> ResolveForCheckoutAsync(
        StoreOrderRequestDto body,
        string? sessionBuyerId,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(sessionBuyerId))
        {
            var session = await db.StoreBuyers.FirstOrDefaultAsync(b => b.Id == sessionBuyerId, ct);
            if (session is not null)
            {
                return (200, null, session);
            }
        }

        var nameError = ValidateName(body.Name, required: true);
        if (nameError is not null)
        {
            return (400, nameError, null);
        }

        var (email, emailError) = NormalizeEmail(body.Email);
        if (emailError is not null)
        {
            return (400, emailError, null);
        }

        var (mobile, mobileError) = NormalizeMobile(body.Mobile);
        if (mobileError is not null)
        {
            return (400, mobileError, null);
        }

        if (mobile is null)
        {
            return (400, "Enter a 10-digit Indian mobile number.", null);
        }

        var passwordError = ValidatePassword(body.Password);
        if (passwordError is not null)
        {
            return (400, passwordError, null);
        }

        var byEmail = email is null
            ? null
            : await db.StoreBuyers.FirstOrDefaultAsync(b => b.Email == email, ct);
        var byMobile = mobile is null
            ? null
            : await db.StoreBuyers.FirstOrDefaultAsync(b => b.Mobile == mobile, ct);

        if (byEmail is not null && byMobile is not null && byEmail.Id != byMobile.Id)
        {
            return (400, "This email and mobile belong to different accounts. Use one of them, or log in first.", null);
        }

        var existing = byEmail ?? byMobile;
        if (existing is not null)
        {
            if (!VerifyPassword(body.Password ?? "", existing.PasswordHash))
            {
                return (400, "This email or mobile is already registered. Enter the same password, or log in first.", null);
            }

            var name = (body.Name ?? "").Trim();
            if (name.Length > 0)
            {
                existing.Name = name;
            }

            existing.Email ??= email;
            existing.Mobile ??= mobile;
            await db.SaveChangesAsync(ct);
            return (200, null, existing);
        }

        var buyer = new StoreBuyerRecord
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = (body.Name ?? "").Trim(),
            Email = email,
            Mobile = mobile,
            PasswordHash = HashPassword(body.Password ?? ""),
            CreatedAtUtc = DateTime.UtcNow,
            CircleRole = "aspirant",
        };
        db.StoreBuyers.Add(buyer);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return (400, "This email or mobile is already registered. Enter the same password, or log in first.", null);
        }

        return (200, null, buyer);
    }

    public async Task<(int Status, string? Message, StoreBuyerRecord? Buyer)> RegisterAsync(
        StoreRegisterRequestDto body,
        CancellationToken ct)
    {
        var standingId = (body.StandingNodeId ?? "").Trim();
        if (standingId.Length == 0)
        {
            return (400, "Choose your current qualification or profession.", null);
        }

        if (!await db.Nodes.AsNoTracking().AnyAsync(n => n.Id == standingId, ct))
        {
            return (400, "That qualification or profession was not found.", null);
        }

        var goalId = (body.GoalNodeId ?? "").Trim();
        if (goalId.Length > 0 && !await db.Nodes.AsNoTracking().AnyAsync(n => n.Id == goalId, ct))
        {
            return (400, "Career goal was not found.", null);
        }

        var circleRole = NormalizeCircleRole(body.CircleRole);
        var (status, message, buyer) = await ResolveForCheckoutAsync(
            new StoreOrderRequestDto
            {
                Name = body.Name,
                Email = body.Email,
                Mobile = body.Mobile,
                Password = body.Password,
            },
            null,
            ct);

        if (buyer is null)
        {
            return (status, message, null);
        }

        if (string.IsNullOrWhiteSpace(buyer.StandingNodeId))
        {
            buyer.CircleRole = circleRole;
            buyer.StandingNodeId = standingId;
            buyer.GoalNodeId = goalId.Length > 0 ? goalId : null;
            await db.SaveChangesAsync(ct);
        }

        return (200, null, buyer);
    }

    public async Task<(int Status, string? Message, StoreBuyerRecord? Buyer)> LoginAsync(
        StoreLoginRequestDto body,
        CancellationToken ct)
    {
        var login = (body.Login ?? "").Trim();
        var password = body.Password ?? "";
        if (login.Length == 0 || password.Length == 0)
        {
            return (400, "Enter your email or mobile, and your password.", null);
        }

        StoreBuyerRecord? buyer = null;
        if (IsAdminLogin(login))
        {
            buyer = await FindAdminAsync(ct);
        }
        else
        {
            var (email, _) = NormalizeEmail(login);
            if (email is not null)
            {
                buyer = await db.StoreBuyers.FirstOrDefaultAsync(b => b.Email == email, ct);
            }
            else
            {
                var (mobile, _) = NormalizeMobile(login);
                if (mobile is not null)
                {
                    buyer = await db.StoreBuyers.FirstOrDefaultAsync(b => b.Mobile == mobile, ct);
                }
            }
        }

        if (buyer is null || !VerifyPassword(password, buyer.PasswordHash))
        {
            return (401, "Email/mobile or password is incorrect.", null);
        }

        return (200, null, buyer);
    }

    public Task<StoreBuyerRecord?> FindAdminAsync(CancellationToken ct = default) =>
        db.StoreBuyers.FirstOrDefaultAsync(b => b.Email == AdminEmail(), ct);

    public async Task<StoreBuyerRecord> EnsureAdminBuyerAsync(CancellationToken ct = default)
    {
        var existing = await FindAdminAsync(ct);
        if (existing is not null)
        {
            return existing;
        }

        var buyer = new StoreBuyerRecord
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = "Admin",
            Email = AdminEmail(),
            PasswordHash = HashPassword(FirstAdminPassword),
            CreatedAtUtc = DateTime.UtcNow
        };
        db.StoreBuyers.Add(buyer);
        await db.SaveChangesAsync(ct);
        return buyer;
    }

    public async Task<(int Status, string? Message, StoreBuyerRecord? Buyer)> UpdateAsync(
        string id,
        AdminStoreBuyerUpdateDto body,
        CancellationToken ct)
    {
        var buyer = await db.StoreBuyers.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (buyer is null)
        {
            return (404, "That store user was not found.", null);
        }

        var nameError = ValidateName(body.Name, required: true);
        if (nameError is not null)
        {
            return (400, nameError, null);
        }

        var (email, emailError) = NormalizeEmail(body.Email);
        if (emailError is not null)
        {
            return (400, emailError, null);
        }

        var (mobile, mobileError) = NormalizeMobile(body.Mobile);
        if (mobileError is not null)
        {
            return (400, mobileError, null);
        }

        if (IsAdminBuyer(buyer))
        {
            email = AdminEmail();
        }

        if (email is null && mobile is null)
        {
            return (400, "Enter an email or a 10-digit mobile number.", null);
        }

        if (email is not null && await db.StoreBuyers.AnyAsync(b => b.Id != buyer.Id && b.Email == email, ct))
        {
            return (400, "Another user already has this email.", null);
        }

        if (mobile is not null && await db.StoreBuyers.AnyAsync(b => b.Id != buyer.Id && b.Mobile == mobile, ct))
        {
            return (400, "Another user already has this mobile number.", null);
        }

        buyer.Name = body.Name.Trim();
        buyer.Email = email;
        buyer.Mobile = mobile;
        await db.SaveChangesAsync(ct);
        return (200, null, buyer);
    }

    public async Task<(int Status, string? Message)> DeleteAsync(string id, CancellationToken ct)
    {
        var buyer = await db.StoreBuyers.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (buyer is null)
        {
            return (404, "That store user was not found.");
        }

        if (IsAdminBuyer(buyer))
        {
            return (400, "The admin account cannot be removed.");
        }

        await db.StoreOrders
            .Where(o => o.BuyerId == buyer.Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(o => o.BuyerId, (string?)null), ct);
        db.StoreBuyers.Remove(buyer);
        await db.SaveChangesAsync(ct);
        return (200, null);
    }

    public async Task<(int Status, string? Message)> SetPasswordAsync(string id, string password, CancellationToken ct)
    {
        var buyer = await db.StoreBuyers.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (buyer is null)
        {
            return (404, "That store user was not found.");
        }

        var passwordError = ValidatePassword(password);
        if (passwordError is not null)
        {
            return (400, passwordError);
        }

        buyer.PasswordHash = HashPassword(password);
        await db.SaveChangesAsync(ct);
        return (200, null);
    }

    public bool IsAdminBuyer(StoreBuyerRecord buyer) =>
        string.Equals(buyer.Email, AdminEmail(), StringComparison.OrdinalIgnoreCase);

    public static bool IsAdminLogin(string login)
    {
        var value = login.Trim().ToLowerInvariant();
        return value is DefaultAdminLogin or DefaultAdminEmail;
    }

    public string AdminEmail() =>
        (config["Admin:Email"] ?? DefaultAdminEmail).Trim().ToLowerInvariant();

    public static string? ValidateName(string? raw, bool required)
    {
        var name = (raw ?? "").Trim();
        if (name.Length == 0)
        {
            return required ? "Enter your name." : null;
        }

        if (name.Length < 2 || name.Length > 80)
        {
            return "Name must be 2–80 characters.";
        }

        return NamePattern.IsMatch(name) ? null : "Use letters, spaces, apostrophes, or a hyphen in the name.";
    }

    public static (string? Value, string? Error) NormalizeEmail(string? raw)
    {
        var email = (raw ?? "").Trim().ToLowerInvariant();
        if (email.Length == 0)
        {
            return (null, null);
        }

        if (email.Length > 200 || !EmailPattern.IsMatch(email))
        {
            return (null, "Enter a valid email address.");
        }

        return (email, null);
    }

    public static (string? Value, string? Error) NormalizeMobile(string? raw)
    {
        var value = (raw ?? "").Trim();
        if (value.Length == 0)
        {
            return (null, null);
        }

        var digits = new string(value.Where(char.IsDigit).ToArray());
        if (digits.Length == 12 && digits.StartsWith("91", StringComparison.Ordinal))
        {
            digits = digits[2..];
        }
        else if (digits.Length == 11 && digits.StartsWith('0'))
        {
            digits = digits[1..];
        }

        return MobilePattern.IsMatch(digits)
            ? (digits, null)
            : (null, "Enter a 10-digit Indian mobile number.");
    }

    public static string NormalizeCircleRole(string? raw)
    {
        var value = (raw ?? "aspirant").Trim().ToLowerInvariant();
        return value == "guide" ? "guide" : "aspirant";
    }

    public static string? ValidatePassword(string? raw)
    {
        var password = raw ?? "";
        if (password.Length < 8 || password.Length > 72)
        {
            return "Password must be 8–72 characters.";
        }

        if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit))
        {
            return "Password needs at least one letter and one number.";
        }

        return null;
    }

    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return $"100000.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(string password, string stored)
    {
        var parts = stored.Split('.');
        if (parts.Length != 3 || !int.TryParse(parts[0], out var iterations) || iterations < 1)
        {
            return false;
        }

        try
        {
            var salt = Convert.FromBase64String(parts[1]);
            var expected = Convert.FromBase64String(parts[2]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
