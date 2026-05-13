// =====================================================================
// routes/orders.js - Order Management
// =====================================================================

const express = require('express');
const Order = require('../models/Order');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ===== POST /api/orders/buy =====
router.post('/buy', protect, async (req, res) => {
  try {
    const { symbol, shares, price, orderType = 'market' } = req.body;

    if (!symbol || !shares || !price) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!['market', 'limit', 'stop'].includes(orderType)) {
      return res.status(400).json({ message: 'Invalid order type' });
    }

    const total = shares * price;
    const user = await User.findById(req.user._id);

    let order;
    if (orderType === 'market') {
      // Check balance
      if (user.balance < total) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }

      // Deduct balance
      user.balance -= total;
      await user.save();

      // Create filled order
      order = await Order.create({
        userId: req.user._id,
        symbol,
        type: 'BUY',
        orderType,
        shares,
        price,
        total,
        status: 'FILLED',
      });

      // Update or create portfolio
      const holding = await Portfolio.findOne({ userId: req.user._id, symbol });
      if (holding) {
        const newShares = holding.shares + shares;
        const newCost = holding.shares * holding.avgPrice + total;
        holding.avgPrice = newCost / newShares;
        holding.shares = newShares;
        await holding.save();
      } else {
        await Portfolio.create({
          userId: req.user._id,
          symbol,
          shares,
          avgPrice: price,
        });
      }
    } else {
      // Non-market orders are placed as pending.
      order = await Order.create({
        userId: req.user._id,
        symbol,
        type: 'BUY',
        orderType,
        shares,
        price,
        total,
        status: 'PENDING',
      });
    }

    res.status(201).json({
      success: true,
      order: order.toObject(),
      balance: user.balance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== POST /api/orders/sell =====
router.post('/sell', protect, async (req, res) => {
  try {
    const { symbol, shares, price, orderType = 'market' } = req.body;

    if (!['market', 'limit', 'stop'].includes(orderType)) {
      return res.status(400).json({ message: 'Invalid order type' });
    }

    // Check holding
    const holding = await Portfolio.findOne({ userId: req.user._id, symbol });
    if (!holding || holding.shares < shares) {
      return res.status(400).json({ message: 'Insufficient shares' });
    }

    const user = await User.findById(req.user._id);
    const proceeds = shares * price;
    let order;

    if (orderType === 'market') {
      // Add proceeds to balance
      user.balance += proceeds;
      await user.save();

      // Create filled order
      order = await Order.create({
        userId: req.user._id,
        symbol,
        type: 'SELL',
        orderType,
        shares,
        price,
        total: proceeds,
        status: 'FILLED',
      });

      // Update holding
      holding.shares -= shares;
      if (holding.shares === 0) {
        await Portfolio.deleteOne({ _id: holding._id });
      } else {
        await holding.save();
      }
    } else {
      order = await Order.create({
        userId: req.user._id,
        symbol,
        type: 'SELL',
        orderType,
        shares,
        price,
        total: proceeds,
        status: 'PENDING',
      });
    }

    res.status(201).json({
      success: true,
      order: order.toObject(),
      balance: user.balance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== GET /api/orders/history =====
router.get('/history', protect, async (req, res) => {
  try {
    const status = req.query.status;
    const filter = { userId: req.user._id };
    if (status && ['PENDING', 'FILLED', 'CANCELLED'].includes(status)) {
      filter.status = status;
    }

    const orders = await Order.find(filter).sort({ timestamp: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== PATCH /api/orders/:id/cancel =====
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'PENDING') {
      return res.status(400).json({ message: 'Only pending orders can be cancelled' });
    }

    order.status = 'CANCELLED';
    await order.save();
    res.json({ success: true, order: order.toObject() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
