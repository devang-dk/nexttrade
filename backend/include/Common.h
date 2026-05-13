#pragma once

// =====================================================================
// Common.h — Shared types, constants, and utilities
// =====================================================================

#include <string>
#include <vector>
#include <optional>
#include <chrono>
#include <sstream>
#include <iomanip>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// ===== Application Constants =====
namespace NexTrade {

constexpr int    SERVER_PORT          = 8080;
constexpr int    WS_PORT              = 8081;
constexpr double STARTING_BALANCE     = 10000.0;
constexpr double MIN_TRADE_AMOUNT     = 1.0;
constexpr int    MAX_SHARES_PER_ORDER = 100000;
constexpr int    JWT_EXPIRY_HOURS     = 24;

const std::string JWT_SECRET          = "nextrade_jwt_secret_change_in_production";
const std::string DB_CONNECTION_URI   = "mongodb://localhost:27017/";
const std::string DB_NAME             = "nextrade";

// Collection names
const std::string COL_USERS        = "users";
const std::string COL_PORTFOLIOS   = "portfolios";
const std::string COL_ORDERS       = "orders";
const std::string COL_TRANSACTIONS = "transactions";

// ===== API Response Helpers =====
inline json successResponse(const json& data, const std::string& msg = "success") {
    return { {"status", "success"}, {"message", msg}, {"data", data} };
}

inline json errorResponse(const std::string& msg, int code = 400) {
    return { {"status", "error"}, {"message", msg}, {"code", code} };
}

// ===== Timestamp Utility =====
inline std::string getCurrentTimestamp() {
    auto now = std::chrono::system_clock::now();
    auto time = std::chrono::system_clock::to_time_t(now);
    std::ostringstream oss;
    oss << std::put_time(std::gmtime(&time), "%Y-%m-%dT%H:%M:%SZ");
    return oss.str();
}

// ===== Models =====
struct User {
    std::string id;
    std::string name;
    std::string email;
    std::string passwordHash;
    double      balance = STARTING_BALANCE;
    std::string createdAt;
    std::string stripeCustomerId;

    json toJSON() const {
        return {
            {"id",      id},
            {"name",    name},
            {"email",   email},
            {"balance", balance},
        };
    }
};

struct StockQuote {
    std::string symbol;
    std::string name;
    double price;
    double change;
    double changePercent;
    double open;
    double high;
    double low;
    long long volume;
    std::string timestamp;

    json toJSON() const {
        return {
            {"symbol",        symbol},
            {"name",          name},
            {"price",         price},
            {"change",        change},
            {"changePercent", changePercent},
            {"open",          open},
            {"high",          high},
            {"low",           low},
            {"volume",        volume},
            {"timestamp",     timestamp},
        };
    }
};

struct OHLCVBar {
    long long time;
    double open, high, low, close;
    long long volume;

    json toJSON() const {
        return {
            {"time",   time},
            {"open",   open},
            {"high",   high},
            {"low",    low},
            {"close",  close},
            {"volume", volume},
        };
    }
};

struct Order {
    std::string id;
    std::string userId;
    std::string symbol;
    std::string type;      // BUY or SELL
    std::string orderType; // market, limit, stop
    int         shares;
    double      price;
    double      total;
    std::string status;    // FILLED, PENDING, CANCELLED
    std::string timestamp;

    json toJSON() const {
        return {
            {"id",        id},
            {"symbol",    symbol},
            {"type",      type},
            {"orderType", orderType},
            {"shares",    shares},
            {"price",     price},
            {"total",     total},
            {"status",    status},
            {"timestamp", timestamp},
        };
    }
};

struct Holding {
    std::string userId;
    std::string symbol;
    std::string name;
    int         shares;
    double      avgPrice;
    std::string updatedAt;

    json toJSON() const {
        return {
            {"symbol",    symbol},
            {"name",      name},
            {"shares",    shares},
            {"avgPrice",  avgPrice},
            {"updatedAt", updatedAt},
        };
    }
};

struct Transaction {
    std::string id;
    std::string userId;
    std::string type;   // DEPOSIT or WITHDRAWAL
    double      amount;
    std::string status;
    std::string paymentId;
    std::string last4;
    std::string timestamp;

    json toJSON() const {
        return {
            {"id",        id},
            {"type",      type},
            {"amount",    amount},
            {"status",    status},
            {"last4",     last4},
            {"timestamp", timestamp},
        };
    }
};

} // namespace NexTrade
