// ===================================================================
// portfolio.js — Portfolio page logic
// ===================================================================

const CHART_COLORS = [
  '#00d4ff', '#7c3aed', '#00e676', '#ff4757', '#ffd60a',
  '#ff6b35', '#a78bfa', '#34d399', '#f472b6', '#60a5fa',
];

window.addEventListener('DOMContentLoaded', async () => {
  const user = initUserSession();
  if (!user) return;

  await loadPortfolio();
  await loadOrderHistory();

  // Refresh prices every 8 seconds
  setInterval(loadPortfolio, 8000);
});

async function loadPortfolio() {
  const user     = getCurrentUser();
  const holdings = await PortfolioAPI.getHoldings();

  // Prime FX cache for every market represented in the portfolio
  const marketsSeen = new Set();
  for (const h of holdings) {
    const mkt = (typeof findMarketForSymbol === 'function') ? findMarketForSymbol(h.symbol) : null;
    if (mkt && mkt.currencyCode && mkt.currencyCode !== 'USD') {
      marketsSeen.add(mkt);
    }
  }
  for (const mkt of marketsSeen) {
    await _portfolioEnsureFxRate(mkt.currencyCode);
  }

  let totalInvested = 0;
  let totalCurrent  = 0;
  const holdingData = [];

  for (const h of holdings) {
    const quote = await MarketAPI.getQuote(h.symbol);
    const mkt   = (typeof findMarketForSymbol === 'function') ? findMarketForSymbol(h.symbol) : null;

    // Convert live price to USD if the stock is from a non-USD market
    const localPrice  = quote.price;
    const priceInUSD  = _portfolioToUSD(localPrice, mkt);

    const invested = h.avgPrice * h.shares;        // avgPrice is always stored in USD
    const current  = priceInUSD  * h.shares;       // now also in USD ✓
    const pnl      = current - invested;
    const pnlPct   = ((pnl / invested) * 100);
    totalInvested += invested;
    totalCurrent  += current;
    holdingData.push({ ...h, quote, mkt, localPrice, priceInUSD, invested, current, pnl, pnlPct });
  }

  const totalValue = (user.balance || 0) + totalCurrent;
  const totalPnl   = totalCurrent - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested * 100) : 0;
  const vsStart    = ((totalValue - 10000) / 10000 * 100);

  // Update summary
  setEl('pTotalValue', '$' + totalValue.toFixed(2));
  setEl('pCash', '$' + (user.balance || 0).toFixed(2));
  setEl('pPositions', holdings.length);

  const pnlEl = document.getElementById('pPnl');
  if (pnlEl) {
    pnlEl.textContent = (totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(2);
    pnlEl.className   = 'stat-value ' + (totalPnl >= 0 ? 'text-green' : 'text-red');
  }

  setPill('pTotalPct',  vsStart);
  setPill('pPnlPct',    totalPnlPct);

  renderHoldings(holdingData);
  renderAllocationChart(holdingData, user.balance || 0, totalCurrent);
}

// ── Portfolio FX helpers ──────────────────────────────────────────────
const _portfolioFxCache = {};

async function _portfolioEnsureFxRate(currencyCode) {
  if (!currencyCode || currencyCode === 'USD') return;
  const cached = _portfolioFxCache[currencyCode];
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return;
  try {
    const resp = await fetch(`http://localhost:8081/api/market/exchange-rate/${currencyCode}`);
    if (!resp.ok) throw new Error('FX fetch failed');
    const data = await resp.json();
    _portfolioFxCache[currencyCode] = { rate: data.rate, ts: Date.now() };
  } catch {
    const FB = { INR: 0.012, GBP: 1.27, EUR: 1.09, JPY: 0.0067, HKD: 0.128 };
    _portfolioFxCache[currencyCode] = { rate: FB[currencyCode] || 1, ts: Date.now() - 4 * 60 * 1000 };
  }
}

function _portfolioToUSD(localPrice, mkt) {
  const code = mkt?.currencyCode || 'USD';
  if (code === 'USD') return localPrice;
  const cached = _portfolioFxCache[code];
  const rate   = cached ? cached.rate : (_sharedFxCache?.[code]?.rate || 1);
  return localPrice * rate;
}


function setPill(id, pct) {
  const el = document.getElementById(id);
  if (!el) return;
  const up = pct >= 0;
  el.textContent = (up ? '▲ +' : '▼ ') + Math.abs(pct).toFixed(2) + '%';
  el.className   = `change-pill ${up ? 'up' : 'down'}`;
}

