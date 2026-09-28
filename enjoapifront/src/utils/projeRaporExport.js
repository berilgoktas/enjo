import ExcelJS from 'exceljs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { authService } from '../simple-auth-service.js'

function toNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (v == null || v === '') return 0
  let s = String(v).trim()
  if (s.includes(',') && s.includes('.')) {
    const lastDot = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function parseMaybeJson(value) {
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return {} }
  }
  return (value && typeof value === 'object') ? value : {}
}

function formatEuro(v) {
  if (v == null || v === '') return ''
  const n = toNum(v)
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

function formatDateTr(date = new Date()) {
  return date.toLocaleDateString('tr-TR')
}

function safeFilePart(name) {
  const s = String(name || '').trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_')
  return s || 'Rapor'
}

function pdfSafe(text) {
  return String(text ?? '')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/€/g, 'EUR')
}

function downloadBlob(blob, fileName) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 0)
}

function buildRaporData(params = {}) {
  const form = params.enjeksiyonForm || {}
  const shared = parseMaybeJson(params.shared)
  const result = params.enjeksiyonResult || {}
  const cost = params.costBreakdown || {}
  const allResults = parseMaybeJson(params.allResults)

  const adet = toNum(form.adet) || 1
  const euroKuru = toNum(form.euroKuru || shared.euroKuru)
  const birimBrutAgirlik = toNum(
    form.birimBrutAgirlik || shared.birimBrutAgirlik || cost.birimBrutAgirlik
  )
  const birimHammaddeMaliyeti = toNum(
    form.birimHammaddeMaliyeti ||
    shared.birimHammaddeMaliyeti ||
    result.birimHammaddeMaliyeti ||
    cost.birimHammaddeMaliyeti
  )

  const enjeksiyon = toNum(allResults?.enjeksiyon?.toplamMaliyet || result?.toplamMaliyet)
  const santrifuj = toNum(allResults?.santrifuj?.toplamMaliyet)
  const azotlu = toNum(allResults?.azotlu?.toplamMaliyet)
  const posturleme = toNum(allResults?.posturleme?.toplamMaliyet)
  const yikama = toNum(allResults?.yikama?.toplamMaliyet)
  const surecToplam = enjeksiyon + santrifuj + azotlu + posturleme + yikama
  const totalCost = toNum(params.totalCost) || surecToplam

  const netUretim = params.netUretimMaliyetiExcel ?? params.netUretimMaliyeti
  const netUretimMaliyeti = netUretim == null || netUretim === '' ? null : toNum(netUretim)
  const netBirimMaliyet = netUretimMaliyeti != null && adet > 0
    ? netUretimMaliyeti / adet
    : (adet > 0 ? totalCost / adet : null)

  return {
    projeAdi: params.projeAdi || form.projeAdi || '',
    tarih: new Date(),
    euroKuru,
    adet,
    hammaddeTuru: form.hammaddeTuru || '',
    hammaddeTedarikcisi: form.hammaddeTedarikcisi || '',
    hammaddeFiyatiEuro: toNum(form.hammaddeFiyatiEuro),
    birimBrutAgirlik,
    birimHammaddeMaliyeti,
    toplamHammaddeMaliyeti: params.toplamHammaddeMaliyetiExcel ?? params.toplamHammaddeMaliyeti ?? null,
    yanUrunTuru: params.yanUrunTuruExcel ?? params.yanUrunTuru ?? '',
    yanUrunMaliyeti: params.yanUrunMaliyetiExcel ?? params.yanUrunMaliyeti ?? null,
    adetToplamUrunMaliyeti: params.adetToplamUrunMaliyetiExcel ?? params.adetToplamUrunMaliyeti ?? null,
    enjeksiyon,
    santrifuj,
    azotlu,
    posturleme,
    yikama,
    kalipTedarikcisi: form.kalipTedarikcisi || '',
    kalipMaliyeti: params.kalipMaliyetiExcel ?? params.kalipMaliyeti ?? cost.kalipMaliyeti ?? null,
    netUretimMaliyeti,
    netBirimMaliyet,
    totalCost,
    kayitId: params.kayitId,
    satisKayitId: params.satisKayitId
  }
}

