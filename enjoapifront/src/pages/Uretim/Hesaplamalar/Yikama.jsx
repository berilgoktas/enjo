import { useEffect, useState } from 'react'
import { useUretim } from '../../../context/UretimContext.jsx'
import StepNav from '../../../components/StepNav.jsx'
import { useLocation, useNavigate } from 'react-router-dom'

export default function Yikama() {
  const location = useLocation()
  const navigate = useNavigate()
  const { shared, updateShared, getForm, updateForm, getResult, updateResult, getWizardSteps, getPrevRouteForPath, getNextRouteForPath, validateStep, getEnjeksiyonValues } = useUretim()
  const [form, setForm] = useState({
    // Kullanıcı giriş değerleri
    isciKatsayisi: '',
    isciSinifiKey: '',
    isciSayisi: '',
    // Admin giriş değerleri
    fullKapasiteOperasyonSuresiSn: '',
    idealKg: '',
    euroKuru: '',
    kwDegeri: '',
    elektrikUcreti: '',
    operatorUcreti: '',
    makineBedeliEuro: '',
    faydaliOmurYil: '',
    yillikBakimBedeli: '',
    deterjanSaatlikFiyatEuro: '',
    baskiToplamBrutAgirlik: '',
    kalipGozSayisi: ''
  })

  const [isAdminEditing, setIsAdminEditing] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const [adminError, setAdminError] = useState('')
  const [adminOriginal, setAdminOriginal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(getResult('yikama'))

  const ISCI_SINIFI_OPTIONS = [
    { key: 'cirak', label: 'Çırak', value: 0.8 },
    { key: 'operator', label: 'Operatör', value: 1 },
    { key: 'muhendis', label: 'Mühendis', value: 1.5 },
    { key: 'usta', label: 'Usta', value: 2 },
  ]

  function isciSinifiKeyFromValue(v) {
    const num = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
    const found = ISCI_SINIFI_OPTIONS.find(o => o.value === num)
    return found ? found.key : ''
  }

  function handleIsciSinifiChange(e) {
    const selKey = e.target.value
    const opt = ISCI_SINIFI_OPTIONS.find(o => o.key === selKey)
    setForm(prev => ({ ...prev, isciKatsayisi: opt ? opt.value : '', isciSinifiKey: selKey }))
    updateForm('yikama', { isciKatsayisi: opt ? opt.value : '', isciSinifiKey: selKey })
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    updateForm('yikama', { [name]: value })
  }

  useEffect(() => {
    const saved = getForm('yikama')
    if (Object.keys(saved).length) setForm(prev => ({ ...prev, ...saved }))

    // Enjeksiyon form'undan değerleri al
    const enjeksiyonValues = getEnjeksiyonValues()
    if (enjeksiyonValues.baskiToplamBrut) {
      setForm(prev => ({ ...prev, baskiToplamBrutAgirlik: enjeksiyonValues.baskiToplamBrut }))
    }
    if (enjeksiyonValues.kalipGozSayisi) {
      setForm(prev => ({ ...prev, kalipGozSayisi: enjeksiyonValues.kalipGozSayisi }))
    }
    if (enjeksiyonValues.elektrikUcreti) {
      setForm(prev => ({ ...prev, elektrikUcreti: enjeksiyonValues.elektrikUcreti }))
    }
    if (enjeksiyonValues.euroKuru) {
      setForm(prev => ({ ...prev, euroKuru: enjeksiyonValues.euroKuru }))
    }
    if (enjeksiyonValues.operatorUcreti) {
      setForm(prev => ({ ...prev, operatorUcreti: enjeksiyonValues.operatorUcreti }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getEnjeksiyonValues])

  useEffect(() => {
    let ignore = false
    async function loadAdminDefaults() {
      setAdminLoading(true)
      setAdminError('')
      try {
        const res = await fetch('/api/admin/yikama-varsayilan-degerler')
        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`Yıkama API Hatası (${res.status}): ${errorText || 'Sunucu hatası'}`)
        }
        const data = await res.json()
        console.log('Yıkama API Response:', data)
        if (!ignore) {
          setAdminOriginal(data)
          setForm(prev => ({ ...prev, ...data }))
        }
        // Euro kuru, elektrik ücreti ve operatör ücreti Enjeksiyon API'sinden çek
        try {
          const common = await fetch('/api/admin/enjeksiyon-varsayilan-degerler')
          if (common.ok) {
            const commonData = await common.json()
            if (!ignore) setForm(prev => ({
              ...prev,
              euroKuru: commonData?.euroKuru,
              operatorUcreti: commonData?.operatorUcreti,
              elektrikUcreti: commonData?.elektrikUcreti,
              // Shared state'ten gelen değerleri de uygula
              baskiToplamBrutAgirlik: shared.baskiToplamBrut || commonData?.baskiToplamBrutAgirlik,
              kalipGozSayisi: shared.kalipGozSayisi || commonData?.kalipGozSayisi
            }))
          }
        } catch (commonErr) {
          console.warn('Enjeksiyon API hatası:', commonErr)
        }
      } catch (err) {
        console.error('Yıkama API hatası:', err)
        if (!ignore) {
          setAdminError('Sistem ayarları yüklenemedi. Lütfen sayfayı yenileyin.')
          // API hatası durumunda varsayılan değerleri ayarla
          setForm(prev => ({
            ...prev,
            kwDegeri: 0,
            makineBedeliEuro: 0,
            faydaliOmurYil: 0,
            yillikBakimBedeli: 0
          }))
        }
      } finally {
        if (!ignore) setAdminLoading(false)
      }
    }
    loadAdminDefaults()
    return () => { ignore = true }
  }, [])

  function startAdminEdit() { setIsAdminEditing(true) }
  function cancelAdminEdit() {
    if (adminOriginal) setForm(prev => ({ ...prev, ...adminOriginal }))
    setIsAdminEditing(false)
  }
  function saveAdminEdit() {
    const toSave = {
      kwDegeri: form.kwDegeri,
      makineBedeliEuro: form.makineBedeliEuro,
      faydaliOmurYil: form.faydaliOmurYil,
      yillikBakimBedeli: form.yillikBakimBedeli,
      deterjanSaatlikFiyatEuro: form.deterjanSaatlikFiyatEuro,
      idealKg: form.idealKg,
      fullKapasiteOperasyonSuresiSn: form.fullKapasiteOperasyonSuresiSn
    }
    for (const k of Object.keys(toSave)) {
      const raw = toSave[k]
      if (raw !== '' && raw != null) {
        const normalized = typeof raw === 'string' ? raw.replace(',', '.').trim() : raw
        if (!isNaN(Number(normalized))) toSave[k] = Number(normalized)
      }
    }
    setAdminLoading(true)
    setAdminError('')
    fetch('/api/admin/yikama-varsayilan-degerler', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toSave)
    }).then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json() })
      .then(saved => { 
        setAdminOriginal(saved); 
        setForm(prev => ({ ...prev, ...saved })); 
        setIsAdminEditing(false);
        if (result) {
          setTimeout(() => { try { handleSubmit({ preventDefault: () => {} }) } catch {} }, 0)
        }
      })
      .catch(err => setAdminError('Sistem ayarları kaydedilemedi. Lütfen tekrar deneyin.'))
      .finally(() => setAdminLoading(false))
  }

  function toNumber(v) {
    if (typeof v === 'number') return v
    if (v == null) return NaN
    const s = String(v).replace(',', '.').trim()
    if (s === '') return NaN
    const n = Number(s)
    return isNaN(n) ? NaN : n
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    // Validasyon kontrolü - local form state'ini kontrol et
    const missing = []
    const requiredFields = ['isciKatsayisi', 'isciSayisi']
    const fieldLabels = {
      isciKatsayisi: 'İşçi Katsayısı',
      isciSayisi: 'Çalışan Sayısı'
    }
    
    for (const field of requiredFields) {
      const value = form[field]
      if (!value || value === '' || value === null || value === undefined) {
        missing.push(field)
      }
    }
    
    if (missing.length > 0) {
      const missingFieldsText = missing.map(field => fieldLabels[field] || field).join(', ')
      setError(`Eksik alanlar: ${missingFieldsText}`)
      setLoading(false)
      return
    }

    try {
      const base = { ...(adminOriginal||{}), ...form }

      // Enjeksiyon form'undan gelen değerleri al
      const enjeksiyonValues = getEnjeksiyonValues()
      if (enjeksiyonValues.elektrikUcreti) {
        base.elektrikUcreti = enjeksiyonValues.elektrikUcreti
      }
      if (enjeksiyonValues.operatorUcreti) {
        base.operatorUcreti = enjeksiyonValues.operatorUcreti
      }
      if (enjeksiyonValues.euroKuru) {
        base.euroKuru = enjeksiyonValues.euroKuru
      }
      if (enjeksiyonValues.baskiToplamBrut) {
        base.baskiToplamBrutAgirlik = enjeksiyonValues.baskiToplamBrut
      }
      if (enjeksiyonValues.kalipGozSayisi) {
        base.kalipGozSayisi = enjeksiyonValues.kalipGozSayisi
      }

      const numericKeys = [
        'euroKuru', 'kwDegeri', 'fullKapasiteOperasyonSuresiSn', 'idealKg', 'baskiToplamBrutAgirlik',
        'kalipGozSayisi', 'elektrikUcreti', 'operatorUcreti', 'isciKatsayisi', 'isciSayisi',
        'makineBedeliEuro', 'faydaliOmurYil', 'yillikBakimBedeli', 'deterjanSaatlikFiyatEuro'
      ]
      const payload = { ...base }
      const missing = []
      for (const key of numericKeys) {
        const n = toNumber(base[key])
        if (isNaN(n)) missing.push(key)
        else payload[key] = n
      }
      if (missing.length) throw new Error('Eksik veya hatalı sayısal alanlar: ' + missing.join(', '))

      // *** Var olan hesaplama ID'si varsa PUT, yoksa POST kullan ***
      const existingHesaplamaId = result?.hesaplamaId || null
      const isUpdate = existingHesaplamaId != null
      
      console.log('=== YIKAMA API İSTEĞİ ===')
      console.log('İşlem tipi:', isUpdate ? 'GÜNCELLEME (PUT)' : 'YENİ KAYIT (POST)')
      console.log('Hesaplama ID:', existingHesaplamaId)
      console.log('Payload:', payload)
      
      let response, data
      
      if (isUpdate) {
        // *** GÜNCELLEME: PUT isteği - Obje döner { toplamMaliyet, birimBrutAgirlik } ***
        console.log(`PUT isteği gönderiliyor: /api/hesaplama/yikama/${existingHesaplamaId}`)
        response = await fetch(`/api/hesaplama/yikama/${existingHesaplamaId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('API Güncelleme Hatası:', response.status, errorText)
          throw new Error(`Güncelleme başarısız. Lütfen tekrar deneyin.`)
        }

        data = await response.json()
        console.log('PUT yanıtı (obje):', data)
        
      } else {
        // *** YENİ KAYIT: POST isteği - Obje döner { id, toplamMaliyet, birimBrutAgirlik } ***
        console.log('POST isteği gönderiliyor: /api/hesaplama/yikama')
        response = await fetch('/api/hesaplama/yikama', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('API Hesaplama Hatası:', response.status, errorText)
          throw new Error(`Hesaplama servisi yanıt vermiyor. Lütfen tekrar deneyin.`)
        }
        
        data = await response.json()
        console.log('POST yanıtı (obje):', data)
      }
      
      // Backend'den { id, toplamMaliyet, birimBrutAgirlik } gelir
      let maliyet, hesaplamaId
      if (typeof data === 'object' && data !== null) {
        maliyet = typeof data.toplamMaliyet === 'number' ? data.toplamMaliyet : parseFloat(data.toplamMaliyet || 0)
        hesaplamaId = data.id || existingHesaplamaId || null
      } else {
        maliyet = typeof data === 'number' ? data : parseFloat(data || 0)
        hesaplamaId = existingHesaplamaId || null
      }
      console.log('İşlenmiş maliyet:', maliyet, 'ID:', hesaplamaId)
      
      const hesaplamaResult = {
        toplamMaliyet: maliyet,
        hesaplamaId: hesaplamaId, // Kaydetme sırasında kullanılacak
        malzemeMaliyeti: 0, // API'den detay gelmiyor
        iscilikMaliyeti: 0,
        elektrikMaliyeti: 0,
        amortismanMaliyeti: 0,
        makineBakimMaliyeti: 0,
        kalipBakimMaliyeti: 0,
        kalipMaliyeti: 0,
        hammaddeMiktari: 0,
        uretimSuresi: 0,
        deterjanMaliyeti: 0
      }
      
      setResult(hesaplamaResult)
      updateResult('yikama', hesaplamaResult)
      
      // Tüm payload verilerini Context'e kaydet (satış kaydı için gerekli)
      updateForm('yikama', payload)
    } catch (err) {
      setError(err.message || 'Hesaplama sırasında bir sorun oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    const cleared = {
      isciKatsayisi: '',
      isciSinifiKey: '',
      isciSayisi: ''
    }
    setForm(prev => ({ ...prev, ...cleared }))
    updateForm('yikama', cleared)
    setResult(null)
    updateResult('yikama', null)
    setError('')
  }

  return (
    <div className="calculation-container">
      {/* Modern Header */}
      <div className="calculation-header">
        <div className="calculation-header-content">
          <div className="calculation-title-section">
            <h1 className="calculation-title">Yıkama Hesaplaması</h1>
            <p className="calculation-subtitle">Adım {(typeof getWizardSteps==='function' ? (getWizardSteps().findIndex(s => s.key==='yikama') + 1) : 3)} / {(typeof getWizardSteps==='function' ? getWizardSteps().length : 1)}</p>
          </div>
          <div className="calculation-stats">
            <div className="stat-item">
              <span className="stat-number">{(typeof getWizardSteps==='function' ? (getWizardSteps().findIndex(s => s.key==='yikama') + 1) : 3)}</span>
              <span className="stat-label">Adım</span>
            </div>
        
          </div>
        </div>
      </div>

      {/* Modern Form Layout */}
      <div className="calculation-form-container">
        <form id="yikamaForm" onSubmit={handleSubmit} className="calculation-form">
          {/* Kullanıcı Giriş Değerleri */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18m-9-9v18m-4-4l8-8m0 0l-8-8"></path>
                </svg>
              </div>
              <div className="form-section-content">
                <h2 className="form-section-title">Kullanıcı Giriş Değerleri</h2>
                <p className="form-section-description">Yıkama parametrelerini girin</p>
              </div>
            <div className="form-section-actions">
              <button
                type="button"
                className="admin-cancel-btn"
                onClick={handleClear}
              >
                Temizle
              </button>
            </div>
            </div>
            <div className="form-section-body">
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Çalışan Grubu</label>
                  <select 
                    className="form-input" 
                    value={form.isciSinifiKey || isciSinifiKeyFromValue(form.isciKatsayisi)} 
                    onChange={handleIsciSinifiChange}
                  >
                    <option value="">Seçiniz</option>
                    {ISCI_SINIFI_OPTIONS.map(o => (<option key={o.key} value={o.key}>{o.label}</option>))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Çalışan Sayısı</label>
                  <input 
                    name="isciSayisi" 
                    className="form-input" 
                    value={form.isciSayisi ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: 1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Admin Giriş Değerleri */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="9" cy="9" r="2"></circle>
                  <path d="M21 15.5a2.5 2.5 0 0 1-2.5 2.5H5.5a2.5 2.5 0 0 1-2.5-2.5V5.5a2.5 2.5 0 0 1 2.5-2.5h13a2.5 2.5 0 0 1 2.5 2.5v10z"></path>
                </svg>
              </div>
              <div className="form-section-content">
                <h2 className="form-section-title">Admin Giriş Değerleri</h2>
                <p className="form-section-description">Sistem parametreleri ve maliyet bilgileri</p>
              </div>
              <div className="form-section-actions">
                <button 
                  type="button" 
                  className="admin-edit-btn"
                  onClick={isAdminEditing ? saveAdminEdit : startAdminEdit} 
                  disabled={adminLoading}
                >
                  {isAdminEditing ? 'Kaydet' : 'Güncelle'}
                </button>
                {isAdminEditing && (
                  <button 
                    type="button" 
                    className="admin-cancel-btn"
                    onClick={cancelAdminEdit} 
                    disabled={adminLoading}
                  >
                    Vazgeç
                  </button>
                )}
              </div>
            </div>
            <div className="form-section-body">
              {adminLoading && (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <span>Yükleniyor...</span>
                </div>
              )}
              {adminError && (
                <div className="error-state">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  <span>Hata: {adminError}</span>
                </div>
              )}
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Full Kapasite Operasyon Süresi (sn)</label>
                  <input 
                    name="fullKapasiteOperasyonSuresiSn" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.fullKapasiteOperasyonSuresiSn ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 240"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">İdeal Kg</label>
                  <input 
                    name="idealKg" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.idealKg ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 60"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Euro Kuru</label>
                  <input 
                    name="euroKuru" 
                    className="form-input disabled" 
                    value={shared.euroKuru || form.euroKuru || ''} 
                    disabled 
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">kW Değeri</label>
                  <input 
                    name="kwDegeri" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.kwDegeri ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 18"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Makine Bedeli (€)</label>
                  <input 
                    name="makineBedeliEuro" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.makineBedeliEuro ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 8000"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Faydalı Ömür (yıl)</label>
                  <input 
                    name="faydaliOmurYil" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.faydaliOmurYil ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 10"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Yıllık Bakım Bedeli</label>
                  <input 
                    name="yillikBakimBedeli" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.yillikBakimBedeli ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 150"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Deterjan Saatlik Fiyat (€)</label>
                  <input 
                    name="deterjanSaatlikFiyatEuro" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.deterjanSaatlikFiyatEuro ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 0.5"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sonuç Bölümü */}
          <div className="result-section">
            <div className="result-card">
              <div className="result-header">
                <div className="result-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10,9 9,9 8,9"></polyline>
                  </svg>
                </div>
                <h3 className="result-title">Yıkama Maliyeti</h3>
              </div>
              <div className="result-body">
                {loading && (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <span>Hesaplanıyor...</span>
                  </div>
                )}
                {error && (
                  <div className="error-state">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <span>Hata: {error}</span>
                  </div>
                )}
                {result && (
                  <div className="result-content">
                    <div className="result-value-large">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 4 }).format(result.toplamMaliyet || 0)}
                    </div>
                    <div className="result-subtitle">Detaylı analiz için sonuç sayfasını kontrol edin</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Modern Action Buttons */}
        <div className="calculation-actions">
          <button 
            type="button" 
            className="action-btn secondary"
            onClick={() => { const prev = (typeof getPrevRouteForPath==='function' ? getPrevRouteForPath(location.pathname) : '/uretim/asama-secim'); if (prev) navigate(prev) }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"></path>
            </svg>
            <span>Önceki</span>
          </button>
          <button 
            type="submit" 
            form="yikamaForm" 
            className="action-btn primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="loading-spinner-small"></div>
                <span>Hesaplanıyor...</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11H1v2h8v8h2v-8h8v-2h-8V3H9v8z"></path>
                </svg>
                <span>Hesapla</span>
              </>
            )}
          </button>
          <button 
            type="button" 
            className="action-btn secondary"
            onClick={() => { const next = (typeof getNextRouteForPath==='function' ? getNextRouteForPath(location.pathname) : null); if (next) navigate(next) }}
          >
            <span>Sonraki</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Modern Step Navigation */}
      <div className="step-navigation-container">
        <StepNav />
      </div>
    </div>
  )
}


