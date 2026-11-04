import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ParticleBackground from '../components/ParticleBackground'
import '../styles/kuis.css'

export default function EditProfilePage() {
  const navigate = useNavigate()
  
  const [username, setUsername] = useState('')
  const [wallet, setWallet] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const currentCode = localStorage.getItem('kuis_code')

  useEffect(() => {
    if (!currentCode) {
      navigate('/')
      return
    }

    // Ambil data profil dari database
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('access_codes')
        .select('used_by, wallet_address, avatar_url')
        .eq('code', currentCode)
        .maybeSingle()

      if (data) {
        setUsername(data.used_by)
        setWallet(data.wallet_address)
        setAvatarUrl(data.avatar_url || '')
      }
    }
    fetchProfile()
  }, [navigate, currentCode])

  // Fungsi Upload Foto
  const handleUpload = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return
    setFile(selectedFile)
    
    // Preview foto sementara
    setAvatarUrl(URL.createObjectURL(selectedFile))
  }

  // Fungsi Simpan Perubahan
    const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      let newAvatarUrl = avatarUrl
      const oldUsername = localStorage.getItem('kuis_username') // Ambil nama lama

      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${currentCode}-${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, file)

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName)
        
        newAvatarUrl = publicUrlData.publicUrl
      }

      // 1. Update tabel access_codes
      const { error: updateError } = await supabase
        .from('access_codes')
        .update({
          used_by: username,
          wallet_address: wallet,
          avatar_url: newAvatarUrl
        })
        .eq('code', currentCode)

      if (updateError) throw updateError

      // 2. JIKA USERNAME BERUBAH, UPDATE JUGA TABEL LIVE_SCORES & RESULTS
      if (oldUsername !== username) {
        await supabase.from('live_scores').update({ username: username }).eq('username', oldUsername)
        await supabase.from('results').update({ username: username }).eq('username', oldUsername)
      }

      localStorage.setItem('kuis_username', username)
      localStorage.setItem('kuis_wallet', wallet)

      alert('Profil berhasil diperbarui!')
      navigate('/dashboard')

    } catch (err) {
      console.error(err)
      setError('Gagal menyimpan profil: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

      // 1. Jika ada file baru di-upload
      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${currentCode}-${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, file)

        if (uploadError) throw uploadError

        // Ambil URL publiknya
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName)
        
        newAvatarUrl = publicUrlData.publicUrl
      }

      // 2. Update database
      const { error: updateError } = await supabase
        .from('access_codes')
        .update({
          used_by: username,
          wallet_address: wallet,
          avatar_url: newAvatarUrl
        })
        .eq('code', currentCode)

      if (updateError) throw updateError

      // 3. Update localStorage (jika username berubah)
      localStorage.setItem('kuis_username', username)
      localStorage.setItem('kuis_wallet', wallet)

      alert('Profil berhasil diperbarui!')
      navigate('/dashboard')

    } catch (err) {
      console.error(err)
      setError('Gagal menyimpan profil: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page-wrapper">
      <ParticleBackground />
      <div className="login-box-premium" style={{ maxWidth: '500px' }}>
        <h1 className="login-title" style={{ marginBottom: '2rem' }}>
          <span className="title-retium" style={{ fontSize: '2rem' }}>EDIT PROFIL</span>
        </h1>

        <form onSubmit={handleSave} className="login-form-premium">
          
          {/* FOTO PROFIL */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ 
              width: '100px', height: '100px', borderRadius: '50%', 
              background: '#18181b', border: '2px solid var(--orange)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              overflow: 'hidden', marginBottom: '1rem'
            }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#52525b', fontSize: '0.8rem' }}>No Photo</span>
              )}
            </div>
            
            <label style={{ 
              background: 'rgba(255,255,255,0.1)', padding: '0.6rem 1rem', 
              borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold'
            }}>
              Pilih Foto Profil
              <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
            </label>
          </div>

          {/* USERNAME */}
          <div className="input-group-premium">
            <label>Username Discord</label>
            <div className="input-wrapper-premium">
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
                disabled={loading}
              />
            </div>
          </div>

          {/* WALLET */}
          <div className="input-group-premium">
            <label>Wallet Address</label>
            <div className="input-wrapper-premium">
              <input 
                type="text" 
                value={wallet} 
                onChange={(e) => setWallet(e.target.value)} 
                required 
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="btn-premium" disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
          </button>

          <button 
            type="button" 
            onClick={() => navigate('/dashboard')} 
            style={{ 
              marginTop: '0.5rem', background: 'transparent', border: 'none', 
              color: '#a1a1aa', cursor: 'pointer', textDecoration: 'underline' 
            }}
          >
            Kembali ke Dashboard
          </button>

          {error && <div className="error-msg-premium">{error}</div>}
        </form>
      </div>
    </div>
  )
}
