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
  
  const [globalRoom, setGlobalRoom] = useState({ active: false, time: '00:00:00' })
  const [regionalRoom, setRegionalRoom] = useState({ active: false, time: '00:00:00' })
  const [namaNegara, setNamaNegara] = useState('Regional')

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
      const { data: globalData } = await supabase
        .from('quiz_settings')
        .select('*')
        .eq('room_target', 'GLB')
        .maybeSingle()

      if (globalData) {
        const now = new Date().getTime()
        const start = new Date(globalData.start_time).getTime()
        const distance = start - now

        if (globalData.is_active && distance > 0) {
          const h = Math.floor((distance % 86400000) / 3600000).toString().padStart(2, '0')
          const m = Math.floor((distance % 3600000) / 60000).toString().padStart(2, '0')
          const s = Math.floor((distance % 60000) / 1000).toString().padStart(2, '0')
          setGlobalRoom({ active: true, time: `${h}:${m}:${s}` })
        } else if (globalData.is_active && distance <= 0) {
          setGlobalRoom({ active: true, time: 'MULAI' })
        } else {
          setGlobalRoom({ active: false, time: 'CLOSED' })
        }
      }

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

          if (regData.is_active && distance > 0) {
            const h = Math.floor((distance % 86400000) / 3600000).toString().padStart(2, '0')
            const m = Math.floor((distance % 3600000) / 60000).toString().padStart(2, '0')
            const s = Math.floor((distance % 60000) / 1000).toString().padStart(2, '0')
            setRegionalRoom({ active: true, time: `${h}:${m}:${s}` })
          } else if (regData.is_active && distance <= 0) {
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

  return (
    <div className="login-page-wrapper">
      <ParticleBackground />
      
      <div style={{ maxWidth: '1000px', width: '100%', zIndex: 10, padding: '1rem' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: 'rgba(18, 26, 46, 0.6)', padding: '1.5rem 2rem', borderRadius: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <h1 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>Halo, {username}!</h1>
            <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>Pilih room kuis di bawah ini</p>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Logout
          </button>
        </div>

        {/* KONTEN DASHBOARD: 2 KARTU ROOM */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          {/* KARTU ROOM GLOBAL */}
          <div style={{ background: 'rgba(18, 26, 46, 0.6)', padding: '2rem', borderRadius: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <h3 style={{ color: '#a1a1aa', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Room Global</h3>
            <h2 style={{ color: !globalRoom.active ? '#ef4444' : (globalRoom.time === 'MULAI' ? '#22c55e' : '#ff7a00'), margin: '0 0 1.5rem 0', fontSize: '2.5rem', fontWeight: '800' }}>
              {globalRoom.time}
            </h2>
            <button 
              disabled={globalRoom.time !== 'MULAI'}
              onClick={() => {
                localStorage.setItem('kuis_room', 'GLB');
                navigate('/kuis');
              }}
              style={{ width: '100%', padding: '1rem', background: globalRoom.time === 'MULAI' ? 'var(--orange)' : 'rgba(255,255,255,0.05)', color: globalRoom.time === 'MULAI' ? '#0a0e1a' : '#52525b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: globalRoom.time === 'MULAI' ? 'pointer' : 'not-allowed' }}
            >
              {globalRoom.time === 'MULAI' ? 'MASUK ROOM GLOBAL' : 'BELUM DIMULAI'}
            </button>
          </div>

          {/* KARTU ROOM REGIONAL */}
          <div style={{ background: 'rgba(18, 26, 46, 0.6)', padding: '2rem', borderRadius: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <h3 style={{ color: '#a1a1aa', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Room {namaNegara}</h3>
            <h2 style={{ color: !regionalRoom.active ? '#ef4444' : (regionalRoom.time === 'MULAI' ? '#22c55e' : '#ff7a00'), margin: '0 0 1.5rem 0', fontSize: '2.5rem', fontWeight: '800' }}>
              {regionalRoom.time}
            </h2>
            <button 
              disabled={regionalRoom.time !== 'MULAI'}
              onClick={() => {
                localStorage.setItem('kuis_room', userNegara);
                navigate('/kuis');
              }}
              style={{ width: '100%', padding: '1rem', background: regionalRoom.time === 'MULAI' ? 'var(--orange)' : 'rgba(255,255,255,0.05)', color: regionalRoom.time === 'MULAI' ? '#0a0e1a' : '#52525b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: regionalRoom.time === 'MULAI' ? 'pointer' : 'not-allowed' }}
            >
              {regionalRoom.time === 'MULAI' ? `MASUK ROOM ${namaNegara}` : 'BELUM DIMULAI'}
            </button>
          </div>

        </div>

        {/* KARTU PROFIL (Di Bawah) */}
        <div style={{ background: 'rgba(18, 26, 46, 0.6)', padding: '2rem', borderRadius: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.2rem' }}>Profil Anda</h3>
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ color: '#a1a1aa', fontSize: '0.8rem', margin: '0 0 0.2rem 0' }}>Wallet Address</p>
            <p style={{ color: 'white', fontFamily: 'monospace', fontSize: '0.9rem', margin: 0, wordBreak: 'break-all' }}>{wallet}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => navigate('/riwayat')} 
              style={{ flex: 1, padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Riwayat Bermain
            </button>
            <button 
              onClick={() => navigate('/edit-profil')} 
              style={{ flex: 1, padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Edit Profil
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
