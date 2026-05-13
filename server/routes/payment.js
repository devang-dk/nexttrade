// =====================================================================
// routes/payment.js - Payment Management
// =====================================================================

const express = require('express');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ===== POST /api/payment/deposit =====
router.post('/deposit', protect, async (req, res) => {
  try {
    const { amount, cardDetails } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 1800));

    const user = await User.findById(req.user._id);
    user.balance += amount;
    await user.save();

    const transaction = await Transaction.create({
      userId: req.user._id,
      type: 'DEPOSIT',
      amount,
      status: 'SUCCESS',
      paymentId: `txn_${Date.now()}`,
      last4: cardDetails?.cardNumber?.slice(-4) || '****',
    });

    res.status(201).json({
      success: true,
      transaction: transaction.toObject(),
      balance: user.balance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== POST /api/payment/withdraw =====
router.post('/withdraw', protect, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const user = await User.findById(req.user._id);

    if (user.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Simulate withdrawal processing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    user.balance -= amount;
    await user.save();

    const transaction = await Transaction.create({
      userId: req.user._id,
      type: 'WITHDRAWAL',
      amount,
      status: 'SUCCESS',
      paymentId: `txn_${Date.now()}`,
    });

    res.status(201).json({
      success: true,
      transaction: transaction.toObject(),
      balance: user.balance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== GET /api/payment/history =====
router.get('/history', protect, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id }).sort({ timestamp: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
