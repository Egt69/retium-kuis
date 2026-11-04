import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ParticleBackground from '../components/ParticleBackground'
import '../styles/kuis.css'

export default function ConfirmPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  
  const username = location.state?.username

  const handleConfirm = async (e) => {
    e.preventDefault()
    if (!code) return setError('Masukkan kode konfirmasi!')
    setLoading(true)
    setError('')

    try {
      const { data, error: dbError } = await supabase
        .from('access_codes')
        .select('*')
        .eq('confirm_code', code.toUpperCase())
        .maybeSingle()

      if (dbError) throw dbError

      if (!data) {
        setError('Kode konfirmasi salah. Periksa kembali kode Anda.')
        setLoading(false)
        return
      }

      await supabase.from('access_codes').update({ is_verified: true }).eq('id', data.id)

      localStorage.setItem('kuis_username', data.used_by)
      localStorage.setItem('kuis_wallet', data.wallet_address)
      localStorage.setItem('kuis_code', data.code)
      localStorage.setItem('kuis_negara', data.negara)

      setShowSuccess(true)

    } catch (err) {
      console.error(err)
      setError('Terjadi kesalahan sistem. Coba lagi.')
    } finally {
      setLoading(false)
    }
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
            <span className="input-icon-premium"></span>
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

      {showSuccess && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 99999,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#0a0e1a', padding: '2.5rem', borderRadius: '24px',
            border: '1px solid rgba(34, 197, 94, 0.3)', boxShadow: '0 25px 50px rgba(0,0,0,0.9)',
            maxWidth: '400px', width: '100%', textAlign: 'center',
            animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <h2 style={{ color: 'white', margin: '0 0 1rem 0', fontSize: '1.5rem' }}>Konfirmasi Berhasil</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Akun Anda telah aktif. Selamat datang di Retium Quiz.
            </p>
            <button 
              onClick={() => navigate('/dashboard')}
              style={{
                width: '100%', padding: '1rem', background: 'var(--orange)', color: '#0a0e1a',
                border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
                fontSize: '1rem', transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#ff9a33'}
              onMouseOut={(e) => e.currentTarget.style.background = 'var(--orange)'}
            >
              Masuk ke Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
