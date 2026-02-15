/**
 * RoleBasedRoute Component
 * 
 * Wrapper component that checks both authentication and user role.
 * Redirects to appropriate page based on authentication and authorization.
 * 
 * For GDG Attendance System, user roles are stored in Firestore or custom claims.
 * This component checks if the user has the required role to access the route.
 * 
 * Usage:
 * <Route path="/admin/members" element={
 *   <RoleBasedRoute allowedRoles={['admin']}>
 *     <ManageMembers />
 *   </RoleBasedRoute>
 * } />
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Loading.css'

export const RoleBasedRoute = ({ children, allowedRoles = [] }) => {
  const { user, userRole, loading } = useAuth()

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

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // If role hasn't loaded yet, show loader
  if (!userRole) {
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

  // Check if user has required role
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return (
      <Navigate 
        to="/dashboard" 
        replace 
        state={{ 
          error: 'You do not have permission to access this page',
          requiredRole: allowedRoles,
          userRole 
        }} 
      />
    )
  }

  // User is authenticated and has required role
  return children
}

export default RoleBasedRoute
