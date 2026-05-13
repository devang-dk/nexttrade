// =====================================================================
// MarketDataService.cpp — Yahoo Finance API integration + caching
// =====================================================================

#include "market/MarketDataService.h"
#include <curl/curl.h>
#include <sstream>
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <mutex>
#include <map>
#include <random>

namespace NexTrade {

// ===== Static member definitions =====
std::map<std::string, CachedQuote> MarketDataService::quoteCache_;
std::mutex MarketDataService::cacheMutex_;
std::map<std::string, double> MarketDataService::simulatedPrices_;
std::mutex MarketDataService::simPriceMutex_;

const std::vector<std::pair<std::string,std::string>> MarketDataService::SYMBOLS = {
    {"AAPL",  "Apple Inc."},
    {"TSLA",  "Tesla Inc."},
    {"NVDA",  "NVIDIA Corporation"},
    {"MSFT",  "Microsoft Corporation"},
    {"GOOGL", "Alphabet Inc. (Google)"},
    {"AMZN",  "Amazon.com Inc."},
    {"META",  "Meta Platforms Inc."},
    {"NFLX",  "Netflix Inc."},
    {"AMD",   "Advanced Micro Devices"},
    {"DIS",   "Walt Disney Company"},
    {"INTC",  "Intel Corporation"},
    {"BABA",  "Alibaba Group"},
    {"PYPL",  "PayPal Holdings"},
    {"UBER",  "Uber Technologies"},
    {"SPOT",  "Spotify Technology"},
    {"SNAP",  "Snap Inc."},
    {"TWTR",  "Twitter / X Corp."},
    {"COIN",  "Coinbase Global"},
    {"GME",   "GameStop Corp."},
    {"AMC",   "AMC Entertainment"},
    {"SPY",   "S&P 500 ETF (SPDR)"},
    {"QQQ",   "Invesco QQQ ETF"},
};

// Base prices for simulation
static std::map<std::string, double> BASE_PRICES = {
    {"AAPL",189.45}, {"TSLA",248.72}, {"NVDA",912.30}, {"MSFT",415.18},
    {"GOOGL",174.50},{"AMZN",193.25}, {"META",513.80}, {"NFLX",635.40},
    {"AMD",178.60},  {"DIS",112.45},  {"INTC",30.12},  {"BABA",73.85},
    {"PYPL",62.40},  {"UBER",78.90},  {"SPOT",245.60}, {"SNAP",11.20},
    {"TWTR",45.00},  {"COIN",205.30}, {"GME",14.80},   {"AMC",3.95},
    {"SPY",501.00},  {"QQQ",431.50},
};

// ===================================================================
// HTTP GET (libcurl)
// ===================================================================
static size_t curlWriteCallback(void* contents, size_t size, size_t nmemb, std::string* out) {
    out->append((char*)contents, size * nmemb);
    return size * nmemb;
}

std::string MarketDataService::httpGet(const std::string& url) {
    CURL* curl = curl_easy_init();
    if (!curl) throw std::runtime_error("Could not init CURL");

    std::string response;
    curl_easy_setopt(curl, CURLOPT_URL,           url.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, curlWriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA,     &response);
    curl_easy_setopt(curl, CURLOPT_USERAGENT,     "Mozilla/5.0 (compatible; NexTrade/1.0)");
    curl_easy_setopt(curl, CURLOPT_TIMEOUT,       8L);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);

    CURLcode res = curl_easy_perform(curl);
    curl_easy_cleanup(curl);

    if (res != CURLE_OK)
        throw std::runtime_error(std::string("CURL error: ") + curl_easy_strerror(res));

    return response;
}

// ===================================================================
// SIMULATED PRICE (used as fallback)
// ===================================================================
static double getSimulatedPrice(const std::string& symbol) {
    static std::mt19937 rng(std::random_device{}());
    static std::uniform_real_distribution<double> dist(-0.002, 0.002);

    std::lock_guard<std::mutex> lock(MarketDataService::simPriceMutex_);
    auto& prices = MarketDataService::simulatedPrices_;

    if (prices.find(symbol) == prices.end()) {
        auto it = BASE_PRICES.find(symbol);
        prices[symbol] = (it != BASE_PRICES.end()) ? it->second : 100.0;
    }
    prices[symbol] *= (1.0 + dist(rng));
    prices[symbol] = std::max(0.01, prices[symbol]);
    return prices[symbol];
}

