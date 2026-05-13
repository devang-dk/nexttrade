// ===================================================================
// shared.js — Shared topbar / sidebar logic for all pages
// Multi-market edition: US, India, UK, Germany, Japan, Hong Kong
// ===================================================================

// ===== MARKET DEFINITIONS =====
const MARKET_DEFINITIONS = {
  us: {
    id: 'us', label: 'NYSE / NASDAQ', flag: '🇺🇸', currency: '$', currencyCode: 'USD',
    timezone: 'America/New_York',
    watchlist: [
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
    ],
    localSearch: [
      { symbol:'AAPL', name:'Apple Inc.' }, { symbol:'MSFT', name:'Microsoft Corp.' },
      { symbol:'GOOGL', name:'Alphabet Inc.' }, { symbol:'AMZN', name:'Amazon.com Inc.' },
      { symbol:'NVDA', name:'NVIDIA Corp.' }, { symbol:'META', name:'Meta Platforms Inc.' },
      { symbol:'TSLA', name:'Tesla Inc.' }, { symbol:'JPM', name:'JPMorgan Chase' },
      { symbol:'V', name:'Visa Inc.' }, { symbol:'NFLX', name:'Netflix Inc.' },
      { symbol:'AMD', name:'Advanced Micro Devices' }, { symbol:'INTC', name:'Intel Corp.' },
      { symbol:'BAC', name:'Bank of America' }, { symbol:'GS', name:'Goldman Sachs' },
      { symbol:'UBER', name:'Uber Technologies' }, { symbol:'COIN', name:'Coinbase Global' },
    ],
  },
  in: {
    id: 'in', label: 'NSE India', flag: '🇮🇳', currency: '₹', currencyCode: 'INR',
    timezone: 'Asia/Kolkata',
    watchlist: [
      { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
      { symbol: 'TCS.NS',      name: 'Tata Consultancy Services' },
      { symbol: 'INFY.NS',     name: 'Infosys Ltd.' },
      { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
      { symbol: 'ICICIBANK.NS',name: 'ICICI Bank' },
      { symbol: 'WIPRO.NS',    name: 'Wipro Ltd.' },
      { symbol: 'BAJFINANCE.NS',name:'Bajaj Finance' },
      { symbol: 'ADANIENT.NS', name: 'Adani Enterprises' },
      { symbol: 'TMCV.NS',     name: 'Tata Motors' },
      { symbol: 'SBIN.NS',     name: 'State Bank of India' },
      { symbol: 'HINDUNILVR.NS',name:'Hindustan Unilever' },
      { symbol: 'LT.NS',       name: 'Larsen & Toubro' },
    ],
    localSearch: [
      { symbol:'RELIANCE.NS', name:'Reliance Industries' }, { symbol:'TCS.NS', name:'Tata Consultancy Services' },
      { symbol:'INFY.NS', name:'Infosys Ltd.' }, { symbol:'HDFCBANK.NS', name:'HDFC Bank' },
      { symbol:'ICICIBANK.NS', name:'ICICI Bank' }, { symbol:'WIPRO.NS', name:'Wipro Ltd.' },
      { symbol:'BAJFINANCE.NS', name:'Bajaj Finance' }, { symbol:'TMCV.NS', name:'Tata Motors' },
      { symbol:'SBIN.NS', name:'State Bank of India' }, { symbol:'ADANIENT.NS', name:'Adani Enterprises' },
      { symbol:'MARUTI.NS', name:'Maruti Suzuki' }, { symbol:'TITAN.NS', name:'Titan Company' },
    ],
  },
  uk: {
    id: 'uk', label: 'London (LSE)', flag: '🇬🇧', currency: '£', currencyCode: 'GBP',
    timezone: 'Europe/London',
    watchlist: [
      { symbol: 'SHEL.L',  name: 'Shell PLC' },
      { symbol: 'HSBA.L',  name: 'HSBC Holdings' },
      { symbol: 'BP.L',    name: 'BP PLC' },
      { symbol: 'AZN.L',   name: 'AstraZeneca' },
      { symbol: 'ULVR.L',  name: 'Unilever PLC' },
      { symbol: 'GSK.L',   name: 'GSK PLC' },
      { symbol: 'RIO.L',   name: 'Rio Tinto PLC' },
      { symbol: 'DGE.L',   name: 'Diageo PLC' },
      { symbol: 'LLOY.L',  name: 'Lloyds Banking Group' },
      { symbol: 'VOD.L',   name: 'Vodafone Group' },
      { symbol: 'BA.L',    name: 'BAE Systems' },
      { symbol: 'NWG.L',   name: 'NatWest Group' },
    ],
    localSearch: [
      { symbol:'SHEL.L', name:'Shell PLC' }, { symbol:'HSBA.L', name:'HSBC Holdings' },
      { symbol:'BP.L', name:'BP PLC' }, { symbol:'AZN.L', name:'AstraZeneca' },
      { symbol:'ULVR.L', name:'Unilever PLC' }, { symbol:'GSK.L', name:'GSK PLC' },
      { symbol:'RIO.L', name:'Rio Tinto PLC' }, { symbol:'VOD.L', name:'Vodafone Group' },
    ],
  },
  de: {
    id: 'de', label: 'Frankfurt (XETRA)', flag: '🇩🇪', currency: '€', currencyCode: 'EUR',
    timezone: 'Europe/Berlin',
    watchlist: [
      { symbol: 'SAP.DE',   name: 'SAP SE' },
      { symbol: 'SIE.DE',   name: 'Siemens AG' },
      { symbol: 'BMW.DE',   name: 'BMW AG' },
      { symbol: 'VOW3.DE',  name: 'Volkswagen AG' },
      { symbol: 'MBG.DE',   name: 'Mercedes-Benz Group' },
      { symbol: 'BAYN.DE',  name: 'Bayer AG' },
      { symbol: 'DTE.DE',   name: 'Deutsche Telekom' },
      { symbol: 'ALV.DE',   name: 'Allianz SE' },
      { symbol: 'MUV2.DE',  name: 'Munich Re' },
      { symbol: 'ADS.DE',   name: 'Adidas AG' },
      { symbol: 'DHER.DE',  name: 'Delivery Hero' },
      { symbol: 'DBK.DE',   name: 'Deutsche Bank' },
    ],
    localSearch: [
      { symbol:'SAP.DE', name:'SAP SE' }, { symbol:'SIE.DE', name:'Siemens AG' },
      { symbol:'BMW.DE', name:'BMW AG' }, { symbol:'VOW3.DE', name:'Volkswagen AG' },
      { symbol:'MBG.DE', name:'Mercedes-Benz Group' }, { symbol:'BAYN.DE', name:'Bayer AG' },
      { symbol:'ADS.DE', name:'Adidas AG' }, { symbol:'ALV.DE', name:'Allianz SE' },
    ],
  },
  jp: {
    id: 'jp', label: 'Tokyo (TSE)', flag: '🇯🇵', currency: '¥', currencyCode: 'JPY',
    timezone: 'Asia/Tokyo',
    watchlist: [
      { symbol: '7203.T',  name: 'Toyota Motor' },
      { symbol: '6758.T',  name: 'Sony Group' },
      { symbol: '9984.T',  name: 'SoftBank Group' },
      { symbol: '6501.T',  name: 'Hitachi Ltd.' },
      { symbol: '8306.T',  name: 'Mitsubishi UFJ Financial' },
      { symbol: '9432.T',  name: 'NTT Corp.' },
      { symbol: '6752.T',  name: 'Panasonic Holdings' },
      { symbol: '7974.T',  name: 'Nintendo Co.' },
      { symbol: '4063.T',  name: 'Shin-Etsu Chemical' },
      { symbol: '8058.T',  name: 'Mitsubishi Corp.' },
      { symbol: '6861.T',  name: 'Keyence Corp.' },
      { symbol: '9433.T',  name: 'KDDI Corp.' },
    ],
    localSearch: [
      { symbol:'7203.T', name:'Toyota Motor' }, { symbol:'6758.T', name:'Sony Group' },
      { symbol:'9984.T', name:'SoftBank Group' }, { symbol:'7974.T', name:'Nintendo Co.' },
      { symbol:'8306.T', name:'Mitsubishi UFJ Financial' }, { symbol:'6501.T', name:'Hitachi Ltd.' },
    ],
  },
  hk: {
    id: 'hk', label: 'Hong Kong (HKEX)', flag: '🇭🇰', currency: 'HK$', currencyCode: 'HKD',
    timezone: 'Asia/Hong_Kong',
    watchlist: [
      { symbol: '0700.HK', name: 'Tencent Holdings' },
      { symbol: '9988.HK', name: 'Alibaba Group' },
      { symbol: '3690.HK', name: 'Meituan' },
      { symbol: '1299.HK', name: 'AIA Group' },
      { symbol: '0005.HK', name: 'HSBC Holdings (HK)' },
      { symbol: '2318.HK', name: 'Ping An Insurance' },
      { symbol: '0941.HK', name: 'China Mobile' },
      { symbol: '1398.HK', name: 'ICBC' },
      { symbol: '2020.HK', name: 'ANTA Sports' },
      { symbol: '9618.HK', name: 'JD.com' },
      { symbol: '1810.HK', name: 'Xiaomi Corp.' },
      { symbol: '0388.HK', name: 'HK Exchanges & Clearing' },
    ],
    localSearch: [
      { symbol:'0700.HK', name:'Tencent Holdings' }, { symbol:'9988.HK', name:'Alibaba Group' },
      { symbol:'3690.HK', name:'Meituan' }, { symbol:'1299.HK', name:'AIA Group' },
      { symbol:'0941.HK', name:'China Mobile' }, { symbol:'1810.HK', name:'Xiaomi Corp.' },
    ],
  },
};

// ===== FX RATE CACHE (shared, used by sidebar + other pages) =====
const _sharedFxCache = {};
let   _sharedCurrentFxRate = 1; // synced rate for active market (LOCAL→USD)

async function _sharedEnsureFxRate() {
  const mkt  = getActiveMarket();
  const code = mkt.currencyCode || 'USD';
  if (code === 'USD') { _sharedCurrentFxRate = 1; return; }
  const cached = _sharedFxCache[code];
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) { _sharedCurrentFxRate = cached.rate; return; }
  try {
    const resp = await fetch(`http://localhost:8081/api/market/exchange-rate/${code}`);
    if (!resp.ok) throw new Error();
    const data = await resp.json();
    _sharedFxCache[code] = { rate: data.rate, ts: Date.now() };
    _sharedCurrentFxRate = data.rate;
  } catch {
    const FB = { INR: 0.012, GBP: 1.27, EUR: 1.09, JPY: 0.0067, HKD: 0.128 };
    _sharedCurrentFxRate = FB[code] || 1;
    _sharedFxCache[code] = { rate: _sharedCurrentFxRate, ts: Date.now() - 4 * 60 * 1000 };
  }
}

// Convert local price → USD string, returns { usdStr, localStr }
function _sharedFmtPrice(localPrice, mkt) {
  const code    = mkt?.currencyCode || 'USD';
  const localSym = mkt?.currency || '$';
  const isUSD   = code === 'USD';
  const usd     = isUSD ? localPrice : localPrice * _sharedCurrentFxRate;
  const usdStr  = '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const localStr = isUSD ? null : localSym + localPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { usdStr, localStr };
}

// ===== ACTIVE MARKET HELPERS =====
function getActiveMarket() {
  const id = localStorage.getItem('activeMarket') || 'us';
  return MARKET_DEFINITIONS[id] || MARKET_DEFINITIONS['us'];
}

function setActiveMarket(id) {
  localStorage.setItem('activeMarket', id);
  _renderSidebarStocks({});
  _sharedBuildSidebarStocks();
  _renderMarketSwitcherPill();
  _buildMarketDropdown();
  updateMarketStatus();
  window.dispatchEvent(new CustomEvent('marketChanged', { detail: { market: id } }));
  if (typeof onMarketChanged === 'function') onMarketChanged(id);
  // Immediately update balance display to use new currency symbol
  const _user = getCurrentUser();
  if (_user && typeof updateBalanceDisplay === 'function') updateBalanceDisplay(_user.balance);
}

function getActiveMarketStocks() {
  return getActiveMarket().watchlist;
}

function getActiveCurrency() {
  return getActiveMarket().currency;
}

function getActiveCurrencyCode() {
  return getActiveMarket().currencyCode || 'USD';
}

// ===== MARKET SWITCHER PILL RENDER =====
function _renderMarketSwitcherPill() {
  const pill = document.getElementById('marketSwitcherPill');
  if (!pill) return;
  const m = getActiveMarket();
  pill.innerHTML = `
    <span style="font-size:1rem;">${m.flag}</span>
    <span style="font-size:0.72rem; font-weight:700; color:var(--text-primary);">${m.label}</span>
    <span style="font-size:0.65rem; color:var(--text-muted); margin-left:auto;">▾</span>
  `;
}

function toggleMarketDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('marketSwitcherDropdown');
  if (!dd) return;
  dd.classList.toggle('open');
}

