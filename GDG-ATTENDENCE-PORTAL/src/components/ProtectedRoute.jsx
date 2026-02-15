/**
 * ProtectedRoute Component
 * 
 * Wrapper component that ensures user is authenticated before accessing route.
 * Redirects to login page if user is not authenticated.
 * Shows loading state while checking authentication.
 * 
 * Usage:
 * <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Loading.css'

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="loading-container">
        <div className="google-dots-loader">
          <div className="google-dot-loader" />
          <div className="google-dot-loader" />
          <div className="google-dot-loader" />
          <div className="google-dot-loader" />
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated, preserving intended destination
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // User is authenticated, render the protected content
  return children
}

export default ProtectedRoute
