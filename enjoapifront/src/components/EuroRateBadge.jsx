import { useEffect, useState } from 'react'

export default function EuroRateBadge() {
  const [rate, setRate] = useState('')

  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        const res = await fetch('/api/admin/enjeksiyon-varsayilan-degerler')
        if (!res.ok) return
        const data = await res.json()
        if (!ignore) setRate(data?.euroKuru ?? '')
      } catch {
        // sessiz geç
      }
    }
    load()
    return () => { ignore = true }
  }, [])

  if (rate === '' || rate == null) return null
  return <div className="rate-badge">güncel kur: {rate}</div>
}


