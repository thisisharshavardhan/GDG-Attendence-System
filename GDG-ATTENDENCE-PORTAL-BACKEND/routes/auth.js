/**
 * Auth Routes
 *
 * All routes here require Firebase ID token authentication.
 * Role-specific routes additionally require authorization.
 *
 * POST   /api/auth/register  → sync Firebase user to MongoDB
 * GET    /api/auth/me         → get authenticated user profile
 * PATCH  /api/auth/role       → admin-only: update a user's role
 */

const express = require('express')
const router = express.Router()

const { authenticate } = require('../middleware/auth')
const { authorize } = require('../middleware/role')
const {
  registerUser,
  getProfile,
  updateUserRole,
} = require('../controllers/authController')

// All routes require authentication
router.use(authenticate)

// Register / sync user after first Firebase sign-in
router.post('/register', registerUser)

// Get authenticated user's profile
router.get('/me', getProfile)

// Admin-only: update another user's role
router.patch('/role', authorize('admin'), updateUserRole)

module.exports = router
