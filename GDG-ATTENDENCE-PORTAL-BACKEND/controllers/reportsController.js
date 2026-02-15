/**
 * Reports Controller
 *
 * Provides analytics endpoints for attendance data.
 *
 * Endpoints:
 *   GET /api/reports/summary          → overall stats (total meetings, attendance, etc.)
 *   GET /api/reports/meetings         → per-meeting attendance breakdown
 *   GET /api/reports/meeting/:id      → detailed attendance for one meeting
 *   GET /api/reports/members          → per-member attendance summary
 *   GET /api/reports/export/csv       → CSV export of all attendance data
 */

const Meeting = require('../models/Meeting')
const Attendance = require('../models/Attendance')
const User = require('../models/User')

/**
 * GET /api/reports/summary
 * Overall dashboard stats.
 */
const getSummary = async (req, res) => {
  try {
    const [totalMeetings, totalAttendance, totalMembers] = await Promise.all([
      Meeting.countDocuments(),
      Attendance.countDocuments(),
      User.countDocuments({ role: { $in: ['member', 'pr'] } }),
    ])

    const now = new Date()

    const [activeMeetings, upcomingMeetings, pastMeetings] = await Promise.all([
      Meeting.countDocuments({ isActive: true }),
      Meeting.countDocuments({ dateTime: { $gt: now } }),
      Meeting.countDocuments({ dateTime: { $lte: now } }),
    ])

    // Average attendance per meeting
    const avgPipeline = await Attendance.aggregate([
      { $group: { _id: '$meeting', count: { $sum: 1 } } },
      { $group: { _id: null, avg: { $avg: '$count' } } },
    ])
    const avgAttendance = avgPipeline.length > 0 ? Math.round(avgPipeline[0].avg * 10) / 10 : 0

    // Method breakdown
    const methodBreakdown = await Attendance.aggregate([
      { $group: { _id: '$method', count: { $sum: 1 } } },
    ])
    const methods = { qr: 0, link: 0 }
    methodBreakdown.forEach((m) => {
      methods[m._id] = m.count
    })

    // Attendance with location captured
    const withLocation = await Attendance.countDocuments({
      'location.lat': { $ne: null },
    })

    return res.status(200).json({
      success: true,
      data: {
        totalMeetings,
        totalAttendance,
        totalMembers,
        activeMeetings,
        upcomingMeetings,
        pastMeetings,
        avgAttendance,
        methods,
        withLocation,
      },
    })
  } catch (error) {
    console.error('❌ Reports summary error:', error.message)
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to fetch summary.',
    })
  }
}

/**
 * GET /api/reports/meetings
 * Per-meeting attendance count. Supports search and pagination.
 */
const getMeetingsReport = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sortBy = 'dateTime',
      order = 'desc',
    } = req.query

    const filter = {}
    if (search) {
      filter.title = { $regex: search, $options: 'i' }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const sortDir = order === 'asc' ? 1 : -1

    const [meetings, total] = await Promise.all([
      Meeting.find(filter)
        .select('title type dateTime duration location isActive')
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Meeting.countDocuments(filter),
    ])

    // Attach attendance counts
    const meetingIds = meetings.map((m) => m._id)
    const countPipeline = await Attendance.aggregate([
      { $match: { meeting: { $in: meetingIds } } },
      { $group: { _id: '$meeting', count: { $sum: 1 } } },
    ])
    const countMap = {}
    countPipeline.forEach((c) => {
      countMap[c._id.toString()] = c.count
    })

    const data = meetings.map((m) => ({
      ...m,
      attendanceCount: countMap[m._id.toString()] || 0,
    }))

    return res.status(200).json({
      success: true,
      data,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    })
  } catch (error) {
    console.error('❌ Meetings report error:', error.message)
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to fetch meetings report.',
    })
  }
}

/**
 * GET /api/reports/meeting/:id
 * Detailed attendance list for a single meeting.
 */
const getMeetingDetail = async (req, res) => {
  try {
    const { id } = req.params

    const meeting = await Meeting.findById(id)
      .select('title type dateTime duration location meetingLink isActive geofencing')
      .lean()

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Meeting not found.',
      })
    }

    const records = await Attendance.find({ meeting: id })
      .populate('user', 'name email photoURL role')
      .sort({ markedAt: 1 })
      .lean()

    return res.status(200).json({
      success: true,
      data: {
        meeting,
        attendance: records,
        total: records.length,
      },
    })
  } catch (error) {
    console.error('❌ Meeting detail report error:', error.message)

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid meeting ID.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to fetch meeting detail.',
    })
  }
}

