// =====================================================================
// services/marketDataService.js - Real-time Market Data via Yahoo Finance
// (No API key required — completely free, no hard rate limits)
// =====================================================================

const { default: YahooFinance } = require('yahoo-finance2');

// Create singleton instance with notices suppressed
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

class MarketDataService {
  constructor() {
    this.priceCache    = new Map();
    this.cacheTTL      = 30_000; // 30-second quote cache
    this.subscriptions = new Set();
    this.ws            = null;   // kept for interface compat with server.js
    this._warnedSymbols = new Set();
  }

  // ===== SINGLE QUOTE =====
  async getQuote(symbol) {
    try {
      const cached = this._getCached(symbol);
      if (cached) return cached;

      const data = await yf.quote(symbol);
      if (!data || !data.regularMarketPrice) return null;

      const quote = this._mapQuote(data);
      this._setCache(symbol, quote);
      return quote;
    } catch (err) {
      if (!this._warnedSymbols.has(symbol)) {
        console.warn(`[MarketData] Yahoo Finance quote failed for ${symbol}: ${err.message}`);
        this._warnedSymbols.add(symbol);
      }
      return this.getFallbackQuote(symbol);
    }
  }

  // ===== BATCH QUOTES — concurrent chunks, no hard rate limit =====
  async batchGetQuotes(symbols) {
    const quotes    = {};
    const chunkSize = 10;
    const delay     = ms => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < symbols.length; i += chunkSize) {
      const chunk = symbols.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(symbol =>
          this.getQuote(symbol).then(q => {
            if (q) quotes[symbol] = q;
          })
        )
      );
      // 300 ms courtesy delay between chunks
      if (i + chunkSize < symbols.length) await delay(300);
    }

    return quotes;
  }

  // ===== SEARCH =====
  async searchStocks(query) {
    try {
      const results = await yf.search(query, { newsCount: 0 });
      return (results.quotes || [])
        .filter(s => s.typeDisp === 'Equity' && s.isYahooFinance)
        .slice(0, 8)
        .map(s => ({
          symbol: s.symbol,
          name:   s.longname || s.shortname || s.symbol,
          type:   'Common Stock',
        }));
    } catch {
      return [];
    }
  }

  // ===== COMPANY PROFILE =====
  async getCompanyProfile(symbol) {
    try {
      const data = await yf.quoteSummary(symbol, { modules: ['assetProfile', 'summaryDetail'] });
      const profile = data?.assetProfile || {};
      const summary = data?.summaryDetail || {};
      return {
        symbol,
        name:      symbol,
        industry:  profile.industry  || 'N/A',
        marketCap: summary.marketCap || 0,
        employees: profile.fullTimeEmployees || 0,
        logo:      '',
      };
    } catch {
      return { symbol, name: symbol };
    }
  }

  // ===== HISTORICAL DATA =====
  // Yahoo Finance's historical() only supports 1d/1wk/1mo.
  // For intraday (1m, 5m, 15m, 30m, 1h) we use chart() which supports all intervals.
  async getHistoricalData(symbol, resolution = 'D', from, to) {
    // 5-minute cache for historical data — prevents repeated fetches on chart re-renders
    const cacheKey = `${symbol}:${resolution}:${Math.floor(from / 300)}`;
    const cached = this._histCache?.get(cacheKey);
    if (cached && Date.now() - cached.ts < 300_000) return cached.data;
    if (!this._histCache) this._histCache = new Map();

    try {
      const fromDate = new Date(from * 1000);
      const toDate   = new Date(to   * 1000);

      // Map Finnhub resolution → Yahoo interval string
      const intradayMap = { '1': '1m', '5': '5m', '15': '15m', '30': '30m', '60': '1h' };
      const dailyMap    = { 'D': '1d', 'W': '1wk', 'M': '1mo' };

      let bars;

      if (intradayMap[resolution]) {
        // Use chart() for intraday — historical() doesn't support sub-daily intervals
        const result = await yf.chart(symbol, {
          period1:  fromDate,
          period2:  toDate,
          interval: intradayMap[resolution],
        });
        const quotes = result?.quotes || [];
        bars = quotes
          .filter(q => q && q.close != null)
          .map(q => ({
            time:   Math.floor(new Date(q.date).getTime() / 1000),
            open:   parseFloat((q.open  || 0).toFixed(2)),
            high:   parseFloat((q.high  || 0).toFixed(2)),
            low:    parseFloat((q.low   || 0).toFixed(2)),
            close:  parseFloat((q.close || 0).toFixed(2)),
            volume: q.volume || 0,
          }));
      } else {
        // Use historical() for daily / weekly / monthly
        const interval = dailyMap[resolution] || '1d';
        const data = await yf.historical(symbol, { period1: fromDate, period2: toDate, interval });
        bars = (data || []).map(bar => ({
          time:   Math.floor(new Date(bar.date).getTime() / 1000),
          open:   parseFloat((bar.open  || 0).toFixed(2)),
          high:   parseFloat((bar.high  || 0).toFixed(2)),
          low:    parseFloat((bar.low   || 0).toFixed(2)),
          close:  parseFloat((bar.close || 0).toFixed(2)),
          volume: bar.volume || 0,
        }));
      }

      if (!bars || bars.length === 0) {
        bars = this._generateSimulatedHistory(symbol, resolution, from, to);
      }

      this._histCache.set(cacheKey, { ts: Date.now(), data: bars });
      return bars;
    } catch (err) {
      console.warn(`[MarketData] Historical fetch failed for ${symbol}:`, err.message);
      return this._generateSimulatedHistory(symbol, resolution, from, to);
    }
  }

  // ===== MARKET MOVERS =====
  async getMarketMovers() {
    const popularSymbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'AMD', 'NFLX', 'DIS'];
    try {
      const quotes = await this.batchGetQuotes(popularSymbols);
      return Object.values(quotes)
        .filter(q => q && q.changePercent !== undefined)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 5)
        .map(q => ({
          symbol:        q.symbol,
          name:          q.symbol,
          price:         q.price,
          change:        q.change,
          changePercent: q.changePercent,
        }));
    } catch {
      return [];
    }
  }

  // ===== WebSocket stubs (kept for server.js interface compat) =====
  initWebSocket(callback) {
    console.log('[MarketData] Using Yahoo Finance (no WebSocket — polling provides updates)');
  }
  subscribeSymbol(symbol)   { this.subscriptions.add(symbol.toUpperCase()); }
  unsubscribeSymbol(symbol) { this.subscriptions.delete(symbol.toUpperCase()); }
  closeWebSocket()          { /* no-op */ }

  // ===== PRIVATE HELPERS =====

  _mapQuote(data) {
    const price     = data.regularMarketPrice         || 0;
    const prev      = data.regularMarketPreviousClose || price;
    const change    = data.regularMarketChange        ?? (price - prev);
    const changePct = data.regularMarketChangePercent ?? (prev ? (change / prev) * 100 : 0);

    return {
      symbol:        data.symbol,
      name:          data.longName || data.shortName || data.symbol,
      price:         parseFloat(price.toFixed(2)),
      change:        parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePct.toFixed(4)),
      open:          parseFloat((data.regularMarketOpen    || price).toFixed(2)),
      high:          parseFloat((data.regularMarketDayHigh || price).toFixed(2)),
      low:           parseFloat((data.regularMarketDayLow  || price).toFixed(2)),
      volume:        data.regularMarketVolume || 0,
      timestamp:     new Date().toISOString(),
    };
  }

  _getCached(symbol) {
    const entry = this.priceCache.get(symbol);
    if (entry && Date.now() - entry.timestamp < this.cacheTTL) return entry.data;
    return null;
  }

  _setCache(symbol, quote) {
    this.priceCache.set(symbol, { timestamp: Date.now(), data: quote });
  }

  _generateSimulatedHistory(symbol, resolution, fromTs, toTs) {
    const basePrice = this.getFallbackQuote(symbol).price || 100;
    const secPerBar = {
      '1': 60, '5': 300, '15': 900, '30': 1800,
      '60': 3600, 'D': 86400, 'W': 604800, 'M': 2592000,
    };
    const interval = secPerBar[resolution] || 86400;
    const bars = [];
    let price = basePrice * (0.90 + Math.random() * 0.10);

    for (let t = fromTs; t <= toTs; t += interval) {
      const open  = price;
      const move  = (Math.random() - 0.48) * price * 0.018;
      const close = Math.max(0.01, parseFloat((price + move).toFixed(2)));
      const high  = parseFloat((Math.max(open, close) * (1 + Math.random() * 0.008)).toFixed(2));
      const low   = parseFloat((Math.min(open, close) * (1 - Math.random() * 0.008)).toFixed(2));
      bars.push({ time: t, open: parseFloat(open.toFixed(2)), high, low, close, volume: Math.floor(Math.random() * 40_000_000 + 2_000_000) });
      price = close;
    }
    return bars;
  }

  getFallbackQuote(symbol) {
    const demoQuotes = {
      AAPL:  { price: 189.45, change: 1.23,  changePercent: 0.65,  open: 188.50, high: 190.20, low: 187.80, volume: 45_000_000 },
      MSFT:  { price: 415.18, change: 0.95,  changePercent: 0.23,  open: 414.50, high: 416.30, low: 414.00, volume: 30_000_000 },
      GOOGL: { price: 174.50, change: 1.65,  changePercent: 0.95,  open: 172.95, high: 175.10, low: 172.50, volume: 25_000_000 },
      TSLA:  { price: 248.72, change: -0.87, changePercent: -0.35, open: 249.80, high: 251.00, low: 247.50, volume: 120_000_000 },
      NVDA:  { price: 912.30, change: 3.41,  changePercent: 0.37,  open: 909.00, high: 915.50, low: 908.00, volume: 35_000_000 },
    };
    const q = demoQuotes[symbol?.toUpperCase()] || {
      price: 100 + Math.random() * 200, change: (Math.random() - 0.5) * 5,
      changePercent: (Math.random() - 0.5) * 2, open: 100, high: 105, low: 95,
      volume: Math.floor(Math.random() * 50_000_000),
    };
    return { symbol, ...q, timestamp: new Date().toISOString() };
  }

  // Legacy compat aliases used in routes
  getCachedQuote(symbol)        { return this._getCached(symbol); }
  setCacheQuote(symbol, _data)  { /* no-op — _mapQuote handles caching internally */ }
}

module.exports = new MarketDataService();
