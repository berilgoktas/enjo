import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUretim } from '../../context/UretimContext.jsx'
import StepNav from '../../components/StepNav.jsx'

export default function AsamaSecim() {
  const navigate = useNavigate()
  const { allSteps, selectedSteps, setStepSelected, getSelectedStepMetas, getWizardSteps, getNextRouteForKey } = useUretim()

  const orderedSteps = allSteps
  const chosen = useMemo(() => new Set(selectedSteps), [selectedSteps])

  function toggle(stepKey) {
    if (stepKey === 'enjeksiyon') return
    const willSelect = !chosen.has(stepKey)
    setStepSelected(stepKey, willSelect)
  }

  function devamEt() {
    const next = typeof getNextRouteForKey === 'function' ? getNextRouteForKey('asamaSecim') : (getSelectedStepMetas()[0]?.to)
    navigate(next || '/uretim/hesaplamalar/enjeksiyon')
  }

  return (
    <div className="production-container">
      {/* Modern Header */}
      <div className="production-header">
        <div className="production-header-content">
          <div className="production-title-section">
            <h1 className="production-title">Üretim Hesaplaması</h1>
            <p className="production-subtitle">Aşama Seçimi · Adım 1 / {(typeof getWizardSteps === 'function' ? getWizardSteps().length : (1 + getSelectedStepMetas().length))}</p>
          </div>
          <div className="production-stats">
            <div className="stat-item">
              <span className="stat-number">1</span>
              <span className="stat-label">Adım</span>
            </div>
           
            
          </div>
        </div>
      </div>

      {/* Modern Stage Selection */}
      <div className="stage-selection-container">
        <div className="stage-selection-header">
          <h2 className="stage-title">Üretim Aşamalarını Seçin</h2>
          <p className="stage-description">Hesaplamak istediğiniz üretim aşamalarını seçin. Zorunlu aşamalar otomatik olarak seçilidir.</p>
        </div>

        <div className="stage-cards-grid">
          {orderedSteps.map(step => {
            const isLocked = step.key === 'enjeksiyon' || step.key === 'sonuclar'
            const isChecked = chosen.has(step.key)
            
            // Sonuçlar kartını gizle ama seçili tut
            if (step.key === 'sonuclar') {
              return null
            }
            
            return (
              <div
                key={step.key}
                className={`stage-card ${isChecked ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
                onClick={() => !isLocked && toggle(step.key)}
              >
                <div className="stage-card-header">
                  <div className="stage-card-icon">
                    {step.icon && (
                      <span style={{ fontSize: '24px' }}>{step.icon}</span>
                    )}
                  </div>
                  
                  <div className="stage-card-content">
                    <div className="stage-card-title">
                      <h3>{step.label}</h3>
                      {isLocked && (
                        <span className="mandatory-badge">Zorunlu</span>
                      )}
                    </div>
                    <p className="stage-card-description">
                      {isLocked ? 'Bu adım her zaman seçilidir.' : 'Birden fazla adımı seçebilirsiniz.'}
                    </p>
                  </div>

                  <div className="stage-card-checkbox">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => { 
                        e.stopPropagation(); 
                        if (!isLocked) {
                          setStepSelected(step.key, e.target.checked) 
                        }
                      }}
                      disabled={isLocked}
                      className="stage-checkbox"
                    />
                    <div className="stage-checkbox-custom">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20,6 9,17 4,12"></polyline>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="stage-actions">
          <button 
            type="button" 
            className="continue-btn"
            onClick={devamEt}
          >
            <span>Devam Et</span>
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


