/**
 * Attendance Controller
 *
 * Handles online meeting attendance via unique attendance links.
 *
 * Flow:
 *   1. Admin creates an online meeting → attendanceToken is auto-generated
 *   2. Admin / PR shares the attendance link: /attend/<token>
 *   3. Member opens the link (authenticated) → GET /attendance/:token
 *      → Returns meeting info + whether they already attended
 *   4. Member clicks "Join Meeting" → POST /attendance/:token/mark
 *      → Marks attendance, returns meetingLink (Google Meet URL)
 *   5. Frontend opens the Meet link in a new tab
 */

const Meeting = require('../models/Meeting')
const Attendance = require('../models/Attendance')
const User = require('../models/User')

/**
 * GET /api/attendance/:token
 * Get meeting details for an attendance link.
 * Authenticated — any role (member, pr, admin).
 */
const getAttendancePage = async (req, res) => {
  try {
    const { token } = req.params

    if (!token || token.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Attendance token is required.',
      })
    }

    const meeting = await Meeting.findOne({ attendanceToken: token })
      .populate('createdBy', 'name email')
      .lean()

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Invalid attendance link. This link may have expired or the meeting does not exist.',
      })
    }

    // Check if the meeting is an online meeting
    if (meeting.type !== 'online') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'This attendance link is only valid for online meetings.',
      })
    }

    // Check time window — the meeting must be active (within its start–end window)
    const now = new Date()
    const start = new Date(meeting.dateTime)
    const end = new Date(start.getTime() + (meeting.duration || 60) * 60000)

    let status = 'live'
    if (now < start) status = 'upcoming'
    else if (now >= end) status = 'ended'

    // Check if this user already marked attendance
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean()
    let alreadyAttended = false
    if (dbUser) {
      // Check participation restriction
      if (meeting.participation === 'selected') {
        const isAllowed = meeting.participants?.some(
          (pid) => pid.toString() === dbUser._id.toString()
        )
        if (!isAllowed) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'You are not on the participants list for this meeting.',
          })
        }
      }

      const existing = await Attendance.findOne({
        meeting: meeting._id,
        user: dbUser._id,
      }).lean()
      alreadyAttended = !!existing
    }

    return res.status(200).json({
      success: true,
      data: {
        meeting: {
          _id: meeting._id,
          title: meeting.title,
          description: meeting.description,
          type: meeting.type,
          dateTime: meeting.dateTime,
          duration: meeting.duration,
          meetingLink: meeting.meetingLink,
          createdBy: meeting.createdBy,
        },
        status,
        alreadyAttended,
      },
    })
  } catch (error) {
    console.error('❌ Get attendance page error:', error.message)
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to load attendance page.',
    })
  }
}

/**
 * POST /api/attendance/:token/mark
 * Mark attendance for the authenticated user.
 * Returns the Google Meet link so the frontend can open it.
 */
const markAttendance = async (req, res) => {
  try {
    const { token } = req.params

    if (!token || token.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Attendance token is required.',
      })
    }

    const meeting = await Meeting.findOne({ attendanceToken: token }).lean()

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Invalid attendance link.',
      })
    }

    if (meeting.type !== 'online') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'This attendance link is only valid for online meetings.',
      })
    }

    // Check time window
    const now = new Date()
    const start = new Date(meeting.dateTime)
    const end = new Date(start.getTime() + (meeting.duration || 60) * 60000)

    if (now < start) {
      return res.status(400).json({
        success: false,
        error: 'TooEarly',
        message: 'This meeting has not started yet. Please come back when the meeting is live.',
      })
    }

    if (now >= end) {
      return res.status(400).json({
        success: false,
        error: 'MeetingEnded',
        message: 'This meeting has already ended. Attendance can no longer be marked.',
      })
    }

    // Get the user from MongoDB
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean()
    if (!dbUser) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'User not found in the system. Please contact an administrator.',
      })
    }

    // Check participation restriction
    if (meeting.participation === 'selected') {
      const isAllowed = meeting.participants?.some(
        (pid) => pid.toString() === dbUser._id.toString()
      )
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You are not on the participants list for this meeting.',
        })
      }
    }

    // Check if already attended
    const existing = await Attendance.findOne({
      meeting: meeting._id,
      user: dbUser._id,
    }).lean()

    if (existing) {
      // Already attended — still return the meeting link so they can rejoin
      return res.status(200).json({
        success: true,
        data: {
          meetingLink: meeting.meetingLink,
          alreadyAttended: true,
        },
        message: 'You have already marked attendance for this meeting.',
      })
    }

    // Build attendance record with optional location
    const record = {
      meeting: meeting._id,
      user: dbUser._id,
      method: 'link',
      markedAt: now,
    }

    const { lat, lng, accuracy } = req.body || {}
    if (lat != null && lng != null) {
      record.location = {
        lat: Number(lat),
        lng: Number(lng),
        accuracy: accuracy != null ? Number(accuracy) : null,
      }
    }

    await Attendance.create(record)

    return res.status(201).json({
      success: true,
      data: {
        meetingLink: meeting.meetingLink,
        alreadyAttended: false,
      },
      message: 'Attendance marked successfully! Redirecting to Google Meet…',
    })
  } catch (error) {
    console.error('❌ Mark attendance error:', error.message)

    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      const meeting = await Meeting.findOne({ attendanceToken: req.params.token })
        .select('meetingLink')
        .lean()
      return res.status(200).json({
        success: true,
        data: {
          meetingLink: meeting?.meetingLink || '',
          alreadyAttended: true,
        },
        message: 'You have already marked attendance for this meeting.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to mark attendance.',
    })
  }
}

