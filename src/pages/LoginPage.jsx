import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ParticleBackground from '../components/ParticleBackground'

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
    <div style={{ background: '#05070c', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', fontFamily: 'Montserrat, sans-serif', padding: '1rem' }}>
      <ParticleBackground />
      
      <div style={{
        background: 'rgba(12, 16, 28, 0.85)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        border: '1px solid rgba(255, 122, 0, 0.3)',
        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.9), 0 0 50px rgba(255, 122, 0, 0.12)',
        borderRadius: '28px',
        width: '100%',
        maxWidth: '440px',
        padding: '2.5rem',
        position: 'relative',
        zIndex: 10
      }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', letterSpacing: '1px' }}>
            <span style={{ color: '#ff7a00', fontWeight: '900' }}>RETIUM</span> <span style={{ color: 'white', fontWeight: '400' }}>QUIZ</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.4rem' }}>Silakan masuk atau daftar untuk melanjutkan</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', background: 'rgba(0,0,0,0.4)', padding: '5px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <button 
            onClick={() => { setActiveTab('login'); setError(''); }} 
            style={{ 
              flex: 1,
              padding: '0.85rem',
              borderRadius: '12px',
              border: 'none',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '0.9rem',
              background: activeTab === 'login' ? '#ff7a00' : 'transparent', 
              color: activeTab === 'login' ? '#05070c' : '#94a3b8',
              boxShadow: activeTab === 'login' ? '0 5px 15px rgba(255, 122, 0, 0.3)' : 'none'
            }}
          >
            Login
          </button>
          <button 
            onClick={() => { setActiveTab('register'); setError(''); }} 
            style={{ 
              flex: 1,
              padding: '0.85rem',
              borderRadius: '12px',
              border: 'none',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '0.9rem',
              background: activeTab === 'register' ? '#ff7a00' : 'transparent', 
              color: activeTab === 'register' ? '#05070c' : '#94a3b8',
              boxShadow: activeTab === 'register' ? '0 5px 15px rgba(255, 122, 0, 0.3)' : 'none'
            }}
          >
            Daftar Baru
          </button>
        </div>

        {/* FORM LOGIN */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <input type="text" placeholder="Username Discord" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={loading} style={{ background: 'rgba(8, 12, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', color: 'white', padding: '1rem 1.2rem', width: '100%', fontSize: '0.95rem', outline: 'none' }} />
            </div>
            <div>
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} style={{ background: 'rgba(8, 12, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', color: 'white', padding: '1rem 1.2rem', width: '100%', fontSize: '0.95rem', outline: 'none' }} />
            </div>
            <button type="submit" disabled={loading} style={{ background: 'linear-gradient(135deg, #ff7a00 0%, #e56d00 100%)', color: '#05070c', border: 'none', borderRadius: '14px', padding: '1rem', fontWeight: '800', width: '100%', cursor: 'pointer', letterSpacing: '1px', boxShadow: '0 10px 25px rgba(255, 122, 0, 0.3)' }}>
              {loading ? 'MEMPROSES...' : 'MASUK KUIS'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                onClick={() => { setShowForgot(true); setError(''); }} 
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.85rem', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Lupa Password?
              </button>
            </div>

            {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.8rem', borderRadius: '10px', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}
          </form>
        )}

        {/* FORM REGISTER */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <input type="text" placeholder="Username Discord (Tanpa spasi)" value={username} onChange={handleUsernameChange} required disabled={loading} style={{ background: 'rgba(8, 12, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', color: 'white', padding: '1rem 1.2rem', width: '100%', fontSize: '0.95rem', outline: 'none' }} />
            </div>
            <div>
              <input type="password" placeholder="Buat Password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} style={{ background: 'rgba(8, 12, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', color: 'white', padding: '1rem 1.2rem', width: '100%', fontSize: '0.95rem', outline: 'none' }} />
            </div>
            <div>
              <input type="password" placeholder="Konfirmasi Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} style={{ background: 'rgba(8, 12, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', color: 'white', padding: '1rem 1.2rem', width: '100%', fontSize: '0.95rem', outline: 'none' }} />
            </div>
            <div>
              <input type="text" placeholder="Wallet Address (rete...)" value={wallet} onChange={(e) => setWallet(e.target.value)} required disabled={loading} style={{ background: 'rgba(8, 12, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', color: 'white', padding: '1rem 1.2rem', width: '100%', fontSize: '0.95rem', outline: 'none' }} />
            </div>
            
            <div>
              <select 
                value={selectedCountry} 
                onChange={(e) => setSelectedCountry(e.target.value)} 
                required 
                disabled={loading}
                style={{ background: 'rgba(8, 12, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', color: 'white', padding: '1rem 1.2rem', width: '100%', fontSize: '0.95rem', outline: 'none', cursor: 'pointer' }}
              >
                <option value="" disabled style={{ color: '#05070c', background: '#121826' }}>Pilih Negara Kamu</option>
                {countries.map((c) => (
                  <option key={c.kode_negara} value={c.kode_negara} style={{ color: 'white', background: '#121826' }}>
                    {c.nama_negara}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.8rem', borderRadius: '10px', fontSize: '0.75rem', color: '#f87171', textAlign: 'left', lineHeight: '1.4' }}>
              <strong>PERINGATAN KEAMANAN:</strong><br/>
              Hanya masukkan Alamat Wallet (Address). JANGAN pernah memberikan PIN, Sandi, Kode, atau Seed Phrase (Private Key) Anda ke website ini!
            </div>

            <button type="submit" disabled={loading} style={{ background: 'linear-gradient(135deg, #ff7a00 0%, #e56d00 100%)', color: '#05070c', border: 'none', borderRadius: '14px', padding: '1rem', fontWeight: '800', width: '100%', cursor: 'pointer', letterSpacing: '1px', boxShadow: '0 10px 25px rgba(255, 122, 0, 0.3)' }}>
              {loading ? 'MENDAFTAR...' : 'DAFTAR & DAPATKAN KODE'}
            </button>
            {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.8rem', borderRadius: '10px', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}
          </form>
        )}

      </div>

      {/* MODAL LUPA PASSWORD */}
      {showForgot && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(15px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ background: 'rgba(12, 16, 28, 0.95)', border: '1px solid rgba(255, 122, 0, 0.3)', borderRadius: '28px', padding: '2.5rem', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.9)' }}>
            <h2 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>Reset Password</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Masukkan Username, Kode Recovery (RTM-ID...), dan Password Baru.</p>

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <input type="text" placeholder="Username Discord" value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} required disabled={loading} style={{ background: 'rgba(8, 12, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', color: 'white', padding: '1rem 1.2rem', width: '100%', fontSize: '0.95rem', outline: 'none' }} />
              </div>
              <div>
                <input type="text" placeholder="Kode Recovery (RTM-ID...)" value={resetRecovery} onChange={(e) => setResetRecovery(e.target.value)} required disabled={loading} style={{ background: 'rgba(8, 12, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', color: 'white', padding: '1rem 1.2rem', width: '100%', fontSize: '0.95rem', outline: 'none', textTransform: 'uppercase' }} />
              </div>
              <div>
                <input type="password" placeholder="Password Baru" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={loading} style={{ background: 'rgba(8, 12, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', color: 'white', padding: '1rem 1.2rem', width: '100%', fontSize: '0.95rem', outline: 'none' }} />
              </div>

              {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.8rem', borderRadius: '10px', fontSize: '0.85rem' }}>{error}</div>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowForgot(false)} style={{ flex: 1, padding: '0.9rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '0.9rem', background: 'linear-gradient(135deg, #ff7a00 0%, #e56d00 100%)', border: 'none', color: '#05070c', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}>{loading ? 'Memproses...' : 'Reset Password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP KODE KONFIRMASI */}
      {recoveryPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 7, 12, 0.85)', backdropFilter: 'blur(15px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ background: 'rgba(12, 16, 28, 0.95)', border: '1px solid rgba(255, 122, 0, 0.3)', borderRadius: '28px', padding: '2.5rem', maxWidth: '450px', width: '100%', textAlign: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.9)' }}>
            <h2 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>Pendaftaran Sukses</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Simpan kode ini. Kamu akan membutuhkannya untuk verifikasi.</p>

            <div style={{ background: 'rgba(255, 122, 0, 0.08)', border: '1px dashed #ff7a00', padding: '1.2rem', borderRadius: '14px', marginBottom: '1.5rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0 0 0.4rem 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Kode Konfirmasi</p>
              <h1 style={{ color: 'white', margin: 0, fontSize: '1.3rem', letterSpacing: '2px', fontFamily: 'monospace' }}>{recoveryPopup.confirm_code}</h1>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
              <button 
                onClick={() => { navigator.clipboard.writeText(recoveryPopup.confirm_code); alert('Kode berhasil di-copy!'); }} 
                style={{ flex: 1, padding: '0.8rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
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
                style={{ flex: 1, padding: '0.8rem', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#60a5fa', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Download
              </button>
            </div>

            <button 
              onClick={() => { 
                setRecoveryPopup(null); 
                navigate('/konfirmasi', { state: { username: username } }); 
              }} 
              style={{ background: 'linear-gradient(135deg, #ff7a00 0%, #e56d00 100%)', color: '#05070c', border: 'none', borderRadius: '12px', padding: '1rem', fontWeight: '800', width: '100%', cursor: 'pointer' }}
            >
              Saya Sudah Mencatat, Lanjut
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