// ===================================================================
// GET QUOTE — Yahoo Finance with simulated fallback
// ===================================================================
StockQuote MarketDataService::getQuote(const std::string& symbol) {
    std::string sym = symbol;
    std::transform(sym.begin(), sym.end(), sym.begin(), ::toupper);

    // Check cache
    {
        std::lock_guard<std::mutex> lock(cacheMutex_);
        auto it = quoteCache_.find(sym);
        if (it != quoteCache_.end()) {
            auto age = std::chrono::steady_clock::now() - it->second.fetchTime;
            if (std::chrono::duration_cast<std::chrono::seconds>(age).count() < CACHE_TTL_SECONDS)
                return it->second.quote;
        }
    }

    StockQuote quote;
    quote.symbol    = sym;
    quote.timestamp = getCurrentTimestamp();

    // Try Yahoo Finance
    try {
        std::string url = "https://query1.finance.yahoo.com/v10/finance/quoteSummary/"
                        + sym + "?modules=price";
        std::string raw = httpGet(url);
        auto j  = json::parse(raw);
        auto& result = j["quoteSummary"]["result"][0]["price"];

        quote.price          = result["regularMarketPrice"]["raw"].get<double>();
        quote.change         = result["regularMarketChange"]["raw"].get<double>();
        quote.changePercent  = result["regularMarketChangePercent"]["raw"].get<double>() * 100.0;
        quote.open           = result["regularMarketOpen"]["raw"].get<double>();
        quote.high           = result["regularMarketDayHigh"]["raw"].get<double>();
        quote.low            = result["regularMarketDayLow"]["raw"].get<double>();
        quote.volume         = result["regularMarketVolume"]["raw"].get<long long>();
        quote.name           = result.value("shortName", sym);

    } catch (const std::exception& e) {
        // Fallback to simulation
        std::cerr << "[MarketData] Yahoo Finance error for " << sym << ": " << e.what()
                  << " — using simulated price." << std::endl;

        double price   = getSimulatedPrice(sym);
        double base    = BASE_PRICES.count(sym) ? BASE_PRICES[sym] : 100.0;
        double chgPct  = ((price - base) / base) * 100.0;

        quote.price         = price;
        quote.change        = price - base;
        quote.changePercent = chgPct;
        quote.open          = base;
        quote.high          = price * 1.005;
        quote.low           = price * 0.993;
        quote.volume        = (long long)(rand() % 50000000 + 1000000);

        auto nameIt = std::find_if(SYMBOLS.begin(), SYMBOLS.end(),
            [&](const auto& p) { return p.first == sym; });
        quote.name = (nameIt != SYMBOLS.end()) ? nameIt->second : sym;
    }

    // Update simulated price to match real price for consistency
    {
        std::lock_guard<std::mutex> lock(simPriceMutex_);
        simulatedPrices_[sym] = quote.price;
    }

    // Cache the result
    {
        std::lock_guard<std::mutex> lock(cacheMutex_);
        quoteCache_[sym] = { quote, std::chrono::steady_clock::now() };
    }

    return quote;
}

// ===================================================================
// GET HISTORY — Yahoo Finance chart API
// ===================================================================
std::vector<OHLCVBar> MarketDataService::getHistory(
    const std::string& symbol, const std::string& interval)
{
    std::string sym = symbol;
    std::transform(sym.begin(), sym.end(), sym.begin(), ::toupper);

    // Map frontend interval to Yahoo Finance params
    std::map<std::string, std::pair<std::string,std::string>> intervalMap = {
        {"1D",  {"5m",  "1d"}},
        {"1W",  {"60m", "5d"}},
        {"1M",  {"1d",  "1mo"}},
        {"3M",  {"1d",  "3mo"}},
        {"1Y",  {"1wk", "1y"}},
    };

    auto it = intervalMap.find(interval);
    if (it == intervalMap.end()) it = intervalMap.find("1M");

    std::string yahooInterval = it->second.first;
    std::string yahooRange    = it->second.second;

    try {
        std::string url = "https://query1.finance.yahoo.com/v8/finance/chart/" + sym
                        + "?interval=" + yahooInterval
                        + "&range="    + yahooRange;
        std::string raw = httpGet(url);
        auto j = json::parse(raw);
        return parseYahooChart(j);
    } catch (const std::exception& e) {
        std::cerr << "[MarketData] Chart fetch error for " << sym << ": " << e.what()
                  << " — generating synthetic data." << std::endl;
        return generateSyntheticHistory(sym, interval);
    }
}