async function maybeFetchMissing(data) {
  const base = authService?.baseURL || '/api'
  const satisId = data.satisKayitId
  const kayitId = data.kayitId

  const fetchJson = async (url) => {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  }

  if ((data.toplamHammaddeMaliyeti == null) && (satisId != null || kayitId != null)) {
    try {
      const url = satisId != null
        ? `${base}/hesaplama/satis-kayitlari/${satisId}/toplamhammaddemaliyeti?_t=${Date.now()}`
        : `${base}/hesaplama/enjeksiyon/${kayitId}/toplamhammadde`
      const val = await fetchJson(url)
      if (val != null) data.toplamHammaddeMaliyeti = toNum(val)
    } catch (_) {}
  }

  if (data.netUretimMaliyeti == null && satisId != null) {
    try {
      const val = await fetchJson(`${base}/hesaplama/satis-kayitlari/${satisId}/neturetim`)
      if (val != null) {
        data.netUretimMaliyeti = toNum(val)
        if (data.adet > 0) data.netBirimMaliyet = data.netUretimMaliyeti / data.adet
      }
    } catch (_) {}
  }

  if (data.kalipMaliyeti == null && satisId != null) {
    try {
      const val = await fetchJson(`${base}/hesaplama/satis-kayitlari/${satisId}/kalipmaliyeti`)
      if (val != null) data.kalipMaliyeti = toNum(val)
    } catch (_) {}
  }

  return data
}

const NAVY = 'FF1F385F'
const SECTION = 'FFD1E0F0'
const TOTAL_BG = 'FFEDF2F7'
const WHITE = 'FFFFFFFF'
const BORDER = 'FFB8BFC7'
const NUM_FMT = '#,##0.0000'
const MONEY_FMT = '€ #,##0.0000;[Red]-€ #,##0.0000'

function thinBorder() {
  const edge = { style: 'thin', color: { argb: BORDER } }
  return { top: edge, left: edge, bottom: edge, right: edge }
}

function applyCell(cell, { value, numFmt, bold, fill, color, align = 'left' }) {
  if (value !== undefined) cell.value = value
  if (numFmt) cell.numFmt = numFmt
  cell.font = {
    name: 'Calibri',
    size: 11,
    bold: !!bold,
    color: { argb: color || 'FF1A1A1A' }
  }
  cell.alignment = { vertical: 'middle', horizontal: align, wrapText: true }
  cell.border = thinBorder()
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
}

function displayValue(v) {
  if (v == null || v === '') return '-'
  return v
}

/**
 * Proje verisine gore Excel raporu olusturur. Sablon dosyasi kullanilmaz.
 */
