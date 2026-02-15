/**
 * Authentication Context
 * 
 * Provides global authentication state management using React Context API.
 * Industry best practices:
 * - Centralized auth state
 * - Automatic auth state persistence
 * - Error handling
 * - Loading states
 * - Clean separation of concerns
 */

import { createContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../config/firebase'
import api from '../config/api'

export const AuthContext = createContext({
  user: null,
  loading: true,
  error: null,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  updateUserProfile: async () => {},
})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /**
   * Register / sync user with backend after Firebase auth.
   * Fetches the user role from MongoDB.
   */
  const syncUserWithBackend = async () => {
    try {
      const data = await api.post('/auth/register')
      if (data.success && data.data) {
        setUserRole(data.data.role)
      }
    } catch (err) {
      console.error('Backend sync error:', err.message)
      // Non-critical — user can still use the app, role defaults to null
    }
  }

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser)
        if (currentUser) {
          await syncUserWithBackend()
        } else {
          setUserRole(null)
        }
        setLoading(false)
        setError(null)
      },
      (error) => {
        console.error('Auth state change error:', error)
        setError(error.message)
        setLoading(false)
      }
    )

    // Cleanup subscription on unmount
    return () => unsubscribe()
  }, [])

  /**
   * Sign in with Google OAuth
   */
  const signInWithGoogle = async () => {
    try {
      setError(null)
      setLoading(true)
      const result = await signInWithPopup(auth, googleProvider)
      return result.user
    } catch (error) {
      console.error('Google sign-in error:', error)
      setError(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  /**
   * Sign in with email and password
   */
  const signInWithEmail = async (email, password) => {
    try {
      setError(null)
      setLoading(true)
      const result = await signInWithEmailAndPassword(auth, email, password)
      return result.user
    } catch (error) {
      console.error('Email sign-in error:', error)
      setError(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  /**
   * Sign up with email and password
   */
  const signUpWithEmail = async (email, password, displayName = '') => {
    try {
      setError(null)
      setLoading(true)
      const result = await createUserWithEmailAndPassword(auth, email, password)
      
      // Update profile with display name if provided
      if (displayName) {
        await updateProfile(result.user, { displayName })
      }
      
      return result.user
    } catch (error) {
      console.error('Email sign-up error:', error)
      setError(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  /**
   * Sign out current user
   */
  const signOut = async () => {
    try {
      setError(null)
      await firebaseSignOut(auth)
      setUserRole(null)
    } catch (error) {
      console.error('Sign-out error:', error)
      setError(error.message)
      throw error
    }
  }

  /**
   * Send password reset email
   */
  const resetPassword = async (email) => {
    try {
      setError(null)
      await sendPasswordResetEmail(auth, email)
    } catch (error) {
      console.error('Password reset error:', error)
      setError(error.message)
      throw error
    }
  }

  /**
   * Update user profile
   */
  const updateUserProfile = async (updates) => {
    try {
      setError(null)
      if (!auth.currentUser) throw new Error('No user logged in')
      await updateProfile(auth.currentUser, updates)
      // Trigger state update
      setUser({ ...auth.currentUser })
    } catch (error) {
      console.error('Profile update error:', error)
      setError(error.message)
      throw error
    }
  }

  const value = {
    user,
    userRole,
    loading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
    updateUserProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
