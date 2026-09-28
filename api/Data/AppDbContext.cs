using Microsoft.EntityFrameworkCore;
using AgamiPatha.Api.Models;

namespace AgamiPatha.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<CareerNodeRecord> Nodes => Set<CareerNodeRecord>();
    public DbSet<CareerEdgeRecord> Edges => Set<CareerEdgeRecord>();
    public DbSet<SiteStatsRecord> SiteStats => Set<SiteStatsRecord>();
    public DbSet<GuestVisitRecord> GuestVisits => Set<GuestVisitRecord>();
    public DbSet<SearchVisitRecord> SearchVisits => Set<SearchVisitRecord>();
    public DbSet<NodeInterestRecord> NodeInterest => Set<NodeInterestRecord>();
    public DbSet<RouteChoiceRecord> RouteChoices => Set<RouteChoiceRecord>();
    public DbSet<StoreOrderRecord> StoreOrders => Set<StoreOrderRecord>();
    public DbSet<StoreBuyerRecord> StoreBuyers => Set<StoreBuyerRecord>();
    public DbSet<CatalogSuggestionRecord> CatalogSuggestions => Set<CatalogSuggestionRecord>();
    public DbSet<PathProfileRecord> PathProfiles => Set<PathProfileRecord>();
    public DbSet<PathConnectRequestRecord> PathConnectRequests => Set<PathConnectRequestRecord>();
    public DbSet<PathCircleReportRecord> PathCircleReports => Set<PathCircleReportRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CareerNodeRecord>(entity =>
        {
            entity.ToTable("Nodes");
            entity.HasKey(n => n.Id);
        });

        modelBuilder.Entity<CareerEdgeRecord>(entity =>
        {
            entity.ToTable("Edges");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.FromId, e.ToId }).IsUnique();
        });

        modelBuilder.Entity<SiteStatsRecord>(entity =>
        {
            entity.ToTable("SiteStats");
            entity.HasKey(s => s.Id);
            entity.HasData(new SiteStatsRecord
            {
                Id = 1,
                SearchCount = 0,
                GuestVisitCount = 0
            });
        });

        modelBuilder.Entity<GuestVisitRecord>(entity =>
        {
            entity.ToTable("GuestVisits");
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => new { v.VisitorKey, v.DayIst })
                .IsUnique()
                .HasFilter("[VisitorKey] <> ''");
        });

        modelBuilder.Entity<SearchVisitRecord>(entity =>
        {
            entity.ToTable("SearchVisits");
            entity.HasKey(v => v.Id);
        });

        modelBuilder.Entity<NodeInterestRecord>(entity =>
        {
            entity.ToTable("NodeInterest");
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => new { v.NodeId, v.OccurredAtUtc });
        });

        modelBuilder.Entity<RouteChoiceRecord>(entity =>
        {
            entity.ToTable("RouteChoices");
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => new { v.FromId, v.ToId, v.OccurredAtUtc });
        });

        modelBuilder.Entity<StoreBuyerRecord>(entity =>
        {
            entity.ToTable("StoreBuyers");
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => v.Email).IsUnique().HasFilter("[Email] IS NOT NULL");
            entity.HasIndex(v => v.Mobile).IsUnique().HasFilter("[Mobile] IS NOT NULL");
        });

        modelBuilder.Entity<StoreOrderRecord>(entity =>
        {
            entity.ToTable("StoreOrders");
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => v.RazorpayOrderId);
            entity.HasIndex(v => v.DownloadToken);
            entity.HasIndex(v => v.BuyerId);
        });

        modelBuilder.Entity<CatalogSuggestionRecord>(entity =>
        {
            entity.ToTable("CatalogSuggestions");
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => v.CreatedAtUtc);
        });

        modelBuilder.Entity<PathProfileRecord>(entity =>
        {
            entity.ToTable("PathProfiles");
            entity.HasKey(v => v.BuyerId);
            entity.HasIndex(v => v.GoalNodeId);
            entity.HasIndex(v => new { v.GoalNodeId, v.StandingNodeId });
            entity.HasIndex(v => v.InviteCode).IsUnique();
        });

        modelBuilder.Entity<PathConnectRequestRecord>(entity =>
        {
            entity.ToTable("PathConnectRequests");
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => new { v.FromBuyerId, v.ToBuyerId }).IsUnique();
            entity.HasIndex(v => new { v.ToBuyerId, v.Status });
        });

        modelBuilder.Entity<PathCircleReportRecord>(entity =>
        {
            entity.ToTable("PathCircleReports");
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => v.CreatedAtUtc);
        });
    }
}
