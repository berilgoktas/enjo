using System.Text.Json;

namespace enjoapi.Services;

public class TCMBService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<TCMBService> _logger;

    public TCMBService(HttpClient httpClient, ILogger<TCMBService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<decimal?> GetEuroKuruAsync()
    {
        try
        {
            // TCMB XML API'si
            var url = "https://www.tcmb.gov.tr/kurlar/today.xml";
            var response = await _httpClient.GetStringAsync(url);
            
            // XML'den Euro kuru çek (USD/EUR = 1.0 olduğu için EUR/TRY'yi alıyoruz)
            var doc = new System.Xml.XmlDocument();
            doc.LoadXml(response);
            
            var euroNode = doc.SelectSingleNode("//Currency[@CurrencyCode='EUR']/BanknoteSelling");
            if (euroNode != null)
            {
                var euroText = euroNode.InnerText.Trim();
                // TCMB formatı: nokta ile (örn: "50.1266") veya noktasız (örn: "501266")
                // InvariantCulture ile parse et (nokta ondalık ayırıcı olarak)
                if (decimal.TryParse(euroText, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out decimal euroKuru))
                {
                    // Eğer değer 1000'den büyükse (örn: 501266), 10000'e böl (50.1266 olur)
                    if (euroKuru > 1000)
                    {
                        euroKuru = euroKuru / 10000;
                    }
                    
                    _logger.LogInformation("TCMB'den Euro kuru çekildi: {EuroKuru}", euroKuru);
                    return euroKuru;
                }
            }
            
            _logger.LogWarning("TCMB'den Euro kuru çekilemedi");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TCMB API'sinden Euro kuru çekilirken hata oluştu");
            return null;
        }
    }
}
