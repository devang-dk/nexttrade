# NexTrade — Full-Stack Stock Trading Platform

> A professional-grade stock trading platform with **C++ backend**, **MongoDB** database, **real-time market data**, **interactive charts**, and a **modern dark-theme web UI**.

---

## 🖥️ Screenshots / Features

| Feature | Description |
|---|---|
| 📈 **Live Charts** | TradingView Lightweight Charts — Candlestick, Line, Area |
| ⚡ **Real-time Prices** | Yahoo Finance API + WebSocket broadcasting |
| 💼 **Portfolio Tracker** | Live P&L, holdings, donut allocation chart |
| 🛒 **Order Execution** | Market / Limit / Stop orders with confirmation modal |
| 🎯 **Watchlist** | Clickable symbol list with live price updates |
| 💳 **Payment Gateway** | Stripe-like deposit/withdraw UI with transaction history |
| 🔐 **Authentication** | JWT + SHA-256 password hashing |
| 🍃 **MongoDB** | Full data persistence for users, orders, portfolio, transactions |
| 🔌 **WebSocket** | Real-time price stream to all connected clients |

---

## 🏗️ Architecture

```
Browser (HTML + CSS + JS)
        │  REST API + WebSocket
        ▼
C++ Backend (Crow HTTP Framework) ─── MongoDB
        │
        └─── Yahoo Finance API (market data)
```

---

## 🚀 Quick Start (Demo Mode — No Setup Required)

The fastest way to see the platform running:

1. Open `frontend/index.html` in your browser
2. Click **"Try Demo Account"**
3. You get **$10,000 paper trading balance** instantly
4. Search stocks, buy/sell, view portfolio, make deposits — everything works!

> ✅ The entire frontend works **without** the C++ backend using simulated market data.

---

## ⚙️ Full Setup (With C++ Backend + MongoDB)

### Prerequisites

