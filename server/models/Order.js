// =====================================================================
// models/Order.js - Trading Orders
// =====================================================================

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ['BUY', 'SELL'],
      required: true,
    },
    orderType: {
      type: String,
      enum: ['market', 'limit', 'stop'],
      default: 'market',
    },
    shares: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'FILLED', 'CANCELLED'],
      default: 'FILLED',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for user orders sorted by timestamp
orderSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Order', orderSchema);
