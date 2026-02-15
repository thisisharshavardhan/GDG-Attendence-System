/**
 * Meeting Controller
 *
 * Handles CRUD operations for meetings + QR code generation.
 * All handlers assume authentication middleware has already run.
 */

const Meeting = require('../models/Meeting')
const User = require('../models/User')
const QRCode = require('qrcode')
const crypto = require('crypto')
const { getSecondsUntilNextRefresh, QR_REFRESH_INTERVAL } = require('../services/qrRefreshService')

/**
 * POST /api/meetings
 * Create a new meeting (admin-only).
 */
const createMeeting = async (req, res) => {
  try {
    const { title, description, type, dateTime, duration, location, meetingLink, geofencing, participation, participants } = req.body

    if (!title || !type || !dateTime) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Title, type, and dateTime are required.',
      })
    }

    if (!['offline', 'online'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Type must be "offline" or "online".',
      })
    }

    // Validate geofencing if enabled
    if (geofencing?.enabled) {
      if (
        typeof geofencing.center?.lat !== 'number' ||
        typeof geofencing.center?.lng !== 'number' ||
        geofencing.center.lat === 0 && geofencing.center.lng === 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'BadRequest',
          message: 'Geofencing requires a valid location (lat/lng).',
        })
      }
    }

    // Find the creating user in MongoDB
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean()
    if (!dbUser) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'User not found in database.',
      })
    }

    const meeting = await Meeting.create({
      title: title.trim(),
      description: description?.trim() || '',
      type,
      dateTime: new Date(dateTime),
      duration: duration || 60,
      location: location?.trim() || (type === 'online' ? 'Online' : ''),
      meetingLink: meetingLink?.trim() || '',
      createdBy: dbUser._id,
      participation: participation === 'selected' ? 'selected' : 'anyone',
      participants: participation === 'selected' && Array.isArray(participants) ? participants : [],
      geofencing: geofencing?.enabled
        ? {
            enabled: true,
            center: {
              lat: geofencing.center.lat,
              lng: geofencing.center.lng,
            },
            radius: Math.min(5000, Math.max(10, geofencing.radius || 200)),
          }
        : { enabled: false },
    })

    return res.status(201).json({
      success: true,
      data: meeting,
      message: 'Meeting created successfully.',
    })
  } catch (error) {
    console.error('❌ Create meeting error:', error.message)

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message)
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: messages.join('. '),
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to create meeting.',
    })
  }
}

/**
 * GET /api/meetings
 * List all meetings with optional filters.
 *
 * Query params:
 *   search  – filter by title (case-insensitive)
 *   type    – 'offline' or 'online'
 *   status  – 'active', 'upcoming', 'past'
 *   page    – page number (default: 1)
 *   limit   – results per page (default: 20, max: 100)
 *   sort    – sort field (default: dateTime)
 *   order   – asc | desc (default: desc)
 */
const listMeetings = async (req, res) => {
  try {
    const {
      search = '',
      type = '',
      status = '',
      page = 1,
      limit = 20,
      sort = 'dateTime',
      order = 'desc',
    } = req.query

    const filter = {}

    if (search.trim()) {
      filter.title = new RegExp(search.trim(), 'i')
    }

    if (type && ['offline', 'online'].includes(type)) {
      filter.type = type
    }

    const now = new Date()
    if (status === 'active') {
      // Meetings currently within their time window (dateTime <= now < dateTime + duration)
      filter.dateTime = { $lte: now }
      // We use $expr to compute endTime dynamically
      filter.$expr = {
        $gt: [
          { $add: ['$dateTime', { $multiply: [{ $ifNull: ['$duration', 60] }, 60000] }] },
          now,
        ],
      }
    } else if (status === 'upcoming') {
      filter.dateTime = { $gt: now }
    } else if (status === 'past') {
      // Meetings whose endTime (dateTime + duration) is in the past
      filter.$expr = {
        $lte: [
          { $add: ['$dateTime', { $multiply: [{ $ifNull: ['$duration', 60] }, 60000] }] },
          now,
        ],
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (pageNum - 1) * limitNum

    const allowedSortFields = ['dateTime', 'title', 'type', 'createdAt', 'duration']
    const sortField = allowedSortFields.includes(sort) ? sort : 'dateTime'
    const sortOrder = order === 'asc' ? 1 : -1

    const [meetings, total] = await Promise.all([
      Meeting.find(filter)
        .populate('createdBy', 'name email photoURL')
        .populate('participants', 'name email photoURL role')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Meeting.countDocuments(filter),
    ])

    const totalPages = Math.ceil(total / limitNum)

    return res.status(200).json({
      success: true,
      data: meetings,
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
    console.error('❌ List meetings error:', error.message)
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to fetch meetings.',
    })
  }
}

/**
 * GET /api/meetings/active
 * Get currently active meetings (for PR team to display QR).
 */
const getActiveMeetings = async (req, res) => {
  try {
    const now = new Date()

    // Time-based: meetings currently within their time window
    const meetings = await Meeting.find({
      dateTime: { $lte: now },
      $expr: {
        $gt: [
          { $add: ['$dateTime', { $multiply: [{ $ifNull: ['$duration', 60] }, 60000] }] },
          now,
        ],
      },
    })
      .populate('createdBy', 'name email')
      .sort({ dateTime: -1 })
      .lean()

    return res.status(200).json({
      success: true,
      data: meetings,
    })
  } catch (error) {
    console.error('❌ Get active meetings error:', error.message)
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to fetch active meetings.',
    })
  }
}

