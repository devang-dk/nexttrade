// =====================================================================
// routes/news.js — Financial News Endpoints (Finnhub API)
// =====================================================================

const express = require('express');
const axios   = require('axios');
const { protect } = require('../middleware/auth');

const router = express.Router();
const API_KEY = process.env.MARKET_API_KEY;
const BASE    = 'https://finnhub.io/api/v1';

// ===== CACHE =====
// Avoid hammering the Finnhub free-tier limit (60 req/min)
const cache    = new Map(); // key → { data, ts }
const imgCache = new Map(); // url → { buf, contentType, ts }
const CACHE_TTL     = 5  * 60 * 1000; // 5 minutes  — news JSON
const IMG_CACHE_TTL = 10 * 60 * 1000; // 10 minutes — proxied images

function fromCache(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function toCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// ===== GET /api/news/img?url=<encoded-image-url> =====
// Image proxy — fetches the image server-side (no Referer header) so hotlink
// protection from Reuters, CNBC, Bloomberg etc. is transparently bypassed.
// No auth required — the URL is already embedded in authenticated news data.
router.get('/img', async (req, res) => {
  const imgUrl = req.query.url;
  if (!imgUrl || !imgUrl.startsWith('http')) {
    return res.status(400).send('Missing or invalid url param');
  }

  // Serve from in-memory cache if fresh
  const cached = imgCache.get(imgUrl);
  if (cached && Date.now() - cached.ts < IMG_CACHE_TTL) {
    res.set('Content-Type', cached.contentType);
    res.set('Cache-Control', 'public, max-age=600');
    return res.send(cached.buf);
  }

  try {
    const imgOrigin = new URL(imgUrl).origin; // e.g. https://www.reuters.com
    const response = await axios.get(imgUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxRedirects: 5,
      headers: {
        // Spoof Referer as the image's own domain — passes most CDN hotlink checks
        'Referer': imgOrigin + '/',
        'Origin':  imgOrigin,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const buf         = Buffer.from(response.data);

    imgCache.set(imgUrl, { buf, contentType, ts: Date.now() });

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=600');
    res.send(buf);
  } catch (err) {
    // Return a transparent 1×1 GIF so the <img> doesn't show a broken icon
    const BLANK_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.send(BLANK_GIF);
  }
});

// ===== HELPER: Normalize a Finnhub news item =====
function normalizeItem(item) {
  return {
    id:        item.id || item.datetime,
    headline:  item.headline || item.summary || 'No title',
    summary:   item.summary  || '',
    source:    item.source   || 'Finnhub',
    url:       item.url      || '#',
    image:     item.image    || '',
    datetime:  item.datetime || Math.floor(Date.now() / 1000),
    related:   item.related  || item.category || '',
    sentiment: item.sentiment || null,
  };
}

// ===== GET /api/news/market?category=general =====
// General market news (top headlines). category: general | forex | crypto | merger
router.get('/market', async (req, res) => {
  const category = req.query.category || 'general';
  const cacheKey = `market:${category}`;

  const cached = fromCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const { data } = await axios.get(`${BASE}/news`, {
      params: { category, token: API_KEY },
      timeout: 8000,
    });

    const items = (Array.isArray(data) ? data : [])
      .filter(item => item.headline && item.url)
      .slice(0, 30)
      .map(normalizeItem);

    toCache(cacheKey, items);
    res.json(items);
  } catch (err) {
    console.error('[News] Market news error:', err.message);
    res.status(500).json({ message: 'Failed to fetch market news' });
  }
});

// ===== GET /api/news/company/:symbol =====
// Company-specific news for the last 7 days
router.get('/company/:symbol', async (req, res) => {
  const symbol   = req.params.symbol.toUpperCase();
  const cacheKey = `company:${symbol}`;

  const cached = fromCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const today = new Date();
    const from  = new Date(today - 7 * 86400 * 1000).toISOString().slice(0, 10);
    const to    = today.toISOString().slice(0, 10);

    const { data } = await axios.get(`${BASE}/company-news`, {
      params: { symbol, from, to, token: API_KEY },
      timeout: 8000,
    });

    const items = (Array.isArray(data) ? data : [])
      .filter(item => item.headline && item.url)
      .slice(0, 20)
      .map(normalizeItem);

    toCache(cacheKey, items);
    res.json(items);
  } catch (err) {
    console.error(`[News] Company news error for ${symbol}:`, err.message);
    res.status(500).json({ message: 'Failed to fetch company news' });
  }
});

// ===== GET /api/news/sentiment/:symbol =====
// Insider sentiment data (social/news sentiment score)
router.get('/sentiment/:symbol', async (req, res) => {
  const symbol   = req.params.symbol.toUpperCase();
  const cacheKey = `sentiment:${symbol}`;

  const cached = fromCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const { data } = await axios.get(`${BASE}/news-sentiment`, {
      params: { symbol, token: API_KEY },
      timeout: 8000,
    });

    toCache(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error(`[News] Sentiment error for ${symbol}:`, err.message);
    res.status(500).json({ message: 'Failed to fetch sentiment' });
  }
});

module.exports = router;
