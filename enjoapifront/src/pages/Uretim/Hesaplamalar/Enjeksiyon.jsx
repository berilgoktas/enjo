import { useEffect, useState } from 'react'
import { useUretim } from '../../../context/UretimContext.jsx'
import StepNav from '../../../components/StepNav.jsx'
import { useNavigate } from 'react-router-dom'

export default function Enjeksiyon() {
  const navigate = useNavigate()
  const { shared, updateShared, getForm, updateForm, getResult, updateResult, getWizardSteps, getPrevRouteForKey, getNextRouteForKey } = useUretim()
  const [form, setForm] = useState({
    // Kullanıcı Giriş Değerleri
    baskiToplamBrut: '',
    kalipGozSayisi: '',
    hammaddeFiyatiEuro: '',
    hammaddeTuru: '',
    hammaddeTedarikcisi: '',
    adet: '',
    baskiCevrimSuresi: '',
    isciKatsayisi: '',
    isciSinifiKey: '',
    isciSayisi: '',
    kalipKontrolu: '',
    kalipBedeli: '',
    kalipTedarikcisi: '',
    // Admin Giriş Değerleri
    euroKuru: '',
    operatorUcreti: '',
    elektrikUcreti: '',
    kwDegeri: '',
    faydaliOmurYil: '',
    makineBedeliEuro: '',
    yillikBakimMaliyeti: '',
    kalipBakimUcreti: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(getResult('enjeksiyon'))
  const [isAdminEditing, setIsAdminEditing] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const [adminError, setAdminError] = useState('')
  const [adminOriginal, setAdminOriginal] = useState(null)

  // euroKuru gösterilecek ama güncellenmeyecek
  const ADMIN_KEYS = ['operatorUcreti','elektrikUcreti','kwDegeri','faydaliOmurYil','makineBedeliEuro','yillikBakimMaliyeti','kalipBakimUcreti']

  const ISCI_SINIFI_OPTIONS = [
    { key: 'cirak', label: 'Çırak', value: 0.8 },
    { key: 'operator', label: 'Operatör', value: 1 },
    { key: 'muhendis', label: 'Mühendis', value: 1.5 },
    { key: 'usta', label: 'Usta', value: 2 },
  ]

  // birimBrutAgirlik hesaplayan fonksiyon
  function calculateBirimBrutAgirlik(payload) {
    const { baskiToplamBrut = 0, kalipGozSayisi = 0 } = payload
    if (baskiToplamBrut > 0 && kalipGozSayisi > 0) {
      return baskiToplamBrut / kalipGozSayisi
    }
    return 0
  }

  // Detay maliyetleri hesaplayan fonksiyon (optimize edilmiş)
  function calculateDetailedCosts(payload, toplamMaliyet) {
    const {
      baskiToplamBrut = 0,
      kalipGozSayisi = 0,
      hammaddeFiyatiEuro = 0,
      baskiCevrimSuresi = 0,
      isciKatsayisi = 0,
      isciSayisi = 0,
      operatorUcreti = 0,
      elektrikUcreti = 0,
      kwDegeri = 0,
      faydaliOmurYil = 0,
      makineBedeliEuro = 0,
      yillikBakimMaliyeti = 0,
      kalipBakimUcreti = 0,
      euroKuru = 0
    } = payload

    // Hızlı çıkış - gerekli değerler yoksa
    if (!baskiToplamBrut || !kalipGozSayisi || !baskiCevrimSuresi) {
      return {
        malzemeMaliyeti: 0,
        iscilikMaliyeti: 0,
        elektrikMaliyeti: 0,
        amortismanMaliyeti: 0,
        makineBakimMaliyeti: 0,
        kalipBakimMaliyeti: 0,
        kalipMaliyeti: 0
      }
    }

    // Saatlik üretim hesapla
    const saatlikUretim = (3600 / baskiCevrimSuresi) * kalipGozSayisi
    
    // Hızlı çıkış - saatlik üretim 0 ise
    if (saatlikUretim <= 0) {
      return {
        malzemeMaliyeti: 0,
        iscilikMaliyeti: 0,
        elektrikMaliyeti: 0,
        amortismanMaliyeti: 0,
        makineBakimMaliyeti: 0,
        kalipBakimMaliyeti: 0,
        kalipMaliyeti: 0
      }
    }

    // Maliyetleri hesapla
    const malzemeMaliyeti = (baskiToplamBrut * hammaddeFiyatiEuro) / 1000
    const saatlikUcret = operatorUcreti / 176 // 22 gün * 8 saat
    const iscilikMaliyeti = (saatlikUcret * isciKatsayisi * isciSayisi) / saatlikUretim
    const elektrikMaliyeti = (kwDegeri * elektrikUcreti) / saatlikUretim
    const amortismanMaliyeti = (makineBedeliEuro * euroKuru) / (faydaliOmurYil * 8760 * saatlikUretim) // 365 * 24
    const makineBakimMaliyeti = (yillikBakimMaliyeti * euroKuru) / (8760 * saatlikUretim)
    const kalipBakimMaliyeti = (kalipBakimUcreti * euroKuru) / (8760 * saatlikUretim)

    return {
      malzemeMaliyeti: malzemeMaliyeti || 0,
      iscilikMaliyeti: iscilikMaliyeti || 0,
      elektrikMaliyeti: elektrikMaliyeti || 0,
      amortismanMaliyeti: amortismanMaliyeti || 0,
      makineBakimMaliyeti: makineBakimMaliyeti || 0,
      kalipBakimMaliyeti: kalipBakimMaliyeti || 0,
      kalipMaliyeti: 0
    }
  }

  function isciSinifiKeyFromValue(v) {
    const num = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
    const found = ISCI_SINIFI_OPTIONS.find(o => o.value === num)
    return found ? found.key : ''
  }

  function handleIsciSinifiChange(e) {
    const selKey = e.target.value
    const opt = ISCI_SINIFI_OPTIONS.find(o => o.key === selKey)
    setForm(prev => ({ ...prev, isciKatsayisi: opt ? opt.value : '', isciSinifiKey: selKey }))
    updateForm('enjeksiyon', { isciKatsayisi: opt ? opt.value : '', isciSinifiKey: selKey })
  }

  useEffect(() => {
    async function loadAdminDefaults() {
      try {
        setAdminLoading(true)
        const res = await fetch('/api/admin/enjeksiyon-varsayilan-degerler', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (res.ok) {
          const data = await res.json()
          setAdminOriginal(data)
          setForm(prev => ({ ...prev, ...data }))
          console.log('Admin değerleri başarıyla yüklendi')
        } else {
          throw new Error(`API hatası: ${res.status}`)
        }
      } catch (err) {
        console.error('Admin değerleri yüklenemedi:', err)
        setAdminError('Admin değerleri yüklenemedi: ' + err.message)
      } finally {
        setAdminLoading(false)
      }
    }
    
    loadAdminDefaults()
  }, [])


  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    updateForm('enjeksiyon', { [name]: value })
    if (name === 'kalipGozSayisi' || name === 'baskiCevrimSuresi' || name === 'baskiToplamBrut' || name === 'elektrikUcreti' || name === 'euroKuru' || name === 'operatorUcreti') {
      updateShared({ [name]: value })
    }
  }

  useEffect(() => {
    const saved = getForm('enjeksiyon')
    if (Object.keys(saved).length) {
      setForm(prev => ({ ...prev, ...saved }))
    }
  }, [getForm])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const base = { ...(adminOriginal||{}), ...form }

      function toNumber(v) {
        if (typeof v === 'number') return v
        if (v == null) return NaN
        const s = String(v).replace(',', '.').trim()
        if (s === '') return NaN
        const n = Number(s)
        return isNaN(n) ? NaN : n
      }

      const includeKalipBedeli = String((base.kalipKontrolu||'').toLowerCase()) === 'var'
      let numericKeys = [
        'baskiToplamBrut','kalipGozSayisi','hammaddeFiyatiEuro','euroKuru','baskiCevrimSuresi','isciKatsayisi','isciSayisi','operatorUcreti','elektrikUcreti','kwDegeri','faydaliOmurYil','makineBedeliEuro','yillikBakimMaliyeti','kalipBakimUcreti','adet'
      ]
      if (includeKalipBedeli) numericKeys.push('kalipBedeli')

      const payload = { ...base }
      const missing = []
      for (const key of numericKeys) {
        const n = toNumber(base[key])
        if (isNaN(n)) missing.push(key)
        else payload[key] = n
      }
      if (!includeKalipBedeli) {
        delete payload.kalipBedeli
      }
      
      // String alanları payload'a ekle
      if (base.hammaddeTuru) payload.hammaddeTuru = base.hammaddeTuru
      if (base.hammaddeTedarikcisi) payload.hammaddeTedarikcisi = base.hammaddeTedarikcisi
      
      if (missing.length) {
        throw new Error('Eksik veya hatalı sayısal alanlar: ' + missing.join(', '))
      }

      // *** Var olan hesaplama ID'si varsa PUT, yoksa POST kullan ***
      const existingHesaplamaId = result?.hesaplamaId || null
      const isUpdate = existingHesaplamaId != null
      
      console.log('=== ENJEKSIYON API İSTEĞİ ===')
      console.log('İşlem tipi:', isUpdate ? 'GÜNCELLEME (PUT)' : 'YENİ KAYIT (POST)')
      console.log('Hesaplama ID:', existingHesaplamaId)
      console.log('Payload:', payload)
      
      let response, data
      
      if (isUpdate) {
        // *** GÜNCELLEME: PUT isteği - Sadece sayı döner ***
        console.log(`PUT isteği gönderiliyor: /api/hesaplama/enjeksiyon/${existingHesaplamaId}`)
        response = await fetch(`/api/hesaplama/enjeksiyon/${existingHesaplamaId}`, {
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

        // PUT sadece sayı döner (raw number)
        const responseText = await response.text()
        const guncelMaliyet = parseFloat(responseText)
        
        console.log('PUT yanıtı (raw):', responseText)
        console.log('Güncel enjeksiyon maliyeti:', guncelMaliyet)
        
        // Mevcut sonuçları güncelle
        data = {
          id: existingHesaplamaId,
          toplamMaliyet: guncelMaliyet,
          // Diğer alanları önceki değerlerden koru
          birimBrutAgirlik: result?.birimBrutAgirlik || 0,
          birimHammaddeMaliyeti: result?.birimHammaddeMaliyeti || 0,
          malzemeMaliyeti: result?.malzemeMaliyeti || 0,
          iscilikMaliyeti: result?.iscilikMaliyeti || 0,
          elektrikMaliyeti: result?.elektrikMaliyeti || 0,
          amortismanMaliyeti: result?.amortismanMaliyeti || 0,
          makineBakimMaliyeti: result?.makineBakimMaliyeti || 0,
          kalipBakimMaliyeti: result?.kalipBakimMaliyeti || 0,
          kalipMaliyeti: result?.kalipMaliyeti || 0
        }
        
      } else {
        // *** YENİ KAYIT: POST isteği - Obje döner ***
        console.log('POST isteği gönderiliyor: /api/hesaplama/enjeksiyon')
        response = await fetch('/api/hesaplama/enjeksiyon', {
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
        
        // Response boş mu kontrol et
        if (!response.body) {
          throw new Error('Hesaplama servisi yanıt vermiyor. Lütfen tekrar deneyin.')
        }

        try {
          const responseText = await response.text()
          
          if (!responseText || responseText.trim() === '') {
            throw new Error('Hesaplama sonucu alınamadı. Lütfen tekrar deneyin.')
          }
          
          data = JSON.parse(responseText)
          console.log('POST yanıtı (obje):', data)
          console.log('birimBrutAgirlik değeri:', data.birimBrutAgirlik)
          console.log('birimHammaddeMaliyeti değeri:', data.birimHammaddeMaliyeti)
        } catch (jsonError) {
          console.error('JSON parse hatası:', jsonError)
          throw new Error('Hesaplama sonucu işlenemedi. Lütfen tekrar deneyin.')
        }
      }
      
      // Backend'den detay maliyetler de gelebilir
      let maliyet, hesaplamaId, detayMaliyetler = {}
      if (typeof data === 'object' && data !== null) {
        maliyet = typeof data.toplamMaliyet === 'number' ? data.toplamMaliyet : parseFloat(data.toplamMaliyet || 0)
        hesaplamaId = data.id || existingHesaplamaId || null
        
        console.log('=== İŞLENMİŞ VERİ ===')
        console.log('Toplam Maliyet:', maliyet)
        console.log('Hesaplama ID:', hesaplamaId)
        
        // Detay maliyetleri al
        detayMaliyetler = {
          malzemeMaliyeti: data.malzemeMaliyeti || 0,
          iscilikMaliyeti: data.iscilikMaliyeti || 0,
          elektrikMaliyeti: data.elektrikMaliyeti || 0,
          amortismanMaliyeti: data.amortismanMaliyeti || 0,
          makineBakimMaliyeti: data.makineBakimMaliyeti || 0,
          kalipBakimMaliyeti: data.kalipBakimMaliyeti || 0,
          kalipMaliyeti: data.kalipMaliyeti || 0,
          birimHammaddeMaliyeti: data.birimHammaddeMaliyeti || 0
        }
        
        // birimBrutAgirlik değerini API'den al veya hesapla
        const hesaplananBirimBrutAgirlik = calculateBirimBrutAgirlik(payload)
        console.log('birimBrutAgirlik kontrol ediliyor:', {
          apiGelen: data.birimBrutAgirlik,
          hesaplanan: hesaplananBirimBrutAgirlik,
          baskiToplamBrut: payload.baskiToplamBrut,
          kalipGozSayisi: payload.kalipGozSayisi
        })
        
        // API'den gelen değer varsa onu kullan, yoksa hesapla
        const finalBirimBrutAgirlik = (data.birimBrutAgirlik && data.birimBrutAgirlik > 0) ? data.birimBrutAgirlik : hesaplananBirimBrutAgirlik
        
        if (finalBirimBrutAgirlik > 0) {
          console.log('birimBrutAgirlik shared state\'e kaydediliyor:', finalBirimBrutAgirlik)
          updateShared({ birimBrutAgirlik: finalBirimBrutAgirlik })
          // birimBrutAgirlik değerini form'a da ata
          setForm(prev => {
            console.log('Form state güncelleniyor, önceki değer:', prev.birimBrutAgirlik)
            const newForm = { ...prev, birimBrutAgirlik: finalBirimBrutAgirlik }
            console.log('Form state güncellendi, yeni değer:', newForm.birimBrutAgirlik)
            return newForm
          })
          // Context'e de kaydet
          updateForm('enjeksiyon', { birimBrutAgirlik: finalBirimBrutAgirlik })
        } else {
          console.log('birimBrutAgirlik değeri hesaplanamadı:', finalBirimBrutAgirlik)
        }

        // birimHammaddeMaliyeti değerini API'den al veya hesapla
        const hammaddeFiyatiEuro = payload.hammaddeFiyatiEuro || 0
        const hesaplananBirimHammaddeMaliyeti = finalBirimBrutAgirlik > 0 ? (hammaddeFiyatiEuro * finalBirimBrutAgirlik) : 0
        console.log('birimHammaddeMaliyeti kontrol ediliyor:', {
          apiGelen: data.birimHammaddeMaliyeti,
          hesaplanan: hesaplananBirimHammaddeMaliyeti,
          hammaddeFiyatiEuro: hammaddeFiyatiEuro,
          birimBrutAgirlik: finalBirimBrutAgirlik,
          formül: `${hammaddeFiyatiEuro} × ${finalBirimBrutAgirlik} = ${hesaplananBirimHammaddeMaliyeti}`
        })
        
        // API'den gelen değer varsa onu kullan, yoksa hesapla
        const finalBirimHammaddeMaliyeti = (data.birimHammaddeMaliyeti && data.birimHammaddeMaliyeti > 0) ? data.birimHammaddeMaliyeti : hesaplananBirimHammaddeMaliyeti
        
        if (finalBirimHammaddeMaliyeti > 0) {
          console.log('birimHammaddeMaliyeti shared state\'e kaydediliyor:', finalBirimHammaddeMaliyeti)
          updateShared({ birimHammaddeMaliyeti: finalBirimHammaddeMaliyeti })
          // Context'e de kaydet
          updateForm('enjeksiyon', { birimHammaddeMaliyeti: finalBirimHammaddeMaliyeti })
        } else {
          console.log('birimHammaddeMaliyeti değeri hesaplanamadı:', finalBirimHammaddeMaliyeti)
        }
        // Eğer API'den detay maliyetler gelmiyorsa, frontend'de hesapla
        if (detayMaliyetler.malzemeMaliyeti === 0 && detayMaliyetler.iscilikMaliyeti === 0 && detayMaliyetler.elektrikMaliyeti === 0) {
          detayMaliyetler = calculateDetailedCosts(payload, maliyet)
        }
      } else {
        maliyet = typeof data === 'number' ? data : parseFloat(data || 0)
        hesaplamaId = null
        // Frontend'de hesapla
        detayMaliyetler = calculateDetailedCosts(payload, maliyet)
      }
      
      // Eğer maliyet 0 ise, hesaplama yapılmamış demektir
      if (maliyet === 0 || isNaN(maliyet)) {
        throw new Error('Hesaplama sonucu 0 geldi. Lütfen tüm alanları doldurduğunuzdan emin olun.')
      }
      
      
      const hesaplamaResult = {
        toplamMaliyet: maliyet,
        hesaplamaId: hesaplamaId, // Kaydetme sırasında kullanılacak
        ...detayMaliyetler,
        hammaddeMiktari: 0,
        uretimSuresi: 0,
        saatlikUretim: 0
      }
      
      setResult(hesaplamaResult)
      updateResult('enjeksiyon', hesaplamaResult)
      
      // Tüm payload verilerini Context'e kaydet (satış kaydı için gerekli)
      updateForm('enjeksiyon', payload)
    } catch (err) {
      setError(err.message || 'Hesaplama sırasında bir sorun oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  function startAdminEdit() {
    setIsAdminEditing(true)
  }

  function cancelAdminEdit() {
    if (adminOriginal) {
      setForm(prev => ({ ...prev, ...adminOriginal }))
    }
    setIsAdminEditing(false)
  }

  function saveAdminEdit() {
    const toSave = ADMIN_KEYS.reduce((acc, key) => {
      acc[key] = form[key]
      return acc
    }, {})
    // Sayısala çevir
    for (const k of Object.keys(toSave)) {
      const raw = toSave[k]
      if (raw !== '' && raw != null) {
        const normalized = typeof raw === 'string' ? raw.replace(',', '.').trim() : raw
        if (!isNaN(Number(normalized))) toSave[k] = Number(normalized)
      }
    }
    setAdminLoading(true)
    setAdminError('')
    fetch('/api/admin/enjeksiyon-varsayilan-degerler', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave)
    }).then(async r => {
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    }).then(saved => {
      setAdminOriginal(saved)
      setForm(prev => ({ ...prev, ...saved }))
      setIsAdminEditing(false)
      // Var olan bir hesaplama sonucu varsa otomatik güncelle
      if (result) {
        setTimeout(() => {
          try { handleSubmit({ preventDefault: () => {} }) } catch {}
        }, 0)
      }
    }).catch(err => {
      setAdminError('Sistem ayarları kaydedilemedi. Lütfen tekrar deneyin.')
    }).finally(() => setAdminLoading(false))
  }
  
  function handleClear() {
    const cleared = {
      baskiToplamBrut: '',
      kalipGozSayisi: '',
      hammaddeFiyatiEuro: '',
      hammaddeTuru: '',
      hammaddeTedarikcisi: '',
      adet: '',
      baskiCevrimSuresi: '',
      isciKatsayisi: '',
      isciSinifiKey: '',
      isciSayisi: '',
      kalipKontrolu: '',
      kalipBedeli: '',
      kalipTedarikcisi: ''
    }
    setForm(prev => ({ ...prev, ...cleared }))
    updateForm('enjeksiyon', cleared)
    setResult(null)
    updateResult('enjeksiyon', null)
    setError('')
  }
  return (
    <div className="calculation-container">
      {/* Modern Header */}
      <div className="calculation-header">
        <div className="calculation-header-content">
          <div className="calculation-title-section">
            <h1 className="calculation-title">Enjeksiyon Hesaplaması</h1>
            <p className="calculation-subtitle">Adım {(typeof getWizardSteps==='function' ? (getWizardSteps().findIndex(s => s.key==='enjeksiyon') + 1) : 2)} / {(typeof getWizardSteps==='function' ? getWizardSteps().length : 1)}</p>
          </div>
          <div className="calculation-stats">
            <div className="stat-item">
              <span className="stat-number">{(typeof getWizardSteps==='function' ? (getWizardSteps().findIndex(s => s.key==='enjeksiyon') + 1) : 2)}</span>
              <span className="stat-label">Adım</span>
            </div>
            
            
          </div>
        </div>
      </div>

      {/* Modern Form Layout */}
      <div className="calculation-form-container">
        <form id="injForm" onSubmit={handleSubmit} className="calculation-form">
          {/* Kullanıcı Giriş Değerleri */}
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div className="form-section-content">
                <h2 className="form-section-title">Kullanıcı Giriş Değerleri</h2>
                <p className="form-section-description">Üretim parametrelerini girin</p>
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
                  <label className="form-label">Baskı Toplam Brüt Ağırlık</label>
                  <input 
                    name="baskiToplamBrut" 
                    className="form-input" 
                    value={form.baskiToplamBrut ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: 78.65"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Kalıp Göz Sayısı</label>
                  <input 
                    name="kalipGozSayisi" 
                    className="form-input" 
                    value={form.kalipGozSayisi ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: 24"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Hammadde Fiyatı (€)</label>
                  <input 
                    name="hammaddeFiyatiEuro" 
                    className="form-input" 
                    value={form.hammaddeFiyatiEuro ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: 4.5"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Hammadde Türü</label>
                  <input 
                    name="hammaddeTuru" 
                    className="form-input" 
                    value={form.hammaddeTuru ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: PP, PE, ABS"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Hammadde Tedarikçisi</label>
                  <input 
                    name="hammaddeTedarikcisi" 
                    className="form-input" 
                    value={form.hammaddeTedarikcisi ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: ABC Plastik"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Adet</label>
                  <input 
                    name="adet" 
                    className="form-input" 
                    value={form.adet ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: 1000"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Baskı Çevrim Süresi (sn)</label>
                  <input 
                    name="baskiCevrimSuresi" 
                    className="form-input" 
                    value={form.baskiCevrimSuresi ?? ''} 
                    onChange={handleChange}
                    placeholder="Örn: 155"
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
                        {ISCI_SINIFI_OPTIONS.map(o => (
                          <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
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
                <div className="form-field">
                  <label className="form-label">Kalıp Alımı Var Mı?</label>
                  <select 
                    name="kalipKontrolu" 
                    className="form-input" 
                    value={form.kalipKontrolu} 
                    onChange={handleChange}
                  >
                        <option value="">Seçiniz</option>
                        <option value="var">Var</option>
                        <option value="yok">Yok</option>
                      </select>
                    </div>
                    {String((form.kalipKontrolu||'').toLowerCase()) === 'var' && (
                  <div className="form-field">
                    <label className="form-label">Kalıp Bedeli</label>
                    <input 
                      name="kalipBedeli" 
                      className="form-input" 
                      value={form.kalipBedeli ?? ''} 
                      onChange={handleChange}
                      placeholder="Örn: 5000"
                    />
                  </div>
                    )}
                    {String((form.kalipKontrolu||'').toLowerCase()) === 'var' && (
                  <div className="form-field">
                    <label className="form-label">Kalıp Tedarikçisi</label>
                    <input 
                      name="kalipTedarikcisi" 
                      className="form-input" 
                      value={form.kalipTedarikcisi ?? ''} 
                      onChange={handleChange}
                      placeholder="Örn: XYZ Kalıp"
                    />
                  </div>
                    )}
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
                    onChange={handleChange} 
                    disabled={true}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Operatör Ücreti</label>
                  <input 
                    name="operatorUcreti" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.operatorUcreti ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 30000"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Elektrik</label>
                  <input 
                    name="elektrikUcreti" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.elektrikUcreti ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 4.7"
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
                    placeholder="Örn: 37"
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
                    placeholder="Örn: 30"
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
                    placeholder="Örn: 74000"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Yıllık Bakım Maliyeti</label>
                  <input 
                    name="yillikBakimMaliyeti" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.yillikBakimMaliyeti ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 700"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Kalıp Bakım Ücreti</label>
                  <input 
                    name="kalipBakimUcreti" 
                    className={`form-input ${!isAdminEditing ? 'disabled' : ''}`} 
                    value={form.kalipBakimUcreti ?? ''} 
                    onChange={handleChange} 
                    disabled={!isAdminEditing}
                    placeholder="Örn: 50"
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
                <h3 className="result-title">Enjeksiyon Maliyeti</h3>
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
            onClick={() => { const prev = (typeof getPrevRouteForKey==='function' ? getPrevRouteForKey('enjeksiyon') : '/uretim/asama-secim'); if (prev) navigate(prev) }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"></path>
            </svg>
            <span>Önceki</span>
          </button>
          <button 
            type="submit" 
            form="injForm" 
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
            onClick={() => { const next = (typeof getNextRouteForKey==='function' ? getNextRouteForKey('enjeksiyon') : null); if (next) navigate(next) }}
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


