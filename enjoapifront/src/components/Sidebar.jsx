import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'

export default function Sidebar() {
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    // localStorage'dan kullanıcı bilgilerini al
    const user = localStorage.getItem('currentUser')
    if (user) {
      setCurrentUser(JSON.parse(user))
    }
  }, [])

  const handleLogout = () => {
    // localStorage'ı temizle
    localStorage.removeItem('currentUser')
    localStorage.removeItem('token')
    localStorage.removeItem('kullaniciAdi')
    localStorage.removeItem('rol')
    
    // Login sayfasına yönlendir
    window.location.href = '/login'
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </div>
          <div className="logo-text">
            <div className="logo-subtitle">Enjeksiyon Sistemi</div>
          </div>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink to="/satis" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="sidebar-link-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <span>Satış Ekranı</span>
        </NavLink>
        
        {/* Sadece admin görebilir */}
        {currentUser && currentUser.rol === 'admin' && (
          <>
            <NavLink to="/projeler" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <div className="sidebar-link-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2-2z"></path>
                  <path d="M8 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2H8V5z"></path>
                </svg>
              </div>
              <span>Projeler</span>
            </NavLink>
            
            <NavLink to="/uretim/asama-secim" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <div className="sidebar-link-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4M9 11V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M9 11h6"></path>
                </svg>
              </div>
              <span>Üretim</span>
            </NavLink>
            
            <NavLink to="/kullanici-yonetimi" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <div className="sidebar-link-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  <path d="M6 21v-2a4 4 0 0 1 4-4h.5"></path>
                </svg>
              </div>
              <span>Kullanıcı Yönetimi</span>
            </NavLink>
          </>
        )}
      </nav>
      
      <div className="sidebar-footer">
        {/* Kullanıcı Bilgileri */}
        {currentUser && (
          <div className="user-info">
            <div className="user-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div className="user-details">
              <div className="user-name">{currentUser.kullaniciAdi}</div>
              <div className="user-role">{currentUser.rol === 'admin' ? 'Admin' : 'Kullanıcı'}</div>
            </div>
          </div>
        )}
        
        <button onClick={handleLogout} className="logout-button">
          <div className="logout-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16,17 21,12 16,7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </div>
          <span>Çıkış Yap</span>
        </button>
      </div>
    </aside>
  )
}


