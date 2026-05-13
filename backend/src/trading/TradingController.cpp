// =====================================================================
// TradingController.cpp — Order execution and portfolio management
// =====================================================================

#include "trading/TradingController.h"
#include "auth/AuthController.h"
#include "db/MongoManager.h"
#include <bsoncxx/builder/basic/document.hpp>
#include <bsoncxx/builder/basic/array.hpp>
#include <bsoncxx/builder/basic/kvp.hpp>
#include <bsoncxx/oid.hpp>
#include <stdexcept>
#include <algorithm>
#include <mutex>
#include <map>
#include <iostream>

using bsoncxx::builder::basic::kvp;
using bsoncxx::builder::basic::make_document;
using bsoncxx::builder::basic::make_array;

namespace NexTrade {

// Static member definitions
std::map<std::string, std::vector<Holding>> TradingController::inMemoryPortfolios_;
std::map<std::string, std::vector<Order>>   TradingController::inMemoryOrders_;
std::mutex TradingController::portfolioMutex_;
std::mutex TradingController::orderMutex_;

std::string TradingController::generateOrderId() {
    return bsoncxx::oid{}.to_string();
}

// ===================================================================
// GET PORTFOLIO
// ===================================================================
json TradingController::getPortfolio(const std::string& userId) {
    auto& db = MongoManager::getInstance();
    json result = json::array();

    if (db.isConnected()) {
        auto holdings = db.findMany(
            COL_PORTFOLIOS,
            make_document(kvp("userId", userId)),
            100, 0
        );
        for (auto& h : holdings) {
            result.push_back(h);
        }
    } else {
        std::lock_guard<std::mutex> lock(portfolioMutex_);
        auto it = inMemoryPortfolios_.find(userId);
        if (it != inMemoryPortfolios_.end()) {
            for (auto& h : it->second) {
                result.push_back(h.toJSON());
            }
        }
    }
    return result;
}

// ===================================================================
// PLACE BUY ORDER
// ===================================================================
json TradingController::placeBuyOrder(
    const std::string& userId,
    const std::string& symbol,
    int    shares,
    double price,
    const std::string& orderType)
{
    if (shares <= 0)  throw std::runtime_error("Shares must be positive");
    if (price  <= 0)  throw std::runtime_error("Price must be positive");
    if (shares > MAX_SHARES_PER_ORDER) throw std::runtime_error("Exceeds max shares per order");

    double cost = shares * price;

    // Check user balance
    auto userOpt = AuthController::getUserById(userId);
    if (!userOpt) throw std::runtime_error("User not found");
    if (userOpt->balance < cost)
        throw std::runtime_error("Insufficient balance. Available: $"
                                 + std::to_string(userOpt->balance));

    // Deduct balance
    double newBalance = userOpt->balance - cost;
    AuthController::updateBalance(userId, newBalance);

    // Build order
    Order order;
    order.id        = generateOrderId();
    order.userId    = userId;
    order.symbol    = symbol;
    order.type      = "BUY";
    order.orderType = orderType;
    order.shares    = shares;
    order.price     = price;
    order.total     = cost;
    order.status    = "FILLED";
    order.timestamp = getCurrentTimestamp();

    auto& db = MongoManager::getInstance();

    if (db.isConnected()) {
        // Save order
        auto orderDoc = make_document(
            kvp("userId",    userId),
            kvp("symbol",    symbol),
            kvp("type",      std::string("BUY")),
            kvp("orderType", orderType),
            kvp("shares",    shares),
            kvp("price",     price),
            kvp("total",     cost),
            kvp("status",    std::string("FILLED")),
            kvp("timestamp", order.timestamp)
        );
        db.insertOne(COL_ORDERS, orderDoc);

        // Update or create portfolio holding
        auto existingHolding = db.findOne(
            COL_PORTFOLIOS,
            make_document(kvp("userId", userId), kvp("symbol", symbol))
        );

        if (existingHolding) {
            int    existing_shares   = (*existingHolding)["shares"].get<int>();
            double existing_avgPrice = (*existingHolding)["avgPrice"].get<double>();
            double totalCost         = existing_shares * existing_avgPrice + cost;
            int    newShares         = existing_shares + shares;
            double newAvgPrice       = totalCost / newShares;

            db.updateOne(
                COL_PORTFOLIOS,
                make_document(kvp("userId", userId), kvp("symbol", symbol)),
                make_document(kvp("$set", make_document(
                    kvp("shares",    newShares),
                    kvp("avgPrice",  newAvgPrice),
                    kvp("updatedAt", order.timestamp)
                )))
            );
        } else {
            auto holdingDoc = make_document(
                kvp("userId",    userId),
                kvp("symbol",    symbol),
                kvp("shares",    shares),
                kvp("avgPrice",  price),
                kvp("updatedAt", order.timestamp)
            );
            db.insertOne(COL_PORTFOLIOS, holdingDoc);
        }
    } else {
        // In-memory path
        {
            std::lock_guard<std::mutex> lock(orderMutex_);
            inMemoryOrders_[userId].insert(inMemoryOrders_[userId].begin(), order);
        }
        {
            std::lock_guard<std::mutex> lock(portfolioMutex_);
            auto& portfolio = inMemoryPortfolios_[userId];
            auto it = std::find_if(portfolio.begin(), portfolio.end(),
                [&](const Holding& h) { return h.symbol == symbol; });

            if (it != portfolio.end()) {
                double totalCost = it->shares * it->avgPrice + cost;
                it->shares      += shares;
                it->avgPrice     = totalCost / it->shares;
                it->updatedAt    = order.timestamp;
            } else {
                Holding h;
                h.userId    = userId;
                h.symbol    = symbol;
                h.shares    = shares;
                h.avgPrice  = price;
                h.updatedAt = order.timestamp;
                portfolio.push_back(h);
            }
        }
    }

    return json{
        {"order",      order.toJSON()},
        {"newBalance", newBalance},
        {"message",    "Buy order filled: " + std::to_string(shares) + " " + symbol
                        + " @ $" + std::to_string(price)}
    };
}

// ===================================================================
// PLACE SELL ORDER
// ===================================================================
json TradingController::placeSellOrder(
    const std::string& userId,
    const std::string& symbol,
    int    shares,
    double price,
    const std::string& orderType)
{
    if (shares <= 0) throw std::runtime_error("Shares must be positive");
    if (price  <= 0) throw std::runtime_error("Price must be positive");

    double proceeds = shares * price;

    auto& db = MongoManager::getInstance();

    if (db.isConnected()) {
        auto holdingOpt = db.findOne(
            COL_PORTFOLIOS,
            make_document(kvp("userId", userId), kvp("symbol", symbol))
        );
        if (!holdingOpt) throw std::runtime_error("You do not own " + symbol);

        int ownedShares = (*holdingOpt)["shares"].get<int>();
        if (ownedShares < shares)
            throw std::runtime_error("Only " + std::to_string(ownedShares)
                                     + " shares available to sell");

        // Update portfolio
        int newShares = ownedShares - shares;
        if (newShares == 0) {
            db.deleteOne(COL_PORTFOLIOS,
                make_document(kvp("userId", userId), kvp("symbol", symbol)));
        } else {
            db.updateOne(
                COL_PORTFOLIOS,
                make_document(kvp("userId", userId), kvp("symbol", symbol)),
                make_document(kvp("$set", make_document(
                    kvp("shares",    newShares),
                    kvp("updatedAt", getCurrentTimestamp())
                )))
            );
        }

        // Credit balance
        auto userOpt = AuthController::getUserById(userId);
        double newBalance = (userOpt ? userOpt->balance : 0.0) + proceeds;
        AuthController::updateBalance(userId, newBalance);

        // Save order
        Order order;
        order.id        = generateOrderId();
        order.userId    = userId;
        order.symbol    = symbol;
        order.type      = "SELL";
        order.orderType = orderType;
        order.shares    = shares;
        order.price     = price;
        order.total     = proceeds;
        order.status    = "FILLED";
        order.timestamp = getCurrentTimestamp();

        auto orderDoc = make_document(
            kvp("userId",    userId),
            kvp("symbol",    symbol),
            kvp("type",      std::string("SELL")),
            kvp("orderType", orderType),
            kvp("shares",    shares),
            kvp("price",     price),
            kvp("total",     proceeds),
            kvp("status",    std::string("FILLED")),
            kvp("timestamp", order.timestamp)
        );
        db.insertOne(COL_ORDERS, orderDoc);

        return json{
            {"order",      order.toJSON()},
            {"newBalance", newBalance},
            {"message",    "Sell order filled: " + std::to_string(shares) + " "
                           + symbol + " @ $" + std::to_string(price)}
        };
    } else {
        // In-memory path
        {
            std::lock_guard<std::mutex> lock(portfolioMutex_);
            auto& portfolio = inMemoryPortfolios_[userId];
            auto it = std::find_if(portfolio.begin(), portfolio.end(),
                [&](const Holding& h) { return h.symbol == symbol; });

            if (it == portfolio.end())
                throw std::runtime_error("You do not own " + symbol);
            if (it->shares < shares)
                throw std::runtime_error("Only " + std::to_string(it->shares)
                                         + " shares available");

            it->shares -= shares;
            if (it->shares == 0) portfolio.erase(it);
        }

        auto userOpt  = AuthController::getUserById(userId);
        double newBal = (userOpt ? userOpt->balance : 0.0) + proceeds;
        AuthController::updateBalance(userId, newBal);

        Order order;
        order.id        = generateOrderId();
        order.userId    = userId;
        order.symbol    = symbol;
        order.type      = "SELL";
        order.orderType = orderType;
        order.shares    = shares;
        order.price     = price;
        order.total     = proceeds;
        order.status    = "FILLED";
        order.timestamp = getCurrentTimestamp();

        {
            std::lock_guard<std::mutex> lock(orderMutex_);
            inMemoryOrders_[userId].insert(inMemoryOrders_[userId].begin(), order);
        }

        return json{
            {"order",      order.toJSON()},
            {"newBalance", newBal},
            {"message",    "Sell order filled"}
        };
    }
}

// ===================================================================
// GET ORDER HISTORY
// ===================================================================
json TradingController::getOrderHistory(
    const std::string& userId, int limit, int offset)
{
    json result = json::array();
    auto& db    = MongoManager::getInstance();

    if (db.isConnected()) {
        auto orders = db.findMany(
            COL_ORDERS,
            make_document(kvp("userId", userId)),
            limit, offset
        );
        for (auto& o : orders) result.push_back(o);
    } else {
        std::lock_guard<std::mutex> lock(orderMutex_);
        auto it = inMemoryOrders_.find(userId);
        if (it != inMemoryOrders_.end()) {
            int start = std::min(offset, (int)it->second.size());
            int end   = std::min(start + limit, (int)it->second.size());
            for (int i = start; i < end; ++i)
                result.push_back(it->second[i].toJSON());
        }
    }
    return result;
}

} // namespace NexTrade
