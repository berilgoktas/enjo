// Basit Authentication Service - JWT'siz
class SimpleAuthService {
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
        this.currentUser = data;
        localStorage.setItem('kullaniciAdi', data.kullaniciAdi);
        localStorage.setItem('rol', data.rol);
        localStorage.setItem('userId', data.userId);
        console.log('✅ Giriş başarılı:', data);
        return data;
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
    const isAdmin = localStorage.getItem('rol') === 'Admin';
    console.log('👑 Admin kontrolü:', isAdmin);
    return isAdmin;
  }

  isUser() {
    const rol = localStorage.getItem('rol');
    const isUser = rol === 'User' || rol === 'Admin';
    console.log('👤 User kontrolü:', isUser);
    return isUser;
  }

  getCurrentUser() {
    return {
      kullaniciAdi: localStorage.getItem('kullaniciAdi'),
      rol: localStorage.getItem('rol'),
      userId: localStorage.getItem('userId')
    };
  }
}

// Kullanıcı servisi
class SimpleUserService {
  constructor(authService) {
    this.baseURL = 'http://localhost:5110/api';
    this.authService = authService;
  }

  // Kullanıcıları listele
  async getUsers() {
    if (!this.authService.isAdmin()) {
      throw new Error('Admin yetkisi gerekiyor');
    }

    const rol = localStorage.getItem('rol');
    console.log('👥 Kullanıcılar yükleniyor, rol:', rol);
    
    const response = await fetch(`${this.baseURL}/giris/kullanici?rol=${rol}`);
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
  async createUser(kullaniciAdi, sifre, rol = 'User') {
    if (!this.authService.isAdmin()) {
      throw new Error('Admin yetkisi gerekiyor');
    }

    console.log('➕ Yeni kullanıcı oluşturuluyor:', kullaniciAdi, rol);

    const currentRol = localStorage.getItem('rol');
    const response = await fetch(`${this.baseURL}/giris/kullanici?rol=${currentRol}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kullaniciAdi, sifre, rol })
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
    if (!this.authService.isAdmin()) {
      throw new Error('Admin yetkisi gerekiyor');
    }

    console.log('✏️ Kullanıcı güncelleniyor:', id, kullaniciAdi, rol);

    const response = await fetch(`${this.baseURL}/giris/kullanici/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: parseInt(id), 
        kullaniciAdi, 
        sifre, 
        rol 
      })
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
    if (!this.authService.isAdmin()) {
      throw new Error('Admin yetkisi gerekiyor');
    }

    console.log('🗑️ Kullanıcı siliniyor:', id);

    const currentRol = localStorage.getItem('rol');
    const response = await fetch(`${this.baseURL}/giris/kullanici/${id}?rol=${currentRol}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Kullanıcı silinemedi:', error);
      throw new Error(error.mesaj || 'Kullanıcı silinemedi');
    }

    console.log('✅ Kullanıcı silindi');
    return response.ok;
  }
}

// Hesaplama servisi
class SimpleHesaplamaService {
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
const authService = new SimpleAuthService();
const userService = new SimpleUserService(authService);
const hesaplamaService = new SimpleHesaplamaService(authService);

export { authService, userService, hesaplamaService };
export default authService;
