/**
 * PublicRoute Component
 * 
 * Wrapper for public routes (login, signup) that should redirect
 * authenticated users away to prevent access.
 * 
 * Usage:
 * <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Loading.css'

export const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth()

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

  // Redirect to dashboard if already authenticated
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  // User is not authenticated, render the public content
  return children
}

export default PublicRoute
