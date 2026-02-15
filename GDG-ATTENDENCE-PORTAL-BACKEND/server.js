/**
 * GDG Attendance Portal — Backend Server
 *
 * Express 5 + MongoDB + Firebase Admin SDK
 *
 * Architecture:
 *   - Firebase Admin verifies ID tokens (auth middleware)
 *   - MongoDB stores user profiles, meetings, attendance
 *   - Role-based access control (admin / pr / member)
 */

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')

// ── Route imports ────────────────────────────────────
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const meetingRoutes = require('./routes/meetings')
const attendanceRoutes = require('./routes/attendance')
const reportsRoutes = require('./routes/reports')

// ── Background services ─────────────────────────────
const { startQRRefreshService } = require('./services/qrRefreshService')
const { startAutoActivationService } = require('./services/autoActivationService')

// ── App initialization ───────────────────────────────
const app = express()
const PORT = process.env.PORT || 5000

// ── Global middleware ────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, mobile apps)
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  })
)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logger (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`)
    next()
  })
}

// ── Health check ─────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'GDG Attendance Portal API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  })
})

// ── API routes ───────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/meetings', meetingRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/reports', reportsRoutes)

// ── 404 handler ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: `Route ${req.method} ${req.path} not found`,
  })
})

// ── Global error handler (Express 5 style) ──────────
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err.stack || err.message)

  const statusCode = err.status || err.statusCode || 500

  res.status(statusCode).json({
    success: false,
    error: err.name || 'InternalError',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
  })
})

// ── Database connection & server start ───────────────
const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/gdg-attendance'

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected')

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`)
      console.log(`📡 API base: http://localhost:${PORT}/api`)

      // Start background QR auto-refresh for active meetings
      startQRRefreshService()

      // Start auto-activation service (activates/deactivates meetings by time)
      startAutoActivationService()
    })
  })
  .catch((error) => {
    console.error('❌ MongoDB connection failed:', error.message)
    process.exit(1)
  })

module.exports = app
