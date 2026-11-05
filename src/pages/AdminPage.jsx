import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import '../styles/kuis.css'

export default function AdminPage() {
  const navigate = useNavigate()

  // Default state dimulai dari false agar aman dan wajib verifikasi
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  
  const [liveData, setLiveData] = useState([])
  const [finishedData, setFinishedData] = useState([])
  const [startTimeInput, setStartTimeInput] = useState('')
  const [isQuizActive, setIsQuizActive] = useState(false)
  const [timeToStart, setTimeToStart] = useState('00:00:00')
  const [registeredList, setRegisteredList] = useState([])
  const [showAllData, setShowAllData] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [inputSearch, setInputSearch] = useState('')
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState('GLB')

  // STATE UNTUK CUSTOM MODAL (Alert & Konfirmasi)
  const [modalConfirm, setModalConfirm] = useState({ show: false, type: '', title: '', message: '', action: null })

  // Cek sesi login saat halaman pertama kali dimuat
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
      if (settings.start_time) {
        setStartTimeInput(settings.start_time.slice(0, 16)) 
      }
    } else {
      setIsQuizActive(false)
      setStartTimeInput('')
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
  }, [isAuthenticated, selectedRoom])

  useEffect(() => {
    if (!isAuthenticated) return 
    
    const interval = setInterval(async () => {
      const { data: settings } = await supabase.from('quiz_settings').select('start_time, is_active').eq('room_target', selectedRoom).maybeSingle()
      
      if (settings && settings.is_active) {
        const now = new Date().getTime()
        const start = new Date(settings.start_time).getTime()
        const distance = start - now

        const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true })
        const totalSoal = count || 5
        const durasiKuisMs = (totalSoal * 20) * 1000 
        const timeElapsed = now - start

        if (distance > 0) {
          const h = Math.floor((distance % 86400000) / 3600000).toString().padStart(2, '0')
          const m = Math.floor((distance % 3600000) / 60000).toString().padStart(2, '0')
          const s = Math.floor((distance % 60000) / 1000).toString().padStart(2, '0')
          setTimeToStart(`${h}:${m}:${s}`)
        } else if (timeElapsed >= durasiKuisMs) {
          setTimeToStart('CLOSED')
          setIsQuizActive(false)
          await supabase.from('quiz_settings').update({ is_active: false }).eq('room_target', selectedRoom)
        } else {
          setTimeToStart('KUIS DIMULAI')
        }
      } else {
        setTimeToStart('DITUTUP')
        setIsQuizActive(false)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated, selectedRoom])

  // --- FUNGSI MODAL HELPER ---
  const showModal = (type, title, message, action = null) => {
    setModalConfirm({ show: true, type, title, message, action })
  }

  const closeModal = () => {
    setModalConfirm({ show: false, type: '', title: '', message: '', action: null })
  }

  // --- FUNGSI SET JADWAL ---
  const handleSetSchedule = async () => {
    if (!startTimeInput) return showModal('error', 'Peringatan', 'Pilih waktu terlebih dahulu!')
    
    // Hapus live scores lama
    await supabase.from('live_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Set jadwal baru
    const { error } = await supabase.from('quiz_settings').update({ start_time: startTimeInput, is_active: true }).eq('room_target', selectedRoom)
    
    if (error) {
      showModal('error', 'Gagal Mengatur', error.message)
    } else { 
      showModal('success', 'Berhasil!', `Jadwal ${selectedRoom} diatur. Papan skor live sudah di-reset.`)
      loadRoomData() 
    }
  }

  const handleStopQuiz = () => {
    showModal('confirm', 'Tutup Pendaftaran?', `Tutup pendaftaran untuk room ${selectedRoom}?`, async () => {
      await supabase.from('quiz_settings').update({ is_active: false }).eq('room_target', selectedRoom)
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

  // Tampilkan loading saat memeriksa status autentikasi awal
  if (isCheckingAuth) {
    return (
      <div style={{ background: '#060913', minHeight: '100vh', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Montserrat, sans-serif' }}>
        Memuat...
      </div>
    )
  }

  // GUARD CLAUSE: Jika belum login, paksa berhenti dan tampilkan form password
  if (!isAuthenticated) {
    return (
      <div className="login-page-wrapper" style={{ background: '#060913', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ background: 'rgba(18, 26, 46, 0.7)', backdropFilter: 'blur(20px)', padding: '3rem', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.05)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <h2 style={{ color: '#ff7a00', marginBottom: '2rem' }}>Akses Admin</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="password" placeholder="Password..." value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(10, 14, 26, 0.8)', border: '1px solid #333', color: 'white' }} />
            <button type="submit" style={{ padding: '1rem', background: '#ff7a00', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Masuk</button>
            {error && <div style={{ color: '#ef4444' }}>{error}</div>}
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', padding: '3rem 2rem', color: '#f4f4f5', fontFamily: 'Montserrat, sans-serif' }}>
      
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem', borderBottom: '1px solid #27272a', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Dashboard Admin</h1>
            <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>Retium Quiz Control Center</p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              onClick={() => navigate('/manage-questions')} 
              style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', background: 'var(--orange)', border: 'none', color: '#09090b', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Kelola Soal
            </button>
            <button 
              onClick={() => openConfirm('live')} 
              style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #27272a', background: 'transparent', color: '#a1a1aa', cursor: 'pointer' }}
            >
              Reset Live
            </button>
            <button 
              onClick={handleAdminLogout} 
              style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Logout
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#18181b', padding: '1.5rem', borderRadius: '16px', border: '1px solid #27272a' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Kontrol Jadwal</h3>
            <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333', marginBottom: '1rem' }}>
              {rooms.map(r => <option key={r.kode_negara} value={r.kode_negara}>{r.is_global ? 'Global' : `${r.nama_negara}`}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input type="datetime-local" value={startTimeInput} onChange={(e) => setStartTimeInput(e.target.value)} style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333' }} />
              <button onClick={handleSetSchedule} style={{ padding: '0.8rem', background: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Set</button>
              <button onClick={handleStopQuiz} style={{ padding: '0.8rem', background: 'transparent', border: '1px solid #333', color: 'white', borderRadius: '8px', cursor: 'pointer' }}>Stop</button>
            </div>
            <div style={{ padding: '1rem', background: '#09090b', borderRadius: '8px', textAlign: 'center', border: '1px solid #27272a' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#a1a1aa' }}>STATUS {selectedRoom}</p>
              <h2 style={{ margin: 0, color: !isQuizActive ? '#a1a1aa' : 'white' }}>{!isQuizActive ? 'CLOSED' : timeToStart}</h2>
            </div>
          </div>

          <div style={{ background: '#18181b', padding: '1.5rem', borderRadius: '16px', border: '1px solid #27272a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Database Peserta</h3>
              <p style={{ margin: 0, color: '#a1a1aa' }}>Total {registeredList.length} terdaftar.</p>
            </div>
            <button onClick={() => setShowAllData(true)} style={{ width: '100%', padding: '0.8rem', background: '#27272a', border: '1px solid #3f3f46', color: 'white', borderRadius: '8px', marginTop: '1rem', cursor: 'pointer' }}>Lihat & Copy Data</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          <div style={{ background: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0' }}>Live Monitor</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {liveData.length === 0 ? <div style={{ color: '#52525b' }}>Menunggu pemain...</div> : liveData.map((r) => (
                <div key={r.id} style={{ display: 'flex', padding: '1rem', background: '#09090b', borderRadius: '8px', border: '1px solid #27272a' }}>
                  <div style={{ flex: 2, fontWeight: 'bold' }}>{r.username}</div>
                  <div style={{ flex: 1, textAlign: 'center', color: '#a1a1aa' }}>{r.soal_sekarang}/15</div>
                  <div style={{ flex: 1, textAlign: 'center', color: 'white', fontWeight: 'bold' }}>{r.skor}</div>
                  <div style={{ flex: 1, textAlign: 'right', fontSize: '0.8rem', color: '#a1a1aa' }}>{r.benar} / {r.salah} / {r.pass}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#a1a1aa', fontSize: '0.75rem' }}>Top Score</p>
                  {finishedData.length > 0 ? <><div style={{ fontWeight: 'bold' }}>{finishedData[0].username}</div><div style={{ color: '#ff7a00', fontSize: '1.5rem' }}>{finishedData[0].skor_total} PTS</div></> : '-'}
                </div>
                <div style={{ width: '1px', background: '#27272a' }}></div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#a1a1aa', fontSize: '0.75rem' }}>Fastest Time</p>
                  {finishedData.length > 0 ? <><div style={{ fontWeight: 'bold' }}>{finishedData[0].username}</div><div style={{ fontWeight: 'bold' }}>{finishedData[0].waktu_selesai}</div></> : '-'}
                </div>
              </div>
            </div>
            <div style={{ background: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '1.5rem', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Leaderboard</h3>
                <button onClick={() => openConfirm('lb')} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>Reset LB</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                {finishedData.length === 0 ? '-' : finishedData.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem', background: '#09090b', borderRadius: '8px', border: '1px solid #27272a' }}>
                    <div>{i + 1}. {r.username} <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>({r.waktu_selesai})</span></div>
                    <div style={{ fontWeight: 'bold' }}>{r.skor_total}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {showAllData && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '2rem' }}>
            <div style={{ background: '#0a0e1a', width: '100%', maxWidth: '1000px', maxHeight: '85vh', borderRadius: '24px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,122,0,0.3)' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0, color: 'white' }}>Data Peserta</h2>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleDownloadBackup} style={{ padding: '0 1rem', background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', color: '#22c55e', borderRadius: '8px', cursor: 'pointer' }}>Backup</button>
                    <button onClick={handleResetAllParticipants} style={{ padding: '0 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', cursor: 'pointer' }}>Reset</button>
                    <button onClick={() => setShowAllData(false)} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'transparent', border: '1px solid white', color: 'white', cursor: 'pointer' }}>X</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" placeholder="Cari..." value={inputSearch} onChange={(e) => setInputSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setSearchQuery(inputSearch); }} style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', background: '#09090b', border: '1px solid #333', color: 'white' }} />
                  <button onClick={() => setSearchQuery(inputSearch)} style={{ padding: '0 1.5rem', background: '#ff7a00', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cari</button>
                </div>
              </div>
              <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', fontSize: '0.9rem' }}>
                  <thead style={{ background: '#0a0e1a', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ff7a00' }}>Discord</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ff7a00' }}>Wallet</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ff7a00' }}>Kode</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ff7a00' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registeredList.filter(r => r.used_by?.toLowerCase().includes(searchQuery.toLowerCase())).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.used_by}</td>
                        <td style={{ padding: '12px', color: '#a1a1aa', fontFamily: 'monospace' }}>{r.wallet_address}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}><span style={{ background: r.used ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: r.used ? '#ef4444' : '#22c55e', padding: '4px 8px', borderRadius: '4px' }}>{r.code}</span></td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button onClick={() => { navigator.clipboard.writeText(r.wallet_address); showModal('success', 'Berhasil!', 'Alamat wallet berhasil di-copy.'); }} style={{ marginRight: '5px', padding: '4px 10px', background: 'transparent', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Copy</button>
                          {r.used && <button onClick={() => handleResetCode(r.code, r.used_by)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ff7a00', color: '#ff7a00', borderRadius: '4px', cursor: 'pointer' }}>Reset</button>}
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

      {/* CUSTOM MODAL GLOBAL */}
      {modalConfirm.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'rgba(18, 26, 46, 0.95)', border: `1px solid ${modalConfirm.type === 'error' || modalConfirm.type === 'confirm' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'}`, boxShadow: `0 0 30px ${modalConfirm.type === 'error' || modalConfirm.type === 'confirm' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`, padding: '2rem', borderRadius: '24px', maxWidth: '400px', width: '100%', textAlign: 'center', animation: 'modalFadeIn 0.3s ease-out' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{modalConfirm.type === 'error' ? '🚫' : modalConfirm.type === 'confirm' ? '⚠️' : '✅'}</div>
            <h2 style={{ color: modalConfirm.type === 'error' || modalConfirm.type === 'confirm' ? '#ef4444' : '#22c55e', margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>{modalConfirm.title}</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '2rem' }}>{modalConfirm.message}</p>
            
            {modalConfirm.type === 'confirm' ? (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={closeModal} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid #52525b', color: '#a1a1aa', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
                <button onClick={modalConfirm.action} style={{ flex: 1, padding: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Ya, Lanjutkan</button>
              </div>
            ) : (
              <button onClick={closeModal} style={{ width: '100%', padding: '0.8rem', background: modalConfirm.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', border: `1px solid ${modalConfirm.type === 'error' ? '#ef4444' : '#22c55e'}`, color: modalConfirm.type === 'error' ? '#ef4444' : '#22c55e', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>MENGERTI</button>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
