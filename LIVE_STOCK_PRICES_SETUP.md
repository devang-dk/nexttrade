# Live Stock Price Integration Guide

## ✅ What's New

Your STOCK application now has **real-time live stock prices** from Finnhub API with WebSocket support!

### Features
- ✓ Real-time stock quotes (price, change, OHLC, volume)
- ✓ WebSocket for live price streams
- ✓ Historical OHLCV data for charting
- ✓ Stock search functionality
- ✓ Company profiles
- ✓ Market movers tracking
- ✓ Batch quote fetching
- ✓ Automatic price caching (5 second TTL)

---

## 🔑 Step 1: Get Finnhub API Key

1. Go to [https://finnhub.io/register](https://finnhub.io/register)
2. Sign up for free account
3. Get your API key from dashboard
4. Copy the API key

**Free Tier Details:**
- 60 API calls per minute
- Real-time quote data
- WebSocket support
- Sufficient for personal/small trading apps

---

## 📝 Step 2: Configure .env File

Edit `server/.env` and add your Finnhub API key:

```env
MARKET_API_KEY=your_actual_finnhub_api_key_here
```

Replace `your_actual_finnhub_api_key_here` with your actual key from Finnhub.

---

## 📦 Step 3: Install Dependencies

```powershell
cd server
npm install
```

The `ws` package (WebSocket) was added to handle real-time connections.

---

## 🚀 Step 4: Start the Server

```powershell
npm start
# or for development with auto-reload:
npm run dev
```

You should see:
```
[✓] Server running on port 8081
[✓] Finnhub API Key configured
[✓] Real-time Price Updates: Enabled
```

---

## 🔌 API Endpoints

### Get Live Quote
```bash
GET /api/market/quote/:symbol

# Example:
GET /api/market/quote/AAPL
```

Response:
```json
{
  "symbol": "AAPL",
  "price": 189.45,
  "change": 1.23,
  "changePercent": 0.65,
  "open": 188.50,
  "high": 190.20,
  "low": 187.80,
  "volume": 45000000,
  "timestamp": "2024-04-17T10:30:00.000Z"
}
```

### Batch Get Multiple Quotes
```bash
GET /api/market/quotes?symbols=AAPL,MSFT,GOOGL
```

### Get Historical Data
```bash
GET /api/market/history/AAPL?resolution=D&from=1707004800&to=1712188800

# Resolutions: '1' (minute), '5', '15', '30', '60' (minute), 'D' (day), 'W' (week), 'M' (month)
```

### Search Stocks
```bash
GET /api/market/search?q=apple
```

### Get Market Movers
```bash
GET /api/market/movers
```

### Get Company Profile
```bash
GET /api/market/company/AAPL
```

---

## 🔌 WebSocket Real-time Prices

### Subscribe to Price Updates

```javascript
// Client code
const socket = io('http://localhost:8081');

// Subscribe to symbols
socket.emit('subscribe', ['AAPL', 'MSFT', 'GOOGL']);

// Listen for price updates
socket.on('priceUpdates', (quotes) => {
  console.log('Updated prices:', quotes);
});

// Listen for subscription confirmation
socket.on('subscribed', (symbols) => {
  console.log('Subscribed to:', symbols);
});
```

### Unsubscribe

```javascript
socket.emit('unsubscribe', ['AAPL']);
```

---

## 🔄 Frontend Integration Example

### Update React Component

```javascript
// client/src/components/StockPrice.jsx
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export function StockPrice({ symbol }) {
  const [quote, setQuote] = useState(null);
  
  useEffect(() => {
    // Fetch initial quote
    fetch(`/api/market/quote/${symbol}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setQuote);

    // WebSocket for live updates
    const socket = io();
    socket.emit('subscribe', [symbol]);
    
    socket.on('priceUpdates', (quotes) => {
      if (quotes[symbol]) {
        setQuote(quotes[symbol]);
      }
    });

    return () => {
      socket.emit('unsubscribe', [symbol]);
      socket.disconnect();
    };
  }, [symbol]);

  if (!quote) return <div>Loading...</div>;

  return (
    <div className="quote">
      <h2>{symbol}</h2>
      <p>${quote.price.toFixed(2)}</p>
      <p style={{ color: quote.change >= 0 ? 'green' : 'red' }}>
        {quote.change >= 0 ? '+' : ''}{quote.change} ({quote.changePercent}%)
      </p>
      <small>{quote.timestamp}</small>
    </div>
  );
}
```

---

## ⚡ Performance Tips

1. **Cache Quotes**: Quotes are cached for 5 seconds to reduce API calls
2. **Batch Requests**: Use `/api/market/quotes` to fetch multiple stocks
3. **Selective Subscriptions**: Only subscribe to symbols users are viewing
4. **Unsubscribe**: Remove subscriptions when components unmount

---

## 🔄 Switch API Providers (Optional)

If you want to switch from Finnhub to another provider:

### Alpha Vantage
```javascript
// Update marketDataService.js
const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`;
```

### Polygon.io
```javascript
const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${this.apiKey}`;
```

---

## 🆘 Troubleshooting

### "Symbol not found" error
- Check symbol is valid (e.g., AAPL, MSFT, GOOGL)
- Some symbols may not have data in free tier

### "Error fetching quote"
- Verify `MARKET_API_KEY` is set correctly in .env
- Check Finnhub API rate limits (60 calls/min)
- Try again in a few seconds

### WebSocket not connecting
- Ensure Socket.io is initialized
- Check firewall/proxy settings
- Verify WebSocket is enabled in browser

### "MARKET_API_KEY not configured" warning
- Your app will use demo data
- Add valid API key to `server/.env`
- Restart server

---

## 📊 Supported Stocks

US Market stocks:
- **Tech**: AAPL, MSFT, GOOGL, TSLA, NVDA, AMD, META, etc.
- **Finance**: JPM, BAC, GS, MS, etc.
- **Healthcare**: JNJ, PFE, ABBV, MRK, etc.
- **Energy**: XOM, CVX, COP, etc.
- **Retail**: WMT, TGT, AMZN, etc.

And **10,000+ other US listed companies**

---

## 📚 Resources

- **Finnhub Docs**: https://finnhub.io/docs/api
- **API Reference**: https://finnhub.io/api/docs
- **WebSocket Guide**: https://finnhub.io/docs/api/websocket
- **Rate Limits**: https://finnhub.io/dashboard

---

## ✅ Checklist

- [ ] Signed up for Finnhub account
- [ ] Got API key
- [ ] Added API key to `.env` file
- [ ] Ran `npm install` in server folder
- [ ] Started server with `npm start`
- [ ] Tested `/api/market/quote/AAPL` endpoint
- [ ] Verified "Finnhub API Key configured" message
- [ ] Updated frontend components with WebSocket

Happy trading! 🚀
