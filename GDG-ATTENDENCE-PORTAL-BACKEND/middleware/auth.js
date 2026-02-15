/**
 * Firebase Authentication Middleware
 *
 * Verifies the Firebase ID token sent in the Authorization header.
 * This is the core authentication gate for all protected backend routes.
 *
 * How it works:
 *   1. Client signs in via Firebase Auth (frontend)
 *   2. Client sends ID token in `Authorization: Bearer <token>` header
 *   3. This middleware verifies the token with Firebase Admin SDK
 *   4. If valid, attaches the decoded user payload to `req.user`
 *   5. If invalid, returns 401 Unauthorized
 *
 * Usage:
 *   const { authenticate } = require('./middleware/auth')
 *   router.get('/profile', authenticate, handler)
 */

const admin = require('../config/firebase')

/**
 * Authenticate middleware
 * Verifies Firebase ID token from Authorization header.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    // Check for Authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      })
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1]

    if (!idToken || idToken.trim() === '') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token is empty',
      })
    }

    // Verify the token with Firebase Admin SDK
    // checkRevoked: true ensures revoked tokens are rejected
    const decodedToken = await admin.auth().verifyIdToken(idToken, true)

    // Attach the full decoded token to the request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      emailVerified: decodedToken.email_verified || false,
      name: decodedToken.name || null,
      picture: decodedToken.picture || null,
      authTime: decodedToken.auth_time,
      iat: decodedToken.iat,
      exp: decodedToken.exp,
    }

    next()
  } catch (error) {
    console.error('🔒 Authentication error:', error.code || error.message)

    // Handle specific Firebase Auth errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        error: 'TokenExpired',
        message: 'Your session has expired. Please sign in again.',
      })
    }

    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        success: false,
        error: 'TokenRevoked',
        message: 'Your session has been revoked. Please sign in again.',
      })
    }

    if (error.code === 'auth/argument-error') {
      return res.status(401).json({
        success: false,
        error: 'InvalidToken',
        message: 'The provided token is invalid.',
      })
    }

    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication failed. Please sign in again.',
    })
  }
}

module.exports = { authenticate }
