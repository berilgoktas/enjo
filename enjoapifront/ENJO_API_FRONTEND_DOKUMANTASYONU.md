# ENJO API Frontend Dokümantasyonu

## Proje Genel Bakış

Bu proje, üretim maliyet hesaplamaları için geliştirilmiş bir React tabanlı frontend uygulamasıdır. Enjeksiyon, azotlu çapak alma, postürleme, santrifüj ve yıkama gibi farklı üretim aşamalarının maliyetlerini hesaplar ve sonuçları kaydeder.

## Teknoloji Stack

- **Frontend**: React 18 + Vite
- **Routing**: React Router DOM
- **State Management**: React Context API
- **Styling**: CSS3 (Modern CSS Grid/Flexbox)
- **HTTP Client**: Fetch API
- **Backend API**: .NET Core (Port 5110)

## Proje Yapısı

```
src/
├── components/           # Yeniden kullanılabilir bileşenler
│   ├── EuroRateBadge.jsx
│   ├── Header.jsx
│   ├── Sidebar.jsx
│   └── StepNav.jsx
├── context/             # Global state yönetimi
│   ├── ProjeContext.jsx
│   └── UretimContext.jsx
├── pages/               # Sayfa bileşenleri
│   ├── Dashboard.jsx
│   ├── ProjeGuncelle.jsx
│   ├── Projeler.jsx
│   ├── Satis.jsx
│   └── Uretim/
│       ├── AsamaSecim.jsx
│       └── Hesaplamalar/
│           ├── AzotluCapakAlma.jsx
│           ├── Enjeksiyon.jsx
│           ├── Posturleme.jsx
│           ├── Santrifuj.jsx
│           ├── Sonuclar.jsx
│           └── Yikama.jsx
├── assets/              # Statik dosyalar
├── App.jsx
├── main.jsx
└── index.css
```

## API Endpoints

### 1. Enjeksiyon Hesaplama API

**Endpoint**: `POST /api/hesaplama/enjeksiyon`

**Amaç**: Enjeksiyon maliyetini hesaplar

**Request Body**:
```json
{
  "baskiToplamBrut": 45,
  "kalipGozSayisi": 24,
  "hammaddeFiyatiEuro": 33,
  "baskiCevrimSuresi": 147,
  "isciKatsayisi": 1,
  "isciSayisi": 1,
  "kalipKontrolu": "yok",
  "euroKuru": 48.9794,
  "operatorUcreti": 30000,
  "elektrikUcreti": 4.7,
  "kwDegeri": 37,
  "faydaliOmurYil": 30,
  "makineBedeliEuro": 74000,
  "yillikBakimMaliyeti": 700,
  "kalipBakimUcreti": 50
}
```

**Response**:
```json
{
  "id": 157,
  "toplamMaliyet": 46.02863690769992
}
```

**Kullanım Yeri**: `src/pages/Uretim/Hesaplamalar/Enjeksiyon.jsx`

### 2. Son Maliyetler API

**Endpoint**: `GET /api/hesaplama/son-maliyetler`

**Amaç**: Tüm aşamaların detay maliyetlerini getirir

**Response**:
```json
{
  "sonMaliyetler": [
    {
      "hesaplamaTuru": "Enjeksiyon",
      "malzemeMaliyeti": 0.014747,
      "iscilikMaliyeti": 0.003911,
      "elektrikMaliyeti": 0.006376,
      "amortismanMaliyeti": 0.001967,
      "makineBakimMaliyeti": 0.000558,
      "kalipMaliyeti": 0.00004,
      "toplamMaliyet": 0.027598
    }
  ],
  "genelToplamlar": {
    "malzemeMaliyeti": 0.028657,
    "iscilikMaliyeti": 0.076601,
    "elektrikMaliyeti": 0.015606,
    "amortismanMaliyeti": 0.009806,
    "makineBakimMaliyeti": 0.0024,
    "kalipMaliyeti": 0.011846,
    "toplamMaliyet": 0.144914
  }
}
```

**Kullanım Yeri**: `src/pages/Uretim/Hesaplamalar/Sonuclar.jsx`

### 3. Satış Kayıtları API

**Endpoint**: `POST /api/hesaplama/satis-kayitlari`

**Amaç**: Hesaplama sonuçlarını kaydeder