function selectMarket(id) {
  const dd = document.getElementById('marketSwitcherDropdown');
  if (dd) dd.classList.remove('open');
  if (id === getActiveMarket().id) return;
  setActiveMarket(id);
}

function _buildMarketDropdown() {
  const dd = document.getElementById('marketSwitcherDropdown');
  if (!dd) return;
  const active = getActiveMarket().id;
  dd.innerHTML = Object.values(MARKET_DEFINITIONS).map(m => `
    <div class="mkt-dd-item ${m.id === active ? 'active' : ''}" onclick="selectMarket('${m.id}')">
      <span style="font-size:1rem;">${m.flag}</span>
      <div style="flex:1;">
        <div style="font-size:0.78rem; font-weight:700; color:var(--text-primary);">${m.label}</div>
        <div style="font-size:0.65rem; color:var(--text-muted);">${m.currency} · ${m.timezone}</div>
      </div>
      ${m.id === active ? '<span style="color:var(--accent); font-size:0.7rem;">✓</span>' : ''}
    </div>
  `).join('');
}

// ===== SIDEBAR STOCK LIST =====
function _renderSidebarStocks(quoteMap) {
  const container = document.getElementById('sidebarStockList');
  if (!container) return;
  const stocks = getActiveMarketStocks();
  const mkt    = getActiveMarket();

  container.innerHTML = `<div class="sidebar-stock-label">Watchlist · ${mkt.flag}</div>` +
    stocks.map(item => {
      const q      = quoteMap[item.symbol];
      const price  = q ? q.price : null;
      const change = q ? (q.changePercent ?? q.change ?? 0) : 0;
      const up     = change >= 0;
      const { usdStr, localStr } = price != null ? _sharedFmtPrice(price, mkt) : {};
      return `
        <div class="sidebar-stock-item" id="ss-${item.symbol.replace(/[^a-zA-Z0-9]/g,'_')}"
             onclick="sidebarNavigateTo('${item.symbol}')">
          <div class="ss-left">
            <div class="ss-sym">${(() => {
              const stripped = item.symbol.replace(/\.(NS|L|DE|T|HK)$/, '');
              return /^\d+$/.test(stripped) ? item.name.split(' ')[0] : stripped;
            })()}</div>
            <div class="ss-name">${item.name}</div>
          </div>
          <div class="ss-right">
            <div class="ss-price ${up ? 'price-up' : 'price-down'}" id="ss-price-${item.symbol.replace(/[^a-zA-Z0-9]/g,'_')}">
              ${price != null ? usdStr : '<span style="color:var(--text-muted);font-size:0.7rem;">…</span>'}
              ${price != null && localStr ? `<span class="ss-local">${localStr}</span>` : ''}
            </div>
            <div class="ss-chg ${up ? 'price-up' : 'price-down'}" id="ss-chg-${item.symbol.replace(/[^a-zA-Z0-9]/g,'_')}">
              ${price != null ? (up ? '▲' : '▼') + ' ' + Math.abs(change).toFixed(2) + '%' : ''}
            </div>
          </div>
        </div>`;
    }).join('');
}

