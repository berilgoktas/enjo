SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ============================================================
   Kullanicilar
   ============================================================ */
IF OBJECT_ID(N'dbo.Kullanicilar', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.Kullanicilar', 'Rol') IS NULL
BEGIN
    ALTER TABLE dbo.Kullanicilar ADD Rol NVARCHAR(50) DEFAULT 'User';
END
GO

IF OBJECT_ID(N'dbo.Kullanicilar', N'U') IS NOT NULL
    UPDATE dbo.Kullanicilar SET Rol = 'User' WHERE Rol IS NULL;
GO

IF OBJECT_ID(N'dbo.Kullanicilar', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM dbo.Kullanicilar WHERE KullaniciAdi = 'admin')
BEGIN
    UPDATE dbo.Kullanicilar SET Rol = 'admin' WHERE KullaniciAdi = 'admin';
END
GO

IF OBJECT_ID(N'dbo.Kullanicilar', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.Kullanicilar', 'OlusturmaTarihi') IS NULL
BEGIN
    ALTER TABLE dbo.Kullanicilar ADD OlusturmaTarihi DATETIME2 DEFAULT GETDATE();
END
GO

IF OBJECT_ID(N'dbo.Kullanicilar', N'U') IS NOT NULL
    UPDATE dbo.Kullanicilar SET OlusturmaTarihi = GETDATE() WHERE OlusturmaTarihi IS NULL;
GO

/* ============================================================
   AdminVarsayilanDegerler
   ============================================================ */
IF OBJECT_ID(N'dbo.AdminVarsayilanDegerler', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AdminVarsayilanDegerler (
        Id int IDENTITY(1,1) PRIMARY KEY,
        EuroKuru decimal(10,4) NULL,
        OperatorUcreti decimal(10,2) NOT NULL,
        ElektrikUcreti decimal(10,4) NOT NULL,
        KwDegeri decimal(10,2) NOT NULL,
        FaydaliOmurYil int NOT NULL,
        MakineBedeliEuro decimal(12,2) NOT NULL,
        YillikBakimMaliyeti decimal(10,2) NOT NULL,
        KalipBakimUcreti decimal(10,2) NOT NULL,
        GuncellemeTarihi datetime2 DEFAULT GETDATE()
    );
END
GO

IF COL_LENGTH('dbo.AdminVarsayilanDegerler', 'EuroKuru') IS NULL
BEGIN
    ALTER TABLE dbo.AdminVarsayilanDegerler ADD EuroKuru decimal(10,4) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.AdminVarsayilanDegerler)
BEGIN
    INSERT INTO dbo.AdminVarsayilanDegerler
    (EuroKuru, OperatorUcreti, ElektrikUcreti, KwDegeri, FaydaliOmurYil, MakineBedeliEuro, YillikBakimMaliyeti, KalipBakimUcreti)
    VALUES
    (NULL, 30000, 4.7, 37, 30, 74000, 700, 50);
END
GO

/* ============================================================
   AzotluCapakAlmaVarsayilanDegerler
   ============================================================ */
IF OBJECT_ID(N'dbo.AzotluCapakAlmaVarsayilanDegerler', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AzotluCapakAlmaVarsayilanDegerler (
        Id int IDENTITY(1,1) PRIMARY KEY,
        YillikBakimBedeli decimal(10,2) NOT NULL,
        IslemBasinaHarcananAzotGram decimal(10,2) NOT NULL,
        TasKgSaniye decimal(10,4) NOT NULL,
        Tas1KgFiyatiEuro decimal(10,4) NOT NULL,
        AzotKgFiyatiTl decimal(10,2) NOT NULL,
        KwDegeri decimal(10,2) NOT NULL,
        MakineBedeliEuro decimal(12,2) NOT NULL,
        FaydaliOmurYil int NOT NULL,
        GuncellemeTarihi datetime2 DEFAULT GETDATE()
    );
END
GO

IF COL_LENGTH('dbo.AzotluCapakAlmaVarsayilanDegerler', 'KwDegeri') IS NULL
    ALTER TABLE dbo.AzotluCapakAlmaVarsayilanDegerler ADD KwDegeri decimal(10,2) NOT NULL DEFAULT 37;
IF COL_LENGTH('dbo.AzotluCapakAlmaVarsayilanDegerler', 'MakineBedeliEuro') IS NULL
    ALTER TABLE dbo.AzotluCapakAlmaVarsayilanDegerler ADD MakineBedeliEuro decimal(12,2) NOT NULL DEFAULT 74000;
IF COL_LENGTH('dbo.AzotluCapakAlmaVarsayilanDegerler', 'FaydaliOmurYil') IS NULL
    ALTER TABLE dbo.AzotluCapakAlmaVarsayilanDegerler ADD FaydaliOmurYil int NOT NULL DEFAULT 30;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.AzotluCapakAlmaVarsayilanDegerler)
BEGIN
    INSERT INTO dbo.AzotluCapakAlmaVarsayilanDegerler
    (YillikBakimBedeli, IslemBasinaHarcananAzotGram, TasKgSaniye, Tas1KgFiyatiEuro, AzotKgFiyatiTl, KwDegeri, MakineBedeliEuro, FaydaliOmurYil)
    VALUES
    (44700, 66304, 1, 8, 0, 37, 74000, 30);
END
GO

/* ============================================================
   SantrifujVarsayilanDegerler
   ============================================================ */
IF OBJECT_ID(N'dbo.SantrifujVarsayilanDegerler', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SantrifujVarsayilanDegerler (
        Id int IDENTITY(1,1) PRIMARY KEY,
        MakineBedeliEuro decimal(12,2) NOT NULL,
        FaydaliOmurYil int NOT NULL,
        YillikBakimBedeli decimal(10,2) NOT NULL,
        KwDegeri decimal(10,2) NOT NULL,
        IdealKg decimal(10,2) NOT NULL,
        FullKapasiteOperasyonSuresiSn decimal(10,2) NOT NULL,
        GuncellemeTarihi datetime2 DEFAULT GETDATE()
    );
END
GO

IF COL_LENGTH('dbo.SantrifujVarsayilanDegerler', 'IdealKg') IS NULL
    ALTER TABLE dbo.SantrifujVarsayilanDegerler ADD IdealKg decimal(10,2) NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.SantrifujVarsayilanDegerler', 'FullKapasiteOperasyonSuresiSn') IS NULL
    ALTER TABLE dbo.SantrifujVarsayilanDegerler ADD FullKapasiteOperasyonSuresiSn decimal(10,2) NOT NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SantrifujVarsayilanDegerler)
BEGIN
    INSERT INTO dbo.SantrifujVarsayilanDegerler
    (MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli, KwDegeri, IdealKg, FullKapasiteOperasyonSuresiSn)
    VALUES
    (0, 0, 0, 0, 0, 0);
END
GO

/* ============================================================
   PosturlemeVarsayilanDegerler
   ============================================================ */
IF OBJECT_ID(N'dbo.PosturlemeVarsayilanDegerler', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PosturlemeVarsayilanDegerler (
        Id int IDENTITY(1,1) PRIMARY KEY,
        MakineBedeliEuro decimal(12,2) NOT NULL,
        FaydaliOmurYil int NOT NULL,
        YillikBakimBedeli decimal(10,2) NOT NULL,
        KwDegeri decimal(10,2) NOT NULL,
        IdealKg decimal(10,2) NOT NULL,
        FullKapasiteOperasyonSuresiSn decimal(10,2) NOT NULL,
        GuncellemeTarihi datetime2 DEFAULT GETDATE()
    );
END
GO

IF COL_LENGTH('dbo.PosturlemeVarsayilanDegerler', 'IdealKg') IS NULL
    ALTER TABLE dbo.PosturlemeVarsayilanDegerler ADD IdealKg decimal(10,2) NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.PosturlemeVarsayilanDegerler', 'FullKapasiteOperasyonSuresiSn') IS NULL
    ALTER TABLE dbo.PosturlemeVarsayilanDegerler ADD FullKapasiteOperasyonSuresiSn decimal(10,2) NOT NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.PosturlemeVarsayilanDegerler)
BEGIN
    INSERT INTO dbo.PosturlemeVarsayilanDegerler
    (MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli, KwDegeri, IdealKg, FullKapasiteOperasyonSuresiSn)
    VALUES
    (50000, 10, 5000, 15.5, 0, 0);
END
GO

/* ============================================================
   YikamaVarsayilanDegerler
   ============================================================ */
IF OBJECT_ID(N'dbo.YikamaVarsayilanDegerler', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.YikamaVarsayilanDegerler (
        Id int IDENTITY(1,1) PRIMARY KEY,
        KwDegeri decimal(10,2) NOT NULL,
        DeterjanSaatlikFiyatEuro decimal(10,4) NOT NULL,
        MakineBedeliEuro decimal(12,2) NOT NULL,
        FaydaliOmurYil int NOT NULL,
        YillikBakimBedeli decimal(10,2) NOT NULL,
        IdealKg decimal(10,2) NOT NULL,
        FullKapasiteOperasyonSuresiSn decimal(10,2) NOT NULL,
        GuncellemeTarihi datetime2 DEFAULT GETDATE()
    );
END
GO

IF COL_LENGTH('dbo.YikamaVarsayilanDegerler', 'IdealKg') IS NULL
    ALTER TABLE dbo.YikamaVarsayilanDegerler ADD IdealKg decimal(10,2) NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.YikamaVarsayilanDegerler', 'FullKapasiteOperasyonSuresiSn') IS NULL
    ALTER TABLE dbo.YikamaVarsayilanDegerler ADD FullKapasiteOperasyonSuresiSn decimal(10,2) NOT NULL DEFAULT 0;
GO

IF COL_LENGTH('dbo.YikamaVarsayilanDegerler', 'DeterjanSaatlikFiyatEuro') IS NOT NULL
BEGIN
    ALTER TABLE dbo.YikamaVarsayilanDegerler
    ALTER COLUMN DeterjanSaatlikFiyatEuro decimal(10,4) NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.YikamaVarsayilanDegerler)
BEGIN
    INSERT INTO dbo.YikamaVarsayilanDegerler
    (KwDegeri, DeterjanSaatlikFiyatEuro, MakineBedeliEuro, FaydaliOmurYil, YillikBakimBedeli, IdealKg, FullKapasiteOperasyonSuresiSn)
    VALUES
    (0, 0, 0, 0, 0, 0, 0);
END
GO

/* ============================================================
   SatisKayitlari
   ============================================================ */
IF OBJECT_ID(N'dbo.SatisKayitlari', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SatisKayitlari
    (
        Id int IDENTITY(1,1) PRIMARY KEY,
        Ad nvarchar(200) NOT NULL,
        Tarih datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        MalzemeMaliyeti decimal(18,6) NOT NULL,
        IscilikMaliyeti decimal(18,6) NOT NULL,
        ElektrikMaliyeti decimal(18,6) NOT NULL,
        AmortismanMaliyeti decimal(18,6) NOT NULL,
        MakineBakimMaliyeti decimal(18,6) NOT NULL,
        KalipMaliyeti decimal(18,6) NOT NULL,
        ToplamMaliyet decimal(18,6) NOT NULL,
        NetUretimMaliyeti decimal(18,6) NULL,
        YanUrunTuru nvarchar(50) NULL,
        HarcananBirimAzotMaliyetiEuro decimal(18,6) NULL,
        HarcananBirimTasMaliyetiEuro decimal(18,6) NULL,
        DeterjanMaliyetiEuro decimal(18,11) NULL,
        Formlar nvarchar(max) NULL,
        EnjeksiyonId int NULL,
        AzotluCapakAlmaId int NULL,
        PosturlemeId int NULL,
        SantrifujId int NULL,
        YikamaId int NULL,
        BirimBrutAgirlik float NULL,
        BirimHammaddeMaliyetiEuro decimal(18,6) NULL,
        ToplamYanUrunMaliyetiEuro AS (
            COALESCE(HarcananBirimAzotMaliyetiEuro, 0) +
            COALESCE(HarcananBirimTasMaliyetiEuro, 0) +
            COALESCE(DeterjanMaliyetiEuro, 0)
        ) PERSISTED,
        BirimNetAgirlik decimal(18,6) NULL,
        AdetToplamUrunMaliyetiEuro decimal(18,6) NULL
    );
END
GO

IF COL_LENGTH('dbo.SatisKayitlari', 'Formlar') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD Formlar nvarchar(max) NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'EnjeksiyonId') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD EnjeksiyonId int NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'AzotluCapakAlmaId') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD AzotluCapakAlmaId int NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'PosturlemeId') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD PosturlemeId int NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'SantrifujId') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD SantrifujId int NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'YikamaId') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD YikamaId int NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'YanUrunTuru') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD YanUrunTuru nvarchar(50) NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'HarcananBirimAzotMaliyetiEuro') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD HarcananBirimAzotMaliyetiEuro decimal(18,6) NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'HarcananBirimTasMaliyetiEuro') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD HarcananBirimTasMaliyetiEuro decimal(18,6) NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'DeterjanMaliyetiEuro') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD DeterjanMaliyetiEuro decimal(18,11) NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'BirimBrutAgirlik') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD BirimBrutAgirlik float NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'BirimHammaddeMaliyetiEuro') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD BirimHammaddeMaliyetiEuro decimal(18,6) NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'NetUretimMaliyeti') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD NetUretimMaliyeti decimal(18,6) NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'BirimNetAgirlik') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD BirimNetAgirlik decimal(18,6) NULL;
IF COL_LENGTH('dbo.SatisKayitlari', 'AdetToplamUrunMaliyetiEuro') IS NULL
    ALTER TABLE dbo.SatisKayitlari ADD AdetToplamUrunMaliyetiEuro decimal(18,6) NULL;
