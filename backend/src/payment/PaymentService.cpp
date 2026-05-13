// =====================================================================
// PaymentService.cpp — Mock payment processing with MongoDB persistence
// =====================================================================

#include "payment/PaymentService.h"
#include "auth/AuthController.h"
#include "db/MongoManager.h"
#include <bsoncxx/builder/basic/document.hpp>
#include <bsoncxx/builder/basic/kvp.hpp>
#include <bsoncxx/oid.hpp>
#include <stdexcept>
#include <iostream>
#include <mutex>
#include <map>
#include <thread>
#include <chrono>

using bsoncxx::builder::basic::kvp;
using bsoncxx::builder::basic::make_document;

namespace NexTrade {

// Static member definitions
std::map<std::string, std::vector<Transaction>> PaymentService::inMemoryTransactions_;
std::mutex PaymentService::txMutex_;

std::string PaymentService::generateTransactionId() {
    return "txn_" + bsoncxx::oid{}.to_string();
}

void PaymentService::saveTransaction(const Transaction& tx) {
    auto& db = MongoManager::getInstance();

    if (db.isConnected()) {
        auto doc = make_document(
            kvp("userId",    tx.userId),
            kvp("type",      tx.type),
            kvp("amount",    tx.amount),
            kvp("status",    tx.status),
            kvp("paymentId", tx.paymentId),
            kvp("last4",     tx.last4),
            kvp("timestamp", tx.timestamp)
        );
        db.insertOne(COL_TRANSACTIONS, doc);
    } else {
        std::lock_guard<std::mutex> lock(txMutex_);
        inMemoryTransactions_[tx.userId].insert(
            inMemoryTransactions_[tx.userId].begin(), tx);
    }
}

// ===================================================================
// DEPOSIT
// ===================================================================
json PaymentService::deposit(
    const std::string& userId,
    double amount,
    const std::string& cardNumber)
{
    // === Mock payment processing delay ===
    // In production, this would call Stripe API:
    // stripe::PaymentIntent::create({ amount: (int)(amount*100), currency: "usd" });
    std::this_thread::sleep_for(std::chrono::milliseconds(400));

    // Fetch current user
    auto userOpt = AuthController::getUserById(userId);
    if (!userOpt) throw std::runtime_error("User not found");

    // Credit balance
    double newBalance = userOpt->balance + amount;
    if (!AuthController::updateBalance(userId, newBalance))
        throw std::runtime_error("Failed to update balance");

    // Record transaction
    Transaction tx;
    tx.id        = generateTransactionId();
    tx.userId    = userId;
    tx.type      = "DEPOSIT";
    tx.amount    = amount;
    tx.status    = "SUCCESS";
    tx.paymentId = "mock_pi_" + tx.id;
    tx.last4     = cardNumber.size() >= 4
                   ? cardNumber.substr(cardNumber.size() - 4)
                   : "****";
    tx.timestamp = getCurrentTimestamp();

    saveTransaction(tx);

    std::cout << "[Payment] Deposit: userId=" << userId
              << " amount=$" << amount
              << " newBalance=$" << newBalance << std::endl;

    return json{
        {"transaction", tx.toJSON()},
        {"newBalance",  newBalance},
        {"message",     "Deposit of $" + std::to_string(amount)
                        + " processed successfully"}
    };
}

// ===================================================================
// WITHDRAW
// ===================================================================
json PaymentService::withdraw(const std::string& userId, double amount) {
    // Mock processing delay
    std::this_thread::sleep_for(std::chrono::milliseconds(350));

    auto userOpt = AuthController::getUserById(userId);
    if (!userOpt) throw std::runtime_error("User not found");
    if (userOpt->balance < amount)
        throw std::runtime_error(
            "Insufficient funds. Available: $" + std::to_string(userOpt->balance));

    double newBalance = userOpt->balance - amount;
    if (!AuthController::updateBalance(userId, newBalance))
        throw std::runtime_error("Failed to update balance");

    Transaction tx;
    tx.id        = generateTransactionId();
    tx.userId    = userId;
    tx.type      = "WITHDRAWAL";
    tx.amount    = amount;
    tx.status    = "PENDING";  // Withdrawals are pending until processed
    tx.paymentId = "mock_po_" + tx.id;
    tx.last4     = "";
    tx.timestamp = getCurrentTimestamp();

    saveTransaction(tx);

    std::cout << "[Payment] Withdrawal: userId=" << userId
              << " amount=$" << amount
              << " newBalance=$" << newBalance << std::endl;

    return json{
        {"transaction", tx.toJSON()},
        {"newBalance",  newBalance},
        {"message",     "Withdrawal of $" + std::to_string(amount)
                        + " initiated. Arrives in 1-3 business days."}
    };
}

// ===================================================================
// TRANSACTION HISTORY
// ===================================================================
json PaymentService::getTransactionHistory(
    const std::string& userId, int limit, int offset)
{
    json result  = json::array();
    auto& db     = MongoManager::getInstance();

    if (db.isConnected()) {
        auto txs = db.findMany(
            COL_TRANSACTIONS,
            make_document(kvp("userId", userId)),
            limit, offset
        );
        for (auto& t : txs) result.push_back(t);
    } else {
        std::lock_guard<std::mutex> lock(txMutex_);
        auto it = inMemoryTransactions_.find(userId);
        if (it != inMemoryTransactions_.end()) {
            int start = std::min(offset, (int)it->second.size());
            int end   = std::min(start + limit, (int)it->second.size());
            for (int i = start; i < end; ++i)
                result.push_back(it->second[i].toJSON());
        }
    }
    return result;
}

} // namespace NexTrade
