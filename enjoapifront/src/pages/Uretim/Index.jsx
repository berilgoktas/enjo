import { NavLink } from 'react-router-dom'

export default function Uretim() {
  return (
    <div className="production-container">
      {/* Modern Header */}
      <div className="production-header">
        <div className="production-header-content">
          <div className="production-title-section">
            <h1 className="production-title">Üretim Yönetimi</h1>
            <p className="production-subtitle">Üretim süreçlerinizi yönetin ve hesaplamalarınızı yapın</p>
          </div>
          <div className="production-stats">
            <div className="stat-item">
              <span className="stat-number">5</span>
              <span className="stat-label">Hesaplama Türü</span>
            </div>
            <div className="stat-item highlight">
              <span className="stat-number">1</span>
              <span className="stat-label">Aktif Süreç</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Content */}
      <div className="production-content">
        <div className="production-section">
          <div className="section-header">
            <h2 className="section-title">Hesaplama Modülleri</h2>
            <p className="section-description">Üretim süreçleriniz için gerekli hesaplamaları yapın</p>
          </div>
          
          <div className="calculation-modules">
            <NavLink to="/uretim/hesaplamalar/enjeksiyon" className={({isActive}) => `calculation-module ${isActive ? 'active' : ''}`}>
              <div className="module-icon">
                <span style={{ fontSize: '24px' }}>🧩</span>
              </div>
              <div className="module-content">
                <h3 className="module-title">Enjeksiyon</h3>
                <p className="module-description">Enjeksiyon maliyet hesaplamaları</p>
              </div>
              <div className="module-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </NavLink>

            <NavLink to="/uretim/hesaplamalar/azotlu-capak-alma" className={({isActive}) => `calculation-module ${isActive ? 'active' : ''}`}>
              <div className="module-icon">
                <span style={{ fontSize: '24px' }}>❄️</span>
              </div>
              <div className="module-content">
                <h3 className="module-title">Azotlu Çapak Alma</h3>
                <p className="module-description">Azotlu çapak alma maliyet hesaplamaları</p>
              </div>
              <div className="module-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </NavLink>

            <NavLink to="/uretim/hesaplamalar/posturleme" className={({isActive}) => `calculation-module ${isActive ? 'active' : ''}`}>
              <div className="module-icon">
                <span style={{ fontSize: '24px' }}>🔥</span>
              </div>
              <div className="module-content">
                <h3 className="module-title">Post-Kürleme</h3>
                <p className="module-description">Post-Kürleme maliyet hesaplamaları</p>
              </div>
              <div className="module-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </NavLink>

            <NavLink to="/uretim/hesaplamalar/santrifuj" className={({isActive}) => `calculation-module ${isActive ? 'active' : ''}`}>
              <div className="module-icon">
                <span style={{ fontSize: '24px' }}>🌀</span>
              </div>
              <div className="module-content">
                <h3 className="module-title">Santrifüjlü Çapak Alma</h3>
                <p className="module-description">Santrifüjlü çapak alma maliyet hesaplamaları</p>
              </div>
              <div className="module-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </NavLink>

            <NavLink to="/uretim/hesaplamalar/yikama" className={({isActive}) => `calculation-module ${isActive ? 'active' : ''}`}>
              <div className="module-icon">
                <span style={{ fontSize: '24px' }}>🧴</span>
              </div>
              <div className="module-content">
                <h3 className="module-title">Yıkama</h3>
                <p className="module-description">Yıkama maliyet hesaplamaları</p>
              </div>
              <div className="module-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  )
}