/**
 * GET /api/meetings/:id
 * Get a single meeting by ID.
 */
const getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('createdBy', 'name email photoURL')
      .populate('participants', 'name email photoURL role')
      .lean()

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Meeting not found.',
      })
    }

    return res.status(200).json({
      success: true,
      data: meeting,
    })
  } catch (error) {
    console.error('❌ Get meeting error:', error.message)

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid meeting ID format.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to fetch meeting.',
    })
  }
}

/**
 * PATCH /api/meetings/:id
 * Update a meeting (admin-only).
 */
const updateMeeting = async (req, res) => {
  try {
    const { title, description, type, dateTime, duration, location, meetingLink, isActive, geofencing, participation, participants } =
      req.body

    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Meeting not found.',
      })
    }

    // Update only provided fields
    if (title !== undefined) meeting.title = title.trim()
    if (description !== undefined) meeting.description = description.trim()
    if (type !== undefined) {
      if (!['offline', 'online'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'BadRequest',
          message: 'Type must be "offline" or "online".',
        })
      }
      meeting.type = type
    }
    if (dateTime !== undefined) meeting.dateTime = new Date(dateTime)
    if (duration !== undefined) meeting.duration = duration
    if (location !== undefined) meeting.location = location.trim()
    if (meetingLink !== undefined) meeting.meetingLink = meetingLink.trim()
    if (isActive !== undefined) meeting.isActive = isActive
    if (geofencing !== undefined) {
      if (geofencing.enabled) {
        if (
          typeof geofencing.center?.lat !== 'number' ||
          typeof geofencing.center?.lng !== 'number' ||
          (geofencing.center.lat === 0 && geofencing.center.lng === 0)
        ) {
          return res.status(400).json({
            success: false,
            error: 'BadRequest',
            message: 'Geofencing requires a valid location (lat/lng).',
          })
        }
        meeting.geofencing = {
          enabled: true,
          center: { lat: geofencing.center.lat, lng: geofencing.center.lng },
          radius: Math.min(5000, Math.max(10, geofencing.radius || 200)),
        }
      } else {
        meeting.geofencing = { enabled: false, center: { lat: 0, lng: 0 }, radius: 200 }
      }
    }
    if (participation !== undefined) {
      meeting.participation = participation === 'selected' ? 'selected' : 'anyone'
      if (participation === 'selected' && Array.isArray(participants)) {
        meeting.participants = participants
      } else if (participation !== 'selected') {
        meeting.participants = []
      }
    }

    await meeting.save()

    // Re-populate createdBy
    await meeting.populate('createdBy', 'name email photoURL')

    return res.status(200).json({
      success: true,
      data: meeting,
      message: 'Meeting updated successfully.',
    })
  } catch (error) {
    console.error('❌ Update meeting error:', error.message)

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid meeting ID format.',
      })
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message)
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: messages.join('. '),
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to update meeting.',
    })
  }
}

/**
 * DELETE /api/meetings/:id
 * Delete a meeting (admin-only).
 */
const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Meeting not found.',
      })
    }

    await Meeting.findByIdAndDelete(req.params.id)

    return res.status(200).json({
      success: true,
      message: `Meeting "${meeting.title}" deleted successfully.`,
    })
  } catch (error) {
    console.error('❌ Delete meeting error:', error.message)

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid meeting ID format.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to delete meeting.',
    })
  }
}

