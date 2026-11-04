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

    try {
      // 1. Cari data user berdasarkan kode konfirmasi
      const { data, error: dbError } = await supabase
        .from('access_codes')
        .select('*')
        .eq('confirm_code', code.toUpperCase())
        .maybeSingle()

      if (dbError) throw dbError

      if (!data) {
        setError('Kode konfirmasi salah!')
        setLoading(false)
        return
      }

      // 2. Tandai bahwa akun sudah terverifikasi (opsional)
      await supabase.from('access_codes').update({ is_verified: true }).eq('id', data.id)

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
      setError('Terjadi kesalahan sistem.')
    } finally {
      setLoading(false)
    }
  }

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