**Request Body**:
```json
{
  "ad": "Proje Adı",
  "tarih": "2025-09-18T14:45:00.000Z",
  "toplamMaliyet": 0.027598,
  "degerler": {
    "malzemeMaliyeti": 0.014747,
    "iscilikMaliyeti": 0.003911,
    "elektrikMaliyeti": 0.006376,
    "amortismanMaliyeti": 0.001967,
    "makineBakimMaliyeti": 0.000558,
    "kalipBakimMaliyeti": 0.0005,
    "kalipMaliyeti": 0.00004,
    "toplamMaliyet": 0.027598
  },
  "enjeksiyonId": 157,
  "azotluCapakAlmaId": null,
  "posturlemeId": null,
  "santrifujId": null,
  "yikamaId": null,
  "formlar": {
    "enjeksiyon": {
      "baskiToplamBrut": 45,
      "kalipGozSayisi": 24,
      "hammaddeFiyatiEuro": 33,
      "baskiCevrimSuresi": 147,
      "isciKatsayisi": 1,
      "isciSinifiKey": "operator",
      "isciSayisi": 1,
      "kalipKontrolu": "yok"
    }
  },
  "selectedSteps": ["enjeksiyon", "sonuclar"],
  "allResults": { /* hesaplama sonuçları */ },
  "shared": { /* paylaşılan değerler */ }
}
```

**Response**:
```json
{
  "id": 64,
  "ad": "Proje Adı"
}
```

**Kullanım Yeri**: `src/pages/Uretim/Hesaplamalar/Sonuclar.jsx`

### 4. Admin Varsayılan Değerler API

**Endpoint**: `GET /api/admin/enjeksiyon-varsayilan-degerler`

**Amaç**: Enjeksiyon hesaplaması için varsayılan admin değerlerini getirir

**Response**:
```json
{
  "euroKuru": 48.9794,
  "operatorUcreti": 30000,
  "elektrikUcreti": 4.7,
  "kwDegeri": 37,
  "faydaliOmurYil": 30,
  "makineBedeliEuro": 74000,
  "yillikBakimMaliyeti": 700,
  "kalipBakimUcreti": 50
}
```

**Kullanım Yeri**: `src/pages/Uretim/Hesaplamalar/Enjeksiyon.jsx`

## State Management (Context)

### UretimContext

**Dosya**: `src/context/UretimContext.jsx`

**Amaç**: Üretim hesaplamaları için global state yönetimi

**Ana State'ler**:
- `selectedSteps`: Seçili aşamalar
- `shared`: Paylaşılan değerler
- `forms`: Form verileri
- `results`: Hesaplama sonuçları

**Ana Fonksiyonlar**:
- `getForm(name)`: Form verilerini getir
- `updateForm(name, data)`: Form verilerini güncelle
- `getResult(name)`: Hesaplama sonucunu getir
- `updateResult(name, data)`: Hesaplama sonucunu güncelle
- `clearAllData()`: Tüm verileri temizle

### ProjeContext

**Dosya**: `src/context/ProjeContext.jsx`

**Amaç**: Proje yönetimi için global state

## Hesaplama Mantığı

### Enjeksiyon Hesaplama Formülleri

**Dosya**: `src/pages/Uretim/Hesaplamalar/Enjeksiyon.jsx`

**Detay Maliyet Hesaplama Fonksiyonu**:
```javascript
function calculateDetailedCosts(payload, toplamMaliyet) {
  // Saatlik üretim hesapla
  const saatlikUretim = (3600 / baskiCevrimSuresi) * kalipGozSayisi
  
  // Malzeme maliyeti
  const malzemeMaliyeti = (baskiToplamBrut * hammaddeFiyatiEuro) / 1000
  
  // İşçilik maliyeti
  const saatlikUcret = operatorUcreti / 176 // 22 gün * 8 saat
  const iscilikMaliyeti = (saatlikUcret * isciKatsayisi * isciSayisi) / saatlikUretim
  
  // Elektrik maliyeti
  const elektrikMaliyeti = (kwDegeri * elektrikUcreti) / saatlikUretim
  
  // Amortisman maliyeti
  const amortismanMaliyeti = (makineBedeliEuro * euroKuru) / (faydaliOmurYil * 8760 * saatlikUretim)
  
  // Makine bakım maliyeti
  const makineBakimMaliyeti = (yillikBakimMaliyeti * euroKuru) / (8760 * saatlikUretim)
  
  // Kalıp bakım maliyeti
  const kalipBakimMaliyeti = (kalipBakimUcreti * euroKuru) / (8760 * saatlikUretim)
}
```

