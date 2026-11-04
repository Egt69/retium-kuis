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

  // State untuk jadwal & waktu
  const [startTime, setStartTime] = useState(null)
  const [isWaiting, setIsWaiting] = useState(true)
  const [countdown, setCountdown] = useState(0)

  // State untuk Papan Peringkat
  const [liveLeaderboard, setLiveLeaderboard] = useState([])

  const timerRef = useRef(null)

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

  // 2. Ambil soal dari Supabase & Validasi Akses
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
      const { data, error } = await supabase.from('questions').select('*').order('nomor', { ascending: true })
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

  // 3. REKAM WAKTU MULAI
  useEffect(() => {
    if (!isLoading && !isWaiting && questions.length > 0 && currentIndex === 0 && startTime === null) {
      setStartTime(Date.now())
    }
  }, [isLoading, isWaiting, questions, currentIndex, startTime])

  // 4. Fetch Leaderboard Live (setiap 2 detik)
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

  // 5. Timer berjalan
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

  // 6. Waktu habis (Pass otomatis)
  useEffect(() => {
    if (timeLeft === 0 && !isLoading && questions.length > 0 && !isWaiting) {
      if (selectedOption === null) {
        prosesJawaban(null, 'pass')
      }
      const changeTimeout = setTimeout(() => {
        handleNext()
      }, 800)
      return () => clearTimeout(changeTimeout)
    }
  }, [timeLeft, isLoading, questions, selectedOption, isWaiting])

  // 7. Klik opsi jawaban
  const handleOptionClick = (opsi) => {
    if (selectedOption !== null || timeLeft === 0) return
    setSelectedOption(opsi)
    const soalSekarang = questions[currentIndex]
    const isBenar = opsi === soalSekarang.jawaban_benar
    prosesJawaban(opsi, isBenar ? 'benar' : 'salah')
  }

  // 8. Proses Jawaban
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

  // 9. Lanjut ke soal berikutnya
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

      localStorage.removeItem('kuis_username')
      localStorage.removeItem('kuis_code')
      localStorage.removeItem('kuis_start_time')
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
        
        {/* KOLOM KIRI (SOAL KUIS) */}
        <div className="kuis-main-column">
          
          <div className="kuis-header">
            <div className="score-badge-premium">
              <span className="score-label">SKOR</span>
              <span className={`score-value ${skor >= 0 ? 'text-benar' : 'text-salah'}`}>{skor}</span>
            </div>
            
            <div className={`timer-pill-premium ${isDanger ? 'danger' : ''}`}>
              <span className="timer-number">{timeLeft}</span>
              <span className="timer-unit">s</span>
              <div className="timer-bar-bg">
                <div 
                  className="timer-bar-fill" 
                  style={{ width: `${(timeLeft / 20) * 100}%` }}
                ></div>
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
              if (selectedOption !== null || timeLeft === 0) {
                if (isCorrectAnswer) btnClass += ' correct-blink'
                else if (isUserChoice) btnClass += ' wrong-shake'
              }

              return (
                <button
                  key={opt}
                  className={btnClass}
                  onClick={() => handleOptionClick(opt)}
                  disabled={selectedOption !== null || timeLeft === 0}
                >
                  <span className="option-badge">{opt}</span> 
                  <span className="option-text">{textOpsi}</span>
                </button>
              )
            })}
          </div>

          {isLastQuestion && selectedOption !== null && (
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

        {/* KOLOM KANAN (PAPAN PERINGKAT) */}
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
                      
                      {/* FOTO PROFIL DITAMBAHKAN DI SINI */}
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