async function _sharedBuildSidebarStocks() {
  _renderSidebarStocks({});
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('[Sidebar] No auth token — cannot fetch live prices');
      return;
    }
    await _sharedEnsureFxRate(); // prime FX cache before rendering
    const stocks   = getActiveMarketStocks();
    const symbols  = stocks.map(s => s.symbol);
    const quoteMap = await MarketAPI.getQuotes(symbols);
    if (quoteMap && Object.keys(quoteMap).length > 0) {
      _renderSidebarStocks(quoteMap);
    } else {
      console.warn('[Sidebar] Empty quote response — retrying in 5s…');
      setTimeout(_sharedBuildSidebarStocks, 5000);
    }
    const user = getCurrentUser();
    if (user) updateBalanceDisplay(user.balance);
  } catch (err) {
    console.error('[Sidebar] _sharedBuildSidebarStocks failed:', err.message);
    setTimeout(_sharedBuildSidebarStocks, 5000);
  }
}

function sidebarNavigateTo(symbol) {
  window.location.href = `dashboard.html?symbol=${encodeURIComponent(symbol)}`;
}

// ===== SIDEBAR SEARCH =====

// Find which market a symbol belongs to (checks all markets)
function findMarketForSymbol(symbol) {
  const sym = (symbol || '').toUpperCase();
  for (const mkt of Object.values(MARKET_DEFINITIONS)) {
    const inWatchlist   = mkt.watchlist.some(s => s.symbol.toUpperCase() === sym);
    const inLocalSearch = (mkt.localSearch || []).some(s => s.symbol.toUpperCase() === sym);
    if (inWatchlist || inLocalSearch) return mkt;
  }
  return null;
}

