/**
 * API Client
 *
 * Centralized HTTP client that automatically attaches the Firebase ID token
 * to every request. This is the frontend counterpart to the backend auth
 * middleware — it ensures every API call is authenticated.
 *
 * Usage:
 *   import api from '../config/api'
 *   const { data } = await api.get('/auth/me')
 *   const { data } = await api.post('/auth/register')
 */

import { auth } from './firebase'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

/**
 * Get the current user's Firebase ID token.
 * Returns null if no user is signed in.
 *
 * @param {boolean} forceRefresh - Force refresh the token even if not expired
 * @returns {Promise<string|null>}
 */
const getIdToken = async (forceRefresh = false) => {
  const currentUser = auth.currentUser
  if (!currentUser) return null

  try {
    return await currentUser.getIdToken(forceRefresh)
  } catch (error) {
    console.error('Failed to get ID token:', error)
    return null
  }
}

/**
 * Make an authenticated API request.
 *
 * @param {string} endpoint - API endpoint (e.g., '/auth/me')
 * @param {Object} options  - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Object>} Parsed JSON response
 */
const request = async (endpoint, options = {}) => {
  const token = await getIdToken()

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // Attach auth header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = `${API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // Parse JSON response
  const data = await response.json()

  // If token expired, try once with a refreshed token
  if (response.status === 401 && data.error === 'TokenExpired') {
    const freshToken = await getIdToken(true)
    if (freshToken) {
      headers['Authorization'] = `Bearer ${freshToken}`
      const retryResponse = await fetch(url, { ...options, headers })
      return retryResponse.json()
    }
  }

  if (!response.ok) {
    const error = new Error(data.message || 'API request failed')
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

// Convenience methods
const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),

  post: (endpoint, body) =>
    request(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: (endpoint, body) =>
    request(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: (endpoint, body) =>
    request(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
}

export default api
