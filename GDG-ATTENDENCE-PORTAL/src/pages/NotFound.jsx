import { Link } from 'react-router-dom'
import './NotFound.css'

const NotFound = () => {
  return (
    <div className="nf-page">
      <div className="nf-card">
        {/* Google-color 404 text */}
        <h1 className="nf-code">
          <span style={{ color: '#4285F4' }}>4</span>
          <span style={{ color: '#EA4335' }}>0</span>
          <span style={{ color: '#FBBC05' }}>4</span>
        </h1>
        <h2 className="nf-title">Page not found</h2>
        <p className="nf-desc">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/dashboard" className="nf-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Back to Dashboard
        </Link>
        <div className="nf-bar">
          <span style={{ background: '#4285F4' }} />
          <span style={{ background: '#EA4335' }} />
          <span style={{ background: '#FBBC05' }} />
          <span style={{ background: '#34A853' }} />
        </div>
      </div>
    </div>
  )
}

export default NotFound
