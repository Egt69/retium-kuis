import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ParticleBackground from '../components/ParticleBackground'
import '../styles/kuis.css'

export default function HistoryPage() {
  const navigate = useNavigate()
  const username = localStorage.getItem('kuis_username')
  
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!username) {
      navigate('/')
      return
    }

    const fetchHistory = async () => {
      // Ambil data hasil kuis berdasarkan username
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .eq('username', username)
        .order('created_at', { ascending: false }) // Urutkan dari yang terbaru

      if (!error && data) {
        setHistory(data)
      }
      setIsLoading(false)
    }

    fetchHistory()
  }, [navigate, username])

  return (
    <div className="login-page-wrapper">
      <ParticleBackground />
      
      <div style={{ maxWidth: '800px', width: '100%', zIndex: 10, padding: '1rem' }}>
        
        {/* HEADER */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          marginBottom: '2rem', background: 'rgba(18, 26, 46, 0.6)', 
          padding: '1.5rem 2rem', borderRadius: '24px', backdropFilter: 'blur(20px)', 
          border: '1px solid rgba(255,255,255,0.05)' 
        }}>
          <div>
            <h1 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>Riwayat Bermain</h1>
            <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>
              Daftar kuis yang pernah kamu selesaikan
            </p>
          </div>
          <button 
            onClick={() => navigate('/dashboard')} 
            style={{ 
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
              color: 'white', padding: '0.6rem 1.2rem', borderRadius: '8px', 
              cursor: 'pointer', fontWeight: 'bold' 
            }}
          >
            Kembali
          </button>
        </div>

        {/* DAFTAR RIWAYAT */}
        <div style={{ 
          background: 'rgba(18, 26, 46, 0.6)', padding: '1.5rem', 
          borderRadius: '24px', backdropFilter: 'blur(20px)', 
          border: '1px solid rgba(255,255,255,0.05)' 
        }}>
          {isLoading ? (
            <p style={{ color: '#a1a1aa', textAlign: 'center' }}>Memuat riwayat...</p>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>Kamu belum pernah menyelesaikan kuis.</p>
              <button 
                onClick={() => navigate('/dashboard')}
                className="btn-premium"
                style={{ width: 'auto', padding: '0.8rem 2rem' }}
              >
                Mulai Kuis Sekarang
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {history.map((item) => (
                <div 
                  key={item.id} 
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '1rem', background: '#09090b', borderRadius: '12px', 
                    border: '1px solid #27272a', flexWrap: 'wrap', gap: '1rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>
                      {new Date(item.created_at).toLocaleDateString('id-ID', { 
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                      })}
                    </div>
                    <div style={{ color: 'white', fontWeight: 'bold', marginTop: '0.5rem' }}>
                      Skor: <span style={{ color: item.skor_total >= 0 ? '#22c55e' : '#ef4444' }}>{item.skor_total}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#22c55e', fontWeight: 'bold' }}>{item.jumlah_benar}</div>
                      <div style={{ color: '#a1a1aa', fontSize: '0.7rem' }}>Benar</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#ef4444', fontWeight: 'bold' }}>{item.jumlah_salah}</div>
                      <div style={{ color: '#a1a1aa', fontSize: '0.7rem' }}>Salah</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#8a93a8', fontWeight: 'bold' }}>{item.jumlah_pass}</div>
                      <div style={{ color: '#a1a1aa', fontSize: '0.7rem' }}>Pass</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#3b82f6', fontWeight: 'bold' }}>{item.waktu_selesai}</div>
                      <div style={{ color: '#a1a1aa', fontSize: '0.7rem' }}>Waktu</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
