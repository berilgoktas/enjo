using enjoapi.Models;
using enjoapi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace enjoapi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly string _cs;
    private readonly TCMBService _tcmbService;

    public AdminController(IConfiguration config, TCMBService tcmbService)
    {
        _cs = config.GetConnectionString("Default")!;
        _tcmbService = tcmbService;
    }

    [HttpGet("enjeksiyon-varsayilan-degerler")]
    public async Task<IActionResult> GetEnjeksiyonVarsayilanDegerler()
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT TOP 1 * FROM dbo.AdminVarsayilanDegerler ORDER BY GuncellemeTarihi DESC";
        await con.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();
        
        if (await reader.ReadAsync())
        {
            var degerler = new AdminVarsayilanDegerler
            {
                Id = reader.GetInt32(0),
                EuroKuru = reader.GetDecimal(1),
                OperatorUcreti = reader.GetDecimal(2),
                ElektrikUcreti = reader.GetDecimal(3),
                KwDegeri = reader.GetDecimal(4),
                FaydaliOmurYil = reader.GetInt32(5),
                MakineBedeliEuro = reader.GetDecimal(6),
                YillikBakimMaliyeti = reader.GetDecimal(7),
                KalipBakimUcreti = reader.GetDecimal(8),
                GuncellemeTarihi = reader.GetDateTime(9)
            };
            return Ok(degerler);
        }
        return NotFound("Varsayılan değerler bulunamadı");
    }

    [HttpPut("enjeksiyon-varsayilan-degerler")]
    public async Task<IActionResult> GuncelleEnjeksiyonVarsayilanDegerler([FromBody] AdminGuncellenebilirDegerler degerler)
    {
        // Önce mevcut değerleri oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = "SELECT TOP 1 * FROM dbo.AdminVarsayilanDegerler ORDER BY GuncellemeTarihi DESC";
        await con0.OpenAsync();
        using var reader = await cmd0.ExecuteReaderAsync();
        
        if (!await reader.ReadAsync())
        {
            return NotFound("Mevcut varsayılan değerler bulunamadı");
        }

        // Gönderilmeyen değerleri mevcut değerlerle doldur
        decimal euroKuru = reader.GetDecimal(1);
        decimal operatorUcreti = degerler.OperatorUcreti ?? reader.GetDecimal(2);
        decimal elektrikUcreti = degerler.ElektrikUcreti ?? reader.GetDecimal(3);
        decimal kwDegeri = degerler.KwDegeri ?? reader.GetDecimal(4);
        int faydaliOmurYil = degerler.FaydaliOmurYil ?? reader.GetInt32(5);
        decimal makineBedeliEuro = degerler.MakineBedeliEuro ?? reader.GetDecimal(6);
        decimal yillikBakimMaliyeti = degerler.YillikBakimMaliyeti ?? reader.GetDecimal(7);
        decimal kalipBakimUcreti = degerler.KalipBakimUcreti ?? reader.GetDecimal(8);
        
        await reader.CloseAsync();
        await con0.CloseAsync();

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"INSERT INTO dbo.AdminVarsayilanDegerler 
                            (EuroKuru, OperatorUcreti, ElektrikUcreti, KwDegeri, FaydaliOmurYil, 
                             MakineBedeliEuro, YillikBakimMaliyeti, KalipBakimUcreti)
                            VALUES 
                            (@EuroKuru, @OperatorUcreti, @ElektrikUcreti, @KwDegeri, @FaydaliOmurYil,
                             @MakineBedeliEuro, @YillikBakimMaliyeti, @KalipBakimUcreti)";
        
        // EuroKuru parametresi kaldırıldı - TCMB'den otomatik gelecek
        cmd.Parameters.AddWithValue("@EuroKuru", euroKuru);
        cmd.Parameters.AddWithValue("@OperatorUcreti", operatorUcreti);
        cmd.Parameters.AddWithValue("@ElektrikUcreti", elektrikUcreti);
        cmd.Parameters.AddWithValue("@KwDegeri", kwDegeri);
        cmd.Parameters.AddWithValue("@FaydaliOmurYil", faydaliOmurYil);
        cmd.Parameters.AddWithValue("@MakineBedeliEuro", makineBedeliEuro);
        cmd.Parameters.AddWithValue("@YillikBakimMaliyeti", yillikBakimMaliyeti);
        cmd.Parameters.AddWithValue("@KalipBakimUcreti", kalipBakimUcreti);
        
        await con.OpenAsync();
        await cmd.ExecuteNonQueryAsync();
        return Ok(new { mesaj = "Varsayılan değerler güncellendi (Euro kuru TCMB'den otomatik gelecek)" });
    }

    [HttpPost("guncelle-euro-kuru")]
    public async Task<IActionResult> GuncelleEuroKuru()
    {
        var euroKuru = await _tcmbService.GetEuroKuruAsync();
        if (!euroKuru.HasValue)
        {
            return BadRequest("TCMB'den Euro kuru çekilemedi");
        }

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"
            UPDATE dbo.AdminVarsayilanDegerler 
            SET EuroKuru = @EuroKuru, GuncellemeTarihi = GETDATE()
            WHERE Id = (SELECT TOP 1 Id FROM dbo.AdminVarsayilanDegerler ORDER BY GuncellemeTarihi DESC)";
        
        cmd.Parameters.AddWithValue("@EuroKuru", euroKuru.Value);
        await con.OpenAsync();
        var affected = await cmd.ExecuteNonQueryAsync();
        
        if (affected > 0)
        {
            return Ok(new { 
                mesaj = "Euro kuru güncellendi", 
                euroKuru = euroKuru.Value,
                guncellemeTarihi = DateTime.Now
            });
        }
        
        return NotFound("Güncellenecek kayıt bulunamadı");
    }

    [HttpGet("azotlu-capak-alma-varsayilan-degerler")]
    public async Task<IActionResult> GetAzotluCapakAlmaVarsayilanDegerler()
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT TOP 1 Id, YillikBakimBedeli, IslemBasinaHarcananAzotGram, TasKgSaniye, 
                            Tas1KgFiyatiEuro, AzotKgFiyatiTl, KwDegeri, MakineBedeliEuro, FaydaliOmurYil, GuncellemeTarihi 
                            FROM dbo.AzotluCapakAlmaVarsayilanDegerler ORDER BY GuncellemeTarihi DESC";
        await con.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();
        
        if (await reader.ReadAsync())
        {
            var degerler = new AzotluCapakAlmaVarsayilanDegerler
            {
                Id = reader.GetInt32(0),
                YillikBakimBedeli = reader.GetDecimal(1),
                IslemBasinaHarcananAzotGram = reader.GetDecimal(2),
                TasKgSaniye = reader.GetDecimal(3),
                Tas1KgFiyatiEuro = reader.GetDecimal(4),
                AzotKgFiyatiTl = reader.GetDecimal(5),
                KwDegeri = reader.GetDecimal(6),
                MakineBedeliEuro = reader.GetDecimal(7),
                FaydaliOmurYil = reader.GetInt32(8),
                GuncellemeTarihi = reader.GetDateTime(9)
            };
            return Ok(degerler);
        }
        return NotFound("Azotlu çapak alma varsayılan değerler bulunamadı");
    }

    [HttpPut("azotlu-capak-alma-varsayilan-degerler")]
    public async Task<IActionResult> GuncelleAzotluCapakAlmaVarsayilanDegerler([FromBody] AzotluCapakAlmaGuncellenebilirDegerler degerler)
    {
        // Önce mevcut değerleri oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = @"SELECT TOP 1 * FROM dbo.AzotluCapakAlmaVarsayilanDegerler ORDER BY GuncellemeTarihi DESC";
        await con0.OpenAsync();
        using var reader = await cmd0.ExecuteReaderAsync();
        
        if (!await reader.ReadAsync())
        {
            return NotFound("Mevcut varsayılan değerler bulunamadı");
        }

        // Gönderilmeyen değerleri mevcut değerlerle doldur
        decimal yillikBakimBedeli = degerler.YillikBakimBedeli ?? reader.GetDecimal(1);
        decimal islemBasinaHarcananAzotGram = degerler.IslemBasinaHarcananAzotGram ?? reader.GetDecimal(2);
        decimal tasKgSaniye = degerler.TasKgSaniye ?? reader.GetDecimal(3);
        decimal tas1KgFiyatiEuro = degerler.Tas1KgFiyatiEuro ?? reader.GetDecimal(4);
        decimal azotKgFiyatiTl = degerler.AzotKgFiyatiTl ?? reader.GetDecimal(5);
        decimal kwDegeri = degerler.KwDegeri ?? reader.GetDecimal(6);
        decimal makineBedeliEuro = degerler.MakineBedeliEuro ?? reader.GetDecimal(7);
        int faydaliOmurYil = degerler.FaydaliOmurYil ?? reader.GetInt32(8);
        
        await reader.CloseAsync();
        await con0.CloseAsync();

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"INSERT INTO dbo.AzotluCapakAlmaVarsayilanDegerler 
                            (YillikBakimBedeli, IslemBasinaHarcananAzotGram, TasKgSaniye, Tas1KgFiyatiEuro, 
                             AzotKgFiyatiTl, KwDegeri, MakineBedeliEuro, FaydaliOmurYil)
                            VALUES 
                            (@YillikBakimBedeli, @IslemBasinaHarcananAzotGram, @TasKgSaniye, @Tas1KgFiyatiEuro,
                             @AzotKgFiyatiTl, @KwDegeri, @MakineBedeliEuro, @FaydaliOmurYil)";
        
        cmd.Parameters.AddWithValue("@YillikBakimBedeli", yillikBakimBedeli);
        cmd.Parameters.AddWithValue("@IslemBasinaHarcananAzotGram", islemBasinaHarcananAzotGram);
        cmd.Parameters.AddWithValue("@TasKgSaniye", tasKgSaniye);
        cmd.Parameters.AddWithValue("@Tas1KgFiyatiEuro", tas1KgFiyatiEuro);
        cmd.Parameters.AddWithValue("@AzotKgFiyatiTl", azotKgFiyatiTl);
        cmd.Parameters.AddWithValue("@KwDegeri", kwDegeri);
        cmd.Parameters.AddWithValue("@MakineBedeliEuro", makineBedeliEuro);
        cmd.Parameters.AddWithValue("@FaydaliOmurYil", faydaliOmurYil);
        
        await con.OpenAsync();
        await cmd.ExecuteNonQueryAsync();
        return Ok(new { mesaj = "Azotlu çapak alma varsayılan değerler güncellendi" });
    }

    [HttpGet("posturleme-varsayilan-degerler")]
    public async Task<IActionResult> GetPosturlemeVarsayilanDegerler()
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT TOP 1 Id, MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli, KwDegeri, IdealKg, FullKapasiteOperasyonSuresiSn, GuncellemeTarihi 
                            FROM dbo.PosturlemeVarsayilanDegerler ORDER BY GuncellemeTarihi DESC";
        await con.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();
        
        if (await reader.ReadAsync())
        {
            var degerler = new PosturlemeVarsayilanDegerler
            {
                Id = reader.GetInt32(0),
                MakineBedeliEuro = reader.GetDecimal(1),
                FaydaliOmurYil = reader.GetInt32(2),
                YillikBakimBedeli = reader.GetDecimal(3),
                KwDegeri = reader.GetDecimal(4),
                IdealKg = reader.GetDecimal(5),
                FullKapasiteOperasyonSuresiSn = reader.GetDecimal(6),
                GuncellemeTarihi = reader.GetDateTime(7)
            };
            return Ok(degerler);
        }
        return NotFound("Postürleme varsayılan değerler bulunamadı");
    }

    [HttpPut("posturleme-varsayilan-degerler")]
    public async Task<IActionResult> GuncellePosturlemeVarsayilanDegerler([FromBody] PosturlemeGuncellenebilirDegerler degerler)
    {
        // Önce mevcut değerleri oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = @"SELECT TOP 1 * FROM dbo.PosturlemeVarsayilanDegerler ORDER BY GuncellemeTarihi DESC";
        await con0.OpenAsync();
        using var reader = await cmd0.ExecuteReaderAsync();
        
        if (!await reader.ReadAsync())
        {
            return NotFound("Mevcut varsayılan değerler bulunamadı");
        }

        // Gönderilmeyen değerleri mevcut değerlerle doldur
        decimal makineBedeliEuro = degerler.MakineBedeliEuro ?? reader.GetDecimal(1);
        int faydaliOmurYil = degerler.FaydaliOmurYil ?? reader.GetInt32(2);
        decimal yillikBakimBedeli = degerler.YillikBakimBedeli ?? reader.GetDecimal(3);
        decimal kwDegeri = degerler.KwDegeri ?? reader.GetDecimal(4);
        decimal idealKg = degerler.IdealKg ?? reader.GetDecimal(5);
        decimal fullKapasiteOperasyonSuresiSn = degerler.FullKapasiteOperasyonSuresiSn ?? reader.GetDecimal(6);
        
        await reader.CloseAsync();
        await con0.CloseAsync();

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"INSERT INTO dbo.PosturlemeVarsayilanDegerler 
                            (MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli, KwDegeri, IdealKg, FullKapasiteOperasyonSuresiSn)
                            VALUES 
                            (@MakineBedeliEuro, @FaydaliOmurYil, @YillikBakimBedeli, @KwDegeri, @IdealKg, @FullKapasiteOperasyonSuresiSn)";
        
        cmd.Parameters.AddWithValue("@MakineBedeliEuro", makineBedeliEuro);
        cmd.Parameters.AddWithValue("@FaydaliOmurYil", faydaliOmurYil);
        cmd.Parameters.AddWithValue("@YillikBakimBedeli", yillikBakimBedeli);
        cmd.Parameters.AddWithValue("@KwDegeri", kwDegeri);
        cmd.Parameters.AddWithValue("@IdealKg", idealKg);
        cmd.Parameters.AddWithValue("@FullKapasiteOperasyonSuresiSn", fullKapasiteOperasyonSuresiSn);
        
        await con.OpenAsync();
        await cmd.ExecuteNonQueryAsync();
        return Ok(new { mesaj = "Postürleme varsayılan değerler güncellendi" });
    }

    [HttpGet("santrifuj-varsayilan-degerler")]
    public async Task<IActionResult> GetSantrifujVarsayilanDegerler()
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT TOP 1 Id, MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli, KwDegeri, IdealKg, FullKapasiteOperasyonSuresiSn, GuncellemeTarihi 
                            FROM dbo.SantrifujVarsayilanDegerler ORDER BY GuncellemeTarihi DESC";
        await con.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();
        
        if (await reader.ReadAsync())
        {
            var degerler = new SantrifujVarsayilanDegerler
            {
                Id = reader.GetInt32(0),
                MakineBedeliEuro = reader.GetDecimal(1),
                FaydaliOmurYil = reader.GetInt32(2),
                YillikBakimBedeli = reader.GetDecimal(3),
                KwDegeri = reader.GetDecimal(4),
                IdealKg = reader.GetDecimal(5),
                FullKapasiteOperasyonSuresiSn = reader.GetDecimal(6),
                GuncellemeTarihi = reader.GetDateTime(7)
            };
            return Ok(degerler);
        }
        return NotFound("Santrifüj varsayılan değerler bulunamadı");
    }

    [HttpPut("santrifuj-varsayilan-degerler")]
    public async Task<IActionResult> GuncelleSantrifujVarsayilanDegerler([FromBody] SantrifujGuncellenebilirDegerler degerler)
    {
        // Önce mevcut değerleri oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = @"SELECT TOP 1 * FROM dbo.SantrifujVarsayilanDegerler ORDER BY GuncellemeTarihi DESC";
        await con0.OpenAsync();
        using var reader = await cmd0.ExecuteReaderAsync();
        
        if (!await reader.ReadAsync())
        {
            return NotFound("Mevcut varsayılan değerler bulunamadı");
        }

        // Gönderilmeyen değerleri mevcut değerlerle doldur
        decimal makineBedeliEuro = degerler.MakineBedeliEuro ?? reader.GetDecimal(1);
        int faydaliOmurYil = degerler.FaydaliOmurYil ?? reader.GetInt32(2);
        decimal yillikBakimBedeli = degerler.YillikBakimBedeli ?? reader.GetDecimal(3);
        decimal kwDegeri = degerler.KwDegeri ?? reader.GetDecimal(4);
        decimal idealKg = degerler.IdealKg ?? reader.GetDecimal(5);
        decimal fullKapasiteOperasyonSuresiSn = degerler.FullKapasiteOperasyonSuresiSn ?? reader.GetDecimal(6);
        
        await reader.CloseAsync();
        await con0.CloseAsync();

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"INSERT INTO dbo.SantrifujVarsayilanDegerler 
                            (MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli, KwDegeri, IdealKg, FullKapasiteOperasyonSuresiSn)
                            VALUES 
                            (@MakineBedeliEuro, @FaydaliOmurYil, @YillikBakimBedeli, @KwDegeri, @IdealKg, @FullKapasiteOperasyonSuresiSn)";
        
        cmd.Parameters.AddWithValue("@MakineBedeliEuro", makineBedeliEuro);
        cmd.Parameters.AddWithValue("@FaydaliOmurYil", faydaliOmurYil);
        cmd.Parameters.AddWithValue("@YillikBakimBedeli", yillikBakimBedeli);
        cmd.Parameters.AddWithValue("@KwDegeri", kwDegeri);
        cmd.Parameters.AddWithValue("@IdealKg", idealKg);
        cmd.Parameters.AddWithValue("@FullKapasiteOperasyonSuresiSn", fullKapasiteOperasyonSuresiSn);
        
        await con.OpenAsync();
        await cmd.ExecuteNonQueryAsync();
        return Ok(new { mesaj = "Santrifüj varsayılan değerler güncellendi" });
    }

    [HttpGet("yikama-varsayilan-degerler")]
    public async Task<IActionResult> GetYikamaVarsayilanDegerler()
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"SELECT TOP 1 Id, KwDegeri, DeterjanSaatlikFiyatEuro, MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli, IdealKg, FullKapasiteOperasyonSuresiSn, GuncellemeTarihi 
                            FROM dbo.YikamaVarsayilanDegerler ORDER BY GuncellemeTarihi DESC";
        await con.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();
        
        if (await reader.ReadAsync())
        {
            var degerler = new YikamaVarsayilanDegerler
            {
                Id = reader.GetInt32(0),
                KwDegeri = reader.GetDecimal(1),
                DeterjanSaatlikFiyatEuro = reader.GetDecimal(2),
                MakineBedeliEuro = reader.GetDecimal(3),
                FaydaliOmurYil = reader.GetInt32(4),
                YillikBakimBedeli = reader.GetDecimal(5),
                IdealKg = reader.GetDecimal(6),
                FullKapasiteOperasyonSuresiSn = reader.GetDecimal(7),
                GuncellemeTarihi = reader.GetDateTime(8)
            };
            return Ok(degerler);
        }
        return NotFound("Yıkama varsayılan değerler bulunamadı");
    }

    [HttpPut("yikama-varsayilan-degerler")]
    public async Task<IActionResult> GuncelleYikamaVarsayilanDegerler([FromBody] YikamaGuncellenebilirDegerler degerler)
    {
        // Önce mevcut değerleri oku
        using var con0 = new SqlConnection(_cs);
        using var cmd0 = con0.CreateCommand();
        cmd0.CommandText = @"SELECT TOP 1 * FROM dbo.YikamaVarsayilanDegerler ORDER BY GuncellemeTarihi DESC";
        await con0.OpenAsync();
        using var reader = await cmd0.ExecuteReaderAsync();
        
        if (!await reader.ReadAsync())
        {
            return NotFound("Mevcut varsayılan değerler bulunamadı");
        }

        // Gönderilmeyen değerleri mevcut değerlerle doldur
        decimal kwDegeri = degerler.KwDegeri ?? reader.GetDecimal(1);
        decimal deterjanSaatlikFiyatEuro = degerler.DeterjanSaatlikFiyatEuro ?? reader.GetDecimal(2);
        decimal makineBedeliEuro = degerler.MakineBedeliEuro ?? reader.GetDecimal(3);
        int faydaliOmurYil = degerler.FaydaliOmurYil ?? reader.GetInt32(4);
        decimal yillikBakimBedeli = degerler.YillikBakimBedeli ?? reader.GetDecimal(5);
        decimal idealKg = degerler.IdealKg ?? reader.GetDecimal(6);
        decimal fullKapasiteOperasyonSuresiSn = degerler.FullKapasiteOperasyonSuresiSn ?? reader.GetDecimal(7);
        
        await reader.CloseAsync();
        await con0.CloseAsync();

        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"INSERT INTO dbo.YikamaVarsayilanDegerler 
                            (KwDegeri, DeterjanSaatlikFiyatEuro, MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli, IdealKg, FullKapasiteOperasyonSuresiSn)
                            VALUES 
                            (@KwDegeri, @DeterjanSaatlikFiyatEuro, @MakineBedeliEuro, @FaydaliOmurYil, @YillikBakimBedeli, @IdealKg, @FullKapasiteOperasyonSuresiSn)";
        
        cmd.Parameters.AddWithValue("@KwDegeri", kwDegeri);
        cmd.Parameters.AddWithValue("@DeterjanSaatlikFiyatEuro", deterjanSaatlikFiyatEuro);
        cmd.Parameters.AddWithValue("@MakineBedeliEuro", makineBedeliEuro);
        cmd.Parameters.AddWithValue("@FaydaliOmurYil", faydaliOmurYil);
        cmd.Parameters.AddWithValue("@YillikBakimBedeli", yillikBakimBedeli);
        cmd.Parameters.AddWithValue("@IdealKg", idealKg);
        cmd.Parameters.AddWithValue("@FullKapasiteOperasyonSuresiSn", fullKapasiteOperasyonSuresiSn);
        
        await con.OpenAsync();
        await cmd.ExecuteNonQueryAsync();
        return Ok(new { mesaj = "Yıkama varsayılan değerler güncellendi" });
    }

    [HttpPost("fix-yikama-decimal")]
    public async Task<IActionResult> FixYikamaDecimal()
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"
            -- Yıkama varsayılan değerler tablosundaki decimal precision'ı artır
            IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[YikamaVarsayilanDegerler]') AND type in (N'U'))
            BEGIN
                -- DeterjanSaatlikFiyatEuro alanının decimal precision'ını artır
                ALTER TABLE dbo.YikamaVarsayilanDegerler 
                ALTER COLUMN DeterjanSaatlikFiyatEuro decimal(10,4) NOT NULL;
                
                SELECT 'DeterjanSaatlikFiyatEuro decimal precision güncellendi (10,4)' as Mesaj;
            END
            ELSE
            BEGIN
                SELECT 'YikamaVarsayilanDegerler tablosu bulunamadı' as Mesaj;
            END";
        
        await con.OpenAsync();
        var result = await cmd.ExecuteScalarAsync();
        return Ok(new { mesaj = result?.ToString() });
    }

    [HttpPost("add-yikama-columns")]
    public async Task<IActionResult> AddYikamaColumns()
    {
        using var con = new SqlConnection(_cs);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"
            -- Yıkama tablosuna eksik sütunları ekle
            IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Yikama]') AND type in (N'U'))
            BEGIN
                -- KalipBakimMaliyetiEuro sütununu ekle (eğer yoksa)
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Yikama') AND name = 'KalipBakimMaliyetiEuro')
                BEGIN
                    ALTER TABLE dbo.Yikama 
                    ADD KalipBakimMaliyetiEuro decimal(12,4) NOT NULL DEFAULT 0;
                END

                -- KalipMaliyetiEuro sütununu ekle (eğer yoksa)
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Yikama') AND name = 'KalipMaliyetiEuro')
                BEGIN
                    ALTER TABLE dbo.Yikama 
                    ADD KalipMaliyetiEuro decimal(12,4) NOT NULL DEFAULT 0;
                END

                SELECT 'Yıkama tablosuna sütunlar başarıyla eklendi' as Mesaj;
            END
            ELSE
            BEGIN
                SELECT 'Yikama tablosu bulunamadı' as Mesaj;
            END";
        
        await con.OpenAsync();
        var result = await cmd.ExecuteScalarAsync();
        return Ok(new { mesaj = result?.ToString() });
    }

}
