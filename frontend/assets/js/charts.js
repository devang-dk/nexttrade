// ===================================================================
// charts.js — Professional Trading Chart (Groww / Paytm Money Style)
// Features: Candlestick · EMA(9) · MA(20) · MA(50) · Volume
//           Live OHLC hover legend · Crosshair · Real-time updates
// ===================================================================

let chart        = null;
let candleSeries = null;
let lineSeries   = null;
let volumeSeries = null;
let emaSeries    = null;   // EMA 9
let ma20Series   = null;   // MA 20
let ma50Series   = null;   // MA 50

let activeChartType  = 'candlestick';
let currentSymbol    = 'AAPL';
let currentInterval  = '1M';
let priceUpdateInterval = null;

// Indicator toggle states
let _showEMA  = true;
let _showMA20 = true;
let _showMA50 = true;

// ===== INDICATOR MATH =====

function calcEMA(data, period) {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
  result.push({ time: data[period - 1].time, value: parseFloat(ema.toFixed(2)) });
  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({ time: data[i].time, value: parseFloat(ema.toFixed(2)) });
  }
  return result;
}

function calcSMA(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const avg = data.slice(i - period + 1, i + 1).reduce((s, d) => s + d.close, 0) / period;
    result.push({ time: data[i].time, value: parseFloat(avg.toFixed(2)) });
  }
  return result;
}

// ===== INITIALIZE CHART =====
function initChart() {
  const container = document.getElementById('mainChart');
  if (!container || typeof LightweightCharts === 'undefined') return;

  chart = LightweightCharts.createChart(container, {
    width:  container.clientWidth,
    height: container.clientHeight || 400,
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor:  '#6b7280',
      fontSize:   11,
      fontFamily: "'Inter', 'JetBrains Mono', sans-serif",
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.03)', style: 1 },
      horzLines: { color: 'rgba(255,255,255,0.05)', style: 1 },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: {
        color:     'rgba(156,163,175,0.5)',
        width:     1,
        style:     LightweightCharts.LineStyle.Dashed,
        labelBackgroundColor: '#1f2937',
      },
      horzLine: {
        color:     'rgba(156,163,175,0.5)',
        width:     1,
        style:     LightweightCharts.LineStyle.Dashed,
        labelBackgroundColor: '#1f2937',
      },
    },
    rightPriceScale: {
      borderColor:  'rgba(255,255,255,0.06)',
      textColor:    '#6b7280',
      scaleMargins: { top: 0.08, bottom: 0.22 },
    },
    timeScale: {
      borderColor:      'rgba(255,255,255,0.06)',
      textColor:        '#6b7280',
      timeVisible:      true,
      secondsVisible:   false,
      rightOffset:      5,
      barSpacing:       8,
      minBarSpacing:    3,
    },
    handleScroll:  { mouseWheel: true, pressedMouseMove: true },
    handleScale:   { mouseWheel: true, pinch: true },
  });

  // Responsive resize
  new ResizeObserver(entries => {
    if (!chart || !entries.length) return;
    const { width, height } = entries[0].contentRect;
    chart.applyOptions({ width, height: Math.max(height, 300) });
    chart.timeScale().fitContent();
  }).observe(container);

  // ── OHLC hover legend ──────────────────────────────────────────
  chart.subscribeCrosshairMove(param => {
    if (!param.time || !candleSeries) {
      _resetOHLC();
      return;
    }
    const bar = param.seriesData?.get(candleSeries);
    if (!bar) { _resetOHLC(); return; }

    _updateOHLC(bar.open, bar.high, bar.low, bar.close);

    // Update MA legend values on hover
    if (emaSeries)  _setLegendVal('legendEMA',  param.seriesData?.get(emaSeries)?.value);
    if (ma20Series) _setLegendVal('legendMA20', param.seriesData?.get(ma20Series)?.value);
    if (ma50Series) _setLegendVal('legendMA50', param.seriesData?.get(ma50Series)?.value);
  });

  createCandleSeries();
  loadChartData(currentSymbol, currentInterval);
}

// ===== OHLC DISPLAY HELPERS =====
function _updateOHLC(o, h, l, c) {
  const up = c >= o;
  _setOHLCEl('ohlcO', o, up);
  _setOHLCEl('ohlcH', h, up);
  _setOHLCEl('ohlcL', l, up);
  _setOHLCEl('ohlcC', c, up);
  const pct = o > 0 ? ((c - o) / o * 100) : 0;
  const pctEl = document.getElementById('ohlcPct');
  if (pctEl) {
    pctEl.textContent = (up ? '+' : '') + pct.toFixed(2) + '%';
    pctEl.className   = 'ohlc-pct ' + (up ? 'up' : 'down');
  }
  const bar = document.getElementById('ohlcBar');
  if (bar) bar.style.display = 'flex';
}

function _resetOHLC() {
  const bar = document.getElementById('ohlcBar');
  if (bar) bar.style.display = 'none';
}

