// =====================================================================
// models/Portfolio.js - User Holdings
// =====================================================================

const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    symbol: {
      type: String,
      required: true,
    },
    shares: {
      type: Number,
      required: true,
    },
    avgPrice: {
      type: Number,
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Unique index on user + symbol
portfolioSchema.index({ userId: 1, symbol: 1 }, { unique: true });

module.exports = mongoose.model('Portfolio', portfolioSchema);
