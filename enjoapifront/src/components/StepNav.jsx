import { NavLink, useLocation } from 'react-router-dom'
import { useUretim } from '../context/UretimContext.jsx'

export default function StepNav() {
  const { getWizardSteps, allSteps, selectedSteps } = useUretim()
  const metas = (typeof getWizardSteps === 'function'
    ? getWizardSteps()
    : [{ key: 'asamaSecim', label: 'Aşama Seçimi', to: '/uretim/asama-secim' }, ...selectedSteps.map(k => allSteps.find(s => s.key===k)).filter(Boolean)])
  const { pathname } = useLocation()

  return (
    <div>
      <div className="steps">
        {metas.map((s, idx) => (
          <NavLink key={s.to} to={s.to} className={() => `step ${pathname === s.to ? 'active' : ''}`}>
            {s.icon ? <span style={{marginRight:6}}>{s.icon}</span> : null}
            {idx + 1}. {s.label}
          </NavLink>
        ))}
      </div>
      <div className="progressbar">
        <div className="progress" style={{width: `${(Math.max(0, metas.findIndex(m => m.to === pathname)) + 1) / metas.length * 100}%`}} />
      </div>
    </div>
  )
}


