// =====================================================================
// routes/auth.js - Authentication Endpoints
// =====================================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendGoogleLoginEmail, sendWelcomeEmail } = require('../services/emailService');
const OTP = require('../models/OTP');
const { generateOTP, sendOTP } = require('../services/smsService');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || undefined);

const normalizePhoneNumber = (input = '') => {
  const value = String(input).trim();
  if (!value) return '';

  // Keep leading '+' for international numbers and strip non-digit separators.
  if (value.startsWith('+')) {
    return `+${value.slice(1).replace(/\D/g, '')}`;
  }

  // Fallback: treat plain digits as an international number without '+' prefix.
  const digitsOnly = value.replace(/\D/g, '');
  return digitsOnly ? `+${digitsOnly}` : '';
};

// ===== Helper: Generate JWT =====
const signToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'nextrade_jwt_secret_change_in_production',
    {
      expiresIn: process.env.JWT_EXPIRY || '24h',
    }
  );
};

// ===== POST /api/auth/demo =====
// Creates (or reuses) a demo account and returns a real JWT so all protected
// routes (buy, sell, portfolio) work without requiring a real registration.
router.post('/demo', async (req, res) => {
  try {
    const DEMO_EMAIL = 'demo@nextrade.com';

    let user = await User.findOne({ email: DEMO_EMAIL });

    if (!user) {
      user = await User.create({
        name: 'Demo Trader',
        email: DEMO_EMAIL,
        password: 'demo_password_' + Date.now(), // random so it can't be guessed
        balance: 10000.00,
      });
    } else {
      // Always reset demo balance to $10,000 on fresh login
      user.balance = 10000.00;
      await user.save();
    }

    const token = signToken(user._id);

    res.status(200).json({
      token,
      user: {
        id:      user._id,
        name:    user.name,
        email:   user.email,
        balance: user.balance,
        demo:    true,
      },
    });
  } catch (error) {
    console.error('Demo login error:', error.message);
    res.status(500).json({ message: 'Demo login failed' });
  }
});

// ===== POST /api/auth/register =====
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
    });

    // Generate token
    const token = signToken(user._id);

    // Send welcome email (failures should not block signup)
    try {
      await sendWelcomeEmail(user);
    } catch (mailError) {
      console.error('Welcome email error:', mailError.message);
    }

    res.status(201).json({
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== POST /api/auth/login =====
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user and get password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'This account uses Google sign-in. Please continue with Google.' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = signToken(user._id);

    res.status(200).json({
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== GET /api/auth/google/config =====
router.get('/google/config', (req, res) => {
  res.json({
    enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  });
});

// ===== POST /api/auth/google =====
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: 'Google login is not configured on server' });
    }

    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: 'Invalid Google token payload' });
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const name = payload.name || email.split('@')[0];
    const avatar = payload.picture || '';

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        authProvider: 'google',
        avatar,
      });
    } else {
      const updates = {};
      if (!user.googleId) updates.googleId = googleId;
      if (user.authProvider !== 'google') updates.authProvider = 'google';
      if (avatar && user.avatar !== avatar) updates.avatar = avatar;
      if (name && user.name !== name) updates.name = name;

      if (Object.keys(updates).length > 0) {
        user = await User.findByIdAndUpdate(user._id, updates, { new: true });
      }
    }

    const token = signToken(user._id);

    // Email failures should not block successful authentication.
    try {
      await sendGoogleLoginEmail(user);
    } catch (mailError) {
      console.error('Google login email error:', mailError.message);
    }

    res.status(200).json({
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Google auth error:', error.message);
    res.status(401).json({ message: 'Google authentication failed' });
  }
});

// ===== GET /api/auth/me - Get current user =====
router.get('/me', protect, async (req, res) => {
  try {
    res.json({ user: req.user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== POST /api/auth/phone/request-otp =====
// Request OTP for phone number (login or signup)
router.post('/phone/request-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone || normalizedPhone.length < 11) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    // Check if phone exists
    const existingUser = await User.findOne({ phone: normalizedPhone });
    const isNewUser = !existingUser;

    // Delete any existing OTP for this phone
    await OTP.deleteMany({ phone: normalizedPhone });

    // Generate and send OTP
    const otp = generateOTP(6);
    let smsResult;

    try {
      smsResult = await sendOTP(normalizedPhone, otp);
    } catch (smsError) {
      // Twilio trial accounts can fail for unverified numbers.
      // Allow OTP flow in non-production so local testing still works.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('SMS delivery failed in dev mode:', smsError.message);
        smsResult = { skipped: true, reason: `SMS failed: ${smsError.message}` };
      } else {
        throw smsError;
      }
    }

    // Save OTP to database
    await OTP.create({
      phone: normalizedPhone,
      code: otp,
    });

    const response = {
      message: smsResult.skipped ? 'OTP generated (SMS not sent)' : 'OTP sent to phone number',
      isNewUser,
      phone: `${normalizedPhone.slice(0, 3)}****${normalizedPhone.slice(-4)}`,
    };

    if (process.env.NODE_ENV !== 'production' && smsResult.skipped) {
      response.devOtp = otp;
      response.message = `${response.message}. Use the displayed OTP for testing.`;
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('OTP request error:', error.message);
    res.status(500).json({ message: `Failed to send OTP: ${error.message}` });
  }
});

// ===== POST /api/auth/phone/verify-otp =====
// Verify OTP and login/signup user
router.post('/phone/verify-otp', async (req, res) => {
  try {
    const { phone, otp, name } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone and OTP are required' });
    }

    const normalizedPhone = normalizePhoneNumber(phone);

    // Find OTP record
    const otpRecord = await OTP.findOne({
      phone: normalizedPhone,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(401).json({ message: 'OTP expired or not found' });
    }

    // Check max attempts
    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ message: 'Too many attempts. Request a new OTP.' });
    }

    // Verify OTP
    if (otpRecord.code !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    // OTP verified - delete it
    await OTP.deleteOne({ _id: otpRecord._id });

    // Find or create user
    let user = await User.findOne({ phone: normalizedPhone });
    const isNewUser = !user;

    if (!user) {
      // New user signup
      if (!name) {
        return res.status(400).json({ message: 'Name is required for new users' });
      }

      const phoneDigits = normalizedPhone.replace(/\D/g, '');

      user = await User.create({
        name,
        phone: normalizedPhone,
        email: `phone${phoneDigits}@nextrade.com`,
        authProvider: 'phone',
      });

      // Send welcome email
      try {
        await sendWelcomeEmail(user);
      } catch (mailError) {
        console.error('Welcome email error:', mailError.message);
      }
    }

    // Generate token
    const token = signToken(user._id);

    res.status(200).json({
      token,
      user: user.toJSON(),
      isNewUser,
    });
  } catch (error) {
    console.error('OTP verification error:', error.message);
    res.status(500).json({ message: 'OTP verification failed' });
  }
});

module.exports = router;
