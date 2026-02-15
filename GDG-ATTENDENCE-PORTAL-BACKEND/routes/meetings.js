/**
 * Meeting Routes
 *
 * CRUD endpoints for meeting management + QR generation.
 *
 * GET    /api/meetings          → list all meetings (authenticated)
 * GET    /api/meetings/active   → get active meetings (pr, admin)
 * GET    /api/meetings/:id      → get meeting by ID (authenticated)
 * POST   /api/meetings          → create meeting (admin-only)
 * PATCH  /api/meetings/:id      → update meeting (admin-only)
 * DELETE /api/meetings/:id      → delete meeting (admin-only)
 * POST   /api/meetings/:id/generate-qr    → generate QR code (admin-only)
 * PATCH  /api/meetings/:id/toggle-active   → toggle active status (admin-only)
 */

const express = require('express')
const router = express.Router()

const { authenticate } = require('../middleware/auth')
const { authorize } = require('../middleware/role')
const {
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
} = require('../controllers/meetingController')

// All meeting routes require authentication
router.use(authenticate)

// List all meetings (any authenticated user can view)
router.get('/', listMeetings)

// Get active meetings (PR + Admin)
router.get('/active', authorize('admin', 'pr'), getActiveMeetings)

// Get QR code + seconds-remaining for a meeting (admin, pr)
router.get('/:id/qr-status', authorize('admin', 'pr'), getQRStatus)

// Get a single meeting by ID
router.get('/:id', getMeetingById)

// Admin-only routes
router.post('/', authorize('admin'), createMeeting)
router.patch('/:id', authorize('admin'), updateMeeting)
router.delete('/:id', authorize('admin'), deleteMeeting)
router.post('/:id/generate-qr', authorize('admin'), generateQR)
router.post('/:id/generate-attendance-link', authorize('admin'), generateAttendanceLink)
router.patch('/:id/toggle-active', authorize('admin'), toggleActive)
router.patch('/:id/qr-pause', authorize('admin'), toggleQRPause)

module.exports = router