GO

IF COL_LENGTH('dbo.SatisKayitlari', 'ToplamYanUrunMaliyetiEuro') IS NOT NULL
    ALTER TABLE dbo.SatisKayitlari DROP COLUMN ToplamYanUrunMaliyetiEuro;
GO

IF COL_LENGTH('dbo.SatisKayitlari', 'DeterjanMaliyetiEuro') IS NOT NULL
BEGIN
    ALTER TABLE dbo.SatisKayitlari ALTER COLUMN DeterjanMaliyetiEuro decimal(18,11) NULL;
END
GO

IF COL_LENGTH('dbo.SatisKayitlari', 'ToplamYanUrunMaliyetiEuro') IS NULL
    AND COL_LENGTH('dbo.SatisKayitlari', 'HarcananBirimAzotMaliyetiEuro') IS NOT NULL
    AND COL_LENGTH('dbo.SatisKayitlari', 'HarcananBirimTasMaliyetiEuro') IS NOT NULL
    AND COL_LENGTH('dbo.SatisKayitlari', 'DeterjanMaliyetiEuro') IS NOT NULL
BEGIN
    ALTER TABLE dbo.SatisKayitlari
    ADD ToplamYanUrunMaliyetiEuro AS (
        COALESCE(HarcananBirimAzotMaliyetiEuro, 0) +
        COALESCE(HarcananBirimTasMaliyetiEuro, 0) +
        COALESCE(DeterjanMaliyetiEuro, 0)
    ) PERSISTED;
