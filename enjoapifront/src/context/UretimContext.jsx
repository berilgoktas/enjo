import { createContext, useContext, useState, useEffect } from 'react'

const UretimContext = createContext(null)

export function UretimProvider({ children }) {
  const STORAGE_KEYS = {
    selectedSteps: 'uretim_selectedSteps',
    shared: 'uretim_shared',
    forms: 'uretim_forms',
    results: 'uretim_results'
  }

  function safeParse(json, fallback) {
    try {
      if (!json) return fallback
      const v = JSON.parse(json)
      return v == null ? fallback : v
    } catch {
      return fallback
    }
  }
  // Aşamaların sabit sırası ve meta bilgileri
  const ALL_STEPS = [
    { key: 'enjeksiyon', label: 'Enjeksiyon', to: '/uretim/hesaplamalar/enjeksiyon', icon: '🧩' },
    { key: 'azotlu', label: 'Azotlu Çapak Alma', to: '/uretim/hesaplamalar/azotlu-capak-alma', icon: '❄️' },
    { key: 'posturleme', label: 'Post-Kürleme', to: '/uretim/hesaplamalar/posturleme', icon: '🔥' },
    { key: 'santrifuj', label: 'Santrifüjlü Çapak Alma', to: '/uretim/hesaplamalar/santrifuj', icon: '🌀' },
    { key: 'yikama', label: 'Yıkama', to: '/uretim/hesaplamalar/yikama', icon: '🧴' },
    { key: 'sonuclar', label: 'Sonuçlar', to: '/uretim/hesaplamalar/sonuclar', icon: '📊' }
  ]

  // Enjeksiyon ve Sonuçlar zorunlu olarak seçili başlar
  const [selectedSteps, setSelectedSteps] = useState(() =>
    safeParse(localStorage.getItem(STORAGE_KEYS.selectedSteps), ['enjeksiyon', 'sonuclar'])
  )
  const [shared, setShared] = useState(() =>
    safeParse(localStorage.getItem(STORAGE_KEYS.shared), {
      kalipGozSayisi: '',
      baskiCevrimSuresi: '',
      baskiToplamBrut: '',
      islemGorenUrunAgirligi: '',
      elektrikUcreti: '',
      euroKuru: '',
      operatorUcreti: ''
    })
  )
  const [forms, setForms] = useState(() =>
    safeParse(localStorage.getItem(STORAGE_KEYS.forms), {})
  )
  const [results, setResults] = useState(() =>
    safeParse(localStorage.getItem(STORAGE_KEYS.results), {})
  )

  // Kalıcılık: değiştikçe localStorage'a yaz
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.selectedSteps, JSON.stringify(selectedSteps)) } catch {}
  }, [selectedSteps])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.shared, JSON.stringify(shared)) } catch {}
  }, [shared])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.forms, JSON.stringify(forms)) } catch {}
  }, [forms])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.results, JSON.stringify(results)) } catch {}
  }, [results])

  // Sayfa yenilenince değerleri temizle, adım seçimlerini koru
  useEffect(() => {
    try {
      const navEntries = performance && performance.getEntriesByType
        ? performance.getEntriesByType('navigation')
        : []
      const isReload = (navEntries && navEntries[0] && navEntries[0].type === 'reload')
        || (performance && performance.navigation && performance.navigation.type === 1)

      if (isReload) {
        // selectedSteps kalır, shared/forms/results temizlenir
        setShared({
          kalipGozSayisi: '',
          baskiCevrimSuresi: '',
          baskiToplamBrut: '',
          islemGorenUrunAgirligi: '',
          elektrikUcreti: '',
          euroKuru: '',
          operatorUcreti: ''
        })
        setForms({})
        setResults({})
        try {
          localStorage.removeItem(STORAGE_KEYS.shared)
          localStorage.removeItem(STORAGE_KEYS.forms)
          localStorage.removeItem(STORAGE_KEYS.results)
        } catch {}
      }
    } catch {}
  }, [])

  // Aşama seçim yardımcıları
  function isStepSelected(stepKey) {
    return selectedSteps.includes(stepKey)
  }

  function setStepSelected(stepKey, isSelected) {
    if (stepKey === 'enjeksiyon') return // enjeksiyon hep seçili
    if (stepKey === 'sonuclar') return // sonuçlar hep seçili
    setSelectedSteps(prev => {
      const base = prev.filter(k => k !== stepKey)
      if (isSelected) return [...base, stepKey]
      return base
    })
  }

  function getSelectedStepMetas() {
    // Seçim sırasını koru: selectedSteps dizisini sırayla meta'ya çevir
    const metas = selectedSteps
      .map(k => ALL_STEPS.find(s => s.key === k))
      .filter(Boolean)
    
    // Sonuçları en sona taşı
    const sonuclar = metas.filter(m => m.key === 'sonuclar')
    const digerleri = metas.filter(m => m.key !== 'sonuclar')
    
    return [...digerleri, ...sonuclar]
  }

  // Sihirbaz adımları: 1) Aşama Seçimi 2..N) Seçilen adımlar (Enjeksiyon dahil)
  const SELECTION_STEP = { key: 'asamaSecim', label: 'Aşama Seçimi', to: '/uretim/asama-secim' }

  function getWizardSteps() {
    return [SELECTION_STEP, ...getSelectedStepMetas()]
  }

  function getStepIndexByKey(stepKey) {
    return getWizardSteps().findIndex(s => s.key === stepKey)
  }

  function getStepIndexByPath(pathname) {
    return getWizardSteps().findIndex(s => s.to === pathname)
  }

  function getPrevRouteForKey(stepKey) {
    const idx = getStepIndexByKey(stepKey)
    if (idx > 0) return getWizardSteps()[idx - 1].to
    return null
  }

  function getPrevRouteForPath(pathname) {
    const idx = getStepIndexByPath(pathname)
    if (idx > 0) return getWizardSteps()[idx - 1].to
    return null
  }

  function getNextRouteForKey(stepKey) {
    const idx = getStepIndexByKey(stepKey)
    const steps = getWizardSteps()
    if (idx >= 0 && idx < steps.length - 1) return steps[idx + 1].to
    // Son adımdan sonra sonuç sayfasına yönlendir
    return '/uretim/hesaplamalar/sonuclar'
  }

  function getNextRouteForPath(pathname) {
    const idx = getStepIndexByPath(pathname)
    const steps = getWizardSteps()
    if (idx >= 0 && idx < steps.length - 1) return steps[idx + 1].to
    // Son adımdan sonra sonuç sayfasına yönlendir
    return '/uretim/hesaplamalar/sonuclar'
  }

  function updateShared(partial) {
    setShared(prev => ({ ...prev, ...partial }))
  }

  function getForm(name) {
    return forms[name] || {}
  }

  function updateForm(name, partial) {
    setForms(prev => ({
      ...prev,
      [name]: { ...(prev[name] || {}), ...partial }
    }))
  }

  function getResult(name) {
    return results[name] || null
  }

  function updateResult(name, result) {
    setResults(prev => ({
      ...prev,
      [name]: result
    }))
  }

  function clearAllData() {
    setShared({
      kalipGozSayisi: '',
      baskiCevrimSuresi: '',
      baskiToplamBrut: '',
      islemGorenUrunAgirligi: '',
      elektrikUcreti: '',
      euroKuru: '',
      operatorUcreti: ''
    })
    setForms({})
    setResults({})
    try {
      localStorage.removeItem(STORAGE_KEYS.shared)
      localStorage.removeItem(STORAGE_KEYS.forms)
      localStorage.removeItem(STORAGE_KEYS.results)
    } catch {}
  }

  // Validasyon fonksiyonları
  function validateStep(stepKey) {
    const form = getForm(stepKey)
    const missing = []
    
    // Her adım için gerekli alanları tanımla
    const requiredFields = {
      enjeksiyon: ['baskiToplamBrut', 'kalipGozSayisi', 'hammaddeFiyatiEuro', 'baskiCevrimSuresi', 'isciKatsayisi', 'isciSayisi'],
      azotlu: ['kalipGozSayisi', 'isciKatsayisi', 'isciSayisi', 'yillikBakimBedeli', 'islemBasinaHarcananAzotGram', 'tasKgSaniye', 'tas1KgFiyatiEuro', 'azotKgFiyatiTl'],
      posturleme: ['baskiToplamBrutAgirlik', 'kalipGozSayisi', 'isciKatsayisi', 'isciSayisi'],
      santrifuj: ['isciKatsayisi', 'isciSayisi'],
      yikama: ['isciKatsayisi', 'isciSayisi']
    }
    
    const fields = requiredFields[stepKey] || []
    
    for (const field of fields) {
      const value = form[field]
      if (!value || value === '' || value === null || value === undefined) {
        missing.push(field)
      }
    }
    
    return {
      isValid: missing.length === 0,
      missingFields: missing,
      fieldLabels: {
        baskiToplamBrut: 'Baskı Toplam Brüt',
        kalipGozSayisi: 'Kalıp Göz Sayısı',
        hammaddeFiyatiEuro: 'Hammadde Fiyatı (€)',
        baskiCevrimSuresi: 'Baskı Çevrim Süresi',
        isciKatsayisi: 'İşçi Katsayısı',
        isciSayisi: 'Çalışan Sayısı',
        baskiToplamBrutAgirlik: 'Baskı Toplam Brüt Ağırlık',
        yillikBakimBedeli: 'Yıllık Bakım Bedeli',
        islemBasinaHarcananAzotGram: 'İşlem Başına Harcanan Azot (gr)',
        tasKgSaniye: 'Taş Kg/Saniye',
        tas1KgFiyatiEuro: 'Taş 1 Kg Fiyatı (€)',
        azotKgFiyatiTl: 'Azot Kg Fiyatı (TL)'
      }
    }
  }

  function validateAllSelectedSteps() {
    const validationResults = {}
    
    // Enjeksiyon hesaplaması yapılmış mı kontrol et
    const enjeksiyonResult = getResult('enjeksiyon')
    const enjeksiyonCompleted = enjeksiyonResult && enjeksiyonResult.toplamMaliyet > 0
    
    const allValid = selectedSteps.every(stepKey => {
      if (stepKey === 'sonuclar') return true // Sonuçlar sayfası validasyona dahil değil
      if (stepKey === 'enjeksiyon') {
        const validation = validateStep(stepKey)
        validationResults[stepKey] = validation
        return validation.isValid
      }
      
      // Diğer adımlar için önce Enjeksiyon'un tamamlanmış olması gerekir
      if (!enjeksiyonCompleted) {
        validationResults[stepKey] = {
          isValid: false,
          missingFields: ['enjeksiyon_hesaplama'],
          fieldLabels: { enjeksiyon_hesaplama: 'Enjeksiyon hesaplaması' }
        }
        return false
      }
      
      // Diğer adımlar için hesaplama sonucu var mı kontrol et
      const result = getResult(stepKey)
      if (!result || !result.toplamMaliyet || result.toplamMaliyet <= 0) {
        validationResults[stepKey] = {
          isValid: false,
          missingFields: ['hesaplama'],
          fieldLabels: { hesaplama: 'Hesaplama yapılmamış' }
        }
        return false
      }
      
      validationResults[stepKey] = { isValid: true, missingFields: [], fieldLabels: {} }
      return true
    })
    
    return {
      allValid,
      results: validationResults,
      stepLabels: {
        enjeksiyon: 'Enjeksiyon',
        azotlu: 'Azotlu Çapak Alma',
        posturleme: 'Post-Kürleme',
        santrifuj: 'Santrifüjlü Çapak Alma',
        yikama: 'Yıkama'
      }
    }
  }

  // Enjeksiyon form'undan değerleri al
  function getEnjeksiyonValues() {
    const enjeksiyonForm = getForm('enjeksiyon')
    return {
      kalipGozSayisi: enjeksiyonForm.kalipGozSayisi || shared.kalipGozSayisi,
      baskiToplamBrut: enjeksiyonForm.baskiToplamBrut || shared.baskiToplamBrut,
      baskiCevrimSuresi: enjeksiyonForm.baskiCevrimSuresi || shared.baskiCevrimSuresi,
      elektrikUcreti: enjeksiyonForm.elektrikUcreti || shared.elektrikUcreti,
      euroKuru: enjeksiyonForm.euroKuru || shared.euroKuru,
      operatorUcreti: enjeksiyonForm.operatorUcreti || shared.operatorUcreti
    }
  }

  return (
    <UretimContext.Provider value={{
      // paylaşılan girdiler/sonuçlar
      shared, updateShared, getForm, updateForm, getResult, updateResult, clearAllData,
      // aşama seçimi
      allSteps: ALL_STEPS,
      selectedSteps, setSelectedSteps, isStepSelected, setStepSelected, getSelectedStepMetas,
      // sihirbaz dolaşımı
      getWizardSteps, getPrevRouteForKey, getNextRouteForKey, getPrevRouteForPath, getNextRouteForPath,
      // validasyon
      validateStep, validateAllSelectedSteps,
      // Enjeksiyon değerleri
      getEnjeksiyonValues
    }}>
      {children}
    </UretimContext.Provider>
  )
}

export function useUretim() {
  const ctx = useContext(UretimContext)
  if (!ctx) throw new Error('useUretim must be used within UretimProvider')
  return ctx
}


