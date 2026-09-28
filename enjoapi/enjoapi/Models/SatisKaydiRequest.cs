namespace enjoapi.Models;

public class SatisDegerler
{
	public decimal MalzemeMaliyeti { get; set; }
	public decimal IscilikMaliyeti { get; set; }
	public decimal ElektrikMaliyeti { get; set; }
	public decimal AmortismanMaliyeti { get; set; }
	public decimal MakineBakimMaliyeti { get; set; }
	public decimal KalipMaliyeti { get; set; }
	public decimal ToplamMaliyet { get; set; }
}

public class SatisKaydiRequest
{
	public string Ad { get; set; } = string.Empty;
	public SatisDegerler Degerler { get; set; } = new();
	public object? Formlar { get; set; }
    public int? EnjeksiyonId { get; set; }
    public int? AzotluCapakAlmaId { get; set; }
    public int? PosturlemeId { get; set; }
    public int? SantrifujId { get; set; }
    public int? YikamaId { get; set; }
}
