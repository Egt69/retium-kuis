import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ParticleBackground from '../components/ParticleBackground'
import '../styles/kuis.css'

export default function DashboardPage() {
  const navigate = useNavigate()
  const username = localStorage.getItem('kuis_username')
  const wallet = localStorage.getItem('kuis_wallet')
  
  const [timeToStart, setTimeToStart] = useState('00:00:00')
  const [isQuizActive, setIsQuizActive] = useState(false)

  useEffect(() => {
    // Jika tidak ada username, tendang ke login
    if (!username) {
      navigate('/')
      return
    }

    // Fungsi ambil jadwal dan hitung mundur
    const checkSchedule = async () => {
      const { data } = await supabase.from('quiz_settings').select('*').eq('id', 1).single()
      
      if (data && data.is_active) {
        setIsQuizActive(true)
        const now = new Date().getTime()
        const start = new Date(data.start_time).getTime()
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
        setIsQuizActive(false)
        setTimeToStart('DITUTUP')
      }
    }

    checkSchedule()
    const interval = setInterval(checkSchedule, 1000)
    return () => clearInterval(interval)
  }, [navigate, username])

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
            <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>Selamat datang di Retium Quiz</p>
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Logout
          </button>
        </div>

        {/* KONTEN DASHBOARD */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          
          {/* KARTU JADWAL */}
          <div style={{ background: 'rgba(18, 26, 46, 0.6)', padding: '2rem', borderRadius: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <h3 style={{ color: '#a1a1aa', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Status Kuis</h3>
            <h2 style={{ color: !isQuizActive ? '#ef4444' : (timeToStart === 'KUIS DIMULAI' ? '#22c55e' : '#ff7a00'), margin: '0 0 1.5rem 0', fontSize: '2.5rem', fontWeight: '800' }}>
              {timeToStart}
            </h2>
            <button 
              disabled={timeToStart !== 'KUIS DIMULAI'}
              onClick={() => navigate('/kuis')}
              style={{ width: '100%', padding: '1rem', background: timeToStart === 'KUIS DIMULAI' ? 'var(--orange)' : 'rgba(255,255,255,0.05)', color: timeToStart === 'KUIS DIMULAI' ? '#0a0e1a' : '#52525b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: timeToStart === 'KUIS DIMULAI' ? 'pointer' : 'not-allowed', transition: 'all 0.3s' }}
            >
              {timeToStart === 'KUIS DIMULAI' ? 'MULAI KUIS SEKARANG' : 'BELUM DIMULAI'}
            </button>
          </div>

          {/* KARTU PROFIL & EDIT */}
          <div style={{ background: 'rgba(18, 26, 46, 0.6)', padding: '2rem', borderRadius: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.2rem' }}>Profil Anda</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: '#a1a1aa', fontSize: '0.8rem', margin: '0 0 0.2rem 0' }}>Wallet Address</p>
              <p style={{ color: 'white', fontFamily: 'monospace', fontSize: '0.9rem', margin: 0, wordBreak: 'break-all' }}>
                {wallet}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <button style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                Riwayat Bermain
              </button>
              <button style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                Edit Profil
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
