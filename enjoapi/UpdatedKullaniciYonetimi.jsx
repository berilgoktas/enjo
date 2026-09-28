// UpdatedKullaniciYonetimi.jsx - Yeni API yapısı
import React, { useState, useEffect } from 'react';
import { authService, userService } from './updated-auth-service';

const UpdatedKullaniciYonetimi = () => {
  const [kullanicilar, setKullanicilar] = useState([]);
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [yeniKullanici, setYeniKullanici] = useState({
    kullaniciAdi: '',
    sifre: '',
    rol: 'user'
  });

  const kullanicilariYukle = async () => {
    try {
      setYukleniyor(true);
      console.log('🔄 Kullanıcılar yükleniyor...');
      const data = await userService.getUsers();
      setKullanicilar(data);
      setHata('');
      console.log('✅ Kullanıcılar yüklendi:', data);
    } catch (error) {
      console.error('❌ Kullanıcılar yüklenemedi:', error);
      setHata(error.message);
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    kullanicilariYukle();
  }, []);

  const handleYeniKullanici = async (e) => {
    e.preventDefault();
    try {
      setYukleniyor(true);
      console.log('➕ Yeni kullanıcı oluşturuluyor:', yeniKullanici);
      await userService.createUser(
        yeniKullanici.kullaniciAdi,
        yeniKullanici.sifre,
        yeniKullanici.rol
      );
      setYeniKullanici({ kullaniciAdi: '', sifre: '', rol: 'user' });
      await kullanicilariYukle(); // Listeyi yenile
    } catch (error) {
      console.error('❌ Kullanıcı oluşturulamadı:', error);
      setHata(error.message);
    } finally {
      setYukleniyor(false);
    }
  };

  const handleKullaniciSil = async (id) => {
    if (window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
      try {
        setYukleniyor(true);
        console.log('🗑️ Kullanıcı siliniyor:', id);
        await userService.deleteUser(id);
        await kullanicilariYukle(); // Listeyi yenile
      } catch (error) {
        console.error('❌ Kullanıcı silinemedi:', error);
        setHata(error.message);
      } finally {
        setYukleniyor(false);
      }
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>👥 Kullanıcı Yönetimi</h2>
      
      {hata && (
        <div className="error" style={{ 
          color: 'red', 
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: '#ffe6e6',
          border: '1px solid #ffcccc',
          borderRadius: '4px'
        }}>
          ❌ {hata}
        </div>
      )}

      {/* Yeni kullanıcı formu */}
      <div style={{ 
        border: '1px solid #ccc', 
        padding: '20px', 
        marginBottom: '20px',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9'
      }}>
        <h3>➕ Yeni Kullanıcı Ekle</h3>
        <form onSubmit={handleYeniKullanici}>
          <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Kullanıcı Adı"
              value={yeniKullanici.kullaniciAdi}
              onChange={(e) => setYeniKullanici({...yeniKullanici, kullaniciAdi: e.target.value})}
              required
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <input
              type="password"
              placeholder="Şifre"
              value={yeniKullanici.sifre}
              onChange={(e) => setYeniKullanici({...yeniKullanici, sifre: e.target.value})}
              required
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <select
              value={yeniKullanici.rol}
              onChange={(e) => setYeniKullanici({...yeniKullanici, rol: e.target.value})}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button 
              type="submit" 
              disabled={yukleniyor}
              style={{ 
                padding: '8px 16px',
                backgroundColor: yukleniyor ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: yukleniyor ? 'not-allowed' : 'pointer'
              }}
            >
              {yukleniyor ? '⏳ Ekleniyor...' : '➕ Ekle'}
            </button>
          </div>
        </form>
      </div>

      {/* Kullanıcı listesi */}
      <div>
        <h3>📋 Kullanıcı Listesi</h3>
        {yukleniyor ? (
          <p>⏳ Yükleniyor...</p>
        ) : kullanicilar.length === 0 ? (
          <p>Kullanıcı bulunamadı</p>
        ) : (
          <div>
            {kullanicilar.map(user => (
              <div 
                key={user.id} 
                style={{ 
                  border: '1px solid #ddd', 
                  padding: '15px', 
                  margin: '10px 0',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <div>
                  <strong style={{ fontSize: '16px' }}>{user.kullaniciAdi}</strong>
                  <span style={{ 
                    marginLeft: '10px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    backgroundColor: user.rol === 'admin' ? '#e74c3c' : '#3498db',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {user.rol === 'admin' ? '🔴 Admin' : '🔵 User'}
                  </span>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    ID: {user.id} | Oluşturulma: {new Date(user.olusturmaTarihi).toLocaleDateString('tr-TR')}
                  </div>
                </div>
                <button
                  onClick={() => handleKullaniciSil(user.id)}
                  disabled={yukleniyor}
                  style={{
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    cursor: yukleniyor ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  🗑️ Sil
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debug bilgileri */}
      <details style={{ marginTop: '20px', fontSize: '12px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>🔍 Debug Bilgileri</summary>
        <pre style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '15px', 
          borderRadius: '4px',
          overflow: 'auto',
          marginTop: '10px'
        }}>
          {JSON.stringify({
            isAuthenticated: authService.isAuthenticated(),
            isAdmin: authService.isAdmin(),
            currentUser: authService.getCurrentUser(),
            kullaniciSayisi: kullanicilar.length,
            yukleniyor: yukleniyor
          }, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default UpdatedKullaniciYonetimi;
