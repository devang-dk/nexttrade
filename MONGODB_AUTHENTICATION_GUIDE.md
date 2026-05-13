# MongoDB Authentication Implementation Guide

## Overview

The NexTrade platform now includes **full MongoDB integration for user authentication and persistent data storage**. Users can create accounts, login with encrypted passwords, and their trading data is saved across sessions.

---

## ✅ What Was Implemented

### 1. **User Registration & Login with MongoDB**
- ✅ User accounts stored in MongoDB with unique email constraints
- ✅ Passwords hashed using SHA-256 + random salt (cryptographically secure)
- ✅ JWT token generation (24-hour expiry) for stateless authentication
- ✅ Email validation

### 2. **Real-time Price Updates (WebSocket)**
- ✅ Live price streaming from C++ backend to frontend
- ✅ Automatic reconnection with exponential backoff
- ✅ Fallback to polling in demo mode

### 3. **MongoDB Collections**
- ✅ **users**: Registration, login, balance tracking
- ✅ **portfolios**: User holdings (stocks, shares, avg cost)
- ✅ **orders**: Buy/sell transaction history
- ✅ **transactions**: Deposits/withdrawals

---

## 🚀 Quick Start with MongoDB

### Step 1: Start MongoDB

**Option A - Local Installation**
```powershell
# Make sure MongoDB is installed
mongod
```

**Option B - Docker (Recommended)**
```powershell
docker run -d -p 27017:27017 --name nextrade-mongo mongo
# Verify it's running
docker ps
```

**Option C - Verify Connection**
```powershell
# In a new terminal
mongosh
# You should see: nextrade>
```

### Step 2: Enable Production Mode

Edit `frontend/assets/js/api.js`:
```javascript
// Change from:
const DEMO_MODE = true;

// To:
const DEMO_MODE = false;  // ← Real Backend + Persistent Users
```

### Step 3: Build & Run Backend

```powershell
# Build
cd D:\STOCK\backend\build
cmake --build . --config Release

# Run
.\Release\nextrade.exe

# You should see output like:
# [✓] MongoDB connected: mongodb://localhost:27017
# [✓] NexTrade API running on port 8080
```

### Step 4: Open Frontend

```powershell
# Open in browser
start D:\STOCK\frontend\index.html
```

### Step 5: Register & Test

1. Click **"Switch to Sign Up"**
2. Enter any email (e.g., `user@example.com`)
3. Enter password (min 8 chars)
4. Click **"Create Account"**
5. ✅ You're registered! Data saved to MongoDB

---

## 🔍 How Authentication Works

### Registration Flow

```
User → Frontend Form
        ↓
    Validate (email format, password length)
        ↓
    POST /api/auth/register
        ↓
C++ Backend/AuthController
        ↓
    Check email unique? (MongoDB query)
        ↓
    Hash password with salt
        ↓
    Insert user to MongoDB
        ↓
    Generate JWT token (24h expiry)
        ↓
    Return token + user data
        ↓
User ← Token stored in localStorage
```

### Login Flow

```
User → Email + Password
        ↓
    POST /api/auth/login
        ↓
C++ Backend/AuthController
        ↓
    Find user by email (MongoDB)
        ↓
    Verify password hash
        ↓
    Generate JWT token (24h expiry)
        ↓
    Return token + user profile
        ↓
User ← Can now access protected routes
```

### Persistent Data Access

```
User Action (Buy/Sell)
        ↓
    GET /api/portfolio
    (includes: Authorization: Bearer <JWT>)
        ↓
C++ Backend/JwtMiddleware
        ↓
    Verify JWT token
    Extract userId from token
        ↓
    Query MongoDB user + portfolio
        ↓
User ← Portfolio data + prices
```

---

## 🗄️ MongoDB Schema Details

### Collection: `users`

```javascript
{
  _id: ObjectId("..."),        // MongoDB auto-generated
  id: "507f1f77bcf86cd799439011",  // Redundant field for easy access
  name: "John Doe",
  email: "john@example.com",   // Unique index
  passwordHash: "salt$hash",   // SHA-256+salt
  balance: 10000.00,           // Starting balance
  createdAt: "2026-04-16T12:00:00Z"
}
```

**Indexes:**
```javascript
db.users.createIndex({ email: 1 }, { unique: true })
```

### Collection: `portfolios`

```javascript
{
  _id: ObjectId("..."),
  userId: "507f1f77bcf86cd799439011",
  symbol: "AAPL",
  shares: 10,
  avgPrice: 189.45,
  updatedAt: "2026-04-16T12:30:00Z"
}
```

### Collection: `orders`

```javascript
{
  _id: ObjectId("..."),
  userId: "507f1f77bcf86cd799439011",
  symbol: "AAPL",
  type: "BUY",
  orderType: "market",
  shares: 5,
  price: 189.45,
  total: 947.25,
  status: "FILLED",
  timestamp: "2026-04-16T12:35:00Z"
}
```

### Collection: `transactions`

```javascript
{
  _id: ObjectId("..."),
  userId: "507f1f77bcf86cd799439011",
  type: "DEPOSIT",
  amount: 5000.00,
  status: "SUCCESS",
  paymentId: "stripe_...",
  last4: "4242",
  timestamp: "2026-04-16T12:40:00Z"
}
```