function renderHoldings(holdings) {
  const tbody = document.getElementById('holdingsBody');
  if (!tbody) return;

  if (holdings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state" style="padding:40px 0;">
            <div class="empty-icon">📭</div>
            <h3>No Holdings</h3>
            <p style="font-size:0.875rem;">Head to the dashboard and place your first buy order!</p>
            <a href="dashboard.html" class="btn btn-primary mt-md">Start Trading</a>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = holdings.map((h, i) => {
    const up  = h.pnl >= 0;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:8px; height:8px; border-radius:50%; background:${color}; flex-shrink:0;"></div>
            <div>
              <div class="holding-symbol">${h.symbol}</div>
              <div class="holding-name">${h.name || ''}</div>
            </div>
          </div>
        </td>
        <td class="font-mono">${h.shares}</td>
        <td class="font-mono">$${h.avgPrice.toFixed(2)}</td>
        <td class="font-mono ${up ? 'price-up' : 'price-down'}">
          $${h.priceInUSD.toFixed(2)}
          ${h.mkt && h.mkt.currencyCode !== 'USD'
            ? `<span style="display:block;font-size:0.62rem;color:var(--text-muted);font-weight:400;">${h.mkt.currency}${h.localPrice.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`
            : ''}
        </td>
        <td class="font-mono font-semibold">$${h.current.toFixed(2)}</td>
        <td class="font-mono ${up ? 'price-up' : 'price-down'}">${up ? '+' : ''}$${h.pnl.toFixed(2)}</td>
        <td>
          <span class="change-pill ${up ? 'up' : 'down'}">${up ? '▲ +' : '▼ '}${Math.abs(h.pnlPct).toFixed(2)}%</span>
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="tradeHolding('${h.symbol}')">
            Trade
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Navigate to trade a holding, switching market if necessary
function tradeHolding(symbol) {
  const targetMkt = (typeof findMarketForSymbol === 'function') ? findMarketForSymbol(symbol) : null;
  const activeMkt = (typeof getActiveMarket    === 'function') ? getActiveMarket()           : null;

  if (targetMkt && activeMkt && targetMkt.id !== activeMkt.id) {
    // Stock is on a different market — show switch popup
    if (typeof _showSwitchMarketPopup === 'function') {
      _showSwitchMarketPopup(symbol, targetMkt, () => {
        window.location.href = `dashboard.html?symbol=${encodeURIComponent(symbol)}`;
      });
    }
    return;
  }

  // Same market — go straight to dashboard
  window.location.href = `dashboard.html?symbol=${encodeURIComponent(symbol)}`;
}

function renderAllocationChart(holdings, cash, investedValue) {
  const canvas = document.getElementById('allocationCanvas');
  const legend = document.getElementById('allocationLegend');
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const outerR = Math.min(W, H) / 2 - 8;
  const innerR = outerR * 0.58;

  ctx.clearRect(0, 0, W, H);

  const total = investedValue + cash;
  if (total <= 0) {
    legend.innerHTML = '<div class="text-center text-muted text-sm" style="padding:20px 0;">No holdings yet</div>';
    return;
  }

  const slices = [];
  holdings.forEach((h, i) => {
    slices.push({ label: h.symbol, value: h.current, color: CHART_COLORS[i % CHART_COLORS.length] });
  });
  if (cash > 0) slices.push({ label: 'Cash', value: cash, color: '#4a5568' });

  let startAngle = -Math.PI / 2;
  slices.forEach(s => {
    const angle = (s.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    startAngle += angle;
  });

  // Inner donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-secondary') || '#0c1220';
  ctx.fill();

  // Center text
  ctx.fillStyle = '#e8edf5';
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText('$' + total.toFixed(0), cx, cy - 6);
  ctx.fillStyle = '#8892a4';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('Total Value', cx, cy + 12);

  // Legend
  legend.innerHTML = slices.map(s => {
    const pct = ((s.value / total) * 100).toFixed(1);
    return `
      <div class="legend-item">
        <div class="legend-dot" style="background:${s.color}"></div>
        <span class="legend-sym">${s.label}</span>
        <span class="text-muted text-xs">$${s.value.toFixed(0)}</span>
        <span class="legend-pct">${pct}%</span>
      </div>
    `;
  }).join('');
}

async function loadOrderHistory() {
  const tbody  = document.getElementById('orderHistoryBody');
  let orders = OrderAPI.getOrders();
  if (!DEMO_MODE) {
    try {
      orders = await OrderAPI.getOrdersRemote();
    } catch (_) {}
  }

  if (!tbody || orders.length === 0) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:30px;">No orders yet</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const isBuy  = o.type === 'BUY';
    const total  = (o.price * o.shares).toFixed(2);
    return `
      <tr>
        <td><span class="order-badge ${o.type.toLowerCase()}">${o.type}</span></td>
        <td class="font-mono font-bold">${o.symbol}</td>
        <td class="font-mono">${o.shares}</td>
        <td class="font-mono">$${o.price.toFixed(2)}</td>
        <td class="font-mono font-semibold">$${total}</td>
        <td><span class="badge badge-green">FILLED</span></td>
        <td class="text-muted" style="font-size:0.8rem;">${formatDate(o.timestamp)}</td>
      </tr>
    `;
  }).join('');
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