function _setOHLCEl(id, val, up) {
  const el = document.getElementById(id);
  const sym = (typeof getActiveMarket === 'function') ? (getActiveMarket().currency || '$') : '$';
  if (el && val !== undefined) el.textContent = sym + Number(val).toFixed(2);
}

function _setLegendVal(id, val) {
  const el = document.getElementById(id);
  const sym = (typeof getActiveMarket === 'function') ? (getActiveMarket().currency || '$') : '$';
  if (el) el.textContent = val !== undefined ? sym + Number(val).toFixed(2) : '—';
}

// ===== CREATE SERIES =====
function _clearIndicators() {
  if (emaSeries)  { try { chart.removeSeries(emaSeries);  } catch(_){} emaSeries  = null; }
  if (ma20Series) { try { chart.removeSeries(ma20Series); } catch(_){} ma20Series = null; }
  if (ma50Series) { try { chart.removeSeries(ma50Series); } catch(_){} ma50Series = null; }
}

function createCandleSeries() {
  if (candleSeries) { try { chart.removeSeries(candleSeries); } catch(_){} }
  if (lineSeries)   { try { chart.removeSeries(lineSeries);   } catch(_){} }
  if (volumeSeries) { try { chart.removeSeries(volumeSeries); } catch(_){} }
  _clearIndicators();

  // Candlestick — Groww palette
  candleSeries = chart.addCandlestickSeries({
    upColor:          '#00d09c',
    downColor:        '#eb5b3c',
    borderUpColor:    '#00d09c',
    borderDownColor:  '#eb5b3c',
    wickUpColor:      '#00d09c',
    wickDownColor:    '#eb5b3c',
    priceLineVisible: false,  // axis label already shows price; line caused stretched empty space
    lastValueVisible: true,
  });

  // Volume histogram
  volumeSeries = chart.addHistogramSeries({
    priceFormat:  { type: 'volume' },
    priceScaleId: '',
    scaleMargins: { top: 0.80, bottom: 0 },
  });

  lineSeries      = null;
  activeChartType = 'candlestick';
}

function createLineSeries() {
  if (candleSeries) { try { chart.removeSeries(candleSeries); } catch(_){} }
  if (lineSeries)   { try { chart.removeSeries(lineSeries);   } catch(_){} }
  if (volumeSeries) { try { chart.removeSeries(volumeSeries); } catch(_){} }
  _clearIndicators();

  lineSeries = chart.addAreaSeries({
    topColor:         'rgba(0,208,156,0.20)',
    bottomColor:      'rgba(0,208,156,0.00)',
    lineColor:        '#00d09c',
    lineWidth:        2,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius:  4,
    crosshairMarkerBackgroundColor: '#00d09c',
    lastValueVisible: true,
    priceLineVisible: true,
    priceLineColor:   '#00d09c',
  });

  candleSeries    = null;
  activeChartType = 'line';
}

function createAreaSeries() { createLineSeries(); activeChartType = 'area'; }

