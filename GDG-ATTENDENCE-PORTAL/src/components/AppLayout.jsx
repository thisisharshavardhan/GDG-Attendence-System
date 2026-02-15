/**
 * AppLayout — Google-product-style shell
 *
 * Provides:
 *  • Top app bar with logo, title, user avatar + sign-out
 *  • Collapsible sidebar navigation (role-aware links)
 *  • Main content area with <Outlet />
 *
 * Wraps every authenticated route.
 */

import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import gdgLogo from '../assets/google-developers-svgrepo-com.svg'
import './AppLayout.css'

const AppLayout = () => {
  const { user, userRole, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (err) {
      console.error('Sign-out failed:', err)
    }
  }

  const getInitials = () => {
    const name = user?.displayName
    if (name) {
      return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    }
    return user?.email?.[0]?.toUpperCase() || '?'
  }

  const roleBadgeColor = {
    admin: { bg: '#e8f0fe', text: '#1967d2' },
    pr: { bg: '#fef7e0', text: '#e37400' },
    member: { bg: '#e6f4ea', text: '#137333' },
  }

  // Navigation items based on role
  const navItems = [
    {
      section: 'Main',
      links: [
        { to: '/dashboard', icon: 'dashboard', label: 'Dashboard', roles: ['admin', 'pr', 'member'] },
      ],
    },
    {
      section: 'Admin',
      roles: ['admin'],
      links: [
        { to: '/admin/members', icon: 'people', label: 'Members', roles: ['admin'] },
        { to: '/admin/meetings', icon: 'event', label: 'Meetings', roles: ['admin'] },
        { to: '/admin/reports', icon: 'assessment', label: 'Reports', roles: ['admin'] },
      ],
    },
    {
      section: 'PR Team',
      roles: ['admin', 'pr'],
      links: [
        { to: '/pr/select-meeting', icon: 'playlist_add_check', label: 'Select Meeting', roles: ['admin', 'pr'] },
      ],
    },
    {
      section: 'Member',
      links: [
        { to: '/member/scan-qr', icon: 'qr_code_scanner', label: 'Scan QR', roles: ['admin', 'pr', 'member'] },
      ],
    },
  ]

  return (
    <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      {/* ── Top App Bar ─────────────────────────── */}
      <header className="app-topbar">
        <div className="topbar-left">
          <button
            className="topbar-menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="topbar-brand">
            <img src={gdgLogo} alt="GDG" className="topbar-logo" />
            <span className="topbar-title">GDG Attendance</span>
          </div>
        </div>

        <div className="topbar-right">
          {userRole && (
            <span
              className="topbar-role-badge"
              style={{
                background: roleBadgeColor[userRole]?.bg,
                color: roleBadgeColor[userRole]?.text,
              }}
            >
              {userRole}
            </span>
          )}

          <div className="topbar-profile-wrapper">
            <button
              className="topbar-avatar-btn"
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="Account menu"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="topbar-avatar"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="topbar-avatar-placeholder">{getInitials()}</div>
              )}
            </button>

            {profileOpen && (
              <>
                <div className="profile-overlay" onClick={() => setProfileOpen(false)} />
                <div className="profile-dropdown">
                  <div className="profile-header">
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="profile-avatar-lg"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="profile-avatar-lg-placeholder">{getInitials()}</div>
                    )}
                    <div className="profile-info">
                      <span className="profile-name">{user?.displayName || 'User'}</span>
                      <span className="profile-email">{user?.email}</span>
                    </div>
                  </div>
                  <div className="profile-divider" />
                  <button className="profile-signout" onClick={handleSignOut}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Sidebar ─────────────────────────────── */}
      <nav className="app-sidebar">
        <div className="sidebar-content">
          {navItems.map((section) => {
            // Filter section by role
            if (section.roles && !section.roles.includes(userRole)) return null

            const visibleLinks = section.links.filter(
              (link) => link.roles.includes(userRole)
            )
            if (visibleLinks.length === 0) return null

            return (
              <div key={section.section} className="sidebar-section">
                <div className="sidebar-section-label">{section.section}</div>
                {visibleLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                    }
                    onClick={() => {
                      if (window.innerWidth < 768) setSidebarOpen(false)
                    }}
                  >
                    <span className="material-icon">{link.icon}</span>
                    <span className="sidebar-label">{link.label}</span>
                  </NavLink>
                ))}
              </div>
            )
          })}
        </div>

        {/* Google colors bar at bottom */}
        <div className="sidebar-google-bar">
          <span className="gbar gbar-blue" />
          <span className="gbar gbar-red" />
          <span className="gbar gbar-yellow" />
          <span className="gbar gbar-green" />
        </div>
      </nav>

      {/* ── Sidebar overlay for mobile ──────────── */}
      {sidebarOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main Content ────────────────────────── */}
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
