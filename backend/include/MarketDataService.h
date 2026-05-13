#pragma once
// =====================================================================
// MarketDataService.h — Real-time market data via Yahoo Finance API
// =====================================================================

#include "Common.h"
#include <string>
#include <vector>
#include <map>
#include <mutex>
#include <chrono>

namespace NexTrade {

struct CachedQuote {
    StockQuote quote;
    std::chrono::steady_clock::time_point fetchTime;
};

class MarketDataService {
public:
    // Fetch real-time quote for a symbol
    static StockQuote getQuote(const std::string& symbol);

    // Fetch OHLCV history for charting
    static std::vector<OHLCVBar> getHistory(
        const std::string& symbol,
        const std::string& interval = "1M"
    );

    // Symbol search
    static json search(const std::string& query);

    // Top market movers
    static json getMarketMovers();

    // Simulate live price tick (used for WebSocket)
    static json getPriceTick(const std::vector<std::string>& symbols);

private:
    // HTTP GET request using libcurl
    static std::string httpGet(const std::string& url);

    // Parse Yahoo Finance quote response
    static StockQuote parseYahooQuote(const std::string& symbol, const json& data);

    // Parse Yahoo Finance chart response
    static std::vector<OHLCVBar> parseYahooChart(const json& data);

    // Quote cache (5 second TTL)
    static std::map<std::string, CachedQuote> quoteCache_;
    static std::mutex cacheMutex_;
    static constexpr int CACHE_TTL_SECONDS = 5;

    // Simulated price state (for demo / fallback)
    static std::map<std::string, double> simulatedPrices_;
    static std::mutex simPriceMutex_;

    // All known symbols for search
    static const std::vector<std::pair<std::string,std::string>> SYMBOLS;
};

} // namespace NexTrade
