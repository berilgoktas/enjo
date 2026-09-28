// UpdatedLogin.jsx - Yeni API yapısı
import React, { useState } from 'react';
import { authService } from './updated-auth-service';

const UpdatedLogin = ({ onLogin }) => {
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
      padding: '30px',
      border: '1px solid #ddd',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      backgroundColor: 'white'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
          🔐 Giriş Yap
        </h2>
        <p style={{ color: '#7f8c8d', margin: 0 }}>
          Enjo Hesaplama Sistemi
        </p>
      </div>
      
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: 'bold',
            color: '#34495e'
          }}>
            Kullanıcı Adı:
          </label>
          <input
            type="text"
            value={kullaniciAdi}
            onChange={(e) => setKullaniciAdi(e.target.value)}
            placeholder="Kullanıcı adınızı girin"
            required
            disabled={yukleniyor}
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #ecf0f1',
              borderRadius: '8px',
              fontSize: '16px',
              transition: 'border-color 0.3s',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3498db'}
            onBlur={(e) => e.target.style.borderColor = '#ecf0f1'}
          />
        </div>
        
        <div style={{ marginBottom: '25px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: 'bold',
            color: '#34495e'
          }}>
            Şifre:
          </label>
          <input
            type="password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            placeholder="Şifrenizi girin"
            required
            disabled={yukleniyor}
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #ecf0f1',
              borderRadius: '8px',
              fontSize: '16px',
              transition: 'border-color 0.3s',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3498db'}
            onBlur={(e) => e.target.style.borderColor = '#ecf0f1'}
          />
        </div>
        
        <button
          type="submit"
          disabled={yukleniyor}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: yukleniyor ? '#bdc3c7' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: yukleniyor ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s',
            boxShadow: yukleniyor ? 'none' : '0 2px 4px rgba(52, 152, 219, 0.3)'
          }}
          onMouseOver={(e) => {
            if (!yukleniyor) e.target.style.backgroundColor = '#2980b9';
          }}
          onMouseOut={(e) => {
            if (!yukleniyor) e.target.style.backgroundColor = '#3498db';
          }}
        >
          {yukleniyor ? '⏳ Giriş yapılıyor...' : '🚀 Giriş Yap'}
        </button>
      </form>

      {hata && (
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          ❌ {hata}
        </div>
      )}

      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        fontSize: '14px',
        border: '1px solid #e9ecef'
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>🧪 Test Kullanıcıları:</h4>
        <div style={{ marginBottom: '8px', padding: '8px', backgroundColor: 'white', borderRadius: '4px' }}>
          <strong style={{ color: '#e74c3c' }}>Admin:</strong> uygulama üzerinden oluşturulan yönetici hesabı
        </div>
        <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px' }}>
          <strong style={{ color: '#3498db' }}>User:</strong> Kendi oluşturduğunuz kullanıcılar
        </div>
      </div>

      {/* Debug bilgileri */}
      <details style={{ marginTop: '20px', fontSize: '12px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#6c757d' }}>
          🔍 Debug Bilgileri
        </summary>
        <pre style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '15px', 
          borderRadius: '8px',
          overflow: 'auto',
          marginTop: '10px',
          border: '1px solid #e9ecef'
        }}>
          {JSON.stringify({
            isAuthenticated: authService.isAuthenticated(),
            currentUser: authService.getCurrentUser(),
            localStorage: {
              kullaniciAdi: localStorage.getItem('kullaniciAdi'),
              rol: localStorage.getItem('rol'),
              userId: localStorage.getItem('userId')
            },
            yukleniyor: yukleniyor
          }, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default UpdatedLogin;
