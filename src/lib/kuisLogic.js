// Aturan Skor
export const SKOR_BENAR = 10
export const SKOR_SALAH = -5
export const SKOR_PASS = 0

/**
 * Menghitung akumulasi skor berdasarkan status jawaban
 * @param {number} skorSaatIni - Skor sebelum soal ini dijawab
 * @param {string} status - 'benar' | 'salah' | 'pass'
 * @returns {number} Skor baru
 */
export function hitungSkor(skorSaatIni, status) {
  if (status === 'benar') return skorSaatIni + SKOR_BENAR
  if (status === 'salah') return skorSaatIni + SKOR_SALAH
  return skorSaatIni + SKOR_PASS // jika pass
}

/**
 * Mengubah detik menjadi format string (misal 65 detik -> "01:05")
 * @param {number} detik 
 */
export function formatWaktu(detik) {
  const m = Math.floor(detik / 60).toString().padStart(2, '0')
  const s = (detik % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}