/**
 * GET /api/reports/members
 * Per-member attendance summary (how many meetings each member attended).
 */
const getMembersReport = async (req, res) => {
  try {
    const pipeline = await Attendance.aggregate([
      { $group: { _id: '$user', totalAttended: { $sum: 1 }, lastAttended: { $max: '$markedAt' } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$user._id',
          name: '$user.name',
          email: '$user.email',
          photoURL: '$user.photoURL',
          role: '$user.role',
          totalAttended: 1,
          lastAttended: 1,
        },
      },
      { $sort: { totalAttended: -1 } },
    ])

    return res.status(200).json({
      success: true,
      data: pipeline,
    })
  } catch (error) {
    console.error('❌ Members report error:', error.message)
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to fetch members report.',
    })
  }
}

/**
 * GET /api/reports/export/csv
 * Export all attendance records as CSV.
 */
const exportCSV = async (req, res) => {
  try {
    const records = await Attendance.find()
      .populate('user', 'name email role')
      .populate('meeting', 'title type dateTime duration location')
      .sort({ 'meeting.dateTime': -1, markedAt: 1 })
      .lean()

    // Build CSV
    const headers = [
      'Meeting Title',
      'Meeting Type',
      'Meeting Date',
      'Member Name',
      'Member Email',
      'Role',
      'Method',
      'Marked At',
      'Latitude',
      'Longitude',
      'Accuracy (m)',
    ]

    const rows = records.map((r) => {
      const meetingDate = r.meeting?.dateTime
        ? new Date(r.meeting.dateTime).toISOString()
        : ''
      const markedAt = r.markedAt
        ? new Date(r.markedAt).toISOString()
        : ''

      return [
        `"${(r.meeting?.title || '').replace(/"/g, '""')}"`,
        r.meeting?.type || '',
        meetingDate,
        `"${(r.user?.name || '').replace(/"/g, '""')}"`,
        r.user?.email || '',
        r.user?.role || '',
        r.method || '',
        markedAt,
        r.location?.lat ?? '',
        r.location?.lng ?? '',
        r.location?.accuracy ?? '',
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=attendance-report-${Date.now()}.csv`
    )
    return res.status(200).send(csv)
  } catch (error) {
    console.error('❌ CSV export error:', error.message)
    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to export CSV.',
    })
  }
}

/**
 * GET /api/reports/meeting/:id/export/csv
 * Export attendance records for a single meeting as CSV.
 */
const exportMeetingCSV = async (req, res) => {
  try {
    const { id } = req.params

    const meeting = await Meeting.findById(id).select('title type dateTime').lean()
    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Meeting not found.',
      })
    }

    const records = await Attendance.find({ meeting: id })
      .populate('user', 'name email role')
      .sort({ markedAt: 1 })
      .lean()

    const headers = [
      'Meeting Title',
      'Meeting Type',
      'Meeting Date',
      'Member Name',
      'Member Email',
      'Role',
      'Method',
      'Marked At',
      'Latitude',
      'Longitude',
      'Accuracy (m)',
    ]

    const rows = records.map((r) => {
      const markedAt = r.markedAt ? new Date(r.markedAt).toISOString() : ''

      return [
        `"${(meeting.title || '').replace(/"/g, '""')}"`,
        meeting.type || '',
        meeting.dateTime ? new Date(meeting.dateTime).toISOString() : '',
        `"${(r.user?.name || '').replace(/"/g, '""')}"`,
        r.user?.email || '',
        r.user?.role || '',
        r.method || '',
        markedAt,
        r.location?.lat ?? '',
        r.location?.lng ?? '',
        r.location?.accuracy ?? '',
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')

    const safeTitle = meeting.title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${safeTitle}-attendance-${Date.now()}.csv`
    )
    return res.status(200).send(csv)
  } catch (error) {
    console.error('❌ Meeting CSV export error:', error.message)

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Invalid meeting ID.',
      })
    }

    return res.status(500).json({
      success: false,
      error: 'InternalError',
      message: 'Failed to export meeting CSV.',
    })
  }
}

module.exports = {
  getSummary,
  getMeetingsReport,
  getMeetingDetail,
  getMembersReport,
  exportCSV,
  exportMeetingCSV,
}