/**
 * POST /api/meetings/:id/generate-qr
 * Generate a unique QR code for a meeting.
 * The QR encodes a JSON payload with meeting ID + a random token for validation.
 */
const generateQR = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Meeting not found.',
      })
    }

    // Create a unique payload for the QR code
    const token = crypto.randomBytes(16).toString('hex')
    const qrPayload = JSON.stringify({
      meetingId: meeting._id,
      token,
      generatedAt: new Date().toISOString(),
    })

    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 2,
      color: {
        dark: '#202124',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })

    // Save to meeting
    meeting.qrCode = qrCodeDataUrl
    meeting.qrData = qrPayload
    await meeting.save()

    return res.status(200).json({
      success: true,
      data: {
        qrCode: qrCodeDataUrl,
        qrData: qrPayload,
        meetingId: meeting._id,
      },
      message: 'QR code generated successfully.',
    })
  } catch (error) {
    console.error('❌ Generate QR error:', error.message)

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid meeting ID format.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to generate QR code.',
    })
  }
}

/**
 * PATCH /api/meetings/:id/toggle-active
 * Toggle the isActive status of a meeting.
 */
const toggleActive = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Meeting not found.',
      })
    }

    meeting.isActive = !meeting.isActive
    await meeting.save()
    await meeting.populate('createdBy', 'name email photoURL')

    return res.status(200).json({
      success: true,
      data: meeting,
      message: `Meeting ${meeting.isActive ? 'activated' : 'deactivated'} successfully.`,
    })
  } catch (error) {
    console.error('❌ Toggle active error:', error.message)
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to toggle meeting status.',
    })
  }
}

/**
 * GET /api/meetings/:id/qr-status
 * Read-only — returns the current QR code from the database and the
 * real number of seconds until the background service generates the
 * next QR.  This endpoint NEVER generates a new QR itself.
 *
 * The background service (qrRefreshService) regenerates QR codes
 * every 20 s for any meeting that has a non-empty qrCode field.
 * This endpoint simply reports the current state + timing so the
 * frontend countdown stays perfectly in sync with the server cycle.
 */
const getQRStatus = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .select('qrCode qrData isActive qrPaused')
      .lean()

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Meeting not found.',
      })
    }

    const secondsRemaining = getSecondsUntilNextRefresh()

    return res.status(200).json({
      success: true,
      data: {
        qrCode: meeting.qrCode || null,
        qrData: meeting.qrData || null,
        isActive: meeting.isActive,
        qrPaused: !!meeting.qrPaused,
        secondsRemaining,
        refreshInterval: QR_REFRESH_INTERVAL,
      },
    })
  } catch (error) {
    console.error('❌ QR status error:', error.message)

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid meeting ID format.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to get QR status.',
    })
  }
}

/**
 * PATCH /api/meetings/:id/qr-pause
 * Toggle the qrPaused flag on a meeting.
 * When paused, the background service skips QR regeneration for this meeting.
 */
const toggleQRPause = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Meeting not found.',
      })
    }

    meeting.qrPaused = !meeting.qrPaused
    await meeting.save()

    return res.status(200).json({
      success: true,
      data: { qrPaused: meeting.qrPaused },
      message: `QR auto-refresh ${meeting.qrPaused ? 'paused' : 'resumed'}.`,
    })
  } catch (error) {
    console.error('❌ Toggle QR pause error:', error.message)

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid meeting ID format.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to toggle QR pause.',
    })
  }
}

/**
 * POST /api/meetings/:id/generate-attendance-link
 * Generate a unique attendance token for an online meeting.
 * This token is used to create an attendance link that members can open.
 */
const generateAttendanceLink = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Meeting not found.',
      })
    }

    if (meeting.type !== 'online') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Attendance links can only be generated for online meetings.',
      })
    }

    // Generate a new token (or regenerate if one exists)
    const token = crypto.randomBytes(24).toString('hex')
    meeting.attendanceToken = token
    await meeting.save()

    return res.status(200).json({
      success: true,
      data: {
        attendanceToken: token,
        meetingId: meeting._id,
      },
      message: 'Attendance link generated successfully.',
    })
  } catch (error) {
    console.error('❌ Generate attendance link error:', error.message)

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid meeting ID format.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to generate attendance link.',
    })
  }
}

module.exports = {
  createMeeting,
  listMeetings,
  getActiveMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  generateQR,
  generateAttendanceLink,
  toggleActive,
  getQRStatus,
  toggleQRPause,
}