## Routing Yapısı

### Ana Route'lar

- `/` - Dashboard
- `/projeler` - Projeler listesi
- `/proje-guncelle/:id` - Proje güncelleme
- `/satis` - Satış kayıtları
- `/uretim/asama-secim` - Aşama seçimi
- `/uretim/hesaplamalar/enjeksiyon` - Enjeksiyon hesaplama
- `/uretim/hesaplamalar/azotlu-capak-alma` - Azotlu çapak alma
- `/uretim/hesaplamalar/posturleme` - Postürleme
- `/uretim/hesaplamalar/santrifuj` - Santrifüj
- `/uretim/hesaplamalar/yikama` - Yıkama
- `/uretim/hesaplamalar/sonuclar` - Sonuçlar

### Step Navigation

**Dosya**: `src/components/StepNav.jsx`

**Amaç**: Hesaplama adımları arasında gezinme

**Adımlar**:
1. Aşama Seçimi
2. Seçilen Hesaplamalar (Enjeksiyon, Azotlu, vb.)
3. Sonuçlar

## Styling ve UI

### CSS Sınıfları

**Ana Container'lar**:
- `.calculation-container` - Ana hesaplama container'ı
- `.calculation-header` - Sayfa başlığı
- `.calculation-form-container` - Form container'ı
- `.form-section` - Form bölümü
- `.result-section` - Sonuç bölümü

**Form Elementleri**:
- `.form-field` - Form alanı
- `.form-label` - Form etiketi
- `.form-input` - Form input'u
- `.form-grid` - Form grid layout'u

**Sonuç Elementleri**:
- `.result-card` - Sonuç kartı
- `.result-header` - Sonuç başlığı
- `.result-body` - Sonuç içeriği
- `.result-value-large` - Büyük değer gösterimi

**Butonlar**:
- `.action-btn` - Aksiyon butonu
- `.action-btn.primary` - Ana buton
- `.action-btn.secondary` - İkincil buton

## Performans Optimizasyonları

### 1. Hesaplama Optimizasyonları

- **Hızlı çıkış koşulları**: Gereksiz hesaplamalar önlendi
- **Sabit değerler**: Matematiksel sabitler önceden hesaplandı
- **Koşullu kontroller**: Sıfır değerler için erken dönüş

### 2. State Optimizasyonları

- **useMemo**: Hesaplama sonuçları memoize edildi
- **useCallback**: Event handler'lar optimize edildi
- **Context splitting**: State'ler ayrı context'lerde

### 3. API Optimizasyonları

- **Error handling**: API hataları düzgün handle edildi
- **Loading states**: Kullanıcı deneyimi için loading göstergeleri
- **Retry logic**: Başarısız istekler için retry mekanizması

## Hata Yönetimi

### 1. API Hataları

```javascript
try {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`API hatası: ${response.status}`)
  }
  const data = await response.json()
} catch (error) {
  console.error('API Hatası:', error)
  setError(error.message)
}
```

### 2. Form Validasyonu

```javascript
// Gerekli alanlar kontrolü
const missing = []
for (const key of requiredKeys) {
  if (!form[key] || form[key] === '') {
    missing.push(key)
  }
}
if (missing.length > 0) {
  throw new Error('Eksik alanlar: ' + missing.join(', '))
}
```

### 3. Hesaplama Hataları

```javascript
// Sıfır değer kontrolü
if (maliyet === 0 || isNaN(maliyet)) {
  throw new Error('Hesaplama sonucu 0 geldi. Lütfen tüm alanları doldurun.')
}
```

## Geliştirme Kuralları

### 1. Kod Organizasyonu

- **Component'ler**: Her sayfa ayrı component
- **Context'ler**: Global state için ayrı dosyalar
- **Utility fonksiyonlar**: Ortak kullanılan fonksiyonlar ayrı dosyalarda
- **Constants**: Sabit değerler dosya başında tanımlanır

