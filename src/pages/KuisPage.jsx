import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ParticleBackground from '../components/ParticleBackground'
import { hitungSkor } from '../lib/kuisLogic'
import '../styles/kuis.css'

export default function KuisPage() {
  const navigate = useNavigate()
  const username = localStorage.getItem('kuis_username')
  const code = localStorage.getItem('kuis_code')

  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [skor, setSkor] = useState(0)
  const [answersLog, setAnswersLog] = useState([])
  
  const [timeLeft, setTimeLeft] = useState(20)
  const [selectedOption, setSelectedOption] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const [startTime, setStartTime] = useState(null)
  const [isWaiting, setIsWaiting] = useState(true)
  const [countdown, setCountdown] = useState(0)

  const [totalTimeLeft, setTotalTimeLeft] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)

  const [liveLeaderboard, setLiveLeaderboard] = useState([])

  const timerRef = useRef(null)
  const totalTimerRef = useRef(null)
  const nextTimeoutRef = useRef(null)

  // 1. Cek Jadwal (Ruang Tunggu)
  useEffect(() => {
    const quizStartTime = localStorage.getItem('kuis_start_time')
    
    const checkTime = () => {
      if (!quizStartTime) {
        setIsWaiting(false) 
        return
      }

      const now = new Date().getTime()
      const start = new Date(quizStartTime).getTime()
      const distance = start - now

      if (distance <= 0) {
        setIsWaiting(false) 
      } else {
        setIsWaiting(true)
        setCountdown(Math.floor(distance / 1000))
      }
    }

    checkTime()
    const interval = setInterval(checkTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // 2. Ambil Soal (FILTER REGION)
  useEffect(() => {
    if (!username) {
      navigate('/')
      return
    }
    if (!code) {
      navigate('/dashboard')
      return
    }
    if (isWaiting) return 

    async function fetchQuestions() {
      const userRegion = localStorage.getItem('kuis_room') || 'GLB'
      
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('region', userRegion)
        .order('id', { ascending: true })
      
      if (error) {
        alert('Gagal memuat soal: ' + error.message)
        navigate('/dashboard')
      } else {
        setQuestions(data)
        setIsLoading(false)
      }
    }
    fetchQuestions()
  }, [navigate, username, code, isWaiting])

  // 3. Setup Timer Total
  useEffect(() => {
    if (isLoading || isWaiting || questions.length === 0) return

    const durasiTotal = questions.length * 20
    setTotalDuration(durasiTotal)

    const savedStartTime = localStorage.getItem('kuis_total_start')
    let startMs

    if (savedStartTime) {
      startMs = parseInt(savedStartTime, 10)
    } else {
      startMs = Date.now()
      localStorage.setItem('kuis_total_start', startMs.toString())
    }

    setStartTime(startMs)

    const hitungSisaWaktu = () => {
      const now = Date.now()
      const elapsed = Math.floor((now - startMs) / 1000)
      const sisa = durasiTotal - elapsed

      if (sisa <= 0) {
        clearInterval(totalTimerRef.current)
        setTotalTimeLeft(0)
      } else {
        setTotalTimeLeft(sisa)
      }
    }

    hitungSisaWaktu()
    totalTimerRef.current = setInterval(hitungSisaWaktu, 1000)

    return () => clearInterval(totalTimerRef.current)
  }, [isLoading, isWaiting, questions])

  // 4. Fetch Leaderboard Live
  useEffect(() => {
    if (isLoading || isWaiting) return

    const fetchLiveLeaderboard = async () => {
      const { data: liveData } = await supabase
        .from('live_scores')
        .select('username, skor')
        .order('skor', { ascending: false })
        .limit(10)
      
      if (liveData) {
        const { data: userData } = await supabase
          .from('access_codes')
          .select('used_by, avatar_url')
          
        const mergedData = liveData.map(player => {
          const cleanPlayerName = player.username.trim().toLowerCase()
          const user = userData?.find(u => u.used_by.trim().toLowerCase() === cleanPlayerName)
          return {
            ...player,
            avatar_url: user?.avatar_url || null
          }
        })
        setLiveLeaderboard(mergedData)
      }
    }

    fetchLiveLeaderboard()
    const intervalId = setInterval(fetchLiveLeaderboard, 2000)
    return () => clearInterval(intervalId)
  }, [isLoading, isWaiting])

  // 5. Timer Per Soal (BERJALAN)
  useEffect(() => {
    if (isLoading || questions.length === 0 || isWaiting) return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [currentIndex, isLoading, questions, isWaiting])

  // 6. Waktu Habis (Per Soal) & Evaluasi Jawaban Terakhir (Jeda 3 Detik untuk Semua Soal)
  useEffect(() => {
    if (timeLeft === 0 && !isLoading && questions.length > 0 && !isWaiting) {
      const soalSekarang = questions[currentIndex]
      let status = 'pass'

      if (selectedOption !== null) {
        const isBenar = selectedOption === soalSekarang.jawaban_benar
        status = isBenar ? 'benar' : 'salah'
      }

      // Proses jawaban dan skor saat waktu habis
      prosesJawaban(selectedOption, status)

      // Jeda 3 detik agar warna hijau/merah terlihat di semua soal (termasuk soal terakhir)
      nextTimeoutRef.current = setTimeout(() => {
        handleNext()
      }, 3000)
      
      return () => clearTimeout(nextTimeoutRef.current)
    }
  }, [timeLeft, isLoading, questions, isWaiting])

  // 7. Klik Opsi (Bisa ganti-ganti selama waktu belum habis)
  const handleOptionClick = (opsi) => {
    if (timeLeft === 0) return
    setSelectedOption(opsi)
  }

  // 8. Proses Jawaban & Update Live Score
  const prosesJawaban = (opsiDipilih, status) => {
    const skorBaru = hitungSkor(skor, status)
    setSkor(skorBaru)

    const logBaru = {
      question_id: questions[currentIndex].id,
      jawaban_dipilih: opsiDipilih,
      status: status,
      waktu_jawab: 20 - timeLeft
    }
    
    const logTerbaru = [...answersLog, logBaru]
    setAnswersLog(logTerbaru)

    const b = logTerbaru.filter(l => l.status === 'benar').length
    const s = logTerbaru.filter(l => l.status === 'salah').length
    const p = logTerbaru.filter(l => l.status === 'pass').length

    supabase.from('live_scores').upsert({
      username: username,
      skor: skorBaru,
      soal_sekarang: currentIndex + 1,
      benar: b,
      salah: s,
      pass: p,
      updated_at: new Date().toISOString()
    }, { onConflict: 'username' }) 
    .then(({ error }) => {
      if (error) console.error("Gagal update live:", error)
    })
  }

  // 9. Lanjut Soal atau Simpan Hasil jika sudah soal terakhir
  const handleNext = async () => {
    setSelectedOption(null)

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setTimeLeft(20)
    } else {
      await simpanHasil(skor)
    }
  }

  // 10. Simpan Hasil Akhir
  const simpanHasil = async (skorAkhir) => {
    setIsLoading(true)
    const jumlahBenar = answersLog.filter(a => a.status === 'benar').length
    const jumlahSalah = answersLog.filter(a => a.status === 'salah').length
    const jumlahPass = answersLog.filter(a => a.status === 'pass').length

    const totalDetik = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0
    const menit = Math.floor(totalDetik / 60).toString().padStart(2, '0')
    const detik = (totalDetik % 60).toString().padStart(2, '0')
    const formatDurasi = `${menit} Menit ${detik} Detik` 

    try {
      const { data: resultData, error: resultError } = await supabase
        .from('results')
        .insert([{
          username,
          code,
          skor_total: skorAkhir,
          jumlah_benar: jumlahBenar,
          jumlah_salah: jumlahSalah,
          jumlah_pass: jumlahPass,
          mulai: new Date(startTime || Date.now()).toISOString(),
          selesai: new Date().toISOString(),
          waktu_selesai: formatDurasi
        }])
        .select()
        .single()

      if (resultError) throw resultError

      const answersToInsert = answersLog.map(log => ({
        result_id: resultData.id,
        ...log
      }))

      const { error: answersError } = await supabase
        .from('answers')
        .insert(answersToInsert)

      if (answersError) throw answersError

      await supabase.from('live_scores').update({ soal_sekarang: 16 }).eq('username', username)

      if (code) {
        await supabase.from('access_codes').update({ used: true }).eq('code', code)
      }

      const userRoom = localStorage.getItem('kuis_room') || 'GLB'
      await supabase.from('quiz_settings').update({ is_active: false }).eq('room_target', userRoom)

      localStorage.removeItem('kuis_code') 
      localStorage.removeItem('kuis_start_time')
      localStorage.removeItem('kuis_total_start')
      
      localStorage.setItem('skor_akhir', skorAkhir)
      localStorage.setItem('hasil_benar', jumlahBenar)
      localStorage.setItem('hasil_salah', jumlahSalah)
      localStorage.setItem('hasil_pass', jumlahPass)
      localStorage.setItem('waktu_selesai', formatDurasi)
      
      navigate('/hasil')

    } catch (err) {
      console.error(err)
      alert('Gagal menyimpan hasil: ' + err.message)
      setIsLoading(false)
    }
  }

  // TAMPILAN RUANG TUNGGU
  if (isWaiting) {
    return (
      <>
        <ParticleBackground />
        <div className="login-page-wrapper">
          <div className="login-box" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 className="text-orange" style={{ marginBottom: '1rem' }}>Ruang Tunggu</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Kuis akan segera dimulai secara serentak. Bersiap!</p>
            
            <div style={{ fontSize: '5rem', fontWeight: '800', color: 'white', textShadow: '0 0 30px var(--orange)' }}>
              {countdown}
            </div>
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem', letterSpacing: '2px' }}>DETIK LAGI</p>
                 
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem', fontFamily: 'monospace' }}>
              <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '0.6rem 1rem', borderRadius: '8px', color: '#22c55e' }}>
                BENAR: <strong style={{ color: 'white' }}>+10</strong>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.6rem 1rem', borderRadius: '8px', color: '#ef4444' }}>
                SALAH: <strong style={{ color: 'white' }}>-5</strong>
              </div>
              <div style={{ background: 'rgba(138, 147, 168, 0.1)', border: '1px solid rgba(138, 147, 168, 0.3)', padding: '0.6rem 1rem', borderRadius: '8px', color: '#8a93a8' }}>
                PASS: <strong style={{ color: 'white' }}>0</strong>
              </div>
            </div> 
          </div> 
        </div> 
      </>
    )
  }

  if (isLoading || questions.length === 0) {
    return (
      <div className="app-container text-center">
        <h2 className="text-orange">Memuat Soal...</h2>
      </div>
    )
  }

  const soal = questions[currentIndex]
  const isDanger = timeLeft <= 5
  const isLastQuestion = currentIndex === questions.length - 1

  return (
    <>
      <ParticleBackground />
      <div className="kuis-layout-wrapper">
        
        <div className="kuis-main-column">
          
          <div className="kuis-header">
            <div className="score-badge-premium">
              <span className="score-label">SKOR</span>
              <span className={`score-value ${skor >= 0 ? 'text-benar' : 'text-salah'}`}>{skor}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              
              <div style={{ 
                background: 'rgba(18, 26, 46, 0.8)', 
                padding: '0.5rem 1rem', 
                borderRadius: '8px', 
                border: '1px solid rgba(255,122,0,0.3)', 
                color: '#a1a1aa',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Sisa Waktu</span>
                <strong style={{ color: '#ff7a00', fontSize: '1.2rem', fontFamily: 'monospace' }}>
                  {Math.floor(totalTimeLeft / 60).toString().padStart(2, '0')}:{(totalTimeLeft % 60).toString().padStart(2, '0')}
                </strong>
              </div>

              <div style={{ 
                position: 'relative', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                width: '65px', 
                height: '65px', 
                background: 'rgba(18, 26, 46, 0.8)',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <svg style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                  <circle cx="32.5" cy="32.5" r="28" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="transparent" />
                  <circle 
                    cx="32.5" cy="32.5" r="28" 
                    stroke={isDanger ? '#ef4444' : '#ff7a00'} 
                    strokeWidth="4" fill="transparent" 
                    strokeDasharray="175.9" 
                    strokeDashoffset={175.9 - (175.9 * timeLeft) / 20} 
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: isDanger ? '#ef4444' : 'white', zIndex: 2 }}>
                  {timeLeft}
                </span>
              </div>
            </div>
          </div>

          <div className="question-card-premium">
            <div className="question-header">
              <span className="question-label">SOAL {currentIndex + 1} DARI {questions.length}</span>
            </div>
            <div className="question-text-premium">{soal.pertanyaan}</div>
          </div>

          <div className="options-grid-premium">
            {['A', 'B', 'C', 'D'].map((opt) => {
              const textOpsi = soal[`opsi_${opt.toLowerCase()}`]
              const isCorrectAnswer = opt === soal.jawaban_benar
              const isUserChoice = opt === selectedOption

              let btnClass = 'option-btn-premium'
              
              // Logika styling tombol
              if (timeLeft === 0) {
                // Ketika waktu habis: kunci jawaban benar jadi hijau, pilihan user yang salah jadi merah
                if (isCorrectAnswer) btnClass += ' correct-blink'
                else if (isUserChoice) btnClass += ' wrong-shake'
              } else {
                // Selama waktu berjalan: pilihan aktif berwarna kuning
                if (isUserChoice) btnClass += ' bg-yellow-stable'
              }

              const isYellow = isUserChoice && timeLeft > 0;
              const isGreen = isCorrectAnswer && timeLeft === 0;
              const isRed = isUserChoice && !isCorrectAnswer && timeLeft === 0;

              return (
                <button
                  key={opt}
                  className={btnClass}
                  onClick={() => handleOptionClick(opt)}
                  disabled={timeLeft === 0}
                  style={{
                    border: isYellow ? '2px solid #facc15' : 
                            isGreen ? '2px solid #22c55e' : 
                            isRed ? '2px solid #ef4444' : '',
                    background: isYellow ? 'rgba(250, 204, 21, 0.1)' : 
                                isGreen ? 'rgba(34, 197, 94, 0.15)' : 
                                isRed ? 'rgba(239, 68, 68, 0.15)' : '',
                    boxShadow: isYellow ? '0 0 15px rgba(250, 204, 21, 0.3)' : 
                               isGreen ? '0 0 15px rgba(34, 197, 94, 0.3)' : 
                               isRed ? '0 0 15px rgba(239, 68, 68, 0.3)' : '',
                  }}
                >
                  <span className="option-badge" style={{
                    background: isYellow ? '#facc15' : isGreen ? '#22c55e' : isRed ? '#ef4444' : '',
                    color: (isYellow || isGreen) ? '#000' : '',
                  }}>{opt}</span> 
                  <span className="option-text">{textOpsi}</span>
                </button>
              )
            })}
          </div>

          {/* Teks Shimmer Loading saat menghitung hasil akhir di soal terakhir */}
          {isLastQuestion && timeLeft === 0 && (
            <div className="loading-shimmer-container">
              <div className="loading-shimmer-text">
                MENGHITUNG NILAI & MEMUAT LEADERBOARD
              </div>
              <div className="loading-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
        </div>

        <div className="leaderboard-premium">
          <div className="lb-header-premium">
            <h3 className="lb-title-premium">PAPAN PERINGKAT</h3>
          </div>
          <div className="lb-list-premium">
            {liveLeaderboard.length === 0 ? (
              <div className="lb-loading">
                <div className="spinner"></div>
                <p>Menunggu skor masuk...</p>
              </div>
            ) : (
              liveLeaderboard.map((player, index) => {
                const isCurrentUser = player.username === username
                return (
                  <div 
                    key={player.username} 
                    className={`lb-item-premium ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : ''} ${isCurrentUser ? 'is-me' : ''}`}
                  >
                    <div className="lb-left">
                      <span className="lb-rank">
                        {index === 0 ? '1' : index === 1 ? '2' : index === 2 ? '3' : `#${index + 1}`}
                      </span>
                      
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: '#18181b', overflow: 'hidden',
                        border: isCurrentUser ? '1px solid #ff7a00' : '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', justifyContent: 'center', alignItems: 'center'
                      }}>
                        <img 
                          src={player.avatar_url || `https://ui-avatars.com/api/?name=${player.username}&background=random`} 
                          alt="Avatar" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </div>

                      <span className="lb-name">{player.username}</span>
                    </div>
                    <div className="lb-score">{player.skor} <span>PTS</span></div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>
    </>
  )
}
