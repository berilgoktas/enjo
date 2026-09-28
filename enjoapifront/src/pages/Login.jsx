import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal.jsx'

export default function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    kullaniciAdi: '',
    sifre: ''
  })
  const [loading, setLoading] = useState(false)
  const [hakGorunur, setHakGorunur] = useState(false)
  const [kalanDeneme, setKalanDeneme] = useState(null)
  const [toplamDeneme, setToplamDeneme] = useState(5)
  const [kilitSaniye, setKilitSaniye] = useState(0)
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' })

  const kilitli = hakGorunur && kalanDeneme === 0 && kilitSaniye > 0

  useEffect(() => {
    if (kilitSaniye <= 0) return undefined
    const id = setInterval(() => {
      setKilitSaniye(prev => {
        if (prev <= 1) {
          setHakGorunur(false)
          setKalanDeneme(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [kilitSaniye > 0])

  const formatSure = (sn) => {
    const m = Math.floor(sn / 60)
    const s = sn % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const applyDeneme = (data, yanlisDeneme) => {
    if (!yanlisDeneme || !data) return
    if (typeof data.kalanDeneme === 'number') {
      setKalanDeneme(data.kalanDeneme)
      setHakGorunur(true)
    }
    if (typeof data.toplamDeneme === 'number') setToplamDeneme(data.toplamDeneme)
    if (typeof data.kilitlemeKalanSaniye === 'number' && data.kalanDeneme === 0) {
      setKilitSaniye(data.kilitlemeKalanSaniye)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    
    if (!formData.kullaniciAdi.trim() || !formData.sifre.trim()) {
      setModal({
        isOpen: true,
        title: 'Uyarı',
        message: 'Lütfen kullanıcı adı ve şifre girin',
        type: 'warning'
      })
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/giris/giris', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        const result = await response.json()
        
        const userData = {
          kullaniciAdi: formData.kullaniciAdi,
          rol: result.rol || 'user',
          id: result.id
        }
        
        localStorage.setItem('currentUser', JSON.stringify(userData))
        localStorage.setItem('token', result.token || '')
        localStorage.setItem('kullaniciAdi', formData.kullaniciAdi)
        localStorage.setItem('rol', result.rol || 'user')
        
        setModal({
          isOpen: true,
          title: 'Başarılı',
          message: 'Giriş başarılı! Yönlendiriliyorsunuz...',
          type: 'success'
        })
        
        setTimeout(() => {
          navigate('/satis')
        }, 1500)
      } else {
        let errorMessage = 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.'
        
        try {
          const errorResult = await response.json()
          applyDeneme(errorResult, true)
          errorMessage = errorResult.mesaj || errorMessage
          if (typeof errorResult.kalanDeneme === 'number' && errorResult.kalanDeneme > 0) {
            errorMessage = `${errorMessage} Kalan deneme hakkı: ${errorResult.kalanDeneme}/${errorResult.toplamDeneme || toplamDeneme}.`
          }
        } catch (parseError) {
          if (response.status === 401) {
            errorMessage = 'Kullanıcı adı veya şifre hatalı.'
          } else if (response.status === 500) {
            errorMessage = 'Sistem geçici olarak kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.'
          } else if (response.status === 404) {
            errorMessage = 'Giriş servisi bulunamadı. Lütfen sistem yöneticisi ile iletişime geçin.'
          }
        }
        
        setModal({
          isOpen: true,
          title: 'Giriş Hatası',
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


  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>
      
      <div className="login-content">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <div className="logo-icon">
                <img src="/ddd.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }} />
              </div>
              <h1 className="login-title">ENJEKSİYON</h1>
              
            </div>
          </div>
          
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Kullanıcı Adı</label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <input
                  type="text"
                  name="kullaniciAdi"
                  value={formData.kullaniciAdi}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Kullanıcı adınızı girin"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Şifre</label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <circle cx="12" cy="16" r="1"></circle>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <input
                  type="password"
                  name="sifre"
                  value={formData.sifre}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Şifrenizi girin"
                  disabled={loading}
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              className="login-button"
              disabled={loading || kilitli}
            >
              {loading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Giriş Yapılıyor...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                    <polyline points="10,17 15,12 10,7"></polyline>
                    <line x1="15" y1="12" x2="3" y2="12"></line>
                  </svg>
                  Giriş Yap
                </>
              )}
            </button>
            {hakGorunur && (
            <p className={`login-attempts ${kilitli ? 'exhausted' : ''}`}>
              {kilitli
                ? `Kilitlendi. Tekrar deneyin: ${formatSure(kilitSaniye)}`
                : `Kalan deneme hakkı: ${kalanDeneme} / ${toplamDeneme}`}
            </p>
            )}
            
          </form>
          
          <div className="login-footer">
            <p className="footer-text">
            Enjeksiyon Süreci Maliyet Analiz Sistemi

            </p>
          </div>
        </div>
      </div>
      
      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  )
}
