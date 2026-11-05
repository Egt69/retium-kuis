import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import '../styles/kuis.css'

export default function ManageQuestionsPage() {
  const navigate = useNavigate()
  
  // State Form Tambah
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState('GLB')
  const [jumlahSoal, setJumlahSoal] = useState(1)
  const [formData, setFormData] = useState([])
  const [isSaving, setIsSaving] = useState(false)

  // State Tabel History
  const [historyData, setHistoryData] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // State Modal Alert
  const [modal, setModal] = useState({ show: false, type: '', title: '', message: '' })
  
  // State Edit Form
  const [editModal, setEditModal] = useState({ show: false, data: null })

  // 1. Ambil daftar room
  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase.from('rooms').select('*')
      if (data) setRooms(data)
    }
    fetchRooms()
  }, [])

  // 2. Atur form otomatis saat jumlah soal berubah
  useEffect(() => {
    const newForm = Array.from({ length: jumlahSoal }, () => ({
      pertanyaan: '',
      opsi_a: '',
      opsi_b: '',
      opsi_c: '',
      opsi_d: '',
      jawaban_benar: 'A'
    }))
    setFormData(newForm)
  }, [jumlahSoal])

  // 3. Ambil Data History berdasarkan Region yang dipilih
  useEffect(() => {
    fetchHistory()
  }, [selectedRoom])

  const fetchHistory = async () => {
    setIsLoadingHistory(true)
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('region', selectedRoom)
      .order('id', { ascending: true })
    
    if (!error && data) setHistoryData(data)
    setIsLoadingHistory(false)
  }

  // 4. Update form input (Tambah)
  const handleInputChange = (index, field, value) => {
    const newData = [...formData]
    newData[index][field] = value
    setFormData(newData)
  }

  // 5. Simpan Massal ke Supabase
  const handleSave = async () => {
    const isKosong = formData.some(q => !q.pertanyaan || !q.opsi_a || !q.opsi_b || !q.opsi_c || !q.opsi_d)
    if (isKosong) {
      return setModal({ show: true, type: 'error', title: 'Form Tidak Lengkap', message: 'Semua kolom pertanyaan dan opsi A, B, C, D harus diisi!' })
    }

    setIsSaving(true)

    const payload = formData.map(q => ({
      ...q,
      region: selectedRoom
    }))

    const { error } = await supabase.from('questions').insert(payload)

    if (error) {
      setModal({ show: true, type: 'error', title: 'Gagal Menyimpan', message: error.message })
    } else {
      setModal({ show: true, type: 'success', title: 'Berhasil!', message: `${jumlahSoal} soal berhasil ditambahkan.` })
      setJumlahSoal(1)
      fetchHistory()
    }
    setIsSaving(false)
  }

  // 6. Hapus Soal
  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus soal ini?')) return
    
    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) {
      setModal({ show: true, type: 'error', title: 'Gagal Menghapus', message: error.message })
    } else {
      fetchHistory()
    }
  }

  // 7. Buka Modal Edit
  const handleOpenEdit = (soal) => {
    setEditModal({ show: true, data: { ...soal } })
  }

  // 8. Simpan Perubahan Edit (SUDAH DIPERBAIKI)
  const handleSaveEdit = async () => {
    const { id, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, jawaban_benar } = editModal.data
    
    if (!pertanyaan || !opsi_a || !opsi_b || !opsi_c || !opsi_d) {
      return setModal({ show: true, type: 'error', title: 'Form Tidak Lengkap', message: 'Semua kolom harus diisi!' })
    }

    const { error } = await supabase
      .from('questions')
      .update({ pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, jawaban_benar })
      .eq('id', id)

    if (error) {
      setModal({ show: true, type: 'error', title: 'Gagal Update', message: error.message })
    } else {
      setEditModal({ show: false, data: null })
      fetchHistory() // Refresh data di tabel
      setModal({ show: true, type: 'success', title: 'Berhasil!', message: 'Soal berhasil diperbarui.' })
    }
  }

  const handleEditChange = (field, value) => {
    setEditModal(prev => ({ ...prev, data: { ...prev.data, [field]: value } }))
  }

  // Tampilan Input Form Tambah (dengan Label)
  const renderInput = (index, field, placeholder) => (
    <div style={{ position: 'relative', width: '100%' }}>
      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#ff7a00', fontWeight: 'bold', fontSize: '0.9rem' }}>
        {field === 'opsi_a' ? 'A.' : field === 'opsi_b' ? 'B.' : field === 'opsi_c' ? 'C.' : 'D.'}
      </span>
      <input 
        type="text" 
        placeholder={placeholder} 
        value={formData[index][field]} 
        onChange={(e) => handleInputChange(index, field, e.target.value)} 
        style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.5rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333' }} 
      />
    </div>
  )

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = historyData.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(historyData.length / itemsPerPage)

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', padding: '3rem 2rem', color: '#f4f4f5', fontFamily: 'Montserrat, sans-serif' }}>
      
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', borderBottom: '1px solid #27272a', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Kelola Soal</h1>
            <p style={{ color: '#a1a1aa', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>Tambah & lihat riwayat pertanyaan per region</p>
          </div>
          <button onClick={() => navigate('/admin-rahasia')} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #27272a', background: 'transparent', color: '#a1a1aa', cursor: 'pointer' }}>
            Kembali ke Admin
          </button>
        </div>

        {/* FORM TAMBAH SOAL */}
        <div style={{ background: '#18181b', padding: '1.5rem', borderRadius: '16px', border: '1px solid #27272a', display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#a1a1aa' }}>Pilih Region</label>
            <select 
              value={selectedRoom} 
              onChange={(e) => { setSelectedRoom(e.target.value); setCurrentPage(1); }} 
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333' }}
            >
              {rooms.map(r => <option key={r.kode_negara} value={r.kode_negara}>{r.is_global ? 'Global' : r.nama_negara}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#a1a1aa' }}>Jumlah Soal Baru</label>
            <input 
              type="number" 
              min="1" 
              max="50"
              value={jumlahSoal} 
              onChange={(e) => setJumlahSoal(parseInt(e.target.value) || 1)} 
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
          {formData.map((soal, index) => (
            <div key={index} style={{ background: '#18181b', padding: '1.5rem', borderRadius: '16px', border: '1px solid #27272a' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#ff7a00' }}>Soal Baru {index + 1}</h3>
              
              <input 
                type="text" 
                placeholder="Tulis pertanyaan..." 
                value={soal.pertanyaan} 
                onChange={(e) => handleInputChange(index, 'pertanyaan', e.target.value)} 
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333', marginBottom: '1rem' }}
              />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {renderInput(index, 'opsi_a', 'Opsi A')}
                {renderInput(index, 'opsi_b', 'Opsi B')}
                {renderInput(index, 'opsi_c', 'Opsi C')}
                {renderInput(index, 'opsi_d', 'Opsi D')}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ fontSize: '0.9rem', color: '#a1a1aa' }}>Kunci Jawaban:</label>
                <select 
                  value={soal.jawaban_benar} 
                  onChange={(e) => handleInputChange(index, 'jawaban_benar', e.target.value)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333', fontWeight: 'bold' }}
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={handleSave} 
          disabled={isSaving}
          style={{ width: '100%', padding: '1rem', background: 'var(--orange)', color: '#0a0e1a', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.1rem', cursor: isSaving ? 'not-allowed' : 'pointer', marginBottom: '4rem' }}
        >
          {isSaving ? 'Menyimpan...' : `Simpan ${jumlahSoal} Soal ke Database`}
        </button>

        {/* TABEL HISTORY SOAL */}
        <div style={{ background: '#18181b', borderRadius: '16px', border: '1px solid #27272a', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Rekap Soal ({selectedRoom})</h3>
            <span style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>Total: {historyData.length} Soal</span>
          </div>
          
          <div style={{ padding: '1rem', overflowX: 'auto' }}>
            {isLoadingHistory ? (
              <p style={{ textAlign: 'center', color: '#a1a1aa' }}>Memuat data...</p>
            ) : historyData.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#a1a1aa' }}>Belum ada soal untuk region ini.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #333' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#a1a1aa' }}>Pertanyaan</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: '#a1a1aa' }}>Kunci</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#a1a1aa' }}>Dibuat Oleh</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: '#a1a1aa' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((q, i) => (
                    <tr key={q.id} style={{ borderBottom: '1px solid #27272a' }}>
                      <td style={{ padding: '12px', maxWidth: '300px' }}>
                        <div style={{ fontWeight: 'bold' }}>{q.pertanyaan}</div>
                        <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '4px' }}>
                          A: {q.opsi_a} | B: {q.opsi_b} | C: {q.opsi_c} | D: {q.opsi_d}
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {q.jawaban_benar}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.85rem', color: '#a1a1aa' }}>
                        {q.created_by || 'Admin'}<br/>
                        <span style={{ fontSize: '0.75rem' }}>{q.created_at ? new Date(q.created_at).toLocaleString('id-ID') : '-'}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        <button onClick={() => handleOpenEdit(q)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ff7a00', color: '#ff7a00', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(q.id)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div style={{ padding: '1rem', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', background: currentPage === 1 ? '#27272a' : 'transparent', border: '1px solid #333', color: currentPage === 1 ? '#52525b' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                Prev
              </button>
              <span style={{ fontSize: '0.9rem', color: '#a1a1aa' }}>Hal {currentPage} dari {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', background: currentPage === totalPages ? '#27272a' : 'transparent', border: '1px solid #333', color: currentPage === totalPages ? '#52525b' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          )}
        </div>

      </div>

      {/* MODAL EDIT SOAL (DENGAN TOM BOL A, B, C, D) */}
      {editModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#18181b', border: '1px solid #333', padding: '2rem', borderRadius: '24px', maxWidth: '600px', width: '100%', animation: 'modalFadeIn 0.3s ease-out' }}>
            <h2 style={{ color: 'white', margin: '0 0 1.5rem 0', fontSize: '1.2rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>Edit Soal</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="text" 
                placeholder="Pertanyaan" 
                value={editModal.data.pertanyaan} 
                onChange={(e) => handleEditChange('pertanyaan', e.target.value)} 
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333' }}
              />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Opsi A */}
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#ff7a00', fontWeight: 'bold', fontSize: '0.9rem' }}>A.</span>
                  <input type="text" placeholder="Opsi A" value={editModal.data.opsi_a} onChange={(e) => handleEditChange('opsi_a', e.target.value)} style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.5rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333' }} />
                </div>
                
                {/* Opsi B */}
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#ff7a00', fontWeight: 'bold', fontSize: '0.9rem' }}>B.</span>
                  <input type="text" placeholder="Opsi B" value={editModal.data.opsi_b} onChange={(e) => handleEditChange('opsi_b', e.target.value)} style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.5rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333' }} />
                </div>

                {/* Opsi C */}
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#ff7a00', fontWeight: 'bold', fontSize: '0.9rem' }}>C.</span>
                  <input type="text" placeholder="Opsi C" value={editModal.data.opsi_c} onChange={(e) => handleEditChange('opsi_c', e.target.value)} style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.5rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333' }} />
                </div>

                {/* Opsi D */}
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#ff7a00', fontWeight: 'bold', fontSize: '0.9rem' }}>D.</span>
                  <input type="text" placeholder="Opsi D" value={editModal.data.opsi_d} onChange={(e) => handleEditChange('opsi_d', e.target.value)} style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 2.5rem', borderRadius: '8px', background: '#09090b', color: 'white', border: '1px solid #333' }} />
                </div>
              </div>

              {/* KUNCI JAWABAN (TOM BOL A, B, C, D) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                <label style={{ fontSize: '0.9rem', color: '#a1a1aa' }}>Kunci Jawaban:</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['A', 'B', 'C', 'D'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleEditChange('jawaban_benar', opt)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        background: editModal.data.jawaban_benar === opt ? 'var(--orange)' : 'rgba(255,255,255,0.05)',
                        color: editModal.data.jawaban_benar === opt ? '#0a0e1a' : 'white',
                        border: editModal.data.jawaban_benar === opt ? '1px solid var(--orange)' : '1px solid #333'
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '2rem' }}>
              <button onClick={() => setEditModal({ show: false, data: null })} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid #52525b', color: '#a1a1aa', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
              <button onClick={handleSaveEdit} style={{ flex: 1, padding: '0.8rem', background: 'var(--orange)', border: 'none', color: '#0a0e1a', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL UNTUK ALERT/ERROR */}
      {modal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'rgba(18, 26, 46, 0.95)', border: `1px solid ${modal.type === 'error' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'}`, boxShadow: `0 0 30px ${modal.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`, padding: '2rem', borderRadius: '24px', maxWidth: '400px', width: '100%', textAlign: 'center', animation: 'modalFadeIn 0.3s ease-out' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{modal.type === 'error' ? '🚫' : '✅'}</div>
            <h2 style={{ color: modal.type === 'error' ? '#ef4444' : '#22c55e', margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>{modal.title}</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '2rem' }}>{modal.message}</p>
            <button onClick={() => setModal({ show: false, type: '', title: '', message: '' })} style={{ width: '100%', padding: '0.8rem', background: modal.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', border: `1px solid ${modal.type === 'error' ? '#ef4444' : '#22c55e'}`, color: modal.type === 'error' ? '#ef4444' : '#22c55e', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>MENGERTI</button>
          </div>
        </div>
      )}

    </div>
  )
}
