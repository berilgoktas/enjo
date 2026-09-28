import { useState, useEffect } from 'react'
import Modal from '../components/Modal.jsx'

export default function KullaniciYonetimi() {
  const [kullanicilar, setKullanicilar] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' })
  const [editModal, setEditModal] = useState({ isOpen: false, kullanici: null })
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, kullanici: null })
  const [formData, setFormData] = useState({
    kullaniciAdi: '',
    sifre: '',
    rol: 'user'
  })

  // Kullanıcıları yükle
  const kullanicilariYukle = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/giris/kullanici', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('API\'den gelen kullanıcı verileri:', data)
        setKullanicilar(data)
      } else {
        setModal({
          isOpen: true,
          title: 'Hata',
          message: 'Kullanıcı listesi yüklenemedi. Lütfen sayfayı yenileyin.',
          type: 'error'
        })
      }
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Bağlantı Hatası',
        message: 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
        type: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  // Kullanıcı ekle
  const kullaniciEkle = async () => {
    if (!formData.kullaniciAdi.trim() || !formData.sifre.trim()) {
      setModal({
        isOpen: true,
        title: 'Uyarı',
        message: 'Lütfen tüm alanları doldurun.',
        type: 'warning'
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/giris/kullanici', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setModal({
          isOpen: true,
          title: 'Başarılı',
          message: 'Kullanıcı başarıyla eklendi!',
          type: 'success'
        })
        setFormData({ kullaniciAdi: '', sifre: '', rol: 'user' })
        kullanicilariYukle()
      } else {
        const error = await response.json()
        setModal({
          isOpen: true,
          title: 'Hata',
          message: error.mesaj || 'Kullanıcı eklenirken bir sorun oluştu. Lütfen tekrar deneyin.',
          type: 'error'
        })
      }
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Bağlantı Hatası',
        message: 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
        type: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  // Kullanıcı güncelle
  const kullaniciGuncelle = async () => {
    if (!editModal.kullanici || !editModal.kullanici.id) {
      setModal({
        isOpen: true,
        title: 'Hata',
        message: 'Kullanıcı ID bulunamadı.',
        type: 'error'
      })
      return
    }

    // Boş şifre alanını filtrele
    const updateData = {
      id: editModal.kullanici.id,
      kullaniciAdi: formData.kullaniciAdi,
      rol: formData.rol
    }
    
    // Şifre alanı doluysa ekle
    if (formData.sifre && formData.sifre.trim() !== '') {
      updateData.sifre = formData.sifre
    }

    setLoading(true)
    try {
      console.log('Güncellenecek kullanıcı ID:', editModal.kullanici.id)
      console.log('Güncellenecek veri:', updateData)
      const response = await fetch(`/api/giris/kullanici/${editModal.kullanici.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)
      
      if (response.ok) {
        const responseData = await response.json()
        console.log('Güncelleme başarılı, response:', responseData)
        setModal({
          isOpen: true,
          title: 'Başarılı',
          message: 'Kullanıcı başarıyla güncellendi!',
          type: 'success'
        })
        setEditModal({ isOpen: false, kullanici: null })
        setFormData({ kullaniciAdi: '', sifre: '', rol: 'user' })
        kullanicilariYukle()
      } else {
        let errorMessage = 'Kullanıcı güncellenemedi.'
        try {
          const error = await response.json()
          console.log('API error response:', error)
          errorMessage = error.mesaj || error.message || errorMessage
        } catch (e) {
          const errorText = await response.text()
          console.log('API error text:', errorText)
          errorMessage = `Sistem hatası (${response.status}). Lütfen tekrar deneyin.`
        }
        
        setModal({
          isOpen: true,
          title: 'Hata',
          message: errorMessage,
          type: 'error'
        })
      }
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Bağlantı Hatası',
        message: 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
        type: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  // Kullanıcı sil
  const kullaniciSil = async () => {
    if (!deleteModal.kullanici) return

    setLoading(true)
    try {
      const response = await fetch(`/api/giris/kullanici/${deleteModal.kullanici.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setModal({
          isOpen: true,
          title: 'Başarılı',
          message: 'Kullanıcı başarıyla silindi!',
          type: 'success'
        })
        setDeleteModal({ isOpen: false, kullanici: null })
        kullanicilariYukle()
      } else {
        setModal({
          isOpen: true,
          title: 'Hata',
          message: 'Kullanıcı silinirken bir sorun oluştu. Lütfen tekrar deneyin.',
          type: 'error'
        })
      }
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Bağlantı Hatası',
        message: 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
        type: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  // Düzenleme modal'ını aç
  const duzenleAc = (kullanici) => {
    console.log('Düzenleme için seçilen kullanıcı:', kullanici)
    
    if (!kullanici || !kullanici.id) {
      setModal({
        isOpen: true,
        title: 'Hata',
        message: 'Kullanıcı verisi eksik.',
        type: 'error'
      })
      return
    }
    
    setEditModal({ isOpen: true, kullanici })
    setFormData({
      kullaniciAdi: kullanici.kullaniciAdi || '',
      sifre: '',
      rol: kullanici.rol || 'user'
    })
  }

  // Silme modal'ını aç
  const silAc = (kullanici) => {
    setDeleteModal({ isOpen: true, kullanici })
  }

  useEffect(() => {
    kullanicilariYukle()
  }, [])

  return (
    <div className="kullanici-yonetimi-container">
      <div className="kullanici-yonetimi-header">
        <div className="kullanici-yonetimi-header-content">
          <div className="kullanici-yonetimi-title-section">
            <h1 className="kullanici-yonetimi-title">Kullanıcı Yönetimi</h1>
            <p className="kullanici-yonetimi-subtitle">Sistem kullanıcılarını yönetin</p>
          </div>
          <div className="kullanici-yonetimi-stats">
            <div className="stat-item">
              <span className="stat-number">{kullanicilar.length}</span>
              <span className="stat-label">Toplam Kullanıcı</span>
            </div>
          
            <div className="stat-item highlight">
              <span className="stat-number">{kullanicilar.filter(k => k.rol === 'admin').length}</span>
              <span className="stat-label">Admin</span>
            </div>
          </div>
        </div>
      </div>

      <div className="kullanici-yonetimi-content">
        {/* Yeni Kullanıcı Ekleme Formu */}
        <div className="form-section">
          <div className="form-header">
            <h3 className="form-title">Yeni Kullanıcı Ekle</h3>
            <p className="form-description">Sisteme yeni kullanıcı ekleyin</p>
          </div>
          
          <form className="form-content" onSubmit={(e) => { e.preventDefault(); kullaniciEkle(); }}>
            <div className="form-group">
              <label className="form-label">Kullanıcı Adı</label>
              <input
                type="text"
                value={formData.kullaniciAdi}
                onChange={(e) => setFormData(prev => ({ ...prev, kullaniciAdi: e.target.value }))}
                className="form-input"
                placeholder="Kullanıcı adı girin"
                disabled={loading}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Şifre</label>
              <input
                type="password"
                value={formData.sifre}
                onChange={(e) => setFormData(prev => ({ ...prev, sifre: e.target.value }))}
                className="form-input"
                placeholder="Şifre girin"
                disabled={loading}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Rol</label>
              <select
                value={formData.rol}
                onChange={(e) => setFormData(prev => ({ ...prev, rol: e.target.value }))}
                className="form-input"
                disabled={loading}
              >
                <option value="user">Kullanıcı</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            <button 
              type="submit"
              className="add-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Ekleniyor...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Kullanıcı Ekle
                </>
              )}
            </button>
          </form>
        </div>

        {/* Kullanıcı Listesi */}
        <div className="kullanici-listesi">
          <div className="list-header">
            <h3 className="list-title">Mevcut Kullanıcılar</h3>
            <p className="list-subtitle">{kullanicilar.length} kullanıcı bulundu</p>
          </div>
          
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Kullanıcılar yükleniyor...</p>
            </div>
          ) : (
            <div className="kullanici-grid">
              {kullanicilar.map((kullanici) => (
                <div key={kullanici.id} className="kullanici-card">
                  <div className="kullanici-info">
                    <div className="kullanici-avatar">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                    <div className="kullanici-details">
                      <h4 className="kullanici-adi">{kullanici.kullaniciAdi}</h4>
                      <p className="kullanici-id">ID: {kullanici.id}</p>
                      <div className="kullanici-rol">
                        <span className={`rol-badge ${kullanici.rol === 'admin' ? 'admin' : 'user'}`}>
                          {kullanici.rol === 'admin' ? 'Admin' : 'Kullanıcı'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="kullanici-actions">
                    <button 
                      onClick={() => duzenleAc(kullanici)}
                      className="action-button edit-button"
                      disabled={loading}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Düzenle
                    </button>
                    
                    <button 
                      onClick={() => silAc(kullanici)}
                      className="action-button delete-button"
                      disabled={loading}
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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal'lar */}
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* Düzenleme Modal */}
      {editModal.isOpen && (
        <div className="modal-overlay" onClick={() => setEditModal({ isOpen: false, kullanici: null })}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ color: '#3b82f6' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </div>
              <h3 className="modal-title">Kullanıcı Düzenle</h3>
            </div>
            
            <form id="edit-form" className="modal-body" onSubmit={(e) => { e.preventDefault(); kullaniciGuncelle(); }}>
              <div className="form-group">
                <label className="form-label">Kullanıcı Adı</label>
                <input
                  type="text"
                  value={formData.kullaniciAdi}
                  onChange={(e) => setFormData(prev => ({ ...prev, kullaniciAdi: e.target.value }))}
                  className="form-input"
                  placeholder="Kullanıcı adı girin"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Yeni Şifre</label>
                <input
                  type="password"
                  value={formData.sifre}
                  onChange={(e) => setFormData(prev => ({ ...prev, sifre: e.target.value }))}
                  className="form-input"
                  placeholder="Yeni şifre girin (boş bırakırsanız değişmez)"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Rol</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData(prev => ({ ...prev, rol: e.target.value }))}
                  className="form-input"
                >
                  <option value="user">Kullanıcı</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </form>
            
            <div className="modal-footer" style={{ gap: '12px' }}>
              <button 
                type="button"
                onClick={() => setEditModal({ isOpen: false, kullanici: null })}
                className="modal-close-btn"
                style={{ 
                  borderColor: '#6b7280',
                  color: '#6b7280',
                  background: 'white'
                }}
              >
                İptal
              </button>
              <button 
                type="submit"
                form="edit-form"
                className="modal-close-btn"
                style={{ 
                  borderColor: '#3b82f6',
                  color: '#3b82f6',
                  background: 'white'
                }}
              >
                Güncelle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Silme Onay Modal */}
      {deleteModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ isOpen: false, kullanici: null })}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ color: '#ef4444' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <h3 className="modal-title">Kullanıcı Sil</h3>
            </div>
            
            <div className="modal-body">
              <p className="modal-message">
                <strong>{deleteModal.kullanici?.kullaniciAdi}</strong> kullanıcısını silmek istediğinizden emin misiniz?
                <br />
                <small style={{ color: '#6b7280', marginTop: '8px', display: 'block' }}>
                  Bu işlem geri alınamaz.
                </small>
              </p>
            </div>
            
            <div className="modal-footer" style={{ gap: '12px' }}>
              <button 
                onClick={() => setDeleteModal({ isOpen: false, kullanici: null })}
                className="modal-close-btn"
                style={{ 
                  borderColor: '#6b7280',
                  color: '#6b7280',
                  background: 'white'
                }}
              >
                İptal
              </button>
              <button 
                onClick={kullaniciSil}
                className="modal-close-btn"
                style={{ 
                  borderColor: '#ef4444',
                  color: '#ef4444',
                  background: 'white'
                }}
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
