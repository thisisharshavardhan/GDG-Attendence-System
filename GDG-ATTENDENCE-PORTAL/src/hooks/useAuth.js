/**
 * useAuth Hook
 * 
 * Custom hook for easy access to authentication context.
 * Industry best practice: Single hook for all auth operations.
 * 
 * @returns {Object} Authentication context with user, loading, error, and auth methods
 * @throws {Error} If used outside of AuthProvider
 */

import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error(
      'useAuth must be used within an AuthProvider. ' +
        'Wrap your app with <AuthProvider> in main.jsx'
    )
  }

  return context
}

export default useAuth
