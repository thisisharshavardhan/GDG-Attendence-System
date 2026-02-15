/**
 * Auth Controller
 *
 * Handles user registration (sync from Firebase) and profile operations.
 * Every handler expects `req.user` to be set by the authenticate middleware.
 */

const User = require('../models/User')

/**
 * POST /api/auth/register
 *
 * Called once after the user's first Firebase sign-in.
 * Creates or updates the user record in MongoDB.
 * The first registered user (matching SUPER_USER_EMAIL) is made admin.
 */
const registerUser = async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user

    // Check if user already exists
    let user = await User.findOne({ firebaseUid: uid })

    if (user) {
      // Update existing user profile from Firebase
      user.name = name || user.name
      user.photoURL = picture || user.photoURL
      await user.save()

      return res.status(200).json({
        success: true,
        message: 'User already registered',
        data: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          photoURL: user.photoURL,
        },
      })
    }

    // Determine role for new user
    const superUserEmail = process.env.SUPER_USER_EMAIL
    let role = 'member'

    if (superUserEmail && email === superUserEmail) {
      role = 'admin'
    }

    // Create new user
    user = await User.create({
      firebaseUid: uid,
      email: email,
      name: name || '',
      photoURL: picture || '',
      role: role,
    })

    console.log(
      `✅ New user registered: ${email} (role: ${role})`
    )

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        photoURL: user.photoURL,
      },
    })
  } catch (error) {
    console.error('❌ Registration error:', error.message)

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'User with this email already exists.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to register user.',
    })
  }
}

/**
 * GET /api/auth/me
 *
 * Returns the authenticated user's profile from MongoDB.
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid }).lean()

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User profile not found. Please register first.',
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        photoURL: user.photoURL,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error('❌ Get profile error:', error.message)
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to fetch user profile.',
    })
  }
}

/**
 * PATCH /api/auth/role
 *
 * Admin-only: Update a user's role.
 * Body: { userId: string, role: 'admin' | 'pr' | 'member' }
 */
const updateUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body

    if (!userId || !role) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'userId and role are required.',
      })
    }

    const validRoles = ['admin', 'pr', 'member']
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      })
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found.',
      })
    }

    console.log(
      `✅ Role updated: ${user.email} → ${role} (by ${req.user.email})`
    )

    return res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('❌ Update role error:', error.message)
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to update user role.',
    })
  }
}

module.exports = {
  registerUser,
  getProfile,
  updateUserRole,
}
