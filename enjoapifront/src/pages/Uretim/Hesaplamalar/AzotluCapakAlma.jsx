import { useEffect, useState } from 'react'
import { useUretim } from '../../../context/UretimContext.jsx'
import StepNav from '../../../components/StepNav.jsx'
import { useLocation, useNavigate } from 'react-router-dom'

export default function AzotluCapakAlma() {
  const navigate = useNavigate()
  const location = useLocation()
  const { shared, updateShared, getForm, updateForm, getResult, updateResult, getWizardSteps, getPrevRouteForPath, getNextRouteForPath, getEnjeksiyonValues } = useUretim()
  const [form, setForm] = useState({
    // Kullanıcı giriş değerleri
    tezgahSogumaSuresi: '',
    makineIslemSuresi: '',
    yuklemeBosaltmaSuresi: '',
    birimNetAgirlikGram: '',
    islemGorenUrunAgirligiToplamGram: '',
    isciKatsayisi: '',
    isciSinifiKey: '',
    isciSayisi: '',
    operatorUcreti: '',
    elektrikUcreti: '',
    baskiCevrimSuresi: '',
    euroKuru: '',
    kalipGozSayisi: '',
    // Admin giriş değerleri
    kwDegeri: '',
    yillikBakimBedeli: '',
    islemBasinaHarcananAzotGram: '',
    tasKgSaniye: '',
    tas1KgFiyatiEuro: '',
    azotKgFiyatiTl: '',
    makineBedeliEuro: '',
    faydaliOmurYil: ''
  })

  const [isAdminEditing, setIsAdminEditing] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const [adminError, setAdminError] = useState('')
  const [adminOriginal, setAdminOriginal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(getResult('azotlu'))

  const ADMIN_KEYS = [
    // Azotlu'ya özel alanlar (edit edilebilir)
    'yillikBakimBedeli','islemBasinaHarcananAzotGram','tasKgSaniye','tas1KgFiyatiEuro','azotKgFiyatiTl',
    // Backend'in beklediği ortak alanlar (enjeksiyondan gelir, gönderilir ama edit edilemez)
    'kwDegeri','makineBedeliEuro','faydaliOmurYil'
  ]

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
    updateForm('azotlu', { isciKatsayisi: opt ? opt.value : '', isciSinifiKey: selKey })
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    updateForm('azotlu', { [name]: value })
    
    // İşlem gören ürün ağırlığını shared state'e de kaydet
    if (name === 'islemGorenUrunAgirligiToplamGram') {
      updateShared({ islemGorenUrunAgirligi: value })
    }
  }

  useEffect(() => {
    const saved = getForm('azotlu')
    if (Object.keys(saved).length) setForm(prev => ({ ...prev, ...saved }))
    
    // Enjeksiyon form'undan değerleri al
    const enjeksiyonValues = getEnjeksiyonValues()
    if (enjeksiyonValues.kalipGozSayisi) {
      setForm(prev => ({ ...prev, kalipGozSayisi: enjeksiyonValues.kalipGozSayisi }))
    }
    if (enjeksiyonValues.baskiCevrimSuresi) {
      setForm(prev => ({ ...prev, baskiCevrimSuresi: enjeksiyonValues.baskiCevrimSuresi }))
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
    
    // Shared state'ten değerleri al
    if (shared.islemGorenUrunAgirligi) {
      setForm(prev => ({ ...prev, islemGorenUrunAgirligiToplamGram: shared.islemGorenUrunAgirligi }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getEnjeksiyonValues])

  useEffect(() => {
    let ignore = false
    async function loadAdminDefaults() {
      setAdminLoading(true)
      setAdminError('')
      try {
        const res = await fetch('/api/admin/azotlu-capak-alma-varsayilan-degerler')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!ignore) {
          setAdminOriginal(data)
          setForm(prev => ({ ...prev, ...data }))
        }
        // Euro kuru kullanıcıdan alınmayacak; global admin (enjeksiyon) varsayılanından çek
        try {
          const common = await fetch('/api/admin/enjeksiyon-varsayilan-degerler')
          if (common.ok) {
            const commonData = await common.json()
            if (!ignore) setForm(prev => ({
              ...prev,
              euroKuru: commonData?.euroKuru,
              operatorUcreti: commonData?.operatorUcreti,
              elektrikUcreti: commonData?.elektrikUcreti,
              // kwDegeri ve makineBedeliEuro azotlu tarafından yönetilir; enjeksiyondan ALMA
              faydaliOmurYil: commonData?.faydaliOmurYil,
              baskiCevrimSuresi: commonData?.baskiCevrimSuresi,
              kalipGozSayisi: commonData?.kalipGozSayisi
            }))
          }
        } catch {}
      } catch (err) {
        if (!ignore) setAdminError('Sistem ayarları yüklenemedi. Lütfen sayfayı yenileyin.')
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
    const toSave = ADMIN_KEYS.reduce((acc, key) => { acc[key] = form[key]; return acc }, {})
    for (const k of Object.keys(toSave)) {
      const raw = toSave[k]
      if (raw !== '' && raw != null) {
        const normalized = typeof raw === 'string' ? raw.replace(',', '.').trim() : raw
        if (!isNaN(Number(normalized))) toSave[k] = Number(normalized)
      }
    }
    setAdminLoading(true)
    setAdminError('')
    fetch('/api/admin/azotlu-capak-alma-varsayilan-degerler', {
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
    const requiredFields = ['kalipGozSayisi', 'isciKatsayisi', 'isciSayisi', 'yillikBakimBedeli', 'islemBasinaHarcananAzotGram', 'tasKgSaniye', 'tas1KgFiyatiEuro', 'azotKgFiyatiTl']
    const fieldLabels = {
      kalipGozSayisi: 'Kalıp Göz Sayısı',
      isciKatsayisi: 'İşçi Katsayısı',
      isciSayisi: 'Çalışan Sayısı',
      yillikBakimBedeli: 'Yıllık Bakım Bedeli',
      islemBasinaHarcananAzotGram: 'İşlem Başına Harcanan Azot (gr)',
      tasKgSaniye: 'Taş Kg/Saniye',
      tas1KgFiyatiEuro: 'Taş 1 Kg Fiyatı (€)',
      azotKgFiyatiTl: 'Azot Kg Fiyatı (TL)'
    }
    
    for (const field of requiredFields) {
      const value = form[field]
      const isEmpty = value === '' || value === null || value === undefined
      if (isEmpty) {
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
      let base = { ...(adminOriginal||{}), ...form }
      // Enjeksiyon form'undan gelen değerleri al
      const enjeksiyonValues = getEnjeksiyonValues()
      if (enjeksiyonValues.baskiCevrimSuresi) {
        base.baskiCevrimSuresi = enjeksiyonValues.baskiCevrimSuresi
      }
      if (enjeksiyonValues.kalipGozSayisi) {
        base.kalipGozSayisi = enjeksiyonValues.kalipGozSayisi
      }
      if (enjeksiyonValues.elektrikUcreti) {
        base.elektrikUcreti = enjeksiyonValues.elektrikUcreti
      }
      if (enjeksiyonValues.euroKuru) {
        base.euroKuru = enjeksiyonValues.euroKuru
      }
      if (enjeksiyonValues.operatorUcreti) {
        base.operatorUcreti = enjeksiyonValues.operatorUcreti
      }
      // API alan adı uyumu: backend 'birimNetAgirlik' bekliyor, form'da 'birimNetAgirlikGram' tutuluyor
      if (base.birimNetAgirlik == null && base.birimNetAgirlikGram != null) {
        base.birimNetAgirlik = base.birimNetAgirlikGram
      }
      const numericKeys = [
        'azotKgFiyatiTl','islemBasinaHarcananAzotGram','tezgahSogumaSuresi','makineIslemSuresi','yuklemeBosaltmaSuresi','birimNetAgirlik','islemGorenUrunAgirligiToplamGram','isciKatsayisi','isciSayisi','operatorUcreti','elektrikUcreti','kwDegeri','faydaliOmurYil','makineBedeliEuro','yillikBakimBedeli','baskiCevrimSuresi','euroKuru','kalipGozSayisi','tasKgSaniye','tas1KgFiyatiEuro'
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
      
      console.log('=== AZOTLU ÇAPAK ALMA API İSTEĞİ ===')
      console.log('İşlem tipi:', isUpdate ? 'GÜNCELLEME (PUT)' : 'YENİ KAYIT (POST)')
      console.log('Hesaplama ID:', existingHesaplamaId)
      console.log('Payload:', payload)
      
      let response, data
      
      if (isUpdate) {
        // *** GÜNCELLEME: PUT isteği - Obje döner { toplamMaliyet, birimBrutAgirlik } ***
        console.log(`PUT isteği gönderiliyor: /api/hesaplama/azotlucapakalma/${existingHesaplamaId}`)
        response = await fetch(`/api/hesaplama/azotlucapakalma/${existingHesaplamaId}`, {
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
        console.log('POST isteği gönderiliyor: /api/hesaplama/azotlucapakalma')
        response = await fetch('/api/hesaplama/azotlucapakalma', {
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
        azotMiktari: 0
      }
      
      setResult(hesaplamaResult)
      updateResult('azotlu', hesaplamaResult)
      
      // Tüm payload verilerini Context'e kaydet (satış kaydı için gerekli)
      updateForm('azotlu', payload)
    } catch (err) {
      setError(err.message || 'Hesaplama sırasında bir sorun oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    const cleared = {
      tezgahSogumaSuresi: '',
      makineIslemSuresi: '',
      yuklemeBosaltmaSuresi: '',
      birimNetAgirlikGram: '',
      islemGorenUrunAgirligiToplamGram: '',
      isciKatsayisi: '',
      isciSinifiKey: '',
      isciSayisi: ''
    }
    setForm(prev => ({ ...prev, ...cleared }))
    updateForm('azotlu', cleared)
    // Shared state'te de temizle ki yeniden dolmasın
    updateShared({ islemGorenUrunAgirligi: '' })
    setResult(null)
    updateResult('azotlu', null)
    setError('')
  }

  return (
    <div className="calculation-container">
      {/* Modern Header */}
      <div className="calculation-header">
        <div className="calculation-header-content">
          <div className="calculation-title-section">
            <h1 className="calculation-title">Azotlu Çapak Alma Hesaplaması</h1>
            <p className="calculation-subtitle">Adım {(typeof getWizardSteps==='function' ? (getWizardSteps().findIndex(s => s.key==='azotlu') + 1) : 3)} / {(typeof getWizardSteps==='function' ? getWizardSteps().length : 1)}</p>
          </div>
          <div className="calculation-stats">
            <div className="stat-item">
              <span className="stat-number">{(typeof getWizardSteps==='function' ? (getWizardSteps().findIndex(s => s.key==='azotlu') + 1) : 3)}</span>
              <span className="stat-label">Adım</span>
            </div>
           
          </div>
        </div>
      </div>

      {/* Modern Form Layout */}
      <div className="calculation-form-container">
        <form id="azotForm" onSubmit={handleSubmit} className="calculation-form">
          {/* Kullanıcı Giriş Değerleri */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
              </div>
              <div className="form-section-content">
                <h2 className="form-section-title">Kullanıcı Giriş Değerleri</h2>
                <p className="form-section-description">Azotlu çapak alma parametrelerini girin</p>
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
                  <label className="form-label">Tezgah Soğuma Süresi (sn)</label>
                  <input 
                    name="tezgahSogumaSuresi" 
                    className="form-input" 
                    value={form.tezgahSogumaSuresi ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: 120"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Makine İşlem Süresi (sn)</label>
                  <input 
                    name="makineIslemSuresi" 
                    className="form-input" 
                    value={form.makineIslemSuresi ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: 60"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Yükleme/Boşaltma Süresi (sn)</label>
                  <input 
                    name="yuklemeBosaltmaSuresi" 
                    className="form-input" 
                    value={form.yuklemeBosaltmaSuresi ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: 30"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">İşlem Gören Ürün Ağırlığı Toplam (gr)</label>
                  <input 
                    name="islemGorenUrunAgirligiToplamGram" 
                    className="form-input" 
                    value={form.islemGorenUrunAgirligiToplamGram ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: 500"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Birim Net Ağırlık (gr)</label>
                  <input 
                    name="birimNetAgirlikGram" 
                    className="form-input" 
                    value={form.birimNetAgirlikGram ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: 25"
                  />
                </div>
                
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
                  <label className="form-label">Euro Kuru</label>
                  <input 
                    name="euroKuru" 
                    className="form-input disabled" 
                    value={form.euroKuru ?? ''} 
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
                    placeholder="Örn: 15"
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
                    placeholder="Örn: 500"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">İşlem Başına Harcanan Azot (gr)</label>
                  <input 
                    name="islemBasinaHarcananAzotGram" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.islemBasinaHarcananAzotGram ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 10"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Taş kg/saniye</label>
                  <input 
                    name="tasKgSaniye" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.tasKgSaniye ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 0.5"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Taş 1 kg Fiyatı (€)</label>
                  <input 
                    name="tas1KgFiyatiEuro" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.tas1KgFiyatiEuro ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 2.5"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Azot kg Fiyatı (₺)</label>
                  <input 
                    name="azotKgFiyatiTl" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.azotKgFiyatiTl ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 15"
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
                    placeholder="Örn: 25000"
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
                    placeholder="Örn: 20"
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
                <h3 className="result-title">Azotlu Çapak Alma Maliyeti</h3>
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
            form="azotForm" 
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


