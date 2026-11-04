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

    // Cek apakah username dan kode konfirmasi cocok
    const { data, error: dbError } = await supabase
      .from('access_codes')
      .update({ is_verified: true })
      .eq('used_by', username)
      .eq('confirm_code', code.toUpperCase())
      .select()

    if (dbError) {
      setError('Terjadi kesalahan sistem.')
    } else if (data.length === 0) {
      setError('Kode konfirmasi salah!')
    } else {
      alert('Akun berhasil dikonfirmasi! Silakan atur profil Anda.')
      // Nanti kita arahkan ke halaman setting profil
      // navigate('/setting-profil') 
    }
    setLoading(false)
  }

  // Jika tidak ada username, tendang kembali ke login
  if (!username) {
    navigate('/')
    return null
  }

  return (
    <div className="login-page-wrapper">
      <ParticleBackground />
      <div className="login-box-premium">
        <h1 className="login-title" style={{ marginBottom: '1rem' }}>
          <span className="title-retium">KONFIRMASI</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', textAlign: 'center' }}>
          Masukkan Kode Konfirmasi (RTM-ID...) yang Anda dapatkan saat mendaftar.
        </p>

        <form onSubmit={handleConfirm} className="login-form-premium">
          <div className="input-wrapper-premium">
            <span className="input-icon-premium">🔑</span>
            <input 
              type="text" placeholder="RTM-IDXXXXXXXXXX" 
              value={code} onChange={(e) => setCode(e.target.value)} 
              required disabled={loading} style={{ textTransform: 'uppercase' }}
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
