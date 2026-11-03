export default function MaintenancePage() {
  return (
    <div style={{
      minHeight: '100vh', background: '#09090b', display: 'flex', 
      flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      fontFamily: 'Montserrat, sans-serif', color: 'white', textAlign: 'center', padding: '2rem'
    }}>
      <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🛠️</div>
      <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 1rem 0', color: '#ff7a00' }}>
        Sedang Dalam Perbaikan
      </h1>
      <p style={{ color: '#a1a1aa', fontSize: '1.1rem', maxWidth: '500px', lineHeight: '1.6' }}>
        Kami sedang melakukan pembaruan sistem untuk pengalaman kuis yang lebih baik. 
        Silakan kembali beberapa saat lagi.
      </p>
    </div>
  )
}
