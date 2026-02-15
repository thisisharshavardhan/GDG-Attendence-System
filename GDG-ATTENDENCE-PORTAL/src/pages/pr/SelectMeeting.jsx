import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../config/api'
import './SelectMeeting.css'

const SelectMeeting = () => {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchActiveMeetings = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.get('/meetings/active')
      if (data.success) {
        setMeetings(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch active meetings:', err)
      setError(err.data?.message || 'Failed to load active meetings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActiveMeetings()
  }, [])

  // ── Helpers ────────────────────────────────────────
  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
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

  // ── Meeting status based on time window ────────────
  const getMeetingStatus = (meeting) => {
    const now = new Date()
    const start = new Date(meeting.dateTime)
    const end = new Date(start.getTime() + (meeting.duration || 60) * 60000)
    if (now < start) return 'upcoming'
    if (now >= end) return 'ended'
    return 'live'
  }

  const getTimeUntil = (meeting) => {
    const now = new Date()
    const start = new Date(meeting.dateTime)
    const diff = start - now
    if (diff <= 0) return null
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Starts in ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Starts in ${hrs}h ${mins % 60}m`
    const days = Math.floor(hrs / 24)
    return `Starts in ${days}d`
  }

  const handleSelect = (meeting) => {
    if (meeting.type === 'online') {
      navigate(`/pr/display-link/${meeting._id}`)
    } else {
      navigate(`/pr/display-qr/${meeting._id}`)
    }
  }

  return (
    <div className="sm-page">
      {/* Header */}
      <div className="sm-header">
        <h1 className="sm-title">
          <span className="material-icon">playlist_add_check</span>
          Select Meeting
        </h1>
        <p className="sm-subtitle">
          Active meetings are shown below. Meetings go live automatically based on their scheduled time.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="sm-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="sm-skeleton-card" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="sm-error">
          <span className="material-icon">error</span>
          <span>{error}</span>
          <button className="sm-retry-btn" onClick={fetchActiveMeetings}>
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && meetings.length === 0 && (
        <div className="sm-empty">
          <div className="sm-empty-icon">
            <span className="material-icon">event_busy</span>
          </div>
          <h2 className="sm-empty-title">No active meetings</h2>
          <p className="sm-empty-desc">
            There are no active meetings right now. Ask an admin to activate a meeting and generate its QR code.
          </p>
        </div>
      )}

      {/* Meeting list */}
      {!loading && !error && meetings.length > 0 && (
        <div className="sm-list">
          {meetings.map((meeting) => (
            <button
              key={meeting._id}
              className="sm-card"
              onClick={() => handleSelect(meeting)}
            >
              <div
                className="sm-card-icon"
                style={{
                  background: meeting.type === 'online' ? '#e8f0fe' : '#e6f4ea',
                  color: meeting.type === 'online' ? '#1967d2' : '#137333',
                }}
              >
                <span className="material-icon">
                  {meeting.type === 'online' ? 'videocam' : 'groups'}
                </span>
              </div>

              <div className="sm-card-body">
                <h3 className="sm-card-title">{meeting.title}</h3>
                <div className="sm-card-meta">
                  <span className="sm-card-meta-item">
                    <span className="material-icon">calendar_today</span>
                    {formatDate(meeting.dateTime)}
                  </span>
                  <span className="sm-card-meta-item">
                    <span className="material-icon">schedule</span>
                    {formatTime(meeting.dateTime)}
                  </span>
                  {meeting.type === 'offline' && meeting.location && (
                    <span className="sm-card-meta-item">
                      <span className="material-icon">location_on</span>
                      {meeting.location}
                    </span>
                  )}
                  {meeting.duration && (
                    <span className="sm-card-meta-item">
                      <span className="material-icon">timer</span>
                      {meeting.duration} min
                    </span>
                  )}
                </div>
              </div>

              <div className="sm-card-right">
                <span className={`sm-type-pill sm-type-${meeting.type}`}>
                  {meeting.type === 'online' ? 'Online' : 'Offline'}
                </span>
                {(() => {
                  const status = getMeetingStatus(meeting)
                  const timeUntil = getTimeUntil(meeting)
                  return (
                    <span className={`sm-status-badge sm-status-${status}`}>
                      {status === 'live' && <span className="sm-live-dot" />}
                      <span className="material-icon" style={{ fontSize: '13px' }}>
                        {status === 'live' ? 'sensors' : status === 'upcoming' ? 'schedule' : 'event_available'}
                      </span>
                      {status === 'live' ? 'Live Now' : status === 'upcoming' ? (timeUntil || 'Upcoming') : 'Ended'}
                    </span>
                  )
                })()}
                <svg
                  className="sm-card-arrow"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SelectMeeting
