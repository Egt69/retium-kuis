import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ParticleBackground from '../components/ParticleBackground'
import '../styles/kuis.css'

export default function HasilPage() {
  const navigate = useNavigate()
  
  const skorAkhir = parseInt(localStorage.getItem('skor_akhir') || '0', 10)
  const jumlahBenar = parseInt(localStorage.getItem('hasil_benar') || '0', 10)
  const jumlahSalah = parseInt(localStorage.getItem('hasil_salah') || '0', 10)
  const jumlahPass = parseInt(localStorage.getItem('hasil_pass') || '0', 10)
  const waktuSelesai = localStorage.getItem('waktu_selesai') || '-'

  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    if (!localStorage.getItem('skor_akhir')) {
      navigate('/')
      return
    }

    async function fetchLeaderboard() {
      const { data, error } = await supabase
        .from('results')
        .select('username, skor_total, jumlah_benar, waktu_selesai')

      if (!error && data) {
        const parseWaktuKeDetik = (teksWaktu) => {
          if (!teksWaktu) return 999999
          const cocok = teksWaktu.match(/(\d+)\s*Menit\s*(\d+)\s*Detik/)
          if (cocok) {
            return parseInt(cocok[1]) * 60 + parseInt(cocok[2])
          }
          return 999999
        }

        const sortedData = data.sort((a, b) => {
          if (b.skor_total !== a.skor_total) {
            return b.skor_total - a.skor_total
          }
          return parseWaktuKeDetik(a.waktu_selesai) - parseWaktuKeDetik(b.waktu_selesai)
        })

        setLeaderboard(sortedData)
      }
      setIsLoading(false)
    }

    fetchLeaderboard()
  }, [navigate])

  const handleMainLagi = () => {
    // HANYA hapus data hasil skor sementara, JANGAN hapus data login (kuis_username, kuis_code)
    localStorage.removeItem('skor_akhir')
    localStorage.removeItem('hasil_benar')
    localStorage.removeItem('hasil_salah')
    localStorage.removeItem('hasil_pass')
    localStorage.removeItem('waktu_selesai')
    
    // Arahkan kembali ke Dashboard, bukan halaman Login
    navigate('/dashboard')
  }

  const getMedali = (index) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `${index + 1}`
  }

  const getRankClass = (index) => {
    if (index === 0) return 'rank-1'
    if (index === 1) return 'rank-2'
    if (index === 2) return 'rank-3'
    return 'rank-other'
  }

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = leaderboard.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(leaderboard.length / itemsPerPage)
  const paginate = (pageNumber) => setCurrentPage(pageNumber)

  return (
    <div className="login-page-wrapper">
      <ParticleBackground />

      <div className="app-container" style={{ zIndex: 10 }}>
        {/* TAMPILAN 1: RINGKASAN HASIL */}
        {!showLeaderboard && (
          <div className="animation-fade-in">
            <div className="result-box" style={{ background: 'rgba(18, 26, 46, 0.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="result-title">SKOR AKHIR KAMU</div>
              <div className="result-score">{skorAkhir}</div>
              
              <div className="result-stats">
                <div className="stat-item">
                  <span className="text-benar">{jumlahBenar}</span>
                  <p>BENAR</p>
                </div>
                <div className="stat-item">
                  <span className="text-salah">{jumlahSalah}</span>
                  <p>SALAH</p>
                </div>
                <div className="stat-item">
                  <span className="text-muted">{jumlahPass}</span>
                  <p>PASS</p>
                </div>
              </div>

              <div style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                ⏱️ Waktu Pengerjaan: <strong style={{ color: 'var(--orange)' }}>{waktuSelesai}</strong>
              </div>
            </div>

            <button 
              className="btn-primary" 
              onClick={() => setShowLeaderboard(true)}
              style={{ fontSize: '1.2rem', padding: '1.2rem' }}
            >
              LIHAT SEMUA LEADERBOARD 🏆
            </button>
          </div>
        )}

        {/* TAMPILAN 2: LEADERBOARD */}
        {showLeaderboard && (
          <div className="animation-slide-up">
            <div className="leaderboard-card" style={{ background: 'rgba(18, 26, 46, 0.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h2 className="lb-title">🏆 Papan Peringkat Peserta</h2>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Total {leaderboard.length} peserta terdaftar
              </p>
              
              {isLoading ? (
                <p className="text-center">Memuat data...</p>
              ) : leaderboard.length === 0 ? (
                <p className="text-center">Belum ada yang menyelesaikan kuis.</p>
              ) : (
                <>
                  <div className="lb-list">
                    {currentItems.map((user, index) => {
                      const globalIndex = indexOfFirstItem + index; 
                      return (
                        <div key={globalIndex} className={`lb-item ${getRankClass(globalIndex)}`}>
                          <div className="lb-left">
                            <span className="lb-rank">{getMedali(globalIndex)}</span>
                            <div>
                              <span className="lb-name">{user.username}</span>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                ⏱️ {user.waktu_selesai || '-'}
                              </div>
                            </div>
                          </div>
                          <div className="lb-right">
                            <span className="lb-score">{user.skor_total}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                      <button 
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{
                          padding: '0.8rem 1.5rem', borderRadius: '8px', fontWeight: 'bold',
                          background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'var(--navy-light)',
                          color: currentPage === 1 ? '#555' : 'white',
                          border: 'none', cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Previous
                      </button>
                      
                      <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                        Halaman {currentPage} dari {totalPages}
                      </span>

                      <button 
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        style={{
                          padding: '0.8rem 1.5rem', borderRadius: '8px', fontWeight: 'bold',
                          background: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'var(--orange)',
                          color: currentPage === totalPages ? '#555' : 'var(--navy-dark)',
                          border: 'none', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <button className="btn-primary" onClick={handleMainLagi} style={{ marginTop: '2rem' }}>
              KEMBALI KE DASHBOARD
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
