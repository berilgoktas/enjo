// Frontend Authentication Service - Sadece Admin ve User Girişi

class AuthService {
  constructor() {
    this.baseURL = 'https://your-api-url.com/api';
    this.token = localStorage.getItem('token');
  }

  // Giriş yapma - Sadece Admin ve User
  async login(kullaniciAdi, sifre) {
    try {
      const response = await fetch(`${this.baseURL}/giris/giris`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kullaniciAdi, sifre })
      });

      const data = await response.json();

      if (response.ok) {
        // Sadece Admin ve User giriş yapabilir
        if (data.rol === 'Admin' || data.rol === 'User') {
          this.token = data.token;
          localStorage.setItem('token', data.token);
          localStorage.setItem('kullaniciAdi', data.kullaniciAdi);
          localStorage.setItem('rol', data.rol);
          return data;
        } else {
          throw new Error('Bu kullanıcı giriş yapamaz. Sadece Admin ve User rolleri giriş yapabilir.');
        }
      } else {
        throw new Error(data.mesaj || 'Giriş başarısız');
      }
    } catch (error) {
      throw error;
    }
  }

  // Çıkış yapma
  logout() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('kullaniciAdi');
    localStorage.removeItem('rol');
  }

  // Token kontrolü
  isAuthenticated() {
    return !!this.token;
  }

  // Admin kontrolü
  isAdmin() {
    return localStorage.getItem('rol') === 'Admin';
  }

  // Kullanıcı kontrolü (User veya Admin)
  isUser() {
    const rol = localStorage.getItem('rol');
    return rol === 'User' || rol === 'Admin';
  }

  // API istekleri için header
  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  // Korumalı API isteği
  async apiRequest(url, options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error('Giriş yapmanız gerekiyor');
    }

    const response = await fetch(`${this.baseURL}${url}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers
      }
    });

    if (response.status === 401) {
      this.logout();
      window.location.href = '/login';
      throw new Error('Oturum süresi doldu');
    }

    return response;
  }
}

// Kullanıcı Yönetimi Service (Sadece Admin)
class UserService {
  constructor(authService) {
    this.baseURL = 'https://your-api-url.com/api';
    this.authService = authService;
  }

  // Tüm kullanıcıları listele
  async getUsers() {
    if (!this.authService.isAdmin()) {
      throw new Error('Bu işlem için Admin yetkisi gerekiyor');
    }

    const response = await this.authService.apiRequest('/giris/kullanici');
    return response.json();
  }

  // Yeni kullanıcı oluştur - Sadece Admin ve User rolleri
  async createUser(kullaniciAdi, sifre, rol = 'User') {
    if (!this.authService.isAdmin()) {
      throw new Error('Bu işlem için Admin yetkisi gerekiyor');
    }

    // Sadece Admin ve User rolleri kabul et
    if (rol !== 'Admin' && rol !== 'User') {
      throw new Error('Sadece Admin ve User rolleri kabul edilir');
    }

    const response = await this.authService.apiRequest('/giris/kullanici', {
      method: 'POST',
      body: JSON.stringify({ kullaniciAdi, sifre, rol })
    });
    return response.json();
  }

  // Kullanıcı güncelle - Sadece Admin ve User rolleri
  async updateUser(id, kullaniciAdi, sifre, rol) {
    if (!this.authService.isAdmin()) {
      throw new Error('Bu işlem için Admin yetkisi gerekiyor');
    }

    // Sadece Admin ve User rolleri kabul et
    if (rol !== 'Admin' && rol !== 'User') {
      throw new Error('Sadece Admin ve User rolleri kabul edilir');
    }

    const response = await this.authService.apiRequest(`/giris/kullanici/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ kullaniciAdi, sifre, rol })
    });
    return response.json();
  }

  // Kullanıcı sil
  async deleteUser(id) {
    if (!this.authService.isAdmin()) {
      throw new Error('Bu işlem için Admin yetkisi gerekiyor');
    }

    const response = await this.authService.apiRequest(`/giris/kullanici/${id}`, {
      method: 'DELETE'
    });
    return response.ok;
  }
}

// Hesaplama Service (User veya Admin)
class HesaplamaService {
  constructor(authService) {
    this.baseURL = 'https://your-api-url.com/api';
    this.authService = authService;
  }

  // Son maliyetleri getir
  async getSonMaliyetler(hesaplamaTurleri = null) {
    let url = '/hesaplama/son-maliyetler';
    if (hesaplamaTurleri) {
      url += `?hesaplamaTurleri=${hesaplamaTurleri.join(',')}`;
    }

    const response = await this.authService.apiRequest(url);
    return response.json();
  }

  // Enjeksiyon hesaplama
  async enjeksiyonHesapla(data) {
    const response = await this.authService.apiRequest('/hesaplama/enjeksiyon', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Yıkama hesaplama
  async yikamaHesapla(data) {
    const response = await this.authService.apiRequest('/hesaplama/yikama', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Santrifüj hesaplama
  async santrifujHesapla(data) {
    const response = await this.authService.apiRequest('/hesaplama/santrifuj', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Postürleme hesaplama
  async posturlemeHesapla(data) {
    const response = await this.authService.apiRequest('/hesaplama/posturleme', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Azotlu çapak alma hesaplama
  async azotluCapakAlmaHesapla(data) {
    const response = await this.authService.apiRequest('/hesaplama/azotlucapakalma', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Satış kaydı oluştur
  async satisKaydiOlustur(data) {
    const response = await this.authService.apiRequest('/hesaplama/satis-kayitlari', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Satış kayıtları listele
  async satisKayitlariListele() {
    const response = await this.authService.apiRequest('/hesaplama/satis-kayitlari');
    return response.json();
  }

  // Satış kaydı güncelle
  async satisKaydiGuncelle(id, data) {
    const response = await this.authService.apiRequest(`/hesaplama/satis-kayitlari/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Satış kaydı sil
  async satisKaydiSil(id) {
    const response = await this.authService.apiRequest(`/hesaplama/satis-kayitlari/${id}`, {
      method: 'DELETE'
    });
    return response.ok;
  }
}

// Servisleri export et
const authService = new AuthService();
const userService = new UserService(authService);
const hesaplamaService = new HesaplamaService(authService);

export { authService, userService, hesaplamaService };
export default authService;
