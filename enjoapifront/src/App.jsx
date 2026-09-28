import './App.css'
import { Route, Routes, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import KullaniciYonetimi from './pages/KullaniciYonetimi.jsx'
import Satis from './pages/Satis.jsx'
import Projeler from './pages/Projeler.jsx'
import ProjeGuncelle from './pages/ProjeGuncelle.jsx'
import Uretim from './pages/Uretim/Index.jsx'
import AsamaSecim from './pages/Uretim/AsamaSecim.jsx'
import Enjeksiyon from './pages/Uretim/Hesaplamalar/Enjeksiyon.jsx'
import AzotluCapakAlma from './pages/Uretim/Hesaplamalar/AzotluCapakAlma.jsx'
import Posturleme from './pages/Uretim/Hesaplamalar/Posturleme.jsx'
import Santrifuj from './pages/Uretim/Hesaplamalar/Santrifuj.jsx'
import Yikama from './pages/Uretim/Hesaplamalar/Yikama.jsx'
import Sonuclar from './pages/Uretim/Hesaplamalar/Sonuclar.jsx'
import EuroRateBadge from './components/EuroRateBadge.jsx'
import { UretimProvider } from './context/UretimContext.jsx'
import { ProjeProvider } from './context/ProjeContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import Footer from './components/Footer.jsx'

// Yetki kontrolü komponenti
function ProtectedRoute({ children, requiredRole = 'admin' }) {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null')
  
  if (!currentUser) {
    return <Navigate to="/login" replace />
  }
  
  if (requiredRole === 'admin' && currentUser.rol !== 'admin') {
    return <Navigate to="/satis" replace />
  }
  
  return children
}

function App() {
  return (
    <div>
      <ProjeProvider>
        <UretimProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <div className="layout">
                  <Sidebar />
                  <main className="container">
                    <Routes>
                      {/* Tüm kullanıcılar erişebilir */}
                      <Route path="/satis" element={<Satis />} />
                      
                      {/* Sadece admin erişebilir */}
                      <Route path="/kullanici-yonetimi" element={
                        <ProtectedRoute requiredRole="admin">
                          <KullaniciYonetimi />
                        </ProtectedRoute>
                      } />
                      <Route path="/projeler" element={
                        <ProtectedRoute requiredRole="admin">
                          <Projeler />
                        </ProtectedRoute>
                      } />
                      <Route path="/proje-guncelle" element={
                        <ProtectedRoute requiredRole="admin">
                          <ProjeGuncelle />
                        </ProtectedRoute>
                      } />
                      <Route path="/uretim" element={
                        <ProtectedRoute requiredRole="admin">
                          <Navigate to="/uretim/asama-secim" replace />
                        </ProtectedRoute>
                      } />
                      <Route path="/uretim/asama-secim" element={
                        <ProtectedRoute requiredRole="admin">
                          <AsamaSecim />
                        </ProtectedRoute>
                      } />
                      <Route path="/uretim/hesaplamalar/enjeksiyon" element={
                        <ProtectedRoute requiredRole="admin">
                          <Enjeksiyon />
                        </ProtectedRoute>
                      } />
                      <Route path="/uretim/hesaplamalar/azotlu-capak-alma" element={
                        <ProtectedRoute requiredRole="admin">
                          <AzotluCapakAlma />
                        </ProtectedRoute>
                      } />
                      <Route path="/uretim/hesaplamalar/posturleme" element={
                        <ProtectedRoute requiredRole="admin">
                          <Posturleme />
                        </ProtectedRoute>
                      } />
                      <Route path="/uretim/hesaplamalar/santrifuj" element={
                        <ProtectedRoute requiredRole="admin">
                          <Santrifuj />
                        </ProtectedRoute>
                      } />
                      <Route path="/uretim/hesaplamalar/yikama" element={
                        <ProtectedRoute requiredRole="admin">
                          <Yikama />
                        </ProtectedRoute>
                      } />
                      <Route path="/uretim/hesaplamalar/sonuclar" element={
                        <ProtectedRoute requiredRole="admin">
                          <Sonuclar />
                        </ProtectedRoute>
                      } />
                    </Routes>
                  </main>
                </div>
                <Footer />
                <EuroRateBadge />
              </div>
            } />
          </Routes>
        </UretimProvider>
      </ProjeProvider>
    </div>
  )
}

export default App
