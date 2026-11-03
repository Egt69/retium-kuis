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

      <div className="kuis-layout-wrapper">
        
        {/* KOLOM KIRI (SOAL KUIS) */}
        <div className="kuis-main-column">
          
          <div className="kuis-header">
            {/* Skor Badge */}
            <div className="score-badge-premium">
              <span className="score-label">SKOR</span>
              <span className={`score-value ${skor >= 0 ? 'text-benar' : 'text-salah'}`}>{skor}</span>
            </div>
            
            {/* Timer Kapsul */}
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

          {/* Kartu Soal */}
          <div className="question-card-premium">
            <div className="question-header">
              <span className="question-label">SOAL {currentIndex + 1} DARI {questions.length}</span>
            </div>
            <div className="question-text-premium">{soal.pertanyaan}</div>
          </div>

          {/* Pilihan Ganda */}
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
            <span className="lb-icon">🏆</span>
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
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </span>
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