import { useState, useEffect, useMemo } from 'react'
import { useProje } from '../context/ProjeContext'
import Modal from '../components/Modal.jsx'

export default function Projeler() {
  const { projeler, projeSil, projeGuncelle } = useProje()
  const [apiProjeler, setApiProjeler] = useState([])
  const [loading, setLoading] = useState(false)
  const [duzenlemeId, setDuzenlemeId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [duzenlemeFormu, setDuzenlemeFormu] = useState({
    projeAdi: '',
    aciklama: '',
    durum: 'aktif'
  })
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' })

  // API'den satış kayıtlarını çek
  const apiProjeleriYukle = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/hesaplama/satis-kayitlari?_t=${Date.now()}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (res.ok) {
        const data = await res.json()
        const apiProjeler = Array.isArray(data) ? data.map(kayit => ({
          id: `api_${kayit.id}`,
          gercekId: kayit.id, // Gerçek ID'yi de sakla
          projeAdi: kayit.ad || 'İsimsiz Proje',
          aciklama: `Proje Kayıt - ${new Date(kayit.tarih || Date.now()).toLocaleDateString('tr-TR')}`,
          durum: 'aktif',
          kaynak: 'api',
          uretimVerileri: {
            degerler: kayit.degerler || {},
            formlar: kayit.formlar || {},
            toplamMaliyet: kayit.degerler?.toplamMaliyet || 0
          },
          orijinalKayit: kayit
        })) : []
        setApiProjeler(apiProjeler)
      } else {
        console.warn('API projeleri yüklenemedi:', res.status)
        setApiProjeler([])
      }
    } catch (error) {
      console.error('API projeleri yükleme hatası:', error)
      setApiProjeler([])
    } finally {
      setLoading(false)
    }
  }

  // Sayfa yüklendiğinde API projelerini çek
  useEffect(() => {
    apiProjeleriYukle()
  }, [])

  // Tüm projeleri birleştir (local + API)
  const tumProjeler = [...projeler.map(p => ({ ...p, kaynak: 'local' })), ...apiProjeler]

  // Filtrelenmiş projeler
  const filteredProjeler = useMemo(() => {
    return tumProjeler.filter(proje => {
      const matchesSearch = !searchQuery || 
        proje.projeAdi.toLowerCase().includes(searchQuery.toLowerCase()) ||
        proje.aciklama?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || proje.durum === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [tumProjeler, searchQuery, statusFilter])

  const handleDuzenlemeBaslat = (proje) => {
    setDuzenlemeId(proje.id)
    setDuzenlemeFormu({
      projeAdi: proje.projeAdi,
      aciklama: proje.aciklama,
      durum: proje.durum
    })
  }

  const handleDuzenlemeKaydet = () => {
    if (duzenlemeFormu.projeAdi.trim()) {
      if (duzenlemeId.startsWith('api_')) {
        // API projesi düzenleme - şimdilik sadece local güncelleme
        setModal({
          isOpen: true,
          title: 'Bilgi',
          message: 'API projeleri şu anda düzenlenemez. Sadece görüntüleme yapılabilir.',
          type: 'info'
        })
        setDuzenlemeId(null)
        setDuzenlemeFormu({ projeAdi: '', aciklama: '', durum: 'aktif' })
      } else {
        projeGuncelle(duzenlemeId, duzenlemeFormu)
        setDuzenlemeId(null)
        setDuzenlemeFormu({ projeAdi: '', aciklama: '', durum: 'aktif' })
      }
    }
  }

  const handleDuzenlemeIptal = () => {
    setDuzenlemeId(null)
    setDuzenlemeFormu({ projeAdi: '', aciklama: '', durum: 'aktif' })
  }

  const getDurumBadge = (durum) => {
    const durumlar = {
      aktif: { class: 'badge-success', text: 'Aktif' },
      tamamlandi: { class: 'badge-info', text: 'Tamamlandı' },
      askida: { class: 'badge-warning', text: 'Askıda' }
    }
    const durumInfo = durumlar[durum] || durumlar.aktif
    return <span className={`badge ${durumInfo.class}`}>{durumInfo.text}</span>
  }

  // API projesi silme
  const silApiProjesi = async (id) => {
    try {
      console.log(`DELETE API Projesi ${id} başlıyor...`)
      
      const response = await fetch(`/api/hesaplama/satis-kayitlari/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        console.log(`DELETE API Projesi ${id} başarılı!`)
        return true
      } else if (response.status === 404) {
        console.error(`API Projesi ${id} bulunamadı!`)
        return false
      } else {
        console.error(`DELETE API Projesi ${id} başarısız:`, response.status)
        return false
      }
    } catch (error) {
      console.error('DELETE API Projesi hatası:', error)
      return false
    }
  }

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, proje: null })

  const handleProjeSil = (proje) => {
    setDeleteModal({ isOpen: true, proje })
  }

  const confirmDelete = async () => {
    const { proje } = deleteModal
    if (!proje) return

    if (proje.kaynak === 'api') {
      // API projesi silme
      const basarili = await silApiProjesi(proje.gercekId || proje.id.replace('api_', ''))
      if (basarili) {
        setModal({
          isOpen: true,
          title: 'Başarılı',
          message: 'API projesi başarıyla silindi!',
          type: 'success'
        })
        // API projelerini yenile
        apiProjeleriYukle()
      } else {
        setModal({
          isOpen: true,
          title: 'Hata',
          message: 'API projesi silinemedi!',
          type: 'error'
        })
      }
    } else {
      // Local proje silme
      projeSil(proje.id)
      setModal({
        isOpen: true,
        title: 'Başarılı',
        message: 'Local proje başarıyla silindi!',
        type: 'success'
      })
    }
    
    setDeleteModal({ isOpen: false, proje: null })
  }

  const cancelDelete = () => {
    setDeleteModal({ isOpen: false, proje: null })
  }

  const handleProjeGuncelle = (proje) => {
    // Sadece gerçek ID'yi URL parametresi olarak gönder
    const gercekId = proje.gercekId || proje.id.replace('api_', '')
    console.log('Güncelleme için gerçek ID:', gercekId)
    window.location.href = `/proje-guncelle?id=${gercekId}`
  }

  return (
    <div className="projects-container">
      {/* Modern Header */}
      <div className="projects-header">
        <div className="projects-header-content">
          <div className="projects-title-section">
            <h1 className="projects-title">Proje Yönetimi</h1>
            <p className="projects-subtitle">Tüm projelerinizi tek yerden yönetin ve takip edin</p>
          </div>
          <div className="projects-stats">
            <div className="stat-item">
              <span className="stat-number">{tumProjeler.length}</span>
              <span className="stat-label">Toplam Proje</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{filteredProjeler.length}</span>
              <span className="stat-label">Filtrelenmiş</span>
            </div>
            <div className="stat-item highlight">
              <span className="stat-number">{tumProjeler.filter(p => p.durum === 'aktif').length}</span>
              <span className="stat-label">Aktif Proje</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="filters-section">
        <div className="filters-container">
          <div className="search-input-wrapper">
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              className="search-input"
              placeholder="Proje adı veya açıklama ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="search-clear"
                onClick={() => setSearchQuery('')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
          
          <div className="filters-row">
            <div className="filter-group">
              <label className="filter-label">Durum</label>
              <select 
                className="filter-select"
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">Tüm Durumlar</option>
                <option value="aktif">Aktif</option>            
                <option value="askida">Askıda</option>
              </select>
            </div>
            
            
            <button 
              onClick={apiProjeleriYukle} 
              className="refresh-button"
              disabled={loading}
            >
              {loading ? (
                <div className="loading-spinner-small"></div>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23,4 23,10 17,10"></polyline>
                  <polyline points="1,20 1,14 7,14"></polyline>
                  <path d="M20.49,9A9,9,0,0,0,5.64,5.64L1,10m22,4L18.36,18.36A9,9,0,0,1,3.51,15"></path>
                </svg>
              )}
              {loading ? 'Yükleniyor...' : 'Yenile'}
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && tumProjeler.length === 0 && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Projeler yükleniyor...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && tumProjeler.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
          </div>
          <h3>Henüz proje bulunmuyor</h3>
          <p>Yeni bir proje oluşturmak için üretim sürecini başlatın</p>
        </div>
      )}

      {/* No Results State */}
      {!loading && tumProjeler.length > 0 && filteredProjeler.length === 0 && (
        <div className="no-results">
          <div className="no-results-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
          <h3>Arama sonucu bulunamadı</h3>
          <p>Filtrelerinizi değiştirerek farklı sonuçlar arayabilirsiniz</p>
        </div>
      )}

      {/* Projects Grid */}
      {!loading && filteredProjeler.length > 0 && (
        <div className="projects-grid">
          {filteredProjeler.map((proje) => (
            <div key={proje.id} className={`project-card ${duzenlemeId === proje.id ? 'editing' : ''}`}>
              {duzenlemeId === proje.id ? (
                <div className="edit-form">
                  <div className="edit-form-header">
                    <h4>Proje Düzenle</h4>
                    <button 
                      className="close-edit-btn"
                      onClick={handleDuzenlemeIptal}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  
                  <div className="form-fields">
                    <div className="form-field">
                      <label className="form-label">Proje Adı</label>
                      <input
                        type="text"
                        value={duzenlemeFormu.projeAdi}
                        onChange={(e) => setDuzenlemeFormu(prev => ({ ...prev, projeAdi: e.target.value }))}
                        className="form-input"
                        placeholder="Proje adını girin"
                      />
                    </div>
                    
                    <div className="form-field">
                      <label className="form-label">Açıklama</label>
                      <textarea
                        value={duzenlemeFormu.aciklama}
                        onChange={(e) => setDuzenlemeFormu(prev => ({ ...prev, aciklama: e.target.value }))}
                        className="form-textarea"
                        placeholder="Proje açıklaması"
                        rows="3"
                      />
                    </div>
                    
                    <div className="form-field">
                      <label className="form-label">Durum</label>
                      <select
                        value={duzenlemeFormu.durum}
                        onChange={(e) => setDuzenlemeFormu(prev => ({ ...prev, durum: e.target.value }))}
                        className="form-select"
                      >
                        <option value="aktif">Aktif</option>
                        <option value="tamamlandi">Tamamlandı</option>
                        <option value="askida">Askıda</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button onClick={handleDuzenlemeKaydet} className="save-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17,21 17,13 7,13 7,21"></polyline>
                        <polyline points="7,3 7,8 15,8"></polyline>
                      </svg>
                      Kaydet
                    </button>
                    <button onClick={handleDuzenlemeIptal} className="cancel-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      İptal
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="project-header">
                    <div className="project-title-section">
                      <h3 className="project-title">{proje.projeAdi}</h3>
                      <div className="project-badges">
                        {getDurumBadge(proje.durum)}
                        {proje.kaynak === 'api' && (
                          <span >
                            
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {proje.aciklama && (
                    <div className="project-description">
                      <p>{proje.aciklama}</p>
                    </div>
                  )}

                  {/* API projeleri için maliyet bilgisi */}
                  {proje.kaynak === 'api' && proje.uretimVerileri?.toplamMaliyet && (
                    <div className="project-cost">
                      <div className="cost-info">
                        <span className="cost-label">Toplam Maliyet</span>
                        <span className="cost-value">
                          {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'EUR',
                            minimumFractionDigits: 4
                          }).format(proje.uretimVerileri.toplamMaliyet)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="project-actions">
                    <button 
                      onClick={() => handleProjeGuncelle(proje)}
                      className="action-btn primary"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Güncelle
                    </button>
                    {proje.kaynak === 'local' && (
                      <button 
                        onClick={() => handleDuzenlemeBaslat(proje)}
                        className="action-btn secondary"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Düzenle
                      </button>
                    )}
                    <button 
                      onClick={() => handleProjeSil(proje)}
                      className="action-btn danger"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                      Sil
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
      
      {/* Silme Onay Modal */}
      {deleteModal.isOpen && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ color: '#ef4444' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <h3 className="modal-title">Proje Sil</h3>
            </div>
            
            <div className="modal-body">
              <p className="modal-message">
                <strong>{deleteModal.proje?.projeAdi}</strong> projesini silmek istediğinizden emin misiniz?
                <br />
                <small style={{ color: '#6b7280', marginTop: '8px', display: 'block' }}>
                  Bu işlem geri alınamaz.
                </small>
              </p>
            </div>
            
            <div className="modal-footer" style={{ gap: '12px' }}>
              <button 
                onClick={cancelDelete} 
                className="modal-close-btn"
                style={{ 
                  borderColor: '#6b7280',
                  color: '#6b7280',
                  background: 'white'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                İptal
              </button>
              <button 
                onClick={confirmDelete} 
                className="modal-close-btn"
                style={{ 
                  borderColor: '#ef4444',
                  color: '#ef4444',
                  background: 'white'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}