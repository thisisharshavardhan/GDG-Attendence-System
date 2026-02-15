import { useState, useEffect, useCallback } from 'react'
import api from '../../config/api'
import { auth } from '../../config/firebase'
import './Reports.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const Reports = () => {
  const [tab, setTab] = useState('meetings') // 'meetings' | 'members'
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── Meetings tab state ────────────────────────────
  const [meetings, setMeetings] = useState([])
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [meetingsPage, setMeetingsPage] = useState(1)
  const [meetingsTotalPages, setMeetingsTotalPages] = useState(1)
  const [meetingsSearch, setMeetingsSearch] = useState('')

  // ── Members tab state ─────────────────────────────
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)

  // ── Detail modal state ────────────────────────────
  const [detailMeeting, setDetailMeeting] = useState(null)
  const [detailRecords, setDetailRecords] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  // ── Exporting ─────────────────────────────────────
  const [exporting, setExporting] = useState(false)
  const [exportingMeeting, setExportingMeeting] = useState(false)

  // ── Fetch summary ─────────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true)
      setError(null)
      const data = await api.get('/reports/summary')
      if (data.success) setSummary(data.data)
    } catch (err) {
      console.error('Summary error:', err)
      setError(err.data?.message || err.message || 'Failed to load summary.')
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  // ── Fetch meetings report ─────────────────────────
  const fetchMeetings = useCallback(async () => {
    try {
      setMeetingsLoading(true)
      const data = await api.get(
        `/reports/meetings?page=${meetingsPage}&limit=15&search=${encodeURIComponent(meetingsSearch)}`
      )
      if (data.success) {
        setMeetings(data.data)
        setMeetingsTotalPages(data.totalPages || 1)
      }
    } catch (err) {
      console.error('Meetings report error:', err)
    } finally {
      setMeetingsLoading(false)
    }
  }, [meetingsPage, meetingsSearch])

  useEffect(() => {
    if (tab === 'meetings') fetchMeetings()
  }, [tab, fetchMeetings])

  // ── Fetch members report ──────────────────────────
  const fetchMembers = useCallback(async () => {
    try {
      setMembersLoading(true)
      const data = await api.get('/reports/members')
      if (data.success) setMembers(data.data)
    } catch (err) {
      console.error('Members report error:', err)
    } finally {
      setMembersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'members') fetchMembers()
  }, [tab, fetchMembers])

  // ── Fetch meeting detail ──────────────────────────
  const openDetail = async (meetingId) => {
    try {
      setDetailLoading(true)
      setDetailMeeting(null)
      setDetailRecords([])
      const data = await api.get(`/reports/meeting/${meetingId}`)
      if (data.success) {
        setDetailMeeting(data.data.meeting)
        setDetailRecords(data.data.attendance)
      }
    } catch (err) {
      console.error('Detail error:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailMeeting(null)
    setDetailRecords([])
  }

  // ── CSV Export ────────────────────────────────────
  const handleExport = async () => {
    try {
      setExporting(true)
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`${API_BASE_URL}/reports/export/csv`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance-report-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  // ── Single Meeting CSV Export ─────────────────────
  const handleMeetingExport = async (meetingId) => {
    try {
      setExportingMeeting(true)
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`${API_BASE_URL}/reports/meeting/${meetingId}/export/csv`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `meeting-report-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Meeting export error:', err)
    } finally {
      setExportingMeeting(false)
    }
  }

  // ── Helpers ───────────────────────────────────────
  const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const formatDateTime = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  // ── Debounce search ───────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setMeetingsPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [meetingsSearch])

  return (
    <div className="rp-page">
      {/* Header */}
      <div className="rp-header">
        <div className="rp-header-icon">
          <span className="material-symbols-outlined">assessment</span>
        </div>
        <div className="rp-header-text">
          <h1 className="rp-title">Attendance Reports</h1>
          <p className="rp-subtitle">View analytics, track attendance, and export data</p>
        </div>
        <button
          className="rp-export-btn"
          onClick={handleExport}
          disabled={exporting}
        >
          <span className="material-symbols-outlined">
            {exporting ? 'hourglass_empty' : 'download'}
          </span>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rp-error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button className="rp-error-retry" onClick={fetchSummary}>Retry</button>
        </div>
      )}

      {/* Summary Cards */}
      {summaryLoading ? (
        <div className="rp-loading">
          <div className="rp-loading-dots">
            <span /><span /><span /><span />
          </div>
        </div>
      ) : summary && (
        <div className="rp-summary">
          <div className="rp-card">
            <div className="rp-card-icon rp-card-icon-blue">
              <span className="material-symbols-outlined">event</span>
            </div>
            <div className="rp-card-info">
              <div className="rp-card-value">{summary.totalMeetings}</div>
              <div className="rp-card-label">Total Meetings</div>
            </div>
          </div>
          <div className="rp-card">
            <div className="rp-card-icon rp-card-icon-green">
              <span className="material-symbols-outlined">how_to_reg</span>
            </div>
            <div className="rp-card-info">
              <div className="rp-card-value">{summary.totalAttendance}</div>
              <div className="rp-card-label">Total Attendance</div>
            </div>
          </div>
          <div className="rp-card">
            <div className="rp-card-icon rp-card-icon-yellow">
              <span className="material-symbols-outlined">trending_up</span>
            </div>
            <div className="rp-card-info">
              <div className="rp-card-value">{summary.avgAttendance}</div>
              <div className="rp-card-label">Avg per Meeting</div>
            </div>
          </div>
          <div className="rp-card">
            <div className="rp-card-icon rp-card-icon-purple">
              <span className="material-symbols-outlined">group</span>
            </div>
            <div className="rp-card-info">
              <div className="rp-card-value">{summary.totalMembers}</div>
              <div className="rp-card-label">Total Members</div>
            </div>
          </div>
          <div className="rp-card">
            <div className="rp-card-icon rp-card-icon-red">
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </div>
            <div className="rp-card-info">
              <div className="rp-card-value">{summary.methods?.qr || 0}</div>
              <div className="rp-card-label">Via QR Code</div>
            </div>
          </div>
          <div className="rp-card">
            <div className="rp-card-icon rp-card-icon-teal">
              <span className="material-symbols-outlined">link</span>
            </div>
            <div className="rp-card-info">
              <div className="rp-card-value">{summary.methods?.link || 0}</div>
              <div className="rp-card-label">Via Link</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="rp-tabs">
        <button
          className={`rp-tab ${tab === 'meetings' ? 'rp-tab-active' : ''}`}
          onClick={() => setTab('meetings')}
        >
          <span className="material-symbols-outlined">event</span>
          Meetings
        </button>
        <button
          className={`rp-tab ${tab === 'members' ? 'rp-tab-active' : ''}`}
          onClick={() => setTab('members')}
        >
          <span className="material-symbols-outlined">group</span>
          Members
        </button>
      </div>

      {/* ── Meetings Tab ─────────────────────────────── */}
      {tab === 'meetings' && (
        <div className="rp-table-card">
          <div className="rp-toolbar">
            <div className="rp-search">
              <span className="material-symbols-outlined rp-search-icon">search</span>
              <input
                className="rp-search-input"
                type="text"
                placeholder="Search meetings…"
                value={meetingsSearch}
                onChange={(e) => setMeetingsSearch(e.target.value)}
              />
            </div>
          </div>

          {meetingsLoading ? (
            <div className="rp-loading">
              <div className="rp-loading-dots">
                <span /><span /><span /><span />
              </div>
            </div>
          ) : meetings.length === 0 ? (
            <div className="rp-empty">
              <span className="material-symbols-outlined rp-empty-icon">event_busy</span>
              <p className="rp-empty-title">No meetings found</p>
              <p className="rp-empty-sub">
                {meetingsSearch ? 'Try a different search term.' : 'Create your first meeting to see reports.'}
              </p>
            </div>
          ) : (
            <>
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>Meeting</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Attendance</th>
                    <th style={{ textAlign: 'right', paddingRight: 24 }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((m) => (
                    <tr key={m._id} onClick={() => openDetail(m._id)}>
                      <td>
                        <div className="rp-meeting-info">
                          <div className={`rp-meeting-icon rp-meeting-icon-${m.type}`}>
                            <span className="material-symbols-outlined">
                              {m.type === 'online' ? 'videocam' : 'location_on'}
                            </span>
                          </div>
                          <div>
                            <div className="rp-meeting-name">{m.title}</div>
                            {m.location && <div className="rp-meeting-sub">{m.location}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`rp-type-pill rp-type-${m.type}`}>
                          {m.type === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="rp-date">{formatDate(m.dateTime)}</td>
                      <td>
                        <span className="rp-count">
                          <span className="material-symbols-outlined">people</span>
                          {m.attendanceCount}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: 24 }}>
                        <button
                          className="rp-view-btn"
                          onClick={(e) => { e.stopPropagation(); openDetail(m._id) }}
                        >
                          <span className="material-symbols-outlined">visibility</span>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {meetingsTotalPages > 1 && (
                <div className="rp-pagination">
                  <button
                    className="rp-page-btn"
                    onClick={() => setMeetingsPage((p) => p - 1)}
                    disabled={meetingsPage <= 1}
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                    Previous
                  </button>
                  <span className="rp-page-info">
                    <strong>{meetingsPage}</strong> / {meetingsTotalPages}
                  </span>
                  <button
                    className="rp-page-btn"
                    onClick={() => setMeetingsPage((p) => p + 1)}
                    disabled={meetingsPage >= meetingsTotalPages}
                  >
                    Next
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Members Tab ──────────────────────────────── */}
      {tab === 'members' && (
        <div className="rp-table-card">
          {membersLoading ? (
            <div className="rp-loading">
              <div className="rp-loading-dots">
                <span /><span /><span /><span />
              </div>
            </div>
          ) : members.length === 0 ? (
            <div className="rp-empty">
              <span className="material-symbols-outlined rp-empty-icon">group_off</span>
              <p className="rp-empty-title">No attendance data</p>
              <p className="rp-empty-sub">Attendance records will appear here after members attend meetings.</p>
            </div>
          ) : (
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Meetings Attended</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId}>
                    <td>
                      <div className="rp-member-info">
                        {m.photoURL ? (
                          <img className="rp-avatar" src={m.photoURL} alt={m.name} />
                        ) : (
                          <div className="rp-avatar-placeholder">{getInitials(m.name)}</div>
                        )}
                        <div>
                          <div className="rp-member-name">{m.name}</div>
                          <div className="rp-member-email">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`rp-role-pill rp-role-${m.role}`}>{m.role}</span>
                    </td>
                    <td>
                      <span className="rp-count">
                        <span className="material-symbols-outlined">event_available</span>
                        {m.totalAttended}
                      </span>
                    </td>
                    <td className="rp-date">{formatDate(m.lastAttended)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────── */}
      {(detailMeeting || detailLoading) && (
        <div className="rp-modal-overlay" onClick={closeDetail}>
          <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="rp-loading" style={{ padding: '60px 0' }}>
                <div className="rp-loading-dots">
                  <span /><span /><span /><span />
                </div>
              </div>
            ) : detailMeeting && (
              <>
                <div className="rp-modal-header">
                  <h2 className="rp-modal-title">
                    <span className="material-symbols-outlined">assessment</span>
                    {detailMeeting.title}
                  </h2>
                  <button className="rp-modal-close" onClick={closeDetail}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="rp-modal-meta">
                  <div className="rp-meta-item">
                    <span className="material-symbols-outlined">calendar_today</span>
                    {formatDate(detailMeeting.dateTime)}
                  </div>
                  <div className="rp-meta-item">
                    <span className="material-symbols-outlined">schedule</span>
                    {formatTime(detailMeeting.dateTime)} · {detailMeeting.duration} min
                  </div>
                  <div className="rp-meta-item">
                    <span className="material-symbols-outlined">
                      {detailMeeting.type === 'online' ? 'videocam' : 'location_on'}
                    </span>
                    {detailMeeting.type === 'online' ? 'Online' : detailMeeting.location || 'Offline'}
                  </div>
                  {detailMeeting.geofencing?.enabled && (
                    <div className="rp-meta-item">
                      <span className="material-symbols-outlined">my_location</span>
                      Geofencing enabled ({detailMeeting.geofencing.radius}m)
                    </div>
                  )}
                </div>

                <div className="rp-modal-body">
                  {detailRecords.length === 0 ? (
                    <div className="rp-empty">
                      <span className="material-symbols-outlined rp-empty-icon">person_off</span>
                      <p className="rp-empty-title">No attendance recorded</p>
                      <p className="rp-empty-sub">No one has marked attendance for this meeting yet.</p>
                    </div>
                  ) : (
                    <table className="rp-detail-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Member</th>
                          <th>Method</th>
                          <th>Time</th>
                          <th>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailRecords.map((r, i) => (
                          <tr key={r._id}>
                            <td style={{ color: '#80868b', width: 48 }}>{i + 1}</td>
                            <td>
                              <div className="rp-member-info">
                                {r.user?.photoURL ? (
                                  <img className="rp-avatar" src={r.user.photoURL} alt={r.user.name} />
                                ) : (
                                  <div className="rp-avatar-placeholder">
                                    {getInitials(r.user?.name)}
                                  </div>
                                )}
                                <div>
                                  <div className="rp-member-name">{r.user?.name || 'Unknown'}</div>
                                  <div className="rp-member-email">{r.user?.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`rp-method-pill rp-method-${r.method}`}>
                                {r.method === 'qr' ? 'QR' : 'Link'}
                              </span>
                            </td>
                            <td className="rp-date">{formatDateTime(r.markedAt)}</td>
                            <td>
                              {r.location?.lat != null ? (
                                <span className="rp-location-cell">
                                  <span className="material-symbols-outlined">location_on</span>
                                  {r.location.lat.toFixed(4)}, {r.location.lng.toFixed(4)}
                                </span>
                              ) : (
                                <span className="rp-no-location">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="rp-modal-footer">
                  <span className="rp-total-badge">
                    <span className="material-symbols-outlined">people</span>
                    {detailRecords.length} attendee{detailRecords.length !== 1 ? 's' : ''}
                  </span>
                  <div className="rp-modal-footer-actions">
                    <button
                      className="rp-export-meeting-btn"
                      onClick={() => handleMeetingExport(detailMeeting._id)}
                      disabled={exportingMeeting || detailRecords.length === 0}
                    >
                      <span className="material-symbols-outlined">
                        {exportingMeeting ? 'hourglass_empty' : 'download'}
                      </span>
                      {exportingMeeting ? 'Exporting…' : 'Export CSV'}
                    </button>
                    <button
                      className="rp-view-btn"
                      onClick={closeDetail}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports
