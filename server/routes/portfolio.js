// =====================================================================
// routes/portfolio.js - Portfolio Management
// =====================================================================

const express = require('express');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ===== GET /api/portfolio - Get user holdings =====
router.get('/', protect, async (req, res) => {
  try {
    const holdings = await Portfolio.find({ userId: req.user._id });

    // Calculate current value (demo)
    const enriched = holdings.map((h) => ({
      ...h.toObject(),
      currentPrice: h.avgPrice * (1 + (Math.random() - 0.5) * 0.02),
      currentValue: h.shares * h.avgPrice,
      gainLoss: (h.shares * h.avgPrice) - (h.shares * h.avgPrice),
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== GET /api/portfolio/summary - Portfolio summary =====
router.get('/summary', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const holdings = await Portfolio.find({ userId: req.user._id });

    const totalValue = holdings.reduce((sum, h) => sum + (h.shares * h.avgPrice), 0);
    const totalCost = holdings.reduce((sum, h) => sum + (h.shares * h.avgPrice), 0);

    res.json({
      cash: user.balance,
      stocks: totalValue,
      total: user.balance + totalValue,
      gainLoss: totalValue - totalCost,
      holdingsCount: holdings.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
