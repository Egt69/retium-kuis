import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
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

  // 2. Ambil soal dari Supabase
  useEffect(() => {
    if (!username || !code) {
      navigate('/')
      return
    }
    if (isWaiting) return 

    async function fetchQuestions() {
      const { data, error } = await supabase.from('questions').select('*').order('nomor', { ascending: true })
      if (error) {
        alert('Gagal memuat soal: ' + error.message)
        navigate('/')
      } else {
        setQuestions(data)
        setIsLoading(false)
      }
    }
    fetchQuestions()
  }, [navigate, username, code, isWaiting])

  // 3. REKAM WAKTU MULAI: Tepat saat soal pertama muncul di layar
  useEffect(() => {
    if (!isLoading && !isWaiting && questions.length > 0 && currentIndex === 0 && startTime === null) {
      setStartTime(Date.now())
    }
  }, [isLoading, isWaiting, questions, currentIndex, startTime])

  // 4. Fetch Leaderboard Live (setiap 2 detik)
  useEffect(() => {
    if (isLoading || isWaiting) return

    const fetchLiveLeaderboard = async () => {
      const { data } = await supabase
        .from('live_scores')
        .select('username, skor')
        .order('skor', { ascending: false })
        .limit(10)
      
      if (data) setLiveLeaderboard(data)
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
      <div className="login-page-wrapper">
        <div className="aurora-bg">
          <div className="aurora-blob blob-1"></div>
          <div className="aurora-blob blob-2"></div>
        </div>
        <div className="login-box" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <h2 className="text-orange" style={{ marginBottom: '1rem' }}>Ruang Tunggu</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Kuis akan segera dimulai secara serentak. Bersiap!</p>
          
          <div style={{ fontSize: '5rem', fontWeight: '800', color: 'white', textShadow: '0 0 30px var(--orange)' }}>
            {countdown}
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem', letterSpacing: '2px' }}>DETIK LAGI</p>
        </div>
      </div>
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
      <div className="aurora-bg">
        <div className="aurora-blob blob-1"></div>
        <div className="aurora-blob blob-2"></div>
        <div className="aurora-blob blob-3"></div>
      </div>
      <div className="bg-grid"></div>

      <div style={{ 
        display: 'flex', maxWidth: '1400px', margin: '0 auto', padding: '2rem', minHeight: '100vh',
        gap: '2rem', position: 'relative', zIndex: 10
      }}>
        
        {/* KOLOM KIRI (SOAL KUIS) */}
        <div style={{ flex: '1 1 70%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          <div className="kuis-header">
            <div className="score-badge">
              Skor: <span className={skor >= 0 ? 'text-benar' : 'text-salah'}>{skor}</span>
            </div>
            
            <div className="timer-container">
              <div className={`timer-text ${isDanger ? 'danger' : ''}`}>
                {timeLeft}s
              </div>
              <div className="timer-bar-bg">
                <div 
                  className={`timer-bar-fill ${isDanger ? 'danger' : ''}`} 
                  style={{ width: `${(timeLeft / 20) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="question-card">
            <div className="question-number">SOAL {currentIndex + 1} DARI {questions.length}</div>
            <div className="question-text">{soal.pertanyaan}</div>
          </div>

          <div className="options-grid">
            {['A', 'B', 'C', 'D'].map((opt) => {
              const textOpsi = soal[`opsi_${opt.toLowerCase()}`]
              const isCorrectAnswer = opt === soal.jawaban_benar
              const isUserChoice = opt === selectedOption

              let btnClass = 'option-btn'
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
                  <span className="option-prefix">{opt}</span> {textOpsi}
                </button>
              )
            })}
          </div>

          {isLastQuestion && selectedOption !== null && (
            <div style={{ textAlign: 'center', marginTop: '2rem', animation: 'fadeIn 1s infinite alternate' }}>
              <p style={{ color: 'var(--orange)', fontWeight: '800', fontSize: '1.2rem', letterSpacing: '2px', textShadow: '0 0 15px var(--orange)' }}>
                MENGHITUNG NILAI & MEMUAT LEADERBOARD...
              </p>
            </div>
          )}
        </div>

        {/* KOLOM KANAN (PAPAN PERINGKAT) */}
        <div style={{ 
          flex: '1 1 30%', 
          background: 'linear-gradient(145deg, rgba(18, 26, 46, 0.8), rgba(10, 14, 26, 0.9))', 
          backdropFilter: 'blur(20px)', 
          borderRadius: '24px', 
          padding: '1.5rem', 
          border: '1px solid rgba(255, 122, 0, 0.3)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
          display: 'flex', 
          flexDirection: 'column',
          maxHeight: '85vh',
          position: 'sticky',
          top: '2rem',
          animation: 'slideInRight 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
        }}>
          
          {/* Header Papan Peringkat */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.8rem', 
            marginBottom: '1.5rem', 
            borderBottom: '1px solid rgba(255,122,0,0.3)', 
            paddingBottom: '1rem' 
          }}>
            <span style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 0 10px #ff7a00)' }}>🏆</span>
            <h3 style={{ color: 'white', margin: 0, fontWeight: '900', fontSize: '1.2rem', letterSpacing: '1px', textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
              PAPAN PERINGKAT
            </h3>
          </div>

          {/* List Peringkat */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', paddingRight: '0.5rem', flex: 1 }}>
            {liveLeaderboard.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                <div style={{ width: '30px', height: '30px', border: '3px solid var(--orange)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem' }}></div>
                <p style={{ color: '#8a93a8', fontSize: '0.9rem', textAlign: 'center' }}>Menunggu skor masuk...</p>
              </div>
            ) : (
              liveLeaderboard.map((player, index) => {
                // Logika Medali
                let medali = `#${index + 1}`
                let borderLeft = '1px solid rgba(255,255,255,0.05)'
                let bgColor = 'rgba(10, 14, 26, 0.6)'
                
                if (index === 0) { medali = '🥇'; bgColor = 'rgba(255, 215, 0, 0.1)'; borderLeft = '3px solid #ffd700' }
                else if (index === 1) { medali = '🥈'; bgColor = 'rgba(192, 192, 192, 0.1)'; borderLeft = '3px solid #c0c0c0' }
                else if (index === 2) { medali = '🥉'; bgColor = 'rgba(205, 127, 50, 0.1)'; borderLeft = '3px solid #cd7f32' }

                // Sorot Pemain Saat Ini
                const isCurrentUser = player.username === username
                if (isCurrentUser) {
                  bgColor = 'rgba(255, 122, 0, 0.15)'
                  borderLeft = '3px solid #ff7a00'
                }

                return (
                  <div 
                    key={player.username} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '0.8rem 1rem', 
                      background: bgColor, 
                      borderRadius: '12px', 
                      border: '1px solid rgba(255,255,255,0.03)',
                      borderLeft: borderLeft,
                      boxShadow: isCurrentUser ? '0 0 15px rgba(255,122,0,0.2)' : 'none',
                      transition: 'all 0.5s ease',
                      transform: isCurrentUser ? 'scale(1.02)' : 'scale(1)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <span style={{ fontSize: index < 3 ? '1.2rem' : '0.9rem', fontWeight: '900', color: '#8a93a8', width: '30px', textAlign: 'center' }}>
                        {medali}
                      </span>
                      <span style={{ color: isCurrentUser ? '#ff7a00' : 'white', fontWeight: '800', fontSize: '0.95rem' }}>
                        {player.username}
                      </span>
                    </div>
                    <div style={{ color: isCurrentUser ? '#ff7a00' : 'white', fontWeight: '900', fontSize: '1.1rem', textShadow: isCurrentUser ? '0 0 10px rgba(255,122,0,0.5)' : 'none' }}>
                      {player.skor}
                    </div>
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