/**
 * User Routes
 *
 * Admin-only user management endpoints.
 * All routes require Firebase authentication + admin role.
 *
 * GET    /api/users        → list all users (search, filter, paginate)
 * GET    /api/users/:id    → get user by ID
 * DELETE /api/users/:id    → delete user
 *
 * Note: Role updates use PATCH /api/auth/role (in auth routes)
 */

const express = require('express')
const router = express.Router()

const { authenticate } = require('../middleware/auth')
const { authorize } = require('../middleware/role')
const {
  listUsers,
  getUserById,
  deleteUser,
} = require('../controllers/userController')

// All user-management routes require admin auth
router.use(authenticate)
router.use(authorize('admin'))

// List users with search & pagination
router.get('/', listUsers)

// Get a single user
router.get('/:id', getUserById)

// Delete a user
router.delete('/:id', deleteUser)

module.exports = router
