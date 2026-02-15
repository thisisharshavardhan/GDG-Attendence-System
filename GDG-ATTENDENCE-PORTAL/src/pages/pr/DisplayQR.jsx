import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../config/api'
import './DisplayQR.css'

const QR_REFRESH_INTERVAL = 20 // must match backend

const DisplayQR = () => {
  const { meetingId } = useParams()
  const navigate = useNavigate()

  // Meeting data
  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // QR state
  const [qrCode, setQrCode] = useState(null)
  const [qrCountdown, setQrCountdown] = useState(QR_REFRESH_INTERVAL)
  const [qrPaused, setQrPaused] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const qrRefreshingRef = useRef(false)
  const pageRef = useRef(null)

  // ── Fetch meeting details ──────────────────────────
  const fetchMeeting = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.get(`/meetings/${meetingId}`)
      if (data.success) {
        setMeeting(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch meeting:', err)
      setError(err.data?.message || 'Failed to load meeting.')
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    fetchMeeting()
  }, [fetchMeeting])

  // ── QR auto-refresh timer ─────────────────────────
  // Same flow as the admin ManageMeetings QR modal:
  //   1. Fetch qr-status → get QR image + secondsRemaining
  //   2. Count down to 0
  //   3. Wait 1.5 s for server to regenerate
  //   4. Re-fetch and repeat
  useEffect(() => {
    if (!meeting || !meetingId) return

    let cancelled = false
    let tickTimer = null
    let delayTimer = null

    const fetchAndStartCountdown = async () => {
      if (cancelled) return
      try {
        qrRefreshingRef.current = true
        const data = await api.get(`/meetings/${meetingId}/qr-status`)
        if (cancelled) return

        if (data.success) {
          const { qrCode: newQr, secondsRemaining, qrPaused: paused } = data.data

          if (newQr) setQrCode(newQr)
          setQrPaused(!!paused)

          if (paused) {
            qrRefreshingRef.current = false
            return // Don't start countdown — paused on server
          }

          startTick(secondsRemaining ?? QR_REFRESH_INTERVAL)
        }
      } catch (err) {
        console.error('QR status poll failed:', err)
        if (!cancelled) delayTimer = setTimeout(fetchAndStartCountdown, 3000)
      } finally {
        qrRefreshingRef.current = false
      }
    }

    const startTick = (startValue) => {
      if (cancelled) return
      if (tickTimer) clearInterval(tickTimer)

      let remaining = Math.max(0, Math.round(startValue))
      setQrCountdown(remaining)

      tickTimer = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          clearInterval(tickTimer)
          tickTimer = null
          setQrCountdown(0)
          delayTimer = setTimeout(fetchAndStartCountdown, 1500)
        } else {
          setQrCountdown(remaining)
        }
      }, 1000)
    }

    // If paused, don't start the polling cycle
    if (!qrPaused) {
      fetchAndStartCountdown()
    }

    return () => {
      cancelled = true
      if (tickTimer) clearInterval(tickTimer)
      if (delayTimer) clearTimeout(delayTimer)
    }
  }, [meeting?._id, meetingId, qrPaused])

  // ── Fullscreen toggle ─────────────────────────────
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await pageRef.current?.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // ── Download QR ────────────────────────────────────
  const downloadQR = () => {
    if (!qrCode || !meeting) return
    const link = document.createElement('a')
    link.download = `QR-${meeting.title.replace(/\s+/g, '-')}.png`
    link.href = qrCode
    link.click()
  }

  // ── Helpers ────────────────────────────────────────
  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  const formatTime = (iso) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const circumference = 2 * Math.PI * 22
  const dashOffset = circumference * (1 - qrCountdown / QR_REFRESH_INTERVAL)

  // ── Loading state ──────────────────────────────────
  if (loading) {
    return (
      <div className="dq-center">
        <div className="dq-spinner" />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────
  if (error || !meeting) {
    return (
      <div className="dq-center">
        <div className="dq-load-error">
          <div className="dq-load-error-icon">
            <span className="material-icon">error</span>
          </div>
          <h2 className="dq-load-error-title">
            {error || 'Meeting not found'}
          </h2>
          <p className="dq-load-error-desc">
            Unable to load this meeting. It may have been deleted or you may not have access.
          </p>
          <button className="dq-load-error-btn" onClick={() => navigate('/pr/select-meeting')}>
            <span className="material-icon" style={{ fontSize: '18px' }}>arrow_back</span>
            Back to meetings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={pageRef}
      className={`dq-page ${isFullscreen ? 'dq-fullscreen' : ''}`}
    >
      {/* ── Top bar ──────────────────────────────── */}
      <div className="dq-topbar">
        <div className="dq-topbar-left">
          <button
            className="dq-back-btn"
            onClick={() => navigate('/pr/select-meeting')}
            title="Back to meeting list"
          >
            <span className="material-icon">arrow_back</span>
          </button>
          <div className="dq-meeting-info">
            <h2 className="dq-meeting-title">{meeting.title}</h2>
            <div className="dq-meeting-meta">
              <span className="dq-meta-item">
                <span className="material-icon">calendar_today</span>
                {formatDate(meeting.dateTime)}
              </span>
              <span className="dq-meta-item">
                <span className="material-icon">schedule</span>
                {formatTime(meeting.dateTime)}
              </span>
              {meeting.type === 'offline' && meeting.location && (
                <span className="dq-meta-item">
                  <span className="material-icon">location_on</span>
                  {meeting.location}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="dq-topbar-right">
          <span className={`dq-type-pill dq-type-${meeting.type}`}>
            <span className="material-icon" style={{ fontSize: '13px' }}>
              {meeting.type === 'online' ? 'videocam' : 'groups'}
            </span>
            {meeting.type === 'online' ? 'Online' : 'Offline'}
          </span>
          <button
            className="dq-fullscreen-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <span className="material-icon">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Main QR area ─────────────────────────── */}
      <div className="dq-main">
        {qrCode ? (
          <div className="dq-qr-container">
            {/* QR image */}
            <div className="dq-qr-frame">
              <img
                src={qrCode}
                alt="Attendance QR Code"
                className={`dq-qr-image ${qrRefreshingRef.current ? 'dq-qr-refreshing' : ''}`}
              />
            </div>

            {/* Timer / Paused */}
            {qrPaused ? (
              <div className="dq-paused-badge">
                <span className="material-icon">pause_circle</span>
                Auto-refresh paused by admin
              </div>
            ) : (
              <div className="dq-timer-section">
                <div className="dq-countdown">
                  <svg className="dq-countdown-ring" viewBox="0 0 48 48">
                    <circle
                      className="dq-countdown-track"
                      cx="24" cy="24" r="22"
                      fill="none" strokeWidth="3"
                    />
                    <circle
                      className="dq-countdown-progress"
                      cx="24" cy="24" r="22"
                      fill="none" strokeWidth="3"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: `${circumference}`,
                        strokeDashoffset: `${dashOffset}`,
                      }}
                    />
                  </svg>
                  <span className="dq-countdown-number">{qrCountdown}</span>
                </div>
                <div className="dq-timer-info">
                  <span className="dq-timer-label">
                    <span className="material-icon">autorenew</span>
                    Auto-refreshing
                  </span>
                  <span className="dq-timer-sub">
                    New QR every {QR_REFRESH_INTERVAL}s
                  </span>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="dq-controls">
              <button className="dq-btn dq-btn-download" onClick={downloadQR}>
                <span className="material-icon">download</span>
                Download
              </button>
            </div>
          </div>
        ) : (
          <div className="dq-no-qr">
            <div className="dq-no-qr-icon">
              <span className="material-icon">qr_code</span>
            </div>
            <h2 className="dq-no-qr-title">No QR code available</h2>
            <p className="dq-no-qr-desc">
              An admin needs to generate a QR code for this meeting first. Once generated, it will appear here automatically.
            </p>
          </div>
        )}
      </div>

      {/* ── Google color bar ─────────────────────── */}
      <div className="dq-google-bar">
        <span className="dq-gbar" style={{ background: '#4285F4' }} />
        <span className="dq-gbar" style={{ background: '#EA4335' }} />
        <span className="dq-gbar" style={{ background: '#FBBC05' }} />
        <span className="dq-gbar" style={{ background: '#34A853' }} />
      </div>
    </div>
  )
}

export default DisplayQR
