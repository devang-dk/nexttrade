// =====================================================================
// src/utils/api.js - API Client
// =====================================================================

import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8081/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ===== AUTH API =====
export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  googleLogin: (credential) => apiClient.post('/auth/google', { credential }),
  getGoogleConfig: () => apiClient.get('/auth/google/config'),
  getMe: () => apiClient.get('/auth/me'),
};

// ===== MARKET API =====
export const marketAPI = {
  getQuote: (symbol) => apiClient.get(`/market/quote/${symbol}`),
  getHistory: (symbol, interval = '1M') => apiClient.get(`/market/history/${symbol}?interval=${interval}`),
  search: (query) => apiClient.get(`/market/search?q=${query}`),
  getMovers: () => apiClient.get('/market/movers'),
};

// ===== PORTFOLIO API =====
export const portfolioAPI = {
  getHoldings: () => apiClient.get('/portfolio'),
  getSummary: () => apiClient.get('/portfolio/summary'),
};

// ===== ORDERS API =====
export const ordersAPI = {
  buy: (data) => apiClient.post('/orders/buy', data),
  sell: (data) => apiClient.post('/orders/sell', data),
  getHistory: () => apiClient.get('/orders/history'),
};

// ===== PAYMENT API =====
export const paymentAPI = {
  deposit: (data) => apiClient.post('/payment/deposit', data),
  withdraw: (data) => apiClient.post('/payment/withdraw', data),
  getHistory: () => apiClient.get('/payment/history'),
};

export default apiClient;
