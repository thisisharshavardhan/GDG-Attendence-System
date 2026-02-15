/**
 * User Controller
 *
 * Handles admin-level user management operations.
 * All handlers require admin authentication (checked by middleware).
 */

const User = require('../models/User')

/**
 * GET /api/users
 *
 * List all users with optional search and pagination.
 * Query params:
 *   search  – filter by name or email (case-insensitive partial match)
 *   role    – filter by role (admin | pr | member)
 *   page    – page number (default: 1)
 *   limit   – results per page (default: 20, max: 100)
 *   sort    – sort field (default: createdAt)
 *   order   – sort order: asc | desc (default: desc)
 */
const listUsers = async (req, res) => {
  try {
    const {
      search = '',
      role = '',
      page = 1,
      limit = 20,
      sort = 'createdAt',
      order = 'desc',
    } = req.query

    // Build filter
    const filter = {}

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i')
      filter.$or = [{ name: regex }, { email: regex }]
    }

    if (role && ['admin', 'pr', 'member'].includes(role)) {
      filter.role = role
    }

    // Sanitize pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (pageNum - 1) * limitNum

    // Sanitize sort
    const allowedSortFields = ['createdAt', 'name', 'email', 'role']
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt'
    const sortOrder = order === 'asc' ? 1 : -1

    // Execute query with pagination
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('firebaseUid email name photoURL role createdAt updatedAt')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ])

    const totalPages = Math.ceil(total / limitNum)

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    })
  } catch (error) {
    console.error('❌ List users error:', error.message)
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to fetch users.',
    })
  }
}

/**
 * GET /api/users/:id
 *
 * Get a single user by their MongoDB _id.
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('firebaseUid email name photoURL role createdAt updatedAt')
      .lean()

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found.',
      })
    }

    return res.status(200).json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error('❌ Get user error:', error.message)

    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid user ID format.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to fetch user.',
    })
  }
}

/**
 * DELETE /api/users/:id
 *
 * Delete a user by their MongoDB _id.
 * Prevents admins from deleting themselves or the super user.
 */
const deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id).lean()

    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found.',
      })
    }

    // Prevent admin from deleting themselves
    if (userToDelete.firebaseUid === req.user.uid) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'You cannot delete your own account.',
      })
    }

    // Prevent deleting the super user
    const superUserEmail = process.env.SUPER_USER_EMAIL
    if (superUserEmail && userToDelete.email === superUserEmail) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'The super admin account cannot be deleted.',
      })
    }

    await User.findByIdAndDelete(req.params.id)

    console.log(
      `🗑️  User deleted: ${userToDelete.email} (by ${req.user.email})`
    )

    return res.status(200).json({
      success: true,
      message: `User ${userToDelete.email} has been deleted.`,
    })
  } catch (error) {
    console.error('❌ Delete user error:', error.message)

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid user ID format.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to delete user.',
    })
  }
}

module.exports = {
  listUsers,
  getUserById,
  deleteUser,
}
