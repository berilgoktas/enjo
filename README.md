# ENJO — Enjeksiyon Süreci Maliyet Analiz Sistemi

ENJO, kauçuk/elastomer parçaların **enjeksiyon üretim sürecindeki birim maliyetini** hesaplamak, kaydetmek ve satışa hazır teklif verisi üretmek için kullanılan bir uygulamadır.

Sistem, üretim hattındaki gerçek maliyet kalemlerini (hammadde, işçilik, elektrik, amortisman, makine bakımı, kalıp, yan ürün/proses sarfiyatları) tek bir kayıtta toplar. Amaç, “bu parça yaklaşık ne kadara mal olur?” sorusuna Excel tabloları ve tahmin yerine **tekrarlanabilir, denetlenebilir bir hesap** vermektir.

## Neden var?

Enjeksiyon üretiminde maliyet; kalıp göz sayısı, çevrim süresi, hammadde fiyatı, Euro kuru, makine bedeli, operatör ücreti ve sonraki proseslere (çapak alma, postürleme, santrifüj, yıkama) göre değişir. Bu değişkenler dağınık tutulduğunda:

- aynı parça için farklı kişiler farklı rakam üretir
- kur ve birim fiyat güncellemeleri hesaba yansımaz
- satış ekibi üretim varsayımlarını göremez
- geçmiş tekliflerin nasıl hesaplandığı kaybolur

ENJO bu boşluğu kapatır: üretim parametreleri forma girilir, sunucu maliyetleri hesaplar, sonuç proje olarak saklanır, satış ekranından incelenir ve Excel/PDF olarak dışa aktarılır.

## Kime hizmet eder?

| Rol | Ne yapar |
| --- | --- |
| **Admin** | Kullanıcı tanımlar, üretim aşamalarını seçer, maliyet hesaplar, projeyi kaydeder, varsayılan makine/enerji değerlerini yönetir |
| **Satış (`user`)** | Kayıtlı projeleri görür, adet bazlı maliyeti inceler, rapor alır; üretim formlarını değiştirmez |

Giriş yapılmadan uygulama kullanılamaz. Admin olmayan kullanıcı üretim ve kullanıcı yönetimi sayfalarına yönlendirilmez.

## Ne hesaplanır?

Hesaplama bir **sihirbaz**dır. Enjeksiyon zorunludur; diğer aşamalar ürüne göre seçilir.

1. **Enjeksiyon** — Baskı, kalıp, hammadde, işçilik, elektrik, amortisman, bakım ve kalıp maliyeti. Üretim zincirinin çekirdeği buradadır.
2. **Azotlu çapak alma** — Azot ve taş sarfiyatı, net ağırlık, işlem gören adet. Yan ürün maliyeti buradan gelir.
3. **Postürleme** — Fırın/makine süresi, enerji ve işçilik.
4. **Santrifüj** — Kapasite, süre, enerji ve bakım.
5. **Yıkama** — Deterjan, enerji, makine ve bakım.

Seçilen aşamaların çıktısı **Sonuçlar** ekranında birleşir: malzeme, işçilik, elektrik, amortisman, bakım, kalıp, yan ürün ve net üretim maliyeti. Kayıt `SatisKayitlari` tablosuna yazılır; satış ekranı bu kayıtlardan çalışır.

Tutarlar **Euro** cinsindendir. Euro kuru TCMB’den periyodik çekilir ve admin varsayılan değerlerine işlenir; hammadde gibi TL girdiler bu kurla çevrilir.

## Nasıl kullanılır?

