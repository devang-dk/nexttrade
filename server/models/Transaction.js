// =====================================================================
// models/Transaction.js - Payment Transactions
// =====================================================================

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['DEPOSIT', 'WITHDRAWAL'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
      default: 'SUCCESS',
    },
    paymentId: String,
    last4: String, // Last 4 digits of card
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for user transactions
transactionSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
