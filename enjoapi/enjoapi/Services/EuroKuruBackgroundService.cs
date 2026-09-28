using Microsoft.Data.SqlClient;

namespace enjoapi.Services;

public class EuroKuruBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<EuroKuruBackgroundService> _logger;

    public EuroKuruBackgroundService(IServiceProvider serviceProvider, ILogger<EuroKuruBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var tcmbService = scope.ServiceProvider.GetRequiredService<TCMBService>();
                var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
                
                var euroKuru = await tcmbService.GetEuroKuruAsync();
                if (euroKuru.HasValue)
                {
                    await GuncelleEuroKuruAsync(euroKuru.Value, configuration);
                }
                
                // 12 saatte bir çalıştır (günde 2 kez)
                await Task.Delay(TimeSpan.FromHours(12), stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Euro kuru güncelleme sırasında hata oluştu");
                // Hata durumunda 1 saat bekle
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }
    }

    private async Task GuncelleEuroKuruAsync(decimal euroKuru, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default");
        if (string.IsNullOrEmpty(connectionString))
        {
            _logger.LogError("Connection string bulunamadı");
            return;
        }

        const int maxRetries = 3;
        const int delayMs = 2000;
        
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                using var con = new SqlConnection(connectionString);
                using var cmd = con.CreateCommand();
                
                cmd.CommandTimeout = 30;
                cmd.CommandText = @"
                    UPDATE dbo.AdminVarsayilanDegerler 
                    SET EuroKuru = @EuroKuru, GuncellemeTarihi = GETDATE()
                    WHERE Id = (SELECT TOP 1 Id FROM dbo.AdminVarsayilanDegerler ORDER BY GuncellemeTarihi DESC)";
                
                cmd.Parameters.AddWithValue("@EuroKuru", euroKuru);
                
                await con.OpenAsync();
                var affected = await cmd.ExecuteNonQueryAsync();
                
                if (affected > 0)
                {
                    _logger.LogInformation("Euro kuru güncellendi: {EuroKuru}", euroKuru);
                    return;
                }
                else
                {
                    _logger.LogWarning("Euro kuru güncellenemedi - kayıt bulunamadı");
                    return;
                }
            }
            catch (SqlException sqlEx) when (attempt < maxRetries)
            {
                _logger.LogWarning(sqlEx, "Veritabanı bağlantı hatası (Deneme {Attempt}/{MaxRetries}), {DelayMs}ms sonra tekrar denenecek", 
                    attempt, maxRetries, delayMs);
                await Task.Delay(delayMs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Euro kuru güncelleme hatası (Deneme {Attempt}/{MaxRetries})", attempt, maxRetries);
                if (attempt == maxRetries)
                {
                    throw;
                }
                await Task.Delay(delayMs);
            }
        }
    }
}
