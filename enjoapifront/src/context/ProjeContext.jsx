import { createContext, useContext, useState, useEffect } from 'react'

const ProjeContext = createContext(null)

export function ProjeProvider({ children }) {
  const [projeler, setProjeler] = useState([])

  // LocalStorage'dan projeleri yükle
  useEffect(() => {
    const kaydedilenProjeler = localStorage.getItem('enjo-projeler')
    if (kaydedilenProjeler) {
      try {
        setProjeler(JSON.parse(kaydedilenProjeler))
      } catch (error) {
        console.error('Projeler yüklenirken hata:', error)
        setProjeler([])
      }
    }
  }, [])

  // Projeleri localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('enjo-projeler', JSON.stringify(projeler))
  }, [projeler])

  // Yeni proje oluştur
  const projeOlustur = (projeVerisi) => {
    const yeniProje = {
      id: Date.now().toString(),
      projeAdi: projeVerisi.projeAdi || 'Yeni Proje',
      aciklama: projeVerisi.aciklama || '',
      durum: projeVerisi.durum || 'aktif',
      olusturulmaTarihi: new Date().toISOString(),
      guncellemeTarihi: new Date().toISOString(),
      uretimVerileri: projeVerisi.uretimVerileri || {}
    }
    
    setProjeler(prev => [yeniProje, ...prev])
    return yeniProje
  }

  // Proje güncelle
  const projeGuncelle = (projeId, guncellemeVerisi) => {
    setProjeler(prev => 
      prev.map(proje => 
        proje.id === projeId 
          ? { 
              ...proje, 
              ...guncellemeVerisi, 
              guncellemeTarihi: new Date().toISOString() 
            }
          : proje
      )
    )
  }

  // Proje sil
  const projeSil = (projeId) => {
    if (window.confirm('Bu projeyi silmek istediğinizden emin misiniz?')) {
      setProjeler(prev => prev.filter(proje => proje.id !== projeId))
    }
  }

  // Proje getir
  const projeGetir = (projeId) => {
    return projeler.find(proje => proje.id === projeId)
  }

  // Proje durumunu güncelle
  const projeDurumGuncelle = (projeId, yeniDurum) => {
    projeGuncelle(projeId, { durum: yeniDurum })
  }

  // Üretim verilerini projeye kaydet
  const uretimVerileriniKaydet = (projeId, uretimVerileri) => {
    projeGuncelle(projeId, { 
      uretimVerileri: {
        ...uretimVerileri,
        kayitTarihi: new Date().toISOString()
      }
    })
  }

  // Proje istatistikleri
  const getProjeIstatistikleri = () => {
    const toplam = projeler.length
    const aktif = projeler.filter(p => p.durum === 'aktif').length
    const tamamlandi = projeler.filter(p => p.durum === 'tamamlandi').length
    const askida = projeler.filter(p => p.durum === 'askida').length

    return {
      toplam,
      aktif,
      tamamlandi,
      askida
    }
  }

  return (
    <ProjeContext.Provider value={{
      projeler,
      projeOlustur,
      projeGuncelle,
      projeSil,
      projeGetir,
      projeDurumGuncelle,
      uretimVerileriniKaydet,
      getProjeIstatistikleri
    }}>
      {children}
    </ProjeContext.Provider>
  )
}

export function useProje() {
  const context = useContext(ProjeContext)
  if (!context) {
    throw new Error('useProje hook\'u ProjeProvider içinde kullanılmalıdır')
  }
  return context
}
