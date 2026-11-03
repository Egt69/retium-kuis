import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import '../styles/kuis.css'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [wallet, setWallet] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const navigate = useNavigate()

  // Fungsi Validasi Wallet
  const isValidWallet = (address) => {
    if (!address) return false
    return address.startsWith('rete') && address.length >= 30
  }

  // Fungsi Registrasi & Generate Kode
  const handleRegister = async () => {
    if (!username || !wallet) return setError('Isi Username Discord dan Wallet Address!')
    
    if (!isValidWallet(wallet)) {
      setError('Wallet tidak valid! Harus diawali "rete" dan memiliki panjang minimal 30 karakter.')
      return
    }

    setIsGenerating(true)
    setError('')

    const { data, error } = await supabase.rpc('register_participant', { 
      p_username: username, 
      p_wallet: wallet 
    })
    
    if (error) {
      setError('Gagal registrasi: ' + error.message)
    } else if (data.success) {
      setCode(data.code)
      alert(`Registrasi Sukses!\nKode Akses Kamu: ${data.code}\n\nHarap simpan/catat kode ini.`);
    } else {
      setError(data.message)
    }
    setIsGenerating(false)
  }

  // Fungsi Masuk Kuis
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    if (!isValidWallet(wallet)) {
      setError('Wallet tidak valid! Harus diawali "rete" dan memiliki panjang minimal 30 karakter.')
      return
    }

    setLoading(true)

    try {
      const { data: existingUser } = await supabase
        .from('access_codes')
        .select('*')
        .eq('wallet_address', wallet)
        .maybeSingle()

      if (existingUser) {
        if (existingUser.used_by !== username) {
          setError('Username Discord tidak cocok dengan Wallet ini!')
          setLoading(false)
          return
        }

        // Jika kode BELUM dipakai
        if (existingUser.used === false) {
          const { data: settings } = await supabase.from('quiz_settings').select('*').eq('id', 1).single()
          
          if (!settings || !settings.is_active) {
            setError('Pendaftaran telah ditutup oleh Admin.')
            setLoading(false)
            return
          }

          const now = new Date().getTime()
          const start = new Date(settings.start_time).getTime()

          if (now >= start) {
            setError('Waktu kuis sudah lewat. Kamu tidak bisa masuk lagi.')
            setLoading(false)
            return
          }

          localStorage.setItem('kuis_username', username)
          localStorage.setItem('kuis_wallet', wallet)
          localStorage.setItem('kuis_code', existingUser.code)
          localStorage.setItem('kuis_start_time', settings.start_time)
          
          navigate('/kuis')
          return
        }

        // Jika kode SUDAH dipakai (selesai)
        const { data: historyData } = await supabase
          .from('results')
          .select('*')
          .eq('username', existingUser.used_by)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (historyData) {
          localStorage.setItem('skor_akhir', historyData.skor_total)
          localStorage.setItem('hasil_benar', historyData.jumlah_benar)
          localStorage.setItem('hasil_salah', historyData.jumlah_salah)
          localStorage.setItem('hasil_pass', historyData.jumlah_pass)
          localStorage.setItem('waktu_selesai', historyData.waktu_selesai || '-')
        } else {
          localStorage.setItem('skor_akhir', '0') 
          localStorage.setItem('hasil_benar', '0')
          localStorage.setItem('hasil_salah', '0')
          localStorage.setItem('hasil_pass', '0')
          localStorage.setItem('waktu_selesai', 'Belum bermain')
        }
        
        navigate('/hasil')
        return
      }

      // Jika wallet BELUM terdaftar
      if (!code) {
        setError('Wallet belum terdaftar. Silakan isi Kode Akses atau klik "Daftar & Generate".')
        setLoading(false)
        return
      }

      const { data: settings } = await supabase.from('quiz_settings').select('*').eq('id', 1).single()
      
      if (!settings || !settings.is_active) {
        setError('Pendaftaran telah ditutup oleh Admin.')
        setLoading(false)
        return
      }

      const now = new Date().getTime()
      const start = new Date(settings.start_time).getTime()

      if (now >= start) {
        setError('PENDAFTARAN DITUTUP. Kuis sudah dimulai!')
        setLoading(false)
        return
      }

      const { data, error: rpcError } = await supabase.rpc('validate_access_code', {
        p_code: code,
        p_username: username
      })

      if (rpcError) throw rpcError

      if (data && data.valid) {
        localStorage.setItem('kuis_username', username)
        localStorage.setItem('kuis_wallet', wallet)
        localStorage.setItem('kuis_code', code)
        localStorage.setItem('kuis_start_time', settings.start_time)
        navigate('/kuis')
      } else {
        setError(data?.message || 'Kode tidak valid.')
      }
    } catch (err) {
      console.error(err)
      setError('Terjadi kesalahan sistem. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page-wrapper">
      <div className="aurora-bg">
        <div className="aurora-blob blob-1"></div>
        <div className="aurora-blob blob-2"></div>
      </div>
      <div className="bg-grid"></div>

      {/* KOTAK LOGIN PREMIUM */}
      <div className="login-box-premium">
        <div className="login-header">
          <h1 className="login-title">
            <span className="title-retium">RETIUM</span>
            <span className="title-kuis">KUIS</span>
          </h1>
          <p className="login-subtitle">Daftarkan dirimu atau masuk menggunakan kode akses.</p>
        </div>

        <form onSubmit={handleLogin} className="login-form-premium">
          <div className="input-group-premium">
            <label>Username Discord</label>
            <div className="input-wrapper-premium">
              <span className="input-icon-premium">👤</span>
              <input 
                type="text" placeholder="Contoh: akai#1234" 
                value={username} onChange={(e) => setUsername(e.target.value)}
                required disabled={loading}
              />
            </div>
          </div>

          <div className="input-group-premium">
            <label>Wallet Address (Wajib diawali 'rete')</label>
            <div className="input-wrapper-premium">
              <span className="input-icon-premium">🪙</span>
              <input 
                type="text" placeholder="rete..." 
                value={wallet} onChange={(e) => setWallet(e.target.value)}
                required disabled={loading}
              />
            </div>
          </div>

          <div className="input-group-premium">
            <label>Kode Akses Unik (Kosongkan jika sudah pernah daftar)</label>
            <div className="input-wrapper-premium">
              <span className="input-icon-premium">🔑</span>
              <input 
                type="text" placeholder="Kode otomatis atau masukkan kode cadangan" 
                value={code} onChange={(e) => setCode(e.target.value)}
                disabled={loading || isGenerating}
              />
            </div>
            
            <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" onClick={handleRegister} disabled={loading || isGenerating}
                style={{ background: 'transparent', border: 'none', color: 'var(--orange)', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {isGenerating ? 'Memproses...' : 'Belum punya kode? Daftar & Generate'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-premium" disabled={loading}>
            {loading ? 'MEMPROSES...' : 'MULAI KUIS 🚀'}
          </button>

          {error && <div className="error-msg-premium">{error}</div>}
        </form>
      </div>
    </div>
  )
}