export async function exportEnjeksiyonRaporuExcelJS(params = {}) {
  const data = await maybeFetchMissing(buildRaporData(params))

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ENJO'
  const ws = workbook.addWorksheet('Proje Maliyet Analizi', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 }
    }
  })

  ws.columns = [
    { key: 'label', width: 42 },
    { key: 'value', width: 28 }
  ]

  let r = 1

  const titleRow = ws.getRow(r)
  titleRow.height = 28
  ws.mergeCells(r, 1, r, 2)
  applyCell(ws.getCell(r, 1), {
    value: 'PROJE MALİYET ANALİZ FORMU',
    bold: true,
    fill: NAVY,
    color: WHITE,
    align: 'center'
  })
  applyCell(ws.getCell(r, 2), { fill: NAVY, color: WHITE })
  r += 1

  const meta = [
    ['Proje', data.projeAdi || '-'],
    ['Tarih', formatDateTr(data.tarih)],
    ['Sipariş adedi', data.adet],
    ['Euro kuru', data.euroKuru || '-']
  ]
  meta.forEach(([label, value]) => {
    const row = ws.getRow(r)
    row.height = 20
    applyCell(ws.getCell(r, 1), { value: label, bold: true })
    const isNum = typeof value === 'number'
    applyCell(ws.getCell(r, 2), {
      value,
      numFmt: isNum && label === 'Euro kuru' ? NUM_FMT : (isNum && label === 'Sipariş adedi' ? '#,##0' : undefined),
      align: isNum ? 'right' : 'left'
    })
    r += 1
  })
  r += 1

  const sectionHead = (title) => {
    ws.mergeCells(r, 1, r, 2)
    const row = ws.getRow(r)
    row.height = 22
    applyCell(ws.getCell(r, 1), { value: title, bold: true, fill: SECTION, align: 'left' })
    applyCell(ws.getCell(r, 2), { fill: SECTION })
    r += 1
  }

  const textRow = (label, value) => {
    const row = ws.getRow(r)
    row.height = 20
    applyCell(ws.getCell(r, 1), { value: label })
    applyCell(ws.getCell(r, 2), { value: displayValue(value) })
    r += 1
  }

  const moneyRow = (label, value, emphasize = false) => {
    const row = ws.getRow(r)
    row.height = 20
    applyCell(ws.getCell(r, 1), { value: label, bold: emphasize, fill: emphasize ? TOTAL_BG : undefined })
    applyCell(ws.getCell(r, 2), {
      value: value == null || value === '' ? '-' : toNum(value),
      numFmt: value == null || value === '' ? undefined : MONEY_FMT,
      bold: emphasize,
      fill: emphasize ? TOTAL_BG : undefined,
      align: 'right'
    })
    r += 1
  }

  sectionHead('Hammadde Maliyeti')
  textRow('Hammadde türü', data.hammaddeTuru)
  textRow('Hammadde tedarikçisi', data.hammaddeTedarikcisi)
  moneyRow('Hammadde fiyatı (€/Kg)', data.hammaddeFiyatiEuro)
  applyCell(ws.getCell(r, 1), { value: 'Kullanılan hammadde (1 adet, Kg)' })
  applyCell(ws.getCell(r, 2), {
    value: data.birimBrutAgirlik == null ? '-' : toNum(data.birimBrutAgirlik),
    numFmt: NUM_FMT,
    align: 'right'
  })
  r += 1
  moneyRow('Birim hammadde maliyeti', data.birimHammaddeMaliyeti)
  moneyRow('Toplam hammadde maliyeti', data.toplamHammaddeMaliyeti, true)
  r += 1

  sectionHead('Yan Ürün Maliyeti')
  textRow('Yan ürün türü', data.yanUrunTuru)
  moneyRow('Toplam yan ürün maliyeti', data.yanUrunMaliyeti)
  moneyRow('Adet toplam ürün maliyeti', data.adetToplamUrunMaliyeti)
  r += 1

  sectionHead('Alt Süreç Maliyeti')
  moneyRow('Enjeksiyon basım', data.enjeksiyon)
  moneyRow('Kaba çapak alma (Santrifüj)', data.santrifuj)
  moneyRow('Azotlu çapak alma', data.azotlu)
  moneyRow('Post kürleme', data.posturleme)
  moneyRow('Yıkama', data.yikama)
  moneyRow('Süreçler toplamı', data.totalCost, true)
  r += 1

  sectionHead('Kalıp Maliyeti')
  textRow('Kalıp tedarikçisi', data.kalipTedarikcisi)
  moneyRow('Toplam takım maliyeti', data.kalipMaliyeti)
  r += 1

  ws.mergeCells(r, 1, r, 2)
  applyCell(ws.getCell(r, 1), {
    value: 'NET ÜRETİM MALİYETİ',
    bold: true,
    fill: NAVY,
    color: WHITE,
    align: 'left'
  })
  applyCell(ws.getCell(r, 2), { fill: NAVY, color: WHITE })
  r += 1
  applyCell(ws.getCell(r, 1), { value: 'Net üretim maliyeti', bold: true, fill: TOTAL_BG })
  applyCell(ws.getCell(r, 2), {
    value: data.netUretimMaliyeti == null ? '-' : toNum(data.netUretimMaliyeti),
    numFmt: data.netUretimMaliyeti == null ? undefined : MONEY_FMT,
    bold: true,
    fill: TOTAL_BG,
    align: 'right'
  })
  r += 1
  applyCell(ws.getCell(r, 1), { value: 'Net birim maliyet (€/Adet)', bold: true, fill: TOTAL_BG })
  applyCell(ws.getCell(r, 2), {
    value: data.netBirimMaliyet == null ? '-' : toNum(data.netBirimMaliyet),
    numFmt: data.netBirimMaliyet == null ? undefined : MONEY_FMT,
    bold: true,
    fill: TOTAL_BG,
    align: 'right'
  })

  const fileName = `Proje_Maliyet_${safeFilePart(data.projeAdi)}_${data.tarih.toISOString().split('T')[0]}.xlsx`
  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }), fileName)
  return true
}

/**
 * Proje verisine gore PDF formu olusturur (statik koordinat overlay yok).
 */
