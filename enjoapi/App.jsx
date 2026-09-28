// App.jsx - Ana uygulama
import React, { useState, useEffect } from 'react';
import { authService } from './simple-auth-service';
import Login from './Login';
import KullaniciYonetimi from './KullaniciYonetimi';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('hesaplama');

  useEffect(() => {
    // Sayfa yüklendiğinde giriş durumunu kontrol et
    const checkAuth = () => {
      const isAuth = authService.isAuthenticated();
      console.log('🔍 Uygulama başlatılıyor, giriş durumu:', isAuth);
      
      if (isAuth) {
        const user = authService.getCurrentUser();
        setCurrentUser(user);
        setIsAuthenticated(true);
        console.log('✅ Kullanıcı oturumu bulundu:', user);
      } else {
        console.log('❌ Kullanıcı oturumu bulunamadı');
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (userData) => {
    console.log('🎉 Giriş başarılı, kullanıcı bilgileri:', userData);
    setCurrentUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    console.log('🚪 Çıkış yapılıyor');
    authService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setActiveTab('hesaplama');
  };

  // Giriş yapılmamışsa login sayfasını göster
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>
            🏭 Enjo Hesaplama Sistemi
          </h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>
                Hoş geldin, <strong>{currentUser?.kullaniciAdi}</strong>
              </div>
              <div style={{ 
                fontSize: '12px', 
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: currentUser?.rol === 'Admin' ? '#e74c3c' : '#3498db',
                display: 'inline-block',
                marginTop: '4px'
              }}>
                {currentUser?.rol === 'Admin' ? '🔴 Admin' : '🔵 User'}
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🚪 Çıkış Yap
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #ddd',
        padding: '0 20px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '20px' }}>
            <button
              onClick={() => setActiveTab('hesaplama')}
              style={{
                padding: '15px 20px',
                border: 'none',
                backgroundColor: activeTab === 'hesaplama' ? '#3498db' : 'transparent',
                color: activeTab === 'hesaplama' ? 'white' : '#333',
                cursor: 'pointer',
                fontSize: '16px',
                borderBottom: activeTab === 'hesaplama' ? '3px solid #2980b9' : '3px solid transparent'
              }}
            >
              💰 Hesaplamalar
            </button>
            
            {authService.isAdmin() && (
              <button
                onClick={() => setActiveTab('users')}
                style={{
                  padding: '15px 20px',
                  border: 'none',
                  backgroundColor: activeTab === 'users' ? '#3498db' : 'transparent',
                  color: activeTab === 'users' ? 'white' : '#333',
                  cursor: 'pointer',
                  fontSize: '16px',
                  borderBottom: activeTab === 'users' ? '3px solid #2980b9' : '3px solid transparent'
                }}
              >
                👥 Kullanıcı Yönetimi
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {activeTab === 'hesaplama' && (
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2>💰 Maliyet Hesaplamaları</h2>
            <p>Hesaplama sayfası burada olacak...</p>
            <div style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              marginTop: '20px'
            }}>
              <h4>🔍 Debug Bilgileri:</h4>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify({
                  isAuthenticated: authService.isAuthenticated(),
                  isAdmin: authService.isAdmin(),
                  isUser: authService.isUser(),
                  currentUser: authService.getCurrentUser()
                }, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'users' && authService.isAdmin() && (
          <KullaniciYonetimi />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#34495e',
        color: 'white',
        textAlign: 'center',
        padding: '20px',
        marginTop: '40px'
      }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          © 2024 Enjo Hesaplama Sistemi - Basit Authentication
        </p>
      </footer>
    </div>
  );
};

export default App;