function localSearch(query) {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const universe = getActiveMarket().localSearch || [];
  return universe.filter(s =>
    s.symbol.toUpperCase().includes(q) || s.name.toUpperCase().includes(q)
  ).slice(0, 8);
}

let _sharedSearchDebounce  = null;
let _sharedSearchRequestId = 0;

function onSearchInput(query) {
  const dropdown = document.getElementById('searchDropdown');
  if (!dropdown) return;

  if (!query || query.length < 1) {
    dropdown.classList.remove('open');
    clearTimeout(_sharedSearchDebounce);
    return;
  }

  const instant = localSearch(query);
  if (instant.length > 0) {
    renderSharedSearchResults(instant, dropdown, true);
  }

  clearTimeout(_sharedSearchDebounce);
  const thisId = ++_sharedSearchRequestId;

  _sharedSearchDebounce = setTimeout(async () => {
    try {
      const apiResults = await MarketAPI.search(query);
      if (thisId !== _sharedSearchRequestId) return;

      // Filter API results to only symbols that belong to the active market
      const activeMkt   = getActiveMarket();
      const activeSyms  = new Set([
        ...(activeMkt.watchlist   || []).map(s => s.symbol.toUpperCase()),
        ...(activeMkt.localSearch || []).map(s => s.symbol.toUpperCase()),
      ]);
      const filtered = (apiResults || []).filter(r => activeSyms.has((r.symbol || '').toUpperCase()));

      const results = filtered.length > 0 ? filtered : localSearch(query);
      if (results.length === 0) { dropdown.classList.remove('open'); return; }
      renderSharedSearchResults(results, dropdown, false);
    } catch (_) {}
  }, 320);
}

