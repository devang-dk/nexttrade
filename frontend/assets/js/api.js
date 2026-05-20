// ===================================================================
// api.js — Centralized API client with demo mode fallback
// ===================================================================

// ⚠️ CONFIGURATION: API base URL
// Uses relative /api path — works on any host (localhost, EC2, custom domain)
// without needing to set window.NEXTRADE_API_URL at all.
const API_BASE = '/api';
const WS_BASE  = window.location.origin;
const DEMO_MODE = false; // false = real backend + MongoDB, true = local demo mode


// Returns true when user is in demo mode (no real JWT)
function _isDemoSession() {
  const token = localStorage.getItem('token');
  return !token || token === 'demo-jwt-token' || DEMO_MODE;
}

// When DEMO_MODE is false:
// - Users must have MongoDB running at localhost:27017
// - Backend must be built and running: .\backend\build\Release\nextrade.exe
// - Real login/registration saves to MongoDB with persistent accounts
//
// When DEMO_MODE is true:
// - Everything runs in browser memory (no backend needed)
// - Demo accounts created on the fly
// - Perfect for quick testing and presentations

// Live price cache — populated exclusively from real API responses
let livePrices = {};
let liveChanges = {};

function getStorageUserScope() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const scope = user.id || user._id || user.email || 'guest';
  return String(scope).toLowerCase();
}

function scopedKey(baseKey) {
  return `${baseKey}:${getStorageUserScope()}`;
}

function readScopedArray(baseKey) {
  // Backward compatibility: fall back to legacy global key once.
  const scoped = localStorage.getItem(scopedKey(baseKey));
  if (scoped) return JSON.parse(scoped || '[]');

  const legacy = localStorage.getItem(baseKey);
  if (!legacy) return [];

  const parsed = JSON.parse(legacy || '[]');
  localStorage.setItem(scopedKey(baseKey), JSON.stringify(parsed));
  return parsed;
}

function writeScopedArray(baseKey, value) {
  localStorage.setItem(scopedKey(baseKey), JSON.stringify(value));
}

function fluctuatePrice(symbol) {
  if (!livePrices[symbol]) livePrices[symbol] = 100;
  const change = (Math.random() - 0.5) * 0.4;
  livePrices[symbol] = Math.max(0.01, livePrices[symbol] + change);
  return livePrices[symbol];
}

// ===== HTTP HELPER =====
async function apiRequest(method, path, body = null) {
  const token = localStorage.getItem('token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API_BASE + path, opts);

  // Token expired or invalid — clear session and redirect to login
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
      window.location.href = 'index.html';
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Request failed');
  }
  return res.json();
}

// ===== AUTH API =====
const AuthAPI = {
  async login(email, password) {
    if (DEMO_MODE) throw new Error('demo');
    return apiRequest('POST', '/auth/login', { email, password });
  },
  async register(name, email, password) {
    if (DEMO_MODE) throw new Error('demo');
    return apiRequest('POST', '/auth/register', { name, email, password });
  },
};

