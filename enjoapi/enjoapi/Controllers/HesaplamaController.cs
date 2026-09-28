using enjoapi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Text.Json;
using System.Collections.Generic;

namespace enjoapi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HesaplamaController : ControllerBase
{
    private readonly string _cs;
    private readonly IHttpClientFactory _httpClientFactory;

    public HesaplamaController(IConfiguration config, IHttpClientFactory httpClientFactory)
    {
        _cs = config.GetConnectionString("Default")!;
        _httpClientFactory = httpClientFactory;
    }

    private static int? FindStepId(JsonElement root, string stepKey)
    {
        try
        {
            var synonyms = GetStepSynonyms(stepKey);
            int? found = FindStepIdDeep(root, synonyms);
            return found;
        }
        catch { }
        return null;
    }

    private static int? FindStepIdDeep(JsonElement element, HashSet<string> synonyms)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in element.EnumerateObject())
            {
                // Önce bu seviyede eşleşen step adı var mı?
                if (synonyms.Contains(prop.Name))
                {
                    var val = prop.Value;
                    if (val.ValueKind == JsonValueKind.Object)
                    {
                        if (val.TryGetProperty("id", out var idEl) || val.TryGetProperty("Id", out idEl))
                        {
                            if (idEl.ValueKind == JsonValueKind.Number && idEl.TryGetInt32(out var idNum)) return idNum;
                            if (idEl.ValueKind == JsonValueKind.String && int.TryParse(idEl.GetString(), out var idStr)) return idStr;
                        }
                    }
                }

                // Derin arama
                var child = prop.Value;
                if (child.ValueKind == JsonValueKind.Object || child.ValueKind == JsonValueKind.Array)
                {
                    var r = FindStepIdDeep(child, synonyms);
                    if (r.HasValue) return r;
                }
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                var r = FindStepIdDeep(item, synonyms);
                if (r.HasValue) return r;
            }
        }
        return null;
    }

    private static HashSet<string> GetStepSynonyms(string stepKey)
    {
        // Anahtar adlarını frontend çeşitlerine göre esnek eşleştir
        switch (stepKey)
        {
            case "Enjeksiyon":
                return new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "Enjeksiyon", "enjeksiyon" };
            case "AzotluCapakAlma":
                return new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "AzotluCapakAlma", "azotluCapakAlma", "azotlucapakalma", "azotlu" };
            case "Posturleme":
                return new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "Posturleme", "posturleme" };
            case "Santrifuj":
                return new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "Santrifuj", "santrifuj" };
            case "Yikama":
                return new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "Yikama", "yikama" };
            default:
                return new HashSet<string>(StringComparer.OrdinalIgnoreCase) { stepKey };
        }
    }


    [HttpPost("enjeksiyon")]
    public ActionResult<object> Enjeksiyon([FromBody] Hesaplama1Request req)
    {
        if (req.KalipGozSayisi <= 0)
        {
            return BadRequest("Kalıp göz sayısı 0 veya negatif olamaz.");
        }
        if (req.Adet <= 0)
        {
            return BadRequest("Adet 0 veya negatif olamaz.");
        }


        double birimBrutAgirlik = req.BaskiToplamBrut / req.KalipGozSayisi;

        double kalip1Saniye = 9 * 250 * 3600; // 9 yıl × 250 gün/yıl × 3600 sn/saat

        // operator saniyelik ücret
        double operatorSaniyelikUcret = req.OperatorUcreti / 225 / 3600;

        // baz işçilik maliyeti
        double bazIscilikMaliyeti = req.BaskiCevrimSuresi * operatorSaniyelikUcret / req.EuroKuru / req.KalipGozSayisi;

        // toplam işçilik maliyeti
        double toplamIscilikMaliyeti = req.IsciKatsayisi * req.IsciSayisi * bazIscilikMaliyeti;

        // malzeme maliyeti (kg başına fiyat, gram ağırlık/1000)
        double malzemeMaliyeti = birimBrutAgirlik * req.HammaddeFiyatiEuro / 1000.0;
        // toplam hammadde maliyeti (malzeme maliyeti x adet)
        double toplamHammaddeMaliyeti = malzemeMaliyeti * req.Adet;

        // elektrik maliyeti
        double elektrikSaniye = req.ElektrikUcreti / 3600.0;
        double elektrikMaliyeti = (((req.BaskiCevrimSuresi * elektrikSaniye) / req.EuroKuru) / req.KalipGozSayisi) * req.KwDegeri;

        // amortisman
        double faydaliOmurSaniye = req.FaydaliOmurYil * 2250 * 3600; // 225 gün/yıl varsayımı
        double amortismanMaliyeti = req.BaskiCevrimSuresi / faydaliOmurSaniye * req.MakineBedeliEuro / req.KalipGozSayisi;

        // makine bakım maliyeti
        double makineBakimMaliyeti = req.BaskiCevrimSuresi / kalip1Saniye * req.YillikBakimMaliyeti / req.KalipGozSayisi;

        // kalıp bakım maliyeti
        double kalipMaliyeti = req.KalipBakimUcreti / kalip1Saniye * req.BaskiCevrimSuresi / req.KalipGozSayisi;

        // kalıp bedeli opsiyonel ekleme
        double kalipBedeliPay = 0;
        if (string.Equals(req.KalipKontrolu, "var", StringComparison.OrdinalIgnoreCase))
        {
            kalipBedeliPay = req.KalipBedeli / req.Adet;
        }

        double toplamMaliyet = malzemeMaliyeti + toplamIscilikMaliyeti + elektrikMaliyeti + amortismanMaliyeti + makineBakimMaliyeti + kalipMaliyeti + kalipBedeliPay;

        // Birim hammadde maliyeti hesaplama
        double birimHammaddeMaliyeti = birimBrutAgirlik * req.HammaddeFiyatiEuro;

        using (var con = new SqlConnection(_cs))
        using (var cmd = con.CreateCommand())
        {
            cmd.CommandText = @"INSERT INTO dbo.Enjeksiyon (
                BaskiToplamBrut, KalipGozSayisi, HammaddeFiyatiEuro, EuroKuru, BaskiCevrimSuresi,
                IsciKatsayisi, IsciSayisi, OperatorUcreti, ElektrikUcreti, KwDegeri,
                FaydaliOmurYil, MakineBedeliEuro, YillikBakimMaliyeti, KalipBakimUcreti,
                KalipKontrolu, KalipBedeli, Adet, HammaddeTuru, HammaddeTedarikcisi, KalipTedarikcisi,
                MalzemeMaliyetiEuro, ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro,
                MakineBakimMaliyetiEuro, KalipMaliyetiEuro, KalipBedeliPayEuro, ToplamMaliyetEuro, ToplamHammaddeMaliyetiEuro, 
                BirimBrutAgirlik, BirimHammaddeMaliyetiEuro
            ) VALUES (
                @BaskiToplamBrut, @KalipGozSayisi, @HammaddeFiyatiEuro, @EuroKuru, @BaskiCevrimSuresi,
                @IsciKatsayisi, @IsciSayisi, @OperatorUcreti, @ElektrikUcreti, @KwDegeri,
                @FaydaliOmurYil, @MakineBedeliEuro, @YillikBakimMaliyeti, @KalipBakimUcreti,
                @KalipKontrolu, @KalipBedeli, @Adet, @HammaddeTuru, @HammaddeTedarikcisi, @KalipTedarikcisi,
                @MalzemeMaliyetiEuro, @ToplamIscilikMaliyetiEuro, @ElektrikMaliyetiEuro, @AmortismanMaliyetiEuro,
                @MakineBakimMaliyetiEuro, @KalipMaliyetiEuro, @KalipBedeliPayEuro, @ToplamMaliyetEuro, @ToplamHammaddeMaliyetiEuro, 
                @BirimBrutAgirlik, @BirimHammaddeMaliyetiEuro
            ); SELECT CAST(SCOPE_IDENTITY() AS int);";
            cmd.Parameters.AddWithValue("@BaskiToplamBrut", req.BaskiToplamBrut);
            cmd.Parameters.AddWithValue("@KalipGozSayisi", req.KalipGozSayisi);
            cmd.Parameters.AddWithValue("@HammaddeFiyatiEuro", req.HammaddeFiyatiEuro);
            cmd.Parameters.AddWithValue("@EuroKuru", req.EuroKuru);
            cmd.Parameters.AddWithValue("@BaskiCevrimSuresi", req.BaskiCevrimSuresi);
            cmd.Parameters.AddWithValue("@IsciKatsayisi", req.IsciKatsayisi);
            cmd.Parameters.AddWithValue("@IsciSayisi", req.IsciSayisi);
            cmd.Parameters.AddWithValue("@OperatorUcreti", req.OperatorUcreti);
            cmd.Parameters.AddWithValue("@ElektrikUcreti", req.ElektrikUcreti);
            cmd.Parameters.AddWithValue("@KwDegeri", req.KwDegeri);
            cmd.Parameters.AddWithValue("@FaydaliOmurYil", req.FaydaliOmurYil);
            cmd.Parameters.AddWithValue("@MakineBedeliEuro", req.MakineBedeliEuro);
            cmd.Parameters.AddWithValue("@YillikBakimMaliyeti", req.YillikBakimMaliyeti);
            cmd.Parameters.AddWithValue("@KalipBakimUcreti", req.KalipBakimUcreti);
            cmd.Parameters.AddWithValue("@KalipKontrolu", (object?)req.KalipKontrolu ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@KalipBedeli", req.KalipBedeli);
            cmd.Parameters.AddWithValue("@Adet", req.Adet);
            cmd.Parameters.AddWithValue("@HammaddeTuru", (object?)req.HammaddeTuru ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@HammaddeTedarikcisi", (object?)req.HammaddeTedarikcisi ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@KalipTedarikcisi", (object?)req.KalipTedarikcisi ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@MalzemeMaliyetiEuro", malzemeMaliyeti);
            cmd.Parameters.AddWithValue("@ToplamIscilikMaliyetiEuro", toplamIscilikMaliyeti);
            cmd.Parameters.AddWithValue("@ElektrikMaliyetiEuro", elektrikMaliyeti);
            cmd.Parameters.AddWithValue("@AmortismanMaliyetiEuro", amortismanMaliyeti);
            cmd.Parameters.AddWithValue("@MakineBakimMaliyetiEuro", makineBakimMaliyeti);
            cmd.Parameters.AddWithValue("@KalipMaliyetiEuro", kalipMaliyeti);
            cmd.Parameters.AddWithValue("@KalipBedeliPayEuro", kalipBedeliPay);
            cmd.Parameters.AddWithValue("@ToplamMaliyetEuro", toplamMaliyet);
            cmd.Parameters.AddWithValue("@ToplamHammaddeMaliyetiEuro", toplamHammaddeMaliyeti);
            cmd.Parameters.AddWithValue("@BirimBrutAgirlik", birimBrutAgirlik);
            cmd.Parameters.AddWithValue("@BirimHammaddeMaliyetiEuro", birimHammaddeMaliyeti);
            con.Open();
            var newId = (int)cmd.ExecuteScalar();
            return Ok(new { id = newId, toplamMaliyet, birimBrutAgirlik, birimHammaddeMaliyeti });
        }
    }

    [HttpPut("yikama/{id:int}")]
    public async Task<ActionResult<double>> GuncelleYikama(int id, [FromBody] YikamaUpdateRequest req)
    {
        // Mevcut kaydı oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = "SELECT TOP 1 * FROM dbo.Yikama WHERE Id=@id";
        cmd0.Parameters.AddWithValue("@id", id);
        await con0.OpenAsync();
        using var rd = await cmd0.ExecuteReaderAsync();
        if (!await rd.ReadAsync()) return NotFound();

        // Mevcut değerlerden başla, sadece gönderilenleri güncelle
        double BaskiToplamBrut = req.BaskiToplamBrut ?? Convert.ToDouble(rd["BaskiToplamBrutAgirlik"]);
        double KalipGozSayisi = req.KalipGozSayisi ?? Convert.ToDouble(rd["KalipGozSayisi"]);
        double DeterjanFiyatiEuro = req.DeterjanFiyatiEuro ?? Convert.ToDouble(rd["DeterjanSaatlikFiyatEuro"]);
        double DeterjanMiktari = req.DeterjanMiktari ?? Convert.ToDouble(rd["FullKapasiteOperasyonSuresiSn"]);
        double BaskiCevrimSuresi = req.BaskiCevrimSuresi ?? Convert.ToDouble(rd["FullKapasiteOperasyonSuresiSn"]);
        double IsciKatsayisi = req.IsciKatsayisi ?? Convert.ToDouble(rd["IsciKatsayisi"]);
        double IsciSayisi = req.IsciSayisi ?? Convert.ToDouble(rd["IsciSayisi"]);
        double OperatorUcreti = req.OperatorUcreti ?? Convert.ToDouble(rd["OperatorUcreti"]);
        double ElektrikUcreti = req.ElektrikUcreti ?? Convert.ToDouble(rd["ElektrikUcreti"]);
        double KwDegeri = req.KwDegeri ?? Convert.ToDouble(rd["KwDegeri"]);
        double FaydaliOmurYil = req.FaydaliOmurYil ?? Convert.ToDouble(rd["FaydaliOmurYil"]);
        double MakineBedeliEuro = req.MakineBedeliEuro ?? Convert.ToDouble(rd["MakineBedeliEuro"]);
        double YillikBakimMaliyeti = req.YillikBakimMaliyeti ?? Convert.ToDouble(rd["YillikBakimBedeli"]);
        
        // Diğer sabit değerler
        double EuroKuru = Convert.ToDouble(rd["EuroKuru"]);
        double IdealKg = Convert.ToDouble(rd["IdealKg"]);

        // Validasyon
        if (KalipGozSayisi <= 0) return BadRequest("Kalıp göz sayısı 0 veya negatif olamaz.");
        if (IdealKg <= 0) return BadRequest("İdeal kg değeri 0 veya negatif olamaz.");
        if (EuroKuru <= 0) return BadRequest("Euro kuru 0 veya negatif olamaz.");

        // Hesaplamalar
        double kalip1Saniye = 9 * 250 * 3600;
        double birimBrutAgirlik = BaskiToplamBrut / KalipGozSayisi;
        double yikamaSnKg = BaskiCevrimSuresi / IdealKg;
        double saniyeDetayi = yikamaSnKg * birimBrutAgirlik / 1000.0;
        double malzemeMaliyeti = saniyeDetayi * DeterjanFiyatiEuro / 3600.0;
        double operatorSaniyelikUcret = OperatorUcreti / 225.0 / 3600.0;
        double bazIscilikMaliyeti = operatorSaniyelikUcret * saniyeDetayi / EuroKuru;
        double iscilikMaliyeti = IsciKatsayisi * IsciSayisi * bazIscilikMaliyeti;
        double elektrikSaniye = ElektrikUcreti / 3600.0;
        double elektrikMaliyeti = saniyeDetayi * elektrikSaniye / EuroKuru * KwDegeri;
        double faydaliOmurSaniye = FaydaliOmurYil * 9 * 250 * 3600;
        double amortismanMaliyeti = saniyeDetayi / faydaliOmurSaniye * MakineBedeliEuro;
        double makineBakimMaliyeti = saniyeDetayi / kalip1Saniye * YillikBakimMaliyeti;
        double toplamMaliyet = malzemeMaliyeti + iscilikMaliyeti + elektrikMaliyeti + amortismanMaliyeti + makineBakimMaliyeti;

        if (double.IsNaN(toplamMaliyet) || double.IsInfinity(toplamMaliyet))
            return BadRequest("Hesaplama sonucu geçersiz değer.");

        decimal dToplam = (decimal)toplamMaliyet;
        decimal dMalzeme = (decimal)Math.Round(malzemeMaliyeti, 11, MidpointRounding.AwayFromZero);
        decimal dIscilik = (decimal)iscilikMaliyeti;
        decimal dElektrik = (decimal)elektrikMaliyeti;
        decimal dAmortisman = (decimal)amortismanMaliyeti;
        decimal dMakineBakim = (decimal)makineBakimMaliyeti;

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();

        
        cmd.CommandText = @"UPDATE dbo.Yikama SET
            EuroKuru=@EuroKuru, KwDegeri=@KwDegeri, FullKapasiteOperasyonSuresiSn=@FullKapasiteOperasyonSuresiSn, IdealKg=@IdealKg, BaskiToplamBrutAgirlik=@BaskiToplamBrutAgirlik, KalipGozSayisi=@KalipGozSayisi,
            ElektrikUcreti=@ElektrikUcreti, OperatorUcreti=@OperatorUcreti, IsciKatsayisi=@IsciKatsayisi, IsciSayisi=@IsciSayisi, MakineBedeliEuro=@MakineBedeliEuro, FaydaliOmurYil=@FaydaliOmurYil, YillikBakimBedeli=@YillikBakimBedeli, DeterjanSaatlikFiyatEuro=@DeterjanSaatlikFiyatEuro,
            ElektrikMaliyetiEuro=@ElektrikMaliyetiEuro, ToplamIscilikMaliyetiEuro=@ToplamIscilikMaliyetiEuro, AmortismanMaliyetiEuro=@AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro=@MakineBakimMaliyetiEuro, DeterjanMaliyetiEuro=@DeterjanMaliyetiEuro, ToplamMaliyetEuro=@ToplamMaliyetEuro, BirimBrutAgirlik=@BirimBrutAgirlik
            WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@EuroKuru", EuroKuru);
        cmd.Parameters.AddWithValue("@KwDegeri", KwDegeri);
        cmd.Parameters.AddWithValue("@FullKapasiteOperasyonSuresiSn", BaskiCevrimSuresi);
        cmd.Parameters.AddWithValue("@IdealKg", IdealKg);
        cmd.Parameters.AddWithValue("@BaskiToplamBrutAgirlik", BaskiToplamBrut);
        cmd.Parameters.AddWithValue("@KalipGozSayisi", KalipGozSayisi);
        cmd.Parameters.AddWithValue("@ElektrikUcreti", ElektrikUcreti);
        cmd.Parameters.AddWithValue("@OperatorUcreti", OperatorUcreti);
        cmd.Parameters.AddWithValue("@IsciKatsayisi", IsciKatsayisi);
        cmd.Parameters.AddWithValue("@IsciSayisi", IsciSayisi);
        cmd.Parameters.AddWithValue("@MakineBedeliEuro", MakineBedeliEuro);
        cmd.Parameters.AddWithValue("@FaydaliOmurYil", FaydaliOmurYil);
        cmd.Parameters.AddWithValue("@YillikBakimBedeli", YillikBakimMaliyeti);
        cmd.Parameters.AddWithValue("@DeterjanSaatlikFiyatEuro", DeterjanFiyatiEuro);
        cmd.Parameters.AddWithValue("@ElektrikMaliyetiEuro", dElektrik);
        cmd.Parameters.AddWithValue("@ToplamIscilikMaliyetiEuro", dIscilik);
        cmd.Parameters.AddWithValue("@AmortismanMaliyetiEuro", dAmortisman);
        cmd.Parameters.AddWithValue("@MakineBakimMaliyetiEuro", dMakineBakim);
        cmd.Parameters.AddWithValue("@DeterjanMaliyetiEuro", dMalzeme);
        cmd.Parameters.AddWithValue("@ToplamMaliyetEuro", dToplam);
        cmd.Parameters.AddWithValue("@BirimBrutAgirlik", birimBrutAgirlik);
        // Yikama adiminda BirimNetAgirlik kullanılmıyor; yanlışlıkla eklenmişti
        await con.OpenAsync();
        var affected = await cmd.ExecuteNonQueryAsync();
        if (affected == 0) return NotFound();
        
        // İlişkili satış kayıtlarını güncelle
        await GuncelleSatisKayitlariIliskiliAdimIcinAsync(yikamaId: id);
        
        return Ok(new { toplamMaliyet = (double)dToplam, birimBrutAgirlik });
    }
    [HttpPut("santrifuj/{id:int}")]
    public async Task<ActionResult<double>> GuncelleSantrifuj(int id, [FromBody] SantrifujUpdateRequest req)
    {
        // Mevcut kaydı oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = "SELECT TOP 1 * FROM dbo.Santrifuj WHERE Id=@id";
        cmd0.Parameters.AddWithValue("@id", id);
        await con0.OpenAsync();
        using var rd = await cmd0.ExecuteReaderAsync();
        if (!await rd.ReadAsync()) return NotFound();

        // Mevcut değerlerden başla, sadece gönderilenleri güncelle
        double BaskiToplamBrut = req.BaskiToplamBrut ?? Convert.ToDouble(rd["BaskiToplamBrutAgirlik"]);
        double KalipGozSayisi = req.KalipGozSayisi ?? Convert.ToDouble(rd["KalipGozSayisi"]);
        double BaskiCevrimSuresi = req.BaskiCevrimSuresi ?? Convert.ToDouble(rd["FullKapasiteOperasyonSuresiSn"]);
        double IsciKatsayisi = req.IsciKatsayisi ?? Convert.ToDouble(rd["IsciKatsayisi"]);
        double IsciSayisi = req.IsciSayisi ?? Convert.ToDouble(rd["IsciSayisi"]);
        double OperatorUcreti = req.OperatorUcreti ?? Convert.ToDouble(rd["OperatorUcreti"]);
        double ElektrikUcreti = req.ElektrikUcreti ?? Convert.ToDouble(rd["ElektrikUcreti"]);
        double KwDegeri = req.KwDegeri ?? Convert.ToDouble(rd["KwDegeri"]);
        double FaydaliOmurYil = req.FaydaliOmurYil ?? Convert.ToDouble(rd["FaydaliOmurYil"]);
        double MakineBedeliEuro = req.MakineBedeliEuro ?? Convert.ToDouble(rd["MakineBedeliEuro"]);
        double YillikBakimMaliyeti = req.YillikBakimMaliyeti ?? Convert.ToDouble(rd["YillikBakimBedeli"]);
        
        // Diğer sabit değerler
        double EuroKuru = Convert.ToDouble(rd["EuroKuru"]);
        double IdealKg = Convert.ToDouble(rd["IdealKg"]);

        // Validasyon
        if (KalipGozSayisi <= 0) return BadRequest("Kalıp göz sayısı 0 veya negatif olamaz.");
        if (EuroKuru <= 0) return BadRequest("Euro kuru 0 veya negatif olamaz.");

        // Hesaplamalar
        double kalip1Saniye = 9 * 250 * 3600;
        double birimBrutAgirlik = BaskiToplamBrut / KalipGozSayisi;
        double santrifujSnKg = BaskiCevrimSuresi / IdealKg;
        double saniyeDetayi = santrifujSnKg * birimBrutAgirlik / 1000.0;
        double elektrikSaniye = ElektrikUcreti / 3600.0;
        double elektrikMaliyeti = saniyeDetayi * elektrikSaniye / EuroKuru * KwDegeri;
        double operatorSaniyelikUcret = OperatorUcreti / 225.0 / 3600.0;
        double bazIscilikMaliyeti = operatorSaniyelikUcret * saniyeDetayi / EuroKuru;
        double toplamIscilikMaliyeti = IsciKatsayisi * IsciSayisi * bazIscilikMaliyeti;
        double faydaliOmurSaniye = FaydaliOmurYil * 9 * 250 * 3600;
        double amortismanMaliyeti = saniyeDetayi / faydaliOmurSaniye * MakineBedeliEuro;
        double makineBakimMaliyeti = saniyeDetayi / kalip1Saniye * YillikBakimMaliyeti;
        double toplamMaliyet = toplamIscilikMaliyeti + elektrikMaliyeti + amortismanMaliyeti + makineBakimMaliyeti;

        if (double.IsNaN(toplamMaliyet) || double.IsInfinity(toplamMaliyet))
            return BadRequest("Hesaplama sonucu geçersiz değer.");

        decimal dToplam = (decimal)toplamMaliyet;
        decimal dElektrik = (decimal)elektrikMaliyeti;
        decimal dToplamIscilik = (decimal)toplamIscilikMaliyeti;
        decimal dAmortisman = (decimal)amortismanMaliyeti;
        decimal dMakineBakim = (decimal)makineBakimMaliyeti;

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"UPDATE dbo.Santrifuj SET
            EuroKuru=@EuroKuru, KwDegeri=@KwDegeri, FullKapasiteOperasyonSuresiSn=@FullKapasiteOperasyonSuresiSn, IdealKg=@IdealKg, BaskiToplamBrutAgirlik=@BaskiToplamBrutAgirlik, KalipGozSayisi=@KalipGozSayisi,
            ElektrikUcreti=@ElektrikUcreti, OperatorUcreti=@OperatorUcreti, IsciKatsayisi=@IsciKatsayisi, IsciSayisi=@IsciSayisi, MakineBedeliEuro=@MakineBedeliEuro, FaydaliOmurYil=@FaydaliOmurYil, YillikBakimBedeli=@YillikBakimBedeli,
            ElektrikMaliyetiEuro=@ElektrikMaliyetiEuro, ToplamIscilikMaliyetiEuro=@ToplamIscilikMaliyetiEuro, AmortismanMaliyetiEuro=@AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro=@MakineBakimMaliyetiEuro, ToplamMaliyetEuro=@ToplamMaliyetEuro, BirimBrutAgirlik=@BirimBrutAgirlik
            WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@EuroKuru", EuroKuru);
        cmd.Parameters.AddWithValue("@KwDegeri", KwDegeri);
        cmd.Parameters.AddWithValue("@FullKapasiteOperasyonSuresiSn", BaskiCevrimSuresi);
        cmd.Parameters.AddWithValue("@IdealKg", IdealKg);
        cmd.Parameters.AddWithValue("@BaskiToplamBrutAgirlik", BaskiToplamBrut);
        cmd.Parameters.AddWithValue("@KalipGozSayisi", KalipGozSayisi);
        cmd.Parameters.AddWithValue("@ElektrikUcreti", ElektrikUcreti);
        cmd.Parameters.AddWithValue("@OperatorUcreti", OperatorUcreti);
        cmd.Parameters.AddWithValue("@IsciKatsayisi", IsciKatsayisi);
        cmd.Parameters.AddWithValue("@IsciSayisi", IsciSayisi);
        cmd.Parameters.AddWithValue("@MakineBedeliEuro", MakineBedeliEuro);
        cmd.Parameters.AddWithValue("@FaydaliOmurYil", FaydaliOmurYil);
        cmd.Parameters.AddWithValue("@YillikBakimBedeli", YillikBakimMaliyeti);
        cmd.Parameters.AddWithValue("@ElektrikMaliyetiEuro", dElektrik);
        cmd.Parameters.AddWithValue("@ToplamIscilikMaliyetiEuro", dToplamIscilik);
        cmd.Parameters.AddWithValue("@AmortismanMaliyetiEuro", dAmortisman);
        cmd.Parameters.AddWithValue("@MakineBakimMaliyetiEuro", dMakineBakim);
        cmd.Parameters.AddWithValue("@ToplamMaliyetEuro", dToplam);
        cmd.Parameters.AddWithValue("@BirimBrutAgirlik", birimBrutAgirlik);
        await con.OpenAsync();
        var affected = await cmd.ExecuteNonQueryAsync();
        if (affected == 0) return NotFound();
        
        // İlişkili satış kayıtlarını güncelle
        await GuncelleSatisKayitlariIliskiliAdimIcinAsync(santrifujId: id);
        
        return Ok(new { toplamMaliyet = (double)dToplam, birimBrutAgirlik });
    }
    [HttpPut("posturleme/{id:int}")]
    public async Task<ActionResult<double>> GuncellePosturleme(int id, [FromBody] PosturlemeUpdateRequest req)
    {
        // Mevcut kaydı oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = "SELECT TOP 1 * FROM dbo.Posturleme WHERE Id=@id";
        cmd0.Parameters.AddWithValue("@id", id);
        await con0.OpenAsync();
        using var rd = await cmd0.ExecuteReaderAsync();
        if (!await rd.ReadAsync()) return NotFound();

        // Mevcut değerlerden başla, sadece gönderilenleri güncelle
        double BaskiToplamBrut = req.BaskiToplamBrut ?? Convert.ToDouble(rd["BaskiToplamBrutAgirlik"]);
        double KalipGozSayisi = req.KalipGozSayisi ?? Convert.ToDouble(rd["KalipGozSayisi"]);
        double BaskiCevrimSuresi = req.BaskiCevrimSuresi ?? Convert.ToDouble(rd["FullKapasiteOperasyonSuresiSn"]);
        double IsciKatsayisi = req.IsciKatsayisi ?? Convert.ToDouble(rd["IsciKatsayisi"]);
        double IsciSayisi = req.IsciSayisi ?? Convert.ToDouble(rd["IsciSayisi"]);
        double OperatorUcreti = req.OperatorUcreti ?? Convert.ToDouble(rd["OperatorUcreti"]);
        double ElektrikUcreti = req.ElektrikUcreti ?? Convert.ToDouble(rd["ElektrikUcreti"]);
        double KwDegeri = req.KwDegeri ?? Convert.ToDouble(rd["KwDegeri"]);
        double FaydaliOmurYil = req.FaydaliOmurYil ?? Convert.ToDouble(rd["FaydaliOmurYil"]);
        double MakineBedeliEuro = req.MakineBedeliEuro ?? Convert.ToDouble(rd["MakineBedeliEuro"]);
        double YillikBakimMaliyeti = req.YillikBakimMaliyeti ?? Convert.ToDouble(rd["YillikBakimBedeli"]);
        
        // Diğer sabit değerler
        double EuroKuru = Convert.ToDouble(rd["EuroKuru"]);
        double IdealKg = Convert.ToDouble(rd["IdealKg"]);

        // Validasyon
        if (KalipGozSayisi <= 0) return BadRequest("Kalıp göz sayısı 0 veya negatif olamaz.");
        if (EuroKuru <= 0) return BadRequest("Euro kuru 0 veya negatif olamaz.");

        // Hesaplamalar
        double kalip1Saniye = 9 * 250 * 3600;
        double birimBrutAgirlik = BaskiToplamBrut / KalipGozSayisi;
        double posturlemeSnKg = BaskiCevrimSuresi / IdealKg;
        double saniyeDetayi = posturlemeSnKg * birimBrutAgirlik / 1000.0;
        double elektrikSaniye = ElektrikUcreti / 3600.0;
        double elektrikMaliyeti = saniyeDetayi * elektrikSaniye / EuroKuru * KwDegeri;
        double operatorSaniyelikUcret = OperatorUcreti / 225.0 / 3600.0;
        double bazIscilikMaliyeti = operatorSaniyelikUcret * saniyeDetayi / EuroKuru;
        double toplamIscilikMaliyeti = IsciKatsayisi * IsciSayisi * bazIscilikMaliyeti;
        double faydaliOmurSaniye = FaydaliOmurYil * 9 * 250 * 3600;
        double amortismanMaliyeti = saniyeDetayi / faydaliOmurSaniye * MakineBedeliEuro;
        double makineBakimMaliyeti = saniyeDetayi / kalip1Saniye * YillikBakimMaliyeti;
        double toplamMaliyet = toplamIscilikMaliyeti + elektrikMaliyeti + amortismanMaliyeti + makineBakimMaliyeti;

        if (double.IsNaN(toplamMaliyet) || double.IsInfinity(toplamMaliyet))
            return BadRequest("Hesaplama sonucu geçersiz değer.");

        decimal dToplam = (decimal)toplamMaliyet;
        decimal dElektrik = (decimal)elektrikMaliyeti;
        decimal dToplamIscilik = (decimal)toplamIscilikMaliyeti;
        decimal dAmortisman = (decimal)amortismanMaliyeti;
        decimal dMakineBakim = (decimal)makineBakimMaliyeti;

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"UPDATE dbo.Posturleme SET
            EuroKuru=@EuroKuru, KwDegeri=@KwDegeri, FullKapasiteOperasyonSuresiSn=@FullKapasiteOperasyonSuresiSn, IdealKg=@IdealKg, BaskiToplamBrutAgirlik=@BaskiToplamBrutAgirlik, KalipGozSayisi=@KalipGozSayisi,
            ElektrikUcreti=@ElektrikUcreti, OperatorUcreti=@OperatorUcreti, IsciKatsayisi=@IsciKatsayisi, IsciSayisi=@IsciSayisi, MakineBedeliEuro=@MakineBedeliEuro, FaydaliOmurYil=@FaydaliOmurYil, YillikBakimBedeli=@YillikBakimBedeli,
            ElektrikMaliyetiEuro=@ElektrikMaliyetiEuro, ToplamIscilikMaliyetiEuro=@ToplamIscilikMaliyetiEuro, AmortismanMaliyetiEuro=@AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro=@MakineBakimMaliyetiEuro, ToplamMaliyetEuro=@ToplamMaliyetEuro, BirimBrutAgirlik=@BirimBrutAgirlik
            WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@EuroKuru", EuroKuru);
        cmd.Parameters.AddWithValue("@KwDegeri", KwDegeri);
        cmd.Parameters.AddWithValue("@FullKapasiteOperasyonSuresiSn", BaskiCevrimSuresi);
        cmd.Parameters.AddWithValue("@IdealKg", IdealKg);
        cmd.Parameters.AddWithValue("@BaskiToplamBrutAgirlik", BaskiToplamBrut);
        cmd.Parameters.AddWithValue("@KalipGozSayisi", KalipGozSayisi);
        cmd.Parameters.AddWithValue("@ElektrikUcreti", ElektrikUcreti);
        cmd.Parameters.AddWithValue("@OperatorUcreti", OperatorUcreti);
        cmd.Parameters.AddWithValue("@IsciKatsayisi", IsciKatsayisi);
        cmd.Parameters.AddWithValue("@IsciSayisi", IsciSayisi);
        cmd.Parameters.AddWithValue("@MakineBedeliEuro", MakineBedeliEuro);
        cmd.Parameters.AddWithValue("@FaydaliOmurYil", FaydaliOmurYil);
        cmd.Parameters.AddWithValue("@YillikBakimBedeli", YillikBakimMaliyeti);
        cmd.Parameters.AddWithValue("@ElektrikMaliyetiEuro", dElektrik);
        cmd.Parameters.AddWithValue("@ToplamIscilikMaliyetiEuro", dToplamIscilik);
        cmd.Parameters.AddWithValue("@AmortismanMaliyetiEuro", dAmortisman);
        cmd.Parameters.AddWithValue("@MakineBakimMaliyetiEuro", dMakineBakim);
        cmd.Parameters.AddWithValue("@ToplamMaliyetEuro", dToplam);
        cmd.Parameters.AddWithValue("@BirimBrutAgirlik", birimBrutAgirlik);
        await con.OpenAsync();
        var affected = await cmd.ExecuteNonQueryAsync();
        if (affected == 0) return NotFound();
        
        // İlişkili satış kayıtlarını güncelle
        await GuncelleSatisKayitlariIliskiliAdimIcinAsync(posturlemeId: id);
        
        return Ok(new { toplamMaliyet = (double)dToplam, birimBrutAgirlik });
    }
    [HttpPut("enjeksiyon/{id:int}")]
    public async Task<ActionResult<double>> GuncelleEnjeksiyon(int id, [FromBody] EnjeksiyonUpdateRequest req)
    {
        Console.WriteLine($"PUT Enjeksiyon {id}: {JsonSerializer.Serialize(req)}");
        
        // Mevcut kaydı oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = "SELECT TOP 1 * FROM dbo.Enjeksiyon WHERE Id=@id";
        cmd0.Parameters.AddWithValue("@id", id);
        await con0.OpenAsync();
        using var rd = await cmd0.ExecuteReaderAsync();
        if (!await rd.ReadAsync()) return NotFound();

        Console.WriteLine($"Mevcut kayıt: BaskiToplamBrut={rd["BaskiToplamBrut"]}, KalipGozSayisi={rd["KalipGozSayisi"]}");

        // Değerleri güncelle (sadece gönderilenleri)
        double BaskiToplamBrut = req.BaskiToplamBrut ?? Convert.ToDouble(rd["BaskiToplamBrut"]);
        double KalipGozSayisi = req.KalipGozSayisi ?? Convert.ToDouble(rd["KalipGozSayisi"]);
        double HammaddeFiyatiEuro = req.HammaddeFiyatiEuro ?? Convert.ToDouble(rd["HammaddeFiyatiEuro"]);
        double EuroKuru = req.EuroKuru ?? Convert.ToDouble(rd["EuroKuru"]);
        double BaskiCevrimSuresi = req.BaskiCevrimSuresi ?? Convert.ToDouble(rd["BaskiCevrimSuresi"]);
        double IsciKatsayisi = req.IsciKatsayisi ?? Convert.ToDouble(rd["IsciKatsayisi"]);
        double IsciSayisi = req.IsciSayisi ?? Convert.ToDouble(rd["IsciSayisi"]);
        double OperatorUcreti = req.OperatorUcreti ?? Convert.ToDouble(rd["OperatorUcreti"]);
        double ElektrikUcreti = req.ElektrikUcreti ?? Convert.ToDouble(rd["ElektrikUcreti"]);
        double KwDegeri = req.KwDegeri ?? Convert.ToDouble(rd["KwDegeri"]);
        double FaydaliOmurYil = req.FaydaliOmurYil ?? Convert.ToDouble(rd["FaydaliOmurYil"]);
        double MakineBedeliEuro = req.MakineBedeliEuro ?? Convert.ToDouble(rd["MakineBedeliEuro"]);
        double YillikBakimMaliyeti = req.YillikBakimMaliyeti ?? Convert.ToDouble(rd["YillikBakimMaliyeti"]);
        double KalipBakimUcreti = req.KalipBakimUcreti ?? Convert.ToDouble(rd["KalipBakimUcreti"]);
        string? KalipKontrolu = req.KalipKontrolu ?? (rd["KalipKontrolu"] as string);
        double KalipBedeli = req.KalipBedeli ?? Convert.ToDouble(rd["KalipBedeli"]);
        double Adet = req.Adet ?? Convert.ToDouble(rd["Adet"]);
        string? HammaddeTuru = req.HammaddeTuru ?? (rd["HammaddeTuru"] as string);
        string? HammaddeTedarikcisi = req.HammaddeTedarikcisi ?? (rd["HammaddeTedarikcisi"] as string);
        string? KalipTedarikcisi = req.KalipTedarikcisi ?? (rd["KalipTedarikcisi"] as string);

        Console.WriteLine($"Güncellenmiş değerler: BaskiToplamBrut={BaskiToplamBrut}, KalipGozSayisi={KalipGozSayisi}");

        if (KalipGozSayisi <= 0) return BadRequest("Kalıp göz sayısı 0 veya negatif olamaz.");
        if (EuroKuru <= 0) return BadRequest("Euro kuru 0 veya negatif olamaz.");
        if (Adet <= 0) return BadRequest("Adet 0 veya negatif olamaz.");

        double birimBrutAgirlik = BaskiToplamBrut / KalipGozSayisi;
        double kalip1Saniye = 9 * 250 * 3600;
        double operatorSaniyelikUcret = OperatorUcreti / 225 / 3600;
        double bazIscilikMaliyeti = BaskiCevrimSuresi * operatorSaniyelikUcret / EuroKuru / KalipGozSayisi;
        double toplamIscilikMaliyeti = IsciKatsayisi * IsciSayisi * bazIscilikMaliyeti;
        double malzemeMaliyeti = birimBrutAgirlik * HammaddeFiyatiEuro / 1000.0;
        double elektrikSaniye = ElektrikUcreti / 3600.0;
        double elektrikMaliyeti = BaskiCevrimSuresi * elektrikSaniye / EuroKuru / KalipGozSayisi * KwDegeri;
        double faydaliOmurSaniye = FaydaliOmurYil * 2250 * 3600;
        double amortismanMaliyeti = BaskiCevrimSuresi / faydaliOmurSaniye * MakineBedeliEuro / KalipGozSayisi;
        double makineBakimMaliyeti = BaskiCevrimSuresi / kalip1Saniye * YillikBakimMaliyeti / KalipGozSayisi;
        double kalipMaliyeti = KalipBakimUcreti / kalip1Saniye * BaskiCevrimSuresi / KalipGozSayisi;
        double kalipBedeliPay = 0;
        if (string.Equals(KalipKontrolu, "var", StringComparison.OrdinalIgnoreCase))
        {
            kalipBedeliPay = KalipBedeli / Adet;
        }
        double toplamMaliyet = malzemeMaliyeti + toplamIscilikMaliyeti + elektrikMaliyeti + amortismanMaliyeti + makineBakimMaliyeti + kalipMaliyeti + kalipBedeliPay;

        // NaN/Infinity kontrolü
        if (!double.IsFinite(malzemeMaliyeti) || !double.IsFinite(toplamIscilikMaliyeti) || !double.IsFinite(elektrikMaliyeti)
            || !double.IsFinite(amortismanMaliyeti) || !double.IsFinite(makineBakimMaliyeti) || !double.IsFinite(kalipMaliyeti)
            || !double.IsFinite(kalipBedeliPay) || !double.IsFinite(toplamMaliyet))
        {
            return BadRequest("Geçersiz hesaplama (NaN/Infinity). Giriş değerlerini kontrol edin.");
        }

        // SQL decimal(18,6) için güvenli dönüştürmeler
        decimal dMalzeme = (decimal)Math.Round(malzemeMaliyeti, 11, MidpointRounding.AwayFromZero);
        decimal dIscilik = (decimal)Math.Round(toplamIscilikMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dElektrik = (decimal)Math.Round(elektrikMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dAmortisman = (decimal)Math.Round(amortismanMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dMakineBakim = (decimal)Math.Round(makineBakimMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dKalip = (decimal)Math.Round(kalipMaliyeti, 11, MidpointRounding.AwayFromZero);
        decimal dKalipBedeliPay = (decimal)Math.Round(kalipBedeliPay, 11, MidpointRounding.AwayFromZero);
        decimal dToplam = (decimal)Math.Round(toplamMaliyet, 6, MidpointRounding.AwayFromZero);
        decimal dToplamHammaddeMaliyeti = (decimal)Math.Round(malzemeMaliyeti * Adet, 6, MidpointRounding.AwayFromZero);

        Console.WriteLine($"Hesaplanan toplam maliyet: {dToplam}");

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"UPDATE dbo.Enjeksiyon SET
                BaskiToplamBrut=@BaskiToplamBrut, KalipGozSayisi=@KalipGozSayisi, HammaddeFiyatiEuro=@HammaddeFiyatiEuro, EuroKuru=@EuroKuru, BaskiCevrimSuresi=@BaskiCevrimSuresi,
                IsciKatsayisi=@IsciKatsayisi, IsciSayisi=@IsciSayisi, OperatorUcreti=@OperatorUcreti, ElektrikUcreti=@ElektrikUcreti, KwDegeri=@KwDegeri,
                FaydaliOmurYil=@FaydaliOmurYil, MakineBedeliEuro=@MakineBedeliEuro, YillikBakimMaliyeti=@YillikBakimMaliyeti, KalipBakimUcreti=@KalipBakimUcreti,
                KalipKontrolu=@KalipKontrolu, KalipBedeli=@KalipBedeli, Adet=@Adet, HammaddeTuru=@HammaddeTuru, HammaddeTedarikcisi=@HammaddeTedarikcisi,
                MalzemeMaliyetiEuro=@MalzemeMaliyetiEuro, ToplamIscilikMaliyetiEuro=@ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro=@ElektrikMaliyetiEuro, AmortismanMaliyetiEuro=@AmortismanMaliyetiEuro,
                MakineBakimMaliyetiEuro=@MakineBakimMaliyetiEuro, KalipMaliyetiEuro=@KalipMaliyetiEuro, KalipBedeliPayEuro=@KalipBedeliPayEuro, ToplamMaliyetEuro=@ToplamMaliyetEuro, ToplamHammaddeMaliyetiEuro=@ToplamHammaddeMaliyetiEuro, BirimBrutAgirlik=@BirimBrutAgirlik
            WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@BaskiToplamBrut", BaskiToplamBrut);
        cmd.Parameters.AddWithValue("@KalipGozSayisi", KalipGozSayisi);
        cmd.Parameters.AddWithValue("@HammaddeFiyatiEuro", HammaddeFiyatiEuro);
        cmd.Parameters.AddWithValue("@EuroKuru", EuroKuru);
        cmd.Parameters.AddWithValue("@BaskiCevrimSuresi", BaskiCevrimSuresi);
        cmd.Parameters.AddWithValue("@IsciKatsayisi", IsciKatsayisi);
        cmd.Parameters.AddWithValue("@IsciSayisi", IsciSayisi);
        cmd.Parameters.AddWithValue("@OperatorUcreti", OperatorUcreti);
        cmd.Parameters.AddWithValue("@ElektrikUcreti", ElektrikUcreti);
        cmd.Parameters.AddWithValue("@KwDegeri", KwDegeri);
        cmd.Parameters.AddWithValue("@FaydaliOmurYil", FaydaliOmurYil);
        cmd.Parameters.AddWithValue("@MakineBedeliEuro", MakineBedeliEuro);
        cmd.Parameters.AddWithValue("@YillikBakimMaliyeti", YillikBakimMaliyeti);
        cmd.Parameters.AddWithValue("@KalipBakimUcreti", KalipBakimUcreti);
        cmd.Parameters.AddWithValue("@KalipKontrolu", (object?)KalipKontrolu ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@KalipBedeli", KalipBedeli);
        cmd.Parameters.AddWithValue("@Adet", Adet);
        cmd.Parameters.AddWithValue("@HammaddeTuru", (object?)HammaddeTuru ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@HammaddeTedarikcisi", (object?)HammaddeTedarikcisi ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@KalipTedarikcisi", (object?)KalipTedarikcisi ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@MalzemeMaliyetiEuro", dMalzeme);
        cmd.Parameters.AddWithValue("@ToplamIscilikMaliyetiEuro", dIscilik);
        cmd.Parameters.AddWithValue("@ElektrikMaliyetiEuro", dElektrik);
        cmd.Parameters.AddWithValue("@AmortismanMaliyetiEuro", dAmortisman);
        cmd.Parameters.AddWithValue("@MakineBakimMaliyetiEuro", dMakineBakim);
        cmd.Parameters.AddWithValue("@KalipMaliyetiEuro", dKalip);
        cmd.Parameters.AddWithValue("@KalipBedeliPayEuro", dKalipBedeliPay);
        cmd.Parameters.AddWithValue("@ToplamMaliyetEuro", dToplam);
        cmd.Parameters.AddWithValue("@ToplamHammaddeMaliyetiEuro", dToplamHammaddeMaliyeti);
        cmd.Parameters.AddWithValue("@BirimBrutAgirlik", birimBrutAgirlik);
        await con.OpenAsync();
        var affected = await cmd.ExecuteNonQueryAsync();
        
        Console.WriteLine($"Veritabanına kaydedildi! Affected rows: {affected}");
        
        if (affected == 0) return NotFound();
        
        // İlişkili satış kayıtlarını güncelle
        await GuncelleSatisKayitlariIliskiliAdimIcinAsync(enjeksiyonId: id);
        
        return Ok((double)dToplam);
    }

    [HttpDelete("enjeksiyon/{id:int}")]
public async Task<IActionResult> SilEnjeksiyon(int id)
{
    using var con = new SqlConnection(_cs);
    using var cmd = con.CreateCommand();
    cmd.CommandText = "DELETE FROM dbo.Enjeksiyon WHERE Id=@id";
    cmd.Parameters.AddWithValue("@id", id);
    await con.OpenAsync();
    var affected = await cmd.ExecuteNonQueryAsync();
    if (affected == 0) return NotFound();
    return NoContent();
}

    [HttpPost("azotlucapakalma")]
    public async Task<ActionResult<object>> AzotluCapakAlma([FromBody] AzotluCapakAlmaRequest req)
    {
        if (req.IslemGorenUrunAgirligiToplamGram <= 0)
        {
            return BadRequest("İşlem gören ürün toplam ağırlığı 0 veya negatif olamaz.");
        }
        if (req.BirimNetAgirlik <= 0)
        {
            return BadRequest("Birim net ağırlık 0 veya negatif olamaz.");
        }

        // Enjeksiyon'dan override kaldırıldı: Azotlu Çapak Alma için enjeksiyon verisine bağlanmıyoruz
        double effectiveBaskiToplamBrutAgirlik = req.BaskiToplamBrutAgirlik;
        int effectiveKalipGozSayisi = req.KalipGozSayisi;

        if (effectiveKalipGozSayisi <= 0)
        {
            return BadRequest("Kalıp göz sayısı 0 veya negatif olamaz.");
        }

        double toplamislemesuresi = req.TezgahSogumaSuresi + req.MakineIslemSuresi + req.YuklemeBosaltmaSuresi;
        double kalip1Saniye = 9 * 250 * 3600;

        double azotGrFiyatiEuro = req.AzotKgFiyatiTl / 1000.0 / req.EuroKuru;
        double birimBrutAgirlik = req.BirimNetAgirlik * 1.20;
        double islemgorenurunadedi = req.IslemGorenUrunAdedi.HasValue && req.IslemGorenUrunAdedi.Value > 0
            ? req.IslemGorenUrunAdedi.Value
            : req.IslemGorenUrunAgirligiToplamGram / birimBrutAgirlik;
        double birimBrutAgirlikGr = birimBrutAgirlik;
        double harcananBirimAzotGramHesaplanan = (req.IslemBasinaHarcananAzotGram * birimBrutAgirlikGr) / req.IslemGorenUrunAgirligiToplamGram;
        double harcananBirimAzotMaliyeti = harcananBirimAzotGramHesaplanan * azotGrFiyatiEuro;
        decimal dHarcananAzot = (decimal)harcananBirimAzotMaliyeti;

        double operatorSaniyelikUcret = req.OperatorUcreti / 225.0 / 3600.0;
        double toplambirimislemesuresi = toplamislemesuresi / islemgorenurunadedi;
        double bazIscilikMaliyeti = toplambirimislemesuresi * operatorSaniyelikUcret / req.EuroKuru;
        double toplamIscilikMaliyeti = req.IsciKatsayisi * req.IsciSayisi * bazIscilikMaliyeti;

        // elektrik
        double elektrikSaniye = req.ElektrikUcreti / 3600.0;
        double elektrikMaliyeti = ((req.MakineIslemSuresi / islemgorenurunadedi * elektrikSaniye )/ req.EuroKuru )* req.KwDegeri;

        // amortisman ve bakım
        double faydaliOmurSaniye = req.FaydaliOmurYil * 9 * 250 * 3600; // formülde böyle verilmiş
        double amortismanMaliyeti = toplambirimislemesuresi / faydaliOmurSaniye * req.MakineBedeliEuro;
        double makineBakimMaliyeti = toplambirimislemesuresi / kalip1Saniye * req.YillikBakimBedeli;

        // taş tüketimi
        double harcananBirimTasMaliyeti = toplambirimislemesuresi * req.TasKgSaniye / 28800.0 * req.Tas1KgFiyatiEuro;

        double toplamMaliyet = harcananBirimAzotMaliyeti + toplamIscilikMaliyeti + elektrikMaliyeti + amortismanMaliyeti + makineBakimMaliyeti + harcananBirimTasMaliyeti;

        using (var con = new SqlConnection(_cs))
        using (var cmd = con.CreateCommand())
        {
            cmd.CommandText = @"INSERT INTO dbo.AzotluCapakAlma (
                AzotKgFiyatiTl, IslemBasinaHarcananAzotGram, TezgahSogumaSuresi, MakineIslemSuresi, YuklemeBosaltmaSuresi,
                BaskiToplamBrutAgirlik, IslemGorenUrunAgirligiToplamGram, IsciKatsayisi, IsciSayisi, OperatorUcreti,
                ElektrikUcreti, KwDegeri, FaydaliOmurYil, MakineBedeliEuro, YillikBakimBedeli, BaskiCevrimSuresi,
                EuroKuru, KalipGozSayisi, TasKgSaniye, Tas1KgFiyatiEuro, IslemGorenUrunAdedi,
                HarcananBirimAzotMaliyetiEuro, ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro,
                MakineBakimMaliyetiEuro, HarcananBirimTasMaliyetiEuro, ToplamMaliyetEuro, BirimBrutAgirlik, BirimNetAgirlik
            ) VALUES (
                @AzotKgFiyatiTl, @IslemBasinaHarcananAzotGram, @TezgahSogumaSuresi, @MakineIslemSuresi, @YuklemeBosaltmaSuresi,
                @BaskiToplamBrutAgirlik, @IslemGorenUrunAgirligiToplamGram, @IsciKatsayisi, @IsciSayisi, @OperatorUcreti,
                @ElektrikUcreti, @KwDegeri, @FaydaliOmurYil, @MakineBedeliEuro, @YillikBakimBedeli, @BaskiCevrimSuresi,
                @EuroKuru, @KalipGozSayisi, @TasKgSaniye, @Tas1KgFiyatiEuro, @IslemGorenUrunAdedi,
                @HarcananBirimAzotMaliyetiEuro, @ToplamIscilikMaliyetiEuro, @ElektrikMaliyetiEuro, @AmortismanMaliyetiEuro,
                @MakineBakimMaliyetiEuro, @HarcananBirimTasMaliyetiEuro, @ToplamMaliyetEuro, @BirimBrutAgirlik, @BirimNetAgirlik
            ); SELECT CAST(SCOPE_IDENTITY() AS int);";
            cmd.Parameters.AddWithValue("@AzotKgFiyatiTl", req.AzotKgFiyatiTl);
            cmd.Parameters.AddWithValue("@IslemBasinaHarcananAzotGram", req.IslemBasinaHarcananAzotGram);
            cmd.Parameters.AddWithValue("@TezgahSogumaSuresi", req.TezgahSogumaSuresi);
            cmd.Parameters.AddWithValue("@MakineIslemSuresi", req.MakineIslemSuresi);
            cmd.Parameters.AddWithValue("@YuklemeBosaltmaSuresi", req.YuklemeBosaltmaSuresi);
            cmd.Parameters.AddWithValue("@BaskiToplamBrutAgirlik", effectiveBaskiToplamBrutAgirlik);
            cmd.Parameters.AddWithValue("@IslemGorenUrunAgirligiToplamGram", req.IslemGorenUrunAgirligiToplamGram);
            cmd.Parameters.AddWithValue("@IsciKatsayisi", req.IsciKatsayisi);
            cmd.Parameters.AddWithValue("@IsciSayisi", req.IsciSayisi);
            cmd.Parameters.AddWithValue("@OperatorUcreti", req.OperatorUcreti);
            cmd.Parameters.AddWithValue("@ElektrikUcreti", req.ElektrikUcreti);
            cmd.Parameters.AddWithValue("@KwDegeri", req.KwDegeri);
            cmd.Parameters.AddWithValue("@FaydaliOmurYil", req.FaydaliOmurYil);
            cmd.Parameters.AddWithValue("@MakineBedeliEuro", req.MakineBedeliEuro);
            cmd.Parameters.AddWithValue("@YillikBakimBedeli", req.YillikBakimBedeli);
            cmd.Parameters.AddWithValue("@BaskiCevrimSuresi", req.BaskiCevrimSuresi);
            cmd.Parameters.AddWithValue("@EuroKuru", req.EuroKuru);
            cmd.Parameters.AddWithValue("@KalipGozSayisi", effectiveKalipGozSayisi);
            cmd.Parameters.AddWithValue("@TasKgSaniye", req.TasKgSaniye);
            cmd.Parameters.AddWithValue("@Tas1KgFiyatiEuro", req.Tas1KgFiyatiEuro);
            cmd.Parameters.AddWithValue("@IslemGorenUrunAdedi", islemgorenurunadedi);
            cmd.Parameters.AddWithValue("@HarcananBirimAzotMaliyetiEuro", dHarcananAzot);
            cmd.Parameters.AddWithValue("@ToplamIscilikMaliyetiEuro", toplamIscilikMaliyeti);
            cmd.Parameters.AddWithValue("@ElektrikMaliyetiEuro", elektrikMaliyeti);
            cmd.Parameters.AddWithValue("@AmortismanMaliyetiEuro", amortismanMaliyeti);
            cmd.Parameters.AddWithValue("@MakineBakimMaliyetiEuro", makineBakimMaliyeti);
            cmd.Parameters.AddWithValue("@HarcananBirimTasMaliyetiEuro", harcananBirimTasMaliyeti);
            cmd.Parameters.AddWithValue("@ToplamMaliyetEuro", toplamMaliyet);
            cmd.Parameters.AddWithValue("@BirimBrutAgirlik", birimBrutAgirlik);
            cmd.Parameters.AddWithValue("@BirimNetAgirlik", req.BirimNetAgirlik);
            await con.OpenAsync();
            var newId = (int)await cmd.ExecuteScalarAsync();

            if (req.SatisKaydiId.HasValue)
            {
                using var conLink = new SqlConnection(_cs);
                using var cmdLink = conLink.CreateCommand();
                cmdLink.CommandText = @"UPDATE dbo.SatisKayitlari
                                    SET AzotluCapakAlmaId=@AzotId
                                    WHERE Id=@SatisId AND (AzotluCapakAlmaId IS NULL OR AzotluCapakAlmaId=0)";
                cmdLink.Parameters.AddWithValue("@AzotId", newId);
                cmdLink.Parameters.AddWithValue("@SatisId", req.SatisKaydiId.Value);
                await conLink.OpenAsync();
                await cmdLink.ExecuteNonQueryAsync();

                await GuncelleSatisKayitlariIliskiliAdimIcinAsync(azotluCapakAlmaId: newId);
            }

            return Ok(new { id = newId, toplamMaliyet, birimBrutAgirlik });
        }
    }

    [HttpPut("azotlucapakalma/{id:int}")]
    public async Task<ActionResult<double>> GuncelleAzotluCapakAlma(int id, [FromBody] AzotluCapakAlmaUpdateRequest req)
    {
        // Mevcut kaydı oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = "SELECT TOP 1 * FROM dbo.AzotluCapakAlma WHERE Id=@id";
        cmd0.Parameters.AddWithValue("@id", id);
        await con0.OpenAsync();
        using var rd = await cmd0.ExecuteReaderAsync();
        if (!await rd.ReadAsync()) return NotFound();

        // Mevcut değerlerden başla, sadece gönderilenleri güncelle
        double BaskiToplamBrut = req.BaskiToplamBrut ?? Convert.ToDouble(rd["BaskiToplamBrutAgirlik"]);
        double KalipGozSayisi = req.KalipGozSayisi ?? Convert.ToDouble(rd["KalipGozSayisi"]);
        double AzotFiyatiEuro = req.AzotFiyatiEuro ?? Convert.ToDouble(rd["AzotKgFiyatiTl"]);
        double EuroKuru = req.EuroKuru ?? Convert.ToDouble(rd["EuroKuru"]);
        double BaskiCevrimSuresi = req.BaskiCevrimSuresi ?? Convert.ToDouble(rd["BaskiCevrimSuresi"]);
        double IsciKatsayisi = req.IsciKatsayisi ?? Convert.ToDouble(rd["IsciKatsayisi"]);
        double IsciSayisi = req.IsciSayisi ?? Convert.ToDouble(rd["IsciSayisi"]);
        double OperatorUcreti = req.OperatorUcreti ?? Convert.ToDouble(rd["OperatorUcreti"]);
        double ElektrikUcreti = req.ElektrikUcreti ?? Convert.ToDouble(rd["ElektrikUcreti"]);
        double KwDegeri = req.KwDegeri ?? Convert.ToDouble(rd["KwDegeri"]);
        double FaydaliOmurYil = req.FaydaliOmurYil ?? Convert.ToDouble(rd["FaydaliOmurYil"]);
        double MakineBedeliEuro = req.MakineBedeliEuro ?? Convert.ToDouble(rd["MakineBedeliEuro"]);
        double YillikBakimMaliyeti = req.YillikBakimMaliyeti ?? Convert.ToDouble(rd["YillikBakimBedeli"]);
        double TasFiyatiEuro = req.TasFiyatiEuro ?? Convert.ToDouble(rd["Tas1KgFiyatiEuro"]);
        double TasMiktari = req.TasMiktari ?? Convert.ToDouble(rd["TasKgSaniye"]);
        
        // Diğer sabit değerler
        double IslemBasinaHarcananAzotGram = Convert.ToDouble(rd["IslemBasinaHarcananAzotGram"]);
        double TezgahSogumaSuresi = Convert.ToDouble(rd["TezgahSogumaSuresi"]);
        double MakineIslemSuresi = Convert.ToDouble(rd["MakineIslemSuresi"]);
        double YuklemeBosaltmaSuresi = Convert.ToDouble(rd["YuklemeBosaltmaSuresi"]);
        double IslemGorenUrunAgirligiToplamGram = Convert.ToDouble(rd["IslemGorenUrunAgirligiToplamGram"]);

        // Validasyon
        if (KalipGozSayisi <= 0) return BadRequest("Kalıp göz sayısı 0 veya negatif olamaz.");
        if (EuroKuru <= 0) return BadRequest("Euro kuru 0 veya negatif olamaz.");

        // Hesaplamalar
        double toplamislemesuresi = TezgahSogumaSuresi + MakineIslemSuresi + YuklemeBosaltmaSuresi;
        double kalip1Saniye = 9 * 250 * 3600;
        double azotGrFiyatiEuro = AzotFiyatiEuro / 1000.0 / EuroKuru;
        if (rd["IslemGorenUrunAdedi"] == DBNull.Value || Convert.ToDouble(rd["IslemGorenUrunAdedi"]) <= 0)
            return BadRequest("IslemGorenUrunAdedi belirtilmeli (birim net hesap için).");
        double islemgorenurunadedi = Convert.ToDouble(rd["IslemGorenUrunAdedi"]);
        double birimNetAgirlik = IslemGorenUrunAgirligiToplamGram / islemgorenurunadedi;
        double birimBrutAgirlik = birimNetAgirlik * 1.20;
        double birimBrutAgirlikGr = birimBrutAgirlik;
        double harcananBirimAzotGramHesaplanan = IslemBasinaHarcananAzotGram * birimBrutAgirlikGr / IslemGorenUrunAgirligiToplamGram;
        double harcananBirimAzotMaliyeti = harcananBirimAzotGramHesaplanan * azotGrFiyatiEuro;
        double operatorSaniyelikUcret = OperatorUcreti / 225.0 / 3600.0;
        double toplambirimislemesuresi = toplamislemesuresi / islemgorenurunadedi;
        double bazIscilikMaliyeti = toplambirimislemesuresi * operatorSaniyelikUcret / EuroKuru;
        double toplamIscilikMaliyeti = IsciKatsayisi * IsciSayisi * bazIscilikMaliyeti;
        double elektrikSaniye = ElektrikUcreti / 3600.0;
        double elektrikMaliyeti = (MakineIslemSuresi / islemgorenurunadedi) * elektrikSaniye / EuroKuru * KwDegeri;
        double faydaliOmurSaniye = FaydaliOmurYil * 9 * 250 * 3600;
        double amortismanMaliyeti = toplambirimislemesuresi / faydaliOmurSaniye * MakineBedeliEuro;
        double makineBakimMaliyeti = toplambirimislemesuresi / kalip1Saniye * YillikBakimMaliyeti;
        double harcananBirimTasMaliyeti = toplambirimislemesuresi * TasMiktari / 28800.0 * TasFiyatiEuro;
        double toplamMaliyet = harcananBirimAzotMaliyeti + toplamIscilikMaliyeti + elektrikMaliyeti + amortismanMaliyeti + makineBakimMaliyeti + harcananBirimTasMaliyeti;

        if (double.IsNaN(toplamMaliyet) || double.IsInfinity(toplamMaliyet))
            return BadRequest("Hesaplama sonucu geçersiz değer.");

        decimal dToplam = (decimal)toplamMaliyet;
        decimal dHarcananAzot = (decimal)Math.Round(harcananBirimAzotMaliyeti, 11, MidpointRounding.AwayFromZero);
        decimal dToplamIscilik = (decimal)toplamIscilikMaliyeti;
        decimal dElektrik = (decimal)elektrikMaliyeti;
        decimal dAmortisman = (decimal)amortismanMaliyeti;
        decimal dMakineBakim = (decimal)makineBakimMaliyeti;
        decimal dHarcananTas = (decimal)harcananBirimTasMaliyeti;

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"UPDATE dbo.AzotluCapakAlma SET
            AzotKgFiyatiTl=@AzotKgFiyatiTl, IslemBasinaHarcananAzotGram=@IslemBasinaHarcananAzotGram, TezgahSogumaSuresi=@TezgahSogumaSuresi, MakineIslemSuresi=@MakineIslemSuresi, YuklemeBosaltmaSuresi=@YuklemeBosaltmaSuresi,
            BaskiToplamBrutAgirlik=@BaskiToplamBrutAgirlik, IslemGorenUrunAgirligiToplamGram=@IslemGorenUrunAgirligiToplamGram, IsciKatsayisi=@IsciKatsayisi, IsciSayisi=@IsciSayisi, OperatorUcreti=@OperatorUcreti,
            ElektrikUcreti=@ElektrikUcreti, KwDegeri=@KwDegeri, FaydaliOmurYil=@FaydaliOmurYil, MakineBedeliEuro=@MakineBedeliEuro, YillikBakimBedeli=@YillikBakimBedeli, BaskiCevrimSuresi=@BaskiCevrimSuresi,
            EuroKuru=@EuroKuru, KalipGozSayisi=@KalipGozSayisi, TasKgSaniye=@TasKgSaniye, Tas1KgFiyatiEuro=@Tas1KgFiyatiEuro, IslemGorenUrunAdedi=@IslemGorenUrunAdedi, BirimNetAgirlik=@BirimNetAgirlik,
            HarcananBirimAzotMaliyetiEuro=@HarcananBirimAzotMaliyetiEuro, ToplamIscilikMaliyetiEuro=@ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro=@ElektrikMaliyetiEuro, AmortismanMaliyetiEuro=@AmortismanMaliyetiEuro,
            MakineBakimMaliyetiEuro=@MakineBakimMaliyetiEuro, HarcananBirimTasMaliyetiEuro=@HarcananBirimTasMaliyetiEuro, ToplamMaliyetEuro=@ToplamMaliyetEuro, BirimBrutAgirlik=@BirimBrutAgirlik
            WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@AzotKgFiyatiTl", AzotFiyatiEuro);
        cmd.Parameters.AddWithValue("@IslemBasinaHarcananAzotGram", IslemBasinaHarcananAzotGram);
        cmd.Parameters.AddWithValue("@TezgahSogumaSuresi", TezgahSogumaSuresi);
        cmd.Parameters.AddWithValue("@MakineIslemSuresi", MakineIslemSuresi);
        cmd.Parameters.AddWithValue("@YuklemeBosaltmaSuresi", YuklemeBosaltmaSuresi);
        cmd.Parameters.AddWithValue("@BaskiToplamBrutAgirlik", BaskiToplamBrut);
        cmd.Parameters.AddWithValue("@IslemGorenUrunAgirligiToplamGram", IslemGorenUrunAgirligiToplamGram);
        cmd.Parameters.AddWithValue("@IsciKatsayisi", IsciKatsayisi);
        cmd.Parameters.AddWithValue("@IsciSayisi", IsciSayisi);
        cmd.Parameters.AddWithValue("@OperatorUcreti", OperatorUcreti);
        cmd.Parameters.AddWithValue("@ElektrikUcreti", ElektrikUcreti);
        cmd.Parameters.AddWithValue("@KwDegeri", KwDegeri);
        cmd.Parameters.AddWithValue("@FaydaliOmurYil", FaydaliOmurYil);
        cmd.Parameters.AddWithValue("@MakineBedeliEuro", MakineBedeliEuro);
        cmd.Parameters.AddWithValue("@YillikBakimBedeli", YillikBakimMaliyeti);
        cmd.Parameters.AddWithValue("@BaskiCevrimSuresi", BaskiCevrimSuresi);
        cmd.Parameters.AddWithValue("@EuroKuru", EuroKuru);
        cmd.Parameters.AddWithValue("@KalipGozSayisi", KalipGozSayisi);
        cmd.Parameters.AddWithValue("@TasKgSaniye", TasMiktari);
        cmd.Parameters.AddWithValue("@Tas1KgFiyatiEuro", TasFiyatiEuro);
        cmd.Parameters.AddWithValue("@IslemGorenUrunAdedi", islemgorenurunadedi);
        cmd.Parameters.AddWithValue("@HarcananBirimAzotMaliyetiEuro", dHarcananAzot);
        cmd.Parameters.AddWithValue("@ToplamIscilikMaliyetiEuro", dToplamIscilik);
        cmd.Parameters.AddWithValue("@ElektrikMaliyetiEuro", dElektrik);
        cmd.Parameters.AddWithValue("@AmortismanMaliyetiEuro", dAmortisman);
        cmd.Parameters.AddWithValue("@MakineBakimMaliyetiEuro", dMakineBakim);
        cmd.Parameters.AddWithValue("@HarcananBirimTasMaliyetiEuro", dHarcananTas);
        cmd.Parameters.AddWithValue("@ToplamMaliyetEuro", dToplam);
        cmd.Parameters.AddWithValue("@BirimBrutAgirlik", birimBrutAgirlik);
        cmd.Parameters.AddWithValue("@BirimNetAgirlik", (object?)req.BirimNetAgirlik ?? Convert.ToDouble(rd["BirimNetAgirlik"]));
        await con.OpenAsync();
        var affected = await cmd.ExecuteNonQueryAsync();
        if (affected == 0) return NotFound();

        if (req.SatisKaydiId.HasValue)
        {
            using var conLink = new SqlConnection(_cs);
            using var cmdLink = conLink.CreateCommand();
            cmdLink.CommandText = "UPDATE dbo.SatisKayitlari SET AzotluCapakAlmaId=@AzotId WHERE Id=@SatisId AND (AzotluCapakAlmaId IS NULL OR AzotluCapakAlmaId=0)";
            cmdLink.Parameters.AddWithValue("@AzotId", id);
            cmdLink.Parameters.AddWithValue("@SatisId", req.SatisKaydiId.Value);
            await conLink.OpenAsync();
            await cmdLink.ExecuteNonQueryAsync();
        }

        // İlişkili satış kayıtlarını güncelle
        await GuncelleSatisKayitlariIliskiliAdimIcinAsync(azotluCapakAlmaId: id);
        
        return Ok(new { toplamMaliyet = (double)dToplam, birimBrutAgirlik });
    }

    [HttpDelete("azotlucapakalma/{id:int}")]
public async Task<IActionResult> SilAzotluCapakAlma(int id)
{
    using var con = new SqlConnection(_cs);
    using var cmd = con.CreateCommand();
    cmd.CommandText = "DELETE FROM dbo.AzotluCapakAlma WHERE Id=@id";
    cmd.Parameters.AddWithValue("@id", id);
    await con.OpenAsync();
    var affected = await cmd.ExecuteNonQueryAsync();
    if (affected == 0) return NotFound();
    return NoContent();
}

    [HttpPost("posturleme")]
    public ActionResult<double> Posturleme([FromBody] PosturlemeRequest req)
    {
        // Enjeksiyon'dan BaskiToplamBrutAgirlik ve KalipGozSayisi override
        double effectiveBaskiToplamBrutAgirlik = req.BaskiToplamBrutAgirlik;
        double effectiveKalipGozSayisi = req.KalipGozSayisi;
        if (req.SatisKaydiId.HasValue)
        {
            try
            {
                using var conFind = new SqlConnection(_cs);
                using var cmdFind = conFind.CreateCommand();
                cmdFind.CommandText = "SELECT EnjeksiyonId FROM dbo.SatisKayitlari WHERE Id=@sid";
                cmdFind.Parameters.AddWithValue("@sid", req.SatisKaydiId.Value);
                conFind.Open();
                var enjIdObj = cmdFind.ExecuteScalar();
                if (enjIdObj != null && !Convert.IsDBNull(enjIdObj))
                {
                    int enjId = Convert.ToInt32(enjIdObj);
                    using var conEnj = new SqlConnection(_cs);
                    using var cmdEnj = conEnj.CreateCommand();
                    cmdEnj.CommandText = "SELECT TOP 1 BaskiToplamBrutAgirlik, KalipGozSayisi FROM dbo.Enjeksiyon WHERE Id=@id";
                    cmdEnj.Parameters.AddWithValue("@id", enjId);
                    conEnj.Open();
                    using var rdEnj = cmdEnj.ExecuteReader();
                    if (rdEnj.Read())
                    {
                        var brut = rdEnj[0];
                        var goz = rdEnj[1];
                        if (brut != null && !Convert.IsDBNull(brut)) effectiveBaskiToplamBrutAgirlik = Convert.ToDouble(brut);
                        if (goz != null && !Convert.IsDBNull(goz)) effectiveKalipGozSayisi = Convert.ToDouble(goz);
                    }
                }
            }
            catch { }
        }

        if (effectiveKalipGozSayisi <= 0)
        {
            return BadRequest("Kalıp göz sayısı 0 veya negatif olamaz.");
        }

        double kalip1Saniye = 9 * 250 * 3600;
        double birimBrutAgirlik = effectiveBaskiToplamBrutAgirlik / effectiveKalipGozSayisi;
        double posturlemeSnKg = req.FullKapasiteOperasyonSuresiSn / req.IdealKg;
        double saniyeDetayi = posturlemeSnKg * birimBrutAgirlik / 1000.0;

        double elektrikSaniye = req.ElektrikUcreti / 3600.0;
        double elektrikMaliyeti = saniyeDetayi * elektrikSaniye / req.EuroKuru * req.KwDegeri;

        double operatorSaniyelikUcret = req.OperatorUcreti / 225.0 / 3600.0;
        double bazIscilikMaliyeti = operatorSaniyelikUcret * saniyeDetayi / req.EuroKuru;
        double toplamIscilikMaliyeti = req.IsciKatsayisi * req.IsciSayisi * bazIscilikMaliyeti;

        double faydaliOmurSaniye = req.FaydaliOmurYil * 9 * 250 * 3600;
        double amortismanMaliyeti = saniyeDetayi / faydaliOmurSaniye * req.MakineBedeliEuro;
        double makineBakimMaliyeti = saniyeDetayi / kalip1Saniye * req.YillikBakimBedeli;

        double toplamMaliyet = toplamIscilikMaliyeti + elektrikMaliyeti + amortismanMaliyeti + makineBakimMaliyeti;

        // SQL decimal(18,6) için güvenli dönüştürmeler
        decimal dElektrik = (decimal)Math.Round(elektrikMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dToplamIscilik = (decimal)Math.Round(toplamIscilikMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dAmortisman = (decimal)Math.Round(amortismanMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dMakineBakim = (decimal)Math.Round(makineBakimMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dToplam = (decimal)Math.Round(toplamMaliyet, 6, MidpointRounding.AwayFromZero);

        int id;
        using (var con = new SqlConnection(_cs))
        using (var cmd = con.CreateCommand())
        {
            cmd.CommandText = @"INSERT INTO dbo.Posturleme (
                EuroKuru, KwDegeri, FullKapasiteOperasyonSuresiSn, IdealKg, BaskiToplamBrutAgirlik, KalipGozSayisi,
                ElektrikUcreti, OperatorUcreti, IsciKatsayisi, IsciSayisi, MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli,
                ElektrikMaliyetiEuro, ToplamIscilikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro, ToplamMaliyetEuro, BirimBrutAgirlik
            ) VALUES (
                @EuroKuru, @KwDegeri, @FullKapasiteOperasyonSuresiSn, @IdealKg, @BaskiToplamBrutAgirlik, @KalipGozSayisi,
                @ElektrikUcreti, @OperatorUcreti, @IsciKatsayisi, @IsciSayisi, @MakineBedeliEuro, @FaydaliOmurYil, @YillikBakimBedeli,
                @ElektrikMaliyetiEuro, @ToplamIscilikMaliyetiEuro, @AmortismanMaliyetiEuro, @MakineBakimMaliyetiEuro, @ToplamMaliyetEuro, @BirimBrutAgirlik
            ); SELECT CAST(SCOPE_IDENTITY() AS int);";
            cmd.Parameters.AddWithValue("@EuroKuru", req.EuroKuru);
            cmd.Parameters.AddWithValue("@KwDegeri", req.KwDegeri);
            cmd.Parameters.AddWithValue("@FullKapasiteOperasyonSuresiSn", req.FullKapasiteOperasyonSuresiSn);
            cmd.Parameters.AddWithValue("@IdealKg", req.IdealKg);
            cmd.Parameters.AddWithValue("@BaskiToplamBrutAgirlik", effectiveBaskiToplamBrutAgirlik);
            cmd.Parameters.AddWithValue("@KalipGozSayisi", effectiveKalipGozSayisi);
            cmd.Parameters.AddWithValue("@ElektrikUcreti", req.ElektrikUcreti);
            cmd.Parameters.AddWithValue("@OperatorUcreti", req.OperatorUcreti);
            cmd.Parameters.AddWithValue("@IsciKatsayisi", req.IsciKatsayisi);
            cmd.Parameters.AddWithValue("@IsciSayisi", req.IsciSayisi);
            cmd.Parameters.AddWithValue("@MakineBedeliEuro", req.MakineBedeliEuro);
            cmd.Parameters.AddWithValue("@FaydaliOmurYil", req.FaydaliOmurYil);
            cmd.Parameters.AddWithValue("@YillikBakimBedeli", req.YillikBakimBedeli);
            cmd.Parameters.AddWithValue("@ElektrikMaliyetiEuro", dElektrik);
            cmd.Parameters.AddWithValue("@ToplamIscilikMaliyetiEuro", dToplamIscilik);
            cmd.Parameters.AddWithValue("@AmortismanMaliyetiEuro", dAmortisman);
            cmd.Parameters.AddWithValue("@MakineBakimMaliyetiEuro", dMakineBakim);
            cmd.Parameters.AddWithValue("@ToplamMaliyetEuro", dToplam);
            cmd.Parameters.AddWithValue("@BirimBrutAgirlik", birimBrutAgirlik);
            con.Open();
            id = (int)cmd.ExecuteScalar();
        }

        return Ok(new { id, toplamMaliyet, birimBrutAgirlik });
    }

    [HttpDelete("posturleme/{id:int}")]
public async Task<IActionResult> SilPosturleme(int id)
{
    using var con = new SqlConnection(_cs);
    using var cmd = con.CreateCommand();
    cmd.CommandText = "DELETE FROM dbo.Posturleme WHERE Id=@id";
    cmd.Parameters.AddWithValue("@id", id);
    await con.OpenAsync();
    var affected = await cmd.ExecuteNonQueryAsync();
    if (affected == 0) return NotFound();
    return NoContent();
}

    [HttpPost("santrifuj")]
    public ActionResult<object> Santrifuj([FromBody] SantrifujRequest req)
    {
        // Enjeksiyon'dan BaskiToplamBrutAgirlik ve KalipGozSayisi override
        double effectiveBaskiToplamBrutAgirlik = req.BaskiToplamBrutAgirlik;
        double effectiveKalipGozSayisi = req.KalipGozSayisi;
        if (req.SatisKaydiId.HasValue)
        {
            try
            {
                using var conFind = new SqlConnection(_cs);
                using var cmdFind = conFind.CreateCommand();
                cmdFind.CommandText = "SELECT EnjeksiyonId FROM dbo.SatisKayitlari WHERE Id=@sid";
                cmdFind.Parameters.AddWithValue("@sid", req.SatisKaydiId.Value);
                conFind.Open();
                var enjIdObj = cmdFind.ExecuteScalar();
                if (enjIdObj != null && !Convert.IsDBNull(enjIdObj))
                {
                    int enjId = Convert.ToInt32(enjIdObj);
                    using var conEnj = new SqlConnection(_cs);
                    using var cmdEnj = conEnj.CreateCommand();
                    cmdEnj.CommandText = "SELECT TOP 1 BaskiToplamBrutAgirlik, KalipGozSayisi FROM dbo.Enjeksiyon WHERE Id=@id";
                    cmdEnj.Parameters.AddWithValue("@id", enjId);
                    conEnj.Open();
                    using var rdEnj = cmdEnj.ExecuteReader();
                    if (rdEnj.Read())
                    {
                        var brut = rdEnj[0];
                        var goz = rdEnj[1];
                        if (brut != null && !Convert.IsDBNull(brut)) effectiveBaskiToplamBrutAgirlik = Convert.ToDouble(brut);
                        if (goz != null && !Convert.IsDBNull(goz)) effectiveKalipGozSayisi = Convert.ToDouble(goz);
                    }
                }
            }
            catch { }
        }

        if (effectiveKalipGozSayisi <= 0)
        {
            return BadRequest("Kalıp göz sayısı 0 veya negatif olamaz.");
        }

        double kalip1Saniye = 9 * 250 * 3600;
        double birimBrutAgirlik = effectiveBaskiToplamBrutAgirlik / effectiveKalipGozSayisi;
        double santrifujSnKg = req.FullKapasiteOperasyonSuresiSn / req.IdealKg;
        double saniyeDetayi = santrifujSnKg * birimBrutAgirlik / 1000.0;

        double elektrikSaniye = req.ElektrikUcreti / 3600.0;
        double elektrikMaliyeti = saniyeDetayi * elektrikSaniye / req.EuroKuru * req.KwDegeri;

        double operatorSaniyelikUcret = req.OperatorUcreti / 225.0 / 3600.0;
        double bazIscilikMaliyeti = operatorSaniyelikUcret * saniyeDetayi / req.EuroKuru;
        double toplamIscilikMaliyeti = req.IsciKatsayisi * req.IsciSayisi * bazIscilikMaliyeti;

        double faydaliOmurSaniye = req.FaydaliOmurYil * 9 * 250 * 3600;
        double amortismanMaliyeti = saniyeDetayi / faydaliOmurSaniye * req.MakineBedeliEuro;
        double makineBakimMaliyeti = saniyeDetayi / kalip1Saniye * req.YillikBakimBedeli;

        double toplamMaliyet = toplamIscilikMaliyeti + elektrikMaliyeti + amortismanMaliyeti + makineBakimMaliyeti;

        // SQL decimal(18,6) için güvenli dönüştürmeler
        decimal dElektrik = (decimal)Math.Round(elektrikMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dToplamIscilik = (decimal)Math.Round(toplamIscilikMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dAmortisman = (decimal)Math.Round(amortismanMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dMakineBakim = (decimal)Math.Round(makineBakimMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dToplam = (decimal)Math.Round(toplamMaliyet, 6, MidpointRounding.AwayFromZero);

        using (var con = new SqlConnection(_cs))
        using (var cmd = con.CreateCommand())
        {
            cmd.CommandText = @"INSERT INTO dbo.Santrifuj (
                EuroKuru, KwDegeri, FullKapasiteOperasyonSuresiSn, IdealKg, BaskiToplamBrutAgirlik, KalipGozSayisi,
                ElektrikUcreti, OperatorUcreti, IsciKatsayisi, IsciSayisi, MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli,
                ElektrikMaliyetiEuro, ToplamIscilikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro, ToplamMaliyetEuro, BirimBrutAgirlik
            ) VALUES (
                @EuroKuru, @KwDegeri, @FullKapasiteOperasyonSuresiSn, @IdealKg, @BaskiToplamBrutAgirlik, @KalipGozSayisi,
                @ElektrikUcreti, @OperatorUcreti, @IsciKatsayisi, @IsciSayisi, @MakineBedeliEuro, @FaydaliOmurYil, @YillikBakimBedeli,
                @ElektrikMaliyetiEuro, @ToplamIscilikMaliyetiEuro, @AmortismanMaliyetiEuro, @MakineBakimMaliyetiEuro, @ToplamMaliyetEuro, @BirimBrutAgirlik
            ); SELECT CAST(SCOPE_IDENTITY() AS int);";
            cmd.Parameters.AddWithValue("@EuroKuru", req.EuroKuru);
            cmd.Parameters.AddWithValue("@KwDegeri", req.KwDegeri);
            cmd.Parameters.AddWithValue("@FullKapasiteOperasyonSuresiSn", req.FullKapasiteOperasyonSuresiSn);
            cmd.Parameters.AddWithValue("@IdealKg", req.IdealKg);
            cmd.Parameters.AddWithValue("@BaskiToplamBrutAgirlik", effectiveBaskiToplamBrutAgirlik);
            cmd.Parameters.AddWithValue("@KalipGozSayisi", effectiveKalipGozSayisi);
            cmd.Parameters.AddWithValue("@ElektrikUcreti", req.ElektrikUcreti);
            cmd.Parameters.AddWithValue("@OperatorUcreti", req.OperatorUcreti);
            cmd.Parameters.AddWithValue("@IsciKatsayisi", req.IsciKatsayisi);
            cmd.Parameters.AddWithValue("@IsciSayisi", req.IsciSayisi);
            cmd.Parameters.AddWithValue("@MakineBedeliEuro", req.MakineBedeliEuro);
            cmd.Parameters.AddWithValue("@FaydaliOmurYil", req.FaydaliOmurYil);
            cmd.Parameters.AddWithValue("@YillikBakimBedeli", req.YillikBakimBedeli);
            cmd.Parameters.AddWithValue("@ElektrikMaliyetiEuro", dElektrik);
            cmd.Parameters.AddWithValue("@ToplamIscilikMaliyetiEuro", dToplamIscilik);
            cmd.Parameters.AddWithValue("@AmortismanMaliyetiEuro", dAmortisman);
            cmd.Parameters.AddWithValue("@MakineBakimMaliyetiEuro", dMakineBakim);
            cmd.Parameters.AddWithValue("@ToplamMaliyetEuro", dToplam);
            cmd.Parameters.AddWithValue("@BirimBrutAgirlik", birimBrutAgirlik);
            con.Open();
            var newId = (int)cmd.ExecuteScalar();
            return Ok(new { id = newId, toplamMaliyet, birimBrutAgirlik });
        }
    }

    [HttpDelete("santrifuj/{id:int}")]
public async Task<IActionResult> SilSantrifuj(int id)
{
    using var con = new SqlConnection(_cs);
    using var cmd = con.CreateCommand();
    cmd.CommandText = "DELETE FROM dbo.Santrifuj WHERE Id=@id";
    cmd.Parameters.AddWithValue("@id", id);
    await con.OpenAsync();
    var affected = await cmd.ExecuteNonQueryAsync();
    if (affected == 0) return NotFound();
    return NoContent();
}

    [HttpPost("yikama")]
    public ActionResult<object> Yikama([FromBody] YikamaRequest req)
    {
        // Enjeksiyon'dan BaskiToplamBrutAgirlik ve KalipGozSayisi override
        double effectiveBaskiToplamBrutAgirlik = req.BaskiToplamBrutAgirlik;
        double effectiveKalipGozSayisi = req.KalipGozSayisi;
        if (req.SatisKaydiId.HasValue)
        {
            try
            {
                using var conFind = new SqlConnection(_cs);
                using var cmdFind = conFind.CreateCommand();
                cmdFind.CommandText = "SELECT EnjeksiyonId FROM dbo.SatisKayitlari WHERE Id=@sid";
                cmdFind.Parameters.AddWithValue("@sid", req.SatisKaydiId.Value);
                conFind.Open();
                var enjIdObj = cmdFind.ExecuteScalar();
                if (enjIdObj != null && !Convert.IsDBNull(enjIdObj))
                {
                    int enjId = Convert.ToInt32(enjIdObj);
                    using var conEnj = new SqlConnection(_cs);
                    using var cmdEnj = conEnj.CreateCommand();
                    cmdEnj.CommandText = "SELECT TOP 1 BaskiToplamBrutAgirlik, KalipGozSayisi FROM dbo.Enjeksiyon WHERE Id=@id";
                    cmdEnj.Parameters.AddWithValue("@id", enjId);
                    conEnj.Open();
                    using var rdEnj = cmdEnj.ExecuteReader();
                    if (rdEnj.Read())
                    {
                        var brut = rdEnj[0];
                        var goz = rdEnj[1];
                        if (brut != null && !Convert.IsDBNull(brut)) effectiveBaskiToplamBrutAgirlik = Convert.ToDouble(brut);
                        if (goz != null && !Convert.IsDBNull(goz)) effectiveKalipGozSayisi = Convert.ToDouble(goz);
                    }
                }
            }
            catch { }
        }

        if (effectiveKalipGozSayisi <= 0)
        {
            return BadRequest("Kalıp göz sayısı 0 veya negatif olamaz.");
        }

        if (req.IdealKg <= 0)
        {
            return BadRequest("İdeal kg değeri 0 veya negatif olamaz.");
        }

        if (req.EuroKuru <= 0)
        {
            return BadRequest("Euro kuru 0 veya negatif olamaz.");
        }

        double kalip1Saniye = 9 * 250 * 3600;
        double birimBrutAgirlik = effectiveBaskiToplamBrutAgirlik / effectiveKalipGozSayisi;
        double yikamaSnKg = req.FullKapasiteOperasyonSuresiSn / req.IdealKg;
        double saniyeDetayi = yikamaSnKg * birimBrutAgirlik / 1000.0;

        // Malzeme maliyeti (yıkama için deterjan)
        double malzemeMaliyeti = saniyeDetayi * req.DeterjanSaatlikFiyatEuro / 3600.0;

        // İşçilik maliyeti
        double operatorSaniyelikUcret = req.OperatorUcreti / 225.0 / 3600.0;
        double bazIscilikMaliyeti = operatorSaniyelikUcret * saniyeDetayi / req.EuroKuru;
        double iscilikMaliyeti = req.IsciKatsayisi * req.IsciSayisi * bazIscilikMaliyeti;

        // Elektrik maliyeti
        double elektrikSaniye = req.ElektrikUcreti / 3600.0;
        double elektrikMaliyeti = saniyeDetayi * elektrikSaniye / req.EuroKuru * req.KwDegeri;

        // Amortisman maliyeti
        double faydaliOmurSaniye = req.FaydaliOmurYil * 9 * 250 * 3600;
        double amortismanMaliyeti = saniyeDetayi / faydaliOmurSaniye * req.MakineBedeliEuro;

        // Makine bakım maliyeti
        double makineBakimMaliyeti = saniyeDetayi / kalip1Saniye * req.YillikBakimBedeli;

        double toplamMaliyet = malzemeMaliyeti + iscilikMaliyeti + elektrikMaliyeti + amortismanMaliyeti + makineBakimMaliyeti;

        // SQL decimal(18,6) için güvenli dönüştürmeler
        decimal dElektrik = (decimal)Math.Round(elektrikMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dIscilik = (decimal)Math.Round(iscilikMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dAmortisman = (decimal)Math.Round(amortismanMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dMakineBakim = (decimal)Math.Round(makineBakimMaliyeti, 6, MidpointRounding.AwayFromZero);
        decimal dMalzeme = (decimal)Math.Round(malzemeMaliyeti, 11, MidpointRounding.AwayFromZero);
        decimal dToplam = (decimal)Math.Round(toplamMaliyet, 6, MidpointRounding.AwayFromZero);

        using (var con = new SqlConnection(_cs))
        using (var cmd = con.CreateCommand())
        {
            cmd.CommandText = @"INSERT INTO dbo.Yikama (
                EuroKuru, KwDegeri, FullKapasiteOperasyonSuresiSn, IdealKg, BaskiToplamBrutAgirlik, KalipGozSayisi,
                ElektrikUcreti, OperatorUcreti, IsciKatsayisi, IsciSayisi, MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli, DeterjanSaatlikFiyatEuro,
                ElektrikMaliyetiEuro, ToplamIscilikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro, DeterjanMaliyetiEuro, ToplamMaliyetEuro, BirimBrutAgirlik
            ) VALUES (
                @EuroKuru, @KwDegeri, @FullKapasiteOperasyonSuresiSn, @IdealKg, @BaskiToplamBrutAgirlik, @KalipGozSayisi,
                @ElektrikUcreti, @OperatorUcreti, @IsciKatsayisi, @IsciSayisi, @MakineBedeliEuro, @FaydaliOmurYil, @YillikBakimBedeli, @DeterjanSaatlikFiyatEuro,
                @ElektrikMaliyetiEuro, @ToplamIscilikMaliyetiEuro, @AmortismanMaliyetiEuro, @MakineBakimMaliyetiEuro, @DeterjanMaliyetiEuro, @ToplamMaliyetEuro, @BirimBrutAgirlik
            ); SELECT CAST(SCOPE_IDENTITY() AS int);";
            cmd.Parameters.AddWithValue("@EuroKuru", req.EuroKuru);
            cmd.Parameters.AddWithValue("@KwDegeri", req.KwDegeri);
            cmd.Parameters.AddWithValue("@FullKapasiteOperasyonSuresiSn", req.FullKapasiteOperasyonSuresiSn);
            cmd.Parameters.AddWithValue("@IdealKg", req.IdealKg);
            cmd.Parameters.AddWithValue("@BaskiToplamBrutAgirlik", effectiveBaskiToplamBrutAgirlik);
            cmd.Parameters.AddWithValue("@KalipGozSayisi", effectiveKalipGozSayisi);
            cmd.Parameters.AddWithValue("@ElektrikUcreti", req.ElektrikUcreti);
            cmd.Parameters.AddWithValue("@OperatorUcreti", req.OperatorUcreti);
            cmd.Parameters.AddWithValue("@IsciKatsayisi", req.IsciKatsayisi);
            cmd.Parameters.AddWithValue("@IsciSayisi", req.IsciSayisi);
            cmd.Parameters.AddWithValue("@MakineBedeliEuro", req.MakineBedeliEuro);
            cmd.Parameters.AddWithValue("@FaydaliOmurYil", req.FaydaliOmurYil);
            cmd.Parameters.AddWithValue("@YillikBakimBedeli", req.YillikBakimBedeli);
            cmd.Parameters.AddWithValue("@DeterjanSaatlikFiyatEuro", req.DeterjanSaatlikFiyatEuro);
            cmd.Parameters.AddWithValue("@ElektrikMaliyetiEuro", dElektrik);
            cmd.Parameters.AddWithValue("@ToplamIscilikMaliyetiEuro", dIscilik);
            cmd.Parameters.AddWithValue("@AmortismanMaliyetiEuro", dAmortisman);
            cmd.Parameters.AddWithValue("@MakineBakimMaliyetiEuro", dMakineBakim);
            cmd.Parameters.AddWithValue("@DeterjanMaliyetiEuro", dMalzeme);
            cmd.Parameters.AddWithValue("@ToplamMaliyetEuro", dToplam);
            cmd.Parameters.AddWithValue("@BirimBrutAgirlik", birimBrutAgirlik);
            con.Open();
            var newId = (int)cmd.ExecuteScalar();
            return Ok(new { id = newId, toplamMaliyet, birimBrutAgirlik });
        }
    }

    [HttpDelete("yikama/{id:int}")]
public async Task<IActionResult> SilYikama(int id)
{
    using var con = new SqlConnection(_cs);
    using var cmd = con.CreateCommand();
    cmd.CommandText = "DELETE FROM dbo.Yikama WHERE Id=@id";
    cmd.Parameters.AddWithValue("@id", id);
    await con.OpenAsync();
    var affected = await cmd.ExecuteNonQueryAsync();
    if (affected == 0) return NotFound();
    return NoContent();
}

    [HttpGet("son-maliyetler")]
    public ActionResult<object> SonMaliyetler([FromQuery] string? hesaplamaTurleri = null)
    {
        // Hesaplama türlerini parse et
        var secilenTurler = new List<string>();
        if (!string.IsNullOrEmpty(hesaplamaTurleri))
        {
            secilenTurler = hesaplamaTurleri.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(t => t.Trim())
                .ToList();
        }
        else
        {
            // Eğer hiç tür belirtilmemişse, tüm türleri getir
            secilenTurler = new List<string> { "Enjeksiyon", "AzotluCapakAlma", "Posturleme", "Santrifuj", "Yikama" };
        }

        using (var con = new SqlConnection(_cs))
        using (var cmd = con.CreateCommand())
        {
            // Dinamik SQL sorgusu oluştur
            var sqlParts = new List<string>();
            
            if (secilenTurler.Contains("Enjeksiyon"))
            {
                sqlParts.Add(@"
                    SELECT 
                        'Enjeksiyon' AS HesaplamaTuru,
                        ISNULL(e.MalzemeMaliyetiEuro, 0) AS MalzemeMaliyeti,
                        ISNULL(e.ToplamIscilikMaliyetiEuro, 0) AS IscilikMaliyeti,
                        ISNULL(e.ElektrikMaliyetiEuro, 0) AS ElektrikMaliyeti,
                        ISNULL(e.AmortismanMaliyetiEuro, 0) AS AmortismanMaliyeti,
                        ISNULL(e.MakineBakimMaliyetiEuro, 0) AS MakineBakimMaliyeti,
                        ISNULL(e.KalipMaliyetiEuro, 0) AS KalipMaliyeti,
                        ISNULL(e.ToplamMaliyetEuro, 0) AS ToplamMaliyet
                    FROM (
                        SELECT TOP 1 MalzemeMaliyetiEuro, ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro, KalipMaliyetiEuro, ToplamMaliyetEuro
                        FROM dbo.Enjeksiyon
                        ORDER BY Id DESC
                    ) e");
            }
            
            if (secilenTurler.Contains("AzotluCapakAlma"))
            {
                sqlParts.Add(@"
                    SELECT 
                        'AzotluCapakAlma' AS HesaplamaTuru,
                        ISNULL(a.HarcananBirimAzotMaliyetiEuro, 0) AS MalzemeMaliyeti,
                        ISNULL(a.ToplamIscilikMaliyetiEuro, 0) AS IscilikMaliyeti,
                        ISNULL(a.ElektrikMaliyetiEuro, 0) AS ElektrikMaliyeti,
                        ISNULL(a.AmortismanMaliyetiEuro, 0) AS AmortismanMaliyeti,
                        ISNULL(a.MakineBakimMaliyetiEuro, 0) AS MakineBakimMaliyeti,
                        ISNULL(a.HarcananBirimTasMaliyetiEuro, 0) AS KalipMaliyeti,
                        ISNULL(a.ToplamMaliyetEuro, 0) AS ToplamMaliyet
                    FROM (
                        SELECT TOP 1 HarcananBirimAzotMaliyetiEuro, ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro, HarcananBirimTasMaliyetiEuro, ToplamMaliyetEuro
                        FROM dbo.AzotluCapakAlma
                        ORDER BY Id DESC
                    ) a");
            }
            
            if (secilenTurler.Contains("Posturleme"))
            {
                sqlParts.Add(@"
                    SELECT 
                        'Posturleme' AS HesaplamaTuru,
                        CAST(0 AS decimal(18,4)) AS MalzemeMaliyeti,
                        ISNULL(p.ToplamIscilikMaliyetiEuro, 0) AS IscilikMaliyeti,
                        ISNULL(p.ElektrikMaliyetiEuro, 0) AS ElektrikMaliyeti,
                        ISNULL(p.AmortismanMaliyetiEuro, 0) AS AmortismanMaliyeti,
                        ISNULL(p.MakineBakimMaliyetiEuro, 0) AS MakineBakimMaliyeti,
                        CAST(0 AS decimal(18,4)) AS KalipMaliyeti,
                        ISNULL(p.ToplamMaliyetEuro, 0) AS ToplamMaliyet
                    FROM (
                        SELECT TOP 1 ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro, ToplamMaliyetEuro
                        FROM dbo.Posturleme
                        ORDER BY Id DESC
                    ) p");
            }
            
            if (secilenTurler.Contains("Santrifuj"))
            {
                sqlParts.Add(@"
                    SELECT 
                        'Santrifuj' AS HesaplamaTuru,
                        CAST(0 AS decimal(18,4)) AS MalzemeMaliyeti,
                        ISNULL(s.ToplamIscilikMaliyetiEuro, 0) AS IscilikMaliyeti,
                        ISNULL(s.ElektrikMaliyetiEuro, 0) AS ElektrikMaliyeti,
                        ISNULL(s.AmortismanMaliyetiEuro, 0) AS AmortismanMaliyeti,
                        ISNULL(s.MakineBakimMaliyetiEuro, 0) AS MakineBakimMaliyeti,
                        CAST(0 AS decimal(18,4)) AS KalipMaliyeti,
                        ISNULL(s.ToplamMaliyetEuro, 0) AS ToplamMaliyet
                    FROM (
                        SELECT TOP 1 ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro, ToplamMaliyetEuro
                        FROM dbo.Santrifuj
                        ORDER BY Id DESC
                    ) s");
            }
            
            if (secilenTurler.Contains("Yikama"))
            {
                sqlParts.Add(@"
                    SELECT 
                        'Yikama' AS HesaplamaTuru,
                        ISNULL(y.DeterjanMaliyetiEuro, 0) AS MalzemeMaliyeti,
                        ISNULL(y.ToplamIscilikMaliyetiEuro, 0) AS IscilikMaliyeti,
                        ISNULL(y.ElektrikMaliyetiEuro, 0) AS ElektrikMaliyeti,
                        ISNULL(y.AmortismanMaliyetiEuro, 0) AS AmortismanMaliyeti,
                        ISNULL(y.MakineBakimMaliyetiEuro, 0) AS MakineBakimMaliyeti,
                        CAST(0 AS decimal(18,4)) AS KalipMaliyeti,
                        ISNULL(y.ToplamMaliyetEuro, 0) AS ToplamMaliyet
                    FROM (
                        SELECT TOP 1 DeterjanMaliyetiEuro, ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro, ToplamMaliyetEuro
                        FROM dbo.Yikama
                        ORDER BY Id DESC
                    ) y");
            }
            
            if (sqlParts.Count == 0)
            {
                return Ok(new { sonMaliyetler = new List<object>(), genelToplamlar = new { malzemeMaliyeti = 0, iscilikMaliyeti = 0, elektrikMaliyeti = 0, amortismanMaliyeti = 0, makineBakimMaliyeti = 0, kalipMaliyeti = 0, toplamMaliyet = 0 } });
            }
            
            cmd.CommandText = string.Join(" UNION ALL ", sqlParts);
            
            con.Open();
            using (var reader = cmd.ExecuteReader())
            {
                var sonMaliyetler = new List<object>();

                double genelMalzeme = 0;
                double genelIscilik = 0;
                double genelElektrik = 0;
                double genelAmortisman = 0;
                double genelMakineBakim = 0;
                double genelKalip = 0;

                int ordTur = reader.GetOrdinal("HesaplamaTuru");
                int ordMalzeme = reader.GetOrdinal("MalzemeMaliyeti");
                int ordIscilik = reader.GetOrdinal("IscilikMaliyeti");
                int ordElektrik = reader.GetOrdinal("ElektrikMaliyeti");
                int ordAmortisman = reader.GetOrdinal("AmortismanMaliyeti");
                int ordMakineBakim = reader.GetOrdinal("MakineBakimMaliyeti");
                int ordKalip = reader.GetOrdinal("KalipMaliyeti");
                int ordToplam = reader.GetOrdinal("ToplamMaliyet");

                while (reader.Read())
                {
                    string tur = reader.IsDBNull(ordTur) ? string.Empty : reader.GetString(ordTur);
                    double malzeme = reader.IsDBNull(ordMalzeme) ? 0 : Convert.ToDouble(reader.GetValue(ordMalzeme));
                    double iscilik = reader.IsDBNull(ordIscilik) ? 0 : Convert.ToDouble(reader.GetValue(ordIscilik));
                    double elektrik = reader.IsDBNull(ordElektrik) ? 0 : Convert.ToDouble(reader.GetValue(ordElektrik));
                    double amortisman = reader.IsDBNull(ordAmortisman) ? 0 : Convert.ToDouble(reader.GetValue(ordAmortisman));
                    double makineBakim = reader.IsDBNull(ordMakineBakim) ? 0 : Convert.ToDouble(reader.GetValue(ordMakineBakim));
                    double kalip = reader.IsDBNull(ordKalip) ? 0 : Convert.ToDouble(reader.GetValue(ordKalip));
                    double toplam = reader.IsDBNull(ordToplam) ? 0 : Convert.ToDouble(reader.GetValue(ordToplam));

                    sonMaliyetler.Add(new
                    {
                        hesaplamaTuru = tur,
                        malzemeMaliyeti = malzeme,
                        iscilikMaliyeti = iscilik,
                        elektrikMaliyeti = elektrik,
                        amortismanMaliyeti = amortisman,
                        makineBakimMaliyeti = makineBakim,
                        kalipMaliyeti = kalip,
                        toplamMaliyet = toplam
                    });

                    genelMalzeme += malzeme;
                    genelIscilik += iscilik;
                    genelElektrik += elektrik;
                    genelAmortisman += amortisman;
                    genelMakineBakim += makineBakim;
                    genelKalip += kalip;
                    // genelToplam'ı ayrı ayrı hesapla, toplam değerleri toplama
                }

                // Genel toplamı maliyet bileşenlerinin toplamı olarak hesapla
                double hesaplananGenelToplam = genelMalzeme + genelIscilik + genelElektrik + genelAmortisman + genelMakineBakim + genelKalip;

                return Ok(new
                {
                    sonMaliyetler = sonMaliyetler,
                    genelToplamlar = new
                    {
                        malzemeMaliyeti = genelMalzeme,
                        iscilikMaliyeti = genelIscilik,
                        elektrikMaliyeti = genelElektrik,
                        amortismanMaliyeti = genelAmortisman,
                        makineBakimMaliyeti = genelMakineBakim,
                        kalipMaliyeti = genelKalip,
                        toplamMaliyet = hesaplananGenelToplam
                    }
                });
            }
        }
    }

    [HttpPost("satis-kayitlari")]
    public async Task<ActionResult<object>> KaydetSatisKaydi([FromBody] SatisKaydiRequest req)
    {
        // Debug: Gelen veriyi logla
        Console.WriteLine($"POST SatisKaydi - Gelen veri: {JsonSerializer.Serialize(req)}");
        Console.WriteLine($"PosturlemeId: {req.PosturlemeId}, EnjeksiyonId: {req.EnjeksiyonId}, SantrifujId: {req.SantrifujId}, YikamaId: {req.YikamaId}, AzotluCapakAlmaId: {req.AzotluCapakAlmaId}");

        // 1) Gönderilmeyen ID'leri Formlar içeriğinden otomatik çıkar
        int? posturlemeId = req.PosturlemeId;
        int? enjeksiyonId = req.EnjeksiyonId;
        int? santrifujId = req.SantrifujId;
        int? yikamaId = req.YikamaId;
        int? azotluCapakAlmaId = req.AzotluCapakAlmaId;

        if (req.Formlar != null)
        {
            try
            {
                JsonElement root;
                if (req.Formlar is JsonElement je)
                {
                    root = je;
                }
                else if (req.Formlar is string s)
                {
                    Console.WriteLine($"Formlar string olarak geldi, uzunluk={s.Length}");
                    using var doc = JsonDocument.Parse(s);
                    root = doc.RootElement.Clone();
                }
                else
                {
                    var json = JsonSerializer.Serialize(req.Formlar);
                    Console.WriteLine($"Formlar serialize edildi, uzunluk={json.Length}");
                    root = JsonSerializer.Deserialize<JsonElement>(json);
                }

                enjeksiyonId ??= FindStepId(root, "Enjeksiyon");
                azotluCapakAlmaId ??= FindStepId(root, "AzotluCapakAlma");
                posturlemeId ??= FindStepId(root, "Posturleme");
                santrifujId ??= FindStepId(root, "Santrifuj");
                yikamaId ??= FindStepId(root, "Yikama");

                Console.WriteLine($"Formlar'dan çıkarılan ID'ler => Enj:{enjeksiyonId}, Azotlu:{azotluCapakAlmaId}, Post:{posturlemeId}, San:{santrifujId}, Yik:{yikamaId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Formlar parse hatası: {ex.Message}");
            }
        }

        // 2) BirimBrutAgirlik değerini hesapla
        double? birimBrutAgirlik = null;

        if (posturlemeId.HasValue)
        {
            Console.WriteLine($"PosturlemeId değeri: {posturlemeId.Value}");
            using var conPosturleme = new SqlConnection(_cs);
            using var cmdPosturleme = conPosturleme.CreateCommand();
            cmdPosturleme.CommandText = "SELECT BirimBrutAgirlik FROM dbo.Posturleme WHERE Id=@id";
            cmdPosturleme.Parameters.AddWithValue("@id", posturlemeId.Value);
            await conPosturleme.OpenAsync();
            var posturlemeResult = await cmdPosturleme.ExecuteScalarAsync();
            Console.WriteLine($"Posturleme sorgu sonucu: {posturlemeResult}");
            if (posturlemeResult != null && !Convert.IsDBNull(posturlemeResult))
            {
                birimBrutAgirlik = Convert.ToDouble(posturlemeResult);
                Console.WriteLine($"BirimBrutAgirlik bulundu: {birimBrutAgirlik}");
            }
            else
            {
                Console.WriteLine("Posturleme ID bulunamadı: " + posturlemeId.Value);
            }
        }
        else if (enjeksiyonId.HasValue)
        {
            using var conEnjeksiyon = new SqlConnection(_cs);
            using var cmdEnjeksiyon = conEnjeksiyon.CreateCommand();
            cmdEnjeksiyon.CommandText = "SELECT BirimBrutAgirlik FROM dbo.Enjeksiyon WHERE Id=@id";
            cmdEnjeksiyon.Parameters.AddWithValue("@id", enjeksiyonId.Value);
            await conEnjeksiyon.OpenAsync();
            var enjeksiyonResult = await cmdEnjeksiyon.ExecuteScalarAsync();
            if (enjeksiyonResult != null && !Convert.IsDBNull(enjeksiyonResult))
            {
                birimBrutAgirlik = Convert.ToDouble(enjeksiyonResult);
            }
        }
        else if (santrifujId.HasValue)
        {
            using var conSantrifuj = new SqlConnection(_cs);
            using var cmdSantrifuj = conSantrifuj.CreateCommand();
            cmdSantrifuj.CommandText = "SELECT BirimBrutAgirlik FROM dbo.Santrifuj WHERE Id=@id";
            cmdSantrifuj.Parameters.AddWithValue("@id", santrifujId.Value);
            await conSantrifuj.OpenAsync();
            var santrifujResult = await cmdSantrifuj.ExecuteScalarAsync();
            if (santrifujResult != null && !Convert.IsDBNull(santrifujResult))
            {
                birimBrutAgirlik = Convert.ToDouble(santrifujResult);
            }
        }
        else if (yikamaId.HasValue)
        {
            using var conYikama = new SqlConnection(_cs);
            using var cmdYikama = conYikama.CreateCommand();
            cmdYikama.CommandText = "SELECT BirimBrutAgirlik FROM dbo.Yikama WHERE Id=@id";
            cmdYikama.Parameters.AddWithValue("@id", yikamaId.Value);
            await conYikama.OpenAsync();
            var yikamaResult = await cmdYikama.ExecuteScalarAsync();
            if (yikamaResult != null && !Convert.IsDBNull(yikamaResult))
            {
                birimBrutAgirlik = Convert.ToDouble(yikamaResult);
            }
        }
        else if (azotluCapakAlmaId.HasValue)
        {
            using var conAzotlu = new SqlConnection(_cs);
            using var cmdAzotlu = conAzotlu.CreateCommand();
            cmdAzotlu.CommandText = "SELECT BirimBrutAgirlik FROM dbo.AzotluCapakAlma WHERE Id=@id";
            cmdAzotlu.Parameters.AddWithValue("@id", azotluCapakAlmaId.Value);
            await conAzotlu.OpenAsync();
            var azotluResult = await cmdAzotlu.ExecuteScalarAsync();
            if (azotluResult != null && !Convert.IsDBNull(azotluResult))
            {
                birimBrutAgirlik = Convert.ToDouble(azotluResult);
            }
        }

        // 3) Birim hammadde maliyeti (sadece enjeksiyon)
        double? birimHammaddeMaliyeti = null;
        if (enjeksiyonId.HasValue && birimBrutAgirlik.HasValue)
        {
            using var conHammadde = new SqlConnection(_cs);
            using var cmdHammadde = conHammadde.CreateCommand();
            cmdHammadde.CommandText = "SELECT HammaddeFiyatiEuro FROM dbo.Enjeksiyon WHERE Id=@id";
            cmdHammadde.Parameters.AddWithValue("@id", enjeksiyonId.Value);
            await conHammadde.OpenAsync();
            var hammaddeResult = await cmdHammadde.ExecuteScalarAsync();
            if (hammaddeResult != null && !Convert.IsDBNull(hammaddeResult))
            {
                double hammaddeFiyati = Convert.ToDouble(hammaddeResult);
                birimHammaddeMaliyeti = birimBrutAgirlik.Value * hammaddeFiyati;
            }
        }

        // INSERT öncesi son kontrol logları
        Console.WriteLine($"INSERT'e gidecek ID'ler => EnjeksiyonId:{enjeksiyonId}, AzotluCapakAlmaId:{azotluCapakAlmaId}, PosturlemeId:{posturlemeId}, SantrifujId:{santrifujId}, YikamaId:{yikamaId}");
        Console.WriteLine($"BirimBrutAgirlik:{birimBrutAgirlik}, BirimHammaddeMaliyeti:{birimHammaddeMaliyeti}");

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();

        // Net üretim maliyeti (ToplamMaliyet x Adet). Adet yalnızca Enjeksiyon tablosunda mevcut.
        decimal? netUretimMaliyeti = null;
        decimal? adetForCalc = null; // Adet*ToplamYanUrunMaliyetiEuro için de kullanılacak
        if (enjeksiyonId.HasValue)
        {
            using var conAdet = new SqlConnection(_cs);
            using var cmdAdet = conAdet.CreateCommand();
            cmdAdet.CommandText = "SELECT Adet FROM dbo.Enjeksiyon WHERE Id=@id";
            cmdAdet.Parameters.AddWithValue("@id", enjeksiyonId.Value);
            await conAdet.OpenAsync();
            var adetObj = await cmdAdet.ExecuteScalarAsync();
            if (adetObj != null && !Convert.IsDBNull(adetObj))
            {
                var adetVal = Convert.ToDecimal(adetObj);
                adetForCalc = adetVal;
                netUretimMaliyeti = req.Degerler.ToplamMaliyet * adetVal;
            }
        }

        // Yan urun turu ve maliyetleri hazirla
        string? yanUrunTuru = null;
        decimal? deterjanMaliyetiEuro = null;
        decimal? birimNetAgirlikFromAzot = null;
        decimal? harcananBirimAzotMaliyetiEuro = null;
        decimal? harcananBirimTasMaliyetiEuro = null;
        var yanUrunEtiketleri = new List<string>();

        if (azotluCapakAlmaId.HasValue)
        {
            // Etiket sirasi: tas, azot
            yanUrunEtiketleri.Add("taş");
            yanUrunEtiketleri.Add("azot");

            using var conAzot = new SqlConnection(_cs);
            using var cmdAzot = conAzot.CreateCommand();
            cmdAzot.CommandText = "SELECT HarcananBirimAzotMaliyetiEuro, HarcananBirimTasMaliyetiEuro, BirimNetAgirlik FROM dbo.AzotluCapakAlma WHERE Id=@id";
            cmdAzot.Parameters.AddWithValue("@id", azotluCapakAlmaId.Value);
            await conAzot.OpenAsync();
            using var rdAzot = await cmdAzot.ExecuteReaderAsync();
            if (await rdAzot.ReadAsync())
            {
                if (!rdAzot.IsDBNull(0)) harcananBirimAzotMaliyetiEuro = rdAzot.GetDecimal(0);
                if (!rdAzot.IsDBNull(1)) harcananBirimTasMaliyetiEuro = rdAzot.GetDecimal(1);
                if (!rdAzot.IsDBNull(2)) birimNetAgirlikFromAzot = rdAzot.GetDecimal(2);
            }
        }

        if (yikamaId.HasValue)
        {
            yanUrunEtiketleri.Add("deterjan");
            using var conYik = new SqlConnection(_cs);
            using var cmdYik = conYik.CreateCommand();
            cmdYik.CommandText = "SELECT DeterjanMaliyetiEuro FROM dbo.Yikama WHERE Id=@id";
            cmdYik.Parameters.AddWithValue("@id", yikamaId.Value);
            await conYik.OpenAsync();
            var det = await cmdYik.ExecuteScalarAsync();
            if (det != null && !Convert.IsDBNull(det))
            {
                deterjanMaliyetiEuro = Convert.ToDecimal(det);
            }
        }

        // AdetToplamUrunMaliyetiEuro = Adet * (HarcananBirimAzot + HarcananBirimTas + Deterjan)
        decimal toplamYanUrunMaliyetiEuro = (harcananBirimAzotMaliyetiEuro ?? 0m) + (harcananBirimTasMaliyetiEuro ?? 0m) + (deterjanMaliyetiEuro ?? 0m);
        decimal? adetToplamUrunMaliyetiEuro = adetForCalc.HasValue ? adetForCalc.Value * toplamYanUrunMaliyetiEuro : null;

        if (yanUrunEtiketleri.Count > 0)
        {
            yanUrunTuru = string.Join(", ", yanUrunEtiketleri);
        }

        cmd.CommandText = @"INSERT INTO dbo.SatisKayitlari
            (Ad, MalzemeMaliyeti, IscilikMaliyeti, ElektrikMaliyeti, AmortismanMaliyeti, MakineBakimMaliyeti, KalipMaliyeti, ToplamMaliyet, NetUretimMaliyeti,
             Formlar, EnjeksiyonId, AzotluCapakAlmaId, PosturlemeId, SantrifujId, YikamaId, BirimBrutAgirlik, BirimHammaddeMaliyetiEuro,
             YanUrunTuru, HarcananBirimAzotMaliyetiEuro, HarcananBirimTasMaliyetiEuro, DeterjanMaliyetiEuro, BirimNetAgirlik, AdetToplamUrunMaliyetiEuro)
            VALUES (@Ad, @Malzeme, @Iscilik, @Elektrik, @Amortisman, @MakineBakim, @Kalip, @Toplam, @NetUretim,
             @Formlar, @EnjeksiyonId, @AzotluCapakAlmaId, @PosturlemeId, @SantrifujId, @YikamaId, @BirimBrutAgirlik, @BirimHammaddeMaliyetiEuro,
             @YanUrunTuru, @HarcananBirimAzotMaliyetiEuro, @HarcananBirimTasMaliyetiEuro, @DeterjanMaliyetiEuro, @BirimNetAgirlik, @AdetToplamUrunMaliyetiEuro);
            SELECT CAST(SCOPE_IDENTITY() AS int);";
        cmd.Parameters.AddWithValue("@Ad", req.Ad);
        cmd.Parameters.AddWithValue("@Malzeme", req.Degerler.MalzemeMaliyeti);
        cmd.Parameters.AddWithValue("@Iscilik", req.Degerler.IscilikMaliyeti);
        cmd.Parameters.AddWithValue("@Elektrik", req.Degerler.ElektrikMaliyeti);
        cmd.Parameters.AddWithValue("@Amortisman", req.Degerler.AmortismanMaliyeti);
        cmd.Parameters.AddWithValue("@MakineBakim", req.Degerler.MakineBakimMaliyeti);
        cmd.Parameters.AddWithValue("@Kalip", req.Degerler.KalipMaliyeti);
        cmd.Parameters.AddWithValue("@Toplam", req.Degerler.ToplamMaliyet);
        cmd.Parameters.AddWithValue("@Formlar", req.Formlar != null ? JsonSerializer.Serialize(req.Formlar) : (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@NetUretim", (object?)netUretimMaliyeti ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@EnjeksiyonId", (object?)enjeksiyonId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@AzotluCapakAlmaId", (object?)azotluCapakAlmaId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@PosturlemeId", (object?)posturlemeId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@SantrifujId", (object?)santrifujId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@YikamaId", (object?)yikamaId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@BirimBrutAgirlik", (object?)birimBrutAgirlik ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@BirimHammaddeMaliyetiEuro", (object?)birimHammaddeMaliyeti ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@YanUrunTuru", (object?)yanUrunTuru ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@HarcananBirimAzotMaliyetiEuro", (object?)harcananBirimAzotMaliyetiEuro ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@HarcananBirimTasMaliyetiEuro", (object?)harcananBirimTasMaliyetiEuro ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@DeterjanMaliyetiEuro", (object?)deterjanMaliyetiEuro ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@BirimNetAgirlik", (object?)birimNetAgirlikFromAzot ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@AdetToplamUrunMaliyetiEuro", (object?)adetToplamUrunMaliyetiEuro ?? DBNull.Value);
        await con.OpenAsync();
        var result = await cmd.ExecuteScalarAsync();
        var id = result != null ? (int)result : 0;
        
        Console.WriteLine($"Satış kaydı eklendi! ID={id}, EnjeksiyonId={enjeksiyonId}, AzotluCapakAlmaId={azotluCapakAlmaId}");
        
        return Created($"/api/hesaplama/satis-kayitlari/{id}", new { id, ad = req.Ad, birimBrutAgirlik, birimHammaddeMaliyeti });
    }

    [HttpPost("test-satis-kayitlari")]
    public ActionResult<object> TestSatisKaydi([FromBody] SatisKaydiRequest req)
    {
        // Debug: Gelen veriyi logla ve geri döndür
        Console.WriteLine($"TEST POST SatisKaydi - Gelen veri: {JsonSerializer.Serialize(req)}");
        Console.WriteLine($"PosturlemeId: {req.PosturlemeId}, EnjeksiyonId: {req.EnjeksiyonId}, SantrifujId: {req.SantrifujId}, YikamaId: {req.YikamaId}, AzotluCapakAlmaId: {req.AzotluCapakAlmaId}");
        
        return Ok(new { 
            message = "Test başarılı", 
            receivedData = req,
            posturlemeId = req.PosturlemeId,
            enjeksiyonId = req.EnjeksiyonId,
            santrifujId = req.SantrifujId,
            yikamaId = req.YikamaId,
            azotluCapakAlmaId = req.AzotluCapakAlmaId
        });
    }

    [HttpGet("satis-kayitlari")]
    public async Task<ActionResult<IEnumerable<object>>> ListeSatisKayitlari()
    {
        var list = new List<object>();
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT Id, Ad, Tarih, MalzemeMaliyeti, IscilikMaliyeti, ElektrikMaliyeti, AmortismanMaliyeti, MakineBakimMaliyeti, KalipMaliyeti, ToplamMaliyet, NetUretimMaliyeti,
                             (SELECT ToplamHammaddeMaliyetiEuro FROM dbo.Enjeksiyon WHERE Id = SatisKayitlari.EnjeksiyonId) AS ToplamHammaddeMaliyetiEuro,
                             EnjeksiyonId, AzotluCapakAlmaId, PosturlemeId, SantrifujId, YikamaId, Formlar,
                             YanUrunTuru, HarcananBirimAzotMaliyetiEuro, HarcananBirimTasMaliyetiEuro, DeterjanMaliyetiEuro, BirimBrutAgirlik, BirimHammaddeMaliyetiEuro
                             FROM dbo.SatisKayitlari ORDER BY Id DESC";
        await con.OpenAsync();
        using var rd = await cmd.ExecuteReaderAsync();
        while (await rd.ReadAsync())
        {
            object? formlarObj = null;
            int ordFormlar = rd.GetOrdinal("Formlar");
            if (!rd.IsDBNull(ordFormlar))
            {
                var formStr = rd.GetString(ordFormlar);
                if (!string.IsNullOrWhiteSpace(formStr))
                {
                    try { formlarObj = JsonSerializer.Deserialize<object>(formStr); }
                    catch { formlarObj = formStr; }
                }
            }
            list.Add(new
            {
                id = rd.GetInt32(rd.GetOrdinal("Id")),
                ad = rd.GetString(rd.GetOrdinal("Ad")),
                tarih = rd.GetDateTime(rd.GetOrdinal("Tarih")),
                enjeksiyonId = rd.IsDBNull(rd.GetOrdinal("EnjeksiyonId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("EnjeksiyonId")),
                azotluCapakAlmaId = rd.IsDBNull(rd.GetOrdinal("AzotluCapakAlmaId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("AzotluCapakAlmaId")),
                posturlemeId = rd.IsDBNull(rd.GetOrdinal("PosturlemeId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("PosturlemeId")),
                santrifujId = rd.IsDBNull(rd.GetOrdinal("SantrifujId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("SantrifujId")),
                yikamaId = rd.IsDBNull(rd.GetOrdinal("YikamaId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("YikamaId")),
                ids = new
                {
                    enjeksiyon = rd.IsDBNull(rd.GetOrdinal("EnjeksiyonId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("EnjeksiyonId")),
                    azotlucapakalma = rd.IsDBNull(rd.GetOrdinal("AzotluCapakAlmaId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("AzotluCapakAlmaId")),
                    posturleme = rd.IsDBNull(rd.GetOrdinal("PosturlemeId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("PosturlemeId")),
                    santrifuj = rd.IsDBNull(rd.GetOrdinal("SantrifujId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("SantrifujId")),
                    yikama = rd.IsDBNull(rd.GetOrdinal("YikamaId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("YikamaId"))
                },
                degerler = new
                {
                    malzemeMaliyeti = rd.GetDecimal(rd.GetOrdinal("MalzemeMaliyeti")),
                    iscilikMaliyeti = rd.GetDecimal(rd.GetOrdinal("IscilikMaliyeti")),
                    elektrikMaliyeti = rd.GetDecimal(rd.GetOrdinal("ElektrikMaliyeti")),
                    amortismanMaliyeti = rd.GetDecimal(rd.GetOrdinal("AmortismanMaliyeti")),
                    makineBakimMaliyeti = rd.GetDecimal(rd.GetOrdinal("MakineBakimMaliyeti")),
                    kalipMaliyeti = rd.GetDecimal(rd.GetOrdinal("KalipMaliyeti")),
                    toplamMaliyet = rd.GetDecimal(rd.GetOrdinal("ToplamMaliyet"))
                },
                netUretimMaliyeti = rd.IsDBNull(rd.GetOrdinal("NetUretimMaliyeti")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("NetUretimMaliyeti")),
                toplamHammaddeMaliyetiEuro = rd.IsDBNull(rd.GetOrdinal("ToplamHammaddeMaliyetiEuro")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("ToplamHammaddeMaliyetiEuro")),
                birimBrutAgirlik = rd.IsDBNull(rd.GetOrdinal("BirimBrutAgirlik")) ? (double?)null : Convert.ToDouble(rd.GetValue(rd.GetOrdinal("BirimBrutAgirlik"))),
                yanUrun = new
                {
                    tur = rd.IsDBNull(rd.GetOrdinal("YanUrunTuru")) ? null : rd.GetString(rd.GetOrdinal("YanUrunTuru")),
                    harcananBirimAzotMaliyetiEuro = rd.IsDBNull(rd.GetOrdinal("HarcananBirimAzotMaliyetiEuro")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("HarcananBirimAzotMaliyetiEuro")),
                    harcananBirimTasMaliyetiEuro = rd.IsDBNull(rd.GetOrdinal("HarcananBirimTasMaliyetiEuro")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("HarcananBirimTasMaliyetiEuro")),
                    deterjanMaliyetiEuro = rd.IsDBNull(rd.GetOrdinal("DeterjanMaliyetiEuro")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("DeterjanMaliyetiEuro"))
                },
                birimHammaddeMaliyetiEuro = rd.IsDBNull(rd.GetOrdinal("BirimHammaddeMaliyetiEuro")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("BirimHammaddeMaliyetiEuro")),
                formlar = formlarObj
            });
        }
        return Ok(list);
    }

    [HttpGet("satis-kayitlari/{id:int}")]
    public async Task<ActionResult<object>> GetSatisKaydi(int id)
    {
        Console.WriteLine($"GET SatisKaydi {id}: Cache bypass ile fresh data çekiliyor...");
        
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        // NOLOCK ile cache bypass - fresh data garantisi
        cmd.CommandText = @"SELECT Id, Ad, Tarih, MalzemeMaliyeti, IscilikMaliyeti, ElektrikMaliyeti, AmortismanMaliyeti, MakineBakimMaliyeti, KalipMaliyeti, ToplamMaliyet, NetUretimMaliyeti,
                             (SELECT ToplamHammaddeMaliyetiEuro FROM dbo.Enjeksiyon WHERE Id = SatisKayitlari.EnjeksiyonId) AS ToplamHammaddeMaliyetiEuro,
                             EnjeksiyonId, AzotluCapakAlmaId, PosturlemeId, SantrifujId, YikamaId, Formlar,
                             YanUrunTuru, HarcananBirimAzotMaliyetiEuro, HarcananBirimTasMaliyetiEuro, DeterjanMaliyetiEuro, BirimBrutAgirlik, BirimHammaddeMaliyetiEuro
                             FROM dbo.SatisKayitlari WITH (NOLOCK) WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        using var rd = await cmd.ExecuteReaderAsync();
        if (!await rd.ReadAsync()) 
        {
            Console.WriteLine($"SatisKaydi {id} bulunamadı!");
            return NotFound();
        }
        
        Console.WriteLine($"SatisKaydi {id} bulundu: Ad={rd.GetString(rd.GetOrdinal("Ad"))}");
        object? formlarOne = null;
        int ordFormlarGet = rd.GetOrdinal("Formlar");
        if (!rd.IsDBNull(ordFormlarGet))
        {
            var formStr = rd.GetString(ordFormlarGet);
            if (!string.IsNullOrWhiteSpace(formStr))
            {
                try { formlarOne = JsonSerializer.Deserialize<object>(formStr); }
                catch { formlarOne = formStr; }
            }
        }
            return Ok(new
        {
            id = rd.GetInt32(rd.GetOrdinal("Id")),
            ad = rd.GetString(rd.GetOrdinal("Ad")),
            tarih = rd.GetDateTime(rd.GetOrdinal("Tarih")),
            enjeksiyonId = rd.IsDBNull(rd.GetOrdinal("EnjeksiyonId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("EnjeksiyonId")),
            azotluCapakAlmaId = rd.IsDBNull(rd.GetOrdinal("AzotluCapakAlmaId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("AzotluCapakAlmaId")),
            posturlemeId = rd.IsDBNull(rd.GetOrdinal("PosturlemeId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("PosturlemeId")),
            santrifujId = rd.IsDBNull(rd.GetOrdinal("SantrifujId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("SantrifujId")),
            yikamaId = rd.IsDBNull(rd.GetOrdinal("YikamaId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("YikamaId")),
            ids = new
            {
                enjeksiyon = rd.IsDBNull(rd.GetOrdinal("EnjeksiyonId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("EnjeksiyonId")),
                azotlucapakalma = rd.IsDBNull(rd.GetOrdinal("AzotluCapakAlmaId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("AzotluCapakAlmaId")),
                posturleme = rd.IsDBNull(rd.GetOrdinal("PosturlemeId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("PosturlemeId")),
                santrifuj = rd.IsDBNull(rd.GetOrdinal("SantrifujId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("SantrifujId")),
                yikama = rd.IsDBNull(rd.GetOrdinal("YikamaId")) ? (int?)null : rd.GetInt32(rd.GetOrdinal("YikamaId"))
            },
                degerler = new
            {
                malzemeMaliyeti = rd.GetDecimal(rd.GetOrdinal("MalzemeMaliyeti")),
                iscilikMaliyeti = rd.GetDecimal(rd.GetOrdinal("IscilikMaliyeti")),
                elektrikMaliyeti = rd.GetDecimal(rd.GetOrdinal("ElektrikMaliyeti")),
                amortismanMaliyeti = rd.GetDecimal(rd.GetOrdinal("AmortismanMaliyeti")),
                makineBakimMaliyeti = rd.GetDecimal(rd.GetOrdinal("MakineBakimMaliyeti")),
                kalipMaliyeti = rd.GetDecimal(rd.GetOrdinal("KalipMaliyeti")),
                toplamMaliyet = rd.GetDecimal(rd.GetOrdinal("ToplamMaliyet"))
            },
                netUretimMaliyeti = rd.IsDBNull(rd.GetOrdinal("NetUretimMaliyeti")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("NetUretimMaliyeti")),
                toplamHammaddeMaliyetiEuro = rd.IsDBNull(rd.GetOrdinal("ToplamHammaddeMaliyetiEuro")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("ToplamHammaddeMaliyetiEuro")),
            birimBrutAgirlik = rd.IsDBNull(rd.GetOrdinal("BirimBrutAgirlik")) ? (double?)null : Convert.ToDouble(rd.GetValue(rd.GetOrdinal("BirimBrutAgirlik"))),
            yanUrun = new
            {
                tur = rd.IsDBNull(rd.GetOrdinal("YanUrunTuru")) ? null : rd.GetString(rd.GetOrdinal("YanUrunTuru")),
                harcananBirimAzotMaliyetiEuro = rd.IsDBNull(rd.GetOrdinal("HarcananBirimAzotMaliyetiEuro")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("HarcananBirimAzotMaliyetiEuro")),
                harcananBirimTasMaliyetiEuro = rd.IsDBNull(rd.GetOrdinal("HarcananBirimTasMaliyetiEuro")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("HarcananBirimTasMaliyetiEuro")),
                deterjanMaliyetiEuro = rd.IsDBNull(rd.GetOrdinal("DeterjanMaliyetiEuro")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("DeterjanMaliyetiEuro"))
            },
            birimHammaddeMaliyetiEuro = rd.IsDBNull(rd.GetOrdinal("BirimHammaddeMaliyetiEuro")) ? (decimal?)null : rd.GetDecimal(rd.GetOrdinal("BirimHammaddeMaliyetiEuro")),
            formlar = formlarOne
        });
    }

    [HttpGet("satis-kayitlari/{id:int}/yanurun")]
    public async Task<ActionResult<object>> GetSatisKaydiYanUrun(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT YanUrunTuru, HarcananBirimAzotMaliyetiEuro, HarcananBirimTasMaliyetiEuro, DeterjanMaliyetiEuro FROM dbo.SatisKayitlari WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        using var rd = await cmd.ExecuteReaderAsync();
        if (!await rd.ReadAsync())
        {
            return NotFound();
        }
        return Ok(new
        {
            yanUrunTuru = rd.IsDBNull(0) ? null : rd.GetString(0),
            harcananBirimAzotMaliyetiEuro = rd.IsDBNull(1) ? (decimal?)null : rd.GetDecimal(1),
            harcananBirimTasMaliyetiEuro = rd.IsDBNull(2) ? (decimal?)null : rd.GetDecimal(2),
            deterjanMaliyetiEuro = rd.IsDBNull(3) ? (decimal?)null : rd.GetDecimal(3)
        });
    }

    [HttpGet("satis-kayitlari/{id:int}/yanurun-maliyet")]
    public async Task<ActionResult<object>> GetSatisKaydiYanUrunMaliyet(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT 
                COALESCE(HarcananBirimAzotMaliyetiEuro, 0) AS Azot,
                COALESCE(HarcananBirimTasMaliyetiEuro, 0) AS Tas,
                COALESCE(DeterjanMaliyetiEuro, 0) AS Deterjan,
                COALESCE(HarcananBirimAzotMaliyetiEuro, 0) + COALESCE(HarcananBirimTasMaliyetiEuro, 0) + COALESCE(DeterjanMaliyetiEuro, 0) AS Toplam
            FROM dbo.SatisKayitlari WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        using var rd = await cmd.ExecuteReaderAsync();
        if (!await rd.ReadAsync())
        {
            return NotFound();
        }
        var toplam = rd.GetDecimal(rd.GetOrdinal("Toplam"));
        return Ok(new { toplamYanUrunMaliyetiEuro = toplam });
    }

    [HttpGet("satis-kayitlari/{id:int}/neturetim")]
    public async Task<IActionResult> GetSatisKaydiNetUretim(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT TOP 1 NetUretimMaliyeti FROM dbo.SatisKayitlari WITH (NOLOCK) WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var scalar = await cmd.ExecuteScalarAsync();
        if (scalar == null || Convert.IsDBNull(scalar)) return Ok(null);
        var value = Convert.ToDecimal(scalar);
        return Ok(value);
    }

    [HttpPut("satis-kayitlari/{id:int}")]
    public async Task<IActionResult> GuncelleSatisKaydi(int id, [FromBody] SatisKaydiRequest req)
    {
        Console.WriteLine($"PUT SatisKaydi {id}: {JsonSerializer.Serialize(req)}");
        
        // Önce mevcut kaydı oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = "SELECT * FROM dbo.SatisKayitlari WHERE Id=@id";
        cmd0.Parameters.AddWithValue("@id", id);
        await con0.OpenAsync();
        using var rd0 = await cmd0.ExecuteReaderAsync();
        if (!await rd0.ReadAsync()) return NotFound();
        
        Console.WriteLine($"Mevcut satış kaydı: Ad={rd0["Ad"]}, EnjeksiyonId={rd0["EnjeksiyonId"]}");
        
        // Yeni toplam maliyetleri hesapla
        double toplamMalzeme = 0, toplamIscilik = 0, toplamElektrik = 0, toplamAmortisman = 0, toplamMakineBakim = 0, toplamKalip = 0;
        
        // BirimBrutAgirlik değerini hesapla
        double? birimBrutAgirlik = null;
        
        // Hangi adımların kullanılacağını belirle (gönderilen veya mevcut)
        var enjeksiyonId = req.EnjeksiyonId ?? (rd0.IsDBNull(rd0.GetOrdinal("EnjeksiyonId")) ? (int?)null : rd0.GetInt32(rd0.GetOrdinal("EnjeksiyonId")));
        var azotluCapakAlmaId = req.AzotluCapakAlmaId ?? (rd0.IsDBNull(rd0.GetOrdinal("AzotluCapakAlmaId")) ? (int?)null : rd0.GetInt32(rd0.GetOrdinal("AzotluCapakAlmaId")));
        var posturlemeId = req.PosturlemeId ?? (rd0.IsDBNull(rd0.GetOrdinal("PosturlemeId")) ? (int?)null : rd0.GetInt32(rd0.GetOrdinal("PosturlemeId")));
        var santrifujId = req.SantrifujId ?? (rd0.IsDBNull(rd0.GetOrdinal("SantrifujId")) ? (int?)null : rd0.GetInt32(rd0.GetOrdinal("SantrifujId")));
        var yikamaId = req.YikamaId ?? (rd0.IsDBNull(rd0.GetOrdinal("YikamaId")) ? (int?)null : rd0.GetInt32(rd0.GetOrdinal("YikamaId")));
        
        Console.WriteLine($"Kullanılacak ID'ler: Enjeksiyon={enjeksiyonId}, Azotlu={azotluCapakAlmaId}, Postürleme={posturlemeId}, Santrifüj={santrifujId}, Yıkama={yikamaId}");
        
        // Maliyetleri hesaplama stratejisi:
        // 1. Eğer ID'ler varsa, o adımlardan otomatik hesapla
        // 2. Eğer ID yoksa ve manuel değerler gönderilmişse, manuel değerleri kullan
        bool hicIdYok = !enjeksiyonId.HasValue && !azotluCapakAlmaId.HasValue && !posturlemeId.HasValue && !santrifujId.HasValue && !yikamaId.HasValue;
        bool otomatikHesapla = !hicIdYok; // En az bir ID varsa otomatik hesapla
        
        // BirimBrutAgirlik değerini hesapla (POST endpoint'indeki mantığı kullan)
        if (posturlemeId.HasValue)
        {
            using var conPosturleme = new SqlConnection(_cs);
            using var cmdPosturleme = conPosturleme.CreateCommand();
            cmdPosturleme.CommandText = "SELECT BirimBrutAgirlik FROM dbo.Posturleme WHERE Id=@id";
            cmdPosturleme.Parameters.AddWithValue("@id", posturlemeId.Value);
            await conPosturleme.OpenAsync();
            var posturlemeResult = await cmdPosturleme.ExecuteScalarAsync();
            if (posturlemeResult != null && !Convert.IsDBNull(posturlemeResult))
            {
                birimBrutAgirlik = Convert.ToDouble(posturlemeResult);
            }
        }
        else if (enjeksiyonId.HasValue)
        {
            using var conEnjeksiyon = new SqlConnection(_cs);
            using var cmdEnjeksiyon = conEnjeksiyon.CreateCommand();
            cmdEnjeksiyon.CommandText = "SELECT BirimBrutAgirlik FROM dbo.Enjeksiyon WHERE Id=@id";
            cmdEnjeksiyon.Parameters.AddWithValue("@id", enjeksiyonId.Value);
            await conEnjeksiyon.OpenAsync();
            var enjeksiyonResult = await cmdEnjeksiyon.ExecuteScalarAsync();
            if (enjeksiyonResult != null && !Convert.IsDBNull(enjeksiyonResult))
            {
                birimBrutAgirlik = Convert.ToDouble(enjeksiyonResult);
            }
        }
        else if (santrifujId.HasValue)
        {
            using var conSantrifuj = new SqlConnection(_cs);
            using var cmdSantrifuj = conSantrifuj.CreateCommand();
            cmdSantrifuj.CommandText = "SELECT BirimBrutAgirlik FROM dbo.Santrifuj WHERE Id=@id";
            cmdSantrifuj.Parameters.AddWithValue("@id", santrifujId.Value);
            await conSantrifuj.OpenAsync();
            var santrifujResult = await cmdSantrifuj.ExecuteScalarAsync();
            if (santrifujResult != null && !Convert.IsDBNull(santrifujResult))
            {
                birimBrutAgirlik = Convert.ToDouble(santrifujResult);
            }
        }
        else if (yikamaId.HasValue)
        {
            using var conYikama = new SqlConnection(_cs);
            using var cmdYikama = conYikama.CreateCommand();
            cmdYikama.CommandText = "SELECT BirimBrutAgirlik FROM dbo.Yikama WHERE Id=@id";
            cmdYikama.Parameters.AddWithValue("@id", yikamaId.Value);
            await conYikama.OpenAsync();
            var yikamaResult = await cmdYikama.ExecuteScalarAsync();
            if (yikamaResult != null && !Convert.IsDBNull(yikamaResult))
            {
                birimBrutAgirlik = Convert.ToDouble(yikamaResult);
            }
        }
        else if (azotluCapakAlmaId.HasValue)
        {
            using var conAzotlu = new SqlConnection(_cs);
            using var cmdAzotlu = conAzotlu.CreateCommand();
            cmdAzotlu.CommandText = "SELECT BirimBrutAgirlik FROM dbo.AzotluCapakAlma WHERE Id=@id";
            cmdAzotlu.Parameters.AddWithValue("@id", azotluCapakAlmaId.Value);
            await conAzotlu.OpenAsync();
            var azotluResult = await cmdAzotlu.ExecuteScalarAsync();
            if (azotluResult != null && !Convert.IsDBNull(azotluResult))
            {
                birimBrutAgirlik = Convert.ToDouble(azotluResult);
            }
        }
        
        // Enjeksiyon maliyetlerini al
        if (enjeksiyonId.HasValue)
        {
            using var con1 = new SqlConnection(_cs);
            using var cmd1 = con1.CreateCommand();
            cmd1.CommandText = "SELECT MalzemeMaliyetiEuro, ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro, KalipMaliyetiEuro FROM dbo.Enjeksiyon WHERE Id=@id";
            cmd1.Parameters.AddWithValue("@id", enjeksiyonId.Value);
            await con1.OpenAsync();
            using var rd1 = await cmd1.ExecuteReaderAsync();
            if (await rd1.ReadAsync())
            {
                toplamMalzeme += Convert.ToDouble(rd1["MalzemeMaliyetiEuro"]);
                toplamIscilik += Convert.ToDouble(rd1["ToplamIscilikMaliyetiEuro"]);
                toplamElektrik += Convert.ToDouble(rd1["ElektrikMaliyetiEuro"]);
                toplamAmortisman += Convert.ToDouble(rd1["AmortismanMaliyetiEuro"]);
                toplamMakineBakim += Convert.ToDouble(rd1["MakineBakimMaliyetiEuro"]);
                toplamKalip += Convert.ToDouble(rd1["KalipMaliyetiEuro"]);
                Console.WriteLine($"Enjeksiyon maliyetleri eklendi: Malzeme={rd1["MalzemeMaliyetiEuro"]}");
            }
        }
        
        // Azotlu Çapak Alma maliyetlerini al
        if (azotluCapakAlmaId.HasValue)
        {
            using var con2 = new SqlConnection(_cs);
            using var cmd2 = con2.CreateCommand();
            cmd2.CommandText = "SELECT HarcananBirimAzotMaliyetiEuro, ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro, HarcananBirimTasMaliyetiEuro FROM dbo.AzotluCapakAlma WHERE Id=@id";
            cmd2.Parameters.AddWithValue("@id", azotluCapakAlmaId.Value);
            await con2.OpenAsync();
            using var rd2 = await cmd2.ExecuteReaderAsync();
            if (await rd2.ReadAsync())
            {
                toplamMalzeme += Convert.ToDouble(rd2["HarcananBirimAzotMaliyetiEuro"]);
                toplamIscilik += Convert.ToDouble(rd2["ToplamIscilikMaliyetiEuro"]);
                toplamElektrik += Convert.ToDouble(rd2["ElektrikMaliyetiEuro"]);
                toplamAmortisman += Convert.ToDouble(rd2["AmortismanMaliyetiEuro"]);
                toplamMakineBakim += Convert.ToDouble(rd2["MakineBakimMaliyetiEuro"]);
                toplamKalip += Convert.ToDouble(rd2["HarcananBirimTasMaliyetiEuro"]);
                Console.WriteLine($"Azotlu Çapak Alma maliyetleri eklendi: Malzeme={rd2["HarcananBirimAzotMaliyetiEuro"]}");
            }
        }
        
        // Postürleme maliyetlerini al
        if (posturlemeId.HasValue)
        {
            using var con3 = new SqlConnection(_cs);
            using var cmd3 = con3.CreateCommand();
            cmd3.CommandText = "SELECT ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro FROM dbo.Posturleme WHERE Id=@id";
            cmd3.Parameters.AddWithValue("@id", posturlemeId.Value);
            await con3.OpenAsync();
            using var rd3 = await cmd3.ExecuteReaderAsync();
            if (await rd3.ReadAsync())
            {
                toplamIscilik += Convert.ToDouble(rd3["ToplamIscilikMaliyetiEuro"]);
                toplamElektrik += Convert.ToDouble(rd3["ElektrikMaliyetiEuro"]);
                toplamAmortisman += Convert.ToDouble(rd3["AmortismanMaliyetiEuro"]);
                toplamMakineBakim += Convert.ToDouble(rd3["MakineBakimMaliyetiEuro"]);
                Console.WriteLine($"Postürleme maliyetleri eklendi");
            }
        }
        
        // Santrifüj maliyetlerini al
        if (santrifujId.HasValue)
        {
            using var con4 = new SqlConnection(_cs);
            using var cmd4 = con4.CreateCommand();
            cmd4.CommandText = "SELECT ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro FROM dbo.Santrifuj WHERE Id=@id";
            cmd4.Parameters.AddWithValue("@id", santrifujId.Value);
            await con4.OpenAsync();
            using var rd4 = await cmd4.ExecuteReaderAsync();
            if (await rd4.ReadAsync())
            {
                toplamIscilik += Convert.ToDouble(rd4["ToplamIscilikMaliyetiEuro"]);
                toplamElektrik += Convert.ToDouble(rd4["ElektrikMaliyetiEuro"]);
                toplamAmortisman += Convert.ToDouble(rd4["AmortismanMaliyetiEuro"]);
                toplamMakineBakim += Convert.ToDouble(rd4["MakineBakimMaliyetiEuro"]);
                Console.WriteLine($"Santrifüj maliyetleri eklendi");
            }
        }
        
        // Yıkama maliyetlerini al
        if (yikamaId.HasValue)
        {
            using var con5 = new SqlConnection(_cs);
            using var cmd5 = con5.CreateCommand();
            cmd5.CommandText = "SELECT DeterjanMaliyetiEuro, ToplamIscilikMaliyetiEuro, ElektrikMaliyetiEuro, AmortismanMaliyetiEuro, MakineBakimMaliyetiEuro FROM dbo.Yikama WHERE Id=@id";
            cmd5.Parameters.AddWithValue("@id", yikamaId.Value);
            await con5.OpenAsync();
            using var rd5 = await cmd5.ExecuteReaderAsync();
            if (await rd5.ReadAsync())
            {
                toplamMalzeme += Convert.ToDouble(rd5["DeterjanMaliyetiEuro"]);
                toplamIscilik += Convert.ToDouble(rd5["ToplamIscilikMaliyetiEuro"]);
                toplamElektrik += Convert.ToDouble(rd5["ElektrikMaliyetiEuro"]);
                toplamAmortisman += Convert.ToDouble(rd5["AmortismanMaliyetiEuro"]);
                toplamMakineBakim += Convert.ToDouble(rd5["MakineBakimMaliyetiEuro"]);
                Console.WriteLine($"Yıkama maliyetleri eklendi: Malzeme={rd5["DeterjanMaliyetiEuro"]}");
            }
        }
        
        // Eğer ID yoksa ve manuel değerler gönderilmişse, bunları kullan
        if (hicIdYok && req.Degerler != null)
        {
            toplamMalzeme = (double)req.Degerler.MalzemeMaliyeti;
            toplamIscilik = (double)req.Degerler.IscilikMaliyeti;
            toplamElektrik = (double)req.Degerler.ElektrikMaliyeti;
            toplamAmortisman = (double)req.Degerler.AmortismanMaliyeti;
            toplamMakineBakim = (double)req.Degerler.MakineBakimMaliyeti;
            toplamKalip = (double)req.Degerler.KalipMaliyeti;
            Console.WriteLine("Manuel değerler kullanılıyor (ID yok)");
        }
        
        double toplamMaliyet = toplamMalzeme + toplamIscilik + toplamElektrik + toplamAmortisman + toplamMakineBakim + toplamKalip;
        
        Console.WriteLine($"Hesaplanan toplam maliyetler: Malzeme={toplamMalzeme:F6}, İşçilik={toplamIscilik:F6}, Elektrik={toplamElektrik:F6}, Amortisman={toplamAmortisman:F6}, MakineBakım={toplamMakineBakim:F6}, Kalıp={toplamKalip:F6}, Toplam={toplamMaliyet:F6}");
        
        // Satış kaydını güncelle
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"UPDATE dbo.SatisKayitlari SET
            Ad=@Ad, MalzemeMaliyeti=@Malzeme, IscilikMaliyeti=@Iscilik, ElektrikMaliyeti=@Elektrik, 
            AmortismanMaliyeti=@Amortisman, MakineBakimMaliyeti=@MakineBakim, KalipMaliyeti=@Kalip, 
            ToplamMaliyet=@Toplam, Formlar=@Formlar, EnjeksiyonId=@EnjeksiyonId, AzotluCapakAlmaId=@AzotluCapakAlmaId, 
            PosturlemeId=@PosturlemeId, SantrifujId=@SantrifujId, YikamaId=@YikamaId, BirimBrutAgirlik=@BirimBrutAgirlik
            WHERE Id=@id";
        
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@Ad", req.Ad);
        cmd.Parameters.AddWithValue("@Malzeme", (decimal)toplamMalzeme);
        cmd.Parameters.AddWithValue("@Iscilik", (decimal)toplamIscilik);
        cmd.Parameters.AddWithValue("@Elektrik", (decimal)toplamElektrik);
        cmd.Parameters.AddWithValue("@Amortisman", (decimal)toplamAmortisman);
        cmd.Parameters.AddWithValue("@MakineBakim", (decimal)toplamMakineBakim);
        cmd.Parameters.AddWithValue("@Kalip", (decimal)toplamKalip);
        cmd.Parameters.AddWithValue("@Toplam", (decimal)toplamMaliyet);
        cmd.Parameters.AddWithValue("@Formlar", req.Formlar != null ? JsonSerializer.Serialize(req.Formlar) : (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@EnjeksiyonId", (object?)enjeksiyonId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@AzotluCapakAlmaId", (object?)azotluCapakAlmaId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@PosturlemeId", (object?)posturlemeId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@SantrifujId", (object?)santrifujId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@YikamaId", (object?)yikamaId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@BirimBrutAgirlik", (object?)birimBrutAgirlik ?? DBNull.Value);
        
        await con.OpenAsync();
        var affected = await cmd.ExecuteNonQueryAsync();
        
        Console.WriteLine($"SatisKaydi {id} güncellendi! Affected rows: {affected}");
        
        if (affected == 0) return NotFound();
        
        // Güncellenmiş değerleri döndür
        return Ok(new
        {
            id = id,
            ad = req.Ad,
            degerler = new
            {
                malzemeMaliyeti = toplamMalzeme,
                iscilikMaliyeti = toplamIscilik,
                elektrikMaliyeti = toplamElektrik,
                amortismanMaliyeti = toplamAmortisman,
                makineBakimMaliyeti = toplamMakineBakim,
                kalipMaliyeti = toplamKalip,
                toplamMaliyet = toplamMaliyet
            },
            birimBrutAgirlik = birimBrutAgirlik,
            enjeksiyonId = enjeksiyonId,
            azotluCapakAlmaId = azotluCapakAlmaId,
            posturlemeId = posturlemeId,
            santrifujId = santrifujId,
            yikamaId = yikamaId
        });
    }

    [HttpDelete("satis-kayitlari/{id:int}")]
    public async Task<IActionResult> SilSatisKaydi(int id)
    {
        Console.WriteLine($"DELETE SatisKaydi {id} başlıyor...");
        
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = "DELETE FROM dbo.SatisKayitlari WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var affected = await cmd.ExecuteNonQueryAsync();
        
        Console.WriteLine($"SatisKaydi {id} silindi! Affected rows: {affected}");
        
        if (affected == 0) return NotFound();
        return NoContent();
    }

    /// <summary>
    /// Bir adım güncellendiğinde, ona bağlı tüm satış kayıtlarını günceller
    /// </summary>
    private async Task GuncelleSatisKayitlariIliskiliAdimIcinAsync(
        int? enjeksiyonId = null,
        int? azotluCapakAlmaId = null,
        int? posturlemeId = null,
        int? santrifujId = null,
        int? yikamaId = null)
    {
        try
        {
            // İlişkili satış kayıtlarını bul
            using var conFind = new SqlConnection(_cs);
            using var cmdFind = conFind.CreateCommand();
            
            var whereClauses = new List<string>();
            if (enjeksiyonId.HasValue)
            {
                whereClauses.Add("EnjeksiyonId=@EnjeksiyonId");
                cmdFind.Parameters.AddWithValue("@EnjeksiyonId", enjeksiyonId.Value);
            }
            if (azotluCapakAlmaId.HasValue)
            {
                whereClauses.Add("AzotluCapakAlmaId=@AzotluCapakAlmaId");
                cmdFind.Parameters.AddWithValue("@AzotluCapakAlmaId", azotluCapakAlmaId.Value);
            }
            if (posturlemeId.HasValue)
            {
                whereClauses.Add("PosturlemeId=@PosturlemeId");
                cmdFind.Parameters.AddWithValue("@PosturlemeId", posturlemeId.Value);
            }
            if (santrifujId.HasValue)
            {
                whereClauses.Add("SantrifujId=@SantrifujId");
                cmdFind.Parameters.AddWithValue("@SantrifujId", santrifujId.Value);
            }
            if (yikamaId.HasValue)
            {
                whereClauses.Add("YikamaId=@YikamaId");
                cmdFind.Parameters.AddWithValue("@YikamaId", yikamaId.Value);
            }

            if (whereClauses.Count == 0)
            {
                Console.WriteLine("GuncelleSatisKayitlariIliskiliAdimIcinAsync: Hiç ID verilmedi, işlem atlanıyor.");
                return;
            }

            cmdFind.CommandText = $"SELECT Id, EnjeksiyonId, AzotluCapakAlmaId, PosturlemeId, SantrifujId, YikamaId FROM dbo.SatisKayitlari WHERE {string.Join(" OR ", whereClauses)}";
            
            await conFind.OpenAsync();
            var satisKayitlari = new List<(int Id, int? EnjId, int? AzotluId, int? PostId, int? SanId, int? YikId)>();
            
            using (var rd = await cmdFind.ExecuteReaderAsync())
            {
                while (await rd.ReadAsync())
                {
                    satisKayitlari.Add((
                        rd.GetInt32(0),
                        rd.IsDBNull(1) ? null : rd.GetInt32(1),
                        rd.IsDBNull(2) ? null : rd.GetInt32(2),
                        rd.IsDBNull(3) ? null : rd.GetInt32(3),
                        rd.IsDBNull(4) ? null : rd.GetInt32(4),
                        rd.IsDBNull(5) ? null : rd.GetInt32(5)
                    ));
                }
            }

            Console.WriteLine($"İlişkili {satisKayitlari.Count} adet satış kaydı bulundu, güncellenecek...");

            // Her satış kaydını güncelle
            foreach (var (satisId, enjId, azotluId, postId, sanId, yikId) in satisKayitlari)
            {
                await GuncelleSatisKaydiMaliyetleriAsync(satisId, enjId, azotluId, postId, sanId, yikId);
            }

            Console.WriteLine($"{satisKayitlari.Count} adet satış kaydı güncellendi.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"İlişkili satış kayıtları güncellenirken hata: {ex.Message}");
        }
    }

    /// <summary>
    /// Tek bir satış kaydının maliyetlerini yeniden hesaplar ve günceller
    /// </summary>
    private async Task GuncelleSatisKaydiMaliyetleriAsync(
        int satisKaydiId,
        int? enjeksiyonId,
        int? azotluCapakAlmaId,
        int? posturlemeId,
        int? santrifujId,
        int? yikamaId)
    {
        try
        {
            decimal toplamMaliyet = 0m;
            decimal? deterjanMaliyetiEuro = null;
            decimal? birimNetAgirlikFromAzot = null;
            decimal? harcananBirimAzotMaliyetiEuro = null;
            decimal? harcananBirimTasMaliyetiEuro = null;

            // Artık değerler API'den okunuyor (yalnızca ToplamMaliyetEuro)
            if (enjeksiyonId.HasValue)
            {
                toplamMaliyet += await GetToplamMaliyetFromApiAsync($"/api/hesaplama/enjeksiyon/{enjeksiyonId.Value}");
            }
            if (azotluCapakAlmaId.HasValue)
            {
                toplamMaliyet += await GetToplamMaliyetFromApiAsync($"/api/hesaplama/azotlucapakalma/{azotluCapakAlmaId.Value}");
                using var conAz = new SqlConnection(_cs);
                using var cmdAz = conAz.CreateCommand();
                cmdAz.CommandText = "SELECT BirimNetAgirlik, HarcananBirimAzotMaliyetiEuro, HarcananBirimTasMaliyetiEuro FROM dbo.AzotluCapakAlma WHERE Id=@id";
                cmdAz.Parameters.AddWithValue("@id", azotluCapakAlmaId.Value);
                await conAz.OpenAsync();
                using var rdAz = await cmdAz.ExecuteReaderAsync();
                if (await rdAz.ReadAsync())
                {
                    if (!rdAz.IsDBNull(0)) birimNetAgirlikFromAzot = rdAz.GetDecimal(0);
                    if (!rdAz.IsDBNull(1)) harcananBirimAzotMaliyetiEuro = rdAz.GetDecimal(1);
                    if (!rdAz.IsDBNull(2)) harcananBirimTasMaliyetiEuro = rdAz.GetDecimal(2);
                }
            }
            if (posturlemeId.HasValue)
            {
                toplamMaliyet += await GetToplamMaliyetFromApiAsync($"/api/hesaplama/posturleme/{posturlemeId.Value}");
            }
            if (santrifujId.HasValue)
            {
                toplamMaliyet += await GetToplamMaliyetFromApiAsync($"/api/hesaplama/santrifuj/{santrifujId.Value}");
            }
            if (yikamaId.HasValue)
            {
                toplamMaliyet += await GetToplamMaliyetFromApiAsync($"/api/hesaplama/yikama/{yikamaId.Value}");
                // Yıkama'dan deterjan maliyetini çek
                using var conY = new SqlConnection(_cs);
                using var cmdY = conY.CreateCommand();
                cmdY.CommandText = "SELECT DeterjanMaliyetiEuro FROM dbo.Yikama WHERE Id=@id";
                cmdY.Parameters.AddWithValue("@id", yikamaId.Value);
                await conY.OpenAsync();
                var detObj = await cmdY.ExecuteScalarAsync();
                if (detObj != null && !Convert.IsDBNull(detObj))
                {
                    deterjanMaliyetiEuro = Convert.ToDecimal(detObj);
                }
            }

            // Satış kaydını güncelle
            using var conUpdate = new SqlConnection(_cs);
            using var cmdUpdate = conUpdate.CreateCommand();
            // Net üretim maliyeti (ToplamMaliyet x Adet) için Enjeksiyon'dan Adet çekilir
            decimal? netUretimMaliyeti = null;
            if (enjeksiyonId.HasValue)
            {
                using var conAdet = new SqlConnection(_cs);
                using var cmdAdet = conAdet.CreateCommand();
                cmdAdet.CommandText = "SELECT Adet FROM dbo.Enjeksiyon WHERE Id=@id";
                cmdAdet.Parameters.AddWithValue("@id", enjeksiyonId.Value);
                await conAdet.OpenAsync();
                var adetObj = await cmdAdet.ExecuteScalarAsync();
                if (adetObj != null && !Convert.IsDBNull(adetObj))
                {
                    var adetVal = Convert.ToDecimal(adetObj);
                    netUretimMaliyeti = toplamMaliyet * adetVal;
                }
            }

            // AdetToplamUrunMaliyetiEuro hesapla: Adet * ToplamYanUrunMaliyetiEuro
            decimal toplamYanUrunMaliyetiEuro = (harcananBirimAzotMaliyetiEuro ?? 0m) + (harcananBirimTasMaliyetiEuro ?? 0m) + (deterjanMaliyetiEuro ?? 0m);
            decimal? adetToplamUrunMaliyetiEuro = null;
            if (enjeksiyonId.HasValue)
            {
                using var conAdet2 = new SqlConnection(_cs);
                using var cmdAdet2 = conAdet2.CreateCommand();
                cmdAdet2.CommandText = "SELECT Adet FROM dbo.Enjeksiyon WHERE Id=@id";
                cmdAdet2.Parameters.AddWithValue("@id", enjeksiyonId.Value);
                await conAdet2.OpenAsync();
                var adetObj2 = await cmdAdet2.ExecuteScalarAsync();
                if (adetObj2 != null && !Convert.IsDBNull(adetObj2))
                {
                    var adetVal2 = Convert.ToDecimal(adetObj2);
                    adetToplamUrunMaliyetiEuro = adetVal2 * toplamYanUrunMaliyetiEuro;
                }
            }

            cmdUpdate.CommandText = @"UPDATE dbo.SatisKayitlari SET
                ToplamMaliyet=@Toplam, NetUretimMaliyeti=@NetUretim, BirimBrutAgirlik=@BirimBrutAgirlik,
                DeterjanMaliyetiEuro=@Deterjan, BirimNetAgirlik=@BirimNetAgirlik, AdetToplamUrunMaliyetiEuro=@AdetToplam
                WHERE Id=@id";
            cmdUpdate.Parameters.AddWithValue("@id", satisKaydiId);
            cmdUpdate.Parameters.AddWithValue("@Toplam", toplamMaliyet);
            cmdUpdate.Parameters.AddWithValue("@NetUretim", (object?)netUretimMaliyeti ?? DBNull.Value);
            cmdUpdate.Parameters.AddWithValue("@BirimBrutAgirlik", DBNull.Value);
            cmdUpdate.Parameters.AddWithValue("@Deterjan", (object?)deterjanMaliyetiEuro ?? DBNull.Value);
            cmdUpdate.Parameters.AddWithValue("@BirimNetAgirlik", (object?)birimNetAgirlikFromAzot ?? DBNull.Value);
            cmdUpdate.Parameters.AddWithValue("@AdetToplam", (object?)adetToplamUrunMaliyetiEuro ?? DBNull.Value);
            await conUpdate.OpenAsync();
            await cmdUpdate.ExecuteNonQueryAsync();

            Console.WriteLine($"SatisKaydi {satisKaydiId} otomatik güncellendi. Yeni toplam: {toplamMaliyet:F6}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"SatisKaydi {satisKaydiId} güncellenirken hata: {ex.Message}");
        }
    }


    [HttpGet("enjeksiyon/{id:int}")]
    public async Task<IActionResult> GetEnjeksiyonById(int id)
    {
        return await GetByIdAsync("Enjeksiyon", id);
    }

    [HttpGet("santrifuj/{id:int}")]
    public async Task<IActionResult> GetSantrifujById(int id)
    {
        return await GetByIdAsync("Santrifuj", id);
    }

    [HttpGet("azotlucapakalma/{id:int}")]
    public async Task<IActionResult> GetAzotluCapakAlmaById(int id)
    {
        // Kaydı oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = "SELECT TOP 1 * FROM dbo.AzotluCapakAlma WHERE Id=@id";
        cmd0.Parameters.AddWithValue("@id", id);
        await con0.OpenAsync();
        using var rd = await cmd0.ExecuteReaderAsync();
        if (!await rd.ReadAsync()) return Ok((decimal?)null);

        // Gerekli alanlar
        double BaskiToplamBrut = Convert.ToDouble(rd["BaskiToplamBrutAgirlik"]);
        double KalipGozSayisi = Convert.ToDouble(rd["KalipGozSayisi"]);
        double EuroKuru = Convert.ToDouble(rd["EuroKuru"]);
        double BaskiCevrimSuresi = Convert.ToDouble(rd["BaskiCevrimSuresi"]);
        double IsciKatsayisi = Convert.ToDouble(rd["IsciKatsayisi"]);
        double IsciSayisi = Convert.ToDouble(rd["IsciSayisi"]);
        double OperatorUcreti = Convert.ToDouble(rd["OperatorUcreti"]);
        double ElektrikUcreti = Convert.ToDouble(rd["ElektrikUcreti"]);
        double IslemBasinaHarcananAzotGram = Convert.ToDouble(rd["IslemBasinaHarcananAzotGram"]);
        double TezgahSogumaSuresi = Convert.ToDouble(rd["TezgahSogumaSuresi"]);
        double MakineIslemSuresi = Convert.ToDouble(rd["MakineIslemSuresi"]);
        double YuklemeBosaltmaSuresi = Convert.ToDouble(rd["YuklemeBosaltmaSuresi"]);
        double IslemGorenUrunAgirligiToplamGram = Convert.ToDouble(rd["IslemGorenUrunAgirligiToplamGram"]);
        double KwDegeri = Convert.ToDouble(rd["KwDegeri"]);
        double FaydaliOmurYil = Convert.ToDouble(rd["FaydaliOmurYil"]);
        double MakineBedeliEuro = Convert.ToDouble(rd["MakineBedeliEuro"]);
        double YillikBakimBedeli = Convert.ToDouble(rd["YillikBakimBedeli"]);
        double Tas1KgFiyatiEuro = Convert.ToDouble(rd["Tas1KgFiyatiEuro"]);
        double TasKgSaniye = Convert.ToDouble(rd["TasKgSaniye"]);
        double AzotKgFiyatiTl = Convert.ToDouble(rd["AzotKgFiyatiTl"]);
        double? IslemGorenUrunAdediDb = rd["IslemGorenUrunAdedi"] == DBNull.Value ? (double?)null : Convert.ToDouble(rd["IslemGorenUrunAdedi"]);

        // Varsayılanları çek
        await rd.CloseAsync();
        using var con1 = new SqlConnection(_cs);
        using var cmd1 = con1.CreateCommand();
        cmd1.CommandText = @"SELECT TOP 1 YillikBakimBedeli, IslemBasinaHarcananAzotGram, TasKgSaniye, Tas1KgFiyatiEuro, AzotKgFiyatiTl, KwDegeri, MakineBedeliEuro, FaydaliOmurYil
                              FROM dbo.AzotluCapakAlmaVarsayilanDegerler ORDER BY GuncellemeTarihi DESC";
        await con1.OpenAsync();
        using var rd1 = await cmd1.ExecuteReaderAsync();
        if (await rd1.ReadAsync())
        {
            YillikBakimBedeli = Convert.ToDouble(rd1.GetDecimal(0));
            IslemBasinaHarcananAzotGram = Convert.ToDouble(rd1.GetDecimal(1));
            TasKgSaniye = Convert.ToDouble(rd1.GetDecimal(2));
            Tas1KgFiyatiEuro = Convert.ToDouble(rd1.GetDecimal(3));
            AzotKgFiyatiTl = Convert.ToDouble(rd1.GetDecimal(4));
            KwDegeri = Convert.ToDouble(rd1.GetDecimal(5));
            MakineBedeliEuro = Convert.ToDouble(rd1.GetDecimal(6));
            FaydaliOmurYil = rd1.GetInt32(7);
        }

        if (KalipGozSayisi <= 0 || EuroKuru <= 0) return BadRequest("Geçersiz parametre.");

        double toplamislemesuresi = TezgahSogumaSuresi + MakineIslemSuresi + YuklemeBosaltmaSuresi;
        double kalip1Saniye = 9 * 250 * 3600;
        double azotGrFiyatiEuro = AzotKgFiyatiTl / 1000.0 / EuroKuru;
        if (!IslemGorenUrunAdediDb.HasValue || IslemGorenUrunAdediDb.Value <= 0)
            return BadRequest("IslemGorenUrunAdedi belirtilmeli (birim net hesap için).");
        double islemgorenurunadedi = IslemGorenUrunAdediDb.Value;
        double birimNetAgirlik = IslemGorenUrunAgirligiToplamGram / islemgorenurunadedi;
        double birimBrutAgirlik = birimNetAgirlik * 1.20;
        double birimBrutAgirlikGr = birimBrutAgirlik;
        double harcananBirimAzotGramHesaplanan = IslemBasinaHarcananAzotGram * birimBrutAgirlikGr / IslemGorenUrunAgirligiToplamGram;
        double harcananBirimAzotMaliyeti = harcananBirimAzotGramHesaplanan * azotGrFiyatiEuro;
        double operatorSaniyelikUcret = OperatorUcreti / 225.0 / 3600.0;
        double toplambirimislemesuresi = toplamislemesuresi / islemgorenurunadedi;
        double bazIscilikMaliyeti = toplambirimislemesuresi * operatorSaniyelikUcret / EuroKuru;
        double toplamIscilikMaliyeti = IsciKatsayisi * IsciSayisi * bazIscilikMaliyeti;
        double elektrikSaniye = ElektrikUcreti / 3600.0;
        double elektrikMaliyeti = (MakineIslemSuresi / islemgorenurunadedi) * elektrikSaniye / EuroKuru * KwDegeri;
        double faydaliOmurSaniye = FaydaliOmurYil * 9 * 250 * 3600;
        double amortismanMaliyeti = toplambirimislemesuresi / faydaliOmurSaniye * MakineBedeliEuro;
        double makineBakimMaliyeti = toplambirimislemesuresi / kalip1Saniye * YillikBakimBedeli;
        double harcananBirimTasMaliyeti = toplambirimislemesuresi * TasKgSaniye / 28800.0 * Tas1KgFiyatiEuro;
        double toplamMaliyet = harcananBirimAzotMaliyeti + toplamIscilikMaliyeti + elektrikMaliyeti + amortismanMaliyeti + makineBakimMaliyeti + harcananBirimTasMaliyeti;

        if (!double.IsFinite(toplamMaliyet)) return BadRequest("Hesaplama geçersiz.");
        decimal sonuc = (decimal)Math.Round(toplamMaliyet, 6, MidpointRounding.AwayFromZero);
        return Ok(sonuc);
    }

    [HttpGet("posturleme/{id:int}")]
    public async Task<IActionResult> GetPosturlemeById(int id)
    {
        return await GetByIdAsync("Posturleme", id);
    }

    [HttpGet("yikama/{id:int}")]
    public async Task<IActionResult> GetYikamaById(int id)
    {
        return await GetByIdAsync("Yikama", id);
    }

    [HttpGet("enjeksiyon/{id:int}/toplamhammadde")]
    public async Task<IActionResult> GetEnjeksiyonToplamHammaddeById(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT TOP 1 ToplamHammaddeMaliyetiEuro FROM dbo.Enjeksiyon WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var scalar = await cmd.ExecuteScalarAsync();
        if (scalar == null || Convert.IsDBNull(scalar)) return Ok(null);
        var value = Convert.ToDecimal(scalar);
        return Ok(value);
    }

    [HttpGet("enjeksiyon/{id:int}/kalipmaliyeti")]
    public async Task<IActionResult> GetEnjeksiyonKalipMaliyetiById(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT TOP 1 KalipMaliyetiEuro FROM dbo.Enjeksiyon WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var scalar = await cmd.ExecuteScalarAsync();
        if (scalar == null || Convert.IsDBNull(scalar)) return Ok(null);
        var value = Convert.ToDecimal(scalar);
        return Ok(value);
    }

    [HttpGet("satis-kayitlari/{id:int}/toplamhammadde")]
    public async Task<IActionResult> GetSatisKaydiToplamHammadde(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT TOP 1 
            (SELECT ToplamHammaddeMaliyetiEuro FROM dbo.Enjeksiyon WHERE Id = s.EnjeksiyonId) AS ToplamHammaddeMaliyetiEuro
            FROM dbo.SatisKayitlari s WITH (NOLOCK) WHERE s.Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var scalar = await cmd.ExecuteScalarAsync();
        if (scalar == null || Convert.IsDBNull(scalar)) return Ok(null);
        var value = Convert.ToDecimal(scalar);
        return Ok(value);
    }

    [HttpGet("satis-kayitlari/{id:int}/kalipmaliyeti")]
    public async Task<IActionResult> GetSatisKaydiKalipMaliyeti(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT TOP 1 
            (SELECT KalipMaliyetiEuro FROM dbo.Enjeksiyon WHERE Id = s.EnjeksiyonId) AS KalipMaliyetiToplam
            FROM dbo.SatisKayitlari s WITH (NOLOCK) WHERE s.Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var scalar = await cmd.ExecuteScalarAsync();
        if (scalar == null || Convert.IsDBNull(scalar)) return Ok(null);
        var value = Convert.ToDecimal(scalar);
        return Ok(value);
    }

    [HttpGet("satis-kayitlari/{id:int}/malzememaliyeti")]
    public async Task<IActionResult> GetSatisKaydiMalzemeMaliyeti(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT TOP 1 MalzemeMaliyeti FROM dbo.SatisKayitlari WITH (NOLOCK) WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var scalar = await cmd.ExecuteScalarAsync();
        if (scalar == null || Convert.IsDBNull(scalar)) return Ok(null);
        var value = Convert.ToDecimal(scalar);
        return Ok(value);
    }

    // Alias: toplam hammadde maliyetini isimlendirme uyumu için ayrı uç
    [HttpGet("satis-kayitlari/{id:int}/toplamhammaddemaliyeti")]
    public async Task<IActionResult> GetSatisKaydiToplamHammaddeMaliyeti(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT TOP 1 
            (SELECT ToplamHammaddeMaliyetiEuro FROM dbo.Enjeksiyon WHERE Id = s.EnjeksiyonId) AS ToplamHammaddeMaliyetiEuro
            FROM dbo.SatisKayitlari s WITH (NOLOCK) WHERE s.Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var scalar = await cmd.ExecuteScalarAsync();
        if (scalar == null || Convert.IsDBNull(scalar)) return Ok(null);
        var value = Convert.ToDecimal(scalar);
        return Ok(value);
    }

    [HttpGet("satis-kayitlari/{id:int}/birimbrutagirlik")]
    public async Task<IActionResult> GetSatisKaydiBirimBrutAgirlik(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT TOP 1 BirimBrutAgirlik FROM dbo.SatisKayitlari WITH (NOLOCK) WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var scalar = await cmd.ExecuteScalarAsync();
        if (scalar == null || Convert.IsDBNull(scalar)) return Ok(null);
        var value = Convert.ToDouble(scalar);
        return Ok(value);
    }

    [HttpGet("satis-kayitlari/{id:int}/deterjanmaliyeti")]
    public async Task<IActionResult> GetSatisKaydiDeterjanMaliyeti(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT TOP 1 DeterjanMaliyetiEuro FROM dbo.SatisKayitlari WITH (NOLOCK) WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var scalar = await cmd.ExecuteScalarAsync();
        if (scalar == null || Convert.IsDBNull(scalar)) return Ok(null);
        var value = Convert.ToDecimal(scalar);
        return Ok(value);
    }

    [HttpGet("satis-kayitlari/{id:int}/adettoplamurunmaliyeti")]
    public async Task<IActionResult> GetSatisKaydiAdetToplamUrunMaliyeti(int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT TOP 1 AdetToplamUrunMaliyetiEuro FROM dbo.SatisKayitlari WITH (NOLOCK) WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var scalar = await cmd.ExecuteScalarAsync();
        if (scalar == null || Convert.IsDBNull(scalar)) return Ok(null);
        var value = Convert.ToDecimal(scalar);
        return Ok(value);
    }

    private async Task<IActionResult> GetByIdAsync(string tableName, int id)
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = $"SELECT TOP 1 ToplamMaliyetEuro FROM dbo.{tableName} WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        var scalar = await cmd.ExecuteScalarAsync();
        if (scalar == null || Convert.IsDBNull(scalar)) return Ok(null);
        var value = Convert.ToDecimal(scalar);
        return Ok(value);
    }

    private async Task<decimal> GetToplamMaliyetFromApiAsync(string relativePath)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var baseUri = $"{Request.Scheme}://{Request.Host}";
            using var resp = await client.GetAsync(baseUri + relativePath);
            if (!resp.IsSuccessStatusCode) return 0m;
            var json = await resp.Content.ReadAsStringAsync();
            var value = JsonSerializer.Deserialize<decimal?>(json);
            return value ?? 0m;
        }
        catch
        {
            return 0m;
        }
    }
}