export async function exportPDFWithData(params = {}) {
  const data = await maybeFetchMissing(buildRaporData(params))

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const navy = rgb(0.12, 0.22, 0.40)
  const section = rgb(0.82, 0.88, 0.94)
  const line = rgb(0.75, 0.78, 0.82)
  const black = rgb(0.10, 0.10, 0.10)
  const muted = rgb(0.35, 0.38, 0.42)
  const totalBg = rgb(0.93, 0.95, 0.98)

  const left = 36
  const right = 559
  const width = right - left
  let y = 806

  const drawText = (text, x, yy, size, fnt = font, color = black) => {
    page.drawText(pdfSafe(text), { x, y: yy, size, font: fnt, color })
  }

  page.drawRectangle({ x: left, y: y - 8, width, height: 36, color: navy })
  drawText('PROJE MALIYET ANALIZ FORMU', left + 12, y + 6, 14, bold, rgb(1, 1, 1))
  y -= 28

  drawText(`Proje: ${data.projeAdi || '-'}`, left, y, 9, bold)
  drawText(`Tarih: ${formatDateTr(data.tarih)}`, 320, y, 9)
  y -= 14
  drawText(`Siparis adedi: ${data.adet}`, left, y, 9)
  if (data.euroKuru) drawText(`Euro kuru: ${formatEuro(data.euroKuru)}`, 320, y, 9)
  y -= 18

  const sectionHead = (title) => {
    page.drawRectangle({ x: left, y: y - 4, width, height: 18, color: section })
    drawText(title, left + 8, y + 1, 10, bold, navy)
    y -= 20
  }

  const row = (label, value, { emphasize = false } = {}) => {
    if (emphasize) {
      page.drawRectangle({ x: left, y: y - 3, width, height: 16, color: totalBg })
    }
    page.drawLine({ start: { x: left, y: y - 4 }, end: { x: right, y: y - 4 }, thickness: 0.4, color: line })
    drawText(label, left + 8, y, 9, emphasize ? bold : font, emphasize ? navy : muted)
    const val = value == null || value === '' ? '-' : String(value)
    const valWidth = (emphasize ? bold : font).widthOfTextAtSize(pdfSafe(val), 9)
    drawText(val, right - 8 - valWidth, y, 9, emphasize ? bold : font, black)
    y -= 16
  }

  const money = (v) => (v == null || v === '') ? '' : `${formatEuro(v)} EUR`

  sectionHead('Hammadde Maliyeti')
  row('Hammadde turu', data.hammaddeTuru)
  row('Hammadde tedarikcisi', data.hammaddeTedarikcisi)
  row('Hammadde fiyati (EUR/Kg)', money(data.hammaddeFiyatiEuro))
  row('Kullanilan hammadde (1 adet, Kg)', formatEuro(data.birimBrutAgirlik))
  row('Birim hammadde maliyeti', money(data.birimHammaddeMaliyeti))
  row('Toplam hammadde maliyeti', money(data.toplamHammaddeMaliyeti), { emphasize: true })
  y -= 8

  sectionHead('Yan Urun Maliyeti')
  row('Yan urun turu', data.yanUrunTuru)
  row('Toplam yan urun maliyeti', money(data.yanUrunMaliyeti))
  row('Adet toplam urun maliyeti', money(data.adetToplamUrunMaliyeti))
  y -= 8

  sectionHead('Alt Surec Maliyeti')
  row('Enjeksiyon basim', money(data.enjeksiyon))
  row('Kaba capak alma (Santrifuj)', money(data.santrifuj))
  row('Azotlu capak alma', money(data.azotlu))
  row('Post kurleme', money(data.posturleme))
  row('Yikama', money(data.yikama))
  row('Surecler toplami', money(data.totalCost), { emphasize: true })
  y -= 8

  sectionHead('Kalip Maliyeti')
  row('Kalip tedarikcisi', data.kalipTedarikcisi)
  row('Toplam takim maliyeti', money(data.kalipMaliyeti))
  y -= 10

  page.drawRectangle({ x: left, y: y - 6, width, height: 44, color: navy })
  drawText('NET URETIM MALIYETI', left + 8, y + 18, 10, bold, rgb(1, 1, 1))
  drawText(money(data.netUretimMaliyeti) || '-', left + 8, y + 4, 12, bold, rgb(1, 1, 1))
  drawText('NET BIRIM MALIYET', 320, y + 18, 10, bold, rgb(1, 1, 1))
  drawText(data.netBirimMaliyet != null ? `${formatEuro(data.netBirimMaliyet)} EUR/Adet` : '-', 320, y + 4, 12, bold, rgb(1, 1, 1))
  y -= 52

  drawText('FR_SS_007  |  SAYFA 1/1', left, 28, 8, font, muted)
  drawText('ARNES MEKANIK MAKINA SAN. VE TIC. LTD. STI.', 250, 28, 8, font, muted)

  const fileName = `Proje_Maliyet_${safeFilePart(data.projeAdi)}_${data.tarih.toISOString().split('T')[0]}.pdf`
  const pdfBytes = await pdfDoc.save()
  downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), fileName)
  return true
}
