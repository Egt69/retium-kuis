import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ParticleBackground from '../components/ParticleBackground'
import '../styles/kuis.css'

export default function DashboardPage() {
  const navigate = useNavigate()
  const username = localStorage.getItem('kuis_username')
  const wallet = localStorage.getItem('kuis_wallet')
  const userNegara = localStorage.getItem('kuis_negara')
  
  const [globalRoom, setGlobalRoom] = useState({ active: false, time: 'CLOSED' })
  const [regionalRoom, setRegionalRoom] = useState({ active: false, time: 'CLOSED' })
  const [namaNegara, setNamaNegara] = useState('Regional')
  
  const [hoverGlobal, setHoverGlobal] = useState(false)
  const [hoverRegional, setHoverRegional] = useState(false)

  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!username) {
      navigate('/')
      return
    }

    const fetchNegara = async () => {
      const { data } = await supabase.from('rooms').select('nama_negara').eq('kode_negara', userNegara).single()
      if (data) setNamaNegara(data.nama_negara)
    }
    if (userNegara) fetchNegara()

    const checkSchedule = async () => {
      // 1. Ambil total soal untuk hitung durasi (Total Soal x 20 Detik)
      const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true })
      const totalSoal = count || 5
      const durasiKuisMs = (totalSoal * 20) * 1000

      // 2. Cek Room Global
      const { data: globalData } = await supabase
        .from('quiz_settings')
        .select('*')
        .eq('room_target', 'GLB')
        .maybeSingle()

      if (globalData) {
        const now = new Date().getTime()
        const start = new Date(globalData.start_time).getTime()
        const distance = start - now
        const timeElapsed = now - start

        if (globalData.is_active && distance > 0) {
          // Belum mulai
          const h = Math.floor((distance % 86400000) / 3600000).toString().padStart(2, '0')
          const m = Math.floor((distance % 3600000) / 60000).toString().padStart(2, '0')
          const s = Math.floor((distance % 60000) / 1000).toString().padStart(2, '0')
          setGlobalRoom({ active: true, time: `${h}:${m}:${s}` })
        } else if (globalData.is_active && distance <= 0 && timeElapsed < durasiKuisMs) {
          // Sedang berlangsung
          setGlobalRoom({ active: true, time: 'MULAI' })
        } else {
          // Sudah lewat durasi / CLOSED
          setGlobalRoom({ active: false, time: 'CLOSED' })
        }
      }

      // 3. Cek Room Regional
      if (userNegara) {
        const { data: regData } = await supabase
          .from('quiz_settings')
          .select('*')
          .eq('room_target', userNegara)
          .maybeSingle()

        if (regData) {
          const now = new Date().getTime()
          const start = new Date(regData.start_time).getTime()
          const distance = start - now
          const timeElapsed = now - start

          if (regData.is_active && distance > 0) {
            const h = Math.floor((distance % 86400000) / 3600000).toString().padStart(2, '0')
            const m = Math.floor((distance % 3600000) / 60000).toString().padStart(2, '0')
            const s = Math.floor((distance % 60000) / 1000).toString().padStart(2, '0')
            setRegionalRoom({ active: true, time: `${h}:${m}:${s}` })
          } else if (regData.is_active && distance <= 0 && timeElapsed < durasiKuisMs) {
            setRegionalRoom({ active: true, time: 'MULAI' })
          } else {
            setRegionalRoom({ active: false, time: 'CLOSED' })
          }
        }
      }
    }

    checkSchedule()
    const interval = setInterval(checkSchedule, 1000)
    return () => clearInterval(interval)
  }, [navigate, username, userNegara])

  const handleLogout = () => {
    localStorage.clear()
    navigate('/')
  }

  // FUNGSI MASUK ROOM (SIMPEL: CEK ROOM NYALA ATAU MATI)
  const handleMasukRoom = async (roomTarget) => {
    const { data, error } = await supabase
      .from('quiz_settings')
      .select('is_active')
      .eq('room_target', roomTarget)
      .single()

    if (error || !data) {
      setErrorMsg("Gagal memuat data room.")
      return
    }

    if (!data.is_active) {
      setErrorMsg("Room kuis ini sudah ditutup. Silakan tunggu Admin membuat jadwal baru.")
      return
    }

    localStorage.setItem('kuis_room', roomTarget)
    navigate('/kuis')
  }

  const renderStatusBadge = (room) => {
    if (room.time === 'MULAI') {
      return <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px', border: '1px solid rgba(34,197,94,0.3)' }}>LIVE</span>
    }
    if (room.active) {
      return <span style={{ background: 'rgba(255, 122, 0, 0.15)', color: '#ff7a00', padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px', border: '1px solid rgba(255,122,0,0.3)' }}>UPCOMING</span>
    }
    return <span style={{ background: 'rgba(161, 161, 170, 0.1)', color: '#a1a1aa', padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px', border: '1px solid rgba(161,161,170,0.2)' }}>CLOSED</span>
  }

  return (
    <>
      <style>{`
        @property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        @keyframes spin { to { --angle: 360deg; } }
        .header-border-spin { position: relative; background: rgba(18, 26, 46, 0.6); backdrop-filter: blur(20px); z-index: 1; }
        .header-border-spin::before { content: ''; position: absolute; inset: -1px; border-radius: 25px; background: conic-gradient(from var(--angle), transparent 70%, #ff7a00, #ff7a00); animation: spin 3s linear infinite; z-index: -2; }
        .header-border-spin::after { content: ''; position: absolute; inset: 1px; border-radius: 24px; background: #0a0e1a; z-index: -1; }
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div className="login-page-wrapper">
        <ParticleBackground />
        
        <div style={{ maxWidth: '1000px', width: '100%', zIndex: 10, padding: '1rem' }}>
          
          <div className="header-border-spin" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1.5rem 2rem', borderRadius: '24px' }}>
            <div>
              <h1 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>Halo, {username}!</h1>
              <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>Pilih room kuis di bawah ini</p>
            </div>
            <button onClick={handleLogout} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', zIndex: 10 }}>
              Logout
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            
            {/* KARTU ROOM GLOBAL */}
            <div onMouseEnter={() => setHoverGlobal(true)} onMouseLeave={() => setHoverGlobal(false)} style={{ background: 'rgba(18, 26, 46, 0.6)', padding: '2rem', borderRadius: '24px', backdropFilter: 'blur(20px)', border: hoverGlobal ? '1px solid rgba(255, 122, 0, 0.4)' : '1px solid rgba(255,255,255,0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.3s ease', boxShadow: hoverGlobal ? '0 0 20px rgba(255, 122, 0, 0.1)' : 'none', transform: hoverGlobal ? 'translateY(-2px)' : 'translateY(0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ color: 'white', margin: 0, fontSize: '1rem', letterSpacing: '1px', textAlign: 'left' }}>Room Global</h3>
                {renderStatusBadge(globalRoom)}
              </div>
              <div style={{ marginBottom: '2rem' }}>
                {globalRoom.time === 'MULAI' ? ( <h2 style={{ color: '#22c55e', margin: 0, fontSize: '2.5rem', fontWeight: '800' }}>MULAI!</h2> ) : globalRoom.active ? ( <h2 style={{ color: '#ff7a00', margin: 0, fontSize: '2.5rem', fontWeight: '800', fontFamily: 'monospace' }}>{globalRoom.time}</h2> ) : ( <h2 style={{ color: '#3f3f46', margin: 0, fontSize: '2.5rem', fontWeight: '800' }}>--:--:--</h2> )}
              </div>
              <button disabled={globalRoom.time !== 'MULAI'} onClick={() => handleMasukRoom('GLB')} style={{ width: '100%', padding: '1rem', background: globalRoom.time === 'MULAI' ? 'var(--orange)' : 'rgba(255,255,255,0.03)', color: globalRoom.time === 'MULAI' ? '#0a0e1a' : '#52525b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', fontWeight: 'bold', cursor: globalRoom.time === 'MULAI' ? 'pointer' : 'not-allowed', transition: 'all 0.2s ease' }}>
                {globalRoom.time === 'MULAI' ? 'MASUK ROOM GLOBAL' : 'BELUM DIMULAI'}
              </button>
            </div>

            {/* KARTU ROOM REGIONAL */}
            <div onMouseEnter={() => setHoverRegional(true)} onMouseLeave={() => setHoverRegional(false)} style={{ background: 'rgba(18, 26, 46, 0.6)', padding: '2rem', borderRadius: '24px', backdropFilter: 'blur(20px)', border: hoverRegional ? '1px solid rgba(255, 122, 0, 0.4)' : '1px solid rgba(255,255,255,0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.3s ease', boxShadow: hoverRegional ? '0 0 20px rgba(255, 122, 0, 0.1)' : 'none', transform: hoverRegional ? 'translateY(-2px)' : 'translateY(0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ color: 'white', margin: 0, fontSize: '1rem', letterSpacing: '1px', textAlign: 'left' }}>Room {namaNegara}</h3>
                {renderStatusBadge(regionalRoom)}
              </div>
              <div style={{ marginBottom: '2rem' }}>
                {regionalRoom.time === 'MULAI' ? ( <h2 style={{ color: '#22c55e', margin: 0, fontSize: '2.5rem', fontWeight: '800' }}>MULAI!</h2> ) : regionalRoom.active ? ( <h2 style={{ color: '#ff7a00', margin: 0, fontSize: '2.5rem', fontWeight: '800', fontFamily: 'monospace' }}>{regionalRoom.time}</h2> ) : ( <h2 style={{ color: '#3f3f46', margin: 0, fontSize: '2.5rem', fontWeight: '800' }}>--:--:--</h2> )}
              </div>
              <button disabled={regionalRoom.time !== 'MULAI'} onClick={() => handleMasukRoom(userNegara)} style={{ width: '100%', padding: '1rem', background: regionalRoom.time === 'MULAI' ? 'var(--orange)' : 'rgba(255,255,255,0.03)', color: regionalRoom.time === 'MULAI' ? '#0a0e1a' : '#52525b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', fontWeight: 'bold', cursor: regionalRoom.time === 'MULAI' ? 'pointer' : 'not-allowed', transition: 'all 0.2s ease' }}>
                {regionalRoom.time === 'MULAI' ? `MASUK ROOM ${namaNegara}` : 'BELUM DIMULAI'}
              </button>
            </div>

          </div>

          <div style={{ background: 'rgba(18, 26, 46, 0.6)', padding: '2rem', borderRadius: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.2rem' }}>Profil Anda</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: '#a1a1aa', fontSize: '0.8rem', margin: '0 0 0.2rem 0' }}>Wallet Address</p>
              <p style={{ color: 'white', fontFamily: 'monospace', fontSize: '0.9rem', margin: 0, wordBreak: 'break-all' }}>{wallet}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/riwayat')} style={{ flex: 1, padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                Riwayat Bermain
              </button>
              <button onClick={() => navigate('/edit-profil')} style={{ flex: 1, padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                Edit Profil
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* CUSTOM MODAL ERROR */}
      {errorMsg && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'rgba(18, 26, 46, 0.95)', border: '1px solid rgba(239, 68, 68, 0.5)', boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)', padding: '2rem', borderRadius: '24px', maxWidth: '400px', width: '100%', textAlign: 'center', animation: 'modalFadeIn 0.3s ease-out' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
            <h2 style={{ color: '#ef4444', margin: '0 0 1rem 0', fontSize: '1.2rem' }}>Akses Ditolak</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '2rem' }}>{errorMsg}</p>
            <button onClick={() => setErrorMsg('')} style={{ width: '100%', padding: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'} onMouseLeave={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}>
              MENGERTI
            </button>
          </div>
        </div>
      )}
    </>
  )
}
