import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ParticleBackground from '../components/ParticleBackground'
import '../styles/kuis.css'

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('login')
  
  // State Form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [wallet, setWallet] = useState('')
  const [countries, setCountries] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  
  // State Modal Lupa Password
  const [showForgot, setShowForgot] = useState(false)
  const [resetUsername, setResetUsername] = useState('')
  const [resetRecovery, setResetRecovery] = useState('')
  const [newPassword, setNewPassword] = useState('')
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoveryPopup, setRecoveryPopup] = useState(null)
  
  const navigate = useNavigate()

  // AMBIL DATA NEGARA (FIX DARI useState JADI useEffect)
  useEffect(() => {
    const fetchCountries = async () => {
      const { data } = await supabase.from('rooms').select('*').eq('is_global', false)
      if (data) setCountries(data)
    }
    fetchCountries()
  }, [])

  const handleUsernameChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '') 
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
    
    if (!username || !password || !confirmPassword || !wallet || !selectedCountry) {
      return setError('Semua kolom harus diisi, termasuk negara!')
    }
    if (username.length < 3) return setError('Username Discord minimal 3 karakter.')
    if (password !== confirmPassword) return setError('Password dan Konfirmasi Password tidak cocok!')
    if (!isValidWallet(wallet)) return setError('Wallet tidak valid! Harus diawali "rete".')

    setLoading(true)

    // FIX: TAMBAHKAN p_negara
    const { data, error } = await supabase.rpc('register_participant', { 
      p_username: username, 
      p_password: password,
      p_wallet: wallet,
      p_negara: selectedCountry
    })
    
    if (error) {
      setError('Gagal registrasi: ' + error.message)
    } else if (data.success) {
      setRecoveryPopup({ confirm_code: data.confirm_code })
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

      localStorage.setItem('kuis_username', user.used_by)
      localStorage.setItem('kuis_wallet', user.wallet_address)
      localStorage.setItem('kuis_code', user.code)
      localStorage.setItem('kuis_negara', user.negara)

      navigate('/dashboard')
      
    } catch (err) {
      console.error(err)
      setError('Terjadi kesalahan sistem. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  // Fungsi Reset Password (Lupa Password)
  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: user } = await supabase
        .from('access_codes')
        .select('*')
        .eq('used_by', resetUsername)
        .eq('confirm_code', resetRecovery.toUpperCase())
        .maybeSingle()

      if (!user) {
        setError('Username atau Kode Recovery salah!')
        setLoading(false)
        return
      }

      const { error: updateError } = await supabase
        .from('access_codes')
        .update({ password: newPassword })
        .eq('id', user.id)

      if (updateError) throw updateError

      alert('Password berhasil di-reset! Silakan login dengan password baru.')
      setShowForgot(false)
      setResetUsername('')
      setResetRecovery('')
      setNewPassword('')

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
        
        <div className="login-header">
          <h1 className="login-title">
            <span className="title-retium">RETIUM</span>
            <span className="title-kuis">QUIZ</span>
          </h1>
        </div>

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
              <input type="text" placeholder="Username Discord" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={loading} />
            </div>
            <div className="input-wrapper-premium">
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            </div>
            <button type="submit" className="btn-premium" disabled={loading}>
              {loading ? 'MEMPROSES...' : 'MASUK KUIS'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button 
                type="button" 
                onClick={() => { setShowForgot(true); setError(''); }} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Lupa Password?
              </button>
            </div>

            {error && <div className="error-msg-premium">{error}</div>}
          </form>
        )}

        {/* FORM REGISTER */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="login-form-premium">
            <div className="input-wrapper-premium">
              <input type="text" placeholder="Username Discord (Tanpa spasi)" value={username} onChange={handleUsernameChange} required disabled={loading} />
            </div>
            <div className="input-wrapper-premium">
              <input type="password" placeholder="Buat Password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            </div>
            <div className="input-wrapper-premium">
              <input type="password" placeholder="Konfirmasi Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} />
            </div>
            <div className="input-wrapper-premium">
              <input type="text" placeholder="Wallet Address (rete...)" value={wallet} onChange={(e) => setWallet(e.target.value)} required disabled={loading} />
            </div>
            
            {/* DROPDOWN NEGARA */}
            <div className="input-wrapper-premium">
              <select 
                value={selectedCountry} 
                onChange={(e) => setSelectedCountry(e.target.value)} 
                required 
                disabled={loading}
                style={{ width: '100%', padding: '1.1rem 1rem 1.1rem 3.2rem', background: 'transparent', border: 'none', color: 'white', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none' }}
              >
                <option value="" disabled style={{ color: '#0a0e1a' }}>Pilih Negara Kamu</option>
                {countries.map((c) => (
                  <option key={c.kode_negara} value={c.kode_negara} style={{ color: '#0a0e1a' }}>
                    {c.nama_negara}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.8rem', borderRadius: '8px', fontSize: '0.75rem', color: '#ef4444', textAlign: 'left', lineHeight: '1.4' }}>
              <strong>PERINGATAN KEAMANAN:</strong><br/>
              Hanya masukkan Alamat Wallet (Address). JANGAN pernah memberikan PIN, Sandi, Kode, atau Seed Phrase (Private Key) Anda ke website ini!
            </div>

            <button type="submit" className="btn-premium" disabled={loading}>
              {loading ? 'MENDAFTAR...' : 'DAFTAR & DAPATKAN KODE'}
            </button>
            {error && <div className="error-msg-premium">{error}</div>}
          </form>
        )}

      </div>

      {/* MODAL LUPA PASSWORD */}
      {showForgot && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ background: '#0a0e1a', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,122,0,0.3)', boxShadow: '0 25px 50px rgba(0,0,0,0.9)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <h2 style={{ color: 'white', margin: '0 0 1rem 0', fontSize: '1.5rem' }}>Reset Password</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Masukkan Username, Kode Recovery (RTM-ID...), dan Password Baru.</p>

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-wrapper-premium">
                <input type="text" placeholder="Username Discord" value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} required disabled={loading} />
              </div>
              <div className="input-wrapper-premium">
                <input type="text" placeholder="Kode Recovery (RTM-ID...)" value={resetRecovery} onChange={(e) => setResetRecovery(e.target.value)} required disabled={loading} style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="input-wrapper-premium">
                <input type="password" placeholder="Password Baru" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={loading} />
              </div>

              {error && <div className="error-msg-premium">{error}</div>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowForgot(false)} style={{ flex: 1, padding: '1rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '1rem', background: 'var(--orange)', border: 'none', color: '#0a0e1a', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{loading ? 'Memproses...' : 'Reset Password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP KODE KONFIRMASI */}
      {recoveryPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ background: '#0a0e1a', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,122,0,0.3)', boxShadow: '0 25px 50px rgba(0,0,0,0.9)', maxWidth: '450px', width: '100%', textAlign: 'center' }}>
            <h2 style={{ color: 'white', margin: '0 0 1rem 0', fontSize: '1.5rem' }}>Pendaftaran Sukses</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Simpan kode ini. Kamu akan membutuhkannya untuk verifikasi.</p>

            <div style={{ background: 'rgba(255, 122, 0, 0.1)', border: '1px dashed var(--orange)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Kode Konfirmasi</p>
              <h1 style={{ color: 'white', margin: 0, fontSize: '1.4rem', letterSpacing: '2px', fontFamily: 'monospace' }}>{recoveryPopup.confirm_code}</h1>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
              <button 
                onClick={() => { navigator.clipboard.writeText(recoveryPopup.confirm_code); alert('Kode berhasil di-copy!'); }} 
                style={{ flex: 1, padding: '0.8rem', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', color: '#22c55e', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Copy
              </button>
              <button 
                onClick={() => {
                  const element = document.createElement("a");
                  const file = new Blob([`KODE KONFIRMASI RETIUM QUIZ\n\nKode: ${recoveryPopup.confirm_code}\n\nJangan bagikan kode ini ke siapapun.`], {type: 'text/plain'});
                  element.href = URL.createObjectURL(file);
                  element.download = "Kode_Konfirmasi_Retium.txt";
                  document.body.appendChild(element);
                  element.click();
                }} 
                style={{ flex: 1, padding: '0.8rem', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Download
              </button>
            </div>

            <button 
              onClick={() => { 
                setRecoveryPopup(null); 
                navigate('/konfirmasi', { state: { username: username } }); 
              }} 
              style={{ width: '100%', padding: '1rem', background: 'var(--orange)', border: 'none', color: '#0a0e1a', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Saya Sudah Mencatat, Lanjut
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