END
GO

/* ============================================================
   Enjeksiyon / AzotluCapakAlma / Yikama islem tablolari
   ============================================================ */
IF OBJECT_ID(N'dbo.Enjeksiyon', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.Enjeksiyon', 'ToplamHammaddeMaliyetiEuro') IS NULL
    ALTER TABLE dbo.Enjeksiyon ADD ToplamHammaddeMaliyetiEuro decimal(18,6) NULL;
GO

IF OBJECT_ID(N'dbo.AzotluCapakAlma', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.AzotluCapakAlma', 'BirimNetAgirlik') IS NULL
    ALTER TABLE dbo.AzotluCapakAlma ADD BirimNetAgirlik decimal(18,6) NULL;
GO

IF OBJECT_ID(N'dbo.AzotluCapakAlma', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.AzotluCapakAlma', 'IslemGorenUrunAdedi') IS NULL
    ALTER TABLE dbo.AzotluCapakAlma ADD IslemGorenUrunAdedi DECIMAL(18,6) NULL;
GO

IF OBJECT_ID(N'dbo.AzotluCapakAlma', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.AzotluCapakAlma', 'IslemGorenUrunAdedi') IS NOT NULL
BEGIN
    UPDATE dbo.AzotluCapakAlma
    SET IslemGorenUrunAdedi = YuklemeBosaltmaSuresi / (BaskiToplamBrutAgirlik / KalipGozSayisi)
    WHERE IslemGorenUrunAdedi IS NULL
      AND BaskiToplamBrutAgirlik > 0
      AND KalipGozSayisi > 0;
END
GO

IF OBJECT_ID(N'dbo.Yikama', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.Yikama', 'KalipBakimMaliyetiEuro') IS NULL
        ALTER TABLE dbo.Yikama ADD KalipBakimMaliyetiEuro decimal(12,4) NOT NULL DEFAULT 0;
    IF COL_LENGTH('dbo.Yikama', 'KalipMaliyetiEuro') IS NULL
        ALTER TABLE dbo.Yikama ADD KalipMaliyetiEuro decimal(12,4) NOT NULL DEFAULT 0;
END
GO

/* ============================================================
   Hassasiyet duzeltmeleri
   ============================================================ */
IF OBJECT_ID(N'dbo.Posturleme', N'U') IS NOT NULL
BEGIN
    ALTER TABLE dbo.Posturleme ALTER COLUMN ToplamIscilikMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Posturleme ALTER COLUMN ElektrikMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Posturleme ALTER COLUMN AmortismanMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Posturleme ALTER COLUMN MakineBakimMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Posturleme ALTER COLUMN ToplamMaliyetEuro decimal(18,6) NULL;
END
GO

IF OBJECT_ID(N'dbo.Santrifuj', N'U') IS NOT NULL
BEGIN
    ALTER TABLE dbo.Santrifuj ALTER COLUMN ToplamIscilikMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Santrifuj ALTER COLUMN ElektrikMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Santrifuj ALTER COLUMN AmortismanMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Santrifuj ALTER COLUMN MakineBakimMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Santrifuj ALTER COLUMN ToplamMaliyetEuro decimal(18,6) NULL;
END
GO

IF OBJECT_ID(N'dbo.Yikama', N'U') IS NOT NULL
BEGIN
    ALTER TABLE dbo.Yikama ALTER COLUMN ToplamIscilikMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Yikama ALTER COLUMN ElektrikMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Yikama ALTER COLUMN AmortismanMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Yikama ALTER COLUMN MakineBakimMaliyetiEuro decimal(18,6) NULL;
    ALTER TABLE dbo.Yikama ALTER COLUMN ToplamMaliyetEuro decimal(18,6) NULL;
    IF COL_LENGTH('dbo.Yikama', 'DeterjanMaliyetiEuro') IS NOT NULL
        ALTER TABLE dbo.Yikama ALTER COLUMN DeterjanMaliyetiEuro decimal(18,11) NULL;
END
GO
