import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import '../styles/kuis.css'

export default function AdminPage() {
  const navigate = useNavigate()

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  
  const [liveData, setLiveData] = useState([])
  const [finishedData, setFinishedData] = useState([])
  const [isQuizActive, setIsQuizActive] = useState(false)
  const [registeredList, setRegisteredList] = useState([])
  const [showAllData, setShowAllData] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [inputSearch, setInputSearch] = useState('')
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState('GLB')

  const [modalConfirm, setModalConfirm] = useState({ show: false, type: '', title: '', message: '', action: null })

  useEffect(() => {
    const checkAdminSession = async () => {
      const savedAuth = localStorage.getItem('admin_auth')
      if (savedAuth === 'true') {
        setIsAuthenticated(true)
      }
      setIsCheckingAuth(false)
    }
    checkAdminSession()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    const { data, error } = await supabase.rpc('validate_admin', { p_password: password })
    if (error) {
      setError('Sistem error.')
    } else if (data === true) {
      localStorage.setItem('admin_auth', 'true')
      setIsAuthenticated(true)
    } else {
      setError('Password salah!')
    }
  }

  const handleAdminLogout = () => {
    localStorage.removeItem('admin_auth')
    setIsAuthenticated(false)
  }

  const fetchData = async () => {
    const { data: live } = await supabase.from('live_scores').select('*').lt('soal_sekarang', 15).order('skor', { ascending: false })
    const { data: finished } = await supabase.from('results').select('username, skor_total, jumlah_benar, jumlah_salah, jumlah_pass, waktu_selesai')
    
    if (live) setLiveData(live)
    if (finished) {
      const parseWaktu = (t) => {
        if (!t) return 999999
        const m = t.match(/(\d+)\s*Menit\s*(\d+)\s*Detik/)
        return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 999999
      }
      setFinishedData(finished.sort((a, b) => (b.skor_total - a.skor_total) || (parseWaktu(a.waktu_selesai) - parseWaktu(b.waktu_selesai))))
    }
  }

  const loadRoomData = async () => {
    const { data: regData } = await supabase
      .from('access_codes')
      .select('id, used_by, wallet_address, code, used, negara, created_at')
    
    if (regData) setRegisteredList(regData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))

    const { data: roomData } = await supabase.from('rooms').select('*')
    if (roomData) setRooms(roomData)

    const { data: settings } = await supabase.from('quiz_settings').select('*').eq('room_target', selectedRoom).maybeSingle()
    if (settings) {
      setIsQuizActive(settings.is_active)
    } else {
      setIsQuizActive(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    fetchData()
    const intervalId = setInterval(fetchData, 2000)
    return () => clearInterval(intervalId)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    loadRoomData()
    const roomInterval = setInterval(loadRoomData, 3000)
    return () => clearInterval(roomInterval)
  }, [isAuthenticated, selectedRoom])

  const showModal = (type, title, message, action = null) => {
    setModalConfirm({ show: true, type, title, message, action })
  }

  const closeModal = () => {
    setModalConfirm({ show: false, type: '', title: '', message: '', action: null })
  }

  const handleStartQuiz = async () => {
    await supabase.from('live_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const { error } = await supabase.from('quiz_settings').update({ is_active: true }).eq('room_target', selectedRoom)
    
    if (error) {
      showModal('error', 'Gagal Membuka Kuis', error.message)
    } else { 
      setIsQuizActive(true)
      showModal('success', 'Kuis Dibuka!', `Room ${selectedRoom} kini Aktif. Peserta dapat langsung mulai kuis.`)
      loadRoomData() 
    }
  }

  const handleStopQuiz = async () => {
    showModal('confirm', 'Tutup Kuis?', `Tutup akses kuis untuk room ${selectedRoom}?`, async () => {
      await supabase.from('quiz_settings').update({ is_active: false }).eq('room_target', selectedRoom)
      setIsQuizActive(false)
      loadRoomData()
      closeModal()
    })
  }

  const openConfirm = (type) => {
    if (type === 'live') {
      showModal('confirm', 'Reset Live Monitor?', 'Hapus semua data skor sementara saat ini?', async () => {
        await supabase.from('live_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        setLiveData([]); setFinishedData([])
        closeModal()
      })
    } else if (type === 'lb') {
      showModal('confirm', 'Reset Leaderboard?', 'Peringatan! Semua riwayat skor & hasil kuis akan dihapus permanen.', async () => {
        const { error } = await supabase.from('results').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (!error) setFinishedData([])
        closeModal()
      })
    }
  }

  const handleResetCode = (code, username) => {
    showModal('confirm', 'Reset Kode Akses?', `Izinkan "${username}" main lagi?`, async () => {
      await supabase.from('access_codes').update({ used: false }).eq('code', code);
      loadRoomData();
      closeModal()
    })
  }

  const handleResetAllParticipants = () => {
    showModal('confirm', 'HATI-HATI!', 'Hapus SEMUA data peserta?', async () => {
      await supabase.from('access_codes').delete().neq('used_by', '---TIDAK-MUNGKIN-ADA---');
      setRegisteredList([]); setShowAllData(false);
      closeModal()
    })
  }

  const handleDownloadBackup = () => {
    if (registeredList.length === 0) return showModal('error', 'Tidak Ada Data', 'Belum ada data peserta untuk di-backup.');
    const headers = ["Discord", "Negara", "Wallet", "Kode", "Status"];
    const rows = registeredList.map(r => [`"${r.used_by}"`, `"${r.negara || '-'}"`, `"${r.wallet_address}"`, `"${r.code}"`, `"${r.used ? 'Sudah' : 'Belum'}"`]);
    const blob = new Blob([[headers.join(","), ...rows.map(e => e.join(","))].join("\n")], { type: 'text/csv' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `Backup_${Date.now()}.csv`;
    link.click();
  }

  if (isCheckingAuth) {
    return (
      <div style={{ background: '#060913', minHeight: '100vh', color: '#a1a1aa', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Montserrat, sans-serif' }}>
        Memuat...
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="login-page-wrapper" style={{ background: '#09090b', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ background: '#121622', padding: '3rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
          <h2 style={{ color: '#ff7a00', marginBottom: '2rem', fontSize: '1.4rem', letterSpacing: '0.5px' }}>Akses Admin</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="password" placeholder="Password..." value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '0.9rem 1rem', borderRadius: '10px', background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
            <button type="submit" style={{ padding: '0.9rem', background: '#ff7a00', color: '#09090b', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', transition: 'opacity 0.2s' }}>Masuk</button>
            {error && <div style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</div>}
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', padding: '3rem 2rem', color: '#f4f4f5', fontFamily: 'Montserrat, sans-serif' }}>
      
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .admin-card { background: #121622; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); padding: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .btn-action-base { padding: 0.75rem 1rem; border-radius: 10px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: none; }
        .btn-start { background: rgba(34, 197, 94, 0.12); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
        .btn-start:hover { background: rgba(34, 197, 94, 0.22); border-color: rgba(34, 197, 94, 0.5); }
        .btn-stop { background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
        .btn-stop:hover { background: rgba(239, 68, 68, 0.22); border-color: rgba(239, 68, 68, 0.5); }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '700', letterSpacing: '0.5px' }}>Dashboard Admin</h1>
            <p style={{ color: '#94a3b8', margin: '0.3rem 0 0 0', fontSize: '0.85rem' }}>Retium Quiz Control Center</p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              onClick={() => navigate('/manage-questions')} 
              style={{ padding: '0.6rem 1.1rem', borderRadius: '10px', background: '#ff7a00', border: 'none', color: '#09090b', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Kelola Soal
            </button>
            <button 
              onClick={() => openConfirm('live')} 
              style={{ padding: '0.6rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#cbd5e1', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Reset Live
            </button>
            <button 
              onClick={handleAdminLogout} 
              style={{ padding: '0.6rem 1.1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600' }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* KONTROL UTAMA */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          {/* KONTROL STATUS KUIS */}
          <div className="admin-card">
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#e2e8f0', fontWeight: '600' }}>Kontrol Status Kuis</h3>
            <select 
              value={selectedRoom} 
              onChange={(e) => setSelectedRoom(e.target.value)} 
              style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', background: '#0a0e1a', color: 'white', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem', outline: 'none', fontSize: '0.9rem' }}
            >
              {rooms.map(r => <option key={r.kode_negara} value={r.kode_negara}>{r.is_global ? 'Global' : `${r.nama_negara}`}</option>)}
            </select>
            
            <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.2rem' }}>
              <button onClick={handleStartQuiz} className="btn-action-base btn-start" style={{ flex: 1 }}>
                <span>▶</span> Mulai Kuis
              </button>
              <button onClick={handleStopQuiz} className="btn-action-base btn-stop" style={{ flex: 1 }}>
                <span>⏹</span> Tutup Kuis
              </button>
            </div>

            <div style={{ padding: '1rem', background: '#0a0e1a', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.7rem', color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase' }}>STATUS ROOM {selectedRoom}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isQuizActive ? '#4ade80' : '#f87171', boxShadow: `0 0 10px ${isQuizActive ? '#4ade80' : '#f87171'}` }}></span>
                <span style={{ fontSize: '0.95rem', fontWeight: '700', color: isQuizActive ? '#4ade80' : '#f87171', letterSpacing: '0.5px' }}>
                  {isQuizActive ? 'KUIS DIBUKA (AKTIF)' : 'KUIS DITUTUP (CLOSED)'}
                </span>
              </div>
            </div>
          </div>

          {/* DATABASE PESERTA */}
          <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', color: '#e2e8f0', fontWeight: '600' }}>Database Peserta</h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Total {registeredList.length} peserta terdaftar.</p>
            </div>
            <button 
              onClick={() => setShowAllData(true)} 
              style={{ width: '100%', padding: '0.8rem', background: '#1e2433', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', borderRadius: '10px', marginTop: '1rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'background 0.2s' }}
            >
              Lihat & Copy Data
            </button>
          </div>
        </div>

        {/* MONITOR & LEADERBOARD */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          
          {/* LIVE MONITOR */}
          <div className="admin-card">
            <h3 style={{ margin: '0 0 1.2rem 0', fontSize: '1rem', color: '#e2e8f0', fontWeight: '600' }}>Live Monitor</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
              {liveData.length === 0 ? <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>Menunggu pemain aktif...</div> : liveData.map((r) => (
                <div key={r.id} style={{ display: 'flex', padding: '0.8rem 1rem', background: '#0a0e1a', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                  <div style={{ flex: 2, fontWeight: '600', fontSize: '0.9rem' }}>{r.username}</div>
                  <div style={{ flex: 1, textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Soal {r.soal_sekarang}/15</div>
                  <div style={{ flex: 1, textAlign: 'center', color: '#ff7a00', fontWeight: '700', fontSize: '0.9rem' }}>{r.skor} PTS</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* STATS KECIL */}
            <div className="admin-card">
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 0.2rem 0', textTransform: 'uppercase' }}>Top Score</p>
                  {finishedData.length > 0 ? (
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{finishedData[0].username}</div>
                      <div style={{ color: '#ff7a00', fontSize: '1.2rem', fontWeight: '700' }}>{finishedData[0].skor_total} PTS</div>
                    </div>
                  ) : <div style={{ color: '#64748b', fontSize: '0.9rem' }}>-</div>}
                </div>
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 0.2rem 0', textTransform: 'uppercase' }}>Fastest Time</p>
                  {finishedData.length > 0 ? (
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{finishedData[0].username}</div>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#e2e8f0' }}>{finishedData[0].waktu_selesai}</div>
                    </div>
                  ) : <div style={{ color: '#64748b', fontSize: '0.9rem' }}>-</div>}
                </div>
              </div>
            </div>

            {/* LEADERBOARD SELESAI */}
            <div className="admin-card" style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#e2e8f0', fontWeight: '600' }}>Leaderboard</h3>
                <button onClick={() => openConfirm('lb')} style={{ padding: '0.35rem 0.7rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>Reset LB</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                {finishedData.length === 0 ? <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>Belum ada data selesai</div> : finishedData.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem', background: '#0a0e1a', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '0.9rem' }}><span style={{ color: '#64748b', marginRight: '8px' }}>#{i + 1}</span> <strong>{r.username}</strong> <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({r.waktu_selesai})</span></div>
                    <div style={{ fontWeight: '700', color: '#ff7a00', fontSize: '0.9rem' }}>{r.skor_total}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* MODAL DATA PESERTA */}
        {showAllData && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '2rem' }}>
            <div style={{ background: '#121622', width: '100%', maxWidth: '1000px', maxHeight: '85vh', borderRadius: '20px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>Data Peserta Terdaftar</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleDownloadBackup} style={{ padding: '0.5rem 1rem', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>Backup CSV</button>
                    <button onClick={handleResetAllParticipants} style={{ padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>Reset Semua</button>
                    <button onClick={() => setShowAllData(false)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" placeholder="Cari peserta..." value={inputSearch} onChange={(e) => setInputSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setSearchQuery(inputSearch); }} style={{ flex: 1, padding: '0.7rem 1rem', borderRadius: '10px', background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', fontSize: '0.9rem' }} />
                  <button onClick={() => setSearchQuery(inputSearch)} style={{ padding: '0 1.2rem', background: '#ff7a00', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', color: '#09090b', fontSize: '0.9rem' }}>Cari</button>
                </div>
              </div>
              <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', fontSize: '0.9rem' }}>
                  <thead style={{ background: '#121622', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid rgba(255,122,0,0.5)', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Discord</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid rgba(255,122,0,0.5)', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Wallet</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid rgba(255,122,0,0.5)', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Kode</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid rgba(255,122,0,0.5)', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registeredList.filter(r => r.used_by?.toLowerCase().includes(searchQuery.toLowerCase())).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px', fontWeight: '600' }}>{r.used_by}</td>
                        <td style={{ padding: '12px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.wallet_address}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}><span style={{ background: r.used ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: r.used ? '#f87171' : '#4ade80', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>{r.code}</span></td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button onClick={() => { navigator.clipboard.writeText(r.wallet_address); showModal('success', 'Berhasil!', 'Alamat wallet berhasil di-copy.'); }} style={{ marginRight: '6px', padding: '5px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Copy</button>
                          {r.used && <button onClick={() => handleResetCode(r.code, r.used_by)} style={{ padding: '5px 10px', background: 'transparent', border: '1px solid #ff7a00', color: '#ff7a00', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>Reset</button>}
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

      {/* MODAL KONFIRMASI */}
      {modalConfirm.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#121622', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', padding: '2rem', borderRadius: '20px', maxWidth: '380px', width: '100%', textAlign: 'center', animation: 'modalFadeIn 0.25s ease-out' }}>
            <h2 style={{ color: modalConfirm.type === 'error' || modalConfirm.type === 'confirm' ? '#f87171' : '#4ade80', margin: '0 0 0.8rem 0', fontSize: '1.1rem', fontWeight: '700' }}>{modalConfirm.title}</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.8rem' }}>{modalConfirm.message}</p>
            
            {modalConfirm.type === 'confirm' ? (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={closeModal} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}>Batal</button>
                <button onClick={modalConfirm.action} style={{ flex: 1, padding: '0.8rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}>Ya, Lanjutkan</button>
              </div>
            ) : (
              <button onClick={closeModal} style={{ width: '100%', padding: '0.8rem', background: '#ff7a00', border: 'none', color: '#09090b', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>MENGERTI</button>
            )}
          </div>
        </div>
      )}
