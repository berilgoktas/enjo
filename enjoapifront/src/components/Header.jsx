import { NavLink } from 'react-router-dom'

export default function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-logo">Enjeksiyon</span>
        </div>
        <nav className="header-nav">
          <NavLink to="/satis" className={({isActive}) => `tab ${isActive ? 'active' : ''}`}>Satış</NavLink>
          <NavLink to="/uretim" className={({isActive}) => `tab ${isActive ? 'active' : ''}`}>Üretim</NavLink>
        </nav>
      </div>
    </header>
  )
}


