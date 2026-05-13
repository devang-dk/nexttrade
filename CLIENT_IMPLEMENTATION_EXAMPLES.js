// =====================================================================
// CLIENT-SIDE IMPLEMENTATION - Live Stock Prices with WebSocket
// Copy these examples to your React components
// =====================================================================

// ===== Example 1: Simple Quote Display Component =====

import { useEffect, useState } from 'react';
import axios from 'axios';

export function QuoteDisplay({ symbol, token }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `/api/market/quote/${symbol.toUpperCase()}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setQuote(response.data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [symbol, token]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!quote) return <div>No data</div>;

  const isPositive = quote.change >= 0;

  return (
    <div className="quote-display">
      <h3>{symbol.toUpperCase()}</h3>
      <div className="price">${quote.price.toFixed(2)}</div>
      <div style={{ color: isPositive ? 'green' : 'red' }}>
        {isPositive ? '+' : ''}{quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
      </div>
      <div className="details">
        <p>Open: ${quote.open}</p>
        <p>High: ${quote.high}</p>
        <p>Low: ${quote.low}</p>
        <p>Volume: {(quote.volume / 1000000).toFixed(2)}M</p>
      </div>
    </div>
  );
}


// ===== Example 2: Real-time Price Updates with WebSocket =====

import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

export function LiveStockWidget({ symbols, token }) {
  const [quotes, setQuotes] = useState({});
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Fetch initial quotes
    const fetchInitial = async () => {
      try {
        const response = await axios.get(
          `/api/market/quotes?symbols=${symbols.join(',')}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setQuotes(response.data);
      } catch (error) {
        console.error('Error fetching quotes:', error);
      }
    };

    fetchInitial();

    // Connect to WebSocket
    const newSocket = io();
    
    // Subscribe to symbols
    newSocket.emit('subscribe', symbols);

    // Listen for real-time updates
    newSocket.on('priceUpdates', (updatedQuotes) => {
      setQuotes(prev => ({ ...prev, ...updatedQuotes }));
    });

    newSocket.on('subscribed', (subscribed) => {
      console.log('Subscribed to:', subscribed);
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.emit('unsubscribe', symbols);
      newSocket.disconnect();
    };
  }, [symbols, token]);

  return (
    <div className="live-stock-widget">
      <h2>Live Prices</h2>
      <div className="quotes-grid">
        {symbols.map(symbol => {
          const quote = quotes[symbol];
          if (!quote) return <div key={symbol}>Loading {symbol}...</div>;

          const isPositive = quote.change >= 0;

          return (
            <div key={symbol} className="quote-card">
              <div className="symbol">{symbol}</div>
              <div className="price">${quote.price.toFixed(2)}</div>
              <div 
                className="change" 
                style={{ color: isPositive ? 'green' : 'red' }}
              >
                {isPositive ? '📈' : '📉'} {isPositive ? '+' : ''}{quote.change.toFixed(2)}
              </div>
              <small>{quote.timestamp}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ===== Example 3: Stock Search Component =====

import { useState } from 'react';
import axios from 'axios';

export function StockSearch({ token, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (value) => {
    setQuery(value);

    if (value.length < 1) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(
        `/api/market/search?q=${value}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stock-search">
      <input
        type="text"
        placeholder="Search stocks..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      
      {loading && <p>Searching...</p>}
      
      <ul className="search-results">
        {results.map(stock => (
          <li 
            key={stock.symbol}
            onClick={() => onSelect(stock.symbol)}
          >
            <strong>{stock.symbol}</strong> - {stock.name}
            <small>{stock.type}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}


// ===== Example 4: Historical Chart Component =====

import { useEffect, useState } from 'react';
import axios from 'axios';

export function StockChart({ symbol, resolution = 'D', token }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Calculate date range (last 90 days)
        const to = Math.floor(Date.now() / 1000);
        const from = to - (90 * 24 * 60 * 60);

        const response = await axios.get(
          `/api/market/history/${symbol}?resolution=${resolution}&from=${from}&to=${to}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        setData(response.data);
      } catch (error) {
        console.error('Error fetching chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [symbol, resolution, token]);

  if (loading) return <div>Loading chart...</div>;

  return (
    <div className="stock-chart">
      <h3>{symbol} - {resolution}</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Open</th>
            <th>High</th>
            <th>Low</th>
            <th>Close</th>
            <th>Volume</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(-20).reverse().map((bar, idx) => (
            <tr key={idx}>
              <td>{new Date(bar.time * 1000).toLocaleDateString()}</td>
              <td>${bar.open.toFixed(2)}</td>
              <td>${bar.high.toFixed(2)}</td>
              <td>${bar.low.toFixed(2)}</td>
              <td>${bar.close.toFixed(2)}</td>
              <td>{(bar.volume / 1000000).toFixed(2)}M</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ===== Example 5: Market Movers Component =====

import { useEffect, useState } from 'react';
import axios from 'axios';

export function MarketMovers({ token }) {
  const [movers, setMovers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovers = async () => {
      try {
        const response = await axios.get(
          '/api/market/movers',
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMovers(response.data);
      } catch (error) {
        console.error('Error fetching movers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovers();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchMovers, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) return <div>Loading movers...</div>;

  return (
    <div className="market-movers">
      <h2>🔥 Market Movers</h2>
      <div className="movers-list">
        {movers.map(mover => {
          const isPositive = mover.change >= 0;
          return (
            <div key={mover.symbol} className="mover-card">
              <div className="symbol">{mover.symbol}</div>
              <div className="price">${mover.price.toFixed(2)}</div>
              <div 
                className="percent"
                style={{ color: isPositive ? 'green' : 'red' }}
              >
                {isPositive ? '↑' : '↓'} {Math.abs(mover.changePercent).toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ===== Utility Functions =====

export const stockAPI = {
  // Fetch single quote
  async getQuote(symbol, token) {
    const response = await axios.get(
      `/api/market/quote/${symbol}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Fetch multiple quotes
  async getQuotes(symbols, token) {
    const response = await axios.get(
      `/api/market/quotes?symbols=${symbols.join(',')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Search stocks
  async search(query, token) {
    const response = await axios.get(
      `/api/market/search?q=${query}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Get company info
  async getCompany(symbol, token) {
    const response = await axios.get(
      `/api/market/company/${symbol}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Get historical data
  async getHistory(symbol, resolution, from, to, token) {
    const response = await axios.get(
      `/api/market/history/${symbol}?resolution=${resolution}&from=${from}&to=${to}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Get market movers
  async getMovers(token) {
    const response = await axios.get(
      '/api/market/movers',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },
};
