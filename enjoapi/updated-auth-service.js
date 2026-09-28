// Güncellenmiş Authentication Service - Yeni API yapısı
class UpdatedAuthService {
  constructor() {
    this.baseURL = 'http://localhost:5110/api';
    this.currentUser = null;
  }

  // Giriş yapma
  async login(kullaniciAdi, sifre) {
    try {
      console.log('🔐 Giriş yapılıyor:', kullaniciAdi);
      
      const response = await fetch(`${this.baseURL}/giris/giris`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ kullaniciAdi, sifre })
      });

      const data = await response.json();
      console.log('📡 Giriş response:', data);
      
      if (response.ok) {
        this.currentUser = {
          id: data.id,
          kullaniciAdi: kullaniciAdi,
          rol: data.rol
        };
        localStorage.setItem('kullaniciAdi', kullaniciAdi);
        localStorage.setItem('rol', data.rol);
        localStorage.setItem('userId', data.id);
        console.log('✅ Giriş başarılı:', this.currentUser);
        return this.currentUser;
      } else {
        throw new Error(data.mesaj || 'Giriş başarısız');
      }
    } catch (error) {
      console.error('❌ Giriş hatası:', error);
      throw error;
    }
  }

  // Çıkış yapma
  logout() {
    console.log('🚪 Çıkış yapılıyor');
    this.currentUser = null;
    localStorage.clear();
  }

  // Kontroller
  isAuthenticated() {
    const isAuth = !!localStorage.getItem('kullaniciAdi');
    console.log('🔍 Giriş kontrolü:', isAuth);
    return isAuth;
  }

  isAdmin() {
    const isAdmin = localStorage.getItem('rol') === 'admin';
    console.log('👑 Admin kontrolü:', isAdmin);
    return isAdmin;
  }

  isUser() {
    const rol = localStorage.getItem('rol');
    const isUser = rol === 'user' || rol === 'admin';
    console.log('👤 User kontrolü:', isUser);
    return isUser;
  }

  getCurrentUser() {
    return {
      id: localStorage.getItem('userId'),
      kullaniciAdi: localStorage.getItem('kullaniciAdi'),
      rol: localStorage.getItem('rol')
    };
  }
}

// Kullanıcı servisi
class UpdatedUserService {
  constructor(authService) {
    this.baseURL = 'http://localhost:5110/api';
    this.authService = authService;
  }

  // Kullanıcıları listele
  async getUsers() {
    console.log('👥 Kullanıcılar yükleniyor...');
    
    const response = await fetch(`${this.baseURL}/giris/kullanici`);
    console.log('📡 Kullanıcılar response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Kullanıcılar yüklenemedi:', errorData);
      throw new Error(errorData.mesaj || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Kullanıcılar yüklendi:', data);
    return data;
  }

  // Yeni kullanıcı oluştur
  async createUser(kullaniciAdi, sifre, rol = 'user') {
    console.log('➕ Yeni kullanıcı oluşturuluyor:', kullaniciAdi, rol);

    const userData = {
      kullaniciAdi,
      sifre,
      rol
    };

    const response = await fetch(`${this.baseURL}/giris/kullanici`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Kullanıcı oluşturulamadı:', error);
      throw new Error(error.mesaj || 'Kullanıcı oluşturulamadı');
    }

    const data = await response.json();
    console.log('✅ Kullanıcı oluşturuldu:', data);
    return data;
  }

  // Kullanıcı güncelle
  async updateUser(id, kullaniciAdi, sifre, rol) {
    console.log('✏️ Kullanıcı güncelleniyor:', id, kullaniciAdi, rol);

    const userData = {
      id: parseInt(id),
      kullaniciAdi,
      sifre,
      rol
    };

    const response = await fetch(`${this.baseURL}/giris/kullanici/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Kullanıcı güncellenemedi:', error);
      throw new Error(error.mesaj || 'Kullanıcı güncellenemedi');
    }

    const data = await response.json();
    console.log('✅ Kullanıcı güncellendi:', data);
    return data;
  }

  // Kullanıcı sil
  async deleteUser(id) {
    console.log('🗑️ Kullanıcı siliniyor:', id);

    const response = await fetch(`${this.baseURL}/giris/kullanici/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Kullanıcı silinemedi:', error);
      throw new Error(error.mesaj || 'Kullanıcı silinemedi');
    }

    const data = await response.json();
    console.log('✅ Kullanıcı silindi:', data);
    return data;
  }
}

// Hesaplama servisi
class UpdatedHesaplamaService {
  constructor(authService) {
    this.baseURL = 'http://localhost:5110/api';
    this.authService = authService;
  }

  // Son maliyetleri getir
  async getSonMaliyetler(hesaplamaTurleri = null) {
    if (!this.authService.isUser()) {
      throw new Error('Giriş yapmanız gerekiyor');
    }

    let url = '/hesaplama/son-maliyetler';
    if (hesaplamaTurleri) {
      url += `?hesaplamaTurleri=${hesaplamaTurleri.join(',')}`;
    }

    console.log('💰 Maliyetler yükleniyor:', url);
    const response = await fetch(`${this.baseURL}${url}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Maliyetler yüklendi:', data);
    return data;
  }

  // Enjeksiyon hesaplama
  async enjeksiyonHesapla(data) {
    if (!this.authService.isUser()) {
      throw new Error('Giriş yapmanız gerekiyor');
    }

    const response = await fetch(`${this.baseURL}/hesaplama/enjeksiyon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Diğer hesaplama metodları...
  async yikamaHesapla(data) {
    if (!this.authService.isUser()) {
      throw new Error('Giriş yapmanız gerekiyor');
    }

    const response = await fetch(`${this.baseURL}/hesaplama/yikama`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}

// Servisleri oluştur ve export et
const authService = new UpdatedAuthService();
const userService = new UpdatedUserService(authService);
const hesaplamaService = new UpdatedHesaplamaService(authService);

export { authService, userService, hesaplamaService };
export default authService;