/**
 * POST /api/attendance/scan-qr
 * Mark attendance by scanning a QR code (offline meetings).
 *
 * Body:
 *   qrData   – the raw string encoded in the QR code (JSON with meetingId + token)
 *   lat      – optional latitude
 *   lng      – optional longitude
 *   accuracy – optional GPS accuracy in metres
 */
const scanQRAttendance = async (req, res) => {
  try {
    const { qrData, lat, lng, accuracy } = req.body

    if (!qrData) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'QR data is required.',
      })
    }

    // Parse the QR payload
    let parsed
    try {
      parsed = JSON.parse(qrData)
    } catch {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid QR code. Please scan a valid meeting QR code.',
      })
    }

    const { meetingId, token } = parsed
    if (!meetingId || !token) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid QR code format. Missing meeting information.',
      })
    }

    // Find the meeting
    const meeting = await Meeting.findById(meetingId).lean()
    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Meeting not found. The QR code may be outdated.',
      })
    }

    // Validate the QR token matches the current meeting QR
    // The qrData on the meeting is a JSON string; parse it to compare tokens
    let meetingQrParsed
    try {
      meetingQrParsed = JSON.parse(meeting.qrData || '{}')
    } catch {
      meetingQrParsed = {}
    }

    if (meetingQrParsed.token !== token) {
      return res.status(400).json({
        success: false,
        error: 'ExpiredQR',
        message: 'This QR code has expired. Please scan the latest QR code.',
      })
    }

    // Check meeting type — QR is for offline meetings
    if (meeting.type !== 'offline') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'QR attendance is only available for offline meetings. Use the attendance link for online meetings.',
      })
    }

    // Check time window
    const now = new Date()
    const start = new Date(meeting.dateTime)
    const end = new Date(start.getTime() + (meeting.duration || 60) * 60000)

    if (now < start) {
      return res.status(400).json({
        success: false,
        error: 'TooEarly',
        message: 'This meeting has not started yet. Please wait for the meeting to begin.',
      })
    }

    if (now >= end) {
      return res.status(400).json({
        success: false,
        error: 'MeetingEnded',
        message: 'This meeting has ended. Attendance can no longer be marked.',
      })
    }

    // Get the user from MongoDB
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean()
    if (!dbUser) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'User not found in the system. Please contact an administrator.',
      })
    }

    // Check participation restriction
    if (meeting.participation === 'selected') {
      const isAllowed = meeting.participants?.some(
        (pid) => pid.toString() === dbUser._id.toString()
      )
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You are not on the participants list for this meeting.',
        })
      }
    }

    // Check geofencing
    if (meeting.geofencing?.enabled) {
      if (lat == null || lng == null) {
        return res.status(400).json({
          success: false,
          error: 'LocationRequired',
          message: 'This meeting has geofencing enabled. Please allow location access in your browser and try scanning again.',
        })
      }

      // Haversine distance calculation
      const toRad = (deg) => (deg * Math.PI) / 180
      const R = 6371000 // Earth radius in metres
      const dLat = toRad(lat - meeting.geofencing.center.lat)
      const dLng = toRad(lng - meeting.geofencing.center.lng)
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(meeting.geofencing.center.lat)) *
          Math.cos(toRad(lat)) *
          Math.sin(dLng / 2) ** 2
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

      if (distance > meeting.geofencing.radius) {
        return res.status(400).json({
          success: false,
          error: 'OutOfRange',
          message: `You are outside the allowed geofence. You are approximately ${Math.round(distance)}m away, but you need to be within ${meeting.geofencing.radius}m of the meeting location to mark attendance.`,
        })
      }
    }

    // Check if already attended
    const existing = await Attendance.findOne({
      meeting: meeting._id,
      user: dbUser._id,
    }).lean()

    if (existing) {
      return res.status(200).json({
        success: true,
        data: {
          meeting: {
            _id: meeting._id,
            title: meeting.title,
            type: meeting.type,
            dateTime: meeting.dateTime,
            duration: meeting.duration,
            location: meeting.location,
          },
          alreadyAttended: true,
        },
        message: 'You have already marked attendance for this meeting.',
      })
    }

    // Build attendance record
    const record = {
      meeting: meeting._id,
      user: dbUser._id,
      method: 'qr',
      markedAt: now,
    }

    if (lat != null && lng != null) {
      record.location = {
        lat: Number(lat),
        lng: Number(lng),
        accuracy: accuracy != null ? Number(accuracy) : null,
      }
    }

    await Attendance.create(record)

    return res.status(201).json({
      success: true,
      data: {
        meeting: {
          _id: meeting._id,
          title: meeting.title,
          type: meeting.type,
          dateTime: meeting.dateTime,
          duration: meeting.duration,
          location: meeting.location,
        },
        alreadyAttended: false,
      },
      message: 'Attendance marked successfully!',
    })
  } catch (error) {
    console.error('❌ Scan QR attendance error:', error.message)

    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        data: { alreadyAttended: true },
        message: 'You have already marked attendance for this meeting.',
      })
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid QR code. The meeting ID is malformed.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to mark attendance. Please try again.',
    })
  }
}

/**
 * GET /api/attendance/meeting/:meetingId
 * Get all attendance records for a meeting (admin-only).
 */
const getMeetingAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params

    const records = await Attendance.find({ meeting: meetingId })
      .populate('user', 'name email photoURL role')
      .sort({ markedAt: 1 })
      .lean()

    return res.status(200).json({
      success: true,
      data: records,
      total: records.length,
    })
  } catch (error) {
    console.error('❌ Get meeting attendance error:', error.message)

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
      message: 'Failed to fetch attendance records.',
    })
  }
}

module.exports = {
  getAttendancePage,
  markAttendance,
  scanQRAttendance,
  getMeetingAttendance,
}
