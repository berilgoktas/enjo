namespace enjoapi.Models;

public class AdminVarsayilanDegerler
{
    public int Id { get; set; }
    public decimal EuroKuru { get; set; } // Sadece okuma için - TCMB'den otomatik gelir
    public decimal OperatorUcreti { get; set; }
    public decimal ElektrikUcreti { get; set; }
    public decimal KwDegeri { get; set; }
    public int FaydaliOmurYil { get; set; }
    public decimal MakineBedeliEuro { get; set; }
    public decimal YillikBakimMaliyeti { get; set; }
    public decimal KalipBakimUcreti { get; set; }
    public DateTime GuncellemeTarihi { get; set; }
}

// Admin tarafından güncellenebilir değerler (EuroKuru hariç)
public class AdminGuncellenebilirDegerler
{
    public decimal? OperatorUcreti { get; set; }
    public decimal? ElektrikUcreti { get; set; }
    public decimal? KwDegeri { get; set; }
    public int? FaydaliOmurYil { get; set; }
    public decimal? MakineBedeliEuro { get; set; }
    public decimal? YillikBakimMaliyeti { get; set; }
    public decimal? KalipBakimUcreti { get; set; }
}

// Azotlu çapak alma için özel varsayılan değerler
public class AzotluCapakAlmaVarsayilanDegerler
{
    public int Id { get; set; }
    public decimal YillikBakimBedeli { get; set; }
    public decimal IslemBasinaHarcananAzotGram { get; set; }
    public decimal TasKgSaniye { get; set; }
    public decimal Tas1KgFiyatiEuro { get; set; }
    public decimal AzotKgFiyatiTl { get; set; }
    public decimal KwDegeri { get; set; }
    public decimal MakineBedeliEuro { get; set; }
    public int FaydaliOmurYil { get; set; }
    public DateTime GuncellemeTarihi { get; set; }
}

// Admin tarafından güncellenebilir değerler
public class AzotluCapakAlmaGuncellenebilirDegerler
{
    public decimal? YillikBakimBedeli { get; set; }
    public decimal? IslemBasinaHarcananAzotGram { get; set; }
    public decimal? TasKgSaniye { get; set; }
    public decimal? Tas1KgFiyatiEuro { get; set; }
    public decimal? AzotKgFiyatiTl { get; set; }
    public decimal? KwDegeri { get; set; }
    public decimal? MakineBedeliEuro { get; set; }
    public int? FaydaliOmurYil { get; set; }
}