// ===== MARKET API =====
const MarketAPI = {
  async getQuote(symbol) {
    const normalizedSymbol = String(symbol || '').toUpperCase();
    try {
      const quote = await apiRequest('GET', `/market/quote/${normalizedSymbol}`);
      MarketAPI._cacheQuote(quote);
      return quote;
    } catch (_) {
      // Fall back to cached value or realistic fallback price
      return MarketAPI._stableQuote(normalizedSymbol);
    }
  },

  async getQuotes(symbols = []) {
    const normalizedSymbols = symbols
      .map((s) => String(s || '').toUpperCase())
      .filter(Boolean);

    if (normalizedSymbols.length === 0) return {};

    try {
      const quoteMap = await apiRequest('GET', `/market/quotes?symbols=${normalizedSymbols.join(',')}`);
      Object.values(quoteMap || {}).forEach((quote) => MarketAPI._cacheQuote(quote));
      return quoteMap || {};
    } catch (_) {
      // Return stable cached values if API fails
      return normalizedSymbols.reduce((acc, symbol) => {
        acc[symbol] = MarketAPI._stableQuote(symbol);
        return acc;
      }, {});
    }
  },


  _cacheQuote(quote) {
    if (!quote || !quote.symbol || quote.price === undefined) return;
    const symbol = String(quote.symbol).toUpperCase();
    livePrices[symbol] = parseFloat(quote.price);

    const pct = quote.changePercent !== undefined ? quote.changePercent : quote.change;
    if (pct !== undefined) {
      const parsed = parseFloat(pct);
      if (Number.isFinite(parsed)) {
        liveChanges[symbol] = parsed;
      }
    }
  },

  _stableQuote(symbol) {
    const price = livePrices[symbol] ?? 100;
    const change = liveChanges[symbol] ?? 0;
    return {
      symbol,
      name: symbol,
      price,
      change,
      changePercent: change,
      open: price,
      high: price,
      low: price,
      volume: 0,
      marketCap: 'N/A',
    };
  },

  _demoQuote(symbol) {
    const price = fluctuatePrice(symbol.toUpperCase());
    const basePrice = livePrices[symbol.toUpperCase()] || price;
    const changePct = basePrice > 0 ? ((price - basePrice) / basePrice * 100) : 0;
    return {
      symbol: symbol.toUpperCase(),
      name: symbol.toUpperCase(),
      price,
      change: changePct,
      open: price,
      high: price * 1.005,
      low: price * 0.993,
      volume: Math.floor(Math.random() * 50000000 + 5000000),
      marketCap: 'N/A',
    };
  },

  // Realistic fallback prices used in demo mode so UI doesn't show $100 for everything
  getFallbackQuote(symbol) {
    const sym = String(symbol || '').toUpperCase();
    const FALLBACK_PRICES = {
      // US
      AAPL: { price: 189.45, change: 1.23,  changePercent: 0.65  },
      TSLA: { price: 248.72, change: -0.87, changePercent: -0.35 },
      NVDA: { price: 912.30, change: 3.41,  changePercent: 0.37  },
      MSFT: { price: 415.18, change: 0.95,  changePercent: 0.23  },
      GOOGL: { price: 174.50, change: 1.65, changePercent: 0.95  },
      AMZN:  { price: 185.20, change: 0.72, changePercent: 0.39  },
      META:  { price: 520.30, change: 2.10, changePercent: 0.41  },
      NFLX:  { price: 630.10, change: -1.20,changePercent: -0.19 },
      AMD:   { price: 178.40, change: 1.85, changePercent: 1.05  },
      INTC:  { price: 30.15,  change: 0.22, changePercent: 0.73  },
      JPM:   { price: 205.60, change: 0.55, changePercent: 0.27  },
      V:     { price: 278.90, change: 0.80, changePercent: 0.29  },
      // India
      'RELIANCE.NS':  { price: 2945.00, change: 18.5,  changePercent: 0.63  },
      'TCS.NS':       { price: 3820.00, change: 25.0,  changePercent: 0.66  },
      'INFY.NS':      { price: 1485.00, change: -7.5,  changePercent: -0.50 },
      'HDFCBANK.NS':  { price: 1620.00, change: 12.0,  changePercent: 0.75  },
      'ICICIBANK.NS': { price: 1150.00, change: 8.5,   changePercent: 0.74  },
      'WIPRO.NS':     { price: 462.00,  change: 3.2,   changePercent: 0.70  },
      'TMCV.NS':      { price: 411.00,  change: -2.5,  changePercent: -0.60 },
      'SBIN.NS':      { price: 820.00,  change: 6.5,   changePercent: 0.80  },
    };
    const q = FALLBACK_PRICES[sym] || {
      price: 100 + (sym.charCodeAt(0) % 100) * 2,
      change: (Math.random() - 0.5) * 3,
      changePercent: (Math.random() - 0.5) * 1.5,
    };
    return {
      symbol: sym,
      name: sym,
      price: q.price,
      change: parseFloat((q.change || 0).toFixed(2)),
      changePercent: parseFloat((q.changePercent || 0).toFixed(2)),
      open: q.price,
      high: q.price * 1.01,
      low:  q.price * 0.99,
      volume: Math.floor(Math.random() * 50_000_000 + 5_000_000),
      marketCap: 'N/A',
      timestamp: new Date().toISOString(),
    };
  },

  async getHistory(symbol, interval = '1M') {
    try {
      const intervalMap = {
        '1D': { resolution: '5',  days: 1   },
        '1W': { resolution: '30', days: 7   },
        '1M': { resolution: 'D',  days: 30  },
        '3M': { resolution: 'D',  days: 90  },
        '1Y': { resolution: 'W',  days: 365 },
      };
      const { resolution = 'D', days = 30 } = intervalMap[interval] || {};
      const to   = Math.floor(Date.now() / 1000);
      const from = to - days * 86400;
      return await apiRequest('GET', `/market/history/${symbol}?resolution=${resolution}&from=${from}&to=${to}`);
    } catch (_) {}
    return MarketAPI._generateHistory(symbol, interval);
  },


  _generateHistory(symbol, interval) {
    let basePrice = livePrices[symbol] || 100;
    const now = Math.floor(Date.now() / 1000);

    const intervalDays = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };
    const days = intervalDays[interval] || 30;
    const points = Math.min(days, 120);
    const secondsPerPoint = (days * 86400) / points;

    const data = [];
    let price = basePrice * (0.85 + Math.random() * 0.15);

    for (let i = points; i >= 0; i--) {
      const time = now - (i * secondsPerPoint);
      const open = price;
      const move = (Math.random() - 0.48) * price * 0.025;
      const close = Math.max(0.01, price + move);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low  = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = Math.floor(Math.random() * 50000000 + 1000000);
      data.push({ time: Math.floor(time), open, high, low, close, volume });
      price = close;
    }
    return data;
  },

  async search(query) {
    if (!query || query.length < 1) return [];

    try {
      return await apiRequest('GET', `/market/search?q=${encodeURIComponent(query)}`);
    } catch (_) {
      return [];
    }
  },

  getAllStocks() {
    // Returns only symbols for which we have received live prices from the API
    return Object.keys(livePrices).map(symbol => ({
      symbol,
      name: symbol,
      price: livePrices[symbol],
      change: liveChanges[symbol] ?? 0,
    }));
  },
};

