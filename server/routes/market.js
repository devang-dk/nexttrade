// =====================================================================
// routes/market.js - Market Data Endpoints (Yahoo Finance)
// Multi-market edition: US, India, UK, Germany, Japan, Hong Kong
// =====================================================================

const express = require('express');
const { protect } = require('../middleware/auth');
const marketDataService = require('../services/marketDataService');

const router = express.Router();

// ===== SCREENER UNIVERSE — US common stocks only (free Finnhub plan compatible) =====
const SCREENER_UNIVERSE = [
  { symbol: 'AAPL',  name: 'Apple Inc.',               sector: 'Technology',  cap: 'Mega Cap'  },
  { symbol: 'MSFT',  name: 'Microsoft Corp.',           sector: 'Technology',  cap: 'Mega Cap'  },
  { symbol: 'GOOGL', name: 'Alphabet Inc.',             sector: 'Technology',  cap: 'Mega Cap'  },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',           sector: 'Consumer',    cap: 'Mega Cap'  },
  { symbol: 'NVDA',  name: 'NVIDIA Corp.',              sector: 'Technology',  cap: 'Mega Cap'  },
  { symbol: 'META',  name: 'Meta Platforms Inc.',       sector: 'Technology',  cap: 'Mega Cap'  },
  { symbol: 'TSLA',  name: 'Tesla Inc.',                sector: 'Automotive',  cap: 'Large Cap' },
  { symbol: 'V',     name: 'Visa Inc.',                 sector: 'Finance',     cap: 'Mega Cap'  },
  { symbol: 'JPM',   name: 'JPMorgan Chase',            sector: 'Finance',     cap: 'Mega Cap'  },
  { symbol: 'UNH',   name: 'UnitedHealth Group',        sector: 'Healthcare',  cap: 'Mega Cap'  },
  { symbol: 'JNJ',   name: 'Johnson & Johnson',         sector: 'Healthcare',  cap: 'Mega Cap'  },
  { symbol: 'MA',    name: 'Mastercard Inc.',           sector: 'Finance',     cap: 'Mega Cap'  },
  { symbol: 'XOM',   name: 'Exxon Mobil Corp.',         sector: 'Energy',      cap: 'Mega Cap'  },
  { symbol: 'WMT',   name: 'Walmart Inc.',              sector: 'Consumer',    cap: 'Mega Cap'  },
  { symbol: 'HD',    name: 'Home Depot Inc.',           sector: 'Consumer',    cap: 'Mega Cap'  },
  { symbol: 'PG',    name: 'Procter & Gamble',          sector: 'Consumer',    cap: 'Mega Cap'  },
  { symbol: 'BAC',   name: 'Bank of America',           sector: 'Finance',     cap: 'Mega Cap'  },
  { symbol: 'CVX',   name: 'Chevron Corp.',             sector: 'Energy',      cap: 'Mega Cap'  },
  { symbol: 'MRK',   name: 'Merck & Co.',               sector: 'Healthcare',  cap: 'Large Cap' },
  { symbol: 'PFE',   name: 'Pfizer Inc.',               sector: 'Healthcare',  cap: 'Large Cap' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices',    sector: 'Technology',  cap: 'Large Cap' },
  { symbol: 'INTC',  name: 'Intel Corp.',               sector: 'Technology',  cap: 'Large Cap' },
  { symbol: 'ORCL',  name: 'Oracle Corp.',              sector: 'Technology',  cap: 'Large Cap' },
  { symbol: 'CRM',   name: 'Salesforce Inc.',           sector: 'Technology',  cap: 'Large Cap' },
  { symbol: 'ADBE',  name: 'Adobe Inc.',                sector: 'Technology',  cap: 'Large Cap' },
  { symbol: 'NFLX',  name: 'Netflix Inc.',              sector: 'Technology',  cap: 'Large Cap' },
  { symbol: 'PYPL',  name: 'PayPal Holdings',           sector: 'Finance',     cap: 'Large Cap' },
  { symbol: 'DIS',   name: 'Walt Disney Co.',           sector: 'Consumer',    cap: 'Large Cap' },
  { symbol: 'KO',    name: 'Coca-Cola Co.',             sector: 'Consumer',    cap: 'Mega Cap'  },
  { symbol: 'PEP',   name: 'PepsiCo Inc.',              sector: 'Consumer',    cap: 'Mega Cap'  },
  { symbol: 'MCD',   name: "McDonald's Corp.",          sector: 'Consumer',    cap: 'Large Cap' },
  { symbol: 'SBUX',  name: 'Starbucks Corp.',           sector: 'Consumer',    cap: 'Large Cap' },
  { symbol: 'NKE',   name: 'Nike Inc.',                 sector: 'Consumer',    cap: 'Large Cap' },
  { symbol: 'GS',    name: 'Goldman Sachs',             sector: 'Finance',     cap: 'Large Cap' },
  { symbol: 'MS',    name: 'Morgan Stanley',            sector: 'Finance',     cap: 'Large Cap' },
  { symbol: 'WFC',   name: 'Wells Fargo & Co.',         sector: 'Finance',     cap: 'Large Cap' },
  { symbol: 'ABBV',  name: 'AbbVie Inc.',               sector: 'Healthcare',  cap: 'Mega Cap'  },
  { symbol: 'ABT',   name: 'Abbott Laboratories',       sector: 'Healthcare',  cap: 'Large Cap' },
  { symbol: 'CAT',   name: 'Caterpillar Inc.',          sector: 'Industrial',  cap: 'Large Cap' },
  { symbol: 'BA',    name: 'Boeing Co.',                sector: 'Industrial',  cap: 'Large Cap' },
  { symbol: 'HON',   name: 'Honeywell International',   sector: 'Industrial',  cap: 'Large Cap' },
  { symbol: 'GE',    name: 'General Electric',          sector: 'Industrial',  cap: 'Large Cap' },
  { symbol: 'UPS',   name: 'United Parcel Service',     sector: 'Industrial',  cap: 'Large Cap' },
  { symbol: 'LMT',   name: 'Lockheed Martin',           sector: 'Industrial',  cap: 'Large Cap' },
  { symbol: 'RTX',   name: 'RTX Corp.',                 sector: 'Industrial',  cap: 'Large Cap' },
  { symbol: 'SLB',   name: 'SLB (Schlumberger)',        sector: 'Energy',      cap: 'Large Cap' },
  { symbol: 'FCX',   name: 'Freeport-McMoRan',          sector: 'Materials',   cap: 'Large Cap' },
  { symbol: 'DE',    name: 'Deere & Company',           sector: 'Industrial',  cap: 'Large Cap' },
  { symbol: 'COST',  name: 'Costco Wholesale',          sector: 'Consumer',    cap: 'Mega Cap'  },
  { symbol: 'TGT',   name: 'Target Corp.',              sector: 'Consumer',    cap: 'Large Cap' },
  { symbol: 'UBER',  name: 'Uber Technologies',         sector: 'Technology',  cap: 'Large Cap' },
];

// ===== SCREENER UNIVERSES — per market =====
const SCREENER_UNIVERSES = {
  in: [
    { symbol:'RELIANCE.NS', name:'Reliance Industries',       sector:'Energy',      cap:'Mega Cap' },
    { symbol:'TCS.NS',      name:'Tata Consultancy Services', sector:'Technology',  cap:'Mega Cap' },
    { symbol:'INFY.NS',     name:'Infosys Ltd.',              sector:'Technology',  cap:'Mega Cap' },
    { symbol:'HDFCBANK.NS', name:'HDFC Bank',                 sector:'Finance',     cap:'Mega Cap' },
    { symbol:'ICICIBANK.NS',name:'ICICI Bank',                sector:'Finance',     cap:'Mega Cap' },
    { symbol:'WIPRO.NS',    name:'Wipro Ltd.',                sector:'Technology',  cap:'Large Cap'},
    { symbol:'BAJFINANCE.NS',name:'Bajaj Finance',            sector:'Finance',     cap:'Large Cap'},
    { symbol:'ADANIENT.NS', name:'Adani Enterprises',         sector:'Industrial',  cap:'Large Cap'},
    { symbol:'TATAMOTORS.NS',name:'Tata Motors',              sector:'Automotive',  cap:'Large Cap'},
    { symbol:'SBIN.NS',     name:'State Bank of India',       sector:'Finance',     cap:'Large Cap'},
    { symbol:'HINDUNILVR.NS',name:'Hindustan Unilever',       sector:'Consumer',    cap:'Large Cap'},
    { symbol:'LT.NS',       name:'Larsen & Toubro',           sector:'Industrial',  cap:'Large Cap'},
    { symbol:'MARUTI.NS',   name:'Maruti Suzuki',             sector:'Automotive',  cap:'Large Cap'},
    { symbol:'TITAN.NS',    name:'Titan Company',             sector:'Consumer',    cap:'Large Cap'},
    { symbol:'SUNPHARMA.NS',name:'Sun Pharmaceutical',        sector:'Healthcare',  cap:'Large Cap'},
    { symbol:'ASIANPAINT.NS',name:'Asian Paints',             sector:'Materials',   cap:'Large Cap'},
    { symbol:'NESTLEIND.NS',name:'Nestle India',              sector:'Consumer',    cap:'Large Cap'},
    { symbol:'POWERGRID.NS',name:'Power Grid Corp.',          sector:'Energy',      cap:'Large Cap'},
  ],
  uk: [
    { symbol:'SHEL.L',  name:'Shell PLC',             sector:'Energy',      cap:'Mega Cap' },
    { symbol:'HSBA.L',  name:'HSBC Holdings',         sector:'Finance',     cap:'Mega Cap' },
    { symbol:'BP.L',    name:'BP PLC',                sector:'Energy',      cap:'Large Cap'},
    { symbol:'AZN.L',   name:'AstraZeneca',           sector:'Healthcare',  cap:'Mega Cap' },
    { symbol:'ULVR.L',  name:'Unilever PLC',          sector:'Consumer',    cap:'Large Cap'},
    { symbol:'GSK.L',   name:'GSK PLC',               sector:'Healthcare',  cap:'Large Cap'},
    { symbol:'RIO.L',   name:'Rio Tinto PLC',         sector:'Materials',   cap:'Large Cap'},
    { symbol:'DGE.L',   name:'Diageo PLC',            sector:'Consumer',    cap:'Large Cap'},
    { symbol:'LLOY.L',  name:'Lloyds Banking Group',  sector:'Finance',     cap:'Large Cap'},
    { symbol:'VOD.L',   name:'Vodafone Group',        sector:'Technology',  cap:'Large Cap'},
    { symbol:'BA.L',    name:'BAE Systems',           sector:'Industrial',  cap:'Large Cap'},
    { symbol:'NWG.L',   name:'NatWest Group',         sector:'Finance',     cap:'Large Cap'},
  ],
  de: [
    { symbol:'SAP.DE',  name:'SAP SE',                sector:'Technology',  cap:'Mega Cap' },
    { symbol:'SIE.DE',  name:'Siemens AG',            sector:'Industrial',  cap:'Mega Cap' },
    { symbol:'BMW.DE',  name:'BMW AG',                sector:'Automotive',  cap:'Large Cap'},
    { symbol:'VOW3.DE', name:'Volkswagen AG',         sector:'Automotive',  cap:'Large Cap'},
    { symbol:'MBG.DE',  name:'Mercedes-Benz Group',  sector:'Automotive',  cap:'Large Cap'},
    { symbol:'BAYN.DE', name:'Bayer AG',              sector:'Healthcare',  cap:'Large Cap'},
    { symbol:'DTE.DE',  name:'Deutsche Telekom',      sector:'Technology',  cap:'Large Cap'},
    { symbol:'ALV.DE',  name:'Allianz SE',            sector:'Finance',     cap:'Large Cap'},
    { symbol:'MUV2.DE', name:'Munich Re',             sector:'Finance',     cap:'Large Cap'},
    { symbol:'ADS.DE',  name:'Adidas AG',             sector:'Consumer',    cap:'Large Cap'},
    { symbol:'DBK.DE',  name:'Deutsche Bank',         sector:'Finance',     cap:'Large Cap'},
  ],
  jp: [
    { symbol:'7203.T',  name:'Toyota Motor',              sector:'Automotive',  cap:'Mega Cap' },
    { symbol:'6758.T',  name:'Sony Group',                sector:'Technology',  cap:'Mega Cap' },
    { symbol:'9984.T',  name:'SoftBank Group',            sector:'Technology',  cap:'Mega Cap' },
    { symbol:'6501.T',  name:'Hitachi Ltd.',              sector:'Industrial',  cap:'Large Cap'},
    { symbol:'8306.T',  name:'Mitsubishi UFJ Financial',  sector:'Finance',     cap:'Mega Cap' },
    { symbol:'9432.T',  name:'NTT Corp.',                 sector:'Technology',  cap:'Large Cap'},
    { symbol:'6752.T',  name:'Panasonic Holdings',        sector:'Technology',  cap:'Large Cap'},
    { symbol:'7974.T',  name:'Nintendo Co.',              sector:'Technology',  cap:'Large Cap'},
    { symbol:'4063.T',  name:'Shin-Etsu Chemical',        sector:'Materials',   cap:'Large Cap'},
    { symbol:'8058.T',  name:'Mitsubishi Corp.',          sector:'Industrial',  cap:'Large Cap'},
    { symbol:'6861.T',  name:'Keyence Corp.',             sector:'Technology',  cap:'Large Cap'},
    { symbol:'9433.T',  name:'KDDI Corp.',                sector:'Technology',  cap:'Large Cap'},
  ],
  hk: [
    { symbol:'0700.HK', name:'Tencent Holdings',          sector:'Technology',  cap:'Mega Cap' },
    { symbol:'9988.HK', name:'Alibaba Group',             sector:'Technology',  cap:'Mega Cap' },
    { symbol:'3690.HK', name:'Meituan',                   sector:'Technology',  cap:'Large Cap'},
    { symbol:'1299.HK', name:'AIA Group',                 sector:'Finance',     cap:'Large Cap'},
    { symbol:'0005.HK', name:'HSBC Holdings (HK)',        sector:'Finance',     cap:'Mega Cap' },
    { symbol:'2318.HK', name:'Ping An Insurance',         sector:'Finance',     cap:'Large Cap'},
    { symbol:'0941.HK', name:'China Mobile',              sector:'Technology',  cap:'Large Cap'},
    { symbol:'1398.HK', name:'ICBC',                      sector:'Finance',     cap:'Mega Cap' },
    { symbol:'2020.HK', name:'ANTA Sports',               sector:'Consumer',    cap:'Large Cap'},
    { symbol:'9618.HK', name:'JD.com',                    sector:'Consumer',    cap:'Large Cap'},
    { symbol:'1810.HK', name:'Xiaomi Corp.',              sector:'Technology',  cap:'Large Cap'},
    { symbol:'0388.HK', name:'HK Exchanges & Clearing',  sector:'Finance',     cap:'Large Cap'},
  ],
};

// ===== EXCHANGE CONFIGS FOR MARKET STATUS =====
const EXCHANGE_CONFIGS = {
  us: {
    timezone: 'America/New_York', label: 'ET',
    preOpen: 4*60, open: 9*60+30, close: 16*60, afterEnd: 20*60,
    holidays: new Set([
      '2025-01-01','2025-01-20','2025-02-17','2025-04-18','2025-05-26',
      '2025-06-19','2025-07-04','2025-09-01','2025-11-27','2025-12-25',
      '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25',
      '2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
    ]),
  },
  in: {
    timezone: 'Asia/Kolkata', label: 'IST',
    preOpen: 9*60, open: 9*60+15, close: 15*60+30, afterEnd: 15*60+30,
    holidays: new Set([
      '2025-01-26','2025-03-14','2025-04-14','2025-04-18','2025-05-01',
      '2025-08-15','2025-10-02','2025-10-21','2025-10-24','2025-11-05',
      '2025-12-25','2026-01-26','2026-04-03','2026-08-15','2026-10-02',
    ]),
  },
  uk: {
    timezone: 'Europe/London', label: 'GMT/BST',
    preOpen: 7*60+50, open: 8*60, close: 16*60+30, afterEnd: 16*60+30,
    holidays: new Set([
      '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26',
      '2025-08-25','2025-12-25','2025-12-26','2026-01-01','2026-04-03',
      '2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25',
    ]),
  },
  de: {
    timezone: 'Europe/Berlin', label: 'CET/CEST',
    preOpen: 8*60, open: 9*60, close: 17*60+30, afterEnd: 17*60+30,
    holidays: new Set([
      '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-05-29',
      '2025-10-03','2025-12-24','2025-12-25','2025-12-26','2025-12-31',
      '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-12-24',
    ]),
  },
  jp: {
    timezone: 'Asia/Tokyo', label: 'JST',
    preOpen: 8*60, open: 9*60, close: 15*60+30, afterEnd: 15*60+30,
    holidays: new Set([
      '2025-01-01','2025-01-02','2025-01-03','2025-01-13','2025-02-11',
      '2025-03-20','2025-04-29','2025-05-03','2025-05-04','2025-05-05',
      '2025-07-21','2025-08-11','2025-09-15','2025-09-23','2025-10-13',
      '2025-11-03','2025-11-24','2025-12-31','2026-01-01','2026-01-02',
    ]),
  },
  hk: {
    timezone: 'Asia/Hong_Kong', label: 'HKT',
    preOpen: 9*60+15, open: 9*60+30, close: 16*60, afterEnd: 16*60,
    holidays: new Set([
      '2025-01-01','2025-01-29','2025-01-30','2025-01-31','2025-04-04',
      '2025-04-18','2025-04-21','2025-05-01','2025-05-05','2025-06-02',
      '2025-07-01','2025-10-01','2025-10-07','2025-12-25','2025-12-26',
      '2026-01-01','2026-01-27','2026-01-28','2026-04-03','2026-04-06',
    ]),
  },
};

// ===== GET /api/market/status =====
// Accepts ?market=us|in|uk|de|jp|hk  (default: us)
router.get('/status', (req, res) => {
  const mktId  = (req.query.market || 'us').toLowerCase();
  const cfg    = EXCHANGE_CONFIGS[mktId] || EXCHANGE_CONFIGS['us'];
  const now    = new Date();

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: cfg.timezone,
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);

  const get = (type) => parts.find(p => p.type === type)?.value;
  const lHour = parseInt(get('hour'));
  const lMin  = parseInt(get('minute'));
  const lSec  = parseInt(get('second'));
  const dayName = get('weekday');
  const lDay  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dayName);
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;

  const totalMin = lHour * 60 + lMin;
  const isWeekend    = lDay === 0 || lDay === 6;
  const isHoliday    = cfg.holidays.has(dateStr);
  const isTradingDay = !isWeekend && !isHoliday;

  let status, session, dotColor, nextLabel, nextMs;

  if (!isTradingDay) {
    status = 'closed'; session = isHoliday ? 'Holiday' : 'Weekend';
    dotColor = '#ef4444'; nextLabel = 'Opens';
    const msToMidnight = ((24 * 60 - totalMin) * 60 - lSec) * 1000;
    const daysToNext = lDay === 6 ? 2 : lDay === 0 ? 1 : 1;
    nextMs = msToMidnight + daysToNext * 86400000 + cfg.open * 60000;
  } else if (totalMin < cfg.preOpen) {
    status = 'closed'; session = 'Overnight';
    dotColor = '#ef4444'; nextLabel = 'Pre-open';
    nextMs = ((cfg.preOpen - totalMin) * 60 - lSec) * 1000;
  } else if (totalMin < cfg.open) {
    status = 'pre-market'; session = 'Pre-Open';
    dotColor = '#f59e0b'; nextLabel = 'Opens';
    nextMs = ((cfg.open - totalMin) * 60 - lSec) * 1000;
  } else if (totalMin < cfg.close) {
    status = 'open'; session = 'Open';
    dotColor = '#22c55e'; nextLabel = 'Closes';
    nextMs = ((cfg.close - totalMin) * 60 - lSec) * 1000;
  } else if (totalMin < cfg.afterEnd) {
    status = 'after-hours'; session = 'After Hours';
    dotColor = '#a78bfa'; nextLabel = 'Session end';
    nextMs = ((cfg.afterEnd - totalMin) * 60 - lSec) * 1000;
  } else {
    status = 'closed'; session = 'Overnight';
    dotColor = '#ef4444'; nextLabel = 'Pre-open';
    nextMs = ((24 * 60 + cfg.preOpen - totalMin) * 60 - lSec) * 1000;
  }

  res.json({
    status, session, dotColor, nextLabel,
    nextMs: Math.max(0, Math.floor(nextMs)),
    localTime: `${String(lHour).padStart(2,'0')}:${String(lMin).padStart(2,'0')} ${cfg.label}`,
    market: mktId,
  });
});

