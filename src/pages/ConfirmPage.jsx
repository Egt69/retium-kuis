import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ParticleBackground from '../components/ParticleBackground'
import '../styles/kuis.css'

export default function ConfirmPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  
  // Ambil username dari state navigasi (dikirim dari LoginPage)
  const username = location.state?.username

  const handleConfirm = async (e) => {
    e.preventDefault()
    if (!code) return setError('Masukkan kode konfirmasi!')
    setLoading(true)
    setError('')

    try {
      // 1. Cari data user berdasarkan kode konfirmasi
      const { data, error: dbError } = await supabase
        .from('access_codes')
        .select('*')
        .eq('confirm_code', code.toUpperCase())
        .maybeSingle()

      if (dbError) throw dbError

      if (!data) {
        setError('Kode konfirmasi salah! Periksa kembali kode Anda.')
        setLoading(false)
        return
      }

      // 2. Tandai akun sebagai terverifikasi
      await supabase
        .from('access_codes')
        .update({ is_verified: true })
        .eq('id', data.id)

      // 3. Simpan data user ke localStorage (Agar tidak perlu login ulang)
      localStorage.setItem('kuis_username', data.used_by)
      localStorage.setItem('kuis_wallet', data.wallet_address)
      localStorage.setItem('kuis_code', data.code)
      localStorage.setItem('kuis_negara', data.negara)

      alert('Akun berhasil dikonfirmasi! Selamat datang di Dashboard.')
      
      // 4. Langsung lempar ke Dashboard
      navigate('/dashboard')

    } catch (err) {
      console.error(err)
      setError('Terjadi kesalahan sistem. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  // Jika tidak ada username, tendang kembali ke login
  if (!username) {
    // navigate('/') // Jangan langsung navigate, biarkan user isi form dulu
  }

  return (
    <div className="login-page-wrapper">
      <ParticleBackground />
      <div className="login-box-premium">
        <h1 className="login-title" style={{ marginBottom: '1rem' }}>
          <span className="title-retium" style={{ fontSize: '2.5rem' }}>KONFIRMASI</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', textAlign: 'center' }}>
          Masukkan Kode Konfirmasi (RTM-ID...) yang Anda dapatkan saat mendaftar.
        </p>

        <form onSubmit={handleConfirm} className="login-form-premium">
          <div className="input-wrapper-premium">
            <span className="input-icon-premium">🔑</span>
            <input 
              type="text" 
              placeholder="RTM-IDXXXXXXXXXX" 
              value={code} 
              onChange={(e) => setCode(e.target.value)} 
              required 
              disabled={loading} 
              style={{ textTransform: 'uppercase' }}
            />
          </div>
          <button type="submit" className="btn-premium" disabled={loading}>
            {loading ? 'MEMPROSES...' : 'KONFIRMASI'}
          </button>
          {error && <div className="error-msg-premium">{error}</div>}
        </form>
      </div>
    </div>
  )
}