function renderSharedSearchResults(results, dropdown, isLoading) {
  if (!dropdown) return;
  const currency = getActiveCurrency();

  dropdown.innerHTML = results.map(r => {
    const hasPrice = Number.isFinite(r._price);
    const price    = hasPrice ? Number(r._price).toFixed(2) : '—';
    const change   = Number.isFinite(r._change) ? Number(r._change) : 0;
    const up       = change >= 0;
    return `
      <div class="search-result-item" onclick="selectSharedSearchResult('${r.symbol}')">
        <div>
          <div class="font-mono font-bold" style="font-size:0.875rem;">${r.symbol}</div>
          <div class="text-muted" style="font-size:0.75rem;">${r.name}</div>
        </div>
        <div style="text-align:right;">
          <div class="font-mono" style="font-size:0.875rem;">${hasPrice ? currency+price : '<span style="color:var(--text-muted);font-size:0.72rem;">Fetching…</span>'}</div>
          <div class="font-mono ${up ? 'price-up' : 'price-down'}" style="font-size:0.75rem;">${hasPrice ? (up?'▲':'▼')+' '+Math.abs(change).toFixed(2)+'%' : ''}</div>
        </div>
      </div>`;
  }).join('');

  if (isLoading) {
    dropdown.innerHTML += `<div style="padding:8px 14px; font-size:0.72rem; color:var(--text-muted); border-top:1px solid var(--border);">🔄 Fetching live results…</div>`;
  }
  dropdown.classList.add('open');
}

