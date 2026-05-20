// ===================================================================
// screener.js — Stock Screener logic with live Yahoo Finance data
// Market-aware: updates when the global market switcher changes
// ===================================================================

let allData      = [];   // full dataset from API
let filteredData = [];   // after filters applied
let sortCol      = 'changePercent';
let sortDir      = -1;   // -1 = desc, 1 = asc
let activeSector = 'all';
let activePreset = 'all';

// ===== INIT =====
window.addEventListener('DOMContentLoaded', async () => {
  const user = initUserSession();
  if (!user) return;

  // Init shared topbar (market switcher, sidebar, status)
  if (typeof initSharedUI === 'function') initSharedUI();

  await loadData();

  // Reload screener when user switches market in the topbar
  window.addEventListener('marketChanged', async (e) => {
    // Reset filters so they make sense for the new market
    activeSector = 'all';
    activePreset = 'all';
    document.querySelectorAll('#sectorChips .chip, #presetChips .chip').forEach(c => {
      c.classList.remove('active', 'active-green', 'active-red');
    });
    document.querySelector('#sectorChips .chip')?.classList.add('active');
    document.querySelector('#presetChips .chip')?.classList.add('active');
    await loadData();
  });
});

// ===== LOAD DATA FROM API =====
async function loadData() {
  try {
    const btn  = document.getElementById('refreshBtn');
    const icon = document.getElementById('refreshIcon');
    if (icon) icon.classList.add('spinning');
    if (btn)  btn.disabled = true;

    // Get the currently active market from shared.js
    const mkt = (typeof getActiveMarket === 'function') ? getActiveMarket() : { id: 'us', label: 'NYSE / NASDAQ', currency: '$' };
    const marketId = mkt.id || 'us';

    // Update screener header to reflect active market
    const mktLabel = document.getElementById('screenerMarketLabel');
    if (mktLabel) mktLabel.textContent = `${mkt.flag || ''} ${mkt.label || 'NYSE / NASDAQ'}`;

    const res = await fetch(`/api/market/screener?market=${marketId}`);

    if (!res.ok) throw new Error('Failed to load screener data');
    allData = await res.json();

    updateStats(allData);
    applyFilters();

    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: mkt.timezone || 'America/New_York' });
    const tzLabel = mkt.id === 'us' ? 'ET' : (mkt.id === 'in' ? 'IST' : mkt.id === 'jp' ? 'JST' : mkt.id === 'hk' ? 'HKT' : '');
    document.getElementById('lastUpdated').textContent = `Updated ${now} ${tzLabel}`;
    document.getElementById('footerStatus').textContent = `${allData.length} stocks · ${mkt.label || 'NYSE / NASDAQ'}`;

  } catch (err) {
    document.getElementById('screenerBody').innerHTML =
      `<tr class="empty-row"><td colspan="11">⚠️ ${err.message} — <button class="btn btn-ghost btn-sm" onclick="loadData()">Retry</button></td></tr>`;
    document.getElementById('footerStatus').textContent = 'Error loading data';
  } finally {
    const btn  = document.getElementById('refreshBtn');
    const icon = document.getElementById('refreshIcon');
    if (icon) icon.classList.remove('spinning');
    if (btn)  btn.disabled = false;
  }
}

function refreshData() { loadData(); }

// ===== STATS BAR =====
function updateStats(data) {
  const gainers = data.filter(s => s.changePercent > 0);
  const losers  = data.filter(s => s.changePercent < 0);
  const top     = [...data].sort((a, b) => b.changePercent - a.changePercent);
  const bottom  = [...data].sort((a, b) => a.changePercent - b.changePercent);

  setEl('statGainers', gainers.length);
  setEl('statLosers',  losers.length);

  if (top.length) {
    setEl('statTopGainer', top[0].symbol);
    setEl('statTopGainerPct', `▲ +${top[0].changePercent.toFixed(2)}%`);
  }
  if (bottom.length) {
    setEl('statTopLoser', bottom[0].symbol);
    setEl('statTopLoserPct', `▼ ${bottom[0].changePercent.toFixed(2)}%`);
  }
}

// ===== PRESET FILTERS =====
function applyPreset(preset, btn) {
  activePreset = preset;
  document.querySelectorAll('#presetChips .chip').forEach(c => {
    c.classList.remove('active', 'active-green', 'active-red');
  });
  if (preset === 'gainers')   btn.classList.add('active-green');
  else if (preset === 'losers') btn.classList.add('active-red');
  else btn.classList.add('active');
  applyFilters();
}