std::vector<OHLCVBar> MarketDataService::parseYahooChart(const json& data) {
    std::vector<OHLCVBar> bars;
    auto& result      = data["chart"]["result"][0];
    auto& timestamps  = result["timestamp"];
    auto& indicators  = result["indicators"];
    auto& quote       = indicators["quote"][0];

    auto opens   = quote["open"];
    auto highs   = quote["high"];
    auto lows    = quote["low"];
    auto closes  = quote["close"];
    auto volumes = quote["volume"];

    for (size_t i = 0; i < timestamps.size(); ++i) {
        if (closes[i].is_null()) continue;
        OHLCVBar bar;
        bar.time   = timestamps[i].get<long long>();
        bar.open   = opens[i].is_null()   ? closes[i].get<double>() : opens[i].get<double>();
        bar.high   = highs[i].is_null()   ? closes[i].get<double>() : highs[i].get<double>();
        bar.low    = lows[i].is_null()    ? closes[i].get<double>() : lows[i].get<double>();
        bar.close  = closes[i].get<double>();
        bar.volume = volumes[i].is_null() ? 0                        : volumes[i].get<long long>();
        bars.push_back(bar);
    }
    return bars;
}

// Synthetic OHLCV generation for fallback
std::vector<OHLCVBar> MarketDataService::generateSyntheticHistory(
    const std::string& symbol, const std::string& interval)
{
    double basePrice = BASE_PRICES.count(symbol) ? BASE_PRICES[symbol] : 100.0;
    long long now    = std::time(nullptr);

    std::map<std::string, int> dayMap = {
        {"1D",1},{"1W",7},{"1M",30},{"3M",90},{"1Y",365}
    };
    int days = dayMap.count(interval) ? dayMap[interval] : 30;
    int points = std::min(days, 120);
    long long stepSec = (long long)(days * 86400) / points;

    std::mt19937 rng(std::hash<std::string>{}(symbol));
    std::normal_distribution<double> dist(0, 0.015);

    std::vector<OHLCVBar> bars;
    double price = basePrice * 0.88;

    for (int i = points; i >= 0; --i) {
        double move  = price * dist(rng);
        double open  = price;
        double close = std::max(0.01, price + move);
        double high  = std::max(open, close) * (1 + std::abs(dist(rng)) * 0.3);
        double low   = std::min(open, close) * (1 - std::abs(dist(rng)) * 0.3);

        OHLCVBar bar;
        bar.time   = now - (long long)(i * stepSec);
        bar.open   = std::round(open  * 100) / 100.0;
        bar.high   = std::round(high  * 100) / 100.0;
        bar.low    = std::round(low   * 100) / 100.0;
        bar.close  = std::round(close * 100) / 100.0;
        bar.volume = (long long)(5000000 + rng() % 45000000);

        bars.push_back(bar);
        price = close;
    }
    return bars;
}

// ===================================================================
// SEARCH
// ===================================================================
json MarketDataService::search(const std::string& query) {
    std::string q = query;
    std::transform(q.begin(), q.end(), q.begin(), ::toupper);

    json results = json::array();
    for (auto& [sym, name] : SYMBOLS) {
        if (sym.find(q) != std::string::npos ||
            [&]{
                std::string n = name;
                std::transform(n.begin(), n.end(), n.begin(), ::toupper);
                return n.find(q) != std::string::npos;
            }()) {
            results.push_back({ {"symbol", sym}, {"name", name} });
            if (results.size() >= 8) break;
        }
    }
    return results;
}

// ===================================================================
// MARKET MOVERS
// ===================================================================
json MarketDataService::getMarketMovers() {
    json movers = json::array();
    std::vector<std::string> topSyms = {"NVDA","TSLA","AAPL","META","AMZN","MSFT","AMD","NFLX"};

    for (auto& sym : topSyms) {
        try {
            auto q = getQuote(sym);
            movers.push_back({
                {"symbol",        q.symbol},
                {"name",          q.name},
                {"price",         std::round(q.price * 100) / 100.0},
                {"changePercent", std::round(q.changePercent * 100) / 100.0},
            });
        } catch (...) {}
    }

    std::sort(movers.begin(), movers.end(), [](const json& a, const json& b) {
        return std::abs(a["changePercent"].get<double>()) > std::abs(b["changePercent"].get<double>());
    });

    return movers;
}

// ===================================================================
// PRICE TICK (for WebSocket broadcast)
// ===================================================================
json MarketDataService::getPriceTick(const std::vector<std::string>& symbols) {
    json updates = json::array();
    for (auto& sym : symbols) {
        double price = getSimulatedPrice(sym);
        double base  = BASE_PRICES.count(sym) ? BASE_PRICES[sym] : price;
        double chg   = ((price - base) / base) * 100.0;
        updates.push_back({
            {"symbol", sym},
            {"price",  std::round(price * 100) / 100.0},
            {"change", std::round(chg   * 100) / 100.0},
        });
    }
    return updates;
}

} // namespace NexTrade