// ===== APPLY INDICATOR OVERLAYS =====
function _applyIndicators(data) {
  if (activeChartType !== 'candlestick') return;
  _clearIndicators();

  const indLegend = document.getElementById('indicatorLegend');
  if (indLegend) indLegend.style.display = 'flex';

  if (_showEMA && data.length >= 9) {
    emaSeries = chart.addLineSeries({
      color:            '#f59e0b',
      lineWidth:        1.5,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    emaSeries.setData(calcEMA(data, 9));
  }

  if (_showMA20 && data.length >= 20) {
    ma20Series = chart.addLineSeries({
      color:            '#818cf8',
      lineWidth:        1.5,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    ma20Series.setData(calcSMA(data, 20));
  }

  if (_showMA50 && data.length >= 50) {
    ma50Series = chart.addLineSeries({
      color:            '#fb923c',
      lineWidth:        1.5,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    ma50Series.setData(calcSMA(data, 50));
  }

  _updateIndLegendVisibility();
}

function _updateIndLegendVisibility() {
  const anyActive = _showEMA || _showMA20 || _showMA50;
  const el = document.getElementById('indicatorLegend');
  if (el) el.style.display = (anyActive && activeChartType === 'candlestick') ? 'flex' : 'none';

  // Sync toggle button active classes
  _syncIndBtn('btnEMA',  _showEMA);
  _syncIndBtn('btnMA20', _showMA20);
  _syncIndBtn('btnMA50', _showMA50);
}

function _syncIndBtn(id, active) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('active', active);
}

// ===== TOGGLE INDICATORS =====
function toggleIndicator(name) {
  if (name === 'EMA')  _showEMA  = !_showEMA;
  if (name === 'MA20') _showMA20 = !_showMA20;
  if (name === 'MA50') _showMA50 = !_showMA50;
  if (_lastChartData) _applyIndicators(_lastChartData);
  _updateIndLegendVisibility();
}

// ===== LOAD DATA =====
let _lastChartBar  = null;
let _lastChartData = null;

async function loadChartData(symbol, interval) {
  // Show skeleton loading state
  const chartEl = document.getElementById('mainChart');
  if (chartEl) chartEl.style.opacity = '0.5';

  try {
    const data = await MarketAPI.getHistory(symbol, interval);
    if (!data || data.length === 0) return;

    _lastChartData = data;
    _lastChartBar  = data[data.length - 1] || null;

    if (activeChartType === 'candlestick') {
      candleSeries.setData(data);
      candleSeries.setMarkers([]); // clear any stale markers

      if (volumeSeries) {
        volumeSeries.setData(data.map(d => ({
          time:  d.time,
          value: d.volume || 0,
          color: d.close >= d.open
            ? 'rgba(0,208,156,0.25)'
            : 'rgba(235,91,60,0.25)',
        })));
      }

      _applyIndicators(data);
    } else {
      lineSeries.setData(data.map(d => ({ time: d.time, value: d.close })));
    }

    chart.timeScale().fitContent();

    // Live price for header
    MarketAPI.getQuote(symbol).then(quote => {
      if (quote?.price) {
        updateChartHeader(symbol, quote.price, quote.changePercent ?? quote.change ?? 0);
      } else {
        const last  = data[data.length - 1];
        const first = data[0];
        updateChartHeader(symbol, last.close, ((last.close - first.close) / first.close * 100));
      }
    }).catch(() => {
      const last  = data[data.length - 1];
      const first = data[0];
      updateChartHeader(symbol, last.close, ((last.close - first.close) / first.close * 100));
    });

    startPriceUpdates(symbol);
  } catch (err) {
    console.error('Chart data error:', err);
  } finally {
    if (chartEl) chartEl.style.opacity = '1';
  }
}

// ===== REAL-TIME UPDATES (quote only — no history re-fetch) =====
// Updates the LAST bar in-place at its own timestamp.
// DO NOT use Date.now() — historical data ends days/weeks ago so a future
// timestamp stretches the time axis and squishes all candles to the left.
function startPriceUpdates(symbol) {
  if (priceUpdateInterval) clearInterval(priceUpdateInterval);

  priceUpdateInterval = setInterval(async () => {
    try {
      const quote = await MarketAPI.getQuote(symbol);
      if (!_lastChartBar) return;

      if (activeChartType === 'candlestick' && candleSeries) {
        // Update the last historical bar in-place — no new bar, no time-axis stretch
        candleSeries.update({
          time:  _lastChartBar.time,
          open:  _lastChartBar.open,
          high:  Math.max(_lastChartBar.high, quote.price),
          low:   Math.min(_lastChartBar.low,  quote.price),
          close: quote.price,
        });
      } else if (lineSeries) {
        lineSeries.update({ time: _lastChartBar.time, value: quote.price });
      }

      updateChartHeader(symbol, quote.price, quote.change);
    } catch (_) {}
  }, 3000);
}

// ===== HEADER UPDATE =====
async function updateChartHeader(symbol, price, changePct) {
  const priceEl  = document.getElementById('chartPrice');
  const symEl    = document.getElementById('chartSymbol');
  const changeEl = document.getElementById('chartChange');
  if (!priceEl) return;

  const mkt          = (typeof getActiveMarket === 'function') ? getActiveMarket() : { currency: '$', currencyCode: 'USD' };
  const currencyCode = mkt.currencyCode || 'USD';
  const isUSD        = currencyCode === 'USD';
  const up           = changePct >= 0;

  // Get USD price
  let usdPrice = price;
  if (!isUSD && typeof getUsdPrice === 'function') {
    try { ({ usdPrice } = await getUsdPrice(price)); } catch (_) {}
  }

  const usdStr   = '$' + usdPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const localStr = isUSD ? '' : `<span class="chart-price-usd">\u2248 ${mkt.currency}${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;

  priceEl.innerHTML = `<span>${usdStr}</span>${localStr}`;
  priceEl.className = `chart-price ${up ? 'price-up' : 'price-down'}`;
  if (symEl)    symEl.textContent    = symbol;
  if (changeEl) {
    changeEl.textContent = (up ? '\u25b2 +' : '\u25bc ') + Math.abs(changePct).toFixed(2) + '%';
    changeEl.className   = 'change-pill ' + (up ? 'up' : 'down');
  }
}

// ===== CHART TYPE SWITCH =====
function setChartType(type, btn) {
  document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (type === 'candlestick') createCandleSeries();
  else                        createLineSeries();

  loadChartData(currentSymbol, currentInterval);
}

// ===== INTERVAL SWITCH =====
function setChartInterval(interval, btn) {
  document.querySelectorAll('.interval-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  currentInterval = interval;
  loadChartData(currentSymbol, currentInterval);
}

// ===== LOAD SYMBOL =====
function loadSymbol(symbol) {
  currentSymbol = symbol.toUpperCase();
  document.getElementById('orderSymbol').value = currentSymbol;
  loadChartData(currentSymbol, currentInterval);
  updateOrderSummary();
  RealtimeMarketAPI.subscribe(currentSymbol, () => updateOrderSummary());
}
