#pragma once
// =====================================================================
// TradingController.h — Buy/Sell orders and portfolio management
// =====================================================================

#include "Common.h"
#include <string>
#include <vector>

namespace NexTrade {

class TradingController {
public:
    // Get user's current holdings
    static json getPortfolio(const std::string& userId);

    // Place a buy order
    static json placeBuyOrder(
        const std::string& userId,
        const std::string& symbol,
        int    shares,
        double price,
        const std::string& orderType = "market"
    );

    // Place a sell order
    static json placeSellOrder(
        const std::string& userId,
        const std::string& symbol,
        int    shares,
        double price,
        const std::string& orderType = "market"
    );

    // Get order history
    static json getOrderHistory(
        const std::string& userId,
        int limit  = 50,
        int offset = 0
    );

private:
    static std::string generateOrderId();

    // In-memory stores (fallback when MongoDB unavailable)
    static std::map<std::string, std::vector<Holding>>  inMemoryPortfolios_;
    static std::map<std::string, std::vector<Order>>    inMemoryOrders_;
    static std::mutex portfolioMutex_;
    static std::mutex orderMutex_;
};

} // namespace NexTrade