| Tool | Download | Notes |
|---|---|---|
| **VS Code** | [code.visualstudio.com](https://code.visualstudio.com) | ✅ Already have |
| **VS Build Tools 2022** | [visualstudio.microsoft.com/downloads](https://visualstudio.microsoft.com/downloads/) | Select "Desktop development with C++" |
| **CMake** (≥ 3.16) | [cmake.org/download](https://cmake.org/download/) | Add to PATH |
| **vcpkg** | See below | C++ package manager |
| **MongoDB Community** | [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community) | Optional — runs in demo mode without it |
| **Git** | [git-scm.com](https://git-scm.com) | Required for vcpkg |

### Step 1: Install vcpkg

```powershell
# Run in PowerShell as Administrator
git clone https://github.com/microsoft/vcpkg.git C:\vcpkg
C:\vcpkg\bootstrap-vcpkg.bat

# Set environment variable (permanent)
[System.Environment]::SetEnvironmentVariable('VCPKG_ROOT', 'C:\vcpkg', 'User')
# Restart PowerShell after this!
```

### Step 2: Run the Setup Script

```powershell
# From D:\STOCK directory
powershell -ExecutionPolicy Bypass -File setup.ps1
```

This will automatically:
- ✅ Check all prerequisites
- ✅ Install C++ dependencies (Crow, mongocxx, curl, jwt-cpp, nlohmann/json)
- ✅ Configure CMake
- ✅ Build the backend
- ✅ Launch the server + open the frontend

### Step 2b: Start MongoDB

Before running the backend server, ensure MongoDB is running:

**Option A: Local MongoDB Installation**
```powershell
# If you installed MongoDB Community Edition
mongod

# In another terminal, verify connection
mongosh
> show dbs
```

**Option B: Docker (Recommended)**
```powershell
# Install Docker first, then:
docker run -d -p 27017:27017 --name nextrade-mongo mongo
```

**Option C: MongoDB Atlas (Cloud)**
1. Create account at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a free cluster
3. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true`
4. Update `DB_CONNECTION_URI` in `backend/include/Common.h`

### Step 3: Manual Build (if setup.ps1 didn't work)

```powershell
# Install dependencies
cd D:\STOCK\backend
$env:VCPKG_ROOT = "C:\vcpkg"
C:\vcpkg\vcpkg.exe install crow mongo-cxx-driver nlohmann-json curl openssl jwt-cpp

# Configure and build
mkdir build && cd build
cmake .. -DCMAKE_TOOLCHAIN_FILE="C:\vcpkg\scripts\buildsystems\vcpkg.cmake" -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release

# Run
.\Release\nextrade.exe
```

---

## 📁 Project Structure

```
D:\STOCK\
├── frontend\                    # Web UI (open index.html in browser)
│   ├── index.html              # Login / Register page
│   ├── dashboard.html          # Trading dashboard (charts + orders)
│   ├── portfolio.html          # Holdings + P&L + allocation chart
│   ├── payment.html            # Deposit / Withdraw funds
│   └── assets\
│       ├── css\main.css        # Complete dark-theme design system
│       └── js\
│           ├── api.js          # API client + demo data engine
│           ├── auth.js         # JWT session management
│           ├── charts.js       # TradingView Lightweight Charts
│           ├── dashboard.js    # Trading UI logic
│           ├── portfolio.js    # Portfolio calculations + donut chart
│           └── payment.js      # Payment flow + card formatting
│
├── backend\                     # C++ Backend (Crow + MongoDB)
│   ├── CMakeLists.txt
│   ├── vcpkg.json
│   ├── include\
│   │   ├── Common.h            # Shared models + utilities
│   │   ├── MongoManager.h      # MongoDB connection pool
│   │   ├── AuthController.h    # Auth header
│   │   ├── TradingController.h # Trading header
│   │   ├── MarketDataService.h # Market data header
│   │   └── PaymentService.h    # Payment header
│   └── src\
│       ├── main.cpp            # Crow server + all routes + WebSocket
│       ├── db\MongoManager.cpp
│       ├── auth\AuthController.cpp
│       ├── trading\TradingController.cpp
│       ├── market\MarketDataService.cpp
│       └── payment\PaymentService.cpp
│
├── setup.ps1                    # Automated setup script
└── README.md                    # This file
```

---

## 🔐 Authentication & MongoDB Integration

### How It Works

The platform supports **two authentication modes**:

#### 1️⃣ **Demo Mode** (Default - No Backend Required)
- Runs entirely in browser memory
- Instant login without registration
- Perfect for testing and demos
- User data lost on page refresh
- **Configuration**: `DEMO_MODE = true` in `api.js`

#### 2️⃣ **Production Mode** (Real Backend + MongoDB)
- User accounts persisted in MongoDB
- Encrypted password storage (SHA-256 + salt)
- JWT-based session tokens (24-hour expiry)
- Cross-session user data (portfolio, orders, transactions)
- **Configuration**: `DEMO_MODE = false` in `api.js`

### Switching Between Modes

**To use Demo Mode (no setup needed):**
```javascript
// frontend/assets/js/api.js
const DEMO_MODE = true;  // ← Users login instantly, data in memory
```

**To use Production Mode (Real Backend):**
```javascript
// frontend/assets/js/api.js
const DEMO_MODE = false; // ← Requires backend + MongoDB

// Also ensure MongoDB is running:
// > mongod
// or
// > docker run -d -p 27017:27017 mongo

// And backend server is running:
// > .\backend\build\Release\nextrade.exe
```

### User Registration Flow

1. **Demo Mode**: User data stored in browser localStorage
2. **Production Mode**: 
   - Password is hashed using SHA-256 + random salt
   - User document stored in MongoDB with:
     - Email (unique index)
     - Password hash
     - Starting balance: $10,000
     - Creation timestamp
   - JWT token returned to client
   - Token automatically sent in all subsequent requests

### Database Operations

**Insert User**
```cpp
db.users.insertOne({
  _id: ObjectId(...),
  id: "507f1f77bcf86cd799439011",
  name: "John Doe",
  email: "john@example.com",
  passwordHash: "salt$hash",
  balance: 10000.00,
  createdAt: "2026-04-16T12:00:00Z"
})
```

**Login Query**
```cpp
// Find user by email
db.users.findOne({ email: "john@example.com" })

// Verify password hash
bool verified = AuthController::verifyPassword(userInput, storedHash)

// Return JWT token valid for 24 hours
```

**Update User Balance**
```cpp
// After buy/sell order
db.users.updateOne(
  { _id: ObjectId(...) },
  { $set: { balance: 9500.50 } }
)
```

### Testing the Authentication

**Test Registration (Backend Running)**
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "password": "SecurePass123"
  }'

# Response:
{
  "token": "eyJhbGc...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "balance": 10000.00
  }
}
```

**Test Login (Backend Running)**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "password": "SecurePass123"
  }'
```

**Verify Token**
```bash
curl -X GET http://localhost:8080/api/portfolio \
  -H "Authorization: Bearer eyJhbGc..."
```

### MongoDB Connection Issues

If you see `[! MongoDB connection failed]`:

1. **Check MongoDB is running**
   ```bash
   mongosh  # Should connect without errors
   ```

2. **Check connection string**
   - Default: `mongodb://localhost:27017`
   - Edit in: `backend/include/Common.h` - `DB_CONNECTION_URI`

3. **Create index manually** (Optional)
   ```javascript
   // In mongosh
   use nextrade
   db.users.createIndex({ email: 1 }, { unique: true })
   ```

4. **Test connection programmatically**
   - Backend automatically tests on startup
   - Check console output for `[MongoDB] Connected`

---

## 🌐 API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET`  | `/health` | No | Server health check |
| `POST` | `/api/auth/register` | No | Create account |
| `POST` | `/api/auth/login` | No | Login + get JWT |
| `GET`  | `/api/market/quote/:symbol` | Yes | Real-time quote |
| `GET`  | `/api/market/history/:symbol?interval=1M` | Yes | OHLCV chart data |
| `GET`  | `/api/market/search?q=AAPL` | Yes | Symbol search |
| `GET`  | `/api/market/movers` | Yes | Top market movers |
| `GET`  | `/api/portfolio` | Yes | User holdings |
| `POST` | `/api/orders/buy` | Yes | Execute buy order |
| `POST` | `/api/orders/sell` | Yes | Execute sell order |
| `GET`  | `/api/orders/history` | Yes | Order history |
| `POST` | `/api/payment/deposit` | Yes | Deposit funds |
| `POST` | `/api/payment/withdraw` | Yes | Withdraw funds |
| `GET`  | `/api/payment/history` | Yes | Transaction log |
| `WS`   | `/ws/prices` | No | Real-time price stream |

### Example: Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"yourpassword"}'
```

### Example: Buy Order
```bash
curl -X POST http://localhost:8080/api/orders/buy \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","shares":5,"price":189.45,"orderType":"market"}'
```

---

## 🍃 MongoDB Schema

```js
// users
{ name, email, passwordHash, balance: 10000.00, createdAt }

// portfolios (holdings)
{ userId, symbol, shares, avgPrice, updatedAt }

// orders
{ userId, symbol, type: "BUY"|"SELL", orderType, shares, price, total, status, timestamp }

// transactions
{ userId, type: "DEPOSIT"|"WITHDRAWAL", amount, status, paymentId, last4, timestamp }
```

---

## 📈 Market Data

The platform uses **Yahoo Finance** (free, no API key) with automatic fallback:

1. **Primary**: Yahoo Finance REST API — real live prices
2. **Fallback**: Simulated prices with realistic random walk — used when Yahoo is rate-limited

---

## 💳 Payment Gateway

The payment system is built with a **Stripe-ready architecture**:
- Mock mode: Simulates payment processing (no real money)
- To enable Stripe: Replace the mock in `PaymentService.cpp` with `stripe-cpp` SDK calls
- All transaction records are stored in MongoDB

---

## 🔐 Security Features

- JWT tokens with 24-hour expiry
- SHA-256 + random salt password hashing
- CORS configured for cross-origin requests
- JWT middleware on all protected routes
- Input validation on all endpoints

---

## 🛠️ Development Tips

### VS Code Extensions (Recommended)
- **C/C++** (Microsoft)
- **CMake Tools** (Microsoft)
- **MongoDB for VS Code**
- **REST Client** (for testing APIs)

### Run Frontend Only (Dev)
Simply open `frontend/index.html` directly in Chrome/Firefox. No web server needed.

### Connect Frontend to Real Backend
In `frontend/assets/js/api.js`, change:
```js
const DEMO_MODE = true;   // Change to false when backend is running
const API_BASE  = 'http://localhost:8080/api';
```

---

## 📦 Tech Stack Summary

| Component | Technology |
|---|---|
| Backend language | **C++17** |
| HTTP framework | **Crow** |
| Database | **MongoDB** (mongocxx driver) |
| Authentication | **JWT-cpp** + SHA-256/OpenSSL |
| Market data | **Yahoo Finance API** + libcurl |
| WebSocket | **Crow built-in** |
| Payment | **Mock gateway** (Stripe-ready) |
| Build system | **CMake** + vcpkg |
| Frontend | **HTML5** + Vanilla CSS + JavaScript |
| Charts | **TradingView Lightweight Charts v4** |
| Font | **Inter** + **JetBrains Mono** |

---

*Built with ❤️ — NexTrade v1.0*
