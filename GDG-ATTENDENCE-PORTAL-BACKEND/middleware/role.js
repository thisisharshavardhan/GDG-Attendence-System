/**
 * Role-Based Authorization Middleware
 *
 * Checks if the authenticated user has the required role to access a route.
 * Must be used AFTER the `authenticate` middleware.
 *
 * Roles hierarchy:
 *   admin  → full access (manage members, meetings, QR, reports)
 *   pr     → can display QR codes during events
 *   member → can scan QR and submit attendance
 *
 * The role is fetched from MongoDB (User model), NOT from the Firebase token.
 * This keeps role management in your own database.
 *
 * Usage:
 *   const { authenticate } = require('./middleware/auth')
 *   const { authorize } = require('./middleware/role')
 *   router.get('/admin/members', authenticate, authorize('admin'), handler)
 *   router.get('/pr/qr', authenticate, authorize('admin', 'pr'), handler)
 */

const User = require('../models/User')

/**
 * Create an authorization middleware for the given roles.
 *
 * @param  {...string} allowedRoles – one or more roles that may access the route
 * @returns {Function} Express middleware
 */
const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      // req.user is set by the authenticate middleware
      if (!req.user || !req.user.uid) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required before authorization.',
        })
      }

      // Fetch the user record from MongoDB to get their role
      const dbUser = await User.findOne({ firebaseUid: req.user.uid })
        .select('role email name')
        .lean()

      if (!dbUser) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message:
            'User account not found in the system. Please contact an administrator.',
        })
      }

      // Attach the database role and user info to the request
      req.user.role = dbUser.role
      req.user.dbId = dbUser._id
      req.user.dbName = dbUser.name

      // Check if the user's role is in the allowed list
      if (!allowedRoles.includes(dbUser.role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${dbUser.role}.`,
        })
      }

      next()
    } catch (error) {
      console.error('🔐 Authorization error:', error.message)
      return res.status(500).json({
        success: false,
        error: 'InternalError',
        message: 'An error occurred while checking permissions.',
      })
    }
  }
}

module.exports = { authorize }