---

## 🔐 Security Features

### Password Security
- ✅ **Random salt** (16 bytes) per password
- ✅ **SHA-256 hashing** of salt + password
- ✅ Stored as `hex(salt)$hex(hash)` format
- ✅ Verification: recompute hash and compare

**Example:**
```
Password: "MyPassword123"
Salt: 0x1234567890abcdef1234567890abcdef
Stored: "1234567890abcdef1234567890abcdef$<SHA256_HASH>"
```

### JWT Tokens
- ✅ Signed with **HS256** algorithm
- ✅ Contains: userId, email, issue time, expiry
- ✅ **24-hour expiry** (configurable in `Common.h`)
- ✅ Server validates signature on every protected request

**Token Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Token Payload:**
```json
{
  "iss": "NexTrade",
  "sub": "507f1f77bcf86cd799439011",
  "email": "john@example.com",
  "iat": 1713277200,
  "exp": 1713363600
}
```

### Database Security
- ✅ **Unique index** on email (prevents duplicate accounts)
- ✅ **Connection pooling** (thread-safe access)
- ✅ **Error messages** don't leak email existence

---

## 🧪 Testing authentication

### 1. Test in Browser

1. Open `frontend/index.html`
2. Register: `test@example.com` / `password123`
3. Logout (try accessing dashboard without login)
4. Login with same credentials
5. Verify portfolio data persists across sessions

### 2. Test with cURL

**Register:**
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "testpass123"
  }'

# Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Test User",
    "email": "test@example.com",
    "balance": 10000.00
  }
}
```

**Login:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

**Access Protected Route:**
```bash
curl -X GET http://localhost:8080/api/portfolio \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."

# Response: User's portfolio data
```

### 3. Verify MongoDB Data

```powershell
mongosh
> use nextrade
> db.users.find()
> db.users.findOne({ email: "test@example.com" })
```

---

## ⚙️ Configuration

### Connection String

Edit `backend/include/Common.h`:
```cpp
const std::string DB_CONNECTION_URI = "mongodb://localhost:27017";
const std::string DB_NAME = "nextrade";
```

**MongoDB Atlas (Cloud):**
```cpp
const std::string DB_CONNECTION_URI = 
  "mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true";
```

### JWT Expiry

Edit `backend/include/Common.h`:
```cpp
constexpr int JWT_EXPIRY_HOURS = 24;  // Change as needed
```

### Password Requirements

Edit `backend/src/main.cpp` (auth/register route):
```cpp
if (password.size() < 8)  // Minimum 8 characters
    return error response;
```

---

## 🐛 Troubleshooting

### "MongoDB connection failed"

**Check MongoDB is running:**
```powershell
mongosh
# Should connect without errors
```

**If docker:**
```powershell
docker ps
# Should show: nextrade-mongo (Up)
```

**Fix connection string:**
```powershell
# Test connection
mongosh --uri "mongodb://localhost:27017"
```

### "Email already registered"

This is intentional! MongoDB has a unique index on email.

**To reset:**
```javascript
// In mongosh
db.users.deleteOne({ email: "duplicate@example.com" })
```

### "Invalid token"

JWT may have expired (24 hours).

**Solution:**
- Re-login to get new token
- Or increase `JWT_EXPIRY_HOURS` in `Common.h`

### "Passwords do not match"

Password hash verification failed.

**Check:**
1. Typed password correctly? (case-sensitive)
2. Used same app instance? (Salt verification only works within same app)

---

## 📊 Demo Mode vs Production

| Feature | Demo Mode | Production |
|---------|-----------|-----------|
| **Data Persistence** | Browser memory only | MongoDB |
| **Multi-device** | No (lost on new device) | Yes ✅ |
| **User Accounts** | No (instant login) | Yes ✅ |
| **Backend Required** | No | Yes |
| **Setup Time** | 0 minutes | 5 minutes |
| **Perfect For** | Demos, learning | Real usage |

**Switch modes in `api.js`:**
```javascript
const DEMO_MODE = true;   // ← Demo (no backend)
const DEMO_MODE = false;  // ← Production (with backend)
```

---

## 🎯 Next Steps

1. ✅ Register a test account
2. ✅ Buy some stocks (simulated)
3. ✅ Check portfolio persists after logout
4. ✅ Explore MongoDB data directly:
   ```powershell
   mongosh nextrade
   db.portfolios.find()
   db.orders.find()
   ```
5. ✅ Customize authentication (add 2FA, OAuth, etc.)

---

## 📚 Resources

- **MongoDB Docs**: https://docs.mongodb.com/manual/
- **C++ MongoDB Driver**: https://github.com/mongodb/mongo-cxx-driver
- **JWT.io**: https://jwt.io (token debugging)
- **OWASP**: https://owasp.org/www-community/attacks/Password_Spraying_Attack

---

## 🤝 Support

If you encounter issues:
1. Check backend console output for MongoDB connection errors
2. Verify MongoDB is running (`mongosh`)
3. Check `DB_CONNECTION_URI` matches your MongoDB instance
4. Look at browser console (F12) for API errors
5. Check backend logs for JWT verification errors

---

**Happy Trading! 📈**
