import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../config/api'
import './DisplayLink.css'

const DisplayLink = () => {
  const { meetingId } = useParams()
  const navigate = useNavigate()

  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

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

  // ── Generate attendance link ──────────────────────
  const handleGenerate = async () => {
    try {
      setGenerating(true)
      const data = await api.post(`/meetings/${meetingId}/generate-attendance-link`)
      if (data.success) {
        setMeeting((prev) => ({
          ...prev,
          attendanceToken: data.data.attendanceToken,
        }))
      }
    } catch (err) {
      console.error('Generate attendance link failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  // ── Copy link ─────────────────────────────────────
  const getAttendanceUrl = () => {
    if (!meeting?.attendanceToken) return ''
    return `${window.location.origin}/attend/${meeting.attendanceToken}`
  }

  const handleCopy = async () => {
    const url = getAttendanceUrl()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Fallback
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
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

  const getMeetingStatus = () => {
    if (!meeting) return 'upcoming'
    const now = new Date()
    const start = new Date(meeting.dateTime)
    const end = new Date(start.getTime() + (meeting.duration || 60) * 60000)
    if (now < start) return 'upcoming'
    if (now >= end) return 'ended'
    return 'live'
  }

  // ── Loading state ──────────────────────────────────
  if (loading) {
    return (
      <div className="dl-center">
        <div className="dl-spinner" />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────
  if (error || !meeting) {
    return (
      <div className="dl-center">
        <div className="dl-load-error">
          <div className="dl-load-error-icon">
            <span className="material-icon">error</span>
          </div>
          <h2 className="dl-load-error-title">
            {error || 'Meeting not found'}
          </h2>
          <p className="dl-load-error-desc">
            Unable to load this meeting. It may have been deleted or you may not have access.
          </p>
          <button className="dl-load-error-btn" onClick={() => navigate('/pr/select-meeting')}>
            <span className="material-icon" style={{ fontSize: '18px' }}>arrow_back</span>
            Back to meetings
          </button>
        </div>
      </div>
    )
  }

  const status = getMeetingStatus()
  const attendanceUrl = getAttendanceUrl()

  return (
    <div className="dl-page">
      {/* ── Top bar ──────────────────────────────── */}
      <div className="dl-topbar">
        <div className="dl-topbar-left">
          <button
            className="dl-back-btn"
            onClick={() => navigate('/pr/select-meeting')}
            title="Back to meeting list"
          >
            <span className="material-icon">arrow_back</span>
          </button>
          <div className="dl-meeting-info">
            <h2 className="dl-meeting-title">{meeting.title}</h2>
            <div className="dl-meeting-meta">
              <span className="dl-meta-item">
                <span className="material-icon">calendar_today</span>
                {formatDate(meeting.dateTime)}
              </span>
              <span className="dl-meta-item">
                <span className="material-icon">schedule</span>
                {formatTime(meeting.dateTime)}
              </span>
            </div>
          </div>
        </div>

        <div className="dl-topbar-right">
          <span className="dl-type-pill">
            <span className="material-icon" style={{ fontSize: '13px' }}>videocam</span>
            Online
          </span>
          <span className={`dl-status-badge dl-status-${status}`}>
            {status === 'live' && <span className="dl-live-dot" />}
            {status === 'live' ? 'Live' : status === 'upcoming' ? 'Upcoming' : 'Ended'}
          </span>
        </div>
      </div>

      {/* ── Main content ─────────────────────────── */}
      <div className="dl-main">
        {attendanceUrl ? (
          <div className="dl-link-container">
            <div className="dl-link-icon-wrap">
              <span className="material-icon">link</span>
            </div>

            <h3 className="dl-link-heading">Attendance Link</h3>
            <p className="dl-link-desc">
              Share this link with members. When they open it and click "Join Meeting", their attendance will be automatically recorded.
            </p>

            <div className="dl-link-box">
              <span className="dl-link-url">{attendanceUrl}</span>
            </div>

            <div className="dl-link-actions">
              <button
                className={`dl-btn dl-btn-primary ${copied ? 'dl-btn-copied' : ''}`}
                onClick={handleCopy}
              >
                <span className="material-icon">
                  {copied ? 'check' : 'content_copy'}
                </span>
                {copied ? 'Link Copied!' : 'Copy Link'}
              </button>
              <button
                className="dl-btn dl-btn-secondary"
                onClick={handleGenerate}
                disabled={generating}
              >
                <span className="material-icon">refresh</span>
                {generating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>

            {meeting.meetingLink && (
              <div className="dl-meet-link">
                <span className="material-icon">videocam</span>
                <span>Meet link:</span>
                <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer">
                  {meeting.meetingLink}
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="dl-no-link">
            <div className="dl-no-link-icon">
              <span className="material-icon">add_link</span>
            </div>
            <h2 className="dl-no-link-title">No attendance link generated</h2>
            <p className="dl-no-link-desc">
              Generate an attendance link for members to join and mark their attendance.
            </p>
            <button
              className="dl-btn dl-btn-primary"
              onClick={handleGenerate}
              disabled={generating}
            >
              <span className="material-icon">add_link</span>
              {generating ? 'Generating…' : 'Generate Attendance Link'}
            </button>
          </div>
        )}
      </div>

      {/* ── Google color bar ─────────────────────── */}
      <div className="dl-google-bar">
        <span className="dl-gbar" style={{ background: '#4285F4' }} />
        <span className="dl-gbar" style={{ background: '#EA4335' }} />
        <span className="dl-gbar" style={{ background: '#FBBC05' }} />
        <span className="dl-gbar" style={{ background: '#34A853' }} />
      </div>
    </div>
  )
}

export default DisplayLink
