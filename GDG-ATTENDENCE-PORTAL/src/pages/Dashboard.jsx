import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Dashboard.css'

const Dashboard = () => {
  const { user, userRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const roleError = location.state?.error

  const firstName = user?.displayName?.split(' ')[0] || 'there'

  // Quick-action cards per role
  const adminCards = [
    {
      icon: 'people',
      title: 'Members',
      desc: 'Manage users & roles',
      path: '/admin/members',
      color: '#4285F4',
      bg: '#e8f0fe',
    },
    {
      icon: 'event',
      title: 'Meetings',
      desc: 'Create & manage meetings',
      path: '/admin/meetings',
      color: '#EA4335',
      bg: '#fce8e6',
    },
    {
      icon: 'qr_code',
      title: 'Generate QR',
      desc: 'Create attendance QR codes',
      path: '/admin/generate-qr',
      color: '#34A853',
      bg: '#e6f4ea',
    },
    {
      icon: 'assessment',
      title: 'Reports',
      desc: 'View attendance analytics',
      path: '/admin/reports',
      color: '#FBBC05',
      bg: '#fef7e0',
    },
  ]

  const prCards = [
    {
      icon: 'playlist_add_check',
      title: 'Select Meeting',
      desc: 'Choose active meeting & display QR',
      path: '/pr/select-meeting',
      color: '#4285F4',
      bg: '#e8f0fe',
    },
  ]

  const memberCards = [
    {
      icon: 'qr_code_scanner',
      title: 'Scan QR',
      desc: 'Mark your attendance',
      path: '/member/scan-qr',
      color: '#4285F4',
      bg: '#e8f0fe',
    },
  ]

  let cards = memberCards
  if (userRole === 'admin') cards = adminCards
  else if (userRole === 'pr') cards = [...prCards, ...memberCards]

  return (
    <div className="dash-page">
      {/* Role error toast */}
      {roleError && (
        <div className="dash-role-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {roleError}
        </div>
      )}

      {/* Welcome */}
      <div className="dash-welcome">
        <h1 className="dash-greeting">
          Welcome back, <span className="dash-name">{firstName}</span>
        </h1>
        <p className="dash-sub">
          {userRole === 'admin' && 'Manage your GDG chapter from here.'}
          {userRole === 'pr' && 'Ready to run today\'s event? Select a meeting below.'}
          {userRole === 'member' && 'Scan a QR code to mark your attendance.'}
          {!userRole && 'Loading your dashboard…'}
        </p>
      </div>

      {/* Role chip */}
      {userRole && (
        <div className="dash-role-section">
          <span className={`dash-role-chip dash-role-${userRole}`}>
            {userRole === 'admin' && '🛡️'}
            {userRole === 'pr' && '📢'}
            {userRole === 'member' && '👤'}
            {' '}{userRole.toUpperCase()}
          </span>
        </div>
      )}

      {/* Quick action cards */}
      <div className="dash-cards">
        {cards.map((card) => (
          <button
            key={card.path}
            className="dash-card"
            onClick={() => navigate(card.path)}
          >
            <div className="dash-card-icon" style={{ background: card.bg, color: card.color }}>
              <span className="material-icon">{card.icon}</span>
            </div>
            <div className="dash-card-body">
              <h3 className="dash-card-title">{card.title}</h3>
              <p className="dash-card-desc">{card.desc}</p>
            </div>
            <svg className="dash-card-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>

      {/* Info footer */}
      <div className="dash-footer">
        <div className="dash-footer-bar">
          <span className="gbar-sm" style={{ background: '#4285F4' }} />
          <span className="gbar-sm" style={{ background: '#EA4335' }} />
          <span className="gbar-sm" style={{ background: '#FBBC05' }} />
          <span className="gbar-sm" style={{ background: '#34A853' }} />
        </div>
        <p>Google Developer Groups — On Campus </p>
      </div>
    </div>
  )
}

export default Dashboard