// ===== REAL-TIME MARKET API (WebSocket) =====
const RealtimeMarketAPI = {
  ws: null,
  socket: null,
  isConnected: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 2000,
  subscribers: new Map(), // symbol -> Set<callback>
  fallbackInterval: null,
  pollInterval: null,

  // Initialize WebSocket connection
  connect() {
    if (DEMO_MODE) {
      this.startFallbackUpdates();
      return;
    }

    if (this.isConnected) return;

    // 1) Prefer Socket.IO stream if client lib is available.
    if (typeof window !== 'undefined' && typeof window.io === 'function') {
      try {
        this.socket = window.io(WS_BASE);

        this.socket.on('connect', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.resubscribeAll();
        });

        this.socket.on('priceUpdate', (update) => {
          if (update && update.symbol) this.handleUpdate(update);
        });

        this.socket.on('priceUpdates', (updates) => {
          if (!updates) return;
          if (Array.isArray(updates)) {
            updates.forEach(update => this.handleUpdate(update));
            return;
          }
          Object.values(updates).forEach(update => this.handleUpdate(update));
        });

        this.socket.on('disconnect', () => {
          this.isConnected = false;
          this.startPollingUpdates();
        });

        return;
      } catch (e) {
        console.warn('[RealtimeMarketAPI] Socket.IO unavailable, using polling', e);
      }
    }

    // 2) Reliable fallback: poll quotes endpoint every 2s.
    this.startPollingUpdates();
  },

  // Handle price updates from WebSocket
  handleUpdate(update) {
    const { symbol, price, change, changePercent } = update;
    if (!symbol || price === undefined) return;

    // Update the live price cache
    const normalizedSymbol = String(symbol).toUpperCase();
    const normalizedPrice = parseFloat(price);
    livePrices[normalizedSymbol] = normalizedPrice;

    // Notify subscribers
    const callbacks = this.subscribers.get(normalizedSymbol);
    if (!callbacks || callbacks.size === 0) return;

    const normalizedChange = parseFloat(
      changePercent !== undefined ? changePercent : (change || 0)
    );

    if (Number.isFinite(normalizedChange)) {
      liveChanges[normalizedSymbol] = normalizedChange;
    }

    callbacks.forEach((callback) => {
      callback({
        symbol: normalizedSymbol,
        price: normalizedPrice,
        change: Number.isFinite(normalizedChange) ? normalizedChange : 0,
        timestamp: Date.now(),
      });
    });
  },

  // Subscribe to real-time updates for a symbol
  subscribe(symbol, callback) {
    const normalizedSymbol = String(symbol).toUpperCase();
    if (!this.subscribers.has(normalizedSymbol)) {
      this.subscribers.set(normalizedSymbol, new Set());
    }
    this.subscribers.get(normalizedSymbol).add(callback);

    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribe', [normalizedSymbol]);
    }

    if (!this.isConnected) {
      this.connect();
    }
  },

  // Unsubscribe from real-time updates
  unsubscribe(symbol, callback = null) {
    const normalizedSymbol = String(symbol).toUpperCase();
    const callbacks = this.subscribers.get(normalizedSymbol);
    if (!callbacks) return;

    if (callback) {
      callbacks.delete(callback);
      if (callbacks.size > 0) return;
    }

    this.subscribers.delete(normalizedSymbol);

    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe', [normalizedSymbol]);
    }
  },

  // Re-subscribe all symbols after reconnect.
  resubscribeAll() {
    if (!this.socket || !this.socket.connected || this.subscribers.size === 0) return;
    this.socket.emit('subscribe', Array.from(this.subscribers.keys()));
  },

  startPollingUpdates() {
    if (this.pollInterval) return;
    this.isConnected = true;

    this.pollInterval = setInterval(async () => {
      if (this.subscribers.size === 0) return;

      try {
        const symbols = Array.from(this.subscribers.keys());
        const quoteMap = await apiRequest('GET', `/market/quotes?symbols=${symbols.join(',')}`);
        Object.values(quoteMap || {}).forEach((update) => this.handleUpdate(update));
      } catch (_) {
        // If polling fails transiently, keep last price and try again on next tick.
      }
    }, 2000);
  },

  // Fallback update mechanism for demo mode.
  startFallbackUpdates() {
    if (this.fallbackInterval) return;
    this.isConnected = true;

    this.fallbackInterval = setInterval(() => {
      this.subscribers.forEach((callbacks, symbol) => {
        const price = fluctuatePrice(symbol);
        const basePrice = DEMO_STOCKS.find(s => s.symbol === symbol)?.price || 100;
        const change = ((price - basePrice) / basePrice * 100);

        callbacks.forEach((callback) => {
          callback({
            symbol,
            price,
            change,
            timestamp: Date.now(),
          });
        });
      });
    }, 2000);
  },

  // Attempt reconnection with exponential backoff
  attemptReconnect() {
    if (this.pollInterval) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[RealtimeMarketAPI] Max reconnect attempts reached, using fallback');
      this.startPollingUpdates();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[RealtimeMarketAPI] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => this.connect(), delay);
  },

  // Stop all updates
  disconnect() {
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  },
};

