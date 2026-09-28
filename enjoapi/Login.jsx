// Login.jsx - Basit versiyon
import React, { useState } from 'react';
import { authService } from './simple-auth-service';

const Login = ({ onLogin }) => {
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [sifre, setSifre] = useState('');
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setHata('');
    setYukleniyor(true);

    try {
      console.log('🔐 Giriş yapılıyor:', kullaniciAdi);
      const result = await authService.login(kullaniciAdi, sifre);
      console.log('✅ Giriş başarılı:', result);
      onLogin(result);
    } catch (error) {
      console.error('❌ Giriş hatası:', error);
      setHata(error.message);
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '50px auto', 
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>
        🔐 Giriş Yap
      </h2>
      
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Kullanıcı Adı:
          </label>
          <input
            type="text"
            value={kullaniciAdi}
            onChange={(e) => setKullaniciAdi(e.target.value)}
            placeholder="Kullanıcı adınızı girin"
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Şifre:
          </label>
          <input
            type="password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            placeholder="Şifrenizi girin"
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
        </div>
        
        <button
          type="submit"
          disabled={yukleniyor}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: yukleniyor ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: yukleniyor ? 'not-allowed' : 'pointer'
          }}
        >
          {yukleniyor ? '⏳ Giriş yapılıyor...' : '🚀 Giriş Yap'}
        </button>
      </form>

      {hata && (
        <div style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px'
        }}>
          ❌ {hata}
        </div>
      )}

      <div style={{
        marginTop: '30px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>🧪 Test Kullanıcıları:</h4>
        <div style={{ marginBottom: '5px' }}>
          <strong>Admin:</strong> uygulama üzerinden oluşturulan yönetici hesabı
        </div>
        <div>
          <strong>User:</strong> Kendi oluşturduğunuz kullanıcılar
        </div>
      </div>

      {/* Debug bilgileri */}
      <details style={{ marginTop: '20px', fontSize: '12px' }}>
        <summary>🔍 Debug Bilgileri</summary>
        <pre style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '10px', 
          borderRadius: '4px',
          overflow: 'auto'
        }}>
          {JSON.stringify({
            isAuthenticated: authService.isAuthenticated(),
            currentUser: authService.getCurrentUser(),
            localStorage: {
              kullaniciAdi: localStorage.getItem('kullaniciAdi'),
              rol: localStorage.getItem('rol'),
              userId: localStorage.getItem('userId')
            }
          }, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default Login;
