// =====================================================================
// middleware/metrics.js — Prometheus metrics for NexTrade
// Exposes /metrics endpoint consumed by Prometheus scraper
//
// Install dependency:  npm install prom-client
// =====================================================================

const client = require('prom-client');

// ── Collect default Node.js process metrics (memory, CPU, GC, etc.) ──
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'nextrade_' });

// ── Custom Metrics ────────────────────────────────────────────────────

/** Total HTTP requests, labelled by method, route, and status code */
const httpRequestsTotal = new client.Counter({
  name: 'nextrade_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

/** HTTP request duration histogram */
const httpRequestDurationMs = new client.Histogram({
  name: 'nextrade_http_request_duration_ms',
  help: 'Duration of HTTP requests in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

/** Active WebSocket connections */
const wsConnectionsActive = new client.Gauge({
  name: 'nextrade_ws_connections_active',
  help: 'Number of currently active WebSocket connections',
  registers: [register],
});

/** Market data API calls */
const marketApiCallsTotal = new client.Counter({
  name: 'nextrade_market_api_calls_total',
  help: 'Total number of market data API calls made',
  labelNames: ['symbol', 'status'],
  registers: [register],
});

// ── Middleware factory ────────────────────────────────────────────────

/**
 * Express middleware — records request count and duration for every route.
 * Attach BEFORE routes: app.use(metricsMiddleware);
 */
function metricsMiddleware(req, res, next) {
  // Skip the /metrics endpoint itself to avoid self-referential noise
  if (req.path === '/metrics') return next();

  const end = httpRequestDurationMs.startTimer();

  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };
    httpRequestsTotal.inc(labels);
    end(labels);
  });

  next();
}

/**
 * Mount the /metrics GET endpoint.
 * Usage: app.get('/metrics', metricsEndpoint);
 */
async function metricsEndpoint(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
}

module.exports = {
  metricsMiddleware,
  metricsEndpoint,
  wsConnectionsActive,
  marketApiCallsTotal,
  register,
};