1. Kullanıcı adı ve şifre ile giriş yapılır. Ardışık hatalı denemede hak azalır; hak bitince kısa süre kilitlenir.
2. Admin **Üretim → Aşama seçimi** ile bu parça için geçerli prosesleri işaretler.
3. Her seçilen aşamanın formu doldurulur (makine varsayılanları admin tablolarından gelir, satır bazında değiştirilebilir).
4. **Sonuçlar** ekranında toplamlar kontrol edilir, proje adı verilerek kaydedilir.
5. **Satış ekranı** kayıtlı projeyi açar, adet çarpanı uygular, Excel veya PDF rapor üretir.
6. **Projeler** listesinden mevcut kayıt güncellenebilir.

Raporlar sabit bir şablonu doldurmaz; o anki proje verisinden üretilir.

## Klasör yapısı

```
enjo/
├── enjoapifront/     React arayüz (Vite)
├── enjoapi/enjoapi/  .NET 8 Web API
├── sql/              Veritabanı şeması (EnjoHesaplama.sql)
├── docker/           Konteyner nginx ayarı
├── Dockerfile
└── docker-compose.yml
```

Arayüz `/api` yolunu kullanır. Geliştirmede Vite bu yolu API’ye iletir; Docker’da aynı işi nginx yapar.

## Teknoloji

- **Arayüz:** React 19, Vite 7, React Router
- **API:** ASP.NET Core 8, ADO.NET (`Microsoft.Data.SqlClient`)
- **Veri:** SQL Server, veritabanı adı `EnjoHesaplama`
- **Kur:** TCMB günlük kur XML’i
- **Rapor:** ExcelJS, pdf-lib
- **Dağıtım:** Tek Docker imajı (nginx + Kestrel)

## Güvenlik ve sınırlar

- Veritabanı bağlantı dizesi yalnızca `enjoapi/enjoapi/.env` içindedir; Git’e girmez. Örnek: `.env.example`.
- `appsettings.json` içinde bağlantı dizesi boş bırakılır.
- API istekleri IP başına günde **5000** ile sınırlıdır.
- Giriş denemesi IP başına dakikada **5** kezdir; fazlası 429 döner.
- Docker dışındaki kaynakta CORS yalnızca `http://localhost:3006` içindir.

## Kurulum

### 1. Veritabanı

SQL Server’da `EnjoHesaplama` veritabanını oluşturun, ardından `sql/EnjoHesaplama.sql` dosyasını çalıştırın. Script mevcut tablolara dokunurken eksik kolonları ekler; `Kullanicilar` ve proses tablolarının daha önce var olduğu varsayılır.

Kullanıcıyı uygulama üzerinden tanımlayın. Şifreyi SQL dosyasına yazmayın.

### 2. Ortam dosyası

```text
enjoapi/enjoapi/.env
```

```env
ConnectionStrings__Default=Server=YOUR_SERVER,1433;Database=EnjoHesaplama;User Id=YOUR_USER;Password=YOUR_PASSWORD;TrustServerCertificate=True;Connection Timeout=30;Command Timeout=30;
```

### 3. Docker (önerilen)

Kök dizinde:

```powershell
docker compose up -d --build
```

| Adres | Ne |
| --- | --- |
| http://localhost:3006 | Arayüz |
| http://localhost:3007 | API (Swagger: `/swagger`) |

Durdurmak için: `docker compose down`

### 4. Yerel geliştirme

API (`enjoapi/enjoapi`):

```powershell
dotnet run --launch-profile http
```

Arayüz (`enjoapifront`):

```powershell
npm install
npm run dev
```

Arayüz **3006**, API **3007** dinler. Vite, tarayıcıdaki `/api` isteklerini 3007’ye yönlendirir.

## API özeti

- `POST /api/giris/giris` — giriş
- `GET|POST|PUT|DELETE /api/giris/kullanici` — kullanıcı yönetimi
- `POST /api/hesaplama/enjeksiyon` (ve diğer aşamalar) — maliyet hesabı
- `GET|POST|PUT|DELETE /api/hesaplama/satis-kayitlari` — proje/satış kayıtları
- `GET|PUT /api/admin/*-varsayilan-degerler` — makine ve birim fiyat varsayılanları
