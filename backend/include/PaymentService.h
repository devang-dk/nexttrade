#pragma once
// =====================================================================
// PaymentService.h — Mock payment gateway (Stripe-ready architecture)
// =====================================================================

#include "Common.h"
#include <string>

namespace NexTrade {

class PaymentService {
public:
    // Process a deposit — credits user balance in MongoDB
    static json deposit(
        const std::string& userId,
        double  amount,
        const std::string& cardNumberLast4 = ""
    );

    // Process a withdrawal — debits user balance
    static json withdraw(
        const std::string& userId,
        double amount
    );

    // Get transaction history for a user
    static json getTransactionHistory(
        const std::string& userId,
        int limit  = 50,
        int offset = 0
    );

private:
    static std::string generateTransactionId();
    static void        saveTransaction(const Transaction& tx);

    // In-memory fallback
    static std::map<std::string, std::vector<Transaction>> inMemoryTransactions_;
    static std::mutex txMutex_;
};

} // namespace NexTrade