### 2. Naming Conventions

- **Component'ler**: PascalCase (örn: `Enjeksiyon.jsx`)
- **Fonksiyonlar**: camelCase (örn: `handleSubmit`)
- **Değişkenler**: camelCase (örn: `totalCost`)
- **CSS sınıfları**: kebab-case (örn: `form-input`)

### 3. State Management

- **Local state**: Component içinde `useState`
- **Global state**: Context API ile
- **Form state**: Context'te `forms` objesi
- **Result state**: Context'te `results` objesi

### 4. API Kullanımı

- **Base URL**: `http://localhost:5110`
- **Headers**: `Content-Type: application/json`
- **Error handling**: Try-catch ile
- **Loading states**: Kullanıcı bilgilendirmesi

## Test Senaryoları

### 1. Enjeksiyon Hesaplama Testi

1. Enjeksiyon sayfasına git
2. Formu doldur:
   - Baskı Toplam Brüt: 45
   - Kalıp Göz Sayısı: 24
   - Hammadde Fiyatı: 33
   - Baskı Çevrim Süresi: 147
   - İşçi Sınıfı: Operatör
   - İşçi Sayısı: 1
   - Kalıp Kontrolü: Yok
3. "Hesapla" butonuna bas
4. Sonuç gözüktü mü? (€0,0750 gibi)
5. Sonuçlar sayfasına git
6. Detay maliyetler dolu mu?

### 2. Kaydetme Testi

1. Hesaplama yap
2. Sonuçlar sayfasına git
3. "Kaydet" butonuna bas
4. Kayıt adı gir
5. "Kaydet" butonuna bas
6. "Kayıt başarıyla oluşturuldu!" mesajı geldi mi?
7. Satış sayfasına git
8. Yeni kayıt gözüküyor mu?
9. Değerler doğru mu?

### 3. Performans Testi

1. Console'u aç (F12)
2. Hesaplama yap
3. "Violation" mesajları var mı?
4. Click handler süreleri 100ms altında mı?

## Sorun Giderme

### 1. Hesaplamalar 0,0000 Gözüküyor

**Neden**: API'den detay maliyetler gelmiyor
**Çözüm**: Frontend'de `calculateDetailedCosts` fonksiyonu kullanılıyor

### 2. Kayıtlar Kaydedilmiyor

**Neden**: Backend'e yanlış format gönderiliyor
**Çözüm**: `degerler` objesi olarak gönderiliyor

### 3. Performans Sorunları

**Neden**: Ağır hesaplamalar veya debug logları
**Çözüm**: Optimizasyonlar yapıldı, debug logları kaldırıldı

### 4. API Bağlantı Sorunları

**Neden**: Backend çalışmıyor veya yanlış port
**Çözüm**: Backend'in 5110 portunda çalıştığından emin ol

## Geliştirme Notları

### 1. Yapılan İyileştirmeler

- **Detay maliyet hesaplama**: API'den gelmeyen detay maliyetler frontend'de hesaplanıyor
- **Performans optimizasyonu**: Hesaplama fonksiyonları optimize edildi
- **Error handling**: API hataları düzgün handle ediliyor
- **State management**: Context API ile global state yönetimi

### 2. Gelecek Geliştirmeler

- **Unit testler**: Jest ile test coverage
- **E2E testler**: Cypress ile end-to-end testler
- **TypeScript**: Type safety için TypeScript geçişi
- **PWA**: Progressive Web App özellikleri
- **Offline support**: Çevrimdışı çalışma desteği

### 3. Bilinen Sorunlar

- **Backend dependency**: Frontend backend'e bağımlı
- **Error messages**: Hata mesajları Türkçe/İngilizce karışık
- **Mobile responsiveness**: Mobil uyumluluk iyileştirilebilir

## Sonuç

Bu dokümantasyon, ENJO API Frontend projesinin tüm teknik detaylarını, API endpoint'lerini, state management yapısını ve geliştirme kurallarını kapsamaktadır. Proje, modern React best practice'leri kullanılarak geliştirilmiş, performans optimizasyonları yapılmış ve kullanıcı dostu bir arayüze sahiptir.

Herhangi bir sorun veya geliştirme ihtiyacı durumunda, bu dokümantasyon referans alınabilir.
