using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Data;

public static class DatabaseInitializer
{
    public static async Task PrepareAsync(
        AppDbContext db,
        IWebHostEnvironment env,
        string connectionString,
        ILogger logger)
    {
        logger.LogInformation("Preparing SQL Server database from DefaultConnection…");
        await EnsureDatabaseExistsAsync(connectionString, logger);
        await db.Database.EnsureCreatedAsync();
        await EnsureSchemaAsync(db);
        await SeedCatalogAsync(db, env, logger);
        await ExamPathExpander.ExpandAsync(db, logger);

        var nodes = await db.Nodes.CountAsync();
        var edges = await db.Edges.CountAsync();
        if (nodes == 0)
        {
            throw new InvalidOperationException("Database prepared but Nodes is empty. Check Seed/catalog.json.");
        }

        logger.LogInformation("Database ready. Using {Nodes} nodes and {Edges} edges.", nodes, edges);
    }

    private static async Task EnsureDatabaseExistsAsync(string connectionString, ILogger logger)
    {
        var builder = new SqlConnectionStringBuilder(connectionString);
        var database = builder.InitialCatalog;
        if (string.IsNullOrWhiteSpace(database))
        {
            throw new InvalidOperationException("DefaultConnection must include a Database name.");
        }

        if (!Regex.IsMatch(database, @"^[A-Za-z_][A-Za-z0-9_]*$"))
        {
            throw new InvalidOperationException($"Database name '{database}' is not a valid SQL identifier.");
        }

        builder.InitialCatalog = "master";
        await using var connection = new SqlConnection(builder.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            IF DB_ID(N'{database}') IS NULL
            BEGIN
                CREATE DATABASE [{database}];
            END
            """;
        await command.ExecuteNonQueryAsync();
        logger.LogInformation("SQL Server database [{Database}] is available on {Server}.", database, builder.DataSource);
    }

    private static async Task EnsureSchemaAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.Nodes', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.Nodes (
                    Id nvarchar(80) NOT NULL CONSTRAINT PK_Nodes PRIMARY KEY,
                    Title nvarchar(160) NOT NULL,
                    ShortTitle nvarchar(80) NOT NULL,
                    Kind nvarchar(40) NOT NULL,
                    Field nvarchar(80) NOT NULL,
                    Duration nvarchar(80) NOT NULL,
                    TypicalAge nvarchar(80) NOT NULL,
                    Summary nvarchar(max) NOT NULL,
                    WhatYouStudyJson nvarchar(max) NOT NULL,
                    ExamsJson nvarchar(max) NOT NULL,
                    SkillsJson nvarchar(max) NOT NULL,
                    Outlook nvarchar(max) NOT NULL,
                    SalaryHint nvarchar(max) NULL,
                    CostGovt nvarchar(max) NULL,
                    CostPvt nvarchar(max) NULL,
                    WorkplacesJson nvarchar(max) NULL,
                    InstitutesJson nvarchar(max) NULL,
                    CertificationsJson nvarchar(max) NULL,
                    ExperienceYearsMin int NULL,
                    ExperienceYearsTypical int NULL,
                    EntryLevel nvarchar(20) NULL,
                    FeederRolesJson nvarchar(max) NULL,
                    CreatedAtUtc datetime2 NULL
                );
            END

            IF COL_LENGTH(N'dbo.Nodes', N'CreatedAtUtc') IS NULL
            BEGIN
                ALTER TABLE dbo.Nodes ADD CreatedAtUtc datetime2 NULL;
            END

            IF COL_LENGTH(N'dbo.Nodes', N'InstitutesJson') IS NULL
            BEGIN
                ALTER TABLE dbo.Nodes ADD InstitutesJson nvarchar(max) NULL;
            END

            IF COL_LENGTH(N'dbo.Nodes', N'CostGovt') IS NULL
            BEGIN
                ALTER TABLE dbo.Nodes ADD CostGovt nvarchar(max) NULL;
            END

            IF COL_LENGTH(N'dbo.Nodes', N'CostPvt') IS NULL
            BEGIN
                ALTER TABLE dbo.Nodes ADD CostPvt nvarchar(max) NULL;
            END

            IF COL_LENGTH(N'dbo.Nodes', N'CertificationsJson') IS NULL
            BEGIN
                ALTER TABLE dbo.Nodes ADD CertificationsJson nvarchar(max) NULL;
            END

            IF COL_LENGTH(N'dbo.Nodes', N'ExperienceYearsMin') IS NULL
            BEGIN
                ALTER TABLE dbo.Nodes ADD ExperienceYearsMin int NULL;
            END

            IF COL_LENGTH(N'dbo.Nodes', N'ExperienceYearsTypical') IS NULL
            BEGIN
                ALTER TABLE dbo.Nodes ADD ExperienceYearsTypical int NULL;
            END

            IF COL_LENGTH(N'dbo.Nodes', N'EntryLevel') IS NULL
            BEGIN
                ALTER TABLE dbo.Nodes ADD EntryLevel nvarchar(20) NULL;
            END

            IF COL_LENGTH(N'dbo.Nodes', N'FeederRolesJson') IS NULL
            BEGIN
                ALTER TABLE dbo.Nodes ADD FeederRolesJson nvarchar(max) NULL;
            END

            IF OBJECT_ID(N'dbo.Edges', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.Edges (
                    Id int NOT NULL IDENTITY(1,1) CONSTRAINT PK_Edges PRIMARY KEY,
                    FromId nvarchar(80) NOT NULL,
                    ToId nvarchar(80) NOT NULL,
                    Via nvarchar(200) NOT NULL,
                    Notes nvarchar(max) NOT NULL
                );
            END

            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE name = N'IX_Edges_FromId_ToId' AND object_id = OBJECT_ID(N'dbo.Edges')
            )
            BEGIN
                CREATE UNIQUE INDEX IX_Edges_FromId_ToId ON dbo.Edges (FromId, ToId);
            END

            IF OBJECT_ID(N'dbo.SiteStats', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.SiteStats (
                    Id int NOT NULL CONSTRAINT PK_SiteStats PRIMARY KEY,
                    SearchCount bigint NOT NULL,
                    GuestVisitCount bigint NOT NULL
                );
            END

            IF NOT EXISTS (SELECT 1 FROM dbo.SiteStats WHERE Id = 1)
            BEGIN
                INSERT INTO dbo.SiteStats (Id, SearchCount, GuestVisitCount) VALUES (1, 0, 0);
            END

            IF OBJECT_ID(N'dbo.GuestVisits', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.GuestVisits (
                    Id int NOT NULL IDENTITY(1,1) CONSTRAINT PK_GuestVisits PRIMARY KEY,
                    OccurredAtUtc datetime2 NOT NULL,
                    VisitorKey nvarchar(64) NOT NULL CONSTRAINT DF_GuestVisits_VisitorKey DEFAULT (N''),
                    DayIst nvarchar(10) NOT NULL CONSTRAINT DF_GuestVisits_DayIst DEFAULT (N'')
                );
            END

            IF OBJECT_ID(N'dbo.SearchVisits', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.SearchVisits (
                    Id int NOT NULL IDENTITY(1,1) CONSTRAINT PK_SearchVisits PRIMARY KEY,
                    OccurredAtUtc datetime2 NOT NULL
                );
            END

            IF OBJECT_ID(N'dbo.NodeInterest', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.NodeInterest (
                    Id int NOT NULL IDENTITY(1,1) CONSTRAINT PK_NodeInterest PRIMARY KEY,
                    NodeId nvarchar(80) NOT NULL,
                    OccurredAtUtc datetime2 NOT NULL,
                    Kind nvarchar(20) NOT NULL CONSTRAINT DF_NodeInterest_Kind DEFAULT (N'')
                );
                CREATE INDEX IX_NodeInterest_NodeId_OccurredAtUtc
                    ON dbo.NodeInterest (NodeId, OccurredAtUtc DESC);
            END

            IF COL_LENGTH(N'dbo.NodeInterest', N'Kind') IS NULL
            BEGIN
                ALTER TABLE dbo.NodeInterest ADD Kind nvarchar(20) NOT NULL
                    CONSTRAINT DF_NodeInterest_Kind DEFAULT (N'');
            END

            IF OBJECT_ID(N'dbo.RouteChoices', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.RouteChoices (
                    Id int NOT NULL IDENTITY(1,1) CONSTRAINT PK_RouteChoices PRIMARY KEY,
                    FromId nvarchar(80) NOT NULL,
                    ToId nvarchar(80) NOT NULL,
                    Via nvarchar(400) NOT NULL,
                    OccurredAtUtc datetime2 NOT NULL
                );
                CREATE INDEX IX_RouteChoices_FromId_ToId_OccurredAtUtc
                    ON dbo.RouteChoices (FromId, ToId, OccurredAtUtc DESC);
            END

            IF OBJECT_ID(N'dbo.StoreOrders', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.StoreOrders (
                    Id nvarchar(80) NOT NULL CONSTRAINT PK_StoreOrders PRIMARY KEY,
                    ProductId nvarchar(80) NOT NULL,
                    AmountPaise int NOT NULL,
                    Currency nvarchar(10) NOT NULL,
                    RazorpayOrderId nvarchar(80) NOT NULL,
                    RazorpayPaymentId nvarchar(80) NULL,
                    Status nvarchar(20) NOT NULL,
                    DownloadToken nvarchar(80) NULL,
                    BuyerEmail nvarchar(200) NULL,
                    CreatedAtUtc datetime2 NOT NULL,
                    PaidAtUtc datetime2 NULL
                );
                CREATE INDEX IX_StoreOrders_RazorpayOrderId ON dbo.StoreOrders (RazorpayOrderId);
                CREATE INDEX IX_StoreOrders_DownloadToken ON dbo.StoreOrders (DownloadToken);
            END

            IF OBJECT_ID(N'dbo.StoreBuyers', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.StoreBuyers (
                    Id nvarchar(80) NOT NULL CONSTRAINT PK_StoreBuyers PRIMARY KEY,
                    Name nvarchar(80) NOT NULL,
                    Email nvarchar(200) NULL,
                    Mobile nvarchar(20) NULL,
                    PasswordHash nvarchar(400) NOT NULL,
                    CreatedAtUtc datetime2 NOT NULL
                );
                CREATE UNIQUE INDEX IX_StoreBuyers_Email ON dbo.StoreBuyers (Email) WHERE Email IS NOT NULL;
                CREATE UNIQUE INDEX IX_StoreBuyers_Mobile ON dbo.StoreBuyers (Mobile) WHERE Mobile IS NOT NULL;
            END

            IF COL_LENGTH(N'dbo.StoreOrders', N'BuyerId') IS NULL
            BEGIN
                ALTER TABLE dbo.StoreOrders ADD BuyerId nvarchar(80) NULL;
                CREATE INDEX IX_StoreOrders_BuyerId ON dbo.StoreOrders (BuyerId);
            END

            IF OBJECT_ID(N'dbo.CatalogSuggestions', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.CatalogSuggestions (
                    Id int NOT NULL IDENTITY(1,1) CONSTRAINT PK_CatalogSuggestions PRIMARY KEY,
                    Slot nvarchar(20) NOT NULL,
                    Kind nvarchar(40) NOT NULL,
                    Title nvarchar(160) NOT NULL,
                    Notes nvarchar(500) NOT NULL,
                    FromId nvarchar(80) NOT NULL,
                    FromTitle nvarchar(160) NOT NULL,
                    CreatedAtUtc datetime2 NOT NULL
                );
                CREATE INDEX IX_CatalogSuggestions_CreatedAtUtc
                    ON dbo.CatalogSuggestions (CreatedAtUtc DESC);
            END

            IF OBJECT_ID(N'dbo.PathProfiles', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.PathProfiles (
                    BuyerId nvarchar(80) NOT NULL CONSTRAINT PK_PathProfiles PRIMARY KEY,
                    DisplayName nvarchar(80) NOT NULL,
                    Headline nvarchar(160) NOT NULL,
                    City nvarchar(80) NULL,
                    StandingNodeId nvarchar(80) NOT NULL,
                    GoalNodeId nvarchar(80) NOT NULL,
                    Audience nvarchar(20) NOT NULL,
                    Bio nvarchar(500) NOT NULL,
                    HelpOffersJson nvarchar(max) NOT NULL,
                    LookingForJson nvarchar(max) NOT NULL,
                    IsDiscoverable bit NOT NULL CONSTRAINT DF_PathProfiles_IsDiscoverable DEFAULT (1),
                    ShareEmail bit NOT NULL CONSTRAINT DF_PathProfiles_ShareEmail DEFAULT (0),
                    ShareMobile bit NOT NULL CONSTRAINT DF_PathProfiles_ShareMobile DEFAULT (1),
                    Under18 bit NOT NULL CONSTRAINT DF_PathProfiles_Under18 DEFAULT (0),
                    InviteCode nvarchar(32) NOT NULL,
                    CreatedAtUtc datetime2 NOT NULL,
                    UpdatedAtUtc datetime2 NOT NULL
                );
                CREATE INDEX IX_PathProfiles_GoalNodeId ON dbo.PathProfiles (GoalNodeId);
                CREATE INDEX IX_PathProfiles_Goal_Standing ON dbo.PathProfiles (GoalNodeId, StandingNodeId);
                CREATE UNIQUE INDEX IX_PathProfiles_InviteCode ON dbo.PathProfiles (InviteCode);
            END

            IF OBJECT_ID(N'dbo.PathConnectRequests', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.PathConnectRequests (
                    Id int NOT NULL IDENTITY(1,1) CONSTRAINT PK_PathConnectRequests PRIMARY KEY,
                    FromBuyerId nvarchar(80) NOT NULL,
                    ToBuyerId nvarchar(80) NOT NULL,
                    Status nvarchar(20) NOT NULL,
                    Note nvarchar(240) NULL,
                    CreatedAtUtc datetime2 NOT NULL,
                    ResolvedAtUtc datetime2 NULL
                );
                CREATE UNIQUE INDEX IX_PathConnectRequests_Pair ON dbo.PathConnectRequests (FromBuyerId, ToBuyerId);
                CREATE INDEX IX_PathConnectRequests_ToStatus ON dbo.PathConnectRequests (ToBuyerId, Status);
            END

            IF OBJECT_ID(N'dbo.PathCircleReports', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.PathCircleReports (
                    Id int NOT NULL IDENTITY(1,1) CONSTRAINT PK_PathCircleReports PRIMARY KEY,
                    ReporterBuyerId nvarchar(80) NOT NULL,
                    TargetBuyerId nvarchar(80) NOT NULL,
                    Reason nvarchar(400) NOT NULL,
                    CreatedAtUtc datetime2 NOT NULL
                );
                CREATE INDEX IX_PathCircleReports_CreatedAtUtc ON dbo.PathCircleReports (CreatedAtUtc DESC);
            END

            IF COL_LENGTH(N'dbo.StoreBuyers', N'CircleRole') IS NULL
            BEGIN
                ALTER TABLE dbo.StoreBuyers ADD CircleRole nvarchar(20) NOT NULL
                    CONSTRAINT DF_StoreBuyers_CircleRole DEFAULT (N'aspirant');
            END
            IF COL_LENGTH(N'dbo.StoreBuyers', N'StandingNodeId') IS NULL
            BEGIN
                ALTER TABLE dbo.StoreBuyers ADD StandingNodeId nvarchar(80) NULL;
            END
            IF COL_LENGTH(N'dbo.StoreBuyers', N'GoalNodeId') IS NULL
            BEGIN
                ALTER TABLE dbo.StoreBuyers ADD GoalNodeId nvarchar(80) NULL;
            END

            IF COL_LENGTH(N'dbo.PathProfiles', N'CircleRole') IS NULL
            BEGIN
                ALTER TABLE dbo.PathProfiles ADD CircleRole nvarchar(20) NOT NULL
                    CONSTRAINT DF_PathProfiles_CircleRole DEFAULT (N'aspirant');
            END

            IF OBJECT_ID(N'dbo.BuyerSubscriptions', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.BuyerSubscriptions (
                    Id nvarchar(80) NOT NULL CONSTRAINT PK_BuyerSubscriptions PRIMARY KEY,
                    BuyerId nvarchar(80) NOT NULL,
                    Status nvarchar(20) NOT NULL,
                    AmountPaise int NOT NULL,
                    Currency nvarchar(10) NOT NULL,
                    RazorpayOrderId nvarchar(80) NULL,
                    RazorpayPaymentId nvarchar(80) NULL,
                    PeriodStartUtc datetime2 NOT NULL,
                    PeriodEndUtc datetime2 NOT NULL,
                    CreatedAtUtc datetime2 NOT NULL
                );
                CREATE INDEX IX_BuyerSubscriptions_BuyerId ON dbo.BuyerSubscriptions (BuyerId);
                CREATE INDEX IX_BuyerSubscriptions_BuyerStatusEnd ON dbo.BuyerSubscriptions (BuyerId, Status, PeriodEndUtc);
            END

            IF OBJECT_ID(N'dbo.PathMessages', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.PathMessages (
                    Id int NOT NULL IDENTITY(1,1) CONSTRAINT PK_PathMessages PRIMARY KEY,
                    FromBuyerId nvarchar(80) NOT NULL,
                    ToBuyerId nvarchar(80) NOT NULL,
                    Body nvarchar(2000) NOT NULL,
                    CreatedAtUtc datetime2 NOT NULL,
                    ReadAtUtc datetime2 NULL
                );
                CREATE INDEX IX_PathMessages_Pair ON dbo.PathMessages (FromBuyerId, ToBuyerId, CreatedAtUtc);
                CREATE INDEX IX_PathMessages_ToFrom ON dbo.PathMessages (ToBuyerId, FromBuyerId, CreatedAtUtc);
            END
            """);
        await EnsureGuestVisitKeyAsync(db);
    }

    private static async Task EnsureGuestVisitKeyAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.GuestVisits', N'U') IS NOT NULL
               AND COL_LENGTH(N'dbo.GuestVisits', N'VisitorKey') IS NULL
            BEGIN
                ALTER TABLE dbo.GuestVisits ADD VisitorKey nvarchar(64) NOT NULL
                    CONSTRAINT DF_GuestVisits_VisitorKey DEFAULT (N'');
            END

            IF OBJECT_ID(N'dbo.GuestVisits', N'U') IS NOT NULL
               AND COL_LENGTH(N'dbo.GuestVisits', N'DayIst') IS NULL
            BEGIN
                ALTER TABLE dbo.GuestVisits ADD DayIst nvarchar(10) NOT NULL
                    CONSTRAINT DF_GuestVisits_DayIst DEFAULT (N'');
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.GuestVisits', N'U') IS NOT NULL
               AND COL_LENGTH(N'dbo.GuestVisits', N'VisitorKey') IS NOT NULL
               AND COL_LENGTH(N'dbo.GuestVisits', N'DayIst') IS NOT NULL
               AND NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = N'IX_GuestVisits_VisitorKey_DayIst'
                      AND object_id = OBJECT_ID(N'dbo.GuestVisits')
               )
            BEGIN
                CREATE UNIQUE INDEX IX_GuestVisits_VisitorKey_DayIst
                    ON dbo.GuestVisits (VisitorKey, DayIst)
                    WHERE VisitorKey <> N'';
            END
            """);
    }

    private static async Task SeedCatalogAsync(AppDbContext db, IWebHostEnvironment env, ILogger logger)
    {
        var path = ResolveCatalogPath(env);
        if (path is null)
        {
            throw new FileNotFoundException("Seed catalog was not found.", "Seed/catalog.json");
        }

        var json = await File.ReadAllTextAsync(path);
        var seed = JsonSerializer.Deserialize<SeedFile>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });
        if (seed is null || seed.Nodes.Count == 0)
        {
            throw new InvalidOperationException($"Seed catalog at '{path}' has no nodes.");
        }

        await RemovePreMetricLadderAsync(db, logger);

        var existing = await db.Nodes.ToListAsync();
        var have = existing.ToDictionary(n => n.Id, StringComparer.OrdinalIgnoreCase);
        var addedNodes = 0;
        var refreshed = 0;
        foreach (var node in seed.Nodes)
        {
            if (!have.TryGetValue(node.Id, out var rec))
            {
                var created = node.ToRecord();
                db.Nodes.Add(created);
                have[node.Id] = created;
                addedNodes++;
                continue;
            }

            var dirty = false;
            if (node.Institutes is { Count: > 0 })
            {
                var next = JsonSerializer.Serialize(node.Institutes);
                if (!string.Equals(rec.InstitutesJson, next, StringComparison.Ordinal))
                {
                    rec.InstitutesJson = next;
                    dirty = true;
                }
            }

            if (node.Certifications is { Count: > 0 })
            {
                var next = JsonSerializer.Serialize(node.Certifications);
                if (!string.Equals(rec.CertificationsJson, next, StringComparison.Ordinal))
                {
                    rec.CertificationsJson = next;
                    dirty = true;
                }
            }

            dirty |= TryAssign(node.CostGovt, rec.CostGovt, v => rec.CostGovt = v);
            dirty |= TryAssign(node.CostPvt, rec.CostPvt, v => rec.CostPvt = v);
            dirty |= TryAssign(node.SalaryHint, rec.SalaryHint, v => rec.SalaryHint = v);
            dirty |= TryAssign(node.EntryLevel, rec.EntryLevel, v => rec.EntryLevel = v);
            if (node.ExperienceYearsMin is int minYears && rec.ExperienceYearsMin != minYears)
            {
                rec.ExperienceYearsMin = minYears;
                dirty = true;
            }
            if (node.ExperienceYearsTypical is int typYears && rec.ExperienceYearsTypical != typYears)
            {
                rec.ExperienceYearsTypical = typYears;
                dirty = true;
            }
            if (node.FeederRoles is { Count: > 0 })
            {
                var next = JsonSerializer.Serialize(node.FeederRoles);
                if (!string.Equals(rec.FeederRolesJson, next, StringComparison.Ordinal))
                {
                    rec.FeederRolesJson = next;
                    dirty = true;
                }
            }
            if (dirty)
            {
                refreshed++;
            }
        }

        if (addedNodes > 0 || refreshed > 0)
        {
            await db.SaveChangesAsync();
        }

        var existingEdges = await db.Edges.Select(e => new { e.FromId, e.ToId }).ToListAsync();
        var edgeHave = existingEdges
            .Select(e => $"{e.FromId}->{e.ToId}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var addedEdges = 0;
        foreach (var e in seed.Edges)
        {
            var key = $"{e.From}->{e.To}";
            if (edgeHave.Contains(key) || !have.ContainsKey(e.From) || !have.ContainsKey(e.To))
            {
                continue;
            }

            db.Edges.Add(new CareerEdgeRecord
            {
                FromId = e.From,
                ToId = e.To,
                Via = e.Via,
                Notes = e.Notes
            });
            edgeHave.Add(key);
            addedEdges++;
        }

        if (addedEdges > 0)
        {
            await db.SaveChangesAsync();
        }

        logger.LogInformation(
            "Catalog seed from {Path}: {SeedNodes} nodes and {SeedEdges} edges in file; inserted {AddedNodes} nodes and {AddedEdges} edges; refreshed money, institutes, certifications, or experience on {Refreshed} nodes.",
            path,
            seed.Nodes.Count,
            seed.Edges.Count,
            addedNodes,
            addedEdges,
            refreshed);
    }

    /// <summary>
    /// Nursery–Class 9 were a trial start ladder. They confuse the Class 10 picker, so drop them and their hops.
    /// </summary>
    private static async Task RemovePreMetricLadderAsync(AppDbContext db, ILogger logger)
    {
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "nursery", "lkg", "ukg",
            "class-1", "class-2", "class-3", "class-4", "class-5",
            "class-6", "class-7", "class-8", "class-9",
        };

        var edges = await db.Edges.Where(e => ids.Contains(e.FromId) || ids.Contains(e.ToId)).ToListAsync();
        var interest = await db.NodeInterest.Where(n => ids.Contains(n.NodeId)).ToListAsync();
        var routes = await db.RouteChoices.Where(r => ids.Contains(r.FromId) || ids.Contains(r.ToId)).ToListAsync();
        var suggestions = await db.CatalogSuggestions.Where(s => ids.Contains(s.FromId)).ToListAsync();
        var nodes = await db.Nodes.Where(n => ids.Contains(n.Id)).ToListAsync();
        if (edges.Count == 0 && interest.Count == 0 && routes.Count == 0 && suggestions.Count == 0 && nodes.Count == 0)
        {
            return;
        }

        db.Edges.RemoveRange(edges);
        db.NodeInterest.RemoveRange(interest);
        db.RouteChoices.RemoveRange(routes);
        db.CatalogSuggestions.RemoveRange(suggestions);
        db.Nodes.RemoveRange(nodes);
        await db.SaveChangesAsync();
        logger.LogInformation(
            "Removed pre-Class-10 ladder: {Nodes} nodes, {Edges} edges.",
            nodes.Count,
            edges.Count);
    }

    private static string? ResolveCatalogPath(IWebHostEnvironment env)
    {
        var candidates = new[]
        {
            Path.Combine(env.ContentRootPath, "Seed", "catalog.json"),
            Path.Combine(AppContext.BaseDirectory, "Seed", "catalog.json")
        };
        return candidates.FirstOrDefault(File.Exists);
    }

    private static bool TryAssign(string? next, string? current, Action<string?> set)
    {
        var value = string.IsNullOrWhiteSpace(next) ? null : next.Trim();
        if (string.Equals(current, value, StringComparison.Ordinal))
        {
            return false;
        }

        set(value);
        return true;
    }
}
