import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../../config/api'
import './ScanQR.css'

/**
 * ScanQR — Camera-based QR code scanner for offline meeting attendance.
 *
 * States:
 *   idle        → Waiting for camera permission
 *   scanning    → Camera active, looking for QR codes
 *   processing  → QR detected, sending to backend
 *   success     → Attendance marked successfully
 *   error       → Scan/API error (retryable)
 *   no-camera   → Camera permission denied or unavailable
 */
const ScanQR = () => {
  const navigate = useNavigate()

  const [state, setState] = useState('idle') // idle | scanning | processing | success | error | no-camera
  const [errorInfo, setErrorInfo] = useState({ title: '', message: '', type: 'error' })
  const [successData, setSuccessData] = useState(null)
  const [alreadyAttended, setAlreadyAttended] = useState(false)
  const [location, setLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('acquiring') // acquiring | acquired | denied

  const scannerRef = useRef(null)
  const processingRef = useRef(false)

  // ── Acquire geolocation ───────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied')
      return
    }

    setLocationStatus('acquiring')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setLocationStatus('acquired')
      },
      () => {
        setLocationStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [])

  // ── Start camera scanner ──────────────────────────
  const startScanner = useCallback(async () => {
    try {
      setState('idle')

      // Clean up previous instance
      if (scannerRef.current) {
        try {
          const s = scannerRef.current
          if (s.isScanning) await s.stop()
          await s.clear()
        } catch { /* ignore cleanup errors */ }
        scannerRef.current = null
      }

      const html5QrCode = new Html5Qrcode('sq-reader')
      scannerRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText) => handleScan(decodedText),
        () => {} // ignore scan failures (expected when no QR in frame)
      )

      setState('scanning')
    } catch (err) {
      console.error('Camera start error:', err)
      setState('no-camera')
    }
  }, [])

  // ── Cleanup on unmount ────────────────────────────
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          const s = scannerRef.current
          if (s.isScanning) s.stop().catch(() => {})
          s.clear().catch(() => {})
        } catch { /* ignore */ }
      }
    }
  }, [])

  // Auto-start scanner on mount
  useEffect(() => {
    // Small delay to let DOM render
    const timer = setTimeout(() => startScanner(), 200)
    return () => clearTimeout(timer)
  }, [startScanner])

  // ── Helper: get fresh location with timeout ──────
  const acquireLocation = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      )
    })
  }

  // ── Handle successful QR scan ─────────────────────
  const handleScan = async (qrData) => {
    // Prevent duplicate processing
    if (processingRef.current) return
    processingRef.current = true

    setState('processing')

    // Stop the scanner while processing
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
      }
    } catch { /* ignore */ }

    try {
      // Validate it's a JSON QR code (our format)
      let parsed
      try {
        parsed = JSON.parse(qrData)
      } catch {
        throw {
          data: {
            error: 'BadRequest',
            message: 'This QR code is not a valid meeting QR code. Please scan the QR displayed by the organizer.',
          },
        }
      }

      if (!parsed.meetingId || !parsed.token) {
        throw {
          data: {
            error: 'BadRequest',
            message: 'Invalid QR code format. Please scan the correct meeting QR code.',
          },
        }
      }

      // Get the best available location — use existing or acquire fresh
      let loc = location
      if (!loc && locationStatus !== 'denied') {
        loc = await acquireLocation()
        if (loc) {
          setLocation(loc)
          setLocationStatus('acquired')
        }
      }

      // Send to backend
      const payload = { qrData }
      if (loc) {
        payload.lat = loc.lat
        payload.lng = loc.lng
        payload.accuracy = loc.accuracy
      }

      const data = await api.post('/attendance/scan-qr', payload)

      if (data.success) {
        setSuccessData(data.data.meeting)
        setAlreadyAttended(data.data.alreadyAttended)
        setState('success')
      }
    } catch (err) {
      console.error('QR attendance error:', err)

      const errData = err.data || err
      const errCode = errData?.error || ''
      const errMessage = errData?.message || err.message || 'Something went wrong. Please try again.'

      let errTitle = 'Scan Failed'
      let errType = 'error'

      if (errCode === 'ExpiredQR') {
        errTitle = 'QR Code Expired'
        errType = 'warn'
      } else if (errCode === 'TooEarly') {
        errTitle = 'Meeting Not Started'
        errType = 'warn'
      } else if (errCode === 'MeetingEnded') {
        errTitle = 'Meeting Ended'
        errType = 'warn'
      } else if (errCode === 'OutOfRange') {
        errTitle = 'Outside Geofence'
        errType = 'warn'
      } else if (errCode === 'LocationRequired') {
        errTitle = 'Location Access Needed'
        errType = 'warn'
      } else if (errCode === 'Forbidden') {
        errTitle = 'Access Denied'
        errType = 'error'
      } else if (errCode === 'NotFound') {
        errTitle = 'Meeting Not Found'
        errType = 'error'
      } else if (errCode === 'BadRequest') {
        errTitle = 'Invalid QR Code'
        errType = 'warn'
      }

      setErrorInfo({ title: errTitle, message: errMessage, type: errType })
      setState('error')
    } finally {
      processingRef.current = false
    }
  }

  // ── Retry scan ────────────────────────────────────
  const handleRetry = () => {
    setErrorInfo({ title: '', message: '', type: 'error' })
    setState('idle')
    setTimeout(() => startScanner(), 200)
  }

  // ── Helpers ───────────────────────────────────────
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
        {/* Header */}
        <div className="sq-header">
          <div className="sq-header-icon">
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </div>
          <h1 className="sq-title">Scan QR Code</h1>
          <p className="sq-subtitle">Point your camera at the meeting QR code</p>
        </div>

        {/* Scanner Card */}
        <div className="sq-card">
          {/* ── Active Scanner ──────────────────── */}
          {(state === 'idle' || state === 'scanning' || state === 'processing') && (
            <>
              <div className="sq-scanner-wrap">
                <div id="sq-reader" />
                {state === 'scanning' && (
                  <div className="sq-scanner-overlay">
                    <div className="sq-corner sq-corner-tl" />
                    <div className="sq-corner sq-corner-tr" />
                    <div className="sq-corner sq-corner-bl" />
                    <div className="sq-corner sq-corner-br" />
                    <div className="sq-scan-line" />
                  </div>
                )}
              </div>

              <div className={`sq-status-bar ${state === 'scanning' ? 'sq-status-scanning' : ''} ${state === 'processing' ? 'sq-status-processing' : ''}`}>
                {state === 'idle' && (
                  <>
                    <span className="material-symbols-outlined">photo_camera</span>
                    Starting camera…
                  </>
                )}
                {state === 'scanning' && (
                  <>
                    <span className="material-symbols-outlined">search</span>
                    Looking for QR code…
                  </>
                )}
                {state === 'processing' && (
                  <>
                    <span className="material-symbols-outlined">hourglass_top</span>
                    Marking attendance…
                  </>
                )}
              </div>

              {/* Location status */}
              <div className={`sq-location-bar ${locationStatus === 'acquiring' ? 'sq-location-acquiring' : ''}`}>
                <span className="material-symbols-outlined">
                  {locationStatus === 'acquired' ? 'my_location' : locationStatus === 'acquiring' ? 'location_searching' : 'location_disabled'}
                </span>
                {locationStatus === 'acquired' && `Location captured (±${Math.round(location?.accuracy || 0)}m)`}
                {locationStatus === 'acquiring' && 'Acquiring location…'}
                {locationStatus === 'denied' && 'Location unavailable — some meetings may require it'}
              </div>
            </>
          )}

          {/* ── Camera Permission Denied ───────── */}
          {state === 'no-camera' && (
            <div className="sq-state">
              <div className="sq-state-icon sq-state-icon-camera">
                <span className="material-symbols-outlined">no_photography</span>
              </div>
              <h3 className="sq-state-title">Camera Access Required</h3>
              <p className="sq-state-desc">
                Please allow camera access to scan QR codes.
                Check your browser settings and make sure camera permissions are enabled.
              </p>
              <button className="sq-btn sq-btn-primary" onClick={handleRetry}>
                <span className="material-symbols-outlined">refresh</span>
                Try Again
              </button>
            </div>
          )}

          {/* ── Success State ──────────────────── */}
          {state === 'success' && (
            <div className="sq-success-card">
              <div className="sq-success-icon">
                <span className="material-symbols-outlined">check_circle</span>
              </div>

              {alreadyAttended && (
                <div className="sq-already-badge">
                  <span className="material-symbols-outlined">info</span>
                  Already recorded
                </div>
              )}

              <h2 className="sq-success-title">
                {alreadyAttended ? 'Attendance Already Recorded' : 'Attendance Marked!'}
              </h2>
              <p className="sq-success-msg">
                {alreadyAttended
                  ? 'Your attendance for this meeting was already recorded earlier.'
                  : 'Your attendance has been successfully recorded.'}
              </p>

              {successData && (
                <div className="sq-meeting-card">
                  <div className="sq-meeting-title">
                    <span className="material-symbols-outlined">event</span>
                    {successData.title}
                  </div>
                  <div className="sq-meeting-details">
                    <div className="sq-meeting-detail">
                      <span className="material-symbols-outlined">calendar_today</span>
                      {formatDate(successData.dateTime)}
                    </div>
                    <div className="sq-meeting-detail">
                      <span className="material-symbols-outlined">schedule</span>
                      {formatTime(successData.dateTime)} · {successData.duration} min
                    </div>
                    {successData.location && (
                      <div className="sq-meeting-detail">
                        <span className="material-symbols-outlined">location_on</span>
                        {successData.location}
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
                <button className="sq-btn sq-btn-secondary" onClick={handleRetry}>
                  <span className="material-symbols-outlined">qr_code_scanner</span>
                  Scan Another
                </button>
              </div>
            </div>
          )}

          {/* ── Error State ────────────────────── */}
          {state === 'error' && (
            <div className="sq-error-card">
              <div className={`sq-error-icon ${errorInfo.type === 'warn' ? 'sq-error-icon-warn' : ''}`}>
                <span className="material-symbols-outlined">
                  {errorInfo.type === 'warn' ? 'warning' : 'error'}
                </span>
              </div>
              <h2 className="sq-error-title">{errorInfo.title}</h2>
              <p className="sq-error-msg">{errorInfo.message}</p>
              <div className="sq-error-actions">
                <button className="sq-btn sq-btn-primary" onClick={handleRetry}>
                  <span className="material-symbols-outlined">qr_code_scanner</span>
                  Scan Again
                </button>
                <button className="sq-btn sq-btn-secondary" onClick={() => navigate('/dashboard')}>
                  <span className="material-symbols-outlined">home</span>
                  Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Google color bar */}
        <div className="sq-google-bar">
          <span style={{ background: '#4285F4' }} />
          <span style={{ background: '#EA4335' }} />
          <span style={{ background: '#FBBC05' }} />
          <span style={{ background: '#34A853' }} />
        </div>

        {/* Hint */}
        {(state === 'scanning' || state === 'idle') && (
          <div className="sq-hint">
            <span className="material-symbols-outlined">lightbulb</span>
            Hold your phone steady and make sure the QR code is well-lit. The code refreshes every 20 seconds — scan the latest one.
          </div>
        )}
      </div>
    </div>
  )
}

export default ScanQR
