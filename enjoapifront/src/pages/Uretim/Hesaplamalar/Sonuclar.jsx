import { useMemo, useState, useEffect } from 'react'
import { useUretim } from '../../../context/UretimContext.jsx'
import { useProje } from '../../../context/ProjeContext.jsx'
import StepNav from '../../../components/StepNav.jsx'
import { useNavigate } from 'react-router-dom'
import Modal from '../../../components/Modal.jsx'
import { exportEnjeksiyonRaporuExcelJS, exportPDFWithData } from '../../../utils/projeRaporExport.js'

export default function Sonuclar() {
  const navigate = useNavigate()
  const { 
    getResult, 
    getWizardSteps, 
    selectedSteps, 
    shared,
    getForm,
    updateForm,
    clearAllData,
    validateAllSelectedSteps
  } = useUretim()
  const { projeOlustur } = useProje()

  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [apiResults, setApiResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' })
  const [isProjectSaved, setIsProjectSaved] = useState(false)
  const [savedRecordId, setSavedRecordId] = useState(null)

  // Yardımcı fonksiyonlar (satış sayfasından kopyalandı)
  const parseMaybeJson = (value) => {
    if (typeof value === 'string') {
      try { return JSON.parse(value) } catch { return {} }
    }
    return (value && typeof value === 'object') ? value : {}
  }

  const toNumberLocaleAny = (v) => {
    if (typeof v === 'number') return v
    if (v == null) return 0
    let s = String(v).trim()
    if (s.includes(',') && s.includes('.')) {
      const lastDot = s.lastIndexOf('.')
      const lastComma = s.lastIndexOf(',')
      if (lastComma > lastDot) {
        s = s.replace(/\./g, '').replace(',', '.')
      } else {
        s = s.replace(/,/g, '')
      }
    } else if (s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  const normalizeCostKeys = (raw = {}) => {
    const src = raw || {}
    return {
      malzemeMaliyeti: toNumberLocaleAny(src.malzemeMaliyeti ?? src.MalzemeMaliyeti),
      iscilikMaliyeti: toNumberLocaleAny(src.iscilikMaliyeti ?? src.IscilikMaliyeti),
      elektrikMaliyeti: toNumberLocaleAny(src.elektrikMaliyeti ?? src.ElektrikMaliyeti),
      amortismanMaliyeti: toNumberLocaleAny(src.amortismanMaliyeti ?? src.AmortismanMaliyeti),
      makineBakimMaliyeti: toNumberLocaleAny(src.makineBakimMaliyeti ?? src.MakineBakimMaliyeti),
      kalipBakimMaliyeti: toNumberLocaleAny(src.kalipBakimMaliyeti ?? src.KalipBakimMaliyeti),
      kalipMaliyeti: toNumberLocaleAny(src.kalipMaliyeti ?? src.KalipMaliyeti),
      birimBrutAgirlik: toNumberLocaleAny(src.birimBrutAgirlik ?? src.BirimBrutAgirlik),
      birimHammaddeMaliyeti: toNumberLocaleAny(src.birimHammaddeMaliyeti ?? src.BirimHammaddeMaliyeti),
      toplamMaliyet: toNumberLocaleAny(src.toplamMaliyet ?? src.ToplamMaliyet)
    }
  }

  const normalizeAllResults = (obj = {}) => {
    const mapKey = (k) => {
      if (!k) return k
      const lower = String(k).toLowerCase()
      if (lower.includes('azotlu')) return 'azotlu'
      if (lower.includes('santrif')) return 'santrifuj'
      if (lower.includes('post')) return 'posturleme'
      if (lower.includes('yikama')) return 'yikama'
      if (lower.includes('enjeksiyon')) return 'enjeksiyon'
      return k
    }
    const out = {}
    Object.entries(obj || {}).forEach(([k, v]) => {
      const mk = mapKey(k)
      if (!mk) return
      const norm = normalizeCostKeys(v || {})
      out[mk] = {
        toplamMaliyet: norm.toplamMaliyet || 0,
        malzemeMaliyeti: norm.malzemeMaliyeti || 0,
        iscilikMaliyeti: norm.iscilikMaliyeti || 0,
        elektrikMaliyeti: norm.elektrikMaliyeti || 0,
        amortismanMaliyeti: norm.amortismanMaliyeti || 0,
        makineBakimMaliyeti: norm.makineBakimMaliyeti || 0,
        kalipBakimMaliyeti: norm.kalipBakimMaliyeti || 0,
        kalipMaliyeti: norm.kalipMaliyeti || 0,
        birimHammaddeMaliyeti: norm.birimHammaddeMaliyeti || 0
      }
    })
    return out
  }

  // Satış kaydı detayını API'den çek
  async function fetchSatisKaydiDetay(id) {
    try {
      const url = `/api/hesaplama/satis-kayitlari/${id}?_t=${Date.now()}`
      console.log('SATIS DETAY FETCH URL:', url)
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      console.log('SATIS DETAY HTTP status:', res.status, res.statusText)
      if (!res.ok) return null
      const json = await res.json()
      try {
        console.log('SATIS DETAY JSON keys:', Object.keys(json || {}))
        console.log('SATIS DETAY degerler alanı (ham):', json?.degerler)
      } catch (_) {}
      return json
    } catch (_) {
      return null
    }
  }

  // Her süreç için kendi API'sinden toplamMaliyet'i çek
  async function fetchSurecToplamMaliyet(surecAdi, surecId) {
    if (!surecId) return 0
    
    const surecEndpoints = {
      'enjeksiyon': 'enjeksiyon',
      'santrifuj': 'santrifuj',
      'azotluCapakAlma': 'azotlucapakalma',
      'posturleme': 'posturleme',
      'yikama': 'yikama'
    }
    
    const endpoint = surecEndpoints[surecAdi]
    if (!endpoint) return 0
    
    try {
      console.log(`${surecAdi} için API çağrısı: GET /api/hesaplama/${endpoint}/${surecId}`)
      
      const res = await fetch(
        `/api/hesaplama/${endpoint}/${surecId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      )
      
      if (!res.ok) {
        console.warn(`${surecAdi} API hatası: ${res.status}`)
        return 0
      }
      
      const data = await res.json()
      console.log(`${surecAdi} API Response (TAM):`, data)
      console.log(`${surecAdi} API Response type:`, typeof data)
      
      // Backend direkt sayı döndürüyor veya obje içinde ToplamMaliyetEuro
      let toplamMaliyet = 0
      
      if (typeof data === 'number') {
        // Direkt sayı geliyorsa
        toplamMaliyet = data
      } else if (typeof data === 'object' && data !== null) {
        // Obje geliyorsa, içinden ToplamMaliyetEuro'yu al
        console.log(`${surecAdi} API Response Keys:`, Object.keys(data))
        toplamMaliyet = toNumberLocaleAny(data.ToplamMaliyetEuro ?? data.toplamMaliyetEuro ?? data.ToplamMaliyet ?? data.toplamMaliyet)
      }
      
      console.log(`${surecAdi} ToplamMaliyet (SONUÇ):`, toplamMaliyet)
      
      return toplamMaliyet
    } catch (error) {
      console.error(`${surecAdi} çekilirken hata:`, error)
      return 0
    }
  }

  // Satış kaydındaki tüm süreç maliyetlerini paralel olarak çek
  async function fetchTumSurecler(apiRecord) {
    const enjeksiyonId = apiRecord.enjeksiyonId || apiRecord.EnjeksiyonId
    const santrifujId = apiRecord.santrifujId || apiRecord.SantrifujId
    const azotluCapakAlmaId = apiRecord.azotluCapakAlmaId || apiRecord.AzotluCapakAlmaId
    const posturlemeId = apiRecord.posturlemeId || apiRecord.PosturlemeId
    const yikamaId = apiRecord.yikamaId || apiRecord.YikamaId
    
    console.log('=== SÜREÇ ID\'LERİ - API ÇAĞRILACAK ===')
    console.log('Enjeksiyon ID:', enjeksiyonId)
    console.log('Santrifüj ID:', santrifujId)
    console.log('Azotlu Çapak Alma ID:', azotluCapakAlmaId)
    console.log('Post-Kürleme ID:', posturlemeId)
    console.log('Yıkama ID:', yikamaId)
    
    // Kayıttaki hesaplamaVerileri (varsa) fallback olarak kullanılacak
    const hesaplamaVerileriRaw = parseMaybeJson(apiRecord.hesaplamaVerileri || apiRecord.HesaplamaVerileri)
    const hesaplamaVerileri = normalizeAllResults(hesaplamaVerileriRaw)
    const fallbackEnjeksiyon = hesaplamaVerileri?.enjeksiyon?.toplamMaliyet || 0
    const fallbackSantrifuj = hesaplamaVerileri?.santrifuj?.toplamMaliyet || 0
    const fallbackAzotlu = hesaplamaVerileri?.azotlu?.toplamMaliyet || 0
    const fallbackPosturleme = hesaplamaVerileri?.posturleme?.toplamMaliyet || 0
    const fallbackYikama = hesaplamaVerileri?.yikama?.toplamMaliyet || 0

    // Paralel olarak tüm süreçleri çek
    const [enjeksiyonMaliyet, santrifujMaliyet, azotluMaliyet, posturlemeMaliyet, yikamaMaliyet] = await Promise.all([
      // Eğer kayıttan gelen değer > 0 ise API çağrısına gerek yok
      (fallbackEnjeksiyon > 0 ? Promise.resolve(fallbackEnjeksiyon) : fetchSurecToplamMaliyet('enjeksiyon', enjeksiyonId)),
      (fallbackSantrifuj > 0 ? Promise.resolve(fallbackSantrifuj) : fetchSurecToplamMaliyet('santrifuj', santrifujId)),
      (fallbackAzotlu > 0 ? Promise.resolve(fallbackAzotlu) : fetchSurecToplamMaliyet('azotluCapakAlma', azotluCapakAlmaId)),
      (fallbackPosturleme > 0 ? Promise.resolve(fallbackPosturleme) : fetchSurecToplamMaliyet('posturleme', posturlemeId)),
      (fallbackYikama > 0 ? Promise.resolve(fallbackYikama) : fetchSurecToplamMaliyet('yikama', yikamaId))
    ])
    
    console.log('=== API\'DEN GELEN SÜREÇ MALİYETLERİ ===')
    console.log('Enjeksiyon:', enjeksiyonMaliyet)
    console.log('Santrifüj:', santrifujMaliyet)
    console.log('Azotlu Çapak Alma:', azotluMaliyet)
    console.log('Post-Kürleme:', posturlemeMaliyet)
    console.log('Yıkama:', yikamaMaliyet)
    
    // Frontend'de topla
    const toplamMaliyet = enjeksiyonMaliyet + santrifujMaliyet + azotluMaliyet + posturlemeMaliyet + yikamaMaliyet
    console.log('Frontend\'de hesaplanan toplam:', toplamMaliyet)
    
    return {
      enjeksiyon: enjeksiyonMaliyet,
      santrifuj: santrifujMaliyet,
      azotlu: azotluMaliyet,
      posturleme: posturlemeMaliyet,
      yikama: yikamaMaliyet,
      toplam: toplamMaliyet
    }
  }

  // API'den doğru verileri çek
  async function loadApiResults() {
    try {
      setLoading(true)
      const res = await fetch(`/api/hesaplama/son-maliyetler?_t=${Date.now()}`, {
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
        console.log('API\'den gelen veri:', data)
        if (data.sonMaliyetler && data.sonMaliyetler.length > 0) {
          setApiResults(data.sonMaliyetler)
        }
      }
    } catch (err) {
      console.error('API hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  const allResults = useMemo(() => {
    const results = {}
    selectedSteps.forEach(stepKey => {
      const result = getResult(stepKey)
      if (result) {
        results[stepKey] = result
      }
    })
    return results
  }, [selectedSteps, getResult])

  // Export işlemleri için: seçili olup olmadığına bakmadan mevcut tüm süreç sonuçlarını topla
  const allResultsForExport = useMemo(() => {
    const keys = ['enjeksiyon', 'azotlu', 'posturleme', 'santrifuj', 'yikama']
    const results = {}
    keys.forEach(k => {
      const r = getResult(k)
      if (r) results[k] = r
    })
    return results
  }, [getResult, selectedSteps])

  // Enjeksiyon formundan ürün bilgilerini al
  const productInfo = useMemo(() => {
    const enjeksiyonForm = getForm('enjeksiyon')
    if (enjeksiyonForm) {
      return {
        adet: enjeksiyonForm.adet || '',
        hammaddeTuru: enjeksiyonForm.hammaddeTuru || '',
        hammaddeTedarikcisi: enjeksiyonForm.hammaddeTedarikcisi || ''
      }
    }
    return {
      adet: '',
      hammaddeTuru: '',
      hammaddeTedarikcisi: ''
    }
  }, [getForm])

  // Hesaplama yapıldıktan sonra API'den veri çek
  useEffect(() => {
    if (allResults && Object.keys(allResults).length > 0) {
      loadApiResults()
    }
  }, [allResults])

  const totalCost = useMemo(() => {
    // Sadece seçili aşamaların toplamını hesapla (Context'ten)
    let total = 0
    Object.values(allResults).forEach(result => {
      if (result.toplamMaliyet) {
        total += Number(result.toplamMaliyet)
      }
    })
    return total
  }, [allResults])

  const costBreakdown = useMemo(() => {
    // API'den gelen doğru verileri kullan
    if (apiResults && apiResults.length > 0) {
      // Kalıp maliyeti Enjeksiyon kaydından alınır
      const enjeksiyonKaydi = (apiResults || []).find(item => (item.hesaplamaTuru || '').toLowerCase() === 'enjeksiyon')
      if (!enjeksiyonKaydi) {
        console.warn('sonMaliyetler içinde hesaplamaTuru=="Enjeksiyon" kaydı bulunamadı. kalipMaliyeti 0 olarak ayarlanacak.')
      }
      const kalipMaliyetiFromApiRaw = Number(enjeksiyonKaydi?.kalipMaliyeti || 0)
      const kalipMaliyetiFromApi = Number.isFinite(kalipMaliyetiFromApiRaw) ? kalipMaliyetiFromApiRaw : 0
      console.log('KalipMaliyeti (API-Enjeksiyon):', kalipMaliyetiFromApi, 'Kaynak kayıt:', enjeksiyonKaydi)

      const breakdown = {
        malzemeMaliyeti: 0,
        iscilikMaliyeti: 0,
        elektrikMaliyeti: 0,
        amortismanMaliyeti: 0,
        makineBakimMaliyeti: 0,
        kalipBakimMaliyeti: 0,
        kalipMaliyeti: kalipMaliyetiFromApi,
        birimHammaddeMaliyeti: 0,
        toplamMaliyet: 0
      }
      
      console.log('API\'den gelen sonMaliyetler:', apiResults)
      console.log('Seçili aşamalar:', selectedSteps)
      
      // Sadece seçili aşamaların verilerini topla
      apiResults.forEach(item => {
        console.log('API item hesaplamaTuru:', item.hesaplamaTuru)
        console.log('Seçili aşamalar:', selectedSteps)
        
        // Seçili aşamaları kontrol et (sonuclar hariç)
        const stepKey = item.hesaplamaTuru?.toLowerCase()
        
        // selectedSteps'teki isimleri API'deki isimlerle eşleştir
        let mappedStepKey = stepKey
        if (stepKey === 'azotlucapakalma') {
          mappedStepKey = 'azotlu'
        } else if (stepKey === 'posturleme') {
          mappedStepKey = 'posturleme'
        } else if (stepKey === 'santrifuj') {
          mappedStepKey = 'santrifuj'
        } else if (stepKey === 'yikama') {
          mappedStepKey = 'yikama'
        }
        
        const isSelected = mappedStepKey && selectedSteps.includes(mappedStepKey) && mappedStepKey !== 'sonuclar'
        
        console.log('stepKey:', stepKey, 'mappedStepKey:', mappedStepKey, 'isSelected:', isSelected)
        
        if (isSelected) {
          console.log('İşlenen API item:', item)
          breakdown.malzemeMaliyeti += Number(item.malzemeMaliyeti || 0)
          breakdown.iscilikMaliyeti += Number(item.iscilikMaliyeti || 0)
          breakdown.elektrikMaliyeti += Number(item.elektrikMaliyeti || 0)
          breakdown.amortismanMaliyeti += Number(item.amortismanMaliyeti || 0)
          breakdown.makineBakimMaliyeti += Number(item.makineBakimMaliyeti || 0)
          breakdown.kalipBakimMaliyeti += Number(item.kalipBakimMaliyeti || 0)
          breakdown.birimHammaddeMaliyeti += Number(item.birimHammaddeMaliyeti || 0)
          breakdown.toplamMaliyet += Number(item.toplamMaliyet || 0)
        }
      })
      console.log('KalipMaliyeti (breakdown):', breakdown.kalipMaliyeti)
      console.log('Hesaplanan breakdown (API tabanlı):', breakdown)
      
      console.log('API\'den hesaplanan breakdown:', breakdown)
      return breakdown
    }
    
    // Fallback: Context'ten hesapla (yanlış değerler olabilir)
    const breakdown = {
      malzemeMaliyeti: 0,
      iscilikMaliyeti: 0,
      elektrikMaliyeti: 0,
      amortismanMaliyeti: 0,
      makineBakimMaliyeti: 0,
      kalipBakimMaliyeti: 0,
      kalipMaliyeti: 0,
      birimHammaddeMaliyeti: 0,
      toplamMaliyet: 0
    }
    
    Object.values(allResults).forEach(result => {
      if (result.malzemeMaliyeti) breakdown.malzemeMaliyeti += Number(result.malzemeMaliyeti)
      if (result.iscilikMaliyeti) breakdown.iscilikMaliyeti += Number(result.iscilikMaliyeti)
      if (result.elektrikMaliyeti) breakdown.elektrikMaliyeti += Number(result.elektrikMaliyeti)
      if (result.amortismanMaliyeti) breakdown.amortismanMaliyeti += Number(result.amortismanMaliyeti)
      if (result.makineBakimMaliyeti) breakdown.makineBakimMaliyeti += Number(result.makineBakimMaliyeti)
      if (result.kalipBakimMaliyeti) breakdown.kalipBakimMaliyeti += Number(result.kalipBakimMaliyeti)
      
      if (result.birimHammaddeMaliyeti) breakdown.birimHammaddeMaliyeti += Number(result.birimHammaddeMaliyeti)
      if (result.toplamMaliyet) breakdown.toplamMaliyet += Number(result.toplamMaliyet)
    })
    
    return breakdown
  }, [apiResults, selectedSteps, allResults])

  // Validasyon kontrolü
  const validation = useMemo(() => {
    return validateAllSelectedSteps()
  }, [selectedSteps, validateAllSelectedSteps])

  // Hesaplama yapılıp yapılmadığını kontrol et - sadece Context'ten
  const hasCalculations = useMemo(() => {
    return Object.values(allResults).some(result => result && result.toplamMaliyet > 0)
  }, [allResults])

  // Tüm seçili adımlar tamamlandı mı?
  const allStepsCompleted = useMemo(() => {
    return validation.allValid && hasCalculations
  }, [validation.allValid, hasCalculations])

  // API çağrısını kaldırdık - sadece seçili aşamaların verilerini kullanıyoruz

  const maliyetLabels = {
    malzemeMaliyeti: 'Malzeme Maliyeti',
    iscilikMaliyeti: 'İşçilik Maliyeti',
    elektrikMaliyeti: 'Elektrik Maliyeti',
    amortismanMaliyeti: 'Amortisman Maliyeti',
    makineBakimMaliyeti: 'Makine Bakım Maliyeti',
    kalipBakimMaliyeti: 'Kalıp Bakım Maliyeti',
    kalipMaliyeti: 'Kalıp Maliyeti',
    birimHammaddeMaliyeti: 'Birim Hammadde Maliyeti (€)',
    toplamMaliyet: 'Toplam Maliyet'
  }

  const currentDate = new Date().toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  function formatCurrency(value) {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 4
    }).format(value)
  }

  // Excel export fonksiyonu
 // Excel export fonksiyonu
async function exportToExcel() {
  try {
    // Proje kaydedilmiş mi kontrol et
    if (!isProjectSaved) {
      setModal({
        isOpen: true,
        title: 'Uyarı',
        message: 'Excel dosyası oluşturmadan önce projeyi kaydetmeniz gerekiyor. Lütfen "Projeyi Kaydet" butonuna tıklayın.',
        type: 'warning'
      })
      return
    }

    // Enjeksiyon formundan hammadde bilgilerini al
    const localEnjeksiyonForm = getForm('enjeksiyon')
    const localEnjeksiyonResult = getResult('enjeksiyon')
    
    // birimBrutAgirlik ve birimHammaddeMaliyeti değerlerini shared state'ten al ve form'a ekle
    const enjeksiyonFormWithBirimBrutAgirlik = {
      ...localEnjeksiyonForm,
      birimBrutAgirlik: shared.birimBrutAgirlik || 0,
      birimHammaddeMaliyeti: shared.birimHammaddeMaliyeti || 0
    }
    
    console.log('=== SONUÇLAR EXCEL EXPORT DEBUG ===')
    console.log('enjeksiyonForm:', localEnjeksiyonForm)
    console.log('shared:', shared)
    console.log('birimBrutAgirlik (shared):', shared.birimBrutAgirlik)
    console.log('birimHammaddeMaliyeti (shared):', shared.birimHammaddeMaliyeti)
    console.log('enjeksiyonFormWithBirimBrutAgirlik:', enjeksiyonFormWithBirimBrutAgirlik)
    
    if (!localEnjeksiyonForm || !localEnjeksiyonResult) {
      setModal({
        isOpen: true,
        title: 'Uyarı',
        message: 'Enjeksiyon hesaplaması bulunamadı. Lütfen önce hesaplama yapın.',
        type: 'warning'
      })
      return
    }

      // Kayıt ID'si ile API'den güncel verileri çek (satış sayfasındaki gibi)
      console.log('=== SONUÇLAR EXCEL EXPORT - API\'DEN VERİ ÇEKİLİYOR ===')
      console.log('Kayıt ID:', savedRecordId)
      
      // Güncel veriyi API'den çek
      const apiRecord = await fetchSatisKaydiDetay(savedRecordId)
      if (!apiRecord) {
        throw new Error('API\'den kayıt verisi alınamadı')
      }
      
      console.log('API\'den gelen kayıt:', apiRecord)
      
      // Her süreç için API'den toplam maliyet çek
      const surecMaliyetleri = await fetchTumSurecler(apiRecord)
      
      console.log('=== TÜM SÜREÇ MALİYETLERİ (API\'DEN) ===')
      console.log(surecMaliyetleri)
      
      // degerler objesi - malzeme ve kalıp maliyeti için
      const degerlerObj = parseMaybeJson(apiRecord.degerler || apiRecord.Degerler)
      console.log('degerler objesi:', degerlerObj)

      // Record'dan form verilerini çıkar (JSON string olabilir)
      const formlar = parseMaybeJson(apiRecord.formlar || apiRecord.Formlar)
      const apiEnjeksiyonForm = formlar.enjeksiyon || {}
      const apiShared = parseMaybeJson(apiRecord.shared || apiRecord.Shared)
      
      // degerler objesinden verileri al
      const degerler = normalizeCostKeys(parseMaybeJson(apiRecord.degerler || apiRecord.Degerler))
      const degerlerRaw = parseMaybeJson(apiRecord.degerler || apiRecord.Degerler)
      console.log('Normalize edilmiş degerler (kayit):', degerler)
      console.log('Ham degerler (kayit):', degerlerRaw)
      
      // hesaplamaVerileri'nden allResults'u al
      const hesaplamaVerileri = normalizeAllResults(parseMaybeJson(apiRecord.hesaplamaVerileri || apiRecord.HesaplamaVerileri))
      
      console.log('Normalize edilmiş veriler:', {
        degerler,
        hesaplamaVerileri,
        formlar
      })
      
      // birimBrutAgirlik ve birimHammaddeMaliyeti değerlerini API'den al
      const baskiToplamBrut = apiEnjeksiyonForm.baskiToplamBrut || apiShared.baskiToplamBrut || 0
      const kalipGozSayisi = apiEnjeksiyonForm.kalipGozSayisi || 0
      const hammaddeFiyatiEuro = apiEnjeksiyonForm.hammaddeFiyatiEuro || 0
      
      // Sadece hesaplama için gerekli minimum bilgiler
      const hesaplananBirimBrutAgirlik = (baskiToplamBrut > 0 && kalipGozSayisi > 0) 
        ? (baskiToplamBrut / kalipGozSayisi) : 0
      const hesaplananBirimHammaddeMaliyeti = (hesaplananBirimBrutAgirlik > 0) 
        ? (hammaddeFiyatiEuro * hesaplananBirimBrutAgirlik) : 0

      const finalForm = {
        hammaddeTuru: apiEnjeksiyonForm.hammaddeTuru || '',
        hammaddeTedarikcisi: apiEnjeksiyonForm.hammaddeTedarikcisi || '',
        kalipTedarikcisi: apiEnjeksiyonForm.kalipTedarikcisi || '',
        hammaddeFiyatiEuro: hammaddeFiyatiEuro,
        baskiToplamBrut: baskiToplamBrut,
        birimBrutAgirlik: apiEnjeksiyonForm.birimBrutAgirlik || 
                          degerler.birimBrutAgirlik || 
                          apiShared.birimBrutAgirlik || 
                          hesaplananBirimBrutAgirlik,
        birimHammaddeMaliyeti: apiEnjeksiyonForm.birimHammaddeMaliyeti || 
                               degerler.birimHammaddeMaliyeti || 
                               apiShared.birimHammaddeMaliyeti || 
                               hesaplananBirimHammaddeMaliyeti,
        adet: apiEnjeksiyonForm.adet || 1,
        euroKuru: apiEnjeksiyonForm.euroKuru || apiShared.euroKuru || ''
      }

      console.log('Final form (Excel için):', finalForm)
      console.log('Degerler:', degerler)

      // API'DEN GELEN SÜREÇ MALİYETLERİNİ KULLAN
      const finalAllResults = {
        enjeksiyon: { toplamMaliyet: surecMaliyetleri.enjeksiyon },
        santrifuj: { toplamMaliyet: surecMaliyetleri.santrifuj },
        azotlu: { toplamMaliyet: surecMaliyetleri.azotlu },
        posturleme: { toplamMaliyet: surecMaliyetleri.posturleme },
        yikama: { toplamMaliyet: surecMaliyetleri.yikama }
      }
      
      console.log('=== EXCEL\'E YAZILACAK SÜREÇ MALİYETLERİ (API\'DEN) ===')
      console.log('D32 Enjeksiyon:', finalAllResults.enjeksiyon.toplamMaliyet)
      console.log('D33 Santrifüj:', finalAllResults.santrifuj.toplamMaliyet)
      console.log('D34 Azotlu Çapak Alma:', finalAllResults.azotlu.toplamMaliyet)
      console.log('D35 Post-Kürleme:', finalAllResults.posturleme.toplamMaliyet)
      console.log('D36 Yıkama:', finalAllResults.yikama.toplamMaliyet)
      console.log('Toplam (Frontend hesaplama):', surecMaliyetleri.toplam)

      // Malzeme maliyeti için degerler objesini kullan
      const degerlerNormalized = normalizeCostKeys(degerlerObj)
      const malzemeMaliyeti = degerlerNormalized.malzemeMaliyeti
      
      // Kalıp maliyeti API'den çek
      const id = apiRecord.id || apiRecord.Id || savedRecordId
      const res = await fetch(`/api/hesaplama/satis-kayitlari/${id}/kalipmaliyeti?_t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) throw new Error('Kalip maliyeti alınamadı')
      const value = await res.json()
      const kalipMaliyeti = Number(value ?? 0)
      console.log('[DEBUG] kalipMaliyetiToplam:', kalipMaliyeti, typeof kalipMaliyeti)

      const finalEnjeksiyonResult = {
        malzemeMaliyeti: malzemeMaliyeti,
        toplamMaliyet: finalAllResults.enjeksiyon.toplamMaliyet,
        birimHammaddeMaliyeti: degerler?.birimHammaddeMaliyeti || 0
      }

      // costBreakdown - malzeme maliyeti için
      const costBreakdown = {
        malzemeMaliyeti: malzemeMaliyeti,
        iscilikMaliyeti: 0,
        elektrikMaliyeti: 0,
        amortismanMaliyeti: 0,
        makineBakimMaliyeti: 0,
        kalipBakimMaliyeti: 0,
        kalipMaliyeti: kalipMaliyeti,
        toplamMaliyet: surecMaliyetleri.toplam
      }

      const totalCost = surecMaliyetleri.toplam

      console.log('=== SONUÇLAR EXCEL EXPORT DEBUG ===')
      console.log('finalForm:', finalForm)
      console.log('birimBrutAgirlik (finalForm):', finalForm.birimBrutAgirlik)
      console.log('birimHammaddeMaliyeti (finalForm):', finalForm.birimHammaddeMaliyeti)
      console.log('degerler:', degerler)
      console.log('shared:', apiShared)
      console.log('enjeksiyonForm:', apiEnjeksiyonForm)
      console.log('enjeksiyonResult:', finalEnjeksiyonResult)
      console.log('costBreakdown:', costBreakdown)

      // Net üretim maliyeti (decimal) – API'den çek ve Excel'e geçir
      let netUretimMaliyetiExcel = undefined
      let toplamHammaddeMaliyetiExcel = undefined
      let kalipMaliyetiExcel = kalipMaliyeti
      console.log('Excel E39 için kullanılacak kalipMaliyetiExcel:', kalipMaliyetiExcel)
      
      // D21 için: Satış kaydından malzeme (birim hammadde) maliyetini çek
      let birimHammaddeMaliyetiFromSatis = undefined
      let yanUrunTuruExcel = undefined
      let yanUrunMaliyetiExcel = undefined
      let adetToplamUrunMaliyetiExcel = undefined
      
      try {
        const satisId = apiRecord.id || apiRecord.Id || savedRecordId
        const enjeksiyonId = apiRecord.enjeksiyonId || apiRecord.EnjeksiyonId
        if (satisId != null) {
          const netRes = await fetch(`/api/hesaplama/satis-kayitlari/${satisId}/neturetim`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
          })
          if (netRes.ok) {
            const netVal = await netRes.json()
            netUretimMaliyetiExcel = (typeof netVal === 'number') ? netVal : Number(String(netVal).replace(',', '.'))
          }

          // Satış kaydı birim brüt ağırlık (double) → D20'ye yazılacak
          try {
            const bbUrl = `/api/hesaplama/satis-kayitlari/${satisId}/birimbrutagirlik?_t=${Date.now()}`
            console.log('BIRIM BRUT AGIRLIK (D20) URL:', bbUrl)
            const bbRes = await fetch(bbUrl, { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' })
            if (bbRes.ok) {
              const bbVal = await bbRes.json()
              const parsed = (typeof bbVal === 'number') ? bbVal : Number(String(bbVal).replace(',', '.'))
              if (Number.isFinite(parsed)) {
                finalForm.birimBrutAgirlik = parsed
                console.log('D20 (Birim Brut Ağırlık) override:', parsed)
              }
            } else {
              console.warn('birimbrutagirlik HTTP status:', bbRes.status)
            }
          } catch (e) {
            console.warn('birimbrutagirlik fetch hata:', e)
          }

          // Satış kaydı malzeme maliyeti (decimal) → D21'e yazılacak
          try {
            const matUrl = `/api/hesaplama/satis-kayitlari/${satisId}/malzememaliyeti?_t=${Date.now()}`
            console.log('MALZEME (birim hammadde) maliyeti URL:', matUrl)
            const matRes = await fetch(matUrl, { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' })
            if (matRes.ok) {
              const matVal = await matRes.json()
              const parsed = (typeof matVal === 'number') ? matVal : Number(String(matVal).replace(',', '.'))
              if (Number.isFinite(parsed)) {
                birimHammaddeMaliyetiFromSatis = parsed
                // finalForm içindeki değeri override et – D21 öncelikle buradan beslenecek
                finalForm.birimHammaddeMaliyeti = parsed
                console.log('D21 (Satış malzeme maliyeti) override:', parsed)
              }
            } else {
              console.warn('malzememaliyeti HTTP status:', matRes.status)
            }
          } catch (e) {
            console.warn('malzememaliyeti fetch hata:', e)
          }

          // Yan ürün türü ve toplam maliyet
          const yanRes = await fetch(`/api/hesaplama/satis-kayitlari/${satisId}/yanurun`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
          })
          if (yanRes.ok) {
            const yanData = await yanRes.json()
            yanUrunTuruExcel = yanData?.yanUrunTuru || ''
            console.log('YAN URUN - harcananBirimAzotMaliyetiEuro:', yanData?.harcananBirimAzotMaliyetiEuro)
          }
          const yanToplamUrl = `/api/hesaplama/satis-kayitlari/${satisId}/yanurun-maliyet?_t=${Date.now()}`
          console.log('YAN URUN - toplam maliyet URL:', yanToplamUrl)
          const yanToplamRes = await fetch(yanToplamUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
          })
          console.log('YAN URUN - toplam maliyet HTTP status:', yanToplamRes.status)
          if (yanToplamRes.ok) {
            const yanToplamRaw = await yanToplamRes.json()
            const yanToplamVal = (typeof yanToplamRaw === 'number')
              ? yanToplamRaw
              : (yanToplamRaw && typeof yanToplamRaw === 'object')
                ? (yanToplamRaw.toplamYanUrunMaliyetiEuro ?? yanToplamRaw.ToplamYanUrunMaliyetiEuro)
                : yanToplamRaw
            yanUrunMaliyetiExcel = toNumberLocaleAny(yanToplamVal)
            console.log('YAN URUN - toplam maliyet (ham):', yanToplamRaw, 'seçilen:', yanToplamVal, '-> (parse):', yanUrunMaliyetiExcel)
          }
          // Adet Toplam Ürün Maliyeti – null olabilir
          try {
            const adetToplamUrl = `/api/hesaplama/satis-kayitlari/${satisId}/adettoplamurunmaliyeti?_t=${Date.now()}`
            console.log('ADET TOPLAM ÜRÜN MALİYETİ URL (D30):', adetToplamUrl)
            const adetToplamRes = await fetch(adetToplamUrl, { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' })
            if (adetToplamRes.ok) {
              const adetToplamRaw = await adetToplamRes.json() // decimal? null olabilir
              const parsed = (typeof adetToplamRaw === 'number') ? adetToplamRaw : Number(String(adetToplamRaw ?? '').replace(',', '.'))
              adetToplamUrunMaliyetiExcel = Number.isFinite(parsed) ? parsed : undefined
              console.log('D30 (Adet Toplam Ürün Maliyeti) değer:', adetToplamUrunMaliyetiExcel)
            } else {
              console.warn('adettoplamurunmaliyeti HTTP status:', adetToplamRes.status)
            }
          } catch (e) {
            console.warn('adettoplamurunmaliyeti fetch hata:', e)
          }
          // Excel için kalıp maliyeti değeri, üstte çekilen kalipMaliyeti
          kalipMaliyetiExcel = kalipMaliyeti
        }
        // D22: Satış kaydının bağlı enjeksiyonundan toplam hammadde maliyeti
        if (satisId != null) {
          const topUrl = `/api/hesaplama/satis-kayitlari/${satisId}/toplamhammaddemaliyeti?_t=${Date.now()}`
          console.log('TOPLAM HAMMADDE (D22) URL:', topUrl)
          const topRes = await fetch(topUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
          })
          if (topRes.ok) {
            const topVal = await topRes.json()
            toplamHammaddeMaliyetiExcel = (typeof topVal === 'number') ? topVal : Number(String(topVal).replace(',', '.'))
            console.log('D22 (Toplam Hammadde) değer:', toplamHammaddeMaliyetiExcel)
          } else {
            console.warn('toplamhammaddemaliyeti HTTP status:', topRes.status)
          }
        }
      } catch (_) {}

      console.log('Excel export çağrısı – kalipMaliyetiExcel:', kalipMaliyetiExcel)
      
      // Excel export utility'sini kullan
      await exportEnjeksiyonRaporuExcelJS({
        enjeksiyonForm: finalForm,
        enjeksiyonResult: finalEnjeksiyonResult,
        costBreakdown,
        totalCost,
        allResults: finalAllResults,
        shared: apiShared,
        projeAdi: apiRecord.ad || apiRecord.Ad || saveName,
        netUretimMaliyetiExcel,
        toplamHammaddeMaliyetiExcel,
        kalipMaliyetiExcel,
        yanUrunTuruExcel,
        yanUrunMaliyetiExcel,
        adetToplamUrunMaliyetiExcel
      })

      setModal({
        isOpen: true,
        title: 'Başarılı',
        message: 'Excel dosyası başarıyla oluşturuldu ve indirildi.',
        type: 'success'
      })

    } catch (error) {
      console.error('Excel export hatası:', error)
      setModal({
        isOpen: true,
        title: 'Hata',
        message: `Excel dosyası oluşturulurken bir hata oluştu: ${error.message}`,
        type: 'error'
      })
    }
  }

  // PDF export fonksiyonu
  async function exportToPDF() {
    try {
      // Proje kaydedilmiş mi kontrol et
      if (!isProjectSaved) {
        setModal({
          isOpen: true,
          title: 'Uyarı',
          message: 'PDF dosyası oluşturmadan önce projeyi kaydetmeniz gerekiyor. Lütfen "Projeyi Kaydet" butonuna tıklayın.',
          type: 'warning'
        })
        return
      }

      console.log('=== SONUÇLAR PDF EXPORT DEBUG ===')
      console.log('allResults:', allResults)
      console.log('allResults.yikama:', allResults?.yikama)
      console.log('allResults.yikama.toplamMaliyet:', allResults?.yikama?.toplamMaliyet)
      
      const enjeksiyonForm = getForm('enjeksiyon')
      
      if (!enjeksiyonForm) {
        setModal({
          isOpen: true,
          title: 'Uyarı',
          message: 'Enjeksiyon formu bulunamadı. Lütfen önce hesaplama yapın.',
          type: 'warning'
        })
        return
      }

      // Kayıt ID'si ile API'den güncel verileri çek (satış sayfasındaki gibi)
      console.log('=== SONUÇLAR PDF EXPORT - API\'DEN VERİ ÇEKİLİYOR ===')
      console.log('Kayıt ID:', savedRecordId)
      
      // Güncel veriyi API'den çek
      const apiRecord = await fetchSatisKaydiDetay(savedRecordId)
      if (!apiRecord) {
        throw new Error('API\'den kayıt verisi alınamadı')
      }
      
      console.log('API\'den gelen kayıt:', apiRecord)
      
      // Her süreç için API'den toplam maliyet çek
      const surecMaliyetleriPdf = await fetchTumSurecler(apiRecord)
      
      console.log('=== PDF: TÜM SÜREÇ MALİYETLERİ (API\'DEN) ===')
      console.log(surecMaliyetleriPdf)
      
      // degerler objesi - malzeme maliyeti için
      const degerlerObjPdf = parseMaybeJson(apiRecord.degerler || apiRecord.Degerler)
      console.log('PDF: degerler objesi (malzeme için):', degerlerObjPdf)

      // Sonuçlar kısmındaki gibi form verilerini al (JSON string olabilir)
      const formlarPdf = parseMaybeJson(apiRecord.formlar || apiRecord.Formlar)
      const enjeksiyonFormPdf = formlarPdf.enjeksiyon || {}
      
      // Sonuçlar kısmındaki gibi birimBrutAgirlik ve birimHammaddeMaliyeti değerlerini hesapla
      const baskiToplamBrut = enjeksiyonFormPdf.baskiToplamBrut || 0
      const kalipGozSayisi = enjeksiyonFormPdf.kalipGozSayisi || 0
      const hammaddeFiyatiEuro = enjeksiyonFormPdf.hammaddeFiyatiEuro || 0
      
      const hesaplananBirimBrutAgirlik = (baskiToplamBrut > 0 && kalipGozSayisi > 0) ? (baskiToplamBrut / kalipGozSayisi) : 0
      const hesaplananBirimHammaddeMaliyeti = (hesaplananBirimBrutAgirlik > 0) ? (hammaddeFiyatiEuro * hesaplananBirimBrutAgirlik) : 0
      
      // Sonuçlar kısmındaki gibi enjeksiyonForm'u hazırla
      const enjeksiyonFormWithBirimBrutAgirlikPdf = {
        ...enjeksiyonFormPdf,
        birimBrutAgirlik: enjeksiyonFormPdf.birimBrutAgirlik || 
                         apiRecord.degerler?.birimBrutAgirlik || 
                         apiRecord.shared?.birimBrutAgirlik || 
                         hesaplananBirimBrutAgirlik,
        birimHammaddeMaliyeti: enjeksiyonFormPdf.birimHammaddeMaliyeti || 
                              apiRecord.degerler?.birimHammaddeMaliyeti || 
                              apiRecord.shared?.birimHammaddeMaliyeti || 
                              hesaplananBirimHammaddeMaliyeti
      }
      
      console.log('=== SONUÇLAR PDF DEBUG - HESAPLANAN DEĞERLER ===')
      console.log('baskiToplamBrut:', baskiToplamBrut)
      console.log('kalipGozSayisi:', kalipGozSayisi)
      console.log('hammaddeFiyatiEuro:', hammaddeFiyatiEuro)
      console.log('hesaplananBirimBrutAgirlik:', hesaplananBirimBrutAgirlik)
      console.log('hesaplananBirimHammaddeMaliyeti:', hesaplananBirimHammaddeMaliyeti)
      console.log('enjeksiyonFormWithBirimBrutAgirlik:', enjeksiyonFormWithBirimBrutAgirlikPdf)

      // API'DEN GELEN SÜREÇ MALİYETLERİNİ KULLAN
      const finalAllResults = {
        enjeksiyon: { toplamMaliyet: surecMaliyetleriPdf.enjeksiyon },
        santrifuj: { toplamMaliyet: surecMaliyetleriPdf.santrifuj },
        azotlu: { toplamMaliyet: surecMaliyetleriPdf.azotlu },
        posturleme: { toplamMaliyet: surecMaliyetleriPdf.posturleme },
        yikama: { toplamMaliyet: surecMaliyetleriPdf.yikama }
      }
      
      console.log('=== PDF\'E YAZILACAK SÜREÇ MALİYETLERİ (API\'DEN) ===')
      console.log('Enjeksiyon:', finalAllResults.enjeksiyon.toplamMaliyet)
      console.log('Santrifüj:', finalAllResults.santrifuj.toplamMaliyet)
      console.log('Azotlu Çapak Alma:', finalAllResults.azotlu.toplamMaliyet)
      console.log('Post-Kürleme:', finalAllResults.posturleme.toplamMaliyet)
      console.log('Yıkama:', finalAllResults.yikama.toplamMaliyet)
      console.log('Toplam (Frontend hesaplama):', surecMaliyetleriPdf.toplam)

      // Sonuçlar kısmındaki gibi shared objesi oluştur
      const sharedPdf = parseMaybeJson(apiRecord.shared || apiRecord.Shared)
      sharedPdf.birimBrutAgirlik = enjeksiyonFormWithBirimBrutAgirlikPdf.birimBrutAgirlik || sharedPdf.birimBrutAgirlik || 0
      sharedPdf.birimHammaddeMaliyeti = enjeksiyonFormWithBirimBrutAgirlikPdf.birimHammaddeMaliyeti || sharedPdf.birimHammaddeMaliyeti || 0
      
      console.log('=== SONUÇLAR PDF DEBUG - FINAL VERİLER ===')
      console.log('enjeksiyonFormWithBirimBrutAgirlik:', enjeksiyonFormWithBirimBrutAgirlikPdf)
      console.log('shared:', sharedPdf)
      console.log('finalAllResults:', finalAllResults)
      console.log('apiRecord.degerler:', apiRecord.degerler)

      // Malzeme maliyeti için degerler objesini kullan
      const degerlerNormalizedPdf = normalizeCostKeys(degerlerObjPdf)
      const malzemeMaliyetiPdf = degerlerNormalizedPdf.malzemeMaliyeti
      
      // Kalıp maliyetini doğrudan satis-kayitlari/{id}/kalipmaliyeti endpointinden çek (PDF)
      let kalipMaliyetiPdf = 0
      let yanUrunTuruExcel = undefined
      let yanUrunMaliyetiExcel = undefined
      let adetToplamUrunMaliyetiExcel = undefined
      const satisIdPdf = apiRecord.id || apiRecord.Id
      if (satisIdPdf != null) {
        const urlKalipPdf = `/api/hesaplama/satis-kayitlari/${satisIdPdf}/kalipmaliyeti?_t=${Date.now()}`
        console.log('[DEBUG] kalipMaliyeti URL (PDF):', urlKalipPdf)
        const res2 = await fetch(urlKalipPdf, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
        if (res2.ok) {
          const val = await res2.json()
          const parsed = Number(val ?? 0)
          kalipMaliyetiPdf = Number.isFinite(parsed) ? parsed : 0
          console.log('[DEBUG] kalipMaliyeti (endpoint PDF):', kalipMaliyetiPdf)
        } else {
          console.warn('kalipmaliyeti endpoint (PDF) HTTP status:', res2.status)
        }

        // Yan ürün türü için API çağrısı (PDF)
        try {
          const yanRes = await fetch(`/api/hesaplama/satis-kayitlari/${satisIdPdf}/yanurun`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
          })
          if (yanRes.ok) {
            const yanData = await yanRes.json()
            yanUrunTuruExcel = yanData?.yanUrunTuru || ''
            console.log('PDF - YAN URUN TURU:', yanUrunTuruExcel)
          }
        } catch (e) {
          console.warn('PDF - Yan ürün türü fetch hatası:', e)
        }

        // Yan ürün maliyeti için API çağrısı (PDF)
        try {
          const yanToplamUrl = `/api/hesaplama/satis-kayitlari/${satisIdPdf}/yanurun-maliyet?_t=${Date.now()}`
          console.log('PDF - YAN URUN MALIYETI URL:', yanToplamUrl)
          const yanToplamRes = await fetch(yanToplamUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
          })
          console.log('PDF - YAN URUN MALIYETI HTTP status:', yanToplamRes.status)
          if (yanToplamRes.ok) {
            const yanToplamRaw = await yanToplamRes.json()
            const yanToplamVal = (typeof yanToplamRaw === 'number')
              ? yanToplamRaw
              : (yanToplamRaw && typeof yanToplamRaw === 'object')
                ? (yanToplamRaw.toplamYanUrunMaliyetiEuro ?? yanToplamRaw.ToplamYanUrunMaliyetiEuro)
                : yanToplamRaw
            yanUrunMaliyetiExcel = toNumberLocaleAny(yanToplamVal)
            console.log('PDF - YAN URUN MALIYETI:', yanUrunMaliyetiExcel)
          }
        } catch (e) {
          console.warn('PDF - Yan ürün maliyeti fetch hatası:', e)
        }

        // Adet toplam ürün maliyeti için API çağrısı (PDF)
        try {
          const adetToplamUrl = `/api/hesaplama/satis-kayitlari/${satisIdPdf}/adettoplamurunmaliyeti?_t=${Date.now()}`
          console.log('PDF - ADET TOPLAM URL:', adetToplamUrl)
          const adetToplamRes = await fetch(adetToplamUrl, { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' })
          if (adetToplamRes.ok) {
            const adetToplamRaw = await adetToplamRes.json()
            const parsed = (typeof adetToplamRaw === 'number') ? adetToplamRaw : Number(String(adetToplamRaw ?? '').replace(',', '.'))
            adetToplamUrunMaliyetiExcel = Number.isFinite(parsed) ? parsed : undefined
            console.log('PDF - ADET TOPLAM URUN MALIYETI:', adetToplamUrunMaliyetiExcel)
          } else {
            console.warn('PDF - adettoplamurunmaliyeti HTTP status:', adetToplamRes.status)
          }
        } catch (e) {
          console.warn('PDF - Adet toplam ürün maliyeti fetch hatası:', e)
        }
      }

      await exportPDFWithData({
        enjeksiyonForm: enjeksiyonFormWithBirimBrutAgirlikPdf,
        costBreakdown: {
          malzemeMaliyeti: malzemeMaliyetiPdf,
          iscilikMaliyeti: 0,
          elektrikMaliyeti: 0,
          amortismanMaliyeti: 0,
          makineBakimMaliyeti: 0,
          kalipBakimMaliyeti: 0,
          kalipMaliyeti: 0,
          toplamMaliyet: surecMaliyetleriPdf.toplam
        },
        shared: sharedPdf,
        enjeksiyonResult: {
          malzemeMaliyeti: malzemeMaliyetiPdf,
          toplamMaliyet: finalAllResults.enjeksiyon.toplamMaliyet,
          birimHammaddeMaliyeti: 0
        },
        allResults: finalAllResults || {},
        projeAdi: apiRecord.ad || apiRecord.Ad || saveName,
        kayitId: apiRecord.enjeksiyonId,
        satisKayitId: apiRecord.id || apiRecord.Id,
        kalipMaliyeti: kalipMaliyetiPdf,
        yanUrunTuru: yanUrunTuruExcel,
        yanUrunMaliyeti: yanUrunMaliyetiExcel,
        adetToplamUrunMaliyeti: adetToplamUrunMaliyetiExcel
      })

      setModal({
        isOpen: true,
        title: 'Başarılı',
        message: 'PDF dosyası başarıyla oluşturuldu ve indirildi.',
        type: 'success'
      })
    } catch (error) {
      console.error('PDF export hatası:', error)
      setModal({
        isOpen: true,
        title: 'Hata',
        message: `PDF dosyası oluşturulurken bir hata oluştu: ${error.message}`,
        type: 'error'
      })
    }
  }

  async function handleSave() {
    console.log('Kaydetme başlatıldı')
    
    if (!saveName.trim()) {
      setModal({
        isOpen: true,
        title: 'Uyarı',
        message: 'Lütfen kayıt adı girin',
        type: 'warning'
      })
      return
    }

    try {
      console.log('Kaydetme işlemi başlıyor...')
      
      // Form verilerini hazırla
      const formlar = {}
      Object.keys(allResults).forEach(key => {
        const form = getForm(key)
        if (form && Object.keys(form).length > 0) {
          formlar[key] = form
        }
      })

      // Tüm hesaplama verilerini tek seferde gönder
      const hesaplamaVerileri = {}
      Object.keys(allResults).forEach(key => {
        const result = allResults[key]
        if (result && result.toplamMaliyet > 0) {
          hesaplamaVerileri[key] = {
            id: result.hesaplamaId || null, // Backend'in verdiği ID'yi gönder
            toplamMaliyet: result.toplamMaliyet,
            malzemeMaliyeti: result.malzemeMaliyeti || 0,
            iscilikMaliyeti: result.iscilikMaliyeti || 0,
            elektrikMaliyeti: result.elektrikMaliyeti || 0,
            amortismanMaliyeti: result.amortismanMaliyeti || 0,
            makineBakimMaliyeti: result.makineBakimMaliyeti || 0,
            kalipBakimMaliyeti: result.kalipBakimMaliyeti || 0,
            kalipMaliyeti: result.kalipMaliyeti || 0,
            birimHammaddeMaliyeti: result.birimHammaddeMaliyeti || 0
          }
        }
      })

      // Backend için ID'leri doğrudan alanlara ekle
      const payload = {
        ad: saveName.trim(),
        tarih: new Date().toISOString(),
        toplamMaliyet: totalCost,
        // Detay maliyetleri degerler objesi olarak gönder
        degerler: {
          malzemeMaliyeti: costBreakdown.malzemeMaliyeti,
          iscilikMaliyeti: costBreakdown.iscilikMaliyeti,
          elektrikMaliyeti: costBreakdown.elektrikMaliyeti,
          amortismanMaliyeti: costBreakdown.amortismanMaliyeti,
          makineBakimMaliyeti: costBreakdown.makineBakimMaliyeti,
          kalipBakimMaliyeti: costBreakdown.kalipBakimMaliyeti,
          kalipMaliyeti: costBreakdown.kalipMaliyeti,
          toplamMaliyet: totalCost,
          birimBrutAgirlik: shared.birimBrutAgirlik || 0,
          birimHammaddeMaliyeti: shared.birimHammaddeMaliyeti || 0
        },
        // Backend'in beklediği formatta ID'leri ekle
        enjeksiyonId: allResults.enjeksiyon?.hesaplamaId || null,
        azotluCapakAlmaId: allResults.azotlu?.hesaplamaId || null,
        posturlemeId: allResults.posturleme?.hesaplamaId || null,
        santrifujId: allResults.santrifuj?.hesaplamaId || null,
        yikamaId: allResults.yikama?.hesaplamaId || null,
        selectedSteps,
        allResults,
        shared,
        formlar,
        // Tüm hesaplama verilerini tek seferde gönder
        hesaplamaVerileri
      }
      
      console.log('=== KAYIT PAYLOAD ===')
      console.log('Hesaplama ID\'leri:', {
        enjeksiyonId: payload.enjeksiyonId,
        azotluCapakAlmaId: payload.azotluCapakAlmaId,
        posturlemeId: payload.posturlemeId,
        santrifujId: payload.santrifujId,
        yikamaId: payload.yikamaId
      })
      console.log('hesaplamaVerileri:', hesaplamaVerileri)
      console.log('formlar:', formlar)
      console.log('Tüm payload:', payload)

      console.log('API\'ye istek gönderiliyor...')
      const res = await fetch('/api/hesaplama/satis-kayitlari', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      console.log('API yanıtı alındı:', res.status, res.statusText)

      if (res.ok) {
        const savedData = await res.json()
        console.log('Kayıt başarılı! Kayıt ID:', savedData.id)
        setModal({
          isOpen: true,
          title: 'Başarılı',
          message: 'Tüm hesaplamalar başarıyla kaydedildi!',
          type: 'success'
        })
        setIsSaveOpen(false)
        setSaveName('')
        setIsProjectSaved(true) // Proje kaydedildi olarak işaretle
        setSavedRecordId(savedData.id) // Kayıt ID'sini sakla
      } else {
        const errorText = await res.text()
        console.error('Kayıt hatası:', errorText)
        setModal({
          isOpen: true,
          title: 'Hata',
          message: 'Proje kaydedilemedi. Lütfen tekrar deneyin.',
          type: 'error'
        })
      }
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Hata',
        message: 'Proje kaydedilirken bir sorun oluştu. Lütfen tekrar deneyin.',
        type: 'error'
      })
    }
  }

  return (
    <div className="calculation-container">
      {/* Modern Header */}
      <div className="calculation-header">
        <div className="calculation-header-content">
          <div className="calculation-title-section">
            <h1 className="calculation-title">Hesaplama Sonuçları</h1>
            <p className="calculation-subtitle">{currentDate} tarihli hesaplama</p>
          </div>
          <div className="calculation-stats">
            <div className="stat-item">
              <span className="stat-number">✓</span>
              <span className="stat-label">Tamamlandı</span>
            </div>
          </div>
              </div>
            </div>

      {/* Modern Form Layout */}
      <div className="calculation-form-container">
        {/* Ana Sonuç Kartı - Sadece tüm adımlar tamamlandıktan sonra göster */}
        {allStepsCompleted && (
          <div className="result-section">
            <div className="result-card">
              <div className="result-header">
                <div className="result-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                  </svg>
                </div>
                <h3 className="result-title">Toplam Maliyet</h3>
              </div>
              <div className="result-body">
                <div className="result-content">
                  <div className="result-value-large">
                    {formatCurrency(totalCost)}
                  </div>
                  <div className="result-subtitle">Tüm üretim adımlarının toplam maliyeti</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Eksik alanlar uyarısı */}
        {!validation.allValid && (
          <div className="result-section">
            <div className="result-card" style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', border: '1px solid #fca5a5' }}>
              <div className="result-header">
                <div className="result-icon" style={{ background: '#ef4444' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                </div>
                <h3 className="result-title" style={{ color: '#dc2626' }}>Eksik Bilgiler</h3>
              </div>
              <div className="result-body">
                <div className="result-content">
                  <div style={{ color: '#dc2626' }}>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '500' }}>
                      Sonuç hesaplaması için aşağıdaki adımlarda eksik bilgiler bulunmaktadır:
                    </p>
                    <div style={{ marginLeft: '1rem' }}>
                      {Object.entries(validation.results).map(([stepKey, result]) => {
                        if (stepKey === 'sonuclar' || result.isValid) return null
                        
                        // Enjeksiyon hesaplaması yapılmamışsa özel mesaj
                        if (result.missingFields.includes('enjeksiyon_hesaplama')) {
                          return (
                            <div key={stepKey} style={{ marginBottom: '0.75rem' }}>
                              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                                {validation.stepLabels[stepKey]}:
                              </div>
                              <div style={{ color: '#991b1b', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                Önce Enjeksiyon hesaplaması yapılmalıdır
                              </div>
                            </div>
                          )
                        }
                        
                        return (
                          <div key={stepKey} style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                              {validation.stepLabels[stepKey]}:
                            </div>
                            <ul style={{ margin: '0 0 0 1rem', padding: 0 }}>
                              {result.missingFields.map(field => (
                                <li key={field} style={{ color: '#991b1b', fontSize: '0.9rem' }}>
                                  {result.fieldLabels[field] || field}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                    <p style={{ margin: '1rem 0 0 0', fontSize: '0.9rem', color: '#991b1b' }}>
                      Lütfen eksik alanları doldurduktan sonra tekrar hesaplama yapın.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hesaplama yapılmadıysa bilgilendirme */}
        {validation.allValid && !hasCalculations && (
          <div className="result-section">
            <div className="result-card" style={{ background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', border: '1px solid #d1d5db' }}>
              <div className="result-header">
                <div className="result-icon" style={{ background: '#9ca3af' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                  </svg>
                </div>
                <h3 className="result-title" style={{ color: '#6b7280' }}>Hesaplama Gerekli</h3>
              </div>
              <div className="result-body">
                <div className="result-content">
                  <div style={{ textAlign: 'center', color: '#6b7280' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', color: '#9ca3af' }}>
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 6v6l4 2"></path>
                    </svg>
                    <p style={{ margin: 0, fontSize: '1rem' }}>
                      Üretim adımlarında hesaplama yaparak toplam maliyeti görüntüleyebilirsiniz.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detaylı Maliyet Analizi ve Ürün Bilgileri - Sadece tüm adımlar tamamlandıktan sonra göster */}
        {allStepsCompleted && (
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18"></path>
                  <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                </svg>
              </div>
              <div className="form-section-content">
                <h2 className="form-section-title">Detaylı Maliyet Analizi</h2>
                <p className="form-section-description">Üretim adımlarının detaylı maliyet dağılımı</p>
              </div>
            </div>
            <div className="form-section-body">
              <div className="analysis-grid">
                <div className="cost-breakdown">
                  <h4>💰 Maliyet Dağılımı</h4>
                  <div className="cost-list">
                    {Object.entries(costBreakdown).filter(([key]) => key !== 'kalipBakimMaliyeti').map(([key, value]) => (
                      <div key={key} className={`cost-item ${key === 'toplamMaliyet' ? 'total' : ''}`}>
                        <span>{maliyetLabels[key]}</span>
                        <span className="cost-value">{formatCurrency(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Ürün Bilgileri Bölümü */}
                {(productInfo.adet || productInfo.hammaddeTuru || productInfo.hammaddeTedarikcisi) && (
                  <div className="product-breakdown">
                    <h4>📦 Ürün Bilgileri</h4>
                    <div className="product-list">
                      {productInfo.adet && (
                        <div className="product-item">
                          <span>Adet</span>
                          <span className="product-value">{productInfo.adet}</span>
                        </div>
                      )}
                      {productInfo.hammaddeTuru && (
                        <div className="product-item">
                          <span>Hammadde Türü</span>
                          <span className="product-value">{productInfo.hammaddeTuru}</span>
                        </div>
                      )}
                      {productInfo.hammaddeTedarikcisi && (
                        <div className="product-item">
                          <span>Hammadde Tedarikçisi</span>
                          <span className="product-value">{productInfo.hammaddeTedarikcisi}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hesaplama yapılmadıysa bilgilendirme */}
        {validation.allValid && !hasCalculations && (
          <div className="form-section">
            <div className="form-section-header">
              <div className="form-section-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6l4 2"></path>
                </svg>
              </div>
              <div className="form-section-content">
                <h2 className="form-section-title">Hesaplama Gerekli</h2>
                <p className="form-section-description">Detaylı maliyet analizi için önce hesaplama yapmanız gerekiyor</p>
          </div>
              </div>
            <div className="form-section-body">
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#6b7280',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', color: '#9ca3af' }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6l4 2"></path>
                </svg>
                <p style={{ margin: 0, fontSize: '1rem' }}>
                  Üretim adımlarında hesaplama yaparak detaylı maliyet analizini görüntüleyebilirsiniz.
                </p>
                </div>
              </div>
            </div>
        )}

        {/* Action Buttons */}
        <div className="calculation-actions">
          <button 
            type="button" 
            className="action-btn secondary"
            onClick={() => clearAllData()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
            </svg>
            <span>Temizle</span>
          </button>
          <button 
            type="button" 
            className={`action-btn ${allStepsCompleted ? 'primary' : 'secondary'}`}
            onClick={() => allStepsCompleted && setIsSaveOpen(true)}
            disabled={!allStepsCompleted}
            title={!allStepsCompleted ? 'Tüm adımları tamamlamanız gerekiyor' : 'Hesaplama sonuçlarını kaydet'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17,21 17,13 7,13 7,21"></polyline>
              <polyline points="7,3 7,8 15,8"></polyline>
            </svg>
            <span>Kaydet</span>
          </button>
          <button 
            type="button" 
            className={`action-btn ${allStepsCompleted ? 'primary' : 'secondary'}`}
            onClick={() => allStepsCompleted && exportToExcel()}
            disabled={!allStepsCompleted}
            title={!allStepsCompleted ? 'Tüm adımları tamamlamanız gerekiyor' : 'Excel dosyası olarak dışa aktar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7,10 12,15 17,10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Excel'e Aktar</span>
          </button>
          <button 
            type="button" 
            className={`action-btn ${allStepsCompleted ? 'primary' : 'secondary'}`}
            onClick={() => allStepsCompleted && exportToPDF()}
            disabled={!allStepsCompleted}
            title={!allStepsCompleted ? 'Tüm adımları tamamlamanız gerekiyor' : 'PDF dosyası olarak dışa aktar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            <span>PDF'e Aktar</span>
          </button>
            <button 
              type="button" 
            className="action-btn secondary"
              onClick={() => navigate('/uretim/asama-secim')}
            >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6"></path>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            <span>Yeni Hesaplama</span>
            </button>
        </div>
      </div>

      {/* Modern Step Navigation */}
      <div className="step-navigation-container">
        <StepNav />
      </div>

      {/* Kaydet Modal */}
      {isSaveOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="panel accent" style={{ width: 520, maxWidth: '90%' }}>
            <div className="panel-titlebar">Kaydet – Hesaplama Sonuçları</div>
            <div className="panel-body">
              <div className="field">
                <label>Kayıt Adı</label>
                <input 
                  key={isSaveOpen ? 'save-name-input' : ''}
                  className="input" 
                  placeholder="Örn. Proje A – 17/09" 
                  value={saveName || ''} 
                  onChange={e => {
                    const newValue = e.target.value
                    setSaveName(newValue)
                  }}
                  autoFocus
                />
              </div>
              <div style={{ marginTop: '1rem' }}>
                <h4>Kaydedilecek Bilgiler:</h4>
                <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                  <li>Toplam Maliyet: {formatCurrency(totalCost)}</li>
                  <li>Malzeme Maliyeti: {formatCurrency(costBreakdown.malzemeMaliyeti)}</li>
                  <li>İşçilik Maliyeti: {formatCurrency(costBreakdown.iscilikMaliyeti)}</li>
                  <li>Elektrik Maliyeti: {formatCurrency(costBreakdown.elektrikMaliyeti)}</li>
                  <li>Amortisman Maliyeti: {formatCurrency(costBreakdown.amortismanMaliyeti)}</li>
                  <li>Makine Bakım Maliyeti: {formatCurrency(costBreakdown.makineBakimMaliyeti)}</li>
                  <li>Kalıp Maliyeti: {formatCurrency(costBreakdown.kalipMaliyeti)}</li>
                  <li>Birim Hammadde Maliyeti: {formatCurrency(costBreakdown.birimHammaddeMaliyeti)}</li>
                </ul>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button 
                  className="btn" 
                  onClick={() => {
                    setIsSaveOpen(false)
                    setSaveName('')
                  }}
                >
                  İptal
                </button>
                <button 
                  className="btn primary" 
                  onClick={handleSave}
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
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
    </div>
  )
}