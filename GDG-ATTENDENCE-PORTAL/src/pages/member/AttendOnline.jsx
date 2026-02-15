import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../config/api'
import './AttendOnline.css'

const AttendOnline = () => {
  const { token } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [meeting, setMeeting] = useState(null)
  const [status, setStatus] = useState(null)       // 'live' | 'upcoming' | 'ended'
  const [alreadyAttended, setAlreadyAttended] = useState(false)
  const [marking, setMarking] = useState(false)
  const [marked, setMarked] = useState(false)
  const [meetingLink, setMeetingLink] = useState('')

  // ── Fetch meeting info ────────────────────────────
  const fetchMeetingInfo = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.get(`/attendance/${token}`)
      if (data.success) {
        setMeeting(data.data.meeting)
        setStatus(data.data.status)
        setAlreadyAttended(data.data.alreadyAttended)
        setMeetingLink(data.data.meeting.meetingLink || '')
      }
    } catch (err) {
      console.error('Failed to fetch attendance page:', err)
      setError(err.data?.message || err.message || 'Failed to load meeting info.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchMeetingInfo()
  }, [fetchMeetingInfo])

  // Periodically re-check status while upcoming
  useEffect(() => {
    if (status !== 'upcoming') return
    const interval = setInterval(fetchMeetingInfo, 30000)
    return () => clearInterval(interval)
  }, [status, fetchMeetingInfo])

  // ── Mark attendance + open Meet ───────────────────
  const handleJoinMeeting = async () => {
    try {
      setMarking(true)

      // Capture geolocation before marking
      let locationPayload = {}
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            })
          )
          locationPayload = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }
        } catch (geoErr) {
          // Location denied / unavailable — continue without it
          console.warn('Geolocation not available:', geoErr.message)
        }
      }

      const data = await api.post(`/attendance/${token}/mark`, locationPayload)

      if (data.success) {
        setMarked(true)
        setAlreadyAttended(true)
        const link = data.data.meetingLink

        if (link) {
          // Open Google Meet in new tab
          window.open(link, '_blank', 'noopener,noreferrer')
          setMeetingLink(link)
        }
      }
    } catch (err) {
      console.error('Failed to mark attendance:', err)
      setError(err.data?.message || err.message || 'Failed to mark attendance.')
    } finally {
      setMarking(false)
    }
  }

  // ── Helpers ───────────────────────────────────────
  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
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

  const getTimeUntil = () => {
    if (!meeting) return ''
    const now = new Date()
    const start = new Date(meeting.dateTime)
    const diff = start - now
    if (diff <= 0) return ''
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Starts in ${mins} minute${mins !== 1 ? 's' : ''}`
    const hrs = Math.floor(mins / 60)
    const remainMins = mins % 60
    if (hrs < 24) return `Starts in ${hrs}h ${remainMins}m`
    const days = Math.floor(hrs / 24)
    return `Starts in ${days} day${days !== 1 ? 's' : ''}`
  }

  const getEndTime = () => {
    if (!meeting) return ''
    const start = new Date(meeting.dateTime)
    const end = new Date(start.getTime() + (meeting.duration || 60) * 60000)
    return end.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  // ── Loading ───────────────────────────────────────
  if (loading) {
    return (
      <div className="ao-page">
        <div className="ao-center">
          <div className="ao-spinner" />
          <p className="ao-loading-text">Loading meeting info…</p>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────
  if (error && !meeting) {
    return (
      <div className="ao-page">
        <div className="ao-center">
          <div className="ao-error-card">
            <div className="ao-error-icon">
              <span className="material-icon">link_off</span>
            </div>
            <h2 className="ao-error-title">Invalid Link</h2>
            <p className="ao-error-desc">{error}</p>
            <button className="ao-btn ao-btn-secondary" onClick={() => navigate('/dashboard')}>
              <span className="material-icon">home</span>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!meeting) return null

  // ── Success state (after marking) ─────────────────
  if (marked) {
    return (
      <div className="ao-page">
        <div className="ao-center">
          <div className="ao-success-card">
            <div className="ao-success-icon">
              <span className="material-icon">check_circle</span>
            </div>
            <h2 className="ao-success-title">Attendance Marked!</h2>
            <p className="ao-success-desc">
              Your attendance for <strong>{meeting.title}</strong> has been recorded successfully.
            </p>
            {meetingLink && (
              <a
                href={meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="ao-btn ao-btn-meet"
              >
                <span className="material-icon">videocam</span>
                Open Google Meet
              </a>
            )}
            <button className="ao-btn ao-btn-secondary ao-btn-small" onClick={() => navigate('/dashboard')}>
              <span className="material-icon">home</span>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ao-page">
      <div className="ao-container">
        {/* Meeting Card */}
        <div className="ao-card">
          {/* Status banner */}
          <div className={`ao-status-banner ao-status-${status}`}>
            {status === 'live' && (
              <>
                <span className="ao-live-dot" />
                <span className="material-icon">sensors</span>
                Meeting is Live
              </>
            )}
            {status === 'upcoming' && (
              <>
                <span className="material-icon">schedule</span>
                {getTimeUntil()}
              </>
            )}
            {status === 'ended' && (
              <>
                <span className="material-icon">event_available</span>
                Meeting has Ended
              </>
            )}
          </div>

          {/* Meeting info */}
          <div className="ao-card-body">
            <div className="ao-meeting-header">
              <div className="ao-meeting-icon">
                <span className="material-icon">videocam</span>
              </div>
              <div>
                <h1 className="ao-meeting-title">{meeting.title}</h1>
                <span className="ao-type-pill">
                  <span className="material-icon">videocam</span>
                  Online Meeting
                </span>
              </div>
            </div>

            {meeting.description && (
              <p className="ao-meeting-desc">{meeting.description}</p>
            )}

            <div className="ao-meeting-details">
              <div className="ao-detail-item">
                <span className="material-icon">calendar_today</span>
                <span>{formatDate(meeting.dateTime)}</span>
              </div>
              <div className="ao-detail-item">
                <span className="material-icon">schedule</span>
                <span>{formatTime(meeting.dateTime)} – {getEndTime()}</span>
              </div>
              <div className="ao-detail-item">
                <span className="material-icon">timer</span>
                <span>{meeting.duration} minutes</span>
              </div>
              {meeting.createdBy?.name && (
                <div className="ao-detail-item">
                  <span className="material-icon">person</span>
                  <span>Organized by {meeting.createdBy.name}</span>
                </div>
              )}
            </div>

            {/* Error display */}
            {error && (
              <div className="ao-inline-error">
                <span className="material-icon">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Already attended notice */}
            {alreadyAttended && !marked && (
              <div className="ao-attended-notice">
                <span className="material-icon">check_circle</span>
                <div>
                  <strong>Attendance already recorded</strong>
                  <p>You have already marked your attendance for this meeting.</p>
                </div>
              </div>
            )}

            {/* Action area */}
            <div className="ao-actions">
              {status === 'live' && !alreadyAttended && (
                <button
                  className="ao-btn ao-btn-join"
                  onClick={handleJoinMeeting}
                  disabled={marking}
                >
                  {marking ? (
                    <>
                      <span className="ao-btn-spinner" />
                      Marking Attendance…
                    </>
                  ) : (
                    <>
                      <span className="material-icon">login</span>
                      Join Meeting &amp; Mark Attendance
                    </>
                  )}
                </button>
              )}

              {status === 'live' && alreadyAttended && meetingLink && (
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ao-btn ao-btn-meet"
                >
                  <span className="material-icon">videocam</span>
                  Rejoin Google Meet
                </a>
              )}

              {status === 'upcoming' && (
                <div className="ao-upcoming-notice">
                  <span className="material-icon">info</span>
                  <p>You'll be able to join and mark attendance once the meeting starts.</p>
                </div>
              )}

              {status === 'ended' && !alreadyAttended && (
                <div className="ao-ended-notice">
                  <span className="material-icon">event_busy</span>
                  <p>This meeting has ended. Attendance can no longer be marked.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Google color bar */}
        <div className="ao-google-bar">
          <span style={{ background: '#4285F4' }} />
          <span style={{ background: '#EA4335' }} />
          <span style={{ background: '#FBBC05' }} />
          <span style={{ background: '#34A853' }} />
        </div>
      </div>
    </div>
  )
}

export default AttendOnline
