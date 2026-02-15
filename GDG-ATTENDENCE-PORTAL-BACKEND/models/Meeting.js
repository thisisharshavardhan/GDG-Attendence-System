/**
 * Meeting Model
 *
 * Stores meeting data for GDG chapter events.
 *
 * Fields:
 *   title       – meeting name / title
 *   description – optional details about the meeting
 *   type        – 'offline' or 'online'
 *   dateTime    – scheduled start time
 *   duration    – meeting duration in minutes
 *   location    – physical address (offline) or "Online"
 *   meetingLink – Google Meet / Zoom link (online meetings)
 *   qrCode          – base64-encoded QR code image (offline)
 *   qrData          – the raw string encoded in the QR code (offline)
 *   attendanceToken – unique token for online attendance links
 *   createdBy   – reference to the admin User who created it
 *   isActive    – whether this meeting is currently in progress
 *   geofencing  – optional geofence for offline attendance validation
 *     .enabled  – whether geofencing is turned on
 *     .center   – { lat, lng } of the fence centre
 *     .radius   – fence radius in metres
 *   createdAt   – auto-set timestamp
 *   updatedAt   – auto-set timestamp
 */

const mongoose = require('mongoose')

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Meeting title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    type: {
      type: String,
      enum: {
        values: ['offline', 'online'],
        message: '{VALUE} is not a valid meeting type',
      },
      required: [true, 'Meeting type is required'],
    },
    dateTime: {
      type: Date,
      required: [true, 'Meeting date and time is required'],
    },
    duration: {
      type: Number,
      default: 60,
      min: [5, 'Duration must be at least 5 minutes'],
      max: [720, 'Duration cannot exceed 720 minutes (12 hours)'],
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    meetingLink: {
      type: String,
      trim: true,
      default: '',
    },
    qrCode: {
      type: String,
      default: '',
    },
    qrData: {
      type: String,
      default: '',
    },
    attendanceToken: {
      type: String,
      default: '',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    qrPaused: {
      type: Boolean,
      default: false,
    },
    participation: {
      type: String,
      enum: {
        values: ['anyone', 'selected'],
        message: '{VALUE} is not a valid participation type',
      },
      default: 'anyone',
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    geofencing: {
      enabled: {
        type: Boolean,
        default: false,
      },
      center: {
        lat: {
          type: Number,
          default: 0,
        },
        lng: {
          type: Number,
          default: 0,
        },
      },
      radius: {
        type: Number,
        default: 200,
        min: [10, 'Radius must be at least 10 metres'],
        max: [5000, 'Radius cannot exceed 5000 metres'],
      },
    },
  },
  {
    timestamps: true,
  }
)

// Index for fast queries on active meetings and date sorting
meetingSchema.index({ isActive: 1, dateTime: -1 })
meetingSchema.index({ createdBy: 1 })

module.exports = mongoose.model('Meeting', meetingSchema)
