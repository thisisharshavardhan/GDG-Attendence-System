/**
 * Meeting Auto-Activation Service
 *
 * Runs server-side on a fixed interval (every 30 seconds).
 * Automatically manages the `isActive` flag on meetings based on
 * their scheduled time and duration:
 *
 *   - Sets `isActive: true` when `now` is within [dateTime, dateTime + duration]
 *   - Sets `isActive: false` when `now` is past `dateTime + duration`
 *   - Also auto-generates a QR code when a meeting goes live (if it doesn't have one)
 *
 * This means admins no longer need to manually toggle meetings on/off.
 * The toggle-active endpoint still works for manual override.
 */

const Meeting = require('../models/Meeting')
const QRCode = require('qrcode')
const crypto = require('crypto')

const AUTO_ACTIVATE_INTERVAL = 30 // seconds — check every 30s

let intervalId = null

/**
 * Check all meetings and update their isActive status based on time window.
 */
async function checkAndUpdateMeetings() {
  try {
    const now = new Date()

    // 1. Activate meetings whose time window has started (now >= dateTime AND now < endTime)
    //    Only update meetings that are NOT already active, to avoid unnecessary writes.
    const meetingsToActivate = await Meeting.find({
      isActive: false,
      dateTime: { $lte: now },
    }).lean()

    for (const meeting of meetingsToActivate) {
      const endTime = new Date(
        new Date(meeting.dateTime).getTime() + (meeting.duration || 60) * 60000
      )

      if (now < endTime) {
        // Meeting is within its time window → activate it
        const update = { isActive: true }

        if (meeting.type === 'online') {
          // Auto-generate attendance token for online meetings (if missing)
          if (!meeting.attendanceToken) {
            const token = crypto.randomBytes(24).toString('hex')
            update.attendanceToken = token
            console.log(`🔗 Auto-generated attendance token for: "${meeting.title}"`)
          }
        } else {
          // Auto-generate QR if the offline meeting doesn't have one yet
          if (!meeting.qrCode) {
            const token = crypto.randomBytes(16).toString('hex')
            const qrPayload = JSON.stringify({
              meetingId: meeting._id,
              token,
              generatedAt: now.toISOString(),
            })

            const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
              width: 400,
              margin: 2,
              color: { dark: '#202124', light: '#FFFFFF' },
              errorCorrectionLevel: 'H',
            })

            update.qrCode = qrCodeDataUrl
            update.qrData = qrPayload
          }
        }

        await Meeting.findByIdAndUpdate(meeting._id, update)
        console.log(`✅ Auto-activated meeting: "${meeting.title}"`)
      }
    }

    // 2. Deactivate meetings whose time window has ended (now >= endTime)
    //    Only check currently active meetings.
    const activeMeetings = await Meeting.find({
      isActive: true,
    }).lean()

    for (const meeting of activeMeetings) {
      const endTime = new Date(
        new Date(meeting.dateTime).getTime() + (meeting.duration || 60) * 60000
      )

      if (now >= endTime) {
        await Meeting.findByIdAndUpdate(meeting._id, {
          isActive: false,
          qrCode: '',
          qrData: '',
          qrPaused: false,
          attendanceToken: '',
        })
        console.log(`⏹️  Auto-deactivated meeting: "${meeting.title}"`)
      }
    }
  } catch (err) {
    console.error('❌ Meeting auto-activation service error:', err.message)
  }
}

/**
 * Start the background auto-activation loop.
 */
function startAutoActivationService() {
  if (intervalId) return

  console.log(
    `⏰ Meeting auto-activation service started (every ${AUTO_ACTIVATE_INTERVAL}s)`
  )

  // Run once immediately on boot
  checkAndUpdateMeetings()

  intervalId = setInterval(checkAndUpdateMeetings, AUTO_ACTIVATE_INTERVAL * 1000)
}

/**
 * Stop the background auto-activation loop.
 */
function stopAutoActivationService() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('⏹️  Meeting auto-activation service stopped')
  }
}

module.exports = {
  startAutoActivationService,
  stopAutoActivationService,
  AUTO_ACTIVATE_INTERVAL,
}
