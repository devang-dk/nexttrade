// =====================================================================
// models/OTP.js - OTP Schema for Phone Authentication
// =====================================================================

const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      max: 5,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      index: { expires: 0 }, // Auto-delete after expiration
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OTP', otpSchema);
