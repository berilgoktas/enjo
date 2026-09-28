# Frontend API Servisleri - JWT Authentication

## 🔐 Authentication Service

```javascript
class AuthService {
  constructor() {
    this.baseURL = 'https://your-api-url.com/api';
    this.token = localStorage.getItem('token');
  }

  // Giriş yapma
  async login(kullaniciAdi, sifre) {
    try {
      const response = await fetch(`${this.baseURL}/giris/giris`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kullaniciAdi, sifre })
      });

      if (response.ok) {
        const data = await response.json();
        this.token = data.token;
        localStorage.setItem('token', data.token);
        localStorage.setItem('kullaniciAdi', data.kullaniciAdi);
        localStorage.setItem('rol', data.rol);
        return data;
      } else {
        throw new Error('Giriş başarısız');
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

  // Kullanıcı kontrolü
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
}

export default new AuthService();
```

## 👥 Kullanıcı Yönetimi Service (Sadece Admin)

```javascript
class UserService {
  constructor(authService) {
    this.baseURL = 'https://your-api-url.com/api';
    this.authService = authService;
  }

  // Tüm kullanıcıları listele
  async getUsers() {
    const response = await fetch(`${this.baseURL}/giris/kullanici`, {
      headers: this.authService.getAuthHeaders()
    });
    return response.json();
  }

  // Yeni kullanıcı oluştur
  async createUser(kullaniciAdi, sifre, rol = 'User') {
    const response = await fetch(`${this.baseURL}/giris/kullanici`, {
      method: 'POST',
      headers: this.authService.getAuthHeaders(),
      body: JSON.stringify({ kullaniciAdi, sifre, rol })
    });
    return response.json();
  }

  // Kullanıcı güncelle
  async updateUser(id, kullaniciAdi, sifre, rol) {
    const response = await fetch(`${this.baseURL}/giris/kullanici/${id}`, {
      method: 'PUT',
      headers: this.authService.getAuthHeaders(),
      body: JSON.stringify({ kullaniciAdi, sifre, rol })
    });
    return response.json();
  }

  // Kullanıcı sil
  async deleteUser(id) {
    const response = await fetch(`${this.baseURL}/giris/kullanici/${id}`, {
      method: 'DELETE',
      headers: this.authService.getAuthHeaders()
    });
    return response.ok;
  }
}

export default new UserService(authService);
```

## 📊 Hesaplama Service (Korumalı)

```javascript
class HesaplamaService {
  constructor(authService) {
    this.baseURL = 'https://your-api-url.com/api';
    this.authService = authService;
  }

  // Son maliyetleri getir
  async getSonMaliyetler(hesaplamaTurleri = null) {
    let url = `${this.baseURL}/hesaplama/son-maliyetler`;
    if (hesaplamaTurleri) {
      url += `?hesaplamaTurleri=${hesaplamaTurleri.join(',')}`;
    }

    const response = await fetch(url, {
      headers: this.authService.getAuthHeaders()
    });
    return response.json();
  }

  // Enjeksiyon hesaplama
  async enjeksiyonHesapla(data) {
    const response = await fetch(`${this.baseURL}/hesaplama/enjeksiyon`, {
      method: 'POST',
      headers: this.authService.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Diğer hesaplama metodları...
}

export default new HesaplamaService(authService);
```

## 🛡️ Route Guard (React Router)

```javascript
import { Navigate } from 'react-router-dom';
import authService from './services/AuthService';

// Admin sadece
export const AdminRoute = ({ children }) => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  
  if (!authService.isAdmin()) {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
};

// Kullanıcı veya Admin
export const ProtectedRoute = ({ children }) => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  
  return children;
};
```

## 🎯 Kullanım Örnekleri

### Login Component
```jsx
import React, { useState } from 'react';
import authService from './services/AuthService';

const Login = () => {
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [sifre, setSifre] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const result = await authService.login(kullaniciAdi, sifre);
      console.log('Giriş başarılı:', result);
      // Ana sayfaya yönlendir
    } catch (error) {
      console.error('Giriş hatası:', error);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input 
        value={kullaniciAdi}
        onChange={(e) => setKullaniciAdi(e.target.value)}
        placeholder="Kullanıcı Adı"
      />
      <input 
        type="password"
        value={sifre}
        onChange={(e) => setSifre(e.target.value)}
        placeholder="Şifre"
      />
      <button type="submit">Giriş Yap</button>
    </form>
  );
};
```

### Kullanıcı Yönetimi (Sadece Admin)
```jsx
import React, { useState, useEffect } from 'react';
import userService from './services/UserService';
import { AdminRoute } from './guards/RouteGuard';

const UserManagement = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Kullanıcılar yüklenemedi:', error);
    }
  };

  return (
    <AdminRoute>
      <div>
        <h2>Kullanıcı Yönetimi</h2>
        {users.map(user => (
          <div key={user.id}>
            {user.kullaniciAdi} - {user.rol}
          </div>
        ))}
      </div>
    </AdminRoute>
  );
};
```

## 🔧 Axios Interceptor (Opsiyonel)

```javascript
import axios from 'axios';
import authService from './services/AuthService';

// Request interceptor - Token ekle
axios.interceptors.request.use(
  (config) => {
    if (authService.isAuthenticated()) {
      config.headers.Authorization = `Bearer ${authService.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - 401 durumunda logout
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authService.logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## 📝 API Endpoint'leri Özeti

### Public (Yetki Gerekmez)
- `POST /api/giris/giris` - Giriş yapma

### Admin Only
- `GET /api/giris/kullanici` - Kullanıcı listele
- `POST /api/giris/kullanici` - Kullanıcı oluştur
- `PUT /api/giris/kullanici/{id}` - Kullanıcı güncelle
- `DELETE /api/giris/kullanici/{id}` - Kullanıcı sil

### User or Admin
- `GET /api/hesaplama/son-maliyetler` - Son maliyetler
- `POST /api/hesaplama/enjeksiyon` - Enjeksiyon hesapla
- `POST /api/hesaplama/yikama` - Yıkama hesapla
- `POST /api/hesaplama/santrifuj` - Santrifüj hesapla
- `POST /api/hesaplama/posturleme` - Postürleme hesapla
- `POST /api/hesaplama/azotlucapakalma` - Azotlu çapak alma hesapla
- `POST /api/hesaplama/satis-kayitlari` - Satış kaydı oluştur
- `GET /api/hesaplama/satis-kayitlari` - Satış kayıtları listele
- `PUT /api/hesaplama/satis-kayitlari/{id}` - Satış kaydı güncelle
- `DELETE /api/hesaplama/satis-kayitlari/{id}` - Satış kaydı sil

## 🚀 Kurulum Adımları

1. **SQL Script'i çalıştır**: `add-rol-column.sql`
2. **API'yi yeniden başlat**
3. **Frontend'e servisleri ekle**
4. **Route guard'ları kur**
5. **Login/logout sistemi entegre et**

Artık tam yetki kontrolü ile çalışan bir sisteminiz var! 🎉
