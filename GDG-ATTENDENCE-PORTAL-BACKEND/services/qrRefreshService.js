/**
 * QR Auto-Refresh Service
 *
 * Runs server-side on a fixed 20-second tick.
 * Regenerates QR codes for every meeting with `isActive: true`.
 *
 * Exposes `getSecondsUntilNextRefresh()` so API endpoints can
 * tell the client exactly how many seconds remain before the
 * next QR rotation.
 */

const Meeting = require('../models/Meeting')
const QRCode = require('qrcode')
const crypto = require('crypto')

const QR_REFRESH_INTERVAL = 20 // seconds

let intervalId = null
let lastRefreshedAt = null // Date when QR codes were last regenerated

/**
 * How many whole seconds until the next server-side QR refresh.
 */
function getSecondsUntilNextRefresh() {
  if (!lastRefreshedAt) return 0
  const elapsed = (Date.now() - lastRefreshedAt.getTime()) / 1000
  const remaining = Math.max(0, Math.ceil(QR_REFRESH_INTERVAL - elapsed))
  return remaining
}

/**
 * Regenerate QR codes for every meeting that has a QR code.
 * This covers both active meetings and any meeting whose QR modal
 * is open (the admin clicked "Generate QR" at some point).
 * Uses findOneAndUpdate to avoid Mongoose VersionError conflicts.
 */
async function refreshQRCodes() {
  try {
    const meetings = await Meeting.find({
      qrCode: { $exists: true, $ne: '' },
      qrPaused: { $ne: true },
    }).select('_id').lean()

    // Always update the timestamp so the countdown stays in sync
    lastRefreshedAt = new Date()

    if (meetings.length === 0) return

    const updates = meetings.map(async (meeting) => {
      try {
        const token = crypto.randomBytes(16).toString('hex')
        const qrPayload = JSON.stringify({
          meetingId: meeting._id,
          token,
          generatedAt: lastRefreshedAt.toISOString(),
        })

        const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
          width: 400,
          margin: 2,
          color: { dark: '#202124', light: '#FFFFFF' },
          errorCorrectionLevel: 'H',
        })

        // Use atomic update to avoid version conflicts with API handlers
        await Meeting.findByIdAndUpdate(meeting._id, {
          qrCode: qrCodeDataUrl,
          qrData: qrPayload,
        })
      } catch (err) {
        console.error(`❌ QR refresh failed for meeting ${meeting._id}:`, err.message)
      }
    })

    await Promise.all(updates)
    console.log(`🔄 QR refreshed for ${meetings.length} meeting(s)`)
  } catch (err) {
    console.error('❌ QR refresh service error:', err.message)
  }
}

/**
 * Start the background QR refresh loop.
 */
function startQRRefreshService() {
  if (intervalId) return

  console.log(`🔄 QR auto-refresh service started (every ${QR_REFRESH_INTERVAL}s)`)

  // Run once immediately so meetings with QR codes get a fresh QR on boot
  refreshQRCodes()

  intervalId = setInterval(refreshQRCodes, QR_REFRESH_INTERVAL * 1000)
}

/**
 * Stop the background QR refresh loop.
 */
function stopQRRefreshService() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('⏹️  QR auto-refresh service stopped')
  }
}

module.exports = {
  startQRRefreshService,
  stopQRRefreshService,
  getSecondsUntilNextRefresh,
  QR_REFRESH_INTERVAL,
}
