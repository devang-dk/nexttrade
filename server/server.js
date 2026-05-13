// =====================================================================
// server.js - NexTrade Node.js/Express Backend
// MongoDB + JWT Authentication + Socket.io Real-time + Finnhub Market Data
// =====================================================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const authRoutes = require('./routes/auth');
const marketRoutes = require('./routes/market');
const portfolioRoutes = require('./routes/portfolio');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payment');
const newsRoutes    = require('./routes/news');
const marketDataService = require('./services/marketDataService');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// ===== MONGODB CONNECTION =====
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Stock', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('[✓] MongoDB connected'))
  .catch((err) => {
    console.error('[!] MongoDB connection failed:', err.message);
    console.log('    Running in memory mode (demo)');
  });

// ===== ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/news',    newsRoutes);

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NexTrade API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ===== WEBSOCKET: Real-time Price Stream =====
const connectedClients = new Set();
const subscribedSymbols = new Map(); // socket.id -> Set of symbols

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  connectedClients.add(socket);
  subscribedSymbols.set(socket.id, new Set());

  // Client subscribes to specific symbols
  socket.on('subscribe', (symbols) => {
    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    const clientSymbols = subscribedSymbols.get(socket.id) || new Set();

    symbolArray.forEach(sym => {
      clientSymbols.add(sym.toUpperCase());
      marketDataService.subscribeSymbol(sym.toUpperCase());
    });

    subscribedSymbols.set(socket.id, clientSymbols);
    console.log(`[WS] ${socket.id} subscribed to:`, symbolArray);
    socket.emit('subscribed', symbolArray);
  });

  // Client unsubscribes from symbols
  socket.on('unsubscribe', (symbols) => {
    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    const clientSymbols = subscribedSymbols.get(socket.id) || new Set();

    symbolArray.forEach(sym => {
      const symbol = sym.toUpperCase();
      clientSymbols.delete(symbol);
      marketDataService.unsubscribeSymbol(symbol);
    });

    subscribedSymbols.set(socket.id, clientSymbols);
    console.log(`[WS] ${socket.id} unsubscribed from:`, symbolArray);
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
    connectedClients.delete(socket);
    subscribedSymbols.delete(socket.id);
  });
});

// ===== REAL-TIME PRICE UPDATES via Finnhub =====
const trackedSymbols = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'AMD', 'DIS'];

// Subscribe to price updates
marketDataService.initWebSocket((priceUpdate) => {
  // Broadcast to all connected clients
  if (connectedClients.size > 0) {
    io.emit('priceUpdate', priceUpdate);
  }
});

// Poll Finnhub every 30 seconds for price updates
// (Free plan limit: 60 calls/min; 10 symbols per batch = 10 calls per poll)
setInterval(async () => {
  if (connectedClients.size === 0) return;

  try {
    const quotes = await marketDataService.batchGetQuotes(trackedSymbols);

    io.to('prices').emit('priceUpdates', quotes);
  } catch (error) {
    console.error('[!] Error fetching price updates:', error);
  }
}, 30000);

// ===== START SERVER =====
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`
  _   _          _____              _      
 | \\ | |   ___  |_   _|  _ __   __ _ __| | ___ 
 |  \\| |  / _ \\   | |   | '__| / _\` |/ _\` |/ _ \\
 | |\\  | |  __/   | |   | |   | (_| | (_| |  __/
 |_| \\_|  \\___|   |_|   |_|    \\__,_|\\__,_|\\___|
 Stock Trading Platform — Node.js Backend v1.0
  
  [✓] Server running on port ${PORT}
  [✓] Frontend: http://localhost:3000
  [✓] WebSocket: ws://localhost:${PORT}
  [✓] Market Data: Finnhub API
  [✓] Real-time Price Updates: Enabled
  `);

  // Log API key status
  if (process.env.MARKET_API_KEY && process.env.MARKET_API_KEY !== 'your_finnhub_api_key_here') {
    console.log('[✓] Finnhub API Key configured');
  } else {
    console.log('[!] WARNING: Market API Key not configured. Using demo data.');
    console.log('    Set MARKET_API_KEY in .env file');
    console.log('    Get free key at: https://finnhub.io/register');
  }
});

module.exports = { app, io };
