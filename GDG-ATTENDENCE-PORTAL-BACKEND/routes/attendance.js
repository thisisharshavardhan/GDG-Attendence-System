/**
 * Attendance Routes
 *
 * Endpoints for online meeting attendance via unique links.
 *
 * GET    /api/attendance/:token       → get meeting info for attendance link (any auth user)
 * POST   /api/attendance/:token/mark  → mark attendance + get meeting link (any auth user)
 * GET    /api/attendance/meeting/:meetingId → get all attendance for a meeting (admin)
 */

const express = require('express')
const router = express.Router()

const { authenticate } = require('../middleware/auth')
const { authorize } = require('../middleware/role')
const {
  getAttendancePage,
  markAttendance,
  scanQRAttendance,
  getMeetingAttendance,
} = require('../controllers/attendanceController')

// All attendance routes require authentication
router.use(authenticate)

// Get attendance records for a meeting (admin-only) — place BEFORE /:token
router.get('/meeting/:meetingId', authorize('admin'), getMeetingAttendance)

// QR scan attendance (any authenticated user) — place BEFORE /:token
router.post('/scan-qr', scanQRAttendance)

// Get meeting info for an attendance link (any authenticated user)
router.get('/:token', getAttendancePage)

// Mark attendance via attendance link (any authenticated user)
router.post('/:token/mark', markAttendance)

module.exports = router
