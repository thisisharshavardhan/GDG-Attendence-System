/**
 * Firebase Admin SDK Configuration
 *
 * Initializes the Firebase Admin SDK using the service account key.
 * This is the backend counterpart to the frontend Firebase client SDK.
 *
 * Industry best practices:
 * - Service account key loaded from a file outside version control
 * - Single initialization – module-level singleton
 * - Named exports for commonly used services
 */

const admin = require('firebase-admin')
const path = require('path')

// Path to service account key (relative to project root)
const serviceAccountPath = path.resolve(
  __dirname,
  '../config/serviceAccountKey.json'
)

let serviceAccount

try {
  serviceAccount = require(serviceAccountPath)
} catch (error) {
  console.error(
    '❌ Firebase service account key not found at:',
    serviceAccountPath
  )
  console.error(
    '   Please place your serviceAccountKey.json in the config/ directory.'
  )
  process.exit(1)
}

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
  console.log('✅ Firebase Admin SDK initialized')
}

module.exports = admin
