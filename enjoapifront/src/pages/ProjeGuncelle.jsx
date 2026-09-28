import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProje } from '../context/ProjeContext.jsx'
import Modal from '../components/Modal.jsx'

export default function ProjeGuncelle() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { projeGuncelle } = useProje()
  const [proje, setProje] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [editStep, setEditStep] = useState('enjeksiyon')
  const [editRec, setEditRec] = useState(null)
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' })

  // Çalışan grubu -> katsayı eşlemesi
  const ISCI_SINIFI_MAP = {
    cirak: 0.8,
    operator: 1,
    muhendis: 1.5,
    usta: 2
  }

  // Backend bazı yanıtları PascalCase alan adlarıyla dönebilir.
  // Bu yardımcı fonksiyon, beklediğimiz camelCase yapıya dönüştürür.
  function normalizeApiRecord(rec) {
    if (!rec || typeof rec !== 'object') return rec
    const norm = {}
    const ad = rec.ad ?? rec.Ad
    if (ad !== undefined) norm.ad = ad

    // degerler
    const rawDegerler = rec.degerler ?? rec.Degerler
    if (rawDegerler && typeof rawDegerler === 'object') {
      norm.degerler = {
        malzemeMaliyeti: rawDegerler.malzemeMaliyeti ?? rawDegerler.MalzemeMaliyeti,
        iscilikMaliyeti: rawDegerler.iscilikMaliyeti ?? rawDegerler.IscilikMaliyeti,
        elektrikMaliyeti: rawDegerler.elektrikMaliyeti ?? rawDegerler.ElektrikMaliyeti,
        amortismanMaliyeti: rawDegerler.amortismanMaliyeti ?? rawDegerler.AmortismanMaliyeti,
        makineBakimMaliyeti: rawDegerler.makineBakimMaliyeti ?? rawDegerler.MakineBakimMaliyeti,
        kalipMaliyeti: rawDegerler.kalipMaliyeti ?? rawDegerler.KalipMaliyeti,
        toplamMaliyet: rawDegerler.toplamMaliyet ?? rawDegerler.ToplamMaliyet,
        birimHammaddeMaliyeti: rawDegerler.birimHammaddeMaliyeti ?? rawDegerler.BirimHammaddeMaliyeti
      }
    }

    // formlar
    const rawFormlar = rec.formlar ?? rec.Formlar
    if (rawFormlar && typeof rawFormlar === 'object') {
      norm.formlar = rawFormlar
    }

    // id ve diğer üst alanlar
    const birimBrutAgirlik = rec.birimBrutAgirlik ?? rec.BirimBrutAgirlik
    if (birimBrutAgirlik !== undefined) norm.birimBrutAgirlik = birimBrutAgirlik
    const enjeksiyonId = rec.enjeksiyonId ?? rec.EnjeksiyonId
    if (enjeksiyonId !== undefined) norm.enjeksiyonId = enjeksiyonId
    const azotluCapakAlmaId = rec.azotluCapakAlmaId ?? rec.AzotluCapakAlmaId
    if (azotluCapakAlmaId !== undefined) norm.azotluCapakAlmaId = azotluCapakAlmaId
    const posturlemeId = rec.posturlemeId ?? rec.PosturlemeId
    if (posturlemeId !== undefined) norm.posturlemeId = posturlemeId
    const santrifujId = rec.santrifujId ?? rec.SantrifujId
    if (santrifujId !== undefined) norm.santrifujId = santrifujId
    const yikamaId = rec.yikamaId ?? rec.YikamaId
    if (yikamaId !== undefined) norm.yikamaId = yikamaId

    // id alanı
    const id = rec.id ?? rec.Id
    if (id !== undefined) norm.id = id
    return norm
  }

  // İstek gövdeleri için yardımcılardan: alan adını PascalCase'e çevir
  function toPascalCaseKey(key) {
    return String(key || '')
      .split(/[^a-zA-Z0-9]/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
  }

  // Adım özelinde gerekli anahtar adlandırma dönüşümleri (ör: azotlu için BaskiToplamBrut -> BaskiToplamBrutAgirlik)
  function buildPascalPayloadForStep(stepKey, cleanedPayload) {
    const result = {}
    Object.entries(cleanedPayload || {}).forEach(([k, v]) => {
      let targetKey = toPascalCaseKey(k)
      if (stepKey === 'azotlucapakalma' && k === 'baskiToplamBrut') {
        targetKey = 'BaskiToplamBrutAgirlik'
      }
      result[targetKey] = v
    })
    return result
  }

  const STEP_KEYS = ['enjeksiyon', 'azotlucapakalma', 'posturleme', 'santrifuj', 'yikama']
  const STEP_LABELS = {
    enjeksiyon: 'Enjeksiyon',
    azotlucapakalma: 'Azotlu Çapak Alma',
    posturleme: 'Post-Kürleme',
    santrifuj: 'Santrifüjlü Çapak Alma',
    yikama: 'Yıkama'
  }

  const FIELD_LABELS = {
    baskiToplamBrut: 'Baskı Toplam Brüt',
    kalipGozSayisi: 'Kalıp Göz Sayısı',
    hammaddeFiyatiEuro: 'Hammadde Fiyatı (€)',
    baskiCevrimSuresi: 'Baskı Çevrim Süresi (sn)',
    isciSayisi: 'Çalışan Sayısı',
    isciKatsayisi: 'İşçi Katsayısı',
    isciSinifiKey: 'Çalışan Grubu',
    kalipKontrolu: 'Kalıp Kontrolü',
    kalipBedeli: 'Kalıp Bedeli',
    tezgahSogumaSuresi: 'Tezgah Soğuma Süresi (sn)',
    makineIslemSuresi: 'Makine İşlem Süresi (sn)',
    yuklemeBosaltmaSuresi: 'Yükleme/Boşaltma Süresi (sn)',
    islemGorenUrunAgirligiToplamGram: 'İşlem Gören Ürün Ağırlığı Toplam (gr)',
    fullKapasiteOperasyonSuresiSn: 'Full Kapasite Operasyon Süresi (sn)',
    idealKg: 'İdeal Kg',
    deterjanSaatlikFiyatEuro: 'Deterjan Saatlik Fiyat (€)'
  }

  const STEP_ENDPOINTS = {
    enjeksiyon: '/api/hesaplama/enjeksiyon/',
    azotlucapakalma: '/api/hesaplama/azotlucapakalma/',
    posturleme: '/api/hesaplama/posturleme/',
    santrifuj: '/api/hesaplama/santrifuj/',
    yikama: '/api/hesaplama/yikama/'
  }

  // Enjeksiyondan gelen shared değerler (diğer adımlarda düzenlenemez)
  const SHARED_FROM_ENJEKSIYON = [
    'kalipGozSayisi',
    'baskiCevrimSuresi', 
    'baskiToplamBrut',
    'baskiToplamBrutAgirlik', // azotlu'da bu isimle kullanılıyor
    'elektrikUcreti',
    'euroKuru',
    'operatorUcreti'
  ]

  // Her adımda düzenlenebilir alanlar (hesaplama sayfalarındaki gibi)
  const EDITABLE_FIELDS_BY_STEP = {
    enjeksiyon: {
      // Enjeksiyon - tüm kullanıcı giriş değerleri
      baskiToplamBrut: '',
      kalipGozSayisi: '',
      hammaddeFiyatiEuro: '',
      baskiCevrimSuresi: '',
      isciSayisi: '',
      isciSinifiKey: '',
      kalipKontrolu: '',
      kalipBedeli: ''
    },
    azotlucapakalma: {
      // Azotlu Çapak Alma - sadece bu adıma özgü alanlar
      tezgahSogumaSuresi: '',
      makineIslemSuresi: '',
      yuklemeBosaltmaSuresi: '',
      islemGorenUrunAgirligiToplamGram: '',
      isciSinifiKey: '',
      isciSayisi: '',
      isciKatsayisi: ''
    },
    posturleme: {
      // Post-Kürleme - sadece bu adıma özgü alanlar
      isciSinifiKey: '',
      isciSayisi: '',
      isciKatsayisi: ''
    },
    santrifuj: {
      // Santrifüj - sadece bu adıma özgü alanlar
      isciSinifiKey: '',
      isciSayisi: '',
      isciKatsayisi: ''
    },
    yikama: {
      // Yıkama - sadece bu adıma özgü alanlar
      isciSinifiKey: '',
      isciSayisi: '',
      isciKatsayisi: ''
    }
  }

  // Proje verilerini API'den yükle
  useEffect(() => {
    console.log('ProjeGuncelle useEffect çalışıyor')
    const projeId = searchParams.get('id')
    console.log('Proje ID:', projeId)
    if (!projeId) {
      console.log('Proje ID bulunamadı')
      setError('Proje ID bulunamadı')
      setLoading(false)
      return
    }

    const projeVerileriniYukle = async () => {
      try {
        setLoading(true)
        console.log('API\'den proje verisi yükleniyor, ID:', projeId)
        
        // API'den proje verisini çek
        const res = await fetch(`/api/hesaplama/satis-kayitlari/${projeId}`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        
        if (!res.ok) {
          throw new Error(`API hatası: ${res.status}`)
        }
        
        const projeVerisi = await res.json()
        console.log('API\'den yüklenen proje verisi:', projeVerisi)
        console.log('Proje verisi tüm alanlar:', Object.keys(projeVerisi))
        
        // EditRec'i oluştur - Sonuçlar sayfasındaki gibi
        let editRecord = {
          id: projeId,
          ad: projeVerisi.ad || 'İsimsiz Proje',
          formlar: projeVerisi.formlar || {},
          degerler: projeVerisi.degerler || {},
          enjeksiyonId: projeVerisi.enjeksiyonId || null,
          azotluCapakAlmaId: projeVerisi.azotluCapakAlmaId || null,
          posturlemeId: projeVerisi.posturlemeId || null,
          santrifujId: projeVerisi.santrifujId || null,
          yikamaId: projeVerisi.yikamaId || null
        }
        
        console.log('EditRecord oluşturuldu:', editRecord)
        console.log('Mevcut adım ID\'leri:')
        console.log('- Enjeksiyon ID:', editRecord.enjeksiyonId)
        console.log('- Azotlu ID:', editRecord.azotluCapakAlmaId)
        console.log('- Post-Kürleme ID:', editRecord.posturlemeId)
        console.log('- Santrifüj ID:', editRecord.santrifujId)
        console.log('- Yıkama ID:', editRecord.yikamaId)
        console.log('Formlar:', editRecord.formlar)
        console.log('- Yıkama ID:', editRecord.yikamaId)
        console.log('Formlar:', editRecord.formlar)
        setEditRec(editRecord)
        setProje({
          id: projeId,
          projeAdi: projeVerisi.ad || 'İsimsiz Proje',
          kaynak: 'api'
        })
        setLoading(false)
      } catch (error) {
        console.error('Proje verisi yüklenemedi:', error)
        setError('Proje verisi yüklenemedi: ' + error.message)
        setLoading(false)
      }
    }

    projeVerileriniYukle()
  }, [searchParams])

  // Yardımcı: id alan isimleri farklı kasa/formatta gelebilir; normalize edip eşleştir
  function normalizeKey(s) {
    return String(s || '').toLowerCase().replace(/[^a-z]/g, '')
  }

  function getStepIdFromRecord(record, stepKey) {
    if (!record) return undefined
    
    console.log('getStepIdFromRecord - record:', record)
    console.log('getStepIdFromRecord - stepKey:', stepKey)
    
    // Doğrudan alan adlarını kontrol et
    const stepIdMap = {
      'enjeksiyon': record.enjeksiyonId,
      'azotlucapakalma': record.azotluCapakAlmaId,
      'posturleme': record.posturlemeId,
      'santrifuj': record.santrifujId,
      'yikama': record.yikamaId
    }
    
    const stepId = stepIdMap[stepKey]
    console.log(`${stepKey} adımı için ID kontrolü:`, stepId)
    console.log('Tüm stepIdMap:', stepIdMap)
    
    return stepId || undefined
  }

  // O adımda düzenlenebilir alanları getir
  function getEditableFieldsForStep(record, stepKey) {
    console.log(`getEditableFieldsForStep - stepKey: ${stepKey}`)
    console.log(`getEditableFieldsForStep - record:`, record)
    
    // API'deki form verileri ile stepKey'i eşleştir
    let formKey = stepKey
    if (stepKey === 'azotlucapakalma') {
      formKey = 'azotlu'  // API'de 'azotlu' olarak geliyor
    }
    
    const existing = record?.formlar?.[formKey] || {}
    const editableFields = EDITABLE_FIELDS_BY_STEP[stepKey] || {}
    
    console.log(`getEditableFieldsForStep - formKey: ${formKey}`)
    console.log(`getEditableFieldsForStep - existing:`, existing)
    console.log(`getEditableFieldsForStep - editableFields:`, editableFields)
    
    // Eğer bu adım daha önce hesaplanmamışsa, varsayılan değerlerle doldur
    const filtered = {}
    Object.keys(editableFields).forEach(key => {
      // Mevcut değer varsa onu kullan, yoksa varsayılan değeri kullan
      filtered[key] = existing[key] !== undefined ? existing[key] : editableFields[key]
    })
    
    console.log(`getEditableFieldsForStep - filtered:`, filtered)
    return filtered
  }

  // Proje güncelleme - Sonuçlar sayfasındaki mantık
  const handleProjeGuncelle = async () => {
    if (isUpdating) return
    setIsUpdating(true)
    
    try {
      // PUT çağrısı: seçili adım
      // API'deki form verileri ile stepKey'i eşleştir
      let formKey = editStep
      if (editStep === 'azotlucapakalma') {
        formKey = 'azotlu'  // API'de 'azotlu' olarak geliyor
      }
      
      const raw = editRec?.formlar?.[formKey] || {}
      // Backend'in beklediği formatta payload oluştur
      const cleanedPayload = {}
      
      // Eğer enjeksiyon dışında bir adım güncelleniyorsa, enjeksiyon adımından gerekli değerleri al
      if (editStep !== 'enjeksiyon') {
        const enjeksiyonData = editRec?.formlar?.enjeksiyon || {}
        SHARED_FROM_ENJEKSIYON.forEach(key => {
          if (enjeksiyonData[key] !== undefined && enjeksiyonData[key] !== null && enjeksiyonData[key] !== '') {
            const value = enjeksiyonData[key]
            
            // Sayısal değerler için güvenlik kontrolü
            if (typeof value === 'number') {
              if (!isNaN(value) && isFinite(value) && value >= 0) {
                // C# Decimal için güvenli aralık kontrolü
                if (value > 1e28 || value < -1e28) {
                  console.warn(`Enjeksiyondan ${key} için çok büyük değer: ${value}, atlanıyor`)
                  return
                }
                // C# Decimal precision kontrolü
                if (String(value).length > 28) {
                  console.warn(`Enjeksiyondan ${key} için çok fazla basamak: ${value}, atlanıyor`)
                  return
                }
                
                // baskiToplamBrut → baskiToplamBrutAgirlik dönüşümü (azotlu için)
                if (key === 'baskiToplamBrut' && editStep === 'azotlucapakalma') {
                  cleanedPayload['baskiToplamBrutAgirlik'] = value
                } else {
                  cleanedPayload[key] = value
                }
              } else {
                console.warn(`Enjeksiyondan ${key} için geçersiz sayısal değer: ${value}, atlanıyor`)
              }
            } else {
              // String değerler için
              if (key === 'baskiToplamBrut' && editStep === 'azotlucapakalma') {
                cleanedPayload['baskiToplamBrutAgirlik'] = value
              } else {
                cleanedPayload[key] = value
              }
            }
          }
        })
        console.log(`Enjeksiyondan ${editStep} adımına aktarılan değerler:`, cleanedPayload)
      }
      
      // Sayısal alanlar (double)
      const doubleFields = ['baskiToplamBrut', 'hammaddeFiyatiEuro', 'baskiCevrimSuresi', 'euroKuru', 'kwDegeri', 'fullKapasiteOperasyonSuresiSn', 'idealKg', 'baskiToplamBrutAgirlik', 'elektrikUcreti', 'operatorUcreti', 'isciKatsayisi', 'makineBedeliEuro', 'faydaliOmurYil', 'yillikBakimBedeli', 'deterjanSaatlikFiyatEuro']
      
      // Tam sayı alanlar (int)
      const intFields = ['isciSayisi', 'kalipGozSayisi']
      
      // String alanlar
      const stringFields = ['isciSinifiKey', 'kalipKontrolu']
      
      Object.entries(raw).forEach(([k, v]) => {
        if (v === '' || v == null || v === undefined) return
        
        // hammaddeTedarikcisi backend tarafında string bekleniyor; obje ise uygun alanı seçerek string'e çevir
        if (k === 'hammaddeTedarikcisi') {
          if (typeof v === 'string') {
            cleanedPayload[k] = v
          } else if (v && typeof v === 'object') {
            const candidate = (v.id ?? v.value ?? v.name ?? v.ad ?? v.label)
            if (candidate !== undefined) {
              cleanedPayload[k] = String(candidate)
            } else if (Array.isArray(v) && v.length > 0) {
              cleanedPayload[k] = String(v[0])
            } else {
              cleanedPayload[k] = ''
            }
          } else {
            cleanedPayload[k] = String(v)
          }
          return
        }
        
        if (doubleFields.includes(k)) {
          const cleaned = String(v).trim().replace(',', '.')
          if (cleaned === '') return
          const asNumber = parseFloat(cleaned)
          if (!isNaN(asNumber) && isFinite(asNumber) && asNumber >= 0) {
            if ((k === 'euroKuru' || k.toLowerCase().includes('kuru')) && asNumber <= 0) {
              console.warn(`${k} için geçersiz değer: ${asNumber}, atlanıyor`)
              return
            }
            // C# Decimal için güvenli aralık kontrolü (Decimal.MaxValue = 79228162514264337593543950335)
            if (asNumber > 1e28 || asNumber < -1e28) {
              console.warn(`${k} için çok büyük değer: ${asNumber}, atlanıyor`)
              return
            }
            // C# Decimal precision kontrolü (28-29 basamak)
            if (String(asNumber).length > 28) {
              console.warn(`${k} için çok fazla basamak: ${asNumber}, atlanıyor`)
              return
            }
            cleanedPayload[k] = asNumber
          } else {
            console.warn(`${k} için geçersiz sayısal değer: ${v}, atlanıyor`)
          }
        } else if (intFields.includes(k)) {
          const cleaned = String(v).trim().replace(',', '.')
          if (cleaned === '') return
          const asNumber = parseInt(cleaned)
          if (!isNaN(asNumber) && isFinite(asNumber) && asNumber >= 0) {
            cleanedPayload[k] = asNumber
          } else {
            console.warn(`${k} için geçersiz tam sayı değeri: ${v}, atlanıyor`)
          }
        } else if (stringFields.includes(k)) {
          cleanedPayload[k] = String(v)
        } else {
          // Diğer alanlar için genel dönüşüm
          const cleaned = String(v).trim().replace(',', '.')
          if (cleaned === '') return
          const asNumber = Number(cleaned)
          if (!isNaN(asNumber) && isFinite(asNumber) && asNumber >= 0) {
            // C# Decimal için güvenli aralık kontrolü (Decimal.MaxValue = 79228162514264337593543950335)
            if (asNumber > 1e28 || asNumber < -1e28) {
              console.warn(`${k} için çok büyük değer: ${asNumber}, atlanıyor`)
              return
            }
            // C# Decimal precision kontrolü (28-29 basamak)
            if (String(asNumber).length > 28) {
              console.warn(`${k} için çok fazla basamak: ${asNumber}, atlanıyor`)
              return
            }
            cleanedPayload[k] = asNumber
          } else {
            cleanedPayload[k] = String(v)
          }
        }
      })
      
      // id tespiti: mümkünse adım id'si
      const stepId = getStepIdFromRecord(editRec, editStep)
      let endpoint, method
      
      if (!stepId) {
        // Bu adım daha önce hesaplanmamış, yeni hesaplama yap
        console.log(`${STEP_LABELS[editStep]} adımı daha önce hesaplanmamış, yeni hesaplama yapılıyor...`)
        endpoint = STEP_ENDPOINTS[editStep]
        method = 'POST'
      } else {
        // Mevcut adımı güncelle
        console.log(`${STEP_LABELS[editStep]} adımı güncelleniyor...`)
        endpoint = STEP_ENDPOINTS[editStep] + encodeURIComponent(stepId)
        method = 'PUT'
      }
      
      console.log('=== API İSTEĞİ BAŞLIYOR ===')
      console.log('Method:', method)
      console.log('Endpoint:', endpoint)
      console.log('Step ID:', stepId)
      console.log('Raw data:', raw)
      console.log('Cleaned payload:', cleanedPayload)
      console.log('JSON string:', JSON.stringify(cleanedPayload))
      
      // Backend tüm adımlar için sadece değişen alan(lar)ı PascalCase ve kök gövdeye bekliyor
      let requestBody
      const payloadPascal = buildPascalPayloadForStep(editStep, cleanedPayload)
      requestBody = JSON.stringify(payloadPascal)

      const res = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: requestBody
      })
      
      console.log('Response status:', res.status)
      console.log('Response ok:', res.ok)
      
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        console.error('PUT hatası:', res.status, txt)
        throw new Error(res.status + ' ' + (txt || res.statusText))
      }
      
      const responseData = await res.json()
      console.log(`${method} başarılı, response:`, responseData)
      
      // Eğer yeni hesaplama yapıldıysa (POST), dönen ID'yi editRec'e ekle
      if (method === 'POST' && responseData.id) {
        console.log(`Yeni ${editStep} ID'si alındı:`, responseData.id)
        // API'deki form verileri ile stepKey'i eşleştir
        let formKey = editStep
        if (editStep === 'azotlucapakalma') {
          formKey = 'azotlu'  // API'de 'azotlu' olarak geliyor
        }
        const idPropMap = {
          enjeksiyon: 'enjeksiyonId',
          azotlucapakalma: 'azotluCapakAlmaId',
          posturleme: 'posturlemeId',
          santrifuj: 'santrifujId',
          yikama: 'yikamaId'
        }
        const idProp = idPropMap[editStep]
        setEditRec(prev => ({
          ...prev,
          [idProp]: responseData.id,
          formlar: {
            ...prev.formlar,
            [formKey]: {
              ...prev.formlar?.[formKey],
              ...cleanedPayload
            }
          }
        }))
      }
      
      // Eğer enjeksiyon güncelleniyorsa, shared değerleri diğer adımlara da aktar
      if (editStep === 'enjeksiyon') {
        const sharedValues = {}
        SHARED_FROM_ENJEKSIYON.forEach(key => {
          if (cleanedPayload[key] !== undefined) {
            sharedValues[key] = cleanedPayload[key]
          }
        })
        
        if (Object.keys(sharedValues).length > 0) {
          console.log('Enjeksiyondan diğer adımlara aktarılacak shared değerler:', sharedValues)
          
          // Diğer adımlar için PUT istekleri gönder (aynı PascalCase-kök gövde formatıyla)
          const otherSteps = STEP_KEYS.filter(step => step !== 'enjeksiyon')
          for (const otherStep of otherSteps) {
            const otherStepId = getStepIdFromRecord(editRec, otherStep)
            if (otherStepId) {
              try {
                const otherEndpoint = STEP_ENDPOINTS[otherStep] + encodeURIComponent(otherStepId)
                console.log(`${otherStep} adımına shared değerler gönderiliyor:`, sharedValues)
                
                const adaptedValues = buildPascalPayloadForStep(otherStep, sharedValues)
                await fetch(otherEndpoint, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(adaptedValues)
                })
                
                console.log(`${otherStep} başarıyla güncellendi`)
              } catch (error) {
                console.warn(`${otherStep} güncellenirken hata:`, error)
              }
            } else {
              console.log(`${otherStep} için ID bulunamadı, atlanıyor`)
            }
          }
        }
      }

      // Satis-kayitlari'ni güncelle - Backend'teki guncelleSatisKaydi fonksiyonu kullanılacak
      try {
        // Güncel ID'leri al (yeni hesaplama yapıldıysa güncellenmiş olabilir)
        const currentEditRec = editRec
        if (method === 'POST' && responseData.id) {
          const idPropMap = {
            enjeksiyon: 'enjeksiyonId',
            azotlucapakalma: 'azotluCapakAlmaId',
            posturleme: 'posturlemeId',
            santrifuj: 'santrifujId',
            yikama: 'yikamaId'
          }
          const idProp = idPropMap[editStep]
          currentEditRec[idProp] = responseData.id
        }
        
        // satis-kayitlari için formlar anahtarı backend şemasıyla aynı olmalı (azotlu)
        let payloadFormKey = editStep
        if (editStep === 'azotlucapakalma') payloadFormKey = 'azotlu'

        const guncelVeriler = {
          ad: currentEditRec.ad,
          // degerler gönderme – backend toplamları kendisi hesaplayacak
          formlar: {
            ...currentEditRec.formlar,
            [payloadFormKey]: cleanedPayload
          },
          enjeksiyonId: currentEditRec.enjeksiyonId,
          azotluCapakAlmaId: currentEditRec.azotluCapakAlmaId,
          posturlemeId: currentEditRec.posturlemeId,
          santrifujId: currentEditRec.santrifujId,
          yikamaId: currentEditRec.yikamaId
        }
        
        console.log('Satis-kayitlari güncelleniyor (guncelleSatisKaydi ile):', guncelVeriler)
        
        // ID zaten temiz (API'den geldiği için)
        const actualId = editRec.id
        console.log('API isteği için kullanılacak ID:', actualId)
        console.log('API URL:', `/api/hesaplama/satis-kayitlari/${actualId}`)
        
        const satisRes = await fetch(`/api/hesaplama/satis-kayitlari/${actualId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(guncelVeriler)
        })
        
        if (satisRes.ok) {
          console.log('Satis-kayitlari başarıyla güncellendi (genel toplamlar otomatik hesaplandı)')
          let updatedRecord = null
          try {
            updatedRecord = await satisRes.json()
            console.log('Satis-kayitlari PUT yaniti:', updatedRecord)
          } catch (e) {
            console.warn('Satis-kayitlari PUT yaniti JSON parse edilemedi:', e)
          }

          if (updatedRecord && typeof updatedRecord === 'object') {
            const normalized = normalizeApiRecord(updatedRecord)
            // Backend toplamları yeniden hesapladı; state'i güncelle
            setEditRec(prev => ({
              ...prev,
              ad: normalized.ad ?? prev.ad,
              degerler: normalized.degerler ?? prev.degerler,
              birimBrutAgirlik: normalized.birimBrutAgirlik ?? prev.birimBrutAgirlik,
              enjeksiyonId: normalized.enjeksiyonId ?? prev.enjeksiyonId,
              azotluCapakAlmaId: normalized.azotluCapakAlmaId ?? prev.azotluCapakAlmaId,
              posturlemeId: normalized.posturlemeId ?? prev.posturlemeId,
              santrifujId: normalized.santrifujId ?? prev.santrifujId,
              yikamaId: normalized.yikamaId ?? prev.yikamaId
            }))

            // Satış sayfası canlı güncelleme alsın
            try {
              window.dispatchEvent(new CustomEvent('satisKayitGuncellendi', { detail: { kayit: normalized } }))
            } catch (e) {
              console.warn('satisKayitGuncellendi eventi gönderilemedi:', e)
            }
          }
        } else {
          const errorText = await satisRes.text()
          console.warn('Satis-kayitlari güncellenemedi:', satisRes.status, errorText)
        }
      } catch (error) {
        console.warn('Satis-kayitlari güncellenirken hata:', error)
      }
      
      setModal({
        isOpen: true,
        title: 'Başarılı',
        message: 'Proje başarıyla güncellendi!',
        type: 'success'
      })
      setTimeout(() => {
        navigate('/projeler')
      }, 1500)
      
    } catch (e) {
      console.error('Güncelleme hatası:', e)
      setModal({
        isOpen: true,
        title: 'Hata',
        message: 'Güncelleme işlemi başarısız oldu. Lütfen tekrar deneyin.',
        type: 'error'
      })
    } finally {
      setIsUpdating(false)
    }
  }


  if (loading) {
    return (
      <div className="project-update-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Proje yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (error || !proje) {
    return (
      <div className="project-update-container">
        <div className="error-state">
          <div className="error-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <h3>Hata</h3>
          <p>{error || 'Proje bulunamadı'}</p>
          <button onClick={() => navigate('/projeler')} className="error-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"></path>
            </svg>
            Projeler Sayfasına Dön
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="project-update-container">
      {/* Modern Header */}
      <div className="update-header">
        <div className="update-header-content">
          <div className="update-title-section">
            <h1 className="update-title">Proje Güncelle</h1>
            <p className="update-subtitle">{proje.projeAdi}</p>
          </div>
          <div className="update-stats">
            
          </div>
        </div>
      </div>

      <div className="update-content">
        {/* Modern Step Navigation */}
        <div className="step-navigation">
          <div className="step-tabs-container">
            {STEP_KEYS.map(k => {
              console.log(`${k} adımı işleniyor, editRec:`, editRec)
              // Bu adım daha önce hesaplanmış mı kontrol et
              const stepId = getStepIdFromRecord(editRec, k)
              const hasData = editRec?.formlar?.[k] && Object.keys(editRec.formlar[k]).length > 0
              
              console.log(`${k} form verisi:`, editRec?.formlar?.[k])
              console.log(`${k} adımı kontrolü:`, {
                stepId,
                hasData,
                formData: editRec?.formlar?.[k],
                shouldShow: stepId || hasData
              })
              
              // Eğer adım hesaplanmamışsa gösterilmez
              if (!stepId && !hasData) {
                return null
              }
              
              return (
                <button 
                  key={k} 
                  className={`step-tab ${editStep === k ? 'active' : ''}`} 
                  onClick={() => setEditStep(k)}
                >
                  <div className="step-tab-content">
                    <div className="step-tab-icon">
                      {k === 'enjeksiyon' && (
                        <span style={{ fontSize: '20px' }}>🧩</span>
                      )}
                      {k === 'azotlucapakalma' && (
                        <span style={{ fontSize: '20px' }}>❄️</span>
                      )}
                      {k === 'posturleme' && (
                        <span style={{ fontSize: '20px' }}>🔥</span>
                      )}
                      {k === 'santrifuj' && (
                        <span style={{ fontSize: '20px' }}>🌀</span>
                      )}
                      {k === 'yikama' && (
                        <span style={{ fontSize: '20px' }}>🧴</span>
                      )}
                    </div>
                    <span className="step-tab-label">{STEP_LABELS[k]}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Modern Form Container */}
        <div className="form-container">
          {(() => {
            // Mevcut adımları filtrele
            const availableSteps = STEP_KEYS.filter(k => {
              const stepId = getStepIdFromRecord(editRec, k)
              const hasData = editRec?.formlar?.[k] && Object.keys(editRec.formlar[k]).length > 0
              const shouldInclude = stepId || hasData
              
              console.log(`Form container - ${k} adımı:`, {
                stepId,
                hasData,
                shouldInclude
              })
              
              return shouldInclude
            })
            
            console.log('Mevcut adımlar:', availableSteps)
            
            // Eğer hiç hesaplanmış adım yoksa
            if (availableSteps.length === 0) {
              return (
                <div className="no-data-state">
                  <div className="no-data-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14,2 14,8 20,8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10,9 9,9 8,9"></polyline>
                    </svg>
                  </div>
                  <h3>Hesaplama Bulunamadı</h3>
                  <p>Bu proje için henüz hiçbir hesaplama adımı tamamlanmamış.</p>
                  <p>Önce hesaplama sayfasından gerekli adımları tamamlayın.</p>
                </div>
              )
            }
            
            // Eğer seçili adım artık mevcut değilse, ilk mevcut adıma geç
            if (!availableSteps.includes(editStep)) {
              setEditStep(availableSteps[0])
              return null
            }
            
            return (
              <div className="form-card">
                <div className="form-header">
                  <div className="form-title-section">
                    <h3 className="form-title">{STEP_LABELS[editStep]}</h3>
                    <p className="form-subtitle">Girdi Alanları</p>
                  </div>
                  <div className="form-status">
                    <div className="status-indicator active"></div>
                    <span>Aktif</span>
                  </div>
                </div>
                
                <div className="form-body">
                  <div className="form-grid">
                    {Object.entries(getEditableFieldsForStep(editRec, editStep)).map(([k, v]) => {
                      // Kalıp kontrolü "yok" ise kalıp bedeli alanını gizle
                      // API'deki form verileri ile stepKey'i eşleştir
                      let formKey = editStep
                      if (editStep === 'azotlucapakalma') {
                        formKey = 'azotlu'  // API'de 'azotlu' olarak geliyor
                      }
                      const kalipKontrolu = editRec?.formlar?.[formKey]?.kalipKontrolu
                      if (k === 'kalipBedeli' && kalipKontrolu === 'yok') {
                        return null
                      }
                      // İşçi katsayısı kullanıcıya gösterilmemeli; isciSinifiKey ile otomatik set ediliyor
                      if (k === 'isciKatsayisi') {
                        return null
                      }
                      
                      return (
                      <div key={`${editRec?.id}-${editStep}-${k}`} className="form-field">
                        <label className="form-label">{FIELD_LABELS[k] || k}</label>
                        {k === 'isciSinifiKey' ? (
                          <select 
                            key={`select-${editRec?.id}-${editStep}-${k}-${Date.now()}`}
                            className="form-input" 
                            value={String(v ?? '')} 
                            onChange={e => {
                              console.log(`${editStep}.${k} değişti:`, e.target.value)
                              // API'deki form verileri ile stepKey'i eşleştir
                              let formKey = editStep
                              if (editStep === 'azotlucapakalma') {
                                formKey = 'azotlu'  // API'de 'azotlu' olarak geliyor
                              }
                              
                              const selKey = e.target.value
                              const coef = ISCI_SINIFI_MAP[selKey] ?? ''
                              setEditRec(prev => ({ 
                                ...prev, 
                                formlar: { 
                                  ...(prev.formlar||{}), 
                                  [formKey]: { 
                                    ...(prev.formlar?.[formKey]||{}), 
                                    [k]: selKey,
                                    isciKatsayisi: coef
                                  } 
                                } 
                              }))
                            }}
                          >
                            <option value="">Seçiniz</option>
                            <option value="cirak">Çırak</option>
                            <option value="operator">Operatör</option>
                            <option value="muhendis">Mühendis</option>
                            <option value="usta">Usta</option>
                          </select>
                        ) : k === 'kalipKontrolu' ? (
                          <select 
                            key={`select-${editRec?.id}-${editStep}-${k}-${Date.now()}`}
                            className="form-input" 
                            value={String(v ?? '')} 
                            onChange={e => {
                              console.log(`${editStep}.${k} değişti:`, e.target.value)
                              // API'deki form verileri ile stepKey'i eşleştir
                              let formKey = editStep
                              if (editStep === 'azotlucapakalma') {
                                formKey = 'azotlu'  // API'de 'azotlu' olarak geliyor
                              }
                              
                              setEditRec(prev => ({ 
                                ...prev, 
                                formlar: { 
                                  ...(prev.formlar||{}), 
                                  [formKey]: { 
                                    ...(prev.formlar?.[formKey]||{}), 
                                    [k]: e.target.value 
                                  } 
                                } 
                              }))
                            }}
                          >
                            <option value="">Seçiniz</option>
                            <option value="var">Var</option>
                            <option value="yok">Yok</option>
                          </select>
                        ) : (
                          <input 
                            key={`input-${editRec?.id}-${editStep}-${k}`}
                            className="form-input" 
                            value={String(v ?? '')} 
                            onChange={e => {
                              console.log(`${editStep}.${k} değişti:`, e.target.value)
                              // API'deki form verileri ile stepKey'i eşleştir
                              let formKey = editStep
                              if (editStep === 'azotlucapakalma') {
                                formKey = 'azotlu'  // API'de 'azotlu' olarak geliyor
                              }
                              
                              const rawVal = e.target.value
                              let nextValue = rawVal
                              // isciKatsayisi doğrudan sayısal girilirse sayıya çevir
                              if (k === 'isciKatsayisi') {
                                const num = Number(String(rawVal).replace(',', '.'))
                                nextValue = isNaN(num) ? '' : num
                              }
                              setEditRec(prev => ({ 
                                ...prev, 
                                formlar: { 
                                  ...(prev.formlar||{}), 
                                  [formKey]: { 
                                    ...(prev.formlar?.[formKey]||{}), 
                                    [k]: nextValue 
                                  } 
                                } 
                              }))
                            }} 
                          />
                        )}
                      </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>


        {/* Modern Action Buttons */}
        <div className="action-buttons">
          <button 
            onClick={() => navigate('/projeler')} 
            className="cancel-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            İptal
          </button>
          <button 
            onClick={handleProjeGuncelle}
            className="save-btn"
            disabled={isUpdating}
          >
            {isUpdating ? (
              <>
                <div className="loading-spinner-small"></div>
                Güncelleniyor...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17,21 17,13 7,13 7,21"></polyline>
                  <polyline points="7,3 7,8 15,8"></polyline>
                </svg>
                Kaydet
              </>
            )}
          </button>
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