function selectSharedSearchResult(symbol) {
  clearTimeout(_sharedSearchDebounce);
  _sharedSearchRequestId++;
  closeSearch();

  const targetMkt  = findMarketForSymbol(symbol);
  const activeMkt  = getActiveMarket();

  if (targetMkt && targetMkt.id !== activeMkt.id) {
    // Stock belongs to a different market — show switch popup
    _showSwitchMarketPopup(symbol, targetMkt, () => {
      window.location.href = `dashboard.html?symbol=${encodeURIComponent(symbol)}`;
    });
    return;
  }

  window.location.href = `dashboard.html?symbol=${encodeURIComponent(symbol)}`;
}

// Generic "switch market" popup used by search + portfolio Trade
function _showSwitchMarketPopup(symbol, targetMkt, onConfirm) {
  // Remove any existing popup
  const old = document.getElementById('_switchMktModal');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = '_switchMktModal';
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:99999;
    background:rgba(0,0,0,0.7); backdrop-filter:blur(6px);
    display:flex; align-items:center; justify-content:center;
  `;
  overlay.innerHTML = `
    <div style="
      background:#0b1426; border:1px solid rgba(255,255,255,0.1);
      border-radius:16px; padding:28px 32px; max-width:380px; width:90%;
      box-shadow:0 24px 64px rgba(0,0,0,0.8);
      text-align:center;
    ">
      <div style="font-size:2.2rem; margin-bottom:12px;">${targetMkt.flag}</div>
      <h3 style="color:#e8edf5; margin-bottom:8px; font-size:1.05rem;">
        Switch to ${targetMkt.label}?
      </h3>
      <p style="color:#8892a4; font-size:0.85rem; margin-bottom:20px; line-height:1.5;">
        <strong style="color:#e8edf5;">${symbol}</strong> is listed on
        <strong style="color:#e8edf5;">${targetMkt.label}</strong>.
        Switch markets to trade this stock.
      </p>
      <div style="display:flex; gap:12px; justify-content:center;">
        <button id="_switchMktCancel" style="
          flex:1; padding:10px 0; border-radius:8px;
          background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
          color:#e8edf5; font-size:0.88rem; font-weight:600; cursor:pointer;
        ">Cancel</button>
        <button id="_switchMktConfirm" style="
          flex:1; padding:10px 0; border-radius:8px;
          background:linear-gradient(135deg,#00d09c,#0066ff);
          border:none; color:#fff; font-size:0.88rem; font-weight:700; cursor:pointer;
        ">Switch &amp; Trade</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#_switchMktCancel').onclick  = () => overlay.remove();
  overlay.querySelector('#_switchMktConfirm').onclick = () => {
    overlay.remove();
    setActiveMarket(targetMkt.id);  // switch market
    if (typeof onConfirm === 'function') onConfirm();
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function closeSearch() {
  const dd = document.getElementById('searchDropdown');
  if (dd) dd.classList.remove('open');
}

// ===== MARKET STATUS (topbar badge) =====
let _sharedMarketTimer = null;
let _sharedNextMs      = 0;

async function updateMarketStatus() {
  try {
    const token = localStorage.getItem('token');
    const mktId = getActiveMarket().id;
    const res   = await fetch(`http://localhost:8081/api/market/status?market=${mktId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    _sharedNextMs = data.nextMs;
    _renderSharedMarketBadge(data);

    if (_sharedMarketTimer) clearInterval(_sharedMarketTimer);
    _sharedMarketTimer = setInterval(() => {
      _sharedNextMs = Math.max(0, _sharedNextMs - 1000);
      _updateSharedCountdown(data.nextLabel, _sharedNextMs);
      if (_sharedNextMs <= 0) {
        clearInterval(_sharedMarketTimer);
        setTimeout(updateMarketStatus, 2000);
      }
    }, 1000);
  } catch (_) {}
}

function _renderSharedMarketBadge(data) {
  const dot   = document.getElementById('marketDot');
  const text  = document.getElementById('marketStatusText');
  const badge = document.getElementById('marketStatusBadge');

  if (dot)   { dot.style.background = data.dotColor; dot.style.boxShadow = `0 0 6px ${data.dotColor}`; }
  if (badge) badge.style.borderColor = data.dotColor + '44';
  if (text)  { text.textContent = data.session; text.style.color = data.dotColor; }

  const screenerLabel = document.getElementById('screenerLiveLabel');
  if (screenerLabel) {
    const icons = { 'open': '🟢', 'pre-market': '🌅', 'after-hours': '🌙', 'closed': '🔴' };
    screenerLabel.textContent = `${icons[data.status] || '⬤'} ${data.session}`;
    screenerLabel.style.color = data.dotColor;
  }

  _updateSharedCountdown(data.nextLabel, data.nextMs);
}

function _updateSharedCountdown(nextLabel, ms) {
  const el = document.getElementById('marketCountdown');
  if (!el) return;
  if (ms <= 0) { el.textContent = ''; return; }
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${String(m).padStart(2,'0')}m`);
  parts.push(`${String(s).padStart(2,'0')}s`);
  el.textContent = `· ${nextLabel} in ${parts.join(' ')}`;
}

// ===== PROFILE DROPDOWN =====
function _populateProfileDropdown(user) {
  if (!user) return;
  const name     = user.name || user.username || user.email?.split('@')[0] || 'User';
  const email    = user.email || '';
  const bal      = typeof user.balance === 'number' ? getActiveCurrency() + user.balance.toFixed(2) : getActiveCurrency() + '10,000.00';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const topbarAvatar = document.getElementById('topbarAvatar');
  if (topbarAvatar) topbarAvatar.textContent = initials;
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  if (sidebarAvatar) sidebarAvatar.textContent = initials;
  const sidebarName = document.getElementById('sidebarName');
  if (sidebarName) sidebarName.textContent = name;
  const pdAvatar = document.getElementById('pdAvatar');
  if (pdAvatar) pdAvatar.textContent = initials;
  const pdName = document.getElementById('pdName');
  if (pdName) pdName.textContent = name;
  const pdEmail = document.getElementById('pdEmail');
  if (pdEmail) pdEmail.textContent = email;
  const pdBalance = document.getElementById('pdBalance');
  if (pdBalance) pdBalance.textContent = bal;
}

// ===== IN-PLACE PRICE UPDATE =====
function _updateSidebarPricesInPlace(quoteMap) {
  const mkt = getActiveMarket();
  getActiveMarketStocks().forEach(item => {
    const q = quoteMap[item.symbol];
    if (!q) return;
    const price  = Number(q.price);
    const change = Number(q.changePercent ?? q.change ?? 0);
    const up     = change >= 0;
    const safeId = item.symbol.replace(/[^a-zA-Z0-9]/g, '_');
    const { usdStr, localStr } = _sharedFmtPrice(price, mkt);

    const priceEl = document.getElementById('ss-price-' + safeId);
    const chgEl   = document.getElementById('ss-chg-'   + safeId);

    if (priceEl) {
      priceEl.innerHTML = usdStr + (localStr ? ` <span class="ss-local">${localStr}</span>` : '');
      priceEl.className = `ss-price ${up ? 'price-up' : 'price-down'}`;
    }
    if (chgEl) {
      chgEl.textContent = `${up ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`;
      chgEl.className   = `ss-chg ${up ? 'price-up' : 'price-down'}`;
    }
  });
}

async function refreshSharedPrices() {
  try {
    const symbols  = getActiveMarketStocks().map(s => s.symbol);
    const quoteMap = await MarketAPI.getQuotes(symbols);
    if (quoteMap) _updateSidebarPricesInPlace(quoteMap);
    const user = getCurrentUser();
    if (user) updateBalanceDisplay(user.balance);
  } catch (_) {}
}

// ===== SHARED INIT =====
let _sharedPriceInterval = null;

function initSharedUI() {
  const user = getCurrentUser();
  if (user) _populateProfileDropdown(user);

  _renderMarketSwitcherPill();
  _buildMarketDropdown();

  _sharedBuildSidebarStocks();
  updateMarketStatus();

  if (_sharedPriceInterval) clearInterval(_sharedPriceInterval);
  _sharedPriceInterval = setInterval(refreshSharedPrices, 10_000);

  window.addEventListener('beforeunload', () => {
    if (_sharedPriceInterval) clearInterval(_sharedPriceInterval);
  });

  document.addEventListener('click', e => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.contains(e.target)) closeSearch();

    const mktWrap = document.getElementById('marketSwitcherWrap');
    const mktDd   = document.getElementById('marketSwitcherDropdown');
    if (mktWrap && mktDd && !mktWrap.contains(e.target)) {
      mktDd.classList.remove('open');
    }
  });
}