// ===== SECTOR FILTER =====
function setSector(sector, btn) {
  activeSector = sector;
  document.querySelectorAll('#sectorChips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

// ===== COMBINED FILTER + SORT =====
function applyFilters() {
  const search   = (document.getElementById('screenerSearch')?.value  || '').toUpperCase().trim();
  const priceMin = parseFloat(document.getElementById('priceMin')?.value) || 0;
  const priceMax = parseFloat(document.getElementById('priceMax')?.value) || Infinity;

  filteredData = allData.filter(s => {
    if (activeSector !== 'all' && s.sector !== activeSector) return false;
    if (s.price < priceMin || s.price > priceMax) return false;
    if (search && !s.symbol.includes(search) && !s.name.toUpperCase().includes(search)) return false;
    if (activePreset === 'gainers'    && s.changePercent <= 0)             return false;
    if (activePreset === 'losers'     && s.changePercent >= 0)             return false;
    if (activePreset === 'big_movers' && Math.abs(s.changePercent) < 2)    return false;
    if (activePreset === 'high_volume'&& (s.volume || 0) < 20_000_000)     return false;
    if (activePreset === 'mega_cap'   && s.cap !== 'Mega Cap')             return false;
    return true;
  });

  sortData();
  renderTable();
  document.getElementById('resultCount').textContent = filteredData.length;
}

// ===== SORT =====
function sortBy(col) {
  if (sortCol === col) {
    sortDir = -sortDir;
  } else {
    sortCol = col;
    sortDir = col === 'symbol' || col === 'sector' || col === 'cap' ? 1 : -1;
  }
  document.querySelectorAll('[id^="sort-"]').forEach(el => el.textContent = '');
  const icon = document.getElementById('sort-' + col);
  if (icon) icon.textContent = sortDir === -1 ? '▼' : '▲';
  document.querySelectorAll('.screener-table thead th').forEach(th => th.classList.remove('sorted'));
  const headers = document.querySelectorAll('.screener-table thead th');
  const cols = ['rank','symbol','price','change','changePercent','volume','high','low','sector','cap','action'];
  const idx = cols.indexOf(col);
  if (idx >= 0 && headers[idx]) headers[idx].classList.add('sorted');
  sortData();
  renderTable();
}

function sortData() {
  filteredData.sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (typeof va === 'string') return va.localeCompare(vb) * sortDir;
    if (sortCol === 'cap') {
      const order = { 'Mega Cap': 2, 'Large Cap': 1 };
      va = order[va] || 0; vb = order[vb] || 0;
    }
    return ((va ?? 0) - (vb ?? 0)) * sortDir;
  });
}

// ===== RENDER TABLE =====
function renderTable() {
  const tbody = document.getElementById('screenerBody');
  if (!tbody) return;

  // Get currency symbol for active market
  const mkt = (typeof getActiveMarket === 'function') ? getActiveMarket() : { currency: '$' };
  const currency = mkt.currency || '$';

  if (filteredData.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="11">No stocks match your filters. Try adjusting them above.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredData.map((s, i) => {
    const up  = s.changePercent >= 0;
    const chg = s.changePercent;
    const vol = formatVolume(s.volume);
    const sectorClass = 'sector-' + s.sector.replace(/\s+/g,'');
    return `
    <tr onclick="tradeSymbol('${s.symbol}')">
      <td class="text-muted font-mono" style="font-size:0.75rem;">${i + 1}</td>
      <td>
        <div class="sym-cell">
          <span class="sym-ticker">${s.symbol}</span>
          <span class="sym-name">${s.name}</span>
        </div>
      </td>
      <td class="font-mono font-semibold">${currency}${s.price.toFixed(2)}</td>
      <td class="font-mono ${up ? 'price-up' : 'price-down'}">${up?'+':''}${(s.change||0).toFixed(2)}</td>
      <td>
        <span class="change-badge ${up ? 'up' : 'down'}">
          ${up ? '▲' : '▼'} ${up ? '+' : ''}${chg.toFixed(2)}%
        </span>
      </td>
      <td class="font-mono text-secondary">${vol}</td>
      <td class="font-mono text-secondary">${currency}${(s.high||0).toFixed(2)}</td>
      <td class="font-mono text-secondary">${currency}${(s.low||0).toFixed(2)}</td>
      <td><span class="sector-pill ${sectorClass}">${s.sector}</span></td>
      <td class="text-muted" style="font-size:0.78rem;">${s.cap}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn-trade" onclick="tradeSymbol('${s.symbol}')">Trade</button>
      </td>
    </tr>`;
  }).join('');
}

// ===== NAVIGATE TO DASHBOARD WITH SYMBOL =====
function tradeSymbol(symbol) {
  sessionStorage.setItem('screenerSymbol', symbol);
  window.location.href = `dashboard.html?symbol=${encodeURIComponent(symbol)}`;
}

// ===== UTILITIES =====
function formatVolume(v) {
  if (!v) return '—';
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + 'B';
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000)         return (v / 1_000).toFixed(1) + 'K';
  return v.toString();
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
