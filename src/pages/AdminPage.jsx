import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import '../styles/kuis.css'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState('')
  
  // State Data Live & Statistik
  const [liveData, setLiveData] = useState([])
  const [finishedData, setFinishedData] = useState([])

  // State Kontrol Jadwal & Countdown
  const [startTimeInput, setStartTimeInput] = useState('')
  const [isQuizActive, setIsQuizActive] = useState(false)
  const [timeToStart, setTimeToStart] = useState('00:00:00')

  // State Data Registrasi Peserta & Search
  const [registeredList, setRegisteredList] = useState([])
  const [showAllData, setShowAllData] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [inputSearch, setInputSearch] = useState('')

  // 1. Fungsi Login Admin
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    const { data, error } = await supabase.rpc('validate_admin', { p_password: password })
    
    if (error) setError('Sistem error.')
    else if (data === true) setIsAuthenticated(true)
    else setError('Password salah!')
  }

  // 2. Ambil Data Live & Statistik
  const fetchData = async () => {
    const { data: live } = await supabase
      .from('live_scores')
      .select('*')
      .lt('soal_sekarang', 15) 
      .order('skor', { ascending: false })
    
    const { data: finished } = await supabase
      .from('results')
      .select('username, skor_total, jumlah_benar, jumlah_salah, jumlah_pass, waktu_selesai')

    if (live) setLiveData(live)
    else setLiveData([])

    if (finished) {
      const parseWaktuKeDetik = (teksWaktu) => {
        if (!teksWaktu) return 999999
        const cocok = teksWaktu.match(/(\d+)\s*Menit\s*(\d+)\s*Detik/)
        if (cocok) return parseInt(cocok[1]) * 60 + parseInt(cocok[2])
        return 999999
      }
      const sortedFinished = finished.sort((a, b) => {
        if (b.skor_total !== a.skor_total) return b.skor_total - a.skor_total
        return parseWaktuKeDetik(a.waktu_selesai) - parseWaktuKeDetik(b.waktu_selesai)
      })
      setFinishedData(sortedFinished)
    } else {
      setFinishedData([])
    }
  }

  // 3. Ambil Status Jadwal & Data Registrasi
  const fetchSettingsAndData = async () => {
    const { data: regData, error: regError } = await supabase
      .from('access_codes')
      .select('*') 
    
    if (regError) {
      console.error("Gagal ambil data registrasi:", regError)
    } else if (regData) {
      const sortedData = regData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setRegisteredList(sortedData)
    }

    if (!startTimeInput) {
      const { data: settings } = await supabase.from('quiz_settings').select('*').eq('id', 1).single()
      if (settings) {
        setIsQuizActive(settings.is_active)
        if (settings.start_time) {
          const d = new Date(settings.start_time)
          const localISOTime = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
          setStartTimeInput(localISOTime)
        }
      }
    } else {
      const { data: settings } = await supabase.from('quiz_settings').select('is_active').eq('id', 1).single()
      if (settings) setIsQuizActive(settings.is_active)
    }
  }

  // 4. Auto-Refresh
  useEffect(() => {
    if (!isAuthenticated) return
    fetchData()
    fetchSettingsAndData()

    const intervalId = setInterval(() => {
      fetchData()
      fetchSettingsAndData() 
    }, 2000)
    
    return () => clearInterval(intervalId)
  }, [isAuthenticated, startTimeInput])

  // 5. Hitung Mundur
  useEffect(() => {
    if (!isAuthenticated) return 

    const interval = setInterval(async () => {
      const { data: settings } = await supabase.from('quiz_settings').select('start_time, is_active').eq('id', 1).single()
      
      if (settings && settings.is_active) {
        const now = new Date().getTime()
        const start = new Date(settings.start_time).getTime()
        const distance = start - now

        if (distance > 0) {
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0')
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0')
          const seconds = Math.floor((distance % (1000 * 60)) / 1000).toString().padStart(2, '0')
          setTimeToStart(`${hours}:${minutes}:${seconds}`)
        } else {
          setTimeToStart('KUIS DIMULAI')
        }
      } else {
        setTimeToStart('DITUTUP')
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated])

  // 6. Simpan Jadwal
  const handleSetSchedule = async () => {
    if (!startTimeInput) return alert('Pilih waktu terlebih dahulu!')
    const isoTime = new Date(startTimeInput).toISOString()
    
    const { error } = await supabase.from('quiz_settings').update({ 
      start_time: isoTime, is_active: true 
    }).eq('id', 1)

    if (error) alert('Gagal set jadwal: ' + error.message)
    else {
      alert('Jadwal kuis berhasil diatur!')
      setStartTimeInput('') 
    }
  }

  // 7. Tutup Pendaftaran
  const handleStopQuiz = async () => {
    if(!window.confirm("Tutup pendaftaran? Peserta baru tidak akan bisa mendaftar atau masuk.")) return;
    await supabase.from('quiz_settings').update({ is_active: false }).eq('id', 1)
    alert('Pendaftaran ditutup!')
    fetchSettingsAndData()
  }

  // 8. Reset Live Scores
  const handleReset = async () => {
    if (window.confirm("Yakin ingin menghapus semua data live skor?")) {
      const { error } = await supabase.from('live_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (!error) {
        setLiveData([])
        setFinishedData([])
      }
    }
  }

  // 9. Reset Kode per Baris
  const handleResetCode = async (code, username) => {
    if (!window.confirm(`Izinkan "${username}" main lagi dengan kode ${code}?`)) return;
    const { error } = await supabase.from('access_codes').update({ used: false }).eq('code', code);
    if (error) alert('Gagal: ' + error.message);
    else { alert('Kode berhasil di-reset!'); fetchSettingsAndData(); }
  }

  // 10. Reset Semua Data Peserta
  const handleResetAllParticipants = async () => {
    if (!window.confirm("HATI-HATI!\nIni akan menghapus SEMUA data peserta (Wallet, Discord, Kode).\nSkor dan Leaderboard TIDAK akan terhapus.\n\nYakin?")) return;
    
    const { error } = await supabase.from('access_codes').delete().neq('id', '0');
    
    if (error) alert('Gagal reset peserta: ' + error.message);
    else {
      alert('SEMUA DATA PESERTA BERHASIL DIHAPUS!');
      fetchSettingsAndData(); 
    }
  }

  // ==========================================
  // TAMPILAN LOGIN ADMIN
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="login-page-wrapper" style={{ background: '#060913' }}>
        <div className="aurora-bg">
          <div className="aurora-blob blob-1" style={{ opacity: 0.15 }}></div>
          <div className="aurora-blob blob-2" style={{ opacity: 0.15 }}></div>
        </div>
        
        <div style={{
          position: 'relative', zIndex: 10, background: 'rgba(18, 26, 46, 0.7)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          padding: '3rem 2.5rem', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.8)', width: '100%', maxWidth: '400px', textAlign: 'center'
        }}>
          <h2 style={{ color: '#ff7a00', marginBottom: '2rem', fontSize: '1.8rem', fontWeight: '800', letterSpacing: '1px' }}>
            Akses Admin
          </h2>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', color: '#8a93a8', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', letterSpacing: '1px' }}>
                Password Rahasia
              </label>
              <input 
                type="password" placeholder="Masukkan password admin..." value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '1rem', background: 'rgba(10, 14, 26, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px',
                  color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <button type="submit" style={{
              width: '100%', padding: '1rem', backgroundColor: '#ff7a00', color: '#0a0e1a',
              border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '1.1rem',
              cursor: 'pointer', marginTop: '0.5rem', boxShadow: 'none', transition: 'background-color 0.2s'
            }}>
              Masuk
            </button>
            {error && <div style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: '600' }}>{error}</div>}
          </form>
        </div>
      </div>
    )
  }

  // ==========================================
  // TAMPILAN DASHBOARD (WEB3 PREMIUM)
  // ==========================================
  return (
    <div style={{
      minHeight: '100vh', background: '#09090b', padding: '3rem 2rem', 
      fontFamily: 'Montserrat, sans-serif', color: '#f4f4f5'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER DASHBOARD */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #27272a', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '600', letterSpacing: '-0.5px', color: '#ffffff' }}>
              Dashboard Admin
            </h1>
            <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
              Retium Quiz Control Center
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <button onClick={handleReset} style={{ background: 'transparent', border: '1px solid #27272a', color: '#a1a1aa', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#a1a1aa'; }}>
              Reset Data Live
            </button>
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '0.6rem 1.2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', fontWeight: '500', color: '#22c55e' }}>
              <span style={{ width: '6px', height: '6px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span>
              System Online
            </div>
          </div>
        </div>

        {/* TOP GRID: KONTROL & DATA PESERTA */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          {/* Kontrol Jadwal */}
          <div style={{ background: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '1.5rem' }}>
            <h3 style={{ color: '#ffffff', margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>Kontrol Jadwal</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input type="datetime-local" value={startTimeInput} onChange={(e) => setStartTimeInput(e.target.value)} style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', background: '#09090b', color: '#ffffff', border: '1px solid #27272a', outline: 'none', fontSize: '0.9rem' }} />
              <button onClick={handleSetSchedule} style={{ background: '#ffffff', color: '#09090b', padding: '0.8rem 1.2rem', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#e4e4e7'} onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}>
                Set
              </button>
              <button onClick={handleStopQuiz} style={{ background: 'transparent', color: '#a1a1aa', padding: '0.8rem 1.2rem', borderRadius: '8px', border: '1px solid #27272a', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#52525b'; }} onMouseOut={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = '#27272a'; }}>
                Stop
              </button>
            </div>
            <div style={{ padding: '1rem', background: '#09090b', borderRadius: '8px', textAlign: 'center', border: '1px solid #27272a' }}>
              <p style={{ color: '#a1a1aa', fontSize: '0.75rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</p>
              <h2 style={{ color: !isQuizActive ? '#a1a1aa' : '#ffffff', margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
                {!isQuizActive ? 'CLOSED' : timeToStart}
              </h2>
            </div>
          </div>

          {/* Data Registrasi Peserta */}
          <div style={{ background: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ color: '#ffffff', margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' }}>Database Peserta</h3>
              <p style={{ color: '#a1a1aa', margin: 0, fontSize: '0.85rem' }}>Total <strong style={{ color: '#ffffff' }}>{registeredList.length}</strong> wallet terdaftar.</p>
            </div>
            <button onClick={() => setShowAllData(true)} style={{ background: '#27272a', border: '1px solid #3f3f46', color: '#ffffff', padding: '0.8rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s', width: '100%', marginTop: '1rem' }} onMouseOver={(e) => e.currentTarget.style.background = '#3f3f46'} onMouseOut={(e) => e.currentTarget.style.background = '#27272a'}>
              Lihat & Copy Data
            </button>
          </div>

        </div>

        {/* BOTTOM GRID: LIVE MONITOR & STATISTIK */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          
          {/* LIVE MONITOR */}
          <div style={{ background: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '1.5rem' }}>
            <h3 style={{ color: '#ffffff', margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#ff7a00' }}>●</span> Live Monitor
            </h3>
            <div style={{ display: 'flex', padding: '0 0.5rem', color: '#a1a1aa', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.8rem' }}>
              <div style={{ flex: 2 }}>Pemain</div><div style={{ flex: 1, textAlign: 'center' }}>Progres</div><div style={{ flex: 1, textAlign: 'center' }}>Skor</div><div style={{ flex: 1, textAlign: 'right' }}>B / S / P</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {liveData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: '#52525b', fontSize: '0.9rem' }}>Menunggu pemain...</div>
              ) : (
                liveData.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '1rem', background: '#09090b', borderRadius: '8px', border: '1px solid #27272a' }}>
                    <div style={{ flex: 2, fontWeight: '500', color: '#ffffff', fontSize: '0.9rem' }}>{r.username}</div>
                    <div style={{ flex: 1, textAlign: 'center', color: '#a1a1aa', fontSize: '0.85rem' }}>{r.soal_sekarang}/15</div>
                    <div style={{ flex: 1, textAlign: 'center', color: '#ffffff', fontWeight: '600', fontSize: '0.9rem' }}>{r.skor}</div>
                    <div style={{ flex: 1, textAlign: 'right', fontSize: '0.8rem', color: '#a1a1aa' }}>{r.benar || 0} / {r.salah || 0} / {r.pass || 0}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* STATISTIK */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#a1a1aa', fontSize: '0.75rem', margin: '0 0 0.5rem 0', textTransform: 'uppercase', fontWeight: '600' }}>Top Score</p>
                  {finishedData.length > 0 ? (
                    <><div style={{ color: '#ffffff', fontWeight: '600', fontSize: '1.1rem' }}>{finishedData[0].username}</div><div style={{ color: '#ff7a00', fontWeight: '700', fontSize: '1.5rem' }}>{finishedData[0].skor_total} <span style={{fontSize:'0.8rem', color: '#a1a1aa', fontWeight: 'normal'}}>PTS</span></div></>
                  ) : <span style={{ color: '#52525b', fontSize: '0.9rem' }}>-</span>}
                </div>
                <div style={{ width: '1px', background: '#27272a' }}></div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#a1a1aa', fontSize: '0.75rem', margin: '0 0 0.5rem 0', textTransform: 'uppercase', fontWeight: '600' }}>Fastest Time</p>
                  {finishedData.length > 0 ? (
                    <><div style={{ color: '#ffffff', fontWeight: '600', fontSize: '1.1rem' }}>{finishedData[0].username}</div><div style={{ color: '#ffffff', fontWeight: '600', fontSize: '1.1rem' }}>{finishedData[0].waktu_selesai}</div></>
                  ) : <span style={{ color: '#52525b', fontSize: '0.9rem' }}>-</span>}
                </div>
              </div>
            </div>
            <div style={{ background: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '1.5rem', flex: 1 }}>
              <h3 style={{ color: '#ffffff', margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>Leaderboard</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                {finishedData.length === 0 ? (
                  <p style={{ color: '#52525b', margin: 0, fontSize: '0.9rem' }}>Belum ada data.</p>
                ) : (
                  finishedData.map((r, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', background: '#09090b', borderRadius: '8px', border: '1px solid #27272a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ color: index < 3 ? '#ffffff' : '#52525b', fontWeight: '600', fontSize: '0.9rem', width: '20px' }}>{index + 1}</span>
                        <div><div style={{ fontWeight: '500', color: '#ffffff', fontSize: '0.9rem' }}>{r.username}</div><div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px' }}>{r.waktu_selesai}</div></div>
                      </div>
                      <div style={{ color: '#ffffff', fontWeight: '600', fontSize: '1rem' }}>{r.skor_total}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MODAL DATA PESERTA (BAGIAN 2 AKAN DISAMBUNG DI SINI) */}
		        {/* MODAL DATA PESERTA (FULL FITUR) */}
        {showAllData && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
            <div style={{ background: '#0a0e1a', width: '100%', maxWidth: '1000px', maxHeight: '85vh', borderRadius: '24px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,122,0,0.3)', boxShadow: '0 25px 50px rgba(0,0,0,0.9)' }}>
              
              {/* Header Modal & Search */}
              <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ color: 'white', margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>Data Lengkap Peserta</h2>
                    <p style={{ color: '#8a93a8', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>Total {registeredList.length} peserta</p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleResetAllParticipants} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '0 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem' }}>Reset Peserta</button>
                    <button onClick={() => setShowAllData(false)} style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid #ffffff', color: '#ffffff', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem' }}>✕</button>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '1.1rem' }}>🔍</span>
                    <input 
                      type="text" 
                      placeholder="Cari Discord, Wallet, atau Kode..." 
                      value={inputSearch} 
                      onChange={(e) => setInputSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setSearchQuery(inputSearch); }}
                      style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '10px', background: 'rgba(10, 14, 26, 0.8)', border: '1px solid rgba(255, 255, 255, 0.2)', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button onClick={() => setSearchQuery(inputSearch)} style={{ background: '#ff7a00', color: '#0a0e1a', border: 'none', borderRadius: '10px', padding: '0 1.5rem', fontWeight: '800', cursor: 'pointer', fontSize: '1rem', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#ff9a33'} onMouseOut={(e) => e.currentTarget.style.background = '#ff7a00'}>Cari</button>
                </div>
              </div>

              {/* Tabel Data */}
              <div style={{ padding: '1rem 2rem 2rem 2rem', overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', fontSize: '0.9rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#0a0e1a', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '2px solid var(--orange)', width: '20%', color: '#8a93a8' }}>Discord</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '2px solid var(--orange)', color: '#8a93a8' }}>Wallet Address</th>
                      <th style={{ padding: '12px 10px', textAlign: 'center', borderBottom: '2px solid var(--orange)', width: '12%', color: '#8a93a8' }}>Kode</th>
                      <th style={{ padding: '12px 10px', textAlign: 'center', borderBottom: '2px solid var(--orange)', width: '25%', color: '#8a93a8' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registeredList
                      .filter(r => r.used_by?.toLowerCase().includes(searchQuery.toLowerCase()) || r.wallet_address?.toLowerCase().includes(searchQuery.toLowerCase()) || r.code?.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 10px', fontWeight: '700', color: 'white' }}>{r.used_by}</td>
                        <td style={{ padding: '12px 10px', color: '#8a93a8', fontFamily: 'monospace' }}>
                          <div title={r.wallet_address} style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.wallet_address || '-'}</div>
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          <span style={{ background: r.used ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: r.used ? '1px solid #ef4444' : '1px solid #22c55e', color: r.used ? '#ef4444' : '#22c55e', padding: '4px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '0.8rem' }}>{r.code}</span>
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button onClick={() => { navigator.clipboard.writeText(r.wallet_address); alert('Wallet di-copy!'); }} style={{ background: 'transparent', border: '1px solid #3f3f46', color: '#ffffff', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>Copy</button>
                            {r.used && (
                              <button onClick={() => handleResetCode(r.code, r.used_by)} style={{ background: 'rgba(255, 122, 0, 0.1)', border: '1px solid #ff7a00', color: '#ff7a00', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '800' }}>Reset</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}