// ===================================================================
// news.js — NexTrade News Feed
// ===================================================================

// ── State ──────────────────────────────────────────────────────────
let allArticles   = [];
let activeCategory = 'general';
let activeSymbol   = '';
let viewMode       = 'grid';   // 'grid' | 'list'
let searchQuery    = '';

const CATEGORIES = [
  { id: 'general',  label: '📰 General',  emoji: '📰' },
  { id: 'forex',    label: '💱 Forex',    emoji: '💱' },
  { id: 'crypto',   label: '₿ Crypto',   emoji: '₿'  },
  { id: 'merger',   label: '🤝 M&A',     emoji: '🤝' },
];

const TOP_SYMBOLS = ['AAPL','MSFT','NVDA','TSLA','AMZN','META','GOOGL','AMD','NFLX','INTC'];

// ── Init ───────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const user = initUserSession();
  if (!user) return;

  buildSymbolChips();
  loadNews('general');
  startAutoRefresh();
});

// ── Auth helper ────────────────────────────────────────────────────
function initUserSession() {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || 'null');
  if (!token || !user) { window.location.href = 'index.html'; return null; }
  return user;
}

// ── Build quick-symbol chips ───────────────────────────────────────
function buildSymbolChips() {
  const el = document.getElementById('symbolChips');
  if (!el) return;
  el.innerHTML = TOP_SYMBOLS.map(sym => `
    <button class="sym-chip" id="chip-${sym}" onclick="filterBySymbol('${sym}')">${sym}</button>
  `).join('');
}

