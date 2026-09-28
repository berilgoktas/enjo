# ENJO API Frontend

## 📋 Proje Hakkında

ENJO API Frontend, üretim maliyet hesaplamaları için geliştirilmiş modern bir React uygulamasıdır. Enjeksiyon, azotlu çapak alma, postürleme, santrifüj ve yıkama gibi farklı üretim aşamalarının maliyetlerini hesaplar ve sonuçları kaydeder.

## ✨ Özellikler

- 🔐 **Kullanıcı Yönetimi**: Admin ve satış kullanıcı rolleri
- 📊 **Proje Yönetimi**: Proje oluşturma, güncelleme ve listeleme
- 🏭 **Üretim Hesaplamaları**: 5 farklı üretim aşaması için maliyet hesaplama
- 💰 **Satış Modülü**: Satış işlemleri ve takibi
- 🌍 **Euro Kuru**: Güncel Euro kuru gösterimi
- 📱 **Responsive Tasarım**: Mobil ve masaüstü uyumlu

## 🛠️ Teknoloji Stack

- **Frontend**: React 19.1.1 + Vite 7.1.2
- **Routing**: React Router DOM 7.8.2
- **State Management**: React Context API
- **Styling**: CSS3 (Modern CSS Grid/Flexbox)
- **HTTP Client**: Fetch API
- **Backend API**: .NET Core (Port 5110)
- **Linting**: ESLint 9.33.0

## 📁 Proje Yapısı

```
src/
├── components/           # Yeniden kullanılabilir bileşenler
│   ├── EuroRateBadge.jsx    # Euro kuru gösterimi
│   ├── Header.jsx           # Üst başlık
│   ├── Modal.jsx            # Modal bileşeni
│   ├── Sidebar.jsx          # Yan menü
│   └── StepNav.jsx          # Adım navigasyonu
├── context/             # Global state yönetimi
│   ├── ProjeContext.jsx     # Proje durumu
│   └── UretimContext.jsx    # Üretim durumu
├── pages/               # Sayfa bileşenleri
│   ├── Login.jsx            # Giriş sayfası
│   ├── KullaniciYonetimi.jsx # Kullanıcı yönetimi
│   ├── Projeler.jsx         # Proje listesi
│   ├── ProjeGuncelle.jsx    # Proje güncelleme
│   ├── Satis.jsx            # Satış modülü
│   └── Uretim/              # Üretim modülü
│       ├── Index.jsx
│       ├── AsamaSecim.jsx
│       └── Hesaplamalar/
│           ├── Enjeksiyon.jsx
│           ├── AzotluCapakAlma.jsx
│           ├── Posturleme.jsx
│           ├── Santrifuj.jsx
│           ├── Yikama.jsx
│           └── Sonuclar.jsx
├── assets/              # Statik dosyalar
├── App.jsx              # Ana uygulama
├── main.jsx             # Giriş noktası
├── index.css            # Global stiller
└── simple-auth-service.js # Kimlik doğrulama servisi
```

## 🚀 Kurulum

### Gereksinimler
- Node.js (v16 veya üzeri)
- npm veya yarn

### Adımlar

1. **Projeyi klonlayın**
   ```bash
   git clone [repository-url]
   cd enjoapifront
   ```

2. **Bağımlılıkları yükleyin**
   ```bash
   npm install
   ```

3. **Geliştirme sunucusunu başlatın**
   ```bash
   npm run dev
   ```

4. **Tarayıcıda açın**
   ```
   http://localhost:5173
   ```

## 📜 Kullanılabilir Komutlar

```bash
# Geliştirme sunucusunu başlat
npm run dev

# Production build oluştur
npm run build

# ESLint ile kod kontrolü
npm run lint

# Build önizlemesi
npm run preview
```

## 🔧 Yapılandırma

### Backend API Bağlantısı
Uygulama varsayılan olarak `http://localhost:5110` adresindeki .NET Core API'sine bağlanır. API URL'ini değiştirmek için `simple-auth-service.js` dosyasındaki `API_BASE_URL` değişkenini güncelleyin.

### Kullanıcı Rolleri
- **Admin**: Tüm modüllere erişim
- **Satış**: Sadece satış modülüne erişim

## 📱 Kullanım

### Giriş
1. Uygulamayı açın
2. Kullanıcı adı ve şifre ile giriş yapın
3. Rolünüze göre uygun modüllere yönlendirileceksiniz

### Proje Yönetimi (Admin)
1. **Projeler** menüsünden yeni proje oluşturun
2. Mevcut projeleri görüntüleyin ve düzenleyin
3. Proje detaylarını güncelleyin

### Üretim Hesaplamaları (Admin)
1. **Üretim** menüsüne gidin
2. Hesaplama yapılacak aşamayı seçin
3. Gerekli parametreleri girin
4. Hesaplama sonuçlarını görüntüleyin ve kaydedin

### Satış İşlemleri
1. **Satış** menüsüne gidin
2. Satış işlemlerini yönetin
3. Proje ve müşteri bilgilerini takip edin

## 🔒 Güvenlik

- JWT tabanlı kimlik doğrulama
- Rol tabanlı erişim kontrolü
- LocalStorage'da güvenli token saklama
- API isteklerinde otomatik token ekleme

## 🎨 Tasarım

- Modern ve kullanıcı dostu arayüz
- Responsive tasarım (mobil uyumlu)
- CSS Grid ve Flexbox kullanımı
- Tutarlı renk paleti ve tipografi

## 🐛 Hata Ayıklama

### Yaygın Sorunlar

1. **API Bağlantı Hatası**
   - Backend sunucusunun çalıştığından emin olun
   - API URL'ini kontrol edin

2. **Kimlik Doğrulama Hatası**
   - Token'ın geçerli olduğundan emin olun
   - LocalStorage'ı temizleyin

3. **Build Hatası**
   - Node.js sürümünü kontrol edin
   - `node_modules` klasörünü silin ve `npm install` çalıştırın

## 📈 Performans

- Vite ile hızlı geliştirme
- Code splitting ile optimize edilmiş bundle
- Lazy loading ile sayfa yükleme optimizasyonu
- Modern CSS ile hızlı render

## 🤝 Katkıda Bulunma

1. Projeyi fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje özel kullanım için geliştirilmiştir.

## 📞 İletişim

Proje hakkında sorularınız için lütfen iletişime geçin.

---

**Not**: Bu uygulama üretim ortamında kullanılmadan önce güvenlik testlerinden geçirilmelidir.