// ===== GET /api/market/quote/:symbol =====
router.get('/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const quote = await marketDataService.getQuote(symbol.toUpperCase());

    if (!quote) {
      return res.status(404).json({ message: 'Symbol not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ message: 'Error fetching quote' });
  }
});

// ===== GET /api/market/quotes - Batch fetch multiple stocks =====
router.get('/quotes', async (req, res) => {
  try {
    const { symbols } = req.query;

    if (!symbols) {
      return res.status(400).json({ message: 'Symbols required' });
    }

    const symbolArray = symbols.split(',').map(s => s.toUpperCase());
    const quotes = await marketDataService.batchGetQuotes(symbolArray);

    res.json(quotes);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ message: 'Error fetching quotes' });
  }
});

// ===== GET /api/market/history/:symbol =====
router.get('/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { resolution = 'D', from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: 'from and to timestamps required' });
    }

    const data = await marketDataService.getHistoricalData(
      symbol.toUpperCase(),
      resolution,
      parseInt(from),
      parseInt(to)
    );

    res.json(data);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Error fetching historical data' });
  }
});

// ===== GET /api/market/search =====
router.get('/search', async (req, res) => {
  try {
    const { q = '' } = req.query;

    if (!q || q.length < 1) {
      return res.json([]);
    }

    const results = await marketDataService.searchStocks(q);
    res.json(results);
  } catch (error) {
    console.error('Error searching stocks:', error);
    res.status(500).json({ message: 'Error searching stocks' });
  }
});

