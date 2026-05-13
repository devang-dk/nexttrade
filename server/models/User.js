// =====================================================================
// models/User.js - User Schema
// =====================================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
    },
    password: {
      type: String,
      required: function requiredPassword() {
        return this.authProvider === 'local';
      },
      minlength: 8,
      select: false, // Don't return password by default
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'phone'],
      default: 'local',
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    phone: {
      type: String,
      sparse: true,
      unique: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    balance: {
      type: Number,
      default: 10000.0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ===== MIDDLEWARE: Hash password before saving =====
userSchema.pre('save', async function (next) {
  if (!this.password) return next();
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ===== METHOD: Compare password =====
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ===== METHOD: Return JSON without password =====
userSchema.methods.toJSON = function () {
  const { __v, password, ...obj } = this.toObject();
  return obj;
};

module.exports = mongoose.model('User', userSchema);
