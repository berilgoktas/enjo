// React Component Örnekleri - Sadece Admin ve User Girişi

import React, { useState, useEffect } from 'react';
import { authService, userService, hesaplamaService } from './frontend-auth-service';

// Login Component
const Login = ({ onLogin }) => {
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [sifre, setSifre] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const result = await authService.login(kullaniciAdi, sifre);
      console.log('Giriş başarılı:', result);
      onLogin(result);
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="login-container">
      <h2>Giriş Yap</h2>
      <form onSubmit={handleLogin}>
        <div>
          <input 
            type="text"
            value={kullaniciAdi}
            onChange={(e) => setKullaniciAdi(e.target.value)}
            placeholder="Kullanıcı Adı"
            required
          />
        </div>
        <div>
          <input 
            type="password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            placeholder="Şifre"
            required
          />
        </div>
        <button type="submit">Giriş Yap</button>
        {error && <div className="error">{error}</div>}
      </form>
      <div className="info">
        <p><strong>Test Kullanıcıları:</strong></p>
        <p>Admin: uygulama üzerinden oluşturulan yönetici hesabı</p>
        <p>User: Kendi oluşturduğunuz kullanıcılar</p>
      </div>
    </div>
  );
};

// Kullanıcı Yönetimi Component (Sadece Admin)
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (kullaniciAdi, sifre, rol) => {
    try {
      await userService.createUser(kullaniciAdi, sifre, rol);
      loadUsers(); // Listeyi yenile
    } catch (error) {
      setError(error.message);
    }
  };

  const handleUpdateUser = async (id, kullaniciAdi, sifre, rol) => {
    try {
      await userService.updateUser(id, kullaniciAdi, sifre, rol);
      loadUsers(); // Listeyi yenile
    } catch (error) {
      setError(error.message);
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
      try {
        await userService.deleteUser(id);
        loadUsers(); // Listeyi yenile
      } catch (error) {
        setError(error.message);
      }
    }
  };

  if (!authService.isAdmin()) {
    return <div className="error">Bu sayfaya erişim için Admin yetkisi gerekiyor.</div>;
  }

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div className="user-management">
      <h2>Kullanıcı Yönetimi</h2>
      {error && <div className="error">{error}</div>}
      
      <div className="user-list">
        {users.map(user => (
          <div key={user.id} className="user-item">
            <span>{user.kullaniciAdi}</span>
            <span className={`role ${user.rol.toLowerCase()}`}>
              {user.rol === 'Admin' ? '🔴 Admin' : '🔵 User'}
            </span>
            <button onClick={() => handleDeleteUser(user.id)}>Sil</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Hesaplama Component (User veya Admin)
const Hesaplama = () => {
  const [maliyetler, setMaliyetler] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaliyetler();
  }, []);

  const loadMaliyetler = async () => {
    try {
      const data = await hesaplamaService.getSonMaliyetler();
      setMaliyetler(data);
    } catch (error) {
      console.error('Maliyetler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!authService.isUser()) {
    return <div className="error">Bu sayfaya erişim için giriş yapmanız gerekiyor.</div>;
  }

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div className="hesaplama">
      <h2>Maliyet Hesaplamaları</h2>
      
      {maliyetler && (
        <div className="maliyetler">
          <h3>Son Maliyetler</h3>
          {maliyetler.sonMaliyetler.map((maliyet, index) => (
            <div key={index} className="maliyet-item">
              <h4>{maliyet.hesaplamaTuru}</h4>
              <p>Toplam: {maliyet.toplamMaliyet.toFixed(6)}</p>
            </div>
          ))}
          
          <div className="genel-toplam">
            <h3>Genel Toplam</h3>
            <p>Toplam Maliyet: {maliyetler.genelToplamlar.toplamMaliyet.toFixed(6)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Ana App Component
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      setCurrentUser({
        kullaniciAdi: localStorage.getItem('kullaniciAdi'),
        rol: localStorage.getItem('rol')
      });
    }
  }, [isAuthenticated]);

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setCurrentUser(userData);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Enjo Hesaplama Sistemi</h1>
        <div className="user-info">
          <span>Hoş geldin, {currentUser?.kullaniciAdi}</span>
          <span className={`role ${currentUser?.rol?.toLowerCase()}`}>
            {currentUser?.rol === 'Admin' ? '🔴 Admin' : '🔵 User'}
          </span>
          <button onClick={handleLogout}>Çıkış Yap</button>
        </div>
      </header>

      <main className="app-main">
        <nav className="app-nav">
          <button onClick={() => setActiveTab('hesaplama')}>Hesaplamalar</button>
          {authService.isAdmin() && (
            <button onClick={() => setActiveTab('users')}>Kullanıcı Yönetimi</button>
          )}
        </nav>

        <div className="app-content">
          {activeTab === 'hesaplama' && <Hesaplama />}
          {activeTab === 'users' && authService.isAdmin() && <UserManagement />}
        </div>
      </main>
    </div>
  );
};

// Route Guard Component
export const ProtectedRoute = ({ children, requireAdmin = false }) => {
  if (!authService.isAuthenticated()) {
    return <div className="error">Bu sayfaya erişim için giriş yapmanız gerekiyor.</div>;
  }

  if (requireAdmin && !authService.isAdmin()) {
    return <div className="error">Bu sayfaya erişim için Admin yetkisi gerekiyor.</div>;
  }

  return children;
};

export default App;