// ===== GET /api/market/movers =====
router.get('/movers', async (req, res) => {
  try {
    const movers = await marketDataService.getMarketMovers();
    res.json(movers);
  } catch (error) {
    console.error('Error fetching movers:', error);
    res.status(500).json({ message: 'Error fetching market movers' });
  }
});

// ===== GET /api/market/company/:symbol =====
router.get('/company/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const profile = await marketDataService.getCompanyProfile(symbol.toUpperCase());
    res.json(profile);
  } catch (error) {
    console.error('Error fetching company profile:', error);
    res.status(500).json({ message: 'Error fetching company profile' });
  }
});

// ===== SCREENER CACHE — keyed by market id =====
const _screenerCaches = {};  // { [marketId]: { data, time } }
const SCREENER_TTL_MS  = 300_000; // 5 minutes

async function buildScreenerData(marketId) {
  const universe = marketId === 'us'
    ? SCREENER_UNIVERSE
    : (SCREENER_UNIVERSES[marketId] || SCREENER_UNIVERSE);
  const symbols = universe.map(s => s.symbol);
  const quotes  = await marketDataService.batchGetQuotes(symbols);
  return universe
    .map(stock => {
      const q = quotes[stock.symbol];
      if (!q) return null;
      return {
        symbol: stock.symbol, name: stock.name,
        sector: stock.sector, cap:  stock.cap,
        price: q.price, change: q.change, changePercent: q.changePercent,
        open: q.open, high: q.high, low: q.low, volume: q.volume,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

// Pre-warm US cache 60s after server start
setTimeout(async () => {
  try {
    console.log('[Screener] Pre-warming US cache…');
    const data = await buildScreenerData('us');
    _screenerCaches['us'] = { data, time: Date.now() };
    console.log(`[Screener] US cache ready — ${data.length} stocks`);
  } catch (e) {
    console.warn('[Screener] Pre-warm failed:', e.message);
  }
}, 60_000);

// ===== GET /api/market/screener =====
// Accepts ?market=us|in|uk|de|jp|hk  (default: us)
router.get('/screener', async (req, res) => {
  try {
    const marketId     = (req.query.market || 'us').toLowerCase();
    const forceRefresh = req.query.refresh === 'true';
    const cached       = _screenerCaches[marketId];
    const cacheAge     = cached ? Date.now() - cached.time : Infinity;

    if (cached && cacheAge < SCREENER_TTL_MS && !forceRefresh) {
      return res.json(cached.data);
    }

    const data = await buildScreenerData(marketId);
    _screenerCaches[marketId] = { data, time: Date.now() };
    res.json(data);

  } catch (error) {
    console.error('Screener error:', error);
    const marketId = (req.query.market || 'us').toLowerCase();
    const cached   = _screenerCaches[marketId];
    if (cached) return res.json(cached.data);
    res.status(500).json({ message: 'Error fetching screener data' });
  }
});

// ===== GET /api/market/exchange-rate/:fromCode =====
// Returns real-time exchange rate from any currency to USD
// e.g. /api/market/exchange-rate/INR  →  { from:'INR', to:'USD', rate:0.01049, pair:'INRUSD=X' }
const _fxCache = {};
const FX_TTL   = 5 * 60 * 1000; // 5-minute cache

router.get('/exchange-rate/:fromCode', async (req, res) => {
  try {
    const from = (req.params.fromCode || 'USD').toUpperCase();

    // USD → USD is always 1
    if (from === 'USD') return res.json({ from: 'USD', to: 'USD', rate: 1 });

    // Check cache
    const cached = _fxCache[from];
    if (cached && Date.now() - cached.time < FX_TTL) {
      return res.json(cached.data);
    }

    const pair = `${from}USD=X`;
    const quote = await marketDataService.getQuote(pair);

    if (!quote || !quote.price) {
      return res.status(404).json({ message: `Exchange rate not found for ${from}` });
    }

    const result = { from, to: 'USD', rate: quote.price, pair };
    _fxCache[from] = { data: result, time: Date.now() };
    res.json(result);

  } catch (error) {
    console.error('[FX] Exchange rate error:', error.message);
    res.status(500).json({ message: 'Failed to fetch exchange rate' });
  }
});

module.exports = router;
