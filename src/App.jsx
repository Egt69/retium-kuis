import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import KuisPage from './pages/KuisPage'
import HasilPage from './pages/HasilPage'
import AdminPage from './pages/AdminPage'
import ConfirmPage from './pages/ConfirmPage' 

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/kuis" element={<KuisPage />} />
        <Route path="/hasil" element={<HasilPage />} />
        <Route path="/admin-rahasia" element={<AdminPage />} />
        <Route path="/konfirmasi" element={<ConfirmPage />} />
      </Routes>
    </BrowserRouter>
  )
}
