import { useEffect, useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { exportEnjeksiyonRaporuExcelJS, exportPDFWithData } from '../utils/projeRaporExport.js'

function formatCurrency(value) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 4
  }).format(value || 0)
}

// Boş veya geçersiz değerleri 1 olarak yorumlayan yardımcı
const getAdet = (raw) => {
  if (raw === '' || raw == null) return 1
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

// Backend bazı alanları JSON string olarak döndürebilir; güvenli parse
const parseMaybeJson = (value) => {
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return {} }
  }
  return (value && typeof value === 'object') ? value : {}
}

// Sayısal stringleri (virgüllü dahil) sayıya çevirir
const toNumberSafe = (v) => {
  if (typeof v === 'number') return v
  if (v == null) return 0
  const s = String(v).replace(',', '.').trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

// TR/US sayı formatlarını ve binlik ayırıcıları güvenle parse eder
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

// Backend'in PascalCase alanlarını camelCase'e dönüştürür
const normalizeCostKeys = (raw = {}) => {
  const src = raw || {}
  return {
    malzemeMaliyeti: toNumberSafe(src.malzemeMaliyeti ?? src.MalzemeMaliyeti),
    iscilikMaliyeti: toNumberSafe(src.iscilikMaliyeti ?? src.IscilikMaliyeti),
    elektrikMaliyeti: toNumberSafe(src.elektrikMaliyeti ?? src.ElektrikMaliyeti),
    amortismanMaliyeti: toNumberSafe(src.amortismanMaliyeti ?? src.AmortismanMaliyeti),
    makineBakimMaliyeti: toNumberSafe(src.makineBakimMaliyeti ?? src.MakineBakimMaliyeti),
    kalipBakimMaliyeti: toNumberSafe(src.kalipBakimMaliyeti ?? src.KalipBakimMaliyeti),
    kalipMaliyeti: toNumberSafe(src.kalipMaliyeti ?? src.KalipMaliyeti),
    birimBrutAgirlik: toNumberSafe(src.birimBrutAgirlik ?? src.BirimBrutAgirlik),
    birimHammaddeMaliyeti: toNumberSafe(src.birimHammaddeMaliyeti ?? src.BirimHammaddeMaliyeti),
    toplamMaliyet: toNumberSafe(src.toplamMaliyet ?? src.ToplamMaliyet)
  }
}

// allResults/hisaplamaVerileri nesnelerini standart anahtarlarla normalize eder
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

export default function Satis() {
  const [records, setRecords] = useState([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [adetGirisi, setAdetGirisi] = useState({})
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' })
  const [exportingRecordId, setExportingRecordId] = useState(null) // Excel/PDF export yükleniyor durumu

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true)
        
        const res = await fetch('/api/hesaplama/satis-kayitlari', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (res.ok) {
          const data = await res.json()
          setRecords(Array.isArray(data) ? data : [])
        } else {
          console.error('API hatası:', res.status, res.statusText)
          setRecords([])
          setModal({
            isOpen: true,
            title: 'Hata',
            message: 'Satış kayıtları yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyin.',
            type: 'error'
          })
        }
      } catch (error) {
        console.error('Satış kayıtları yüklenirken hata:', error)
        setRecords([])
        setModal({
          isOpen: true,
          title: 'Bağlantı Hatası',
          message: 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
          type: 'error'
        })
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const handleKayitGuncellendi = (event) => {
      const { kayit } = event.detail
      console.log('Satış kaydı güncellendi:', kayit)
      
      setRecords(prev => 
        prev.map(r => r.id === kayit.id ? kayit : r)
      )
    }
    
    window.addEventListener('satisKayitGuncellendi', handleKayitGuncellendi)
    
    return () => {
      window.removeEventListener('satisKayitGuncellendi', handleKayitGuncellendi)
    }
  }, [])

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter(r => !q || String(r.ad||'').toLowerCase().includes(q))
  }, [records, query])

  // Artık ham string'i saklıyoruz ('' dahil). Sayıya çevirme yok.
  const handleAdetChange = (recordId, value) => {
    const digitsOnly = String(value ?? '').replace(/[^\d]/g, '')
    setAdetGirisi(prev => ({
      ...prev,
      [recordId]: digitsOnly // '' olabilir
    }))
  }

  const calculateTotalCost = (record) => {
    // Satış kaydından direkt ToplamMaliyet al (backend hesaplıyor)
    const degerlerObj = parseMaybeJson(record?.degerler)
    const baseToplam = toNumberSafe(
      record?.ToplamMaliyet ?? 
      record?.toplamMaliyet ?? 
      degerlerObj?.toplamMaliyet ?? 
      degerlerObj?.ToplamMaliyet ?? 
      0
    )
    
    const raw = adetGirisi[record.id]
    const adet = getAdet(raw)
    return baseToplam * adet
  }

  const getTotalRevenue = () => {
    return filteredRecords.reduce((total, record) => {
      return total + calculateTotalCost(record)
    }, 0)
  }

  // Satış kaydını backend'de yeniden hesaplat ve sonucu ekrana yansıt
  const normalizeSatisResponse = (resp) => {
    if (!resp || typeof resp !== 'object') return {}
    return {
      id: resp.id ?? resp.Id,
      ad: resp.ad ?? resp.Ad,
      degerler: normalizeCostKeys(parseMaybeJson(resp.degerler || resp.Degerler)),
      formlar: parseMaybeJson(resp.formlar || resp.Formlar),
      allResults: parseMaybeJson(resp.allResults || resp.AllResults),
      hesaplamaVerileri: parseMaybeJson(resp.hesaplamaVerileri || resp.HesaplamaVerileri),
      enjeksiyonId: resp.enjeksiyonId ?? resp.EnjeksiyonId,
      azotluCapakAlmaId: resp.azotluCapakAlmaId ?? resp.AzotluCapakAlmaId,
      posturlemeId: resp.posturlemeId ?? resp.PosturlemeId,
      santrifujId: resp.santrifujId ?? resp.SantrifujId,
      yikamaId: resp.yikamaId ?? resp.YikamaId
    }
  }

  async function recalcRecord(record) {
    try {
      console.log('=== YENİDEN HESAPLAMA BAŞLADI ===')
      const id = record.id || record.gercekId || record.Id
      if (!id) {
        console.error('Kayıt ID bulunamadı')
        return
      }
      
      console.log('Güncellenen kayıt ID:', id)
      
      const payload = {
        ad: record.ad,
        // degerler gönderme – backend kendi hesaplar
        formlar: record.formlar || {},
        enjeksiyonId: record.enjeksiyonId || null,
        azotluCapakAlmaId: record.azotluCapakAlmaId || null,
        posturlemeId: record.posturlemeId || null,
        santrifujId: record.santrifujId || null,
        yikamaId: record.yikamaId || null
      }
      
      console.log('Gönderilen payload:', payload)
      
      const res = await fetch(`/api/hesaplama/satis-kayitlari/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('API hatası:', res.status, errorText)
        throw new Error(`API hatası: ${res.status}`)
      }
      
      const updated = await res.json()
      console.log('API\'den güncellenen veri:', updated)
      
      // *** GÜNCELLENMİŞ VERİYİ API'DEN YENİDEN ÇEK ***
      console.log('Güncel veri API\'den tekrar çekiliyor...')
      const freshData = await fetchSatisKaydiDetay(id)
      
      if (freshData) {
        console.log('Güncel veri alındı:', freshData)
        const normalized = normalizeSatisResponse(freshData)
        setRecords(prev => prev.map(r => (r.id === id ? { ...r, ...normalized } : r)))
        console.log('✓ Kayıt başarıyla güncellendi ve yenilendi')
      } else {
        // Fallback: API'den gelen güncellenmiş veriyi kullan
        const normalized = normalizeSatisResponse(updated)
        setRecords(prev => prev.map(r => (r.id === id ? { ...r, ...normalized } : r)))
        console.log('✓ Kayıt başarıyla güncellendi')
      }
      
      setModal({ 
        isOpen: true, 
        title: 'Başarılı', 
        message: 'Kayıt yeniden hesaplandı ve tüm sonuçlar güncellendi.', 
        type: 'success' 
      })
    } catch (e) {
      console.error('Yeniden hesaplama hatası:', e)
      setModal({ 
        isOpen: true, 
        title: 'Hata', 
        message: `Yeniden hesaplama başarısız oldu: ${e.message}`, 
        type: 'error' 
      })
    }
  }

  // Export öncesi kaydın güncel halini API'den çek
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
        toplamMaliyet = toNumberSafe(data.ToplamMaliyetEuro ?? data.toplamMaliyetEuro ?? data.ToplamMaliyet ?? data.toplamMaliyet)
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

  // *** FRONTEND HESAPLAMA FONKSİYONU KALDIRILDI ***
  // calculateStepResult() artık kullanılmıyor - tüm hesaplamalar API'de yapılıyor
  // Kayıtlı veriler doğrudan API'den çekiliyor (hesaplamaVerileri alanından)

  // Satış kaydındaki verileri kullanarak Excel export - SADECE API'DEN GELEN VERİLERİ KULLAN
  async function exportToExcelFromRecord(record) {
    console.log('=== API\'DEN KAYITLI VERİLER ÇEKİLİYOR ===')
    console.log('Record ID:', record.id || record.gercekId || record.Id)
    
    // Güncel veriyi API'den çek
    const apiRecord = await fetchSatisKaydiDetay(record.id || record.gercekId || record.Id)
    if (!apiRecord) {
      throw new Error('API\'den kayıt verisi alınamadı')
    }
    
    console.log('API\'den gelen kayıt:', apiRecord)
    console.log('[DEBUG] satis-kaydi json:', apiRecord)
    
    // Her süreç için API'den toplam maliyet çek
    const surecMaliyetleri = await fetchTumSurecler(apiRecord)
    
    console.log('=== TÜM SÜREÇ MALİYETLERİ (API\'DEN) ===')
    console.log(surecMaliyetleri)
    
    // degerler objesi - malzeme ve kalıp maliyeti için
    const degerlerObj = parseMaybeJson(apiRecord.degerler || apiRecord.Degerler)
    console.log('degerler objesi:', degerlerObj)

    // Record'dan form verilerini çıkar (JSON string olabilir)
    const formlar = parseMaybeJson(apiRecord.formlar || apiRecord.Formlar)
    const enjeksiyonForm = formlar.enjeksiyon || {}
    const shared = parseMaybeJson(apiRecord.shared || apiRecord.Shared)
    
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
    
    // *** FRONTEND HESAPLAMA KALDIRILDI - SADECE API VERİLERİ KULLANILIYOR ***
    
    // birimBrutAgirlik ve birimHammaddeMaliyeti değerlerini API'den al
    const baskiToplamBrut = enjeksiyonForm.baskiToplamBrut || shared.baskiToplamBrut || 0
    const kalipGozSayisi = enjeksiyonForm.kalipGozSayisi || 0
    const hammaddeFiyatiEuro = enjeksiyonForm.hammaddeFiyatiEuro || 0
    
    // Sadece hesaplama için gerekli minimum bilgiler
    const hesaplananBirimBrutAgirlik = (baskiToplamBrut > 0 && kalipGozSayisi > 0) 
      ? (baskiToplamBrut / kalipGozSayisi) : 0
    const hesaplananBirimHammaddeMaliyeti = (hesaplananBirimBrutAgirlik > 0) 
      ? (hammaddeFiyatiEuro * hesaplananBirimBrutAgirlik) : 0

    const finalForm = {
      hammaddeTuru: enjeksiyonForm.hammaddeTuru || '',
      hammaddeTedarikcisi: enjeksiyonForm.hammaddeTedarikcisi || '',
      kalipTedarikcisi: enjeksiyonForm.kalipTedarikcisi || '',
      hammaddeFiyatiEuro: hammaddeFiyatiEuro,
      baskiToplamBrut: baskiToplamBrut,
      birimBrutAgirlik: enjeksiyonForm.birimBrutAgirlik || 
                        degerler.birimBrutAgirlik || 
                        shared.birimBrutAgirlik || 
                        hesaplananBirimBrutAgirlik,
      birimHammaddeMaliyeti: enjeksiyonForm.birimHammaddeMaliyeti || 
                             degerler.birimHammaddeMaliyeti || 
                             shared.birimHammaddeMaliyeti || 
                             hesaplananBirimHammaddeMaliyeti,
      adet: enjeksiyonForm.adet || 1,
      euroKuru: enjeksiyonForm.euroKuru || shared.euroKuru || ''
    }

    console.log('Final form (Excel için):', finalForm)
    console.log('Degerler:', degerler)

    // *** API'DEN GELEN SÜREÇ MALİYETLERİNİ KULLAN ***
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
    // id: Satış kaydı Id'si
    const id = apiRecord.id || apiRecord.Id || record.id || record.Id
    const res = await fetch(`/api/hesaplama/satis-kayitlari/${id}/kalipmaliyeti?_t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!res.ok) throw new Error('Kalip maliyeti alınamadı')
    const value = await res.json()           // decimal veya null döner
    const kalipMaliyeti = Number(value ?? 0) // NaN riskine karşı default 0
    console.log('[DEBUG] kalipMaliyetiToplam:', kalipMaliyeti, typeof kalipMaliyeti)

    const enjeksiyonResult = {
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

    console.log('=== SATIŞ EXCEL EXPORT DEBUG ===')
    console.log('finalForm:', finalForm)
    console.log('birimBrutAgirlik (finalForm):', finalForm.birimBrutAgirlik)
    console.log('birimHammaddeMaliyeti (finalForm):', finalForm.birimHammaddeMaliyeti)
    console.log('degerler:', degerler)
    console.log('shared:', shared)
    console.log('enjeksiyonForm:', enjeksiyonForm)
    console.log('enjeksiyonResult:', enjeksiyonResult)
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
      const satisId = apiRecord.id || apiRecord.Id || record.id || record.Id
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
    await exportEnjeksiyonRaporuExcelJS({
      enjeksiyonForm: finalForm,
      enjeksiyonResult,
      costBreakdown,
      totalCost,
      allResults: finalAllResults,
      shared,
      projeAdi: apiRecord.ad || apiRecord.Ad || record.ad,
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
      message: `${record.ad} projesi için Excel dosyası başarıyla oluşturuldu ve indirildi.`,
      type: 'success'
    })
  }

  // Excel export fonksiyonu - Her kart için ayrı
  async function exportToExcel(record) {
    try {
      setExportingRecordId(record.id)
      console.log('Excel export için record:', record)
      
      // Satış kaydından süreç maliyetlerini çek ve Excel oluştur
      await exportToExcelFromRecord(record)

    } catch (error) {
      console.error('Excel export hatası:', error)
      setModal({
        isOpen: true,
        title: 'Hata',
        message: `Excel dosyası oluşturulurken bir hata oluştu: ${error.message}`,
        type: 'error'
      })
    } finally {
      setExportingRecordId(null)
    }
  }

  // PDF export fonksiyonu - Sonuçlar kısmındaki gibi düzeltildi
  async function exportToPDF(record) {
    try {
      setExportingRecordId(record.id)
      console.log('=== SATIŞ PDF EXPORT DEBUG ===')
      console.log('PDF export için record:', record)
      
      // Güncel veriyi API'den çek (başarısızsa parametre kullanılır)
      const apiRecord = await fetchSatisKaydiDetay(record.id || record.gercekId || record.Id)
      const srcRecord = apiRecord || record

      console.log('=== PDF: SATIŞ KAYDINDAKI MALİYET ALANLARI ===')
      
      // Her süreç için API'den toplam maliyet çek
      const surecMaliyetleriPdf = await fetchTumSurecler(srcRecord)
      
      console.log('=== PDF: TÜM SÜREÇ MALİYETLERİ (API\'DEN) ===')
      console.log(surecMaliyetleriPdf)
      
      // degerler objesi - malzeme maliyeti için
      const degerlerObjPdf = parseMaybeJson(srcRecord.degerler || srcRecord.Degerler)
      console.log('PDF: degerler objesi (malzeme için):', degerlerObjPdf)

      // Sonuçlar kısmındaki gibi form verilerini al (JSON string olabilir)
      const formlar = parseMaybeJson(srcRecord.formlar || srcRecord.Formlar)
      const enjeksiyonForm = formlar.enjeksiyon || {}
      
      // Sonuçlar kısmındaki gibi birimBrutAgirlik ve birimHammaddeMaliyeti değerlerini hesapla
      const baskiToplamBrut = enjeksiyonForm.baskiToplamBrut || 0
      const kalipGozSayisi = enjeksiyonForm.kalipGozSayisi || 0
      const hammaddeFiyatiEuro = enjeksiyonForm.hammaddeFiyatiEuro || 0
      
      const hesaplananBirimBrutAgirlik = (baskiToplamBrut > 0 && kalipGozSayisi > 0) ? (baskiToplamBrut / kalipGozSayisi) : 0
      const hesaplananBirimHammaddeMaliyeti = (hesaplananBirimBrutAgirlik > 0) ? (hammaddeFiyatiEuro * hesaplananBirimBrutAgirlik) : 0
      
      // Sonuçlar kısmındaki gibi enjeksiyonForm'u hazırla
      const enjeksiyonFormWithBirimBrutAgirlik = {
        ...enjeksiyonForm,
        birimBrutAgirlik: enjeksiyonForm.birimBrutAgirlik || 
                         record.degerler?.birimBrutAgirlik || 
                         record.shared?.birimBrutAgirlik || 
                         hesaplananBirimBrutAgirlik,
        birimHammaddeMaliyeti: enjeksiyonForm.birimHammaddeMaliyeti || 
                              record.degerler?.birimHammaddeMaliyeti || 
                              record.shared?.birimHammaddeMaliyeti || 
                              hesaplananBirimHammaddeMaliyeti
      }
      
      console.log('=== SATIŞ PDF DEBUG - HESAPLANAN DEĞERLER ===')
      console.log('baskiToplamBrut:', baskiToplamBrut)
      console.log('kalipGozSayisi:', kalipGozSayisi)
      console.log('hammaddeFiyatiEuro:', hammaddeFiyatiEuro)
      console.log('hesaplananBirimBrutAgirlik:', hesaplananBirimBrutAgirlik)
      console.log('hesaplananBirimHammaddeMaliyeti:', hesaplananBirimHammaddeMaliyeti)
      console.log('enjeksiyonFormWithBirimBrutAgirlik:', enjeksiyonFormWithBirimBrutAgirlik)

      // *** API'DEN GELEN SÜREÇ MALİYETLERİNİ KULLAN ***
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
      const shared = parseMaybeJson(srcRecord.shared || srcRecord.Shared)
      shared.birimBrutAgirlik = enjeksiyonFormWithBirimBrutAgirlik.birimBrutAgirlik || shared.birimBrutAgirlik || 0
      shared.birimHammaddeMaliyeti = enjeksiyonFormWithBirimBrutAgirlik.birimHammaddeMaliyeti || shared.birimHammaddeMaliyeti || 0
      
      console.log('=== SATIŞ PDF DEBUG - FINAL VERİLER ===')
      console.log('enjeksiyonFormWithBirimBrutAgirlik:', enjeksiyonFormWithBirimBrutAgirlik)
      console.log('shared:', shared)
      console.log('finalAllResults:', finalAllResults)
      console.log('record.degerler:', record.degerler)

      // Malzeme maliyeti için degerler objesini kullan
      const degerlerNormalizedPdf = normalizeCostKeys(degerlerObjPdf)
      const malzemeMaliyetiPdf = degerlerNormalizedPdf.malzemeMaliyeti
      // Kalıp maliyetini doğrudan satis-kayitlari/{id}/kalipmaliyeti endpointinden çek (PDF)
      let kalipMaliyetiPdf = 0
      let yanUrunTuruExcel = undefined
      let yanUrunMaliyetiExcel = undefined
      let adetToplamUrunMaliyetiExcel = undefined
      const satisIdPdf = srcRecord.id || srcRecord.Id
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
        enjeksiyonForm: enjeksiyonFormWithBirimBrutAgirlik,
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
        shared,
        enjeksiyonResult: {
          malzemeMaliyeti: malzemeMaliyetiPdf,
          toplamMaliyet: finalAllResults.enjeksiyon.toplamMaliyet,
          birimHammaddeMaliyeti: 0
        },
        allResults: finalAllResults || {},
        projeAdi: srcRecord.ad || srcRecord.Ad || record.ad,
        kayitId: srcRecord.enjeksiyonId,
        satisKayitId: srcRecord.id || srcRecord.Id,
        kalipMaliyeti: kalipMaliyetiPdf,
        yanUrunTuru: yanUrunTuruExcel,
        yanUrunMaliyeti: yanUrunMaliyetiExcel,
        adetToplamUrunMaliyeti: adetToplamUrunMaliyetiExcel
      })

      setModal({
        isOpen: true,
        title: 'Başarılı',
        message: `${record.ad} projesi için PDF dosyası başarıyla oluşturuldu ve indirildi.`,
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
    } finally {
      setExportingRecordId(null)
    }
  }

  return (
    <div className="sales-container">
      {/* Modern Header */}
      <div className="sales-header">
        <div className="sales-header-content">
          <div className="sales-title-section">
            <h1 className="sales-title">Satış Yönetimi</h1>
            <p className="sales-subtitle">Projelerinizi takip edin, maliyet analizlerinizi görüntüleyin ve satış süreçlerinizi yönetin</p>
          </div>
          <div className="sales-stats">
            <div className="stat-item">
              <span className="stat-number">{records.length}</span>
              <span className="stat-label">Toplam Proje</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{filteredRecords.length}</span>
              <span className="stat-label">Filtrelenmiş</span>
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
              placeholder="Proje adı, ürün kategorisi veya tarih ara..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button 
                className="search-clear"
                onClick={() => setQuery('')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
          
          <div className="filters-row">
            <button 
              onClick={() => window.location.reload()} 
              className="refresh-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="loading-spinner-small"></div>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23,4 23,10 17,10"></polyline>
                  <polyline points="1,20 1,14 7,14"></polyline>
                  <path d="M20.49,9A9,9,0,0,0,5.64,5.64L1,10m22,4L18.36,18.36A9,9,0,0,1,3.51,15"></path>
                </svg>
              )}
              {isLoading ? 'Yükleniyor...' : 'Yenile'}
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Kayıtlar yükleniyor...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && records.length === 0 && (
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
          <h3>Henüz kayıt bulunmuyor</h3>
          <p>Üretim hesaplamalarından yeni projeler oluşturabilirsiniz</p>
        </div>
      )}

      {/* Sales Grid */}
      {!isLoading && records.length > 0 && (
        <div className="sales-grid">
          {filteredRecords.map((rec, idx) => {
            const toplam = rec?.degerler?.toplamMaliyet || 0
            const uid = rec?.id != null ? String(rec.id) : `local-${idx}`
            const tarih = new Date(rec.tarih || Date.now())
            const rawAdet = adetGirisi[rec.id] ?? '' // ham string
            const adet = getAdet(rawAdet)             // türetilmiş sayı
            const toplamMaliyet = calculateTotalCost(rec)
            
            return (
              <div key={uid} className="sales-card">
                <div className="project-header">
                  <div className="project-title-section">
                    <h3 className="project-title">{rec.ad}</h3>
                    <div className="project-badges">
                      <span className="status-badge active">Aktif</span>
                     
                    </div>
                  </div>
                </div>
                
                <div className="project-description">
                  <p>Proje Kayıt - {tarih.toLocaleDateString('tr-TR')}</p>
                </div>

                <div className="project-cost">
                  <div className="cost-info">
                    <span className="cost-label">Toplam Maliyet</span>
                    <span className="cost-value">{formatCurrency(toplamMaliyet)}</span>
                  </div>
                </div>

                <div className="quantity-section">
                  <div className="quantity-label">Adet Seçimi</div>
                  <div className="quantity-controls">
                    <button 
                      className="quantity-btn decrease"
                      onClick={() => {
                        const next = Math.max(1, adet - 1)
                        setAdetGirisi(prev => ({ ...prev, [rec.id]: String(next) }))
                      }}
                      disabled={adet <= 1}
                      title="Azalt"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                    <input
                      type="text"             // '' ile tam uyumlu
                      inputMode="numeric"     // mobil klavyeyi sayısal yapar
                      value={rawAdet}         // '' olabilir; kullanıcı 1 yazınca 1 görünür
                      onChange={(e) => handleAdetChange(rec.id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => {
                        // İstersen blur'da boşsa 1'e sabitle
                        // if ((rawAdet ?? '') === '') {
                        //   setAdetGirisi(prev => ({ ...prev, [rec.id]: '1' }))
                        // }
                      }}
                      className="quantity-input"
                      placeholder="1"
                    />
                    <button 
                      className="quantity-btn increase"
                      onClick={() => {
                        const next = adet + 1
                        setAdetGirisi(prev => ({ ...prev, [rec.id]: String(next) }))
                      }}
                      title="Artır"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="card-actions">
                  <button 
                    onClick={() => exportToExcel(rec)}
                    className="excel-export-btn"
                    title="Excel dosyası olarak dışa aktar"
                    disabled={exportingRecordId === rec.id}
                  >
                    {exportingRecordId === rec.id ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Yükleniyor...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7,10 12,15 17,10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Excel
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => exportToPDF(rec)}
                    className="pdf-export-btn"
                    title="PDF dosyası olarak dışa aktar"
                    disabled={exportingRecordId === rec.id}
                  >
                    {exportingRecordId === rec.id ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Yükleniyor...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14,2 14,8 20,8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                          <polyline points="10,9 9,9 8,9"></polyline>
                        </svg>
                        PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* No Results State */}
      {!isLoading && records.length > 0 && filteredRecords.length === 0 && (
        <div className="no-results">
          <div className="no-results-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
          <h3>Üretim Depertmanına Danışın</h3>
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
