// =====================================================================
// API CLIENT EXAMPLES - Live Stock Price Integration
// Use these curl commands to test the live market data endpoints
// =====================================================================

// Replace YOUR_JWT_TOKEN and your_finnhub_api_key_here with actual values

// ===== 1. Get Live Stock Quote =====
curl -X GET http://localhost:8081/api/market/quote/AAPL \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

// Response:
// {
//   "symbol": "AAPL",
//   "price": 189.45,
//   "change": 1.23,
//   "changePercent": 0.65,
//   "open": 188.50,
//   "high": 190.20,
//   "low": 187.80,
//   "volume": 45000000,
//   "timestamp": "2024-04-17T10:30:00.000Z"
// }


// ===== 2. Batch Get Multiple Quotes =====
curl -X GET "http://localhost:8081/api/market/quotes?symbols=AAPL,MSFT,GOOGL,TSLA" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

// Response:
// {
//   "AAPL": { price, change, ... },
//   "MSFT": { price, change, ... },
//   "GOOGL": { price, change, ... },
//   "TSLA": { price, change, ... }
// }


// ===== 3. Search Stocks =====
curl -X GET "http://localhost:8081/api/market/search?q=apple" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

// Response:
// [
//   { "symbol": "AAPL", "name": "Apple Inc.", "type": "Common Stock" },
//   { ... more results ... }
// ]


// ===== 4. Get Market Movers =====
curl -X GET http://localhost:8081/api/market/movers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

// Response:
// [
//   { symbol: "AAPL", price: 189.45, change: 1.23, changePercent: 0.65 },
//   { symbol: "MSFT", price: 415.18, change: 0.95, changePercent: 0.23 },
//   ...top 5 gainers...
// ]


// ===== 5. Get Company Profile =====
curl -X GET http://localhost:8081/api/market/company/AAPL \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

// Response:
// {
//   "symbol": "AAPL",
//   "name": "Apple Inc.",
//   "industry": "Consumer Electronics",
//   "marketCap": 2950000000000,
//   "employees": 164000,
//   "logo": "https://..."
// }


// ===== 6. Get Historical OHLCV Data =====
// Parameters:
// - resolution: '1', '5', '15', '30', '60' (minutes), 'D' (day), 'W' (week), 'M' (month)
// - from: Unix timestamp (start date)
// - to: Unix timestamp (end date)

curl -X GET "http://localhost:8081/api/market/history/AAPL?resolution=D&from=1707004800&to=1712188800" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

// Response:
// [
//   { "time": 1707004800, "open": 180.50, "high": 185.25, "low": 179.80, "close": 183.45, "volume": 45000000 },
//   { "time": 1707091200, "open": 183.50, "high": 187.80, "low": 182.30, "close": 186.90, "volume": 52000000 },
//   ...more bars...
// ]


// ===== 7. Test Health Check =====
curl http://localhost:8081/health

// Response:
// {
//   "status": "ok",
//   "service": "NexTrade API",
//   "version": "1.0.0",
//   "timestamp": "2024-04-17T10:30:00.000Z"
// }


// ===== WebSocket Examples (JavaScript) =====

// Connect and subscribe to real-time updates
const socket = io('http://localhost:8081');

// Subscribe to specific symbols
socket.emit('subscribe', ['AAPL', 'MSFT', 'GOOGL']);

// Listen for price updates (every 2 seconds)
socket.on('priceUpdates', (quotes) => {
  console.log('Price update:', quotes);
  // quotes = {
  //   "AAPL": { symbol, price, change, ... },
  //   "MSFT": { symbol, price, change, ... },
  //   ...
  // }
});

// Listen for subscription confirmation
socket.on('subscribed', (symbols) => {
  console.log('Successfully subscribed to:', symbols);
});

// Unsubscribe from symbols
socket.emit('unsubscribe', ['AAPL']);

// Handle disconnect
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});


// ===== PostgreSQL Connection Test =====
// Test that Finnhub API is working (in Node.js)

const fetch = require('node-fetch');

async function testFinnhubAPI() {
  const apiKey = process.env.MARKET_API_KEY;
  
  const response = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${apiKey}`
  );
  
  const data = await response.json();
  console.log('Finnhub Response:');
  console.log('- Current Price:', data.c);
  console.log('- Change:', data.d);
  console.log('- Change %:', data.dp);
  console.log('- Timestamp:', new Date(data.t * 1000).toISOString());
}

testFinnhubAPI();
