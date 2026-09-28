namespace enjoapi.Models;

public class AzotluCapakAlmaRequest
{
    public double BirimNetAgirlik { get; set; }
    public double AzotKgFiyatiTl { get; set; }
    public double IslemBasinaHarcananAzotGram { get; set; }
    public double TezgahSogumaSuresi { get; set; }
    public double MakineIslemSuresi { get; set; }
    public double YuklemeBosaltmaSuresi { get; set; }
    public double BaskiToplamBrutAgirlik { get; set; }
    public double IslemGorenUrunAgirligiToplamGram { get; set; }
    public double IsciKatsayisi { get; set; }
    public double IsciSayisi { get; set; }
    public double OperatorUcreti { get; set; }
    public double ElektrikUcreti { get; set; }
    public double KwDegeri { get; set; }
    public double FaydaliOmurYil { get; set; }
    public double MakineBedeliEuro { get; set; }
    public double YillikBakimBedeli { get; set; }
    public double BaskiCevrimSuresi { get; set; }
    public double EuroKuru { get; set; }
    public int KalipGozSayisi { get; set; }
    public double TasKgSaniye { get; set; }
    public double Tas1KgFiyatiEuro { get; set; }
    public double? IslemGorenUrunAdedi { get; set; }
    public int? SatisKaydiId { get; set; }
}


