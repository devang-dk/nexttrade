// ===================================================================
// dashboard.js — Main dashboard logic with Real-time WebSocket
// ===================================================================

let currentOrderSide = 'buy';
let currentOrderType = 'market';
let pendingOrder     = null;
let refreshInterval  = null;

function getLastFillStorageKey() {
  const user = getCurrentUser() || {};
  const scope = user.id || user._id || user.email || 'guest';
  return `lastFill:${String(scope).toLowerCase()}`;
}

function renderLastFillPrice(fill) {
  const el = document.getElementById('lastFillPrice');
  if (!el) return;

  if (!fill || !fill.symbol || !fill.price) {
    el.textContent = 'Last Fill: —';
    return;
  }

  const side = (fill.side || '').toUpperCase();
  const ts = fill.timestamp ? new Date(fill.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET' : '';
  el.textContent = `Last Fill: ${side} ${fill.symbol} @ $${Number(fill.price).toFixed(2)}${ts ? ` · ${ts}` : ''}`;
}

function loadLastFillPrice() {
  try {
    const raw = localStorage.getItem(getLastFillStorageKey());
    const fill = raw ? JSON.parse(raw) : null;
    renderLastFillPrice(fill);
  } catch (_) {
    renderLastFillPrice(null);
  }
}

function saveLastFillPrice(symbol, price, side) {
  const fill = {
    symbol,
    price,
    side,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(getLastFillStorageKey(), JSON.stringify(fill));
  renderLastFillPrice(fill);
}

// ===== INIT =====
// ===== CURRENCY HELPER — module scope so all functions can use it =====
// Reads getActiveMarket() at render time, so switching markets updates instantly
function mktCurrency() {
  return (typeof getActiveMarket === 'function') ? (getActiveMarket().currency || '$') : '$';
}

window.addEventListener('DOMContentLoaded', async () => {
  const user = initUserSession();
  if (!user) return;

  loadLastFillPrice();

  const urlSymbol = new URLSearchParams(window.location.search).get('symbol');
  if (urlSymbol) {
    currentSymbol = urlSymbol.toUpperCase();
  } else {
    // Default to first stock of the currently active market (not always AAPL)
    const marketStocks = getActiveMarketStocks();
    if (marketStocks.length > 0) currentSymbol = marketStocks[0].symbol;
  }
  const orderSymbolEl = document.getElementById('orderSymbol');
  if (orderSymbolEl) orderSymbolEl.value = currentSymbol;

  initChart();

  // ── Populate order summary immediately on load (no click required) ──
  updateOrderSummary();
  // Retry after 800ms in case the quote API is still fetching
  setTimeout(updateOrderSummary, 800);

  // ── Shared UI (market switcher, sidebar watchlist, market status) ──
  // Must come AFTER initChart so currentSymbol is set correctly
  if (typeof initSharedUI === 'function') initSharedUI();

  try { await MarketAPI.getQuotes(getActiveMarketStocks().map(s => s.symbol)); } catch (_) {}

  buildTickerTape();
  buildWatchlist();
  await renderOrders();
  updateStats();

  _populateProfileDropdown(user);

  RealtimeMarketAPI.connect();

  const ALL_SIDEBAR_SYMS = getActiveMarketStocks().map(s => s.symbol);
  ALL_SIDEBAR_SYMS.forEach(symbol => {
    RealtimeMarketAPI.subscribe(symbol, (update) => {
      updateWatchlistItemPrice(update.symbol, update.price, update.change);
      updateTickerPrice(update.symbol, update.price, update.change);
    });
  });

  MarketAPI.getAllStocks().forEach(stock => {
    if (!ALL_SIDEBAR_SYMS.includes(stock.symbol)) {
      RealtimeMarketAPI.subscribe(stock.symbol, (update) => {
        updateTickerPrice(update.symbol, update.price, update.change);
      });
    }
  });

  refreshInterval = setInterval(() => {
    updateStats();
    const user = getCurrentUser();
    if (user) updateBalanceDisplay(user.balance);
  }, 5000);

  // Listen for market switches — reset to first stock of new market, reload chart
  window.addEventListener('marketChanged', async () => {
    const mkt = getActiveMarket();
    const stocks = getActiveMarketStocks();
    if (stocks.length > 0) {
      const firstSymbol = stocks[0].symbol;
      currentSymbol = firstSymbol;
      const orderSymbolEl = document.getElementById('orderSymbol');
      if (orderSymbolEl) orderSymbolEl.value = firstSymbol;
      loadChartData(currentSymbol, currentInterval);
      updateOrderSummary();
    }
    buildTickerTape();
    buildWatchlist();
    showToast(`Switched to ${mkt.flag} ${mkt.label}`, 'success');
  });
});

// ===== MARKET STATUS =====
let _marketStatusTimer = null;
let _marketNextMs      = 0;
let _etClockTimer      = null;

// ===== MARKET LABELS (per exchange) — used by banner + clock =====
const MARKET_LABELS = {
  us: { exchange: 'NYSE / NASDAQ', hours: 'Mon–Fri, 9:30–16:00 ET',  tz: 'ET'  },
  in: { exchange: 'NSE India',     hours: 'Mon–Fri, 9:15–15:30 IST', tz: 'IST' },
  uk: { exchange: 'London (LSE)',  hours: 'Mon–Fri, 8:00–16:30 GMT', tz: 'GMT' },
  de: { exchange: 'Frankfurt',     hours: 'Mon–Fri, 9:00–17:30 CET', tz: 'CET' },
  jp: { exchange: 'Tokyo (TSE)',   hours: 'Mon–Fri, 9:00–15:30 JST', tz: 'JST' },
  hk: { exchange: 'HKEX',         hours: 'Mon–Fri, 9:30–16:00 HKT', tz: 'HKT' },
};

// Live exchange clock — shows local time for the active market
function _startEtClock() {
  if (_etClockTimer) clearInterval(_etClockTimer); // restart on market switch
  const mkt    = (typeof getActiveMarket === 'function') ? getActiveMarket() : { timezone: 'America/New_York', id: 'us' };
  const info   = MARKET_LABELS[mkt.id] || MARKET_LABELS.us;
  const tz     = mkt.timezone || 'America/New_York';
  const etFmt  = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  function tick() {
    const el = document.getElementById('msbEtTime');
    if (el) el.textContent = etFmt.format(new Date()) + ' ' + info.tz;
  }
  tick();
  _etClockTimer = setInterval(tick, 1000);
}

async function updateMarketStatus() {
  try {
    const token = localStorage.getItem('token');
    const mktId = (typeof getActiveMarket === 'function') ? getActiveMarket().id : 'us';
    const res   = await fetch(`http://localhost:8081/api/market/status?market=${mktId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    _marketNextMs = data.nextMs;
    renderMarketBadge(data);

    if (_marketStatusTimer) clearInterval(_marketStatusTimer);
    _marketStatusTimer = setInterval(() => {
      _marketNextMs = Math.max(0, _marketNextMs - 1000);
      updateCountdownDisplay(data.nextLabel, _marketNextMs);

      if (_marketNextMs <= 0) {
        clearInterval(_marketStatusTimer);
        setTimeout(updateMarketStatus, 2000);
      }
    }, 1000);

  } catch (_) {}
}

// ===== MARKET STATUS BANNER CONFIG — dynamic per selected market =====
const MSB_BASE_CONFIG = {
  'open':        { icon: '🟢', show: false },
  'pre-market':  { icon: '🌅', show: true  },
  'after-hours': { icon: '🌙', show: true  },
  'closed':      { icon: '🔴', show: true  },
};

function getMsbConfig(status, session) {
  const mkt = (typeof getActiveMarket === 'function') ? getActiveMarket() : { id: 'us' };
  const info = MARKET_LABELS[mkt.id] || MARKET_LABELS.us;
  const base = MSB_BASE_CONFIG[status] || MSB_BASE_CONFIG['closed'];
  const subtitles = {
    'open':        `${info.exchange} regular session is live (${info.hours}). Real-time quotes active.`,
    'pre-market':  `Pre-market trading is active. Regular session: ${info.hours}.`,
    'after-hours': `After-hours trading active. Regular session: ${info.hours}.`,
    'closed':      `${info.exchange} is currently closed. Regular session: ${info.hours}.`,
  };
  return {
    ...base,
    title:    session || 'Market Closed',
    subtitle: subtitles[status] || subtitles['closed'],
  };
}

// Cache the last fetched status data so the countdown can update the banner
let _lastStatusData = null;

function renderMarketBadge(data) {
  _lastStatusData = data;

  _startEtClock();

  // ---- Topbar pill ----
  const dot   = document.getElementById('marketDot');
  const text  = document.getElementById('marketStatusText');
  const badge = document.getElementById('marketStatusBadge');
  if (dot)  { dot.style.background = data.dotColor; dot.style.boxShadow = `0 0 6px ${data.dotColor}`; }
  if (badge) badge.style.borderColor = data.dotColor + '44';
  if (text)  { text.textContent = data.session; text.style.color = data.dotColor; }

  const banner = document.getElementById('marketStatusBanner');
  const cfg    = getMsbConfig(data.status, data.session);

  if (banner) {
    banner.style.setProperty('--msb-color', data.dotColor);
    banner.style.borderColor = data.dotColor + '33';
    banner.style.display     = cfg.show ? 'flex' : 'none';
  }

  const msbIcon     = document.getElementById('msbIcon');
  const msbTitle    = document.getElementById('msbTitle');
  const msbSubtitle = document.getElementById('msbSubtitle');
  const msbNextLbl  = document.getElementById('msbNextLabel');

  if (msbIcon)     msbIcon.textContent     = cfg.icon;
  if (msbTitle)    { msbTitle.textContent  = cfg.title;    msbTitle.style.color = data.dotColor; }
  if (msbSubtitle) msbSubtitle.textContent = cfg.subtitle;
  if (msbNextLbl)  msbNextLbl.textContent  = data.nextLabel + ' in';

  updateCountdownDisplay(data.nextLabel, data.nextMs);
}

function updateCountdownDisplay(nextLabel, ms) {
  // ---- Topbar countdown ----
  const topbarEl = document.getElementById('marketCountdown');
  if (topbarEl) {
    if (ms <= 0) {
      topbarEl.textContent = '';
    } else {
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const parts = [];
      if (h > 0) parts.push(`${h}h`);
      parts.push(`${String(m).padStart(2,'0')}m`);
      parts.push(`${String(s).padStart(2,'0')}s`);
      topbarEl.textContent = `· ${nextLabel} in ${parts.join(' ')}`;
    }
  }

  // ---- Dashboard banner countdown ----
  const bannerCd = document.getElementById('msbCountdown');
  if (bannerCd) {
    if (ms <= 0) {
      bannerCd.textContent = '—';
    } else {
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const parts = [];
      if (h > 0) parts.push(`${h}h`);
      parts.push(`${String(m).padStart(2,'0')}m`);
      parts.push(`${String(s).padStart(2,'0')}s`);
      bannerCd.textContent = parts.join(' ');
    }
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (refreshInterval) clearInterval(refreshInterval);
  if (_etClockTimer)   clearInterval(_etClockTimer);
  RealtimeMarketAPI.disconnect();
});

// ===== PROFILE DROPDOWN =====
function _populateProfileDropdown(user) {
  if (!user) return;
  const name   = user.name  || user.username || user.email?.split('@')[0] || 'User';
  const email  = user.email || '';
  const bal    = typeof user.balance === 'number' ? mktCurrency() + user.balance.toFixed(2) : mktCurrency() + '10,000.00';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // Topbar avatar
  const topbarAvatar = document.getElementById('topbarAvatar');
  if (topbarAvatar) topbarAvatar.textContent = initials;

  // Sidebar avatar
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  if (sidebarAvatar) sidebarAvatar.textContent = initials;
  const sidebarName = document.getElementById('sidebarName');
  if (sidebarName) sidebarName.textContent = name;

  // Dropdown fields
  const pdAvatar = document.getElementById('pdAvatar');
  if (pdAvatar) pdAvatar.textContent = initials;
  const pdName = document.getElementById('pdName');
  if (pdName) pdName.textContent = name;
  const pdEmail = document.getElementById('pdEmail');
  if (pdEmail) pdEmail.textContent = email;
  const pdBalance = document.getElementById('pdBalance');
  if (pdBalance) pdBalance.textContent = bal;
}

function toggleProfileDropdown() {
  const dd = document.getElementById('profileDropdown');
  if (!dd) return;
  const isOpen = dd.classList.contains('open');
  // Close any other open dropdowns first
  closeProfileDropdown();
  if (!isOpen) dd.classList.add('open');
}

function closeProfileDropdown() {
  document.getElementById('profileDropdown')?.classList.remove('open');
}

// Close on outside click
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('profileWrap');
  if (wrap && !wrap.contains(e.target)) closeProfileDropdown();
});

// ===== TICKER TAPE =====
async function buildTickerTape() {
  const container = document.getElementById('tickerInner');
  if (!container) return;
  const mkt   = (typeof getActiveMarket === 'function') ? getActiveMarket() : { currency: '$', currencyCode: 'USD' };
  const stocks = MarketAPI.getAllStocks();
  const items  = [...stocks, ...stocks];
  container.innerHTML = items.map(s => {
    const up = s.change >= 0;
    const { usdStr, localStr } = (typeof _sharedFmtPrice === 'function')
      ? _sharedFmtPrice(s.price, mkt)
      : { usdStr: '$' + s.price.toFixed(2), localStr: null };
    return `
      <div class="ticker-item">
        <span class="ticker-sym">${s.symbol}</span>
        <span class="ticker-prc">${usdStr}</span>
        <span class="ticker-chg ${up ? 'price-up' : 'price-down'}">${up ? '▲' : '▼'} ${Math.abs(s.change).toFixed(2)}%</span>
      </div>
    `;
  }).join('');
}

// ===== SIDEBAR STOCK LIST (Groww-style) =====
const SIDEBAR_STOCKS = [
  { symbol: 'AAPL',  name: 'Apple Inc.' },
  { symbol: 'TSLA',  name: 'Tesla Inc.' },
  { symbol: 'NVDA',  name: 'NVIDIA Corp.' },
  { symbol: 'MSFT',  name: 'Microsoft Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.' },
  { symbol: 'META',  name: 'Meta Platforms' },
  { symbol: 'NFLX',  name: 'Netflix Inc.' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices' },
  { symbol: 'INTC',  name: 'Intel Corp.' },
  { symbol: 'JPM',   name: 'JPMorgan Chase' },
  { symbol: 'V',     name: 'Visa Inc.' },
];

function loadSymbolFromSidebar(symbol) {
  // Update active state in sidebar
  document.querySelectorAll('.sidebar-stock-item').forEach(el => el.classList.remove('active'));
  const item = document.getElementById('ss-' + symbol);
  if (item) item.classList.add('active');
  // Also sync the bottom watchlist
  document.querySelectorAll('.watchlist-item').forEach(el => el.classList.remove('active'));
  const wlItem = document.getElementById('wl-' + symbol);
  if (wlItem) wlItem.classList.add('active');
  loadSymbol(symbol);
}

// ===== WATCHLIST =====
const WATCHLIST_SYMS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX'];

function buildWatchlist() {
  const container = document.getElementById('watchlistContainer');
  if (!container) return;
  const mkt    = (typeof getActiveMarket === 'function') ? getActiveMarket() : { currency: '$', currencyCode: 'USD' };
  const stocks = MarketAPI.getAllStocks().filter(s => WATCHLIST_SYMS.includes(s.symbol));
  container.innerHTML = stocks.map(s => {
    const up     = s.change >= 0;
    const active = s.symbol === currentSymbol ? 'active' : '';
    const { usdStr, localStr } = (typeof _sharedFmtPrice === 'function')
      ? _sharedFmtPrice(s.price, mkt)
      : { usdStr: '$' + s.price.toFixed(2), localStr: null };
    return `
      <div class="watchlist-item ${active}" id="wl-${s.symbol}" onclick="loadSymbolFromWatchlist('${s.symbol}')">
        <div>
          <div class="watchlist-sym">${s.symbol}</div>
          <div style="font-size:0.7rem; color:var(--text-muted);">${s.name.split(' ').slice(0,2).join(' ')}</div>
        </div>
        <div style="flex:1;"></div>
        <div style="text-align:right;">
          <div class="watchlist-price ${up ? 'price-up' : 'price-down'}" id="wl-price-${s.symbol}">
            ${usdStr}${localStr ? `<span class="wl-local">${localStr}</span>` : ''}
          </div>
          <div class="watchlist-chg ${up ? 'price-up' : 'price-down'}" id="wl-chg-${s.symbol}">${up ? '▲' : '▼'} ${Math.abs(s.change).toFixed(2)}%</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateWatchlistPrices() {
  const stocks = MarketAPI.getAllStocks().filter(s => WATCHLIST_SYMS.includes(s.symbol));
  stocks.forEach(s => {
    const priceEl = document.getElementById('wl-price-' + s.symbol);
    const chgEl   = document.getElementById('wl-chg-' + s.symbol);
    if (!priceEl) return;
    const up = s.change >= 0;
    priceEl.textContent = mktCurrency() + s.price.toFixed(2);
    priceEl.className   = `watchlist-price ${up ? 'price-up' : 'price-down'}`;
    if (chgEl) {
      chgEl.textContent = `${up ? '▲' : '▼'} ${Math.abs(s.change).toFixed(2)}%`;
      chgEl.className   = `watchlist-chg ${up ? 'price-up' : 'price-down'}`;
    }
  });
}

// Real-time update for a single watchlist item (bottom widget + sidebar)
function updateWatchlistItemPrice(symbol, price, change) {
  const up  = change >= 0;
  const fmt = v => (v >= 0 ? '▲' : '▼') + ' ' + Math.abs(v).toFixed(2) + '%';
  const mkt = (typeof getActiveMarket === 'function') ? getActiveMarket() : { currency: '$', currencyCode: 'USD' };
  const { usdStr, localStr } = (typeof _sharedFmtPrice === 'function')
    ? _sharedFmtPrice(price, mkt)
    : { usdStr: '$' + price.toFixed(2), localStr: null };
  const priceHtml = usdStr + (localStr ? `<span class="wl-local">${localStr}</span>` : '');

  // Bottom watchlist widget
  const priceEl = document.getElementById('wl-price-' + symbol);
  const chgEl   = document.getElementById('wl-chg-'   + symbol);
  if (priceEl) { priceEl.innerHTML = priceHtml; priceEl.className = `watchlist-price ${up ? 'price-up' : 'price-down'}`; }
  if (chgEl)   { chgEl.textContent = fmt(change); chgEl.className = `watchlist-chg ${up ? 'price-up' : 'price-down'}`; }

  // Sidebar stock list
  const ssPriceHtml = usdStr + (localStr ? `<span class="ss-local">${localStr}</span>` : '');
  const ssPriceEl = document.getElementById('ss-price-' + symbol);
  const ssChgEl   = document.getElementById('ss-chg-'   + symbol);
  if (ssPriceEl) { ssPriceEl.innerHTML = ssPriceHtml; ssPriceEl.className = `ss-price ${up ? 'price-up' : 'price-down'}`; }
  if (ssChgEl)   { ssChgEl.textContent = fmt(change);  ssChgEl.className  = `ss-chg ${up ? 'price-up' : 'price-down'}`; }
}

// Real-time update for ticker items
function updateTickerPrice(symbol, price, change) {
  const mkt = (typeof getActiveMarket === 'function') ? getActiveMarket() : { currency: '$', currencyCode: 'USD' };
  const { usdStr } = (typeof _sharedFmtPrice === 'function')
    ? _sharedFmtPrice(price, mkt)
    : { usdStr: '$' + price.toFixed(2) };
  document.querySelectorAll('.ticker-item').forEach(item => {
    if (item.querySelector('.ticker-sym')?.textContent !== symbol) return;
    const priceEl = item.querySelector('.ticker-prc');
    const chgEl   = item.querySelector('.ticker-chg');
    if (priceEl) priceEl.textContent = usdStr;
    if (chgEl) {
      const up = change >= 0;
      chgEl.textContent = `${up ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`;
      chgEl.className   = `ticker-chg ${up ? 'price-up' : 'price-down'}`;
    }
  });
}

function loadSymbolFromWatchlist(symbol) {
  document.querySelectorAll('.watchlist-item').forEach(el => el.classList.remove('active'));
  const item = document.getElementById('wl-' + symbol);
  if (item) item.classList.add('active');
  loadSymbol(symbol);
}

// ===== ORDER TAB SWITCH =====
function switchOrderTab(side) {
  currentOrderSide = side;
  const buyTab  = document.getElementById('buyTab');
  const sellTab = document.getElementById('sellTab');
  const execBtn = document.getElementById('executeBtn');
  const sym     = document.getElementById('orderSymbol')?.value || 'AAPL';

  if (side === 'buy') {
    buyTab.classList.add('active');
    sellTab.classList.remove('active');
    execBtn.className = 'btn btn-buy btn-full btn-lg';
  } else {
    sellTab.classList.add('active');
    buyTab.classList.remove('active');
    execBtn.className = 'btn btn-sell btn-full btn-lg';
  }
  updateOrderSummary();
}

// ===== ORDER TYPE =====
function setOrderType(type) {
  currentOrderType = type;
  document.querySelectorAll('.order-type-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('ot' + type.charAt(0).toUpperCase() + type.slice(1))?.classList.add('active');
  
  const limitGroup = document.getElementById('limitPriceGroup');
  if (limitGroup) limitGroup.style.display = (type === 'limit' || type === 'stop') ? 'flex' : 'none';
  updateOrderSummary();
}

// ===== UPDATE ORDER SUMMARY =====
async function updateOrderSummary() {
  const symbol = (document.getElementById('orderSymbol')?.value || 'AAPL').toUpperCase();
  const qty    = parseInt(document.getElementById('orderQty')?.value || '1') || 1;
  const side   = currentOrderSide;

  try {
    const quote = await MarketAPI.getQuote(symbol);
    const localPrice = (currentOrderType === 'limit' && document.getElementById('limitPrice')?.value)
                       ? parseFloat(document.getElementById('limitPrice').value)
                       : quote.price;

    const mkt      = (typeof getActiveMarket === 'function') ? getActiveMarket() : { currency: '$', currencyCode: 'USD' };
    const isUSD    = mkt.currencyCode === 'USD';
    const limitLabel = document.getElementById('limitPriceLabel');

    // Get USD price
    let usdPrice = localPrice;
    if (!isUSD && typeof getUsdPrice === 'function') {
      try { ({ usdPrice } = await getUsdPrice(localPrice)); } catch (_) {}
    }
    const usdTotal = usdPrice * qty;
    const localTotal = localPrice * qty;

    const summaryPrice  = document.getElementById('summary-price');
    const summaryShares = document.getElementById('summary-shares');
    const summaryTotal  = document.getElementById('summary-total');
    const execBtn       = document.getElementById('executeBtn');

    const usdPriceStr = '$' + usdPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const usdTotalStr = '$' + usdTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const localPriceStr = isUSD ? '' : ` <span style="color:var(--text-muted);font-size:0.75rem;">(${mkt.currency}${localPrice.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})})</span>`;
    const localTotalStr = isUSD ? '' : ` <span style="color:var(--text-muted);font-size:0.75rem;">(${mkt.currency}${localTotal.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})})</span>`;

    if (limitLabel) limitLabel.textContent = `Limit Price (${isUSD ? '$' : mkt.currency})`;
    if (summaryPrice)  {
      summaryPrice.innerHTML = usdPriceStr + localPriceStr;
      summaryPrice.dataset.usd   = usdPrice.toFixed(4);   // clean USD value for executeOrder
      summaryPrice.dataset.local = localPrice.toFixed(4); // raw local value for modal sub-label
    }
    if (summaryShares) summaryShares.textContent = qty;
    if (summaryTotal)  summaryTotal.innerHTML   = usdTotalStr + localTotalStr;
    if (execBtn)       execBtn.textContent      = `${side.toUpperCase()} ${qty} ${symbol}`;

  } catch (_) {}
}

// ===== USD PRICE CONVERTER =====
// Converts a price in the active market's local currency to USD using live FX rates.
// Caches rates for the session to avoid repeated fetches.
const _fxRateCache = {};
async function getUsdPrice(localPrice) {
  const currencyCode = getActiveCurrencyCode();
  if (currencyCode === 'USD') return { usdPrice: localPrice, rate: 1 };

  // Use session cache if fresh
  const cached = _fxRateCache[currencyCode];
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
    return { usdPrice: +(localPrice * cached.rate).toFixed(4), rate: cached.rate };
  }

  try {
    const resp = await fetch(`http://localhost:8081/api/market/exchange-rate/${currencyCode}`);
    if (!resp.ok) throw new Error('FX fetch failed');
    const data = await resp.json();
    _fxRateCache[currencyCode] = { rate: data.rate, ts: Date.now() };
    return { usdPrice: +(localPrice * data.rate).toFixed(4), rate: data.rate };
  } catch {
    // Fallback hardcoded rates if API is down
    const FALLBACK = { INR: 0.012, GBP: 1.27, EUR: 1.09, JPY: 0.0067, HKD: 0.128 };
    const rate = FALLBACK[currencyCode] || 1;
    return { usdPrice: +(localPrice * rate).toFixed(4), rate };
  }
}

// ===== EXECUTE ORDER =====
async function executeOrder() {
  const symbol = (document.getElementById('orderSymbol')?.value || '').toUpperCase().trim();
  const qty    = parseInt(document.getElementById('orderQty')?.value || '0');
  const errEl  = document.getElementById('order-error');

  if (errEl) errEl.style.display = 'none';

  if (!symbol) { showErr('Please enter a stock symbol'); return; }
  if (!qty || qty < 1) { showErr('Please enter a valid quantity'); return; }

  try {
    // Use the currently displayed summary price to prevent mismatch caused by
    // fetching a new quote between preview and confirmation.
    let price = null;

    if ((currentOrderType === 'limit' || currentOrderType === 'stop') && document.getElementById('limitPrice')?.value) {
      const entered = parseFloat(document.getElementById('limitPrice').value);
      if (!Number.isNaN(entered) && entered > 0) {
        price = entered;
      }
    }

    if (price === null) {
      // First try the data-usd attribute (set by updateOrderSummary)
      const usdAttr = document.getElementById('summary-price')?.dataset?.usd;
      const attrVal = parseFloat(usdAttr);
      if (!Number.isNaN(attrVal) && attrVal > 0) {
        price = attrVal;
      }
    }

    if (price === null) {
      // Fallback: strip HTML and parse first number from textContent
      const rawText = (document.getElementById('summary-price')?.textContent || '').replace(/[^0-9.]/g, ' ').trim();
      const firstNum = parseFloat(rawText.split(/\s+/)[0]);
      if (!Number.isNaN(firstNum) && firstNum > 0) price = firstNum;
    }

    if (price === null) {
      const quote = await MarketAPI.getQuote(symbol);
      price = quote.price;
    }

    // Always determine the correct USD price and rate for this symbol
    const currencyCode = getActiveCurrencyCode();
    let usdPrice, rate, localPrice;

    if (currencyCode === 'USD') {
      // USD market: straightforward
      usdPrice   = price;
      localPrice = price;
      rate       = 1;
    } else {
      // Non-USD market:
      // • usdPrice  → read from pre-computed data-usd attribute
      // • localPrice → read from data-local attribute (raw quote in local currency)
      // • rate       → fetch real rate (always, for correct display)
      const summaryEl  = document.getElementById('summary-price');
      const storedUsd  = parseFloat(summaryEl?.dataset?.usd);
      const storedLocal = parseFloat(summaryEl?.dataset?.local);

      usdPrice   = (!Number.isNaN(storedUsd)   && storedUsd > 0)   ? storedUsd   : price;
      localPrice = (!Number.isNaN(storedLocal)  && storedLocal > 0) ? storedLocal : price;

      // getUsdPrice(1) gives us the rate without caring about input magnitude
      try {
        const fxResult = await getUsdPrice(1);
        rate = fxResult.rate;
      } catch (_) {
        rate = 1;
      }
    }

    pendingOrder = { symbol, qty, price: usdPrice, localPrice, currencyCode, side: currentOrderSide, type: currentOrderType };

    // Show confirm modal
    const modal      = document.getElementById('orderConfirmModal');
    const modalBody  = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const isBuy      = currentOrderSide === 'buy';
    const usdTotal   = (usdPrice * qty).toFixed(2);
    const localTotal = (localPrice * qty).toFixed(2);
    const isNonUSD   = currencyCode !== 'USD';

    modalTitle.textContent = `Confirm ${isBuy ? 'Buy' : 'Sell'} Order`;
    confirmBtn.className   = `btn ${isBuy ? 'btn-buy' : 'btn-sell'} btn-full`;
    confirmBtn.textContent = `Confirm ${isBuy ? 'Buy' : 'Sell'}`;

    modalBody.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; justify-content:space-between; padding:12px; background:var(--bg-card); border-radius:var(--radius-md);">
          <span class="text-muted">Symbol</span>
          <span class="font-mono font-bold text-lg">${symbol}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:12px; background:var(--bg-card); border-radius:var(--radius-md);">
          <span class="text-muted">Action</span>
          <span class="badge ${isBuy ? 'badge-green' : 'badge-red'}">${currentOrderSide.toUpperCase()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:12px; background:var(--bg-card); border-radius:var(--radius-md);">
          <span class="text-muted">Quantity</span>
          <span class="font-mono font-semibold">${qty} shares</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-card); border-radius:var(--radius-md);">
          <span class="text-muted">Price</span>
          <div style="text-align:right;">
            <div class="font-mono font-semibold">$${usdPrice.toFixed(2)} <span style="color:var(--text-muted);font-size:0.75rem;">USD</span></div>
            ${isNonUSD ? `<div style="font-size:0.72rem; color:var(--text-muted);">${mktCurrency()}${localPrice.toFixed(2)} @ ${rate.toFixed(4)}</div>` : ''}
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; padding:14px 12px; background:${isBuy ? 'var(--green-glow)' : 'var(--red-glow)'}; border:1px solid ${isBuy ? 'rgba(0,230,118,0.3)' : 'rgba(255,71,87,0.3)'}; border-radius:var(--radius-md);">
          <span class="font-bold">Total <span style="font-size:0.72rem; color:var(--text-muted); font-weight:400;">USD</span></span>
          <div style="text-align:right;">
            <div class="font-mono font-bold text-lg ${isBuy ? 'price-up' : 'price-down'}">$${usdTotal}</div>
            ${isNonUSD ? `<div style="font-size:0.72rem; color:var(--text-muted);">${mktCurrency()}${localTotal}</div>` : ''}
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
  } catch (err) {
    showErr(err.message);
  }
}

function showErr(msg) {
  const errEl = document.getElementById('order-error');
  if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
}

async function confirmOrder() {
  if (!pendingOrder) return;
  const { symbol, qty, price, side } = pendingOrder;

  closeModal();

  try {
    if (side === 'buy') {
      await PortfolioAPI.buy(symbol, qty, price, currentOrderType);
    } else {
      await PortfolioAPI.sell(symbol, qty, price, currentOrderType);
    }

    if (currentOrderType === 'market') {
      saveLastFillPrice(symbol, price, side);
    }

    const user = getCurrentUser();
    if (user) updateBalanceDisplay(user.balance);
    updateStats();
    await renderOrders();

    showToast(
      `${side === 'buy' ? '🟢 Bought' : '🔴 Sold'} ${qty} ${symbol} @ $${price.toFixed(2)} USD`,
      'success'
    );

  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }

  pendingOrder = null;
}

function closeModal() {
  const modal = document.getElementById('orderConfirmModal');
  if (modal) modal.classList.remove('open');
}

// ===== STATS UPDATE =====
async function updateStats() {
  const user = getCurrentUser();
  if (!user) return;

  const holdings = await PortfolioAPI.getHoldings();
  let portfolioValue = user.balance;  // balance is always in USD
  let todayPnl = 0;

  // Prime FX cache for all non-USD markets in portfolio
  const mktsNeeded = new Set();
  for (const h of holdings) {
    const mkt = (typeof findMarketForSymbol === 'function') ? findMarketForSymbol(h.symbol) : null;
    if (mkt && mkt.currencyCode !== 'USD') mktsNeeded.add(mkt);
  }
  for (const mkt of mktsNeeded) {
    if (typeof _portfolioEnsureFxRate === 'function') await _portfolioEnsureFxRate(mkt.currencyCode);
    else await _dashEnsureFxRate(mkt.currencyCode);
  }

  for (const h of holdings) {
    const quote = await MarketAPI.getQuote(h.symbol);
    const mkt   = (typeof findMarketForSymbol === 'function') ? findMarketForSymbol(h.symbol) : null;

    // Convert to USD — raw quote.price may be in INR, GBP, etc.
    const priceUSD   = _dashToUSD(quote.price, mkt);
    const currentVal = priceUSD * h.shares;         // USD ✓
    portfolioValue  += currentVal;
    todayPnl += (priceUSD - h.avgPrice) * h.shares * 0.01; // approx daily move in USD
  }

  let totalOrders = OrderAPI.getOrders().length;
  if (!DEMO_MODE) {
    try {
      totalOrders = (await OrderAPI.getOrdersRemote()).length;
    } catch (_) {}
  }
  const pnlPct   = ((portfolioValue - 10000) / 10000 * 100);
  const todayPct = ((todayPnl / portfolioValue) * 100);

  // Always display in USD — consistent with portfolio page
  setElText('statPortfolioValue', '$' + portfolioValue.toFixed(2));
  setElText('statOrders', totalOrders);

  const pnlEl    = document.getElementById('statPnl');
  const pnlPctEl = document.getElementById('statPortfolioChange');
  const todayEl  = document.getElementById('statPnlPct');

  if (pnlEl) {
    const netPnl = portfolioValue - 10000;
    pnlEl.textContent = (netPnl >= 0 ? '+$' : '-$') + Math.abs(netPnl).toFixed(2);
    pnlEl.className   = `stat-value ${netPnl >= 0 ? 'text-green' : 'text-red'}`;
  }

  if (pnlPctEl) {
    pnlPctEl.textContent = (pnlPct >= 0 ? '▲ +' : '▼ ') + Math.abs(pnlPct).toFixed(2) + '%';
    pnlPctEl.className   = `change-pill ${pnlPct >= 0 ? 'up' : 'down'}`;
  }

  if (todayEl) {
    todayEl.textContent = (todayPct >= 0 ? '+' : '') + todayPct.toFixed(3) + '%';
    todayEl.className   = `change-pill ${todayPct >= 0 ? 'up' : 'down'}`;
  }
}

// ── FX helpers for dashboard (mirrors portfolio.js helpers) ───────────
const _dashFxCache = {};

async function _dashEnsureFxRate(currencyCode) {
  if (!currencyCode || currencyCode === 'USD') return;
  const cached = _dashFxCache[currencyCode];
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return;
  try {
    const resp = await fetch(`http://localhost:8081/api/market/exchange-rate/${currencyCode}`);
    if (!resp.ok) throw new Error();
    const data = await resp.json();
    _dashFxCache[currencyCode] = { rate: data.rate, ts: Date.now() };
  } catch {
    const FB = { INR: 0.012, GBP: 1.27, EUR: 1.09, JPY: 0.0067, HKD: 0.128 };
    _dashFxCache[currencyCode] = { rate: FB[currencyCode] || 1, ts: Date.now() - 4 * 60 * 1000 };
  }
}

function _dashToUSD(localPrice, mkt) {
  const code = mkt?.currencyCode || 'USD';
  if (code === 'USD') return localPrice;
  // Try portfolio cache first (already fetched), then own cache, then shared
  const rate = (_portfolioFxCache?.[code]?.rate) || (_dashFxCache[code]?.rate) || (_sharedFxCache?.[code]?.rate) || 1;
  return localPrice * rate;
}


function setElText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ===== RENDER ORDERS =====
async function renderOrders() {
  const container = document.getElementById('ordersContainer');
  if (!container) return;

  let orders = OrderAPI.getOrders().slice(0, 20);
  if (!DEMO_MODE) {
    try {
      orders = (await OrderAPI.getOrdersRemote()).slice(0, 20);
    } catch (_) {}
  }
  if (orders.length === 0) {
    container.innerHTML = '<div class="text-center text-muted" style="padding:40px 0; font-size:0.875rem;">No orders yet. Place your first trade above!</div>';
    return;
  }

  container.innerHTML = orders.map(o => `
    <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border);">
      <span class="order-badge ${o.type.toLowerCase()}">${o.type}</span>
      <span class="font-mono font-bold" style="min-width:50px;">${o.symbol}</span>
      <span class="text-muted text-sm">${o.shares} sh @ ${mktCurrency()}${o.price.toFixed(2)}</span>
      <span class="font-mono text-sm" style="margin-left:auto;">${formatDate(o.timestamp)}</span>
    </div>
  `).join('');
}

function clearOrders() {
  if (!DEMO_MODE) {
    showToast('Clear history is only available in demo mode', 'info');
    return;
  }
  OrderAPI.clearOrders();
  renderOrders();
  showToast('Order history cleared', 'info');
}

// ===== SEARCH =====
// Local stock universe for instant fallback when Finnhub is rate-limited
const LOCAL_STOCK_UNIVERSE = [
  { symbol:'AAPL',  name:'Apple Inc.'               }, { symbol:'MSFT',  name:'Microsoft Corp.'          },
  { symbol:'GOOGL', name:'Alphabet Inc.'             }, { symbol:'AMZN',  name:'Amazon.com Inc.'          },
  { symbol:'NVDA',  name:'NVIDIA Corp.'              }, { symbol:'META',  name:'Meta Platforms Inc.'      },
  { symbol:'TSLA',  name:'Tesla Inc.'                }, { symbol:'V',     name:'Visa Inc.'                },
  { symbol:'JPM',   name:'JPMorgan Chase'            }, { symbol:'UNH',   name:'UnitedHealth Group'       },
  { symbol:'JNJ',   name:'Johnson & Johnson'         }, { symbol:'MA',    name:'Mastercard Inc.'          },
  { symbol:'XOM',   name:'Exxon Mobil Corp.'         }, { symbol:'WMT',   name:'Walmart Inc.'             },
  { symbol:'HD',    name:'Home Depot Inc.'           }, { symbol:'PG',    name:'Procter & Gamble'         },
  { symbol:'BAC',   name:'Bank of America'           }, { symbol:'CVX',   name:'Chevron Corp.'            },
  { symbol:'MRK',   name:'Merck & Co.'               }, { symbol:'PFE',   name:'Pfizer Inc.'              },
  { symbol:'AMD',   name:'Advanced Micro Devices'    }, { symbol:'INTC',  name:'Intel Corp.'              },
  { symbol:'ORCL',  name:'Oracle Corp.'              }, { symbol:'CRM',   name:'Salesforce Inc.'          },
  { symbol:'ADBE',  name:'Adobe Inc.'                }, { symbol:'NFLX',  name:'Netflix Inc.'             },
  { symbol:'PYPL',  name:'PayPal Holdings'           }, { symbol:'DIS',   name:'Walt Disney Co.'          },
  { symbol:'KO',    name:'Coca-Cola Co.'             }, { symbol:'PEP',   name:'PepsiCo Inc.'             },
  { symbol:'MCD',   name:"McDonald's Corp."          }, { symbol:'SBUX',  name:'Starbucks Corp.'          },
  { symbol:'NKE',   name:'Nike Inc.'                 }, { symbol:'GS',    name:'Goldman Sachs'            },
  { symbol:'MS',    name:'Morgan Stanley'            }, { symbol:'WFC',   name:'Wells Fargo & Co.'        },
  { symbol:'ABBV',  name:'AbbVie Inc.'               }, { symbol:'ABT',   name:'Abbott Laboratories'      },
  { symbol:'CAT',   name:'Caterpillar Inc.'          }, { symbol:'BA',    name:'Boeing Co.'               },
  { symbol:'HON',   name:'Honeywell International'   }, { symbol:'GE',    name:'General Electric'         },
  { symbol:'UPS',   name:'United Parcel Service'     }, { symbol:'LMT',   name:'Lockheed Martin'          },
  { symbol:'RTX',   name:'RTX Corp.'                 }, { symbol:'SLB',   name:'SLB (Schlumberger)'       },
  { symbol:'FCX',   name:'Freeport-McMoRan'          }, { symbol:'DE',    name:'Deere & Company'          },
  { symbol:'COST',  name:'Costco Wholesale'          }, { symbol:'TGT',   name:'Target Corp.'             },
  { symbol:'UBER',  name:'Uber Technologies'         }, { symbol:'LYFT',  name:'Lyft Inc.'                },
  { symbol:'SPOT',  name:'Spotify Technology'        }, { symbol:'SNAP',  name:'Snap Inc.'                },
  { symbol:'TWTR',  name:'Twitter / X Corp.'         }, { symbol:'COIN',  name:'Coinbase Global'          },
  { symbol:'ROKU',  name:'Roku Inc.'                 }, { symbol:'PLTR',  name:'Palantir Technologies'    },
  { symbol:'F',     name:'Ford Motor Co.'            }, { symbol:'GM',    name:'General Motors'           },
  { symbol:'RIVN',  name:'Rivian Automotive'         }, { symbol:'LCID',  name:'Lucid Group'              },
];

// Dashboard-specific local search (uses the large LOCAL_STOCK_UNIVERSE + live prices)
// Named differently to avoid overriding shared.js's market-aware localSearch()
function _dashLocalSearch(query) {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  return LOCAL_STOCK_UNIVERSE.filter(s =>
    s.symbol.startsWith(q) || s.name.toUpperCase().includes(q)
  ).slice(0, 8);
}

// Debounce + race-condition guard
let _searchDebounce  = null;
let _searchRequestId = 0;   // incremented on every keystroke; stale responses are ignored

function onSearchInput(query) {
  const dropdown = document.getElementById('searchDropdown');
  if (!dropdown) return;

  if (!query || query.length < 1) {
    dropdown.classList.remove('open');
    clearTimeout(_searchDebounce);
    return;
  }

  // Show local results instantly (no API wait)
  const instant = _dashLocalSearch(query);
  if (instant.length > 0) {
    renderSearchResults(instant, dropdown, true);  // true = show loading spinner alongside
  }

  // Debounce the real API call by 320ms
  clearTimeout(_searchDebounce);
  const thisId = ++_searchRequestId;

  _searchDebounce = setTimeout(async () => {
    try {
      const apiResults = await MarketAPI.search(query);

      // Discard if a newer query has already fired
      if (thisId !== _searchRequestId) return;

      // Use API results if non-empty, otherwise fall back to local
      const results = (apiResults && apiResults.length > 0) ? apiResults : _dashLocalSearch(query);
      if (results.length === 0) { dropdown.classList.remove('open'); return; }

      // Enrich with cached prices immediately (no extra wait)
      const enriched = results.map(r => {
        const cached = (typeof livePrices !== 'undefined' && livePrices[r.symbol])
          ? { price: livePrices[r.symbol], change: (typeof liveChanges !== 'undefined' ? liveChanges[r.symbol] : undefined) }
          : null;
        return { ...r, _price: cached?.price, _change: cached?.change };
      });

      if (thisId !== _searchRequestId) return;
      renderSearchResults(enriched, dropdown, false);

      // Kick off a background quote fetch to fill in live prices
      const missing = enriched.filter(r => !Number.isFinite(r._price)).map(r => r.symbol);
      if (missing.length > 0) {
        MarketAPI.getQuotes(missing).then(quoteMap => {
          if (thisId !== _searchRequestId) return;
          const updated = enriched.map(r => {
            const q = quoteMap?.[r.symbol];
            return {
              ...r,
              _price:  q?.price  ?? r._price,
              _change: q?.changePercent ?? q?.change ?? r._change,
            };
          });
          renderSearchResults(updated, dropdown, false);
        }).catch(() => {});
      }

    } catch (_) {
      // API failed — keep the local results that are already showing
    }
  }, 320);
}

function renderSearchResults(results, dropdown, isLoading) {
  if (!dropdown) return;

  dropdown.innerHTML = results.map(r => {
    const hasPrice = Number.isFinite(r._price);
    const price    = hasPrice ? Number(r._price).toFixed(2) : '—';
    const change   = Number.isFinite(r._change) ? Number(r._change) : 0;
    const up       = change >= 0;
    return `
      <div class="search-result-item" onclick="selectSearchResult('${r.symbol}')">
        <div>
          <div class="font-mono font-bold" style="font-size:0.875rem;">${r.symbol}</div>
          <div class="text-muted" style="font-size:0.75rem;">${r.name}</div>
        </div>
        <div style="text-align:right;">
          <div class="font-mono" style="font-size:0.875rem;">${hasPrice ? mktCurrency()+price : '<span style="color:var(--text-muted);font-size:0.72rem;">Fetching…</span>'}</div>
          <div class="font-mono ${up ? 'price-up' : 'price-down'}" style="font-size:0.75rem;">${hasPrice ? (up?'▲':'▼')+' '+Math.abs(change).toFixed(2)+'%' : ''}</div>
        </div>
      </div>
    `;
  }).join('');

  if (isLoading) {
    dropdown.innerHTML += `<div style="padding:8px 14px; font-size:0.72rem; color:var(--text-muted); border-top:1px solid var(--border);">🔄 Fetching live results…</div>`;
  }

  dropdown.classList.add('open');
}

function selectSearchResult(symbol) {
  const inp = document.getElementById('stockSearch');
  if (inp) inp.value = symbol;
  clearTimeout(_searchDebounce);
  _searchRequestId++;   // cancel any pending search
  closeSearch();
  loadSymbol(symbol);
}

function closeSearch() {
  const dd = document.getElementById('searchDropdown');
  if (dd) dd.classList.remove('open');
}
