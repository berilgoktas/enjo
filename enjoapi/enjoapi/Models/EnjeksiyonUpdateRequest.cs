namespace enjoapi.Models;

public class EnjeksiyonUpdateRequest
{
	public double? BaskiToplamBrut { get; set; }
	public double? KalipGozSayisi { get; set; }
	public double? HammaddeFiyatiEuro { get; set; }
	public double? EuroKuru { get; set; }
	public double? BaskiCevrimSuresi { get; set; }
	public double? IsciKatsayisi { get; set; }
	public double? IsciSayisi { get; set; }
	public double? OperatorUcreti { get; set; }
	public double? ElektrikUcreti { get; set; }
	public double? KwDegeri { get; set; }
	public double? FaydaliOmurYil { get; set; }
	public double? MakineBedeliEuro { get; set; }
	public double? YillikBakimMaliyeti { get; set; }
	public double? KalipBakimUcreti { get; set; }
	public string? KalipKontrolu { get; set; }
	public double? KalipBedeli { get; set; }
	public double? Adet { get; set; }
	public string? HammaddeTuru { get; set; }
	public string? HammaddeTedarikcisi { get; set; }
	public string? KalipTedarikcisi { get; set; }
}