// ── Load market (category) news ────────────────────────────────────
async function loadNews(category = activeCategory) {
  activeCategory = category;
  activeSymbol   = '';

  // Update category tab highlights
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.getElementById('cat-' + category);
  if (activeTab) activeTab.classList.add('active');

  // Clear symbol chip highlights
  document.querySelectorAll('.sym-chip').forEach(c => c.classList.remove('active'));

  showSkeleton();
  updateFeedLabel('📰 ' + (CATEGORIES.find(c => c.id === category)?.label || 'News'));

  try {
    const token = localStorage.getItem('token');
    const res   = await fetch(`/api/news/market?category=${category}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('API error');
    allArticles = await res.json();
    renderArticles();
    updateTimestamp();
  } catch (err) {
    showError(err.message);
  }
}

// ── Load company-specific news ─────────────────────────────────────
async function filterBySymbol(symbol) {
  activeSymbol   = symbol;
  activeCategory = '';

  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sym-chip').forEach(c => c.classList.remove('active'));
  const chip = document.getElementById('chip-' + symbol);
  if (chip) chip.classList.add('active');

  showSkeleton();
  updateFeedLabel('🏢 ' + symbol + ' News');

  try {
    const token = localStorage.getItem('token');
    const res   = await fetch(`/api/news/company/${symbol}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('API error');
    allArticles = await res.json();
    renderArticles();
    updateTimestamp();
  } catch (err) {
    showError(err.message);
  }
}

// ── Search ─────────────────────────────────────────────────────────
function onSearchInput(val) {
  searchQuery = val.trim().toLowerCase();
  renderArticles();
}

function clearSearch() {
  searchQuery = '';
  const el = document.getElementById('newsSearch');
  if (el) el.value = '';
  renderArticles();
}

// ── View toggle ────────────────────────────────────────────────────
function setView(mode) {
  viewMode = mode;
  document.getElementById('btnGrid')?.classList.toggle('active', mode === 'grid');
  document.getElementById('btnList')?.classList.toggle('active', mode === 'list');
  renderArticles();
}

// ── Render ─────────────────────────────────────────────────────────
function renderArticles() {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;

  let items = allArticles;

  if (searchQuery) {
    items = items.filter(a =>
      a.headline.toLowerCase().includes(searchQuery) ||
      a.summary.toLowerCase().includes(searchQuery)  ||
      a.source.toLowerCase().includes(searchQuery)
    );
  }

  if (items.length === 0) {
    grid.className = 'news-grid';
    grid.innerHTML = `
      <div class="news-empty">
        <div class="empty-icon">🔍</div>
        <h3>No articles found</h3>
        <p class="text-muted text-sm">Try a different category or search term.</p>
      </div>`;
    document.getElementById('articleCount').textContent = '0 articles';
    return;
  }

  document.getElementById('articleCount').textContent = `${items.length} article${items.length !== 1 ? 's' : ''}`;
  grid.className = viewMode === 'list' ? 'news-list' : 'news-grid';

  // Highlight featured on first article in grid mode
  grid.innerHTML = items.map((a, i) => buildCard(a, i === 0 && viewMode === 'grid' && !searchQuery)).join('');
}

// Patterns in image URLs that indicate a brand logo / generic asset,
// not an article-specific photo (Finnhub frequently provides these for Reuters).
const LOGO_PATTERNS = [
  /\/logo[s]?\//i, /logo\.(png|jpg|svg|webp)/i,
  /brand/i, /icon/i, /favicon/i,
  /placeholder/i, /default/i, /fallback/i,
  // Reuters-specific: their brand square
  /reuters\.com\/pf\/resources/i,
  /reuters\.com\/assets/i,
];

// Source → brand color (used for the placeholder card background)
const SOURCE_COLORS = {
  'Reuters':            '#ff8000',
  'Bloomberg':          '#5b47fb',
  'CNBC':               '#00b3e3',
  'The Wall Street Journal': '#000000',
  'WSJ':                '#000000',
  'Financial Times':    '#fff1e0',
  'MarketWatch':        '#00ac4f',
  'Seeking Alpha':      '#2c5898',
  'Barron\'s':          '#bc1928',
  'Benzinga':           '#1877f2',
  'Yahoo Finance':      '#7b00d3',
  'Investor\'s Business Daily': '#1b4f8a',
  'default':            '#334155',
};

function isGenericLogo(url) {
  if (!url) return true;
  return LOGO_PATTERNS.some(p => p.test(url));
}

function getSourceColor(source) {
  return SOURCE_COLORS[source] || SOURCE_COLORS['default'];
}

function buildCard(a, featured = false) {
  const dt      = new Date(a.datetime * 1000);
  const timeAgo = getTimeAgo(dt);
  const etTime  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  // Skip logo/brand images — use styled placeholder instead
  const rawImg  = a.image && a.image.startsWith('http') && !isGenericLogo(a.image) ? a.image : '';
  const imgSrc  = rawImg ? proxyImg(rawImg) : '';
  const hasImg  = !!imgSrc;
  const srcColor = getSourceColor(a.source);
  const symbol  = a.related || '';

  // Placeholder shows source initial on a brand-colored background
  const placeholderHtml = `<div class="news-img placeholder" style="background:${srcColor}22; border-bottom:2px solid ${srcColor}44;"><span style="font-size:1.8rem; font-weight:900; color:${srcColor}; opacity:0.7; font-family:var(--font-mono);">${escHtml(a.source.slice(0,3).toUpperCase())}</span></div>`;

  if (viewMode === 'list') {
    return `
    <article class="news-list-item" onclick="openArticle('${escHtml(a.url)}')">
      ${hasImg
        ? `<img class="list-thumb" src="${escHtml(imgSrc)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'">`
        : `<div class="list-thumb-placeholder" style="background:${srcColor}22; color:${srcColor};">${escHtml(a.source.slice(0,3).toUpperCase())}</div>`}
      <div class="list-body">
        <div class="list-meta">
          <span class="news-source" style="color:${srcColor};">${escHtml(a.source)}</span>
          ${symbol ? `<span class="news-symbol">${escHtml(symbol)}</span>` : ''}
          <span class="news-time" title="${dt.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET">${timeAgo} · ${etTime}</span>
        </div>
        <h4 class="list-headline">${escHtml(a.headline)}</h4>
        ${a.summary ? `<p class="list-summary">${escHtml(truncate(a.summary, 140))}</p>` : ''}
      </div>
      <div class="list-arrow">›</div>
    </article>`;
  }

  if (featured) {
    return `
    <article class="news-card featured" onclick="openArticle('${escHtml(a.url)}')">
      ${hasImg
        ? `<div class="news-img" style="background-image:url('${escHtml(imgSrc)}')" role="img" aria-label="Article image"><div class="news-img-overlay"></div></div>`
        : placeholderHtml}
      <div class="news-body">
        <div class="news-meta">
          <span class="news-badge">Featured</span>
          <span class="news-source" style="color:${srcColor};">${escHtml(a.source)}</span>
          ${symbol ? `<span class="news-symbol">${escHtml(symbol)}</span>` : ''}
        </div>
        <h3 class="news-headline">${escHtml(a.headline)}</h3>
        ${a.summary ? `<p class="news-summary">${escHtml(truncate(a.summary, 200))}</p>` : ''}
        <div class="news-footer">
          <span class="news-time" title="${etTime}">${timeAgo}</span>
          <span class="news-read-more">Read more →</span>
        </div>
      </div>
    </article>`;
  }

  return `
  <article class="news-card" onclick="openArticle('${escHtml(a.url)}')">
    ${hasImg
      ? `<div class="news-img" style="background-image:url('${escHtml(imgSrc)}')" role="img" aria-label="Article image"><div class="news-img-overlay"></div></div>`
      : placeholderHtml}
    <div class="news-body">
      <div class="news-meta">
        <span class="news-source" style="color:${srcColor};">${escHtml(a.source)}</span>
        ${symbol ? `<span class="news-symbol">${escHtml(symbol)}</span>` : ''}
      </div>
      <h4 class="news-headline">${escHtml(a.headline)}</h4>
      <div class="news-footer">
        <span class="news-time" title="${etTime}">${timeAgo}</span>
        <span class="news-read-more">Read →</span>
      </div>
    </div>
  </article>`;
}

function openArticle(url) {
  if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
}

// ── Skeleton loader ────────────────────────────────────────────────
function showSkeleton() {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;
  grid.className = 'news-grid';
  grid.innerHTML = Array.from({ length: 9 }, () => `
    <article class="news-card skeleton-card">
      <div class="news-img skeleton" style="height:160px;border-radius:var(--radius-md) var(--radius-md) 0 0;"></div>
      <div class="news-body" style="gap:10px;display:flex;flex-direction:column;">
        <div class="skeleton" style="height:12px;width:40%;border-radius:4px;"></div>
        <div class="skeleton" style="height:16px;width:95%;border-radius:4px;"></div>
        <div class="skeleton" style="height:16px;width:80%;border-radius:4px;"></div>
        <div class="skeleton" style="height:12px;width:30%;border-radius:4px;margin-top:4px;"></div>
      </div>
    </article>`).join('');
  document.getElementById('articleCount').textContent = 'Loading…';
}

function showError(msg) {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="news-empty">
      <div class="empty-icon">⚠️</div>
      <h3>Failed to load news</h3>
      <p class="text-muted text-sm">${escHtml(msg)}</p>
      <button class="btn btn-outline btn-sm" style="margin-top:16px;" onclick="loadNews()">Retry</button>
    </div>`;
}

// ── UI helpers ─────────────────────────────────────────────────────
function updateFeedLabel(label) {
  const el = document.getElementById('feedLabel');
  if (el) el.textContent = label;
}

function updateTimestamp() {
  const el  = document.getElementById('lastRefreshed');
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York' });
  if (el) el.textContent = `Updated ${now} ET`;
}

// ── Auto-refresh every 5 minutes ───────────────────────────────────
function startAutoRefresh() {
  setInterval(() => {
    if (activeSymbol) filterBySymbol(activeSymbol);
    else              loadNews(activeCategory);
  }, 5 * 60 * 1000);
}

// ── Utility ────────────────────────────────────────────────────────
function getTimeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n).trimEnd() + '…' : str;
}

function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// Route all images through the server proxy so Reuters/Bloomberg/CNBC
// hotlink protection is bypassed (proxy fetches without a Referer header).
function proxyImg(url) {
  if (!url || !url.startsWith('http')) return '';
  return `/api/news/img?url=${encodeURIComponent(url)}`;
}
