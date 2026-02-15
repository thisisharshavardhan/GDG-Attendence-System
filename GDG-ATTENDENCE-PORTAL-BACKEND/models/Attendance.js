/**
 * Attendance Model
 *
 * Records individual attendance entries for meetings.
 *
 * Fields:
 *   meeting    – reference to the Meeting
 *   user       – reference to the User who attended
 *   method     – 'qr' (scanned QR) or 'link' (clicked attendance link)
 *   markedAt   – when attendance was recorded
 */

const mongoose = require('mongoose')

const attendanceSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    method: {
      type: String,
      enum: ['qr', 'link'],
      required: true,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
    },
  },
  {
    timestamps: true,
  }
)

// One attendance record per user per meeting
attendanceSchema.index({ meeting: 1, user: 1 }, { unique: true })
attendanceSchema.index({ meeting: 1 })
attendanceSchema.index({ user: 1 })

module.exports = mongoose.model('Attendance', attendanceSchema)