// ===== PORTFOLIO API =====
const PortfolioAPI = {
  _getPortfolio() {
    return readScopedArray('portfolio');
  },
  _savePortfolio(p) {
    writeScopedArray('portfolio', p);
  },

  async getHoldings() {
    try {
      if (!DEMO_MODE) return await apiRequest('GET', '/portfolio');
    } catch (_) {}
    return this._getPortfolio();
  },

  async buy(symbol, shares, price, orderType = 'market') {
    if (!DEMO_MODE) {
      const result = await apiRequest('POST', '/orders/buy', {
        symbol,
        shares,
        price,
        orderType,
      });

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.balance = result.balance;
      localStorage.setItem('user', JSON.stringify(user));
      return result;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const cost = shares * price;

    if (user.balance < cost) throw new Error('Insufficient balance');

    // Update balance
    user.balance = parseFloat((user.balance - cost).toFixed(2));
    localStorage.setItem('user', JSON.stringify(user));

    // Update portfolio
    const portfolio = this._getPortfolio();
    const existing = portfolio.find(h => h.symbol === symbol);
    if (existing) {
      const totalCost = existing.avgPrice * existing.shares + cost;
      existing.shares += shares;
      existing.avgPrice = totalCost / existing.shares;
    } else {
      portfolio.push({ symbol, shares, avgPrice: price, name: MarketAPI._demoQuote(symbol).name });
    }
    this._savePortfolio(portfolio);

    // Save order
    OrderAPI.saveOrder({ symbol, type: 'BUY', shares, price, status: 'FILLED' });

    return { success: true, balance: user.balance };
  },

  async sell(symbol, shares, price, orderType = 'market') {
    if (!DEMO_MODE) {
      const result = await apiRequest('POST', '/orders/sell', {
        symbol,
        shares,
        price,
        orderType,
      });

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.balance = result.balance;
      localStorage.setItem('user', JSON.stringify(user));
      return result;
    }

    const portfolio = this._getPortfolio();
    const holding = portfolio.find(h => h.symbol === symbol);
    if (!holding) throw new Error('You do not own ' + symbol);
    if (holding.shares < shares) throw new Error(`Only ${holding.shares} shares available`);

    const proceeds = shares * price;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    user.balance = parseFloat((user.balance + proceeds).toFixed(2));
    localStorage.setItem('user', JSON.stringify(user));

    holding.shares -= shares;
    if (holding.shares === 0) {
      const idx = portfolio.indexOf(holding);
      portfolio.splice(idx, 1);
    }
    this._savePortfolio(portfolio);

    OrderAPI.saveOrder({ symbol, type: 'SELL', shares, price, status: 'FILLED' });
    return { success: true, balance: user.balance };
  },
};

// ===== ORDER API =====
const OrderAPI = {
  saveOrder(order) {
    const orders = readScopedArray('orders');
    orders.unshift({
      ...order,
      id: Date.now(),
      timestamp: new Date().toISOString(),
    });
    writeScopedArray('orders', orders.slice(0, 100));
  },
  getOrders() {
    return readScopedArray('orders');
  },
  async getOrdersRemote() {
    return apiRequest('GET', '/orders/history');
  },
  async getOrdersByStatusRemote(status) {
    return apiRequest('GET', `/orders/history?status=${encodeURIComponent(status)}`);
  },
  async cancelOrderRemote(orderId) {
    return apiRequest('PATCH', `/orders/${orderId}/cancel`);
  },
  clearOrders() {
    writeScopedArray('orders', []);
  },
};

// ===== PAYMENT API (MOCK) =====
const PaymentAPI = {
  async deposit(amount, cardDetails) {
    if (!DEMO_MODE) {
      const tx = await apiRequest('POST', '/payment/deposit', { amount, cardDetails });
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.balance = tx.balance;
      localStorage.setItem('user', JSON.stringify(user));
      return tx.transaction;
    }

    await new Promise(r => setTimeout(r, 1800)); // Simulate processing
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    user.balance = parseFloat(((user.balance || 0) + amount).toFixed(2));
    localStorage.setItem('user', JSON.stringify(user));

    const tx = {
      id: 'txn_' + Date.now(),
      type: 'DEPOSIT',
      amount,
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      last4: cardDetails.cardNumber.slice(-4),
    };
    const txs = readScopedArray('transactions');
    txs.unshift(tx);
    writeScopedArray('transactions', txs);
    return tx;
  },

  async withdraw(amount) {
    if (!DEMO_MODE) {
      const tx = await apiRequest('POST', '/payment/withdraw', { amount });
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.balance = tx.balance;
      localStorage.setItem('user', JSON.stringify(user));
      return tx.transaction;
    }

    await new Promise(r => setTimeout(r, 1500));
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if ((user.balance || 0) < amount) throw new Error('Insufficient funds');
    user.balance = parseFloat(((user.balance || 0) - amount).toFixed(2));
    localStorage.setItem('user', JSON.stringify(user));

    const tx = {
      id: 'txn_' + Date.now(),
      type: 'WITHDRAWAL',
      amount,
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };
    const txs = readScopedArray('transactions');
    txs.unshift(tx);
    writeScopedArray('transactions', txs);
    return tx;
  },

  getTransactions() {
    return readScopedArray('transactions');
  },
  async getTransactionsRemote() {
    return apiRequest('GET', '/payment/history');
  },
};

// ===== UTILITIES =====
function formatCurrency(amount) {
  return '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9)  return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6)  return (num / 1e6).toFixed(2) + 'M';
  return num.toLocaleString();
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/New_York',
  }) + ' ET';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
