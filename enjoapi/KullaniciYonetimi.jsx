// KullaniciYonetimi.jsx - Basit versiyon
import React, { useState, useEffect } from 'react';
import { authService, userService } from './simple-auth-service';

const KullaniciYonetimi = () => {
  const [kullanicilar, setKullanicilar] = useState([]);
  const [hata, setHata] = useState('');
  const [yeniKullanici, setYeniKullanici] = useState({
    kullaniciAdi: '',
    sifre: '',
    rol: 'User'
  });

  const kullanicilariYukle = async () => {
    try {
      console.log('🔄 Kullanıcılar yükleniyor...');
      const data = await userService.getUsers();
      setKullanicilar(data);
      setHata('');
      console.log('✅ Kullanıcılar yüklendi:', data);
    } catch (error) {
      console.error('❌ Kullanıcılar yüklenemedi:', error);
      setHata(error.message);
    }
  };

  useEffect(() => {
    kullanicilariYukle();
  }, []);

  const handleYeniKullanici = async (e) => {
    e.preventDefault();
    try {
      console.log('➕ Yeni kullanıcı oluşturuluyor:', yeniKullanici);
      await userService.createUser(
        yeniKullanici.kullaniciAdi,
        yeniKullanici.sifre,
        yeniKullanici.rol
      );
      setYeniKullanici({ kullaniciAdi: '', sifre: '', rol: 'User' });
      kullanicilariYukle(); // Listeyi yenile
    } catch (error) {
      console.error('❌ Kullanıcı oluşturulamadı:', error);
      setHata(error.message);
    }
  };

  const handleKullaniciSil = async (id) => {
    if (window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
      try {
        console.log('🗑️ Kullanıcı siliniyor:', id);
        await userService.deleteUser(id);
        kullanicilariYukle(); // Listeyi yenile
      } catch (error) {
        console.error('❌ Kullanıcı silinemedi:', error);
        setHata(error.message);
      }
    }
  };

  const kullaniciGuncelle = async (id, kullaniciAdi, sifre, rol) => {
    try {
      console.log('✏️ Kullanıcı güncelleniyor:', id, kullaniciAdi, rol);
      await userService.updateUser(id, kullaniciAdi, sifre, rol);
      kullanicilariYukle(); // Listeyi yenile
    } catch (error) {
      console.error('❌ Kullanıcı güncellenemedi:', error);
      setHata(error.message);
    }
  };

  // Admin kontrolü
  if (!authService.isAdmin()) {
    return (
      <div className="error" style={{ color: 'red', padding: '20px' }}>
        ❌ Bu sayfaya erişim için Admin yetkisi gerekiyor.
        <br />
        Mevcut rol: {localStorage.getItem('rol') || 'Belirsiz'}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>👥 Kullanıcı Yönetimi</h2>
      
      {hata && (
        <div className="error" style={{ color: 'red', marginBottom: '20px' }}>
          ❌ {hata}
        </div>
      )}

      {/* Yeni kullanıcı formu */}
      <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
        <h3>➕ Yeni Kullanıcı Ekle</h3>
        <form onSubmit={handleYeniKullanici}>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Kullanıcı Adı"
              value={yeniKullanici.kullaniciAdi}
              onChange={(e) => setYeniKullanici({...yeniKullanici, kullaniciAdi: e.target.value})}
              required
              style={{ padding: '8px', marginRight: '10px' }}
            />
            <input
              type="password"
              placeholder="Şifre"
              value={yeniKullanici.sifre}
              onChange={(e) => setYeniKullanici({...yeniKullanici, sifre: e.target.value})}
              required
              style={{ padding: '8px', marginRight: '10px' }}
            />
            <select
              value={yeniKullanici.rol}
              onChange={(e) => setYeniKullanici({...yeniKullanici, rol: e.target.value})}
              style={{ padding: '8px', marginRight: '10px' }}
            >
              <option value="User">User</option>
              <option value="Admin">Admin</option>
            </select>
            <button type="submit" style={{ padding: '8px 16px' }}>
              ➕ Ekle
            </button>
          </div>
        </form>
      </div>

      {/* Kullanıcı listesi */}
      <div>
        <h3>📋 Kullanıcı Listesi</h3>
        {kullanicilar.length === 0 ? (
          <p>Kullanıcı bulunamadı</p>
        ) : (
          <div>
            {kullanicilar.map(user => (
              <div 
                key={user.id} 
                style={{ 
                  border: '1px solid #ddd', 
                  padding: '10px', 
                  margin: '5px 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong>{user.kullaniciAdi}</strong>
                  <span style={{ 
                    marginLeft: '10px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: user.rol === 'Admin' ? '#ff6b6b' : '#4ecdc4',
                    color: 'white',
                    fontSize: '12px'
                  }}>
                    {user.rol === 'Admin' ? '🔴 Admin' : '🔵 User'}
                  </span>
                </div>
                <div>
                  <button
                    onClick={() => {
                      const yeniKullaniciAdi = prompt('Yeni kullanıcı adı:', user.kullaniciAdi);
                      const yeniSifre = prompt('Yeni şifre:', '');
                      const yeniRol = prompt('Yeni rol (User/Admin):', user.rol);
                      
                      if (yeniKullaniciAdi && yeniSifre && yeniRol) {
                        kullaniciGuncelle(user.id, yeniKullaniciAdi, yeniSifre, yeniRol);
                      }
                    }}
                    style={{
                      backgroundColor: '#4ecdc4',
                      color: 'white',
                      border: 'none',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '10px'
                    }}
                  >
                    ✏️ Güncelle
                  </button>
                  <button
                    onClick={() => handleKullaniciSil(user.id)}
                    style={{
                      backgroundColor: '#ff4757',
                      color: 'white',
                      border: 'none',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debug bilgileri */}
      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <details>
          <summary>🔍 Debug Bilgileri</summary>
          <pre>
            {JSON.stringify({
              isAuthenticated: authService.isAuthenticated(),
              isAdmin: authService.isAdmin(),
              currentUser: authService.getCurrentUser(),
              kullaniciSayisi: kullanicilar.length
            }, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

export default KullaniciYonetimi;
