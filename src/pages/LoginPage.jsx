import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ParticleBackground from '../components/ParticleBackground'
import '../styles/kuis.css'

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('login') // 'login' atau 'register'
  
  // State Form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [wallet, setWallet] = useState('')
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Fungsi Filter Username (Hanya huruf, angka, dan garis bawah)
  const handleUsernameChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '') // Hapus karakter aneh
    setUsername(val)
  }

  const isValidWallet = (address) => {
    if (!address) return false
    return address.startsWith('rete') && address.length >= 30
  }

  // Fungsi Daftar
  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!username || !password || !confirmPassword || !wallet) {
      return setError('Semua kolom harus diisi!')
    }
    if (username.length < 3) {
      return setError('Username Discord minimal 3 karakter.')
    }
    if (password !== confirmPassword) {
      return setError('Password dan Konfirmasi Password tidak cocok!')
    }
    if (!isValidWallet(wallet)) {
      return setError('Wallet tidak valid! Harus diawali "rete".')
    }

    setLoading(true)

    const { data, error } = await supabase.rpc('register_participant', { 
      p_username: username, 
      p_password: password,
      p_wallet: wallet 
    })
    
    if (error) {
      setError('Gagal registrasi: ' + error.message)
    } else if (data.success) {
      // Tampilkan alert kode rahasia
      alert(
        `REGISTRASI BERHASIL!\n\n` +
        `Simpan Kode Rahasia ini untuk Reset Password jika kamu lupa:\n` +
        `RECOVERY CODE: ${data.recovery}\n\n` +
        `JANGAN BERIKAN KODE INI KE SIAPAPUN!`
      )
      // Setelah daftar, arahkan ke halaman login
      setActiveTab('login')
      setPassword('')
      setConfirmPassword('')
    } else {
      setError(data.message)
    }
    setLoading(false)
  }

  // Fungsi Login
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    if (!username || !password) return setError('Username dan Password harus diisi!')
    
    setLoading(true)

    try {
      // Cek user berdasarkan username dan password
      const { data: user, error: dbError } = await supabase
        .from('access_codes')
        .select('*')
        .eq('used_by', username)
        .eq('password', password)
        .maybeSingle()

      if (dbError) throw dbError

      if (!user) {
        setError('Username atau Password salah!')
        setLoading(false)
        return
      }

      // Cek jadwal kuis
      const { data: settings } = await supabase.from('quiz_settings').select('*').eq('id', 1).single()
      if (!settings || !settings.is_active) {
        setError('Pendaftaran/Login telah ditutup oleh Admin.')
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

      // Jika kode belum dipakai (belum main), masuk ke Kuis
      if (user.used === false) {
        localStorage.setItem('kuis_username', user.used_by)
        localStorage.setItem('kuis_wallet', user.wallet_address)
        localStorage.setItem('kuis_code', user.code)
        localStorage.setItem('kuis_start_time', settings.start_time)
        navigate('/kuis')
        return
      }

      // Jika kode sudah dipakai (selesai main), ke halaman Hasil
      const { data: historyData } = await supabase.from('results').select('*').eq('username', user.used_by).order('created_at', { ascending: false }).limit(1).maybeSingle()

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

    } catch (err) {
      console.error(err)
      setError('Terjadi kesalahan sistem.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page-wrapper">
      <ParticleBackground />
      
      <div className="login-box-premium">
        
        {/* Header */}
        <div className="login-header">
          <h1 className="login-title">
            <span className="title-retium">RETIUM</span>
            <span className="title-kuis">QUIZ</span>
          </h1>
        </div>

        {/* TABS LOGIN / REGISTER */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem' }}>
          <button 
            onClick={() => { setActiveTab('login'); setError(''); }} 
            style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', border: 'none', fontWeight: '800', cursor: 'pointer', transition: 'all 0.3s', background: activeTab === 'login' ? 'var(--orange)' : 'rgba(255,255,255,0.05)', color: activeTab === 'login' ? '#0a0e1a' : 'var(--text-muted)' }}
          >
            Login
          </button>
          <button 
            onClick={() => { setActiveTab('register'); setError(''); }} 
            style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', border: 'none', fontWeight: '800', cursor: 'pointer', transition: 'all 0.3s', background: activeTab === 'register' ? 'var(--orange)' : 'rgba(255,255,255,0.05)', color: activeTab === 'register' ? '#0a0e1a' : 'var(--text-muted)' }}
          >
            Daftar Baru
          </button>
        </div>

        {/* FORM LOGIN */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="login-form-premium">
            <div className="input-wrapper-premium">
              <span className="input-icon-premium">👤</span>
              <input type="text" placeholder="Username Discord" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={loading} />
            </div>
            <div className="input-wrapper-premium">
              <span className="input-icon-premium">🔒</span>
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            </div>
            <button type="submit" className="btn-premium" disabled={loading}>
              {loading ? 'MEMPROSES...' : 'MASUK KUIS'}
            </button>
            {error && <div className="error-msg-premium">{error}</div>}
          </form>
        )}

        {/* FORM REGISTER */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="login-form-premium">
            <div className="input-wrapper-premium">
              <span className="input-icon-premium">👤</span>
              <input type="text" placeholder="Username Discord (Tanpa spasi)" value={username} onChange={handleUsernameChange} required disabled={loading} />
            </div>
            <div className="input-wrapper-premium">
              <span className="input-icon-premium">🔒</span>
              <input type="password" placeholder="Buat Password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            </div>
            <div className="input-wrapper-premium">
              <span className="input-icon-premium">🔒</span>
              <input type="password" placeholder="Konfirmasi Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} />
            </div>
            <div className="input-wrapper-premium">
              <span className="input-icon-premium">🪙</span>
              <input type="text" placeholder="Wallet Address (rete...)" value={wallet} onChange={(e) => setWallet(e.target.value)} required disabled={loading} />
            </div>

            {/* PERINGATAN KEAMANAN */}
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.8rem', borderRadius: '8px', fontSize: '0.75rem', color: '#ef4444', textAlign: 'left', lineHeight: '1.4' }}>
              <strong>⚠️ PERINGATAN KEAMANAN:</strong><br/>
              Hanya masukkan Alamat Wallet (Address). JANGAN pernah memberikan PIN, Sandi, Kode, atau Seed Phrase (Private Key) Anda ke website ini!
            </div>

            <button type="submit" className="btn-premium" disabled={loading}>
              {loading ? 'MENDAFTAR...' : 'DAFTAR & DAPATKAN KODE'}
            </button>
            {error && <div className="error-msg-premium">{error}</div>}
          </form>
        )}

      </div>
    </div>
  )
}
