/**
 * Reports Routes
 *
 * All routes require admin authentication.
 *
 * GET  /api/reports/summary           → overall dashboard stats
 * GET  /api/reports/meetings          → per-meeting attendance breakdown
 * GET  /api/reports/meeting/:id       → detailed attendance for one meeting
 * GET  /api/reports/members           → per-member attendance summary
 * GET  /api/reports/export/csv        → CSV download of all attendance
 */

const express = require('express')
const router = express.Router()

const { authenticate } = require('../middleware/auth')
const { authorize } = require('../middleware/role')
const {
  getSummary,
  getMeetingsReport,
  getMeetingDetail,
  getMembersReport,
  exportCSV,
  exportMeetingCSV,
} = require('../controllers/reportsController')

// All reports routes require admin authentication
router.use(authenticate)
router.use(authorize('admin'))

router.get('/summary', getSummary)
router.get('/meetings', getMeetingsReport)
router.get('/meeting/:id/export/csv', exportMeetingCSV)
router.get('/meeting/:id', getMeetingDetail)
router.get('/members', getMembersReport)
router.get('/export/csv', exportCSV)

module.exports = router
