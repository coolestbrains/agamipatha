using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Data;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Services;

public class StoreService(
    HttpClient http,
    AppDbContext db,
    StoreBuyerService buyers,
    TokenService tokens,
    IConfiguration config,
    IWebHostEnvironment env,
    ILogger<StoreService> logger)
{
    public StoreCatalogDto Catalog()
    {
        var (keyId, _, currency, configured, testMode) = Credentials();
        return new StoreCatalogDto
        {
            Configured = configured,
            TestMode = testMode,
            KeyId = configured ? keyId : "",
            Currency = currency,
            Products = Products()
                .Select(p => new StoreProductDto
                {
                    Id = p.Id,
                    Title = p.Title,
                    Description = p.Description,
                    Kind = p.Kind,
                    PricePaise = p.PricePaise,
                    PriceLabel = FormatPrice(p.PricePaise, currency),
                    Cover = ResolveCoverPath(p),
                    File = ProductFileName(p),
                    HasUploadedCover = FindUploadedCover(p.Id) is not null,
                    CoverVersion = CoverVersion(p.Id),
                    HasPdf = HasPdf(p),
                    OnSale = IsOnSale(p)
                })
                .ToList()
        };
    }

    public async Task<(int Status, object Body)> CreateOrderAsync(
        StoreOrderRequestDto body,
        string? sessionBuyerId,
        CancellationToken ct)
    {
        var (keyId, keySecret, currency, configured, testMode) = Credentials();
        if (!configured)
        {
            return (503, new
            {
                message = "Razorpay is not configured. Add Test or Live keys under Razorpay in appsettings.json."
            });
        }

        if (!testMode && keyId.StartsWith("rzp_live_", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning("Live Razorpay keys are active. Checkout will not open on http://localhost.");
        }

        var productId = (body.ProductId ?? "").Trim();
        var product = Products().FirstOrDefault(p => p.Id.Equals(productId, StringComparison.OrdinalIgnoreCase));
        if (product is null)
        {
            return (404, new { message = "That product is not in the store." });
        }

        if (!IsOnSale(product))
        {
            var message = HasPdf(product)
                ? "This ebook is not on sale until it has a cover."
                : "This product is not on sale until a PDF is available.";
            return (400, new { message });
        }

        if (product.PricePaise <= 0)
        {
            return (400, new { message = "This ebook is free. Use Get free instead of checkout." });
        }

        if (product.PricePaise < 100)
        {
            return (400, new { message = "Product price must be at least ₹1." });
        }

        var (buyerStatus, buyerMessage, buyer) = await buyers.ResolveForCheckoutAsync(body, sessionBuyerId, ct);
        if (buyer is null)
        {
            return (buyerStatus, new { message = buyerMessage });
        }

        var receipt = Guid.NewGuid().ToString("N")[..24];
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.razorpay.com/v1/orders");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", BasicAuth(keyId, keySecret));
        request.Content = new StringContent(JsonSerializer.Serialize(new
        {
            amount = product.PricePaise,
            currency,
            receipt,
            notes = new { productId = product.Id, title = product.Title }
        }), Encoding.UTF8, "application/json");

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Razorpay order request failed.");
            return (502, new { message = "Could not reach Razorpay. Try again in a moment." });
        }

        var raw = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Razorpay order failed ({Status}): {Body}", (int)response.StatusCode, raw);
            var which = testMode ? "Test" : "Live";
            var message = (int)response.StatusCode == 401
                ? $"Razorpay rejected the {which} Key ID/secret. Paste current keys from the Razorpay dashboard into Razorpay:{which} in appsettings.json and restart the API."
                : RazorpayError(raw);
            return (502, new { message });
        }

        using var doc = JsonDocument.Parse(raw);
        if (!doc.RootElement.TryGetProperty("id", out var idEl) || idEl.GetString() is not { Length: > 0 } razorpayOrderId)
        {
            return (502, new { message = "Razorpay did not return an order id." });
        }

        db.StoreOrders.Add(new StoreOrderRecord
        {
            Id = receipt,
            BuyerId = buyer.Id,
            ProductId = product.Id,
            AmountPaise = product.PricePaise,
            Currency = currency,
            RazorpayOrderId = razorpayOrderId,
            Status = "created",
            BuyerEmail = buyer.Email,
            CreatedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync(ct);

        return (200, new StoreOrderDto
        {
            OrderId = razorpayOrderId,
            Amount = product.PricePaise,
            Currency = currency,
            KeyId = keyId,
            ProductTitle = product.Title,
            TestMode = testMode
        });
    }

    public async Task<(int Status, object Body)> VerifyAsync(StoreVerifyRequestDto body, CancellationToken ct)
    {
        var (_, keySecret, _, configured, _) = Credentials();
        if (!configured)
        {
            return (503, new { message = "Razorpay is not configured." });
        }

        var orderId = (body.OrderId ?? "").Trim();
        var paymentId = (body.PaymentId ?? "").Trim();
        var signature = (body.Signature ?? "").Trim();
        if (orderId.Length == 0 || paymentId.Length == 0 || signature.Length == 0)
        {
            return (400, new { message = "Payment confirmation is incomplete." });
        }

        if (!ValidSignature(orderId, paymentId, signature, keySecret))
        {
            return (400, new { message = "Payment signature did not match. The order was not marked paid." });
        }

        var order = await db.StoreOrders.FirstOrDefaultAsync(o => o.RazorpayOrderId == orderId, ct);
        if (order is null)
        {
            return (404, new { message = "That store order was not found." });
        }

        var product = Products().FirstOrDefault(p => p.Id.Equals(order.ProductId, StringComparison.OrdinalIgnoreCase));
        if (product is null)
        {
            return (404, new { message = "The purchased product is no longer listed." });
        }

        if (order.Status != "paid" || string.IsNullOrWhiteSpace(order.DownloadToken))
        {
            order.Status = "paid";
            order.RazorpayPaymentId = paymentId;
            order.DownloadToken = Guid.NewGuid().ToString("N");
            order.PaidAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        var buyer = string.IsNullOrWhiteSpace(order.BuyerId)
            ? null
            : await db.StoreBuyers.AsNoTracking().FirstOrDefaultAsync(b => b.Id == order.BuyerId, ct);

        return (200, new StoreVerifyDto
        {
            DownloadToken = order.DownloadToken!,
            ProductTitle = product.Title,
            FileName = ProductFileName(product),
            Token = buyer is null ? null : tokens.CreateBuyerToken(buyer.Id, buyer.Name),
            BuyerName = buyer?.Name
        });
    }

    public async Task<(int Status, object Body)> RegisterAsync(StoreRegisterRequestDto body, CancellationToken ct)
    {
        var (status, message, buyer) = await buyers.RegisterAsync(body, ct);
        if (buyer is null)
        {
            return (status, new { message });
        }

        return (200, await AuthForBuyerAsync(buyer, ct));
    }

    public async Task<(int Status, object Body)> ClaimFreeAsync(
        string buyerId,
        StoreClaimRequestDto body,
        CancellationToken ct)
    {
        var productId = (body.ProductId ?? "").Trim();
        var product = Products().FirstOrDefault(p => p.Id.Equals(productId, StringComparison.OrdinalIgnoreCase));
        if (product is null)
        {
            return (404, new { message = "That product is not in the store." });
        }

        if (!IsOnSale(product))
        {
            var message = HasPdf(product)
                ? "This ebook is not available until it has a cover."
                : "This product is not available until a PDF is uploaded.";
            return (400, new { message });
        }

        if (product.PricePaise > 0)
        {
            return (400, new { message = "This product is not free. Use checkout instead." });
        }

        var existing = await db.StoreOrders.AsNoTracking()
            .FirstOrDefaultAsync(
                o => o.BuyerId == buyerId && o.ProductId == product.Id && o.Status == "paid" && o.DownloadToken != null,
                ct);
        if (existing is not null)
        {
            return (200, new StorePurchaseDto
            {
                ProductId = product.Id,
                Title = product.Title,
                FileName = ProductFileName(product),
                DownloadToken = existing.DownloadToken!,
            });
        }

        var buyer = await db.StoreBuyers.AsNoTracking().FirstOrDefaultAsync(b => b.Id == buyerId, ct);
        if (buyer is null)
        {
            return (401, new { message = "Sign in to claim this ebook." });
        }

        var (_, _, currency, _, _) = Credentials();
        var receipt = Guid.NewGuid().ToString("N")[..24];
        var token = Guid.NewGuid().ToString("N");
        var now = DateTime.UtcNow;
        db.StoreOrders.Add(new StoreOrderRecord
        {
            Id = receipt,
            BuyerId = buyerId,
            ProductId = product.Id,
            AmountPaise = 0,
            Currency = currency,
            RazorpayOrderId = $"free-{receipt}",
            Status = "paid",
            DownloadToken = token,
            BuyerEmail = buyer.Email,
            CreatedAtUtc = now,
            PaidAtUtc = now,
        });
        await db.SaveChangesAsync(ct);

        return (200, new StorePurchaseDto
        {
            ProductId = product.Id,
            Title = product.Title,
            FileName = ProductFileName(product),
            DownloadToken = token,
        });
    }

    public async Task<(int Status, object Body)> LoginAsync(StoreLoginRequestDto body, CancellationToken ct)
    {
        var (status, message, buyer) = await buyers.LoginAsync(body, ct);
        if (buyer is null)
        {
            return (status, new { message });
        }

        return (200, await AuthForBuyerAsync(buyer, ct));
    }

    private async Task<StoreBuyerAuthDto> AuthForBuyerAsync(StoreBuyerRecord buyer, CancellationToken ct)
    {
        var subscription = await GetSubscriptionAsync(buyer.Id, ct);
        return new StoreBuyerAuthDto
        {
            Token = tokens.CreateBuyerToken(buyer.Id, buyer.Name),
            BuyerName = buyer.Name,
            AdminToken = buyers.IsAdminBuyer(buyer) ? tokens.CreateToken() : null,
            Purchases = await PurchasesForBuyerAsync(buyer.Id, ct),
            SubscriptionActive = subscription.Active,
            PeriodEndUtc = subscription.PeriodEndUtc,
        };
    }

    public const int SubscriptionAmountPaise = 19_900;

    public async Task<BuyerSubscriptionDto> GetSubscriptionAsync(string buyerId, CancellationToken ct)
    {
        var (_, _, currency, _, _) = Credentials();
        var row = await db.BuyerSubscriptions.AsNoTracking()
            .Where(s => s.BuyerId == buyerId && s.Status == "active" && s.PeriodEndUtc > DateTime.UtcNow)
            .OrderByDescending(s => s.PeriodEndUtc)
            .FirstOrDefaultAsync(ct);

        return new BuyerSubscriptionDto
        {
            Active = row is not null,
            PeriodEndUtc = row?.PeriodEndUtc,
            AmountPaise = SubscriptionAmountPaise,
            AmountLabel = FormatPrice(SubscriptionAmountPaise, currency),
            Currency = currency,
        };
    }

    public async Task<(int Status, object Body)> CreateSubscriptionOrderAsync(string buyerId, CancellationToken ct)
    {
        var (keyId, keySecret, currency, configured, testMode) = Credentials();
        if (!configured)
        {
            return (503, new
            {
                message = "Razorpay is not configured. Add Test or Live keys under Razorpay in appsettings.json.",
            });
        }

        var buyer = await db.StoreBuyers.AsNoTracking().FirstOrDefaultAsync(b => b.Id == buyerId, ct);
        if (buyer is null)
        {
            return (401, new { message = "Sign in to subscribe." });
        }

        var receipt = Guid.NewGuid().ToString("N")[..24];
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.razorpay.com/v1/orders");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", BasicAuth(keyId, keySecret));
        request.Content = new StringContent(JsonSerializer.Serialize(new
        {
            amount = SubscriptionAmountPaise,
            currency,
            receipt,
            notes = new { kind = "circle-subscription", buyerId },
        }), Encoding.UTF8, "application/json");

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Razorpay subscription order request failed.");
            return (502, new { message = "Could not reach Razorpay. Try again in a moment." });
        }

        var raw = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Razorpay subscription order failed ({Status}): {Body}", (int)response.StatusCode, raw);
            var which = testMode ? "Test" : "Live";
            var message = (int)response.StatusCode == 401
                ? $"Razorpay rejected the {which} Key ID/secret."
                : RazorpayError(raw);
            return (502, new { message });
        }

        using var doc = JsonDocument.Parse(raw);
        if (!doc.RootElement.TryGetProperty("id", out var idEl) || idEl.GetString() is not { Length: > 0 } razorpayOrderId)
        {
            return (502, new { message = "Razorpay did not return an order id." });
        }

        var now = DateTime.UtcNow;
        db.BuyerSubscriptions.Add(new BuyerSubscriptionRecord
        {
            Id = receipt,
            BuyerId = buyerId,
            Status = "created",
            AmountPaise = SubscriptionAmountPaise,
            Currency = currency,
            RazorpayOrderId = razorpayOrderId,
            PeriodStartUtc = now,
            PeriodEndUtc = now,
            CreatedAtUtc = now,
        });
        await db.SaveChangesAsync(ct);

        return (200, new StoreOrderDto
        {
            OrderId = razorpayOrderId,
            Amount = SubscriptionAmountPaise,
            Currency = currency,
            KeyId = keyId,
            ProductTitle = "Path Circle mentors (1 month)",
            TestMode = testMode,
        });
    }

    public async Task<(int Status, object Body)> VerifySubscriptionAsync(
        string buyerId,
        StoreVerifyRequestDto body,
        CancellationToken ct)
    {
        var (_, keySecret, currency, configured, _) = Credentials();
        if (!configured)
        {
            return (503, new { message = "Razorpay is not configured." });
        }

        var orderId = (body.OrderId ?? "").Trim();
        var paymentId = (body.PaymentId ?? "").Trim();
        var signature = (body.Signature ?? "").Trim();
        if (orderId.Length == 0 || paymentId.Length == 0 || signature.Length == 0)
        {
            return (400, new { message = "Payment confirmation is incomplete." });
        }

        if (!ValidSignature(orderId, paymentId, signature, keySecret))
        {
            return (400, new { message = "Payment signature did not match." });
        }

        var row = await db.BuyerSubscriptions.FirstOrDefaultAsync(
            s => s.RazorpayOrderId == orderId && s.BuyerId == buyerId,
            ct);
        if (row is null)
        {
            return (404, new { message = "That subscription order was not found." });
        }

        if (row.Status != "active")
        {
            var now = DateTime.UtcNow;
            var activeEnd = await db.BuyerSubscriptions.AsNoTracking()
                .Where(s => s.BuyerId == buyerId && s.Status == "active" && s.PeriodEndUtc > now && s.Id != row.Id)
                .OrderByDescending(s => s.PeriodEndUtc)
                .Select(s => s.PeriodEndUtc)
                .FirstOrDefaultAsync(ct);

            var start = activeEnd > now ? activeEnd : now;
            row.Status = "active";
            row.RazorpayPaymentId = paymentId;
            row.PeriodStartUtc = start;
            row.PeriodEndUtc = start.AddDays(30);
            await db.SaveChangesAsync(ct);
        }

        var subscription = await GetSubscriptionAsync(buyerId, ct);
        return (200, new
        {
            subscriptionActive = subscription.Active,
            periodEndUtc = subscription.PeriodEndUtc,
            amountLabel = FormatPrice(SubscriptionAmountPaise, currency),
        });
    }

    public async Task<List<StorePurchaseDto>> PurchasesForBuyerAsync(string buyerId, CancellationToken ct)
    {
        var orders = await db.StoreOrders.AsNoTracking()
            .Where(o => o.BuyerId == buyerId && o.Status == "paid" && o.DownloadToken != null)
            .OrderByDescending(o => o.PaidAtUtc ?? o.CreatedAtUtc)
            .ToListAsync(ct);

        var catalog = Products();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var list = new List<StorePurchaseDto>();
        foreach (var order in orders)
        {
            if (!seen.Add(order.ProductId))
            {
                continue;
            }

            var product = catalog.FirstOrDefault(p => p.Id.Equals(order.ProductId, StringComparison.OrdinalIgnoreCase));
            list.Add(new StorePurchaseDto
            {
                ProductId = order.ProductId,
                Title = product?.Title ?? order.ProductId,
                FileName = product is null ? "" : ProductFileName(product),
                DownloadToken = order.DownloadToken!
            });
        }

        return list;
    }

    public async Task<List<StoreBuyerOrderDto>> OrdersForBuyerAsync(string buyerId, CancellationToken ct)
    {
        var orders = await db.StoreOrders.AsNoTracking()
            .Where(o => o.BuyerId == buyerId && (o.Status == "paid" || o.Status == "created"))
            .OrderByDescending(o => o.PaidAtUtc ?? o.CreatedAtUtc)
            .ToListAsync(ct);

        var catalog = Products();
        var currency = Catalog().Currency;
        return orders.Select(order =>
        {
            var product = catalog.FirstOrDefault(p => p.Id.Equals(order.ProductId, StringComparison.OrdinalIgnoreCase));
            var orderCurrency = string.IsNullOrWhiteSpace(order.Currency) ? currency : order.Currency;
            return new StoreBuyerOrderDto
            {
                OrderId = order.RazorpayOrderId,
                ProductId = order.ProductId,
                Title = product?.Title ?? order.ProductId,
                FileName = product is null ? "" : ProductFileName(product),
                DownloadToken = order.Status == "paid" ? (order.DownloadToken ?? "") : "",
                Status = order.Status,
                AmountPaise = order.AmountPaise,
                AmountLabel = FormatPrice(order.AmountPaise, orderCurrency),
                Currency = orderCurrency,
                PlacedAtUtc = order.PaidAtUtc ?? order.CreatedAtUtc
            };
        }).ToList();
    }

    public async Task<(int Status, string? Message, string? FilePath, string? FileName)> ResolveDownloadAsync(
        string token,
        CancellationToken ct)
    {
        var trimmed = (token ?? "").Trim();
        if (trimmed.Length == 0)
        {
            return (400, "Missing download token.", null, null);
        }

        var order = await db.StoreOrders.FirstOrDefaultAsync(o => o.DownloadToken == trimmed && o.Status == "paid", ct);
        if (order is null)
        {
            return (404, "That download link is invalid or expired.", null, null);
        }

        var product = Products().FirstOrDefault(p => p.Id.Equals(order.ProductId, StringComparison.OrdinalIgnoreCase));
        if (product is null || string.IsNullOrWhiteSpace(product.File))
        {
            return (404, "The file for this purchase is no longer available.", null, null);
        }

        var fileName = ProductFileName(product);
        var path = ResolveProductFile(fileName);
        if (path is null)
        {
            logger.LogWarning("Store file missing for {Product}: {File}", product.Id, fileName);
            return (404, "The file for this purchase is missing on the server.", null, null);
        }

        return (200, null, path, fileName);
    }

    public async Task<int> ClearOrdersAsync(CancellationToken ct)
    {
        return await db.StoreOrders.ExecuteDeleteAsync(ct);
    }

    public async Task<(int Status, string? Message)> DeleteOrderAsync(string id, CancellationToken ct)
    {
        var order = await db.StoreOrders.FirstOrDefaultAsync(o => o.Id == id, ct);
        if (order is null)
        {
            return (404, "That order was not found.");
        }

        db.StoreOrders.Remove(order);
        await db.SaveChangesAsync(ct);
        return (200, null);
    }

    public async Task<AdminStoreSalesDto> SalesAsync(CancellationToken ct)
    {
        var (_, _, currency, _, _) = Credentials();
        var catalog = Products();
        var paid = await db.StoreOrders.AsNoTracking()
            .Where(o => o.Status == "paid")
            .OrderByDescending(o => o.PaidAtUtc ?? o.CreatedAtUtc)
            .ToListAsync(ct);

        var today = DateTime.UtcNow.Date;
        var todayOrders = paid.Where(o => (o.PaidAtUtc ?? o.CreatedAtUtc).Date == today).ToList();
        var totalPaise = paid.Sum(o => o.AmountPaise);
        var todayPaise = todayOrders.Sum(o => o.AmountPaise);
        var titles = catalog.ToDictionary(p => p.Id, p => p.Title, StringComparer.OrdinalIgnoreCase);
        var allBuyers = await db.StoreBuyers.AsNoTracking()
            .OrderBy(b => b.Name)
            .ThenBy(b => b.Email)
            .ToListAsync(ct);
        var buyerLookup = allBuyers.ToDictionary(b => b.Id, StringComparer.OrdinalIgnoreCase);

        var byProduct = paid
            .GroupBy(o => o.ProductId, StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var amount = g.Sum(o => o.AmountPaise);
                return new AdminStoreProductSalesDto
                {
                    ProductId = g.Key,
                    Title = titles.TryGetValue(g.Key, out var title) ? title : g.Key,
                    BooksPurchased = g.Count(),
                    AmountPaise = amount,
                    AmountLabel = FormatPrice(amount, currency)
                };
            })
            .OrderByDescending(p => p.AmountPaise)
            .ThenBy(p => p.Title)
            .ToList();

        foreach (var product in catalog.Where(p => byProduct.All(row => !row.ProductId.Equals(p.Id, StringComparison.OrdinalIgnoreCase))))
        {
            byProduct.Add(new AdminStoreProductSalesDto
            {
                ProductId = product.Id,
                Title = product.Title,
                BooksPurchased = 0,
                AmountPaise = 0,
                AmountLabel = FormatPrice(0, currency)
            });
        }

        return new AdminStoreSalesDto
        {
            BuyerCount = allBuyers.Count,
            BooksPurchased = paid.Count,
            AmountReceivedPaise = totalPaise,
            AmountReceivedLabel = FormatPrice(totalPaise, currency),
            Currency = currency,
            BooksToday = todayOrders.Count,
            AmountTodayPaise = todayPaise,
            AmountTodayLabel = FormatPrice(todayPaise, currency),
            Products = byProduct,
            Buyers = allBuyers.Select(buyer =>
            {
                var orders = paid.Where(o => o.BuyerId == buyer.Id).ToList();
                var amount = orders.Sum(o => o.AmountPaise);
                return new AdminStoreBuyerRowDto
                {
                    Id = buyer.Id,
                    Name = buyer.Name,
                    Email = buyer.Email ?? "",
                    Mobile = buyer.Mobile ?? "",
                    CreatedAtUtc = buyer.CreatedAtUtc,
                    IsAdmin = buyers.IsAdminBuyer(buyer),
                    BooksPurchased = orders.Count,
                    AmountPaise = amount,
                    AmountLabel = FormatPrice(amount, currency),
                    Purchases = orders
                        .OrderByDescending(o => o.PaidAtUtc ?? o.CreatedAtUtc)
                        .Select(o => new AdminStoreBuyerPurchaseDto
                        {
                            OrderId = o.Id,
                            ProductId = o.ProductId,
                            Title = titles.TryGetValue(o.ProductId, out var title) ? title : o.ProductId,
                            Count = 1,
                            AmountPaise = o.AmountPaise,
                            AmountLabel = FormatPrice(o.AmountPaise, currency),
                            PaidAtUtc = o.PaidAtUtc ?? o.CreatedAtUtc
                        })
                        .ToList()
                };
            }).ToList(),
            Recent = paid.Select(o =>
            {
                buyerLookup.TryGetValue(o.BuyerId ?? "", out var buyer);
                var contact = o.BuyerEmail
                    ?? buyer?.Email
                    ?? buyer?.Mobile
                    ?? "";
                return new AdminStoreOrderRowDto
                {
                    Id = o.Id,
                    ProductId = o.ProductId,
                    ProductTitle = titles.TryGetValue(o.ProductId, out var title) ? title : o.ProductId,
                    AmountPaise = o.AmountPaise,
                    AmountLabel = FormatPrice(o.AmountPaise, currency),
                    Currency = o.Currency,
                    BuyerId = o.BuyerId ?? "",
                    BuyerName = buyer?.Name ?? "",
                    BuyerEmail = contact,
                    PaidAtUtc = o.PaidAtUtc ?? o.CreatedAtUtc,
                    PaymentId = o.RazorpayPaymentId ?? ""
                };
            }).ToList()
        };
    }

    private List<StoreProductConfig> Products()
    {
        return config.GetSection("Store:Products").Get<List<StoreProductConfig>>()?
            .Where(p => !string.IsNullOrWhiteSpace(p.Id) && !string.IsNullOrWhiteSpace(p.Title))
            .ToList() ?? [];
    }

    private (string KeyId, string KeySecret, string Currency, bool Configured, bool TestMode) Credentials()
    {
        var mode = (config["Razorpay:Mode"] ?? "").Trim();
        var testMode = env.IsDevelopment()
            || mode.Equals("Test", StringComparison.OrdinalIgnoreCase)
            || mode.Equals("Dev", StringComparison.OrdinalIgnoreCase);

        var keyId = testMode
            ? FirstKey("Razorpay:Test:KeyId", "Razorpay:KeyId")
            : FirstKey("Razorpay:Live:KeyId", "Razorpay:KeyId");
        var keySecret = testMode
            ? FirstKey("Razorpay:Test:KeySecret", "Razorpay:KeySecret")
            : FirstKey("Razorpay:Live:KeySecret", "Razorpay:KeySecret");

        if (testMode && keyId.StartsWith("rzp_live_", StringComparison.OrdinalIgnoreCase))
        {
            keyId = FirstKey("Razorpay:Test:KeyId");
            keySecret = FirstKey("Razorpay:Test:KeySecret");
        }

        var currency = (config["Razorpay:Currency"] ?? config["Store:Currency"] ?? "INR").Trim().ToUpperInvariant();
        if (currency.Length == 0)
        {
            currency = "INR";
        }

        var configured = LooksConfigured(keyId) && LooksConfigured(keySecret);
        return (keyId, keySecret, currency, configured, testMode && keyId.StartsWith("rzp_test_", StringComparison.OrdinalIgnoreCase));
    }

    private string FirstKey(params string[] paths)
    {
        foreach (var path in paths)
        {
            var value = (config[path] ?? "").Trim();
            if (LooksConfigured(value))
            {
                return value;
            }
        }

        return "";
    }

    private static bool LooksConfigured(string value)
    {
        return value.Length > 0
            && !value.Equals("REPLACE_ME", StringComparison.OrdinalIgnoreCase)
            && !value.Contains("your-key", StringComparison.OrdinalIgnoreCase);
    }

    private static string BasicAuth(string keyId, string keySecret)
    {
        return Convert.ToBase64String(Encoding.UTF8.GetBytes($"{keyId}:{keySecret}"));
    }

    private static bool ValidSignature(string orderId, string paymentId, string signature, string secret)
    {
        var payload = $"{orderId}|{paymentId}";
        var expectedBytes = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload));
        var expected = Convert.ToHexString(expectedBytes);
        var provided = signature.Trim();
        if (expected.Length != provided.Length)
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(expected.ToLowerInvariant()),
            Encoding.ASCII.GetBytes(provided.ToLowerInvariant()));
    }

    private static string RazorpayError(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.TryGetProperty("error", out var error)
                && error.TryGetProperty("description", out var desc)
                && desc.GetString() is { Length: > 0 } text)
            {
                return text;
            }
        }
        catch (JsonException)
        {
            // Fall through to a generic message.
        }

        return "Razorpay rejected the order. Check KeyId and KeySecret in appsettings.json.";
    }

    private static string FormatPrice(int paise, string currency)
    {
        if (paise <= 0)
        {
            return currency.Equals("INR", StringComparison.OrdinalIgnoreCase) ? "Free" : $"{currency} 0";
        }

        var amount = paise / 100m;
        if (currency.Equals("INR", StringComparison.OrdinalIgnoreCase))
        {
            return paise % 100 == 0
                ? string.Create(CultureInfo.GetCultureInfo("en-IN"), $"₹{amount:N0}")
                : string.Create(CultureInfo.GetCultureInfo("en-IN"), $"₹{amount:N2}");
        }

        return $"{currency} {amount:N2}";
    }

    public IReadOnlyList<AdminEbookCoverDto> EbookCovers()
    {
        return Products()
            .Where(p => p.Kind.Equals("ebook", StringComparison.OrdinalIgnoreCase))
            .Select(p => new AdminEbookCoverDto
            {
                ProductId = p.Id,
                Title = p.Title,
                Kind = p.Kind,
                Cover = ResolveCoverPath(p),
                HasUploadedCover = FindUploadedCover(p.Id) is not null,
                CoverVersion = CoverVersion(p.Id)
            })
            .ToList();
    }

    public async Task<(int Status, object Body)> UploadCoverAsync(string productId, IFormFile? file, CancellationToken ct)
    {
        var product = Products().FirstOrDefault(p => p.Id.Equals(productId.Trim(), StringComparison.OrdinalIgnoreCase));
        if (product is null || !product.Kind.Equals("ebook", StringComparison.OrdinalIgnoreCase))
        {
            return (404, new { message = "That ebook is not in the store." });
        }

        if (file is null || file.Length == 0)
        {
            return (400, new { message = "Choose a cover image to upload." });
        }

        if (file.Length > 3 * 1024 * 1024)
        {
            return (400, new { message = "Cover images must be 3 MB or smaller." });
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not ".png" and not ".jpg" and not ".jpeg" and not ".webp")
        {
            return (400, new { message = "Use a PNG, JPG, or WebP image." });
        }

        if (ext == ".jpeg")
        {
            ext = ".jpg";
        }

        var covers = CoverRoot();
        Directory.CreateDirectory(covers);
        foreach (var leftover in Directory.GetFiles(covers, product.Id + ".*"))
        {
            File.Delete(leftover);
        }

        var dest = Path.Combine(covers, product.Id + ext);
        await using (var stream = File.Create(dest))
        {
            await file.CopyToAsync(stream, ct);
        }

        return (200, new AdminEbookCoverDto
        {
            ProductId = product.Id,
            Title = product.Title,
            Kind = product.Kind,
            Cover = ResolveCoverPath(product),
            HasUploadedCover = true,
            CoverVersion = CoverVersion(product.Id)
        });
    }

    public (int Status, string? Message, string? Path, string? FileName) ResolveCoverFile(string productId)
    {
        var product = Products().FirstOrDefault(p => p.Id.Equals(productId.Trim(), StringComparison.OrdinalIgnoreCase));
        if (product is null)
        {
            return (404, "That product is not in the store.", null, null);
        }

        var uploaded = FindUploadedCover(product.Id);
        if (uploaded is not null)
        {
            return (200, null, uploaded, Path.GetFileName(uploaded));
        }

        var configuredName = Path.GetFileName(product.Cover ?? "");
        var configured = string.IsNullOrWhiteSpace(configuredName) ? null : ResolveProductFile(configuredName);
        if (configured is not null)
        {
            return (200, null, configured, Path.GetFileName(configured));
        }

        return (404, "No cover for this ebook.", null, null);
    }

    private bool HasPdf(StoreProductConfig product)
    {
        var name = ProductFileName(product);
        return name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) && ResolveProductFile(name) is not null;
    }

    private bool IsOnSale(StoreProductConfig product)
    {
        if (!HasPdf(product))
        {
            return false;
        }

        if (product.Kind.Equals("ebook", StringComparison.OrdinalIgnoreCase) && !HasCover(product))
        {
            return false;
        }

        return true;
    }

    private bool HasCover(StoreProductConfig product) =>
        FindUploadedCover(product.Id) is not null || !string.IsNullOrWhiteSpace(product.Cover);

    private string ResolveCoverPath(StoreProductConfig product)
    {
        if (FindUploadedCover(product.Id) is not null)
        {
            return $"/store/covers/{product.Id}";
        }

        return product.Cover ?? "";
    }

    private long CoverVersion(string productId)
    {
        var file = FindUploadedCover(productId);
        return file is null ? 0 : new DateTimeOffset(File.GetLastWriteTimeUtc(file)).ToUnixTimeSeconds();
    }

    private string? FindUploadedCover(string productId)
    {
        var covers = CoverRoot();
        if (!Directory.Exists(covers))
        {
            return null;
        }

        return Directory.GetFiles(covers, productId + ".*")
            .FirstOrDefault(path => Path.GetExtension(path).ToLowerInvariant() is ".png" or ".jpg" or ".jpeg" or ".webp");
    }

    private string CoverRoot() => Path.GetFullPath(Path.Combine(env.ContentRootPath, "Store", "covers"));

    private string ProductFileName(StoreProductConfig product)
    {
        var name = Path.GetFileName(product.File);
        if (string.IsNullOrWhiteSpace(name))
        {
            return "";
        }

        if (!name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            var pdfName = Path.ChangeExtension(name, ".pdf");
            if (ResolveProductFile(pdfName) is not null)
            {
                return pdfName;
            }
        }

        return name;
    }

    private string? ResolveProductFile(string fileName)
    {
        var root = Path.GetFullPath(Path.Combine(env.ContentRootPath, "Store"));
        var candidate = Path.GetFullPath(Path.Combine(root, Path.GetFileName(fileName)));
        if (!candidate.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(candidate))
        {
            return null;
        }

        return candidate;
    }
}
