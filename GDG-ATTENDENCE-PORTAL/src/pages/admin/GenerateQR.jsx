import '../PlaceholderPage.css'

const GenerateQR = () => {
  return (
    <div className="ph-page">
      <div className="ph-card">
        <div className="ph-icon" style={{ background: '#e6f4ea', color: '#34A853' }}>
          <span className="material-icon">qr_code</span>
        </div>
        <h2 className="ph-title">Generate QR Code</h2>
        <p className="ph-desc">Generate unique QR codes for each meeting to track attendance. This feature is coming soon.</p>
        <div className="ph-chips">
          <span className="ph-chip">Unique QR per Meeting</span>
          <span className="ph-chip">Download</span>
          <span className="ph-chip">Regenerate</span>
        </div>
      </div>
    </div>
  )
}

export default GenerateQR
