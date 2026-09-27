using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using AgamiPatha.Api;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;
using AgamiPatha.Api.Services;
using AgamiPatha.Api.Services.Ranking;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Production.json", optional: false, reloadOnChange: true);
if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddJsonFile("appsettings.Development.json", optional: true, reloadOnChange: true);
}

builder.WebHost.UseUrls("http://0.0.0.0:43212");

builder.Services.AddControllers(options => options.Conventions.Add(new AlternateApiPrefixConvention()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "AgamiPatha API",
        Version = "v1",
        Description = "Log in at POST /api/auth/login, then click Authorize and paste the JWT.",
    });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Admin JWT from POST /api/auth/login. Paste the token only — Swagger adds Bearer.",
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
            },
            Array.Empty<string>()
        },
    });
});
builder.Services.AddScoped<PathService>();
builder.Services.AddScoped<StatsService>();
builder.Services.AddHttpClient<ChatService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(50);
    client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "Mozilla/5.0");
});
builder.Services.AddHttpClient<StoreService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddScoped<FeatureRouteRanker>();
builder.Services.AddScoped<IRouteRanker>(sp =>
{
    var fallback = sp.GetRequiredService<FeatureRouteRanker>();
    var env = sp.GetRequiredService<IWebHostEnvironment>();
    var zip = MlRouteRanker.FindModelPath(env);
    if (zip is null)
    {
        return fallback;
    }

    var logger = sp.GetRequiredService<ILogger<MlRouteRanker>>();
    return new MlRouteRanker(fallback, zip, logger);
});
builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped<StoreBuyerService>();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is missing from appsettings.Production.json.");
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseSqlServer(connectionString));

var jwtKey = builder.Configuration["Admin:JwtKey"] ?? "agamipatha-dev-jwt-key-change-me-32ch!";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.Name,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (HttpMethods.IsOptions(context.Request.Method))
                {
                    context.NoResult();
                }

                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(opt =>
{
    opt.AddPolicy("app", policy =>
    {
        policy
            .SetIsOriginAllowed(origin => IsAllowedCorsOrigin(origin, corsOrigins))
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
            .WithExposedHeaders("Content-Disposition")
            .SetPreflightMaxAge(TimeSpan.FromHours(1));
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Database");
    await DatabaseInitializer.PrepareAsync(db, app.Environment, connectionString, logger);
    var buyers = scope.ServiceProvider.GetRequiredService<StoreBuyerService>();
    await buyers.EnsureAdminBuyerAsync();
}

if (args.Any(a => a.Equals("train-ranker", StringComparison.OrdinalIgnoreCase)))
{
    using var scope = app.Services.CreateScope();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("RouteRanker");
    await RouteRankerTrainer.TrainAsync(scope.ServiceProvider, app.Environment, logger);
    return;
}

app.UseCors("app");

if (!app.Environment.IsDevelopment())
{
    app.Use(async (context, next) =>
    {
        if (!context.Request.Path.StartsWithSegments("/swagger"))
        {
            await next();
            return;
        }

        var buyers = context.RequestServices.GetRequiredService<StoreBuyerService>();
        if (await HasAdminBasicAsync(context.Request, buyers, context.RequestAborted))
        {
            await next();
            return;
        }

        context.Response.Headers.WWWAuthenticate = "Basic realm=\"AgamiPatha Swagger\"";
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
    });
}

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "AgamiPatha API v1");
    options.DocumentTitle = "AgamiPatha API";
    options.EnablePersistAuthorization();
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers().RequireCors("app");
app.MapGet("/api/health", () => Results.Ok(new { ok = true })).RequireCors("app");
app.MapGet("/health", () => Results.Ok(new { ok = true })).RequireCors("app");

app.Run();

static bool IsAllowedCorsOrigin(string? origin, IReadOnlyCollection<string> configured)
{
    if (string.IsNullOrWhiteSpace(origin))
    {
        return true;
    }

    if (configured.Any(allowed => string.Equals(allowed, origin, StringComparison.OrdinalIgnoreCase)))
    {
        return true;
    }

    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
    {
        return false;
    }

    if (uri.Scheme is "capacitor" or "ionic" or "file")
    {
        return true;
    }

    var host = uri.Host.Trim().TrimEnd('.');
    if (host.Equals("agamipatha.com", StringComparison.OrdinalIgnoreCase)
        || host.EndsWith(".agamipatha.com", StringComparison.OrdinalIgnoreCase)
        || host is "localhost" or "127.0.0.1" or "::1")
    {
        return true;
    }

    return false;
}

static async Task<bool> HasAdminBasicAsync(HttpRequest request, StoreBuyerService buyers, CancellationToken ct)
{
    if (!request.Headers.TryGetValue("Authorization", out var header))
    {
        return false;
    }

    var value = header.ToString();
    if (!value.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
    {
        return false;
    }

    try
    {
        var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(value["Basic ".Length..].Trim()));
        var colon = decoded.IndexOf(':');
        if (colon < 0)
        {
            return false;
        }

        var login = decoded[..colon];
        var password = decoded[(colon + 1)..];
        var (_, _, buyer) = await buyers.LoginAsync(new StoreLoginRequestDto
        {
            Login = string.IsNullOrWhiteSpace(login) ? buyers.AdminEmail() : login,
            Password = password
        }, ct);
        return buyer is not null && buyers.IsAdminBuyer(buyer);
    }
    catch (FormatException)
    {
        return false;
    }
}
