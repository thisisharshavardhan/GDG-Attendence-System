import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { useAuth } from '../hooks/useAuth'
import gdgLogo from '../assets/google-developers-svgrepo-com.svg'
import './Login.css'

const Login = () => {
  const navigate = useNavigate()
  const { signInWithGoogle, signInWithEmail, user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard')
    }
  }, [user, authLoading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)

    try {
      await signInWithEmail(email, password)
      // Navigation handled by useEffect above
    } catch (err) {
      console.error('Login error:', err)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)

    try {
      await signInWithGoogle()
      // Navigation handled by useEffect above
    } catch (err) {
      console.error('Google login error:', err)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  /**
   * Convert Firebase error codes to user-friendly messages
   */
  const getErrorMessage = (error) => {
    const errorCode = error.code || ''
    
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'Invalid email address format'
      case 'auth/user-disabled':
        return 'This account has been disabled'
      case 'auth/user-not-found':
        return 'No account found with this email'
      case 'auth/wrong-password':
        return 'Incorrect password'
      case 'auth/invalid-credential':
        return 'Invalid email or password'
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later'
      case 'auth/popup-closed-by-user':
        return 'Sign-in cancelled'
      case 'auth/cancelled-popup-request':
        return 'Sign-in cancelled'
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection'
      default:
        return error.message || 'An error occurred during sign in'
    }
  }

  // GSAP animations
  const brandingRef = useRef(null)
  const particlesRef = useRef([])
  const logoRef = useRef(null)
  const wavePathsRef = useRef([])

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animate logo entrance
      gsap.from(logoRef.current, {
        scale: 0,
        rotation: -180,
        opacity: 0,
        duration: 1.2,
        ease: 'elastic.out(1, 0.5)',
      })

      // Continuous pulse on logo
      gsap.to(logoRef.current, {
        scale: 1.1,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: 1.2,
      })

      // Animate wave paths entrance
      gsap.from(wavePathsRef.current, {
        opacity: 0,
        scaleY: 0,
        duration: 1,
        stagger: 0.2,
        ease: 'back.out(2)',
        delay: 0.4,
      })

      // Continuous wave animation
      wavePathsRef.current.forEach((path, i) => {
        gsap.to(path, {
          attr: { d: i % 2 === 0 ? 'M 0 20 Q 30 5 60 20 T 120 20 T 180 20 T 240 20' : 'M 0 20 Q 30 35 60 20 T 120 20 T 180 20 T 240 20' },
          duration: 2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: i * 0.3,
        })
      })

      // Floating particles
      particlesRef.current.forEach((particle, i) => {
        gsap.to(particle, {
          y: 'random(-40, 40)',
          x: 'random(-40, 40)',
          duration: 'random(3, 5)',
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: i * 0.3,
        })
      })

      // Text reveal
      gsap.from('.branding-text', {
        y: 20,
        opacity: 0,
        duration: 1,
        delay: 0.6,
      })

    }, brandingRef)

    return () => ctx.revert()
  }, [])

  return (
    <div className="login-page">
      {/* Left branding panel — Google-themed GSAP animations */}
      <div className="login-branding" ref={brandingRef}>
        {/* Floating color blobs */}
        <div className="google-dots">
          <div className="google-dot google-blue" ref={(el) => (particlesRef.current[0] = el)} />
          <div className="google-dot google-red" ref={(el) => (particlesRef.current[1] = el)} />
          <div className="google-dot google-yellow" ref={(el) => (particlesRef.current[2] = el)} />
          <div className="google-dot google-green" ref={(el) => (particlesRef.current[3] = el)} />
          <div className="google-dot google-blue" ref={(el) => (particlesRef.current[4] = el)} />
          <div className="google-dot google-red" ref={(el) => (particlesRef.current[5] = el)} />
        </div>

        {/* GDG Logo */}
        <div className="gdg-logo" ref={logoRef}>
          <img src={gdgLogo} alt="Google Developer Groups" />
        </div>

        {/* Animated smooth waves */}
        <div className="wave-container">
          <svg width="240" height="40" viewBox="0 0 240 40" fill="none">
            <path
              ref={(el) => (wavePathsRef.current[0] = el)}
              d="M 0 20 Q 30 10 60 20 T 120 20 T 180 20 T 240 20"
              stroke="#4285F4"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
            <path
              ref={(el) => (wavePathsRef.current[1] = el)}
              d="M 0 20 Q 30 15 60 20 T 120 20 T 180 20 T 240 20"
              stroke="#EA4335"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
            <path
              ref={(el) => (wavePathsRef.current[2] = el)}
              d="M 0 20 Q 30 25 60 20 T 120 20 T 180 20 T 240 20"
              stroke="#FBBC05"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
            <path
              ref={(el) => (wavePathsRef.current[3] = el)}
              d="M 0 20 Q 30 30 60 20 T 120 20 T 180 20 T 240 20"
              stroke="#34A853"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
          </svg>
        </div>

        {/* Branding text */}
        <div className="branding-text">
          <h2>Google Developer Groups</h2>
          <p>Attendance Portal</p>
        </div>

        {/* Google colors bar */}
        <div className="google-bar">
          <div className="bar-segment blue" />
          <div className="bar-segment red" />
          <div className="bar-segment yellow" />
          <div className="bar-segment green" />
        </div>
      </div>

      {/* Right login card */}
      <div className="login-panel">
        <div className="login-card">
          <div className="login-header">
            <h1>Sign in</h1>
            <p>Welcome back. Enter your credentials to continue.</p>
          </div>

          {/* Social login — Clerk puts this first */}
          <button className="btn-social" onClick={handleGoogleLogin} type="button">
            <svg className="social-icon" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          {error && (
            <div className="alert-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="field">
              <div className="field-header">
                <label htmlFor="password">Password</label>
                <a href="#" className="field-link" onClick={(e) => e.preventDefault()}>
                  Forgot password?
                </a>
              </div>
              <div className="password-input">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Continue'}
            </button>
          </form>

          <p className="login-footer">
            Don&apos;t have an account? <a href="#">Contact admin</a>
          </p>
        </div>

        <p className="login-legal">
          Secured by GDG on Campus &middot; VIT Bhimavaram
        </p>
      </div>
    </div>
  )
}

export default Login
