// excel-export.js
import ExcelJS from 'exceljs'
import { PDFDocument, rgb } from 'pdf-lib'
import { authService } from '../simple-auth-service.js'

/**
 * Enjeksiyon süreci hesaplama raporunu ExcelJS ve public şablon ile export eder.
 * Şablondaki biçimlendirmeler (renk, kenarlık, birleştirme, numara formatı) korunur.
 *
 * @param {Object} params
 * @param {Object} params.enjeksiyonForm
 * @param {Object} params.enjeksiyonResult
 * @param {Object} params.costBreakdown
 * @param {number} params.totalCost
 * @param {string} [params.sheetName='Hesaplama Raporu'] - Şablondaki sayfa adı
 * @returns {Promise<boolean>}
 */
export async function exportEnjeksiyonRaporuExcelJS({
  enjeksiyonForm = {},
  enjeksiyonResult = {},
  costBreakdown = {},
  totalCost = 0,
  allResults,
  shared = {},
  sheetName = 'Hesaplama Raporu',
  // Opsiyonel: API'den getirilen Net Üretim Maliyeti (decimal)
  netUretimMaliyetiExcel,
  // Opsiyonel: API'den getirilen Toplam Hammadde Maliyeti (decimal)
  toplamHammaddeMaliyetiExcel,
  // Opsiyonel: Enjeksiyon bazlı kalıp maliyeti (decimal)
  kalipMaliyetiExcel,
  // Opsiyonel: Yan ürün türü (string)
  yanUrunTuruExcel,
  // Opsiyonel: Yan ürün toplam maliyeti (decimal)
  yanUrunMaliyetiExcel,
  // Opsiyonel: Adet toplam ürün maliyeti (decimal)
  adetToplamUrunMaliyetiExcel
}) {
  try {
    console.log('ExcelJS export fonksiyonu çağrıldı:', {
      enjeksiyonForm,
      enjeksiyonResult,
      costBreakdown,
      totalCost,
      allResults
    })
    
    console.log('=== ALLRESULTS DETAY (KAYDA AİT) ===')
    console.log('allResults:', allResults)
    console.log('typeof allResults:', typeof allResults)
    console.log('Object.keys(allResults):', Object.keys(allResults || {}))
    console.log('enjeksiyonResult:', enjeksiyonResult)
    console.log('enjeksiyonResult.toplamMaliyet:', enjeksiyonResult?.toplamMaliyet)

    // 1) ŞABLONU YÜKLE
    // Public klasöründeki dosyalar her zaman root'tan erişilebilir
    const templateUrl = '/Enjeksiyon_Sureci_Sablon.xlsx'

    console.log('Şablon URL:', templateUrl)

    const res = await fetch(templateUrl, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Şablon okunamadı. HTTP ${res.status}`)

    const arrayBuf = await res.arrayBuffer()

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arrayBuf)

    // 2) SAYFAYI AL
    const ws = workbook.getWorksheet(sheetName) || workbook.worksheets[0]
    if (!ws) throw new Error('Şablonda çalışma sayfası bulunamadı.')

    // 3) KISA YARDIMCILAR
    const toNum = (v) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }

    const setCurrency = (addr, val) => {
      const c = ws.getCell(addr)
      c.value = toNum(val)
      c.numFmt = '€ #,##0.00;[Red]-€ #,##0.00'
    }

    const setNumber = (addr, val, numFmt = '#,##0.0000') => {
      const c = ws.getCell(addr)
      c.value = toNum(val)
      c.numFmt = numFmt
    }

    const setText = (addr, val) => {
      ws.getCell(addr).value = (val ?? '').toString()
    }

    const setDate = (addr, date = new Date()) => {
      const c = ws.getCell(addr)
      c.value = date
      // Excel tarihlerinde numFmt ayarlarsan görünüm korunur (şablonda format varsa bunu atlama istersen)
      c.numFmt = 'dd.mm.yyyy'
    }

    // 4) HÜCRE DOLDURMA (şablon adreslerine göre)

    console.log('Hücrelere veri yazılıyor...')

    // Tarih
    setDate('F8', new Date())
    console.log('F8 hücresine tarih yazıldı')

    // HAMMADDE BİLGİLERİ
    console.log('Hammadde bilgileri yazılıyor:', {
      hammaddeTuru: enjeksiyonForm.hammaddeTuru,
      hammaddeTedarikcisi: enjeksiyonForm.hammaddeTedarikcisi,
      hammaddeFiyatiEuro: enjeksiyonForm.hammaddeFiyatiEuro,
      baskiToplamBrut: enjeksiyonForm.baskiToplamBrut,
      birimBrutAgirlik: enjeksiyonForm.birimBrutAgirlik
    })
    
    console.log('=== D20 BİRİM BRUT AĞIRLIK DEBUG ===')
    console.log('enjeksiyonForm.birimBrutAgirlik:', enjeksiyonForm.birimBrutAgirlik)
    console.log('shared.birimBrutAgirlik:', shared.birimBrutAgirlik)
    console.log('costBreakdown.birimBrutAgirlik:', costBreakdown.birimBrutAgirlik)
    console.log('enjeksiyonForm objesi:', enjeksiyonForm)
    console.log('shared objesi:', shared)
    console.log('costBreakdown objesi:', costBreakdown)

    setText('D17',  enjeksiyonForm.hammaddeTuru)
    setText('D18',  enjeksiyonForm.hammaddeTedarikcisi)
    setCurrency('D19',  enjeksiyonForm.hammaddeFiyatiEuro)        // €/Kg
    const birimBrutAgirlikDegeri = enjeksiyonForm.birimBrutAgirlik || 
                                   shared.birimBrutAgirlik || 
                                   costBreakdown.birimBrutAgirlik || 0
    
    console.log('D20 hücresine yazılacak değer:', birimBrutAgirlikDegeri)
    console.log('D20 hücresine yazılıyor...')
    setNumber('D20', birimBrutAgirlikDegeri, '#,##0.0000') // Kg (1 adet ürün) - önce enjeksiyonForm'dan al
    console.log('D20 hücresi yazıldı')

    // Birim ve toplam hammadde maliyeti
    console.log('Maliyet bilgileri yazılıyor:', {
      malzemeMaliyeti: enjeksiyonResult.malzemeMaliyeti,
      toplamMalzemeMaliyeti: costBreakdown.malzemeMaliyeti
    })

    console.log('=== D21 BİRİM HAMMADDE MALİYETİ DEBUG ===')
    console.log('enjeksiyonForm.birimHammaddeMaliyeti:', enjeksiyonForm.birimHammaddeMaliyeti)
    console.log('enjeksiyonResult.birimHammaddeMaliyeti:', enjeksiyonResult.birimHammaddeMaliyeti)
    console.log('shared.birimHammaddeMaliyeti:', shared.birimHammaddeMaliyeti)
    console.log('costBreakdown.birimHammaddeMaliyeti:', costBreakdown.birimHammaddeMaliyeti)
    console.log('enjeksiyonForm objesi:', enjeksiyonForm)
    console.log('shared objesi:', shared)
    console.log('costBreakdown objesi:', costBreakdown)
    const birimHammaddeMaliyetiDegeri = enjeksiyonForm.birimHammaddeMaliyeti || 
                                        shared.birimHammaddeMaliyeti || 
                                        enjeksiyonResult.birimHammaddeMaliyeti || 
                                        costBreakdown.birimHammaddeMaliyeti || 0
    
    console.log('D21 hücresine yazılacak değer (birimHammaddeMaliyeti):', birimHammaddeMaliyetiDegeri)
    console.log('D21 hücresine yazılıyor (birimHammaddeMaliyeti)...')
    setNumber('D21', birimHammaddeMaliyetiDegeri, '#,##0.0000')
    console.log('D21 hücresi yazıldı')
    // D22: Toplam Hammadde Maliyeti – sadece parametre verilirse yaz
    if (toplamHammaddeMaliyetiExcel != null) {
      setNumber('D22', toplamHammaddeMaliyetiExcel, '#,##0.0000')
      console.log('D22 hücresine toplamHammaddeMaliyeti yazıldı:', toplamHammaddeMaliyetiExcel)
    }

    // D25: Yan ürün türü – sadece parametre verilirse yaz
    if (yanUrunTuruExcel != null && yanUrunTuruExcel !== '') {
      setText('D25', String(yanUrunTuruExcel))
      console.log('D25 hücresine yanUrunTuru yazıldı:', yanUrunTuruExcel)
    }

    // D29: Yan ürün toplam maliyeti – sadece parametre verilirse yaz
    if (yanUrunMaliyetiExcel != null) {
      setNumber('D29', yanUrunMaliyetiExcel, '#,##0.0000')
      console.log('D29 hücresine yanUrunMaliyeti yazıldı:', yanUrunMaliyetiExcel)
    }

    // D30: Adet Toplam Ürün Maliyeti – sadece parametre verilirse yaz
    if (adetToplamUrunMaliyetiExcel != null) {
      setNumber('D30', adetToplamUrunMaliyetiExcel, '#,##0.0000')
      console.log('D30 hücresine adetToplamUrunMaliyeti yazıldı:', adetToplamUrunMaliyetiExcel)
    }

    // MALİYET DAĞILIMI
    console.log('Alt süreç maliyetleri yazılıyor:', {
      enjeksiyon: allResults.enjeksiyon?.toplamMaliyet || 0,
      santrifuj: allResults.santrifuj?.toplamMaliyet || 0,
      azotlu: allResults.azotlu?.toplamMaliyet || 0,
      posturleme: allResults.posturleme?.toplamMaliyet || 0,
      yikama: allResults.yikama?.toplamMaliyet || 0
    })

    // *** D32-D36: TÜM SÜREÇ MALİYETLERİ - KAYDA AİT DEĞERLER ***
    const enjeksiyonMaliyeti = allResults?.enjeksiyon?.toplamMaliyet || 
                                enjeksiyonResult?.toplamMaliyet || 
                                0
    const santrifujMaliyeti = allResults?.santrifuj?.toplamMaliyet || 0
    const azotluMaliyeti = allResults?.azotlu?.toplamMaliyet || 0
    const posturlemeMaliyeti = allResults?.posturleme?.toplamMaliyet || 0
    const yikamaMaliyeti = allResults?.yikama?.toplamMaliyet || 0
    
    console.log('=== EXCEL HÜCRELERİNE YAZILACAK MALİYETLER ===')
    console.log('D32 (Enjeksiyon):', enjeksiyonMaliyeti)
    console.log('D33 (Santrifüj):', santrifujMaliyeti)
    console.log('D34 (Azotlu):', azotluMaliyeti)
    console.log('D35 (Post-Kürleme):', posturlemeMaliyeti)
    console.log('D36 (Yıkama):', yikamaMaliyeti)
    
    setNumber('D32', enjeksiyonMaliyeti, '#,##0.0000')       // Enjeksiyon Basım
    setNumber('D33', santrifujMaliyeti, '#,##0.0000')        // Kaba Çapak Alma
    setNumber('D34', azotluMaliyeti, '#,##0.0000')           // Azotlu Çapak Alma
    setNumber('D35', posturlemeMaliyeti, '#,##0.0000')       // Post-Kürleme
    setNumber('D36', yikamaMaliyeti, '#,##0.0000')           // Yıkama

    // Net Üretim Maliyeti (API hesaplı) -> D41
    if (netUretimMaliyetiExcel != null) {
      setNumber('D41', netUretimMaliyetiExcel, '#,##0.0000')
    }

  

    // Enjeksiyon bazlı kalıp maliyeti -> E39 (parametre verilirse yaz)
    if (kalipMaliyetiExcel != null) {
      setNumber('E39', kalipMaliyetiExcel, '#,##0.0000')
      console.log('E39 hücresine kalipMaliyeti yazıldı:', kalipMaliyetiExcel)
    }

    setNumber('D43', totalCost, '#,##0.0000')

    // TOPLAM
    //setNumber('D43', totalCost/allResults?.adet, '#,##0.0000')

    // 5) İNDİRME – TARAYICI
    const fileName = `Enjeksiyon_Sureci_${new Date().toISOString().split('T')[0]}.xlsx`
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    // hafıza sızıntısı olmasın
    setTimeout(() => URL.revokeObjectURL(link.href), 0)

    return true
  } catch (err) {
    console.error('ExcelJS export hatası:', err)
    throw err
  }
}

/**
 * PDF şablonunu doldurarak export eder
 * @param {Object} params
 * @param {Object} params.enjeksiyonForm
 * @param {Object} params.costBreakdown
 * @param {Object} params.shared
 * @param {Object} params.enjeksiyonResult
 * @param {Object} params.allResults
 * @returns {Promise<boolean>}
 */
export async function exportPDFWithData({
  enjeksiyonForm = {},
  costBreakdown = {},
  shared = {},
  enjeksiyonResult = {},
  allResults = {},
  toplamHammaddeMaliyeti: toplamHammaddeMaliyetiParam,
  kayitId,
  // Net üretim maliyeti: dışarıdan parametre veya satış kaydı ID ile fetch
  netUretimMaliyeti: netUretimMaliyetiParam,
  satisKayitId,
  // Excel ile senkron: kalıp maliyeti dışarıdan parametre olarak kullanılacak
  kalipMaliyeti: kalipMaliyetiParam,
  // Yan ürün türü parametresi
  yanUrunTuru: yanUrunTuruParam,
  // Yan ürün maliyeti parametresi
  yanUrunMaliyeti: yanUrunMaliyetiParam,
  // Adet toplam ürün maliyeti parametresi
  adetToplamUrunMaliyeti: adetToplamUrunMaliyetiParam
}) {
  try {
    console.log('PDF export fonksiyonu çağrıldı:', { enjeksiyonForm })

    console.log('=== PDF: KAYDA AİT VERİLER KULLANILIYOR ===')

    // JSON string gelebilecek alanları güvenli parse et
    const parseMaybeJson = (value) => {
      if (typeof value === 'string') {
        try { return JSON.parse(value) } catch { return {} }
      }
      return (value && typeof value === 'object') ? value : {}
    }

    const parsedAllResults = parseMaybeJson(allResults)
    const parsedCostRaw = parseMaybeJson(costBreakdown)
    const toNumberSafe = (v) => {
      if (typeof v === 'number') return v
      if (v == null) return 0
      let s = String(v).trim()
      // Olası formatlar:
      //  - "36867.187500" (US) => direkt Number
      //  - "36.867,187500" (TR) => nokta binlik, virgül ondalık
      //  - "36,867.187500" (karma) => virgül binlik, nokta ondalık
      if (s.includes(',') && s.includes('.')) {
        // Son görünen ayırıcı ondalık kabul edilir
        const lastDot = s.lastIndexOf('.')
        const lastComma = s.lastIndexOf(',')
        if (lastComma > lastDot) {
          // TR: ondalık "," -> önce tüm nokta (binlik) sil, sonra virgülü noktaya çevir
          s = s.replace(/\./g, '').replace(',', '.')
        } else {
          // US: ondalık "." -> tüm virgülleri (binlik) sil
          s = s.replace(/,/g, '')
        }
      } else if (s.includes(',')) {
        // Sadece virgül varsa ondalık olarak düşün
        s = s.replace(/\./g, '').replace(',', '.')
      } else {
        // Sadece nokta varsa veya düz sayı
        s = s.replace(/,/g, '')
      }
      const n = Number(s)
      return Number.isFinite(n) ? n : 0
    }
    const parsedCost = {
      malzemeMaliyeti: toNumberSafe(parsedCostRaw.malzemeMaliyeti ?? parsedCostRaw.MalzemeMaliyeti),
      iscilikMaliyeti: toNumberSafe(parsedCostRaw.iscilikMaliyeti ?? parsedCostRaw.IscilikMaliyeti),
      elektrikMaliyeti: toNumberSafe(parsedCostRaw.elektrikMaliyeti ?? parsedCostRaw.ElektrikMaliyeti),
      amortismanMaliyeti: toNumberSafe(parsedCostRaw.amortismanMaliyeti ?? parsedCostRaw.AmortismanMaliyeti),
      makineBakimMaliyeti: toNumberSafe(parsedCostRaw.makineBakimMaliyeti ?? parsedCostRaw.MakineBakimMaliyeti),
      kalipBakimMaliyeti: toNumberSafe(parsedCostRaw.kalipBakimMaliyeti ?? parsedCostRaw.KalipBakimMaliyeti),
      kalipMaliyeti: toNumberSafe(parsedCostRaw.kalipMaliyeti ?? parsedCostRaw.KalipMaliyeti),
      birimHammaddeMaliyeti: toNumberSafe(parsedCostRaw.birimHammaddeMaliyeti ?? parsedCostRaw.BirimHammaddeMaliyeti),
      toplamMaliyet: toNumberSafe(parsedCostRaw.toplamMaliyet ?? parsedCostRaw.ToplamMaliyet)
    }
    const parsedShared = parseMaybeJson(shared)

    // 1) ŞABLONU YÜKLE
    // Public klasöründeki dosyalar her zaman root'tan erişilebilir
    const templateUrl = '/Enjeksiyon_Sureci.pdf'

    console.log('PDF Şablon URL:', templateUrl)

    const res = await fetch(templateUrl, { cache: 'no-store' })
    if (!res.ok) throw new Error(`PDF şablonu okunamadı. HTTP ${res.status}`)

    const arrayBuf = await res.arrayBuffer()

    // 2) PDF'İ YÜKle
    const pdfDoc = await PDFDocument.load(arrayBuf)
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]

    // 3) VERİLERİ YAZDIR
    const hammaddeTuru = enjeksiyonForm.hammaddeTuru || ''
    const hammaddeTedarikcisi = enjeksiyonForm.hammaddeTedarikcisi || ''
    const hammaddeFiyati = (enjeksiyonForm.hammaddeFiyatiEuro || 0).toString()
    
    // Birim Brut Ağırlık - Excel'deki gibi öncelik sırası
    const birimBrutAgirlikDegeri = enjeksiyonForm.birimBrutAgirlik || 
                                   parsedShared.birimBrutAgirlik || 
                                   parsedCost.birimBrutAgirlik || 0
    const birimBrutAgirlik = Number(birimBrutAgirlikDegeri || 0).toFixed(4)
    
    // Birim Hammadde Maliyeti: Excel ile aynı öncelik sırası (form/shared/result/costBreakdown)
    const birimHammaddeMaliyetiDegeriPdf = enjeksiyonForm.birimHammaddeMaliyeti || 
                                           parsedShared.birimHammaddeMaliyeti || 
                                           enjeksiyonResult.birimHammaddeMaliyeti || 
                                           parsedCost.birimHammaddeMaliyeti || 0
    // PDF'deki değer 1000 kat büyük geldiği için 1000'e bölüyoruz
    const birimHammaddeMaliyeti = (Number(birimHammaddeMaliyetiDegeriPdf) / 1000).toFixed(4)
    
    let toplamHammaddeMaliyetiValue = 0
    if (toplamHammaddeMaliyetiParam != null) {
      toplamHammaddeMaliyetiValue = toNumberSafe(toplamHammaddeMaliyetiParam)
    } else if (kayitId != null) {
      try {
        const urlToplam = `${authService.baseURL}/hesaplama/enjeksiyon/${kayitId}/toplamhammadde`
        console.log('ToplamHammaddeMaliyetiEuro fetch URL:', urlToplam)
        const respToplam = await fetch(urlToplam, { headers: { 'Accept': 'application/json' }, cache: 'no-store' })
        console.log('ToplamHammaddeMaliyetiEuro HTTP status:', respToplam.status)
        if (respToplam.ok) {
          const apiVal = await respToplam.json()
          console.log('ToplamHammaddeMaliyetiEuro API değeri (ham):', apiVal, 'typeof:', typeof apiVal)
          toplamHammaddeMaliyetiValue = toNumberSafe(apiVal)
          console.log('ToplamHammaddeMaliyetiEuro parse sonrası:', toplamHammaddeMaliyetiValue)
        }
      } catch (e) {
        console.warn('ToplamHammaddeMaliyeti fetch başarısız, 0 yazılacak:', e)
      }
    }
    const toplamHammaddeMaliyeti = toplamHammaddeMaliyetiValue.toString()

    // Kalıp Maliyeti – satis-kayitlari/{id}/kalipmaliyeti endpointinden alınır (parametre öncelikliyse kullanılır)
    let kalipMaliyetiValue = null
    if (kalipMaliyetiParam != null) {
      kalipMaliyetiValue = toNumberSafe(kalipMaliyetiParam)
      console.log('KalıpMaliyeti param kullanılıyor (PDF):', kalipMaliyetiValue)
    } else if (satisKayitId != null) {
      try {
        const urlKalip = `${authService.baseURL}/hesaplama/satis-kayitlari/${satisKayitId}/kalipmaliyeti`
        console.log('KalıpMaliyeti fetch URL (satis-kayitlari):', urlKalip)
        const respKalip = await fetch(urlKalip, { headers: { 'Accept': 'application/json' }, cache: 'no-store' })
        console.log('KalıpMaliyeti HTTP status:', respKalip.status)
        if (respKalip.ok) {
          const apiVal = await respKalip.json()
          console.log('KalıpMaliyeti API değeri (ham):', apiVal, 'typeof:', typeof apiVal)
          kalipMaliyetiValue = toNumberSafe(apiVal)
          console.log('KalıpMaliyeti parse sonrası:', kalipMaliyetiValue)
        }
      } catch (e) {
        console.warn('KalıpMaliyeti fetch başarısız (satis-kayitlari), yazılmayacak:', e)
      }
    }

    // Net Üretim Maliyeti (decimal) – sadece parametre veya satış kaydı id'si ile API'den çekilir
    let netUretimMaliyetiValue = null
    if (netUretimMaliyetiParam != null) {
      netUretimMaliyetiValue = toNumberSafe(netUretimMaliyetiParam)
    } else if (satisKayitId != null) {
      try {
        const urlNet = `${authService.baseURL}/hesaplama/satis-kayitlari/${satisKayitId}/neturetim`
        console.log('NetUretimMaliyeti fetch URL:', urlNet)
        const respNet = await fetch(urlNet, { headers: { 'Accept': 'application/json' }, cache: 'no-store' })
        console.log('NetUretimMaliyeti HTTP status:', respNet.status)
        if (respNet.ok) {
          const apiVal = await respNet.json()
          console.log('NetUretimMaliyeti API değeri (ham):', apiVal, 'typeof:', typeof apiVal)
          netUretimMaliyetiValue = toNumberSafe(apiVal)
          console.log('NetUretimMaliyeti parse sonrası:', netUretimMaliyetiValue)
        }
      } catch (e) {
        console.warn('NetUretimMaliyeti fetch başarısız (PDF), yazılmayacak:', e)
      }
    }
    const netUretimMaliyetiStr = netUretimMaliyetiValue != null ? Number(netUretimMaliyetiValue).toFixed(4) : ''
    
    // *** PDF: TÜM SÜREÇ MALİYETLERİ - KAYDA AİT DEĞERLER ***
    console.log('=== PDF: TÜM SÜREÇ MALİYETLERİ (KAYDA AİT) ===')
    
    const enjeksiyonBasimMaliyetiValue = parsedAllResults?.enjeksiyon?.toplamMaliyet || 
                                          enjeksiyonResult?.toplamMaliyet || 
                                          0
    const santrifujMaliyetiValue = parsedAllResults?.santrifuj?.toplamMaliyet || 0
    const azotluCapakMaliyetiValue = parsedAllResults?.azotlu?.toplamMaliyet || 0
    const posturlemeMaliyetiValue = parsedAllResults?.posturleme?.toplamMaliyet || 0
    const yikamaMaliyetiValue = parsedAllResults?.yikama?.toplamMaliyet || 0
    
    console.log('PDF Enjeksiyon:', enjeksiyonBasimMaliyetiValue)
    console.log('PDF Santrifüj:', santrifujMaliyetiValue)
    console.log('PDF Azotlu:', azotluCapakMaliyetiValue)
    console.log('PDF Post-Kürleme:', posturlemeMaliyetiValue)
    console.log('PDF Yıkama:', yikamaMaliyetiValue)
    
    const enjeksiyonBasimMaliyeti = Number(enjeksiyonBasimMaliyetiValue || 0).toString()
    const santrifujMaliyeti = Number(santrifujMaliyetiValue || 0).toString()
    const azotluCapakMaliyeti = Number(azotluCapakMaliyetiValue || 0).toString()
    const posturlemeMaliyeti = Number(posturlemeMaliyetiValue || 0).toString()
    const yikamaMaliyeti = Number(yikamaMaliyetiValue || 0).toString()
    
    // Toplam maliyet: Tüm süreçlerin toplamını hesapla (API'den çekilen enjeksiyonu dahil et)
    const toplamMaliyetHesapla = () => {
      let total = Number(enjeksiyonBasimMaliyetiValue || 0) // API'den çekilen enjeksiyon
      if (parsedAllResults) {
        Object.entries(parsedAllResults).forEach(([key, processResult]) => {
          // Enjeksiyon hariç diğer süreçleri ekle
          if (key !== 'enjeksiyon' && processResult && processResult.toplamMaliyet) {
            total += Number(processResult.toplamMaliyet)
          }
        })
      }
      return total
    }
    const toplamMaliyet = toplamMaliyetHesapla().toString()

    // Net Üretim Maliyeti string (tek kez tanımla)
    const netUretimStr = netUretimMaliyetiValue != null ? Number(netUretimMaliyetiValue).toFixed(4) : ''
    
    console.log('PDF\'ye yazılıyor:', {
      hammaddeTuru,
      hammaddeTedarikcisi,
      hammaddeFiyati,
      birimBrutAgirlik,
      birimHammaddeMaliyeti,
      toplamHammaddeMaliyeti,
      enjeksiyonBasimMaliyeti,
      santrifujMaliyeti,
      azotluCapakMaliyeti,
      posturlemeMaliyeti,
      yikamaMaliyeti,
      toplamMaliyet,
      netUretimMaliyeti: netUretimStr,
      debug: {
        enjeksiyonForm_birimBrutAgirlik: enjeksiyonForm.birimBrutAgirlik,
        shared_birimBrutAgirlik: parsedShared.birimBrutAgirlik,
        costBreakdown_birimBrutAgirlik: parsedCost.birimBrutAgirlik,
        enjeksiyonForm_birimHammaddeMaliyeti: enjeksiyonForm.birimHammaddeMaliyeti,
        shared_birimHammaddeMaliyeti: parsedShared.birimHammaddeMaliyeti,
        enjeksiyonResult_birimHammaddeMaliyeti: enjeksiyonResult.birimHammaddeMaliyeti,
        costBreakdown_birimHammaddeMaliyeti: parsedCost.birimHammaddeMaliyeti,
        param_toplamHammaddeMaliyeti: toplamHammaddeMaliyetiParam,
        param_netUretimMaliyeti: netUretimMaliyetiParam,
        kayitId,
        satisKayitId,
        enjeksiyonResult_toplamMaliyet: enjeksiyonResult.toplamMaliyet,
        allResults_enjeksiyon_toplamMaliyet: parsedAllResults?.enjeksiyon?.toplamMaliyet,
        allResults_santrifuj_toplamMaliyet: parsedAllResults?.santrifuj?.toplamMaliyet,
        allResults_azotlu_toplamMaliyet: parsedAllResults?.azotlu?.toplamMaliyet,
        allResults_posturleme_toplamMaliyet: parsedAllResults?.posturleme?.toplamMaliyet,
        allResults_yikama_toplamMaliyet: parsedAllResults?.yikama?.toplamMaliyet
      },
      koordinatlar: [
        { alan: 'Hammadde Türü', x: 410, y: 550 },
        { alan: 'Hammadde Tedarikçisi', x: 410, y: 535 },
        { alan: 'Hammadde Fiyatı (€/Kg)', x: 410, y: 520 },
        { alan: 'Birim Brut Ağırlık (Kg)', x: 410, y: 505 },
        { alan: 'Birim Hammadde Maliyeti (€)', x: 410, y: 490 },
        { alan: 'Toplam Hammadde Maliyeti (€)', x: 410, y: 475 },
        { alan: 'Enjeksiyon Basım Maliyeti (€)', x: 410, y: 323 },
        { alan: 'Kaba Çapak Alma (Santrifüj) Maliyeti (€)', x: 410, y: 308 },
        { alan: 'Azotlu Çapak Alma Maliyeti (€)', x: 410, y: 293 },
        { alan: 'Post-Kürleme Maliyeti (€)', x: 410, y: 278 },
        { alan: 'Yıkama Maliyeti (€)', x: 410, y: 263 },
        { alan: 'Toplam Maliyet (€)', x: 450, y: 227 }
      ]
    })

    // Hammadde Türü (410, 550)
    firstPage.drawText(hammaddeTuru, {
      x: 410,
      y: 550,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Hammadde Tedarikçisi (410, 535)
    firstPage.drawText(hammaddeTedarikcisi, {
      x: 410,
      y: 535,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Hammadde Fiyatı (410, 520)
    firstPage.drawText(hammaddeFiyati, {
      x: 410,
      y: 520,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Birim Brut Ağırlık (410, 505)
    firstPage.drawText(birimBrutAgirlik, {
      x: 410,
      y: 505,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Birim Hammadde Maliyeti (410, 490) - Excel ile aynı değer
    firstPage.drawText(birimHammaddeMaliyeti, {
      x: 410,
      y: 490,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Toplam Hammadde Maliyeti (410, 475)
    firstPage.drawText(Number(toplamHammaddeMaliyeti).toFixed(4), {
      x: 410,
      y: 475,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Enjeksiyon Basım Maliyeti (410, 323) - her zaman yazdır (0.0000 olarak)
    firstPage.drawText(Number(enjeksiyonBasimMaliyeti || 0).toFixed(4), {
      x: 410,
      y: 323,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Kaba Çapak Alma (Santrifüj) Maliyeti (410, 308) - her zaman yazdır (0.0000 olarak)
    firstPage.drawText(Number(santrifujMaliyeti || 0).toFixed(4), {
      x: 410,
      y: 308,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Azotlu Çapak Alma Maliyeti (410, 293) - her zaman yazdır (0.0000 olarak)
    firstPage.drawText(Number(azotluCapakMaliyeti || 0).toFixed(4), {
      x: 410,
      y: 293,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Post-Kürleme Maliyeti (410, 278) - her zaman yazdır (0.0000 olarak)
    firstPage.drawText(Number(posturlemeMaliyeti || 0).toFixed(4), {
      x: 410,
      y: 278,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Yıkama Maliyeti (410, 263) - her zaman yazdır (0.0000 olarak)
    firstPage.drawText(Number(yikamaMaliyeti || 0).toFixed(4), {
      x: 410,
      y: 263,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Toplam Maliyet (410, 240)
    firstPage.drawText(Number(toplamMaliyet).toFixed(4), {
      x: 409,
      y: 170,
      size: 10,
      color: rgb(0, 0, 0)
    })

    // Net Üretim Maliyeti (409, 185) - değer mevcutsa yaz
    if (netUretimMaliyetiValue != null) {
      firstPage.drawText(netUretimStr.toString(), {
        x: 409,
        y: 190,
        size: 10,
        color: rgb(0, 0, 0)
      })
    }

    // Kalıp Maliyeti (450, 310) – değer mevcutsa yaz
    if (kalipMaliyetiValue != null) {
      firstPage.drawText(Number(kalipMaliyetiValue).toFixed(4), {
        x: 460,
        y: 213,
        size: 10,
        color: rgb(0, 0, 0)
      })
    }

    // Yan Ürün Türü (410, 430) - Excel D25 ile aynı değer
    if (yanUrunTuruParam != null && yanUrunTuruParam !== '') {
      firstPage.drawText(String(yanUrunTuruParam), {
        x: 410,
        y: 428,
        size: 10,
        color: rgb(0, 0, 0)
      })
    }

    // Yan Ürün Maliyeti (410, 258) - Excel D29 ile aynı değer
    if (yanUrunMaliyetiParam != null) {
      firstPage.drawText(Number(yanUrunMaliyetiParam).toFixed(4), {
        x: 410,
        y: 368,
        size: 10,
        color: rgb(0, 0, 0)
      })
    }

    // Adet Toplam Ürün Maliyeti (410, 355) - Excel D30 ile aynı değer
    if (adetToplamUrunMaliyetiParam != null) {
      firstPage.drawText(Number(adetToplamUrunMaliyetiParam).toFixed(4), {
        x: 410,
        y: 351,
        size: 10,
        color: rgb(0, 0, 0)
      })
    }

    // Kalıp Tedarikçisi – PDF'e yaz (geçici konum: Kalıp Maliyeti bloğu civarı)
    const kalipTedarikcisi = (enjeksiyonForm.kalipTedarikcisi || '').toString()
    if (kalipTedarikcisi) {
      firstPage.drawText(kalipTedarikcisi, {
        x: 460,
        y: 230, // Kalıp Maliyeti bölümündeki metin satırlarına hizalı
        size: 10,
        color: rgb(0, 0, 0)
      })
    }

    // 4) İNDİRME
    const fileName = `Enjeksiyon_Sureci_${new Date().toISOString().split('T')[0]}.pdf`
    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(link.href), 0)

    return true
  } catch (err) {
    console.error('PDF export hatası:', err)
    throw err
  }
}
