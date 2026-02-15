/**
 * User Model
 *
 * Stores user profile data synced from Firebase Auth.
 * The `role` field is managed server-side — never trust the client.
 *
 * Fields:
 *   firebaseUid – unique Firebase Auth UID (indexed)
 *   email       – user email from Firebase
 *   name        – display name
 *   photoURL    – profile picture URL
 *   role        – one of: admin, pr, member (default: member)
 *   createdAt   – auto-set timestamp
 *   updatedAt   – auto-set timestamp
 */

const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: [true, 'Firebase UID is required'],
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    photoURL: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'pr', 'member'],
        message: '{VALUE} is not a valid role',
      },
      default: 'member',
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('User', userSchema)
