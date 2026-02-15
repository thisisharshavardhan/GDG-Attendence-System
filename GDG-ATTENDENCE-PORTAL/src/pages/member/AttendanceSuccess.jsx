import { useNavigate, useLocation } from 'react-router-dom'
import './ScanQR.css'

const AttendanceSuccess = () => {
  const navigate = useNavigate()
  const loc = useLocation()
  const meeting = loc.state?.meeting || null

  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="sq-page">
      <div className="sq-container">
        <div className="sq-card">
          <div className="sq-success-card">
            <div className="sq-success-icon">
              <span className="material-symbols-outlined">check_circle</span>
            </div>
            <h2 className="sq-success-title">Attendance Confirmed!</h2>
            <p className="sq-success-msg">
              Your attendance has been recorded successfully.
            </p>

            {meeting && (
              <div className="sq-meeting-card">
                <div className="sq-meeting-title">
                  <span className="material-symbols-outlined">event</span>
                  {meeting.title}
                </div>
                <div className="sq-meeting-details">
                  <div className="sq-meeting-detail">
                    <span className="material-symbols-outlined">calendar_today</span>
                    {formatDate(meeting.dateTime)}
                  </div>
                  <div className="sq-meeting-detail">
                    <span className="material-symbols-outlined">schedule</span>
                    {formatTime(meeting.dateTime)} · {meeting.duration} min
                  </div>
                  {meeting.location && (
                    <div className="sq-meeting-detail">
                      <span className="material-symbols-outlined">location_on</span>
                      {meeting.location}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="sq-success-actions">
              <button className="sq-btn sq-btn-primary" onClick={() => navigate('/dashboard')}>
                <span className="material-symbols-outlined">home</span>
                Back to Dashboard
              </button>
              <button className="sq-btn sq-btn-secondary" onClick={() => navigate('/member/scan-qr')}>
                <span className="material-symbols-outlined">qr_code_scanner</span>
                Scan Another QR
              </button>
            </div>
          </div>
        </div>

        <div className="sq-google-bar">
          <span style={{ background: '#4285F4' }} />
          <span style={{ background: '#EA4335' }} />
          <span style={{ background: '#FBBC05' }} />
          <span style={{ background: '#34A853' }} />
        </div>
      </div>
    </div>
  )
}

export default AttendanceSuccess
