// =====================================================================
// AuthController.cpp — Registration, Login, JWT token management
// =====================================================================

#include "auth/AuthController.h"
#include "db/MongoManager.h"
#include <jwt-cpp/jwt.h>
#include <openssl/sha.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <bsoncxx/builder/basic/document.hpp>
#include <bsoncxx/builder/basic/kvp.hpp>
#include <bsoncxx/oid.hpp>
#include <sstream>
#include <iomanip>
#include <regex>
#include <mutex>
#include <map>
#include <stdexcept>
#include <iostream>

using bsoncxx::builder::basic::kvp;
using bsoncxx::builder::basic::make_document;

namespace NexTrade {

// Static member definitions
std::map<std::string, User> AuthController::inMemoryUsers_;
std::mutex                  AuthController::usersMutex_;

// ===================================================================
// HELPERS
// ===================================================================

std::string AuthController::generateId() {
    return bsoncxx::oid{}.to_string();
}

// Simple SHA-256 + salt password hashing
// In production: use bcrypt or argon2
std::string AuthController::hashPassword(const std::string& password) {
    // Generate a random 16-byte salt
    unsigned char salt[16];
    RAND_bytes(salt, sizeof(salt));

    // Concatenate salt + password
    std::string salted;
    for (int i = 0; i < 16; ++i)
        salted += static_cast<char>(salt[i]);
    salted += password;

    // SHA-256
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char*>(salted.c_str()), salted.size(), hash);

    // Encode as hex: saltHex$hashHex
    auto toHex = [](const unsigned char* data, size_t len) {
        std::ostringstream oss;
        for (size_t i = 0; i < len; ++i)
            oss << std::hex << std::setw(2) << std::setfill('0') << (int)data[i];
        return oss.str();
    };

    return toHex(salt, 16) + "$" + toHex(hash, SHA256_DIGEST_LENGTH);
}

bool AuthController::verifyPassword(const std::string& password, const std::string& storedHash) {
    auto dollarPos = storedHash.find('$');
    if (dollarPos == std::string::npos) return false;

    // Decode salt from hex
    std::string saltHex = storedHash.substr(0, dollarPos);
    unsigned char salt[16];
    for (int i = 0; i < 16; ++i) {
        salt[i] = static_cast<unsigned char>(std::stoi(saltHex.substr(i*2, 2), nullptr, 16));
    }

    // Reconstruct hash
    std::string salted;
    for (int i = 0; i < 16; ++i) salted += static_cast<char>(salt[i]);
    salted += password;

    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char*>(salted.c_str()), salted.size(), hash);

    std::ostringstream oss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; ++i)
        oss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];

    return oss.str() == storedHash.substr(dollarPos + 1);
}

std::string AuthController::generateToken(const std::string& userId, const std::string& email) {
    auto now     = std::chrono::system_clock::now();
    auto expires = now + std::chrono::hours(JWT_EXPIRY_HOURS);

    return jwt::create()
        .set_issuer("NexTrade")
        .set_subject(userId)
        .set_payload_claim("email", jwt::claim(email))
        .set_issued_at(now)
        .set_expires_at(expires)
        .sign(jwt::algorithm::hs256{JWT_SECRET});
}

// ===================================================================
// PUBLIC METHODS
// ===================================================================

std::pair<std::string, User> AuthController::registerUser(
    const std::string& name,
    const std::string& email,
    const std::string& password)
{
    // Validate email format
    std::regex emailRegex(R"([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})");
    if (!std::regex_match(email, emailRegex))
        throw std::runtime_error("Invalid email address format");

    // Check if MongoDB is available
    auto& db = MongoManager::getInstance();

    if (db.isConnected()) {
        // Check for existing user
        auto existing = db.findOne(COL_USERS, make_document(kvp("email", email)));
        if (existing) throw std::runtime_error("Email already registered");

        // Create user document
        std::string userId    = generateId();
        std::string pwHash    = hashPassword(password);
        std::string timestamp = getCurrentTimestamp();

        auto userDoc = make_document(
            kvp("_id",          bsoncxx::oid{bsoncxx::stdx::string_view{userId}}),
            kvp("name",         name),
            kvp("email",        email),
            kvp("passwordHash", pwHash),
            kvp("balance",      STARTING_BALANCE),
            kvp("createdAt",    timestamp)
        );

        db.insertOne(COL_USERS, userDoc);

        User user;
        user.id           = userId;
        user.name         = name;
        user.email        = email;
        user.passwordHash = pwHash;
        user.balance      = STARTING_BALANCE;
        user.createdAt    = timestamp;

        std::string token = generateToken(userId, email);
        return {token, user};
    } else {
        // In-memory fallback
        std::lock_guard<std::mutex> lock(usersMutex_);

        for (auto& [id, u] : inMemoryUsers_) {
            if (u.email == email) throw std::runtime_error("Email already registered");
        }

        User user;
        user.id           = generateId();
        user.name         = name;
        user.email        = email;
        user.passwordHash = hashPassword(password);
        user.balance      = STARTING_BALANCE;
        user.createdAt    = getCurrentTimestamp();

        inMemoryUsers_[user.id] = user;

        std::string token = generateToken(user.id, email);
        return {token, user};
    }
}

std::pair<std::string, User> AuthController::loginUser(
    const std::string& email,
    const std::string& password)
{
    auto& db = MongoManager::getInstance();

    if (db.isConnected()) {
        auto userJson = db.findOne(COL_USERS, make_document(kvp("email", email)));
        if (!userJson) throw std::runtime_error("Invalid email or password");

        std::string storedHash = (*userJson)["passwordHash"].get<std::string>();
        if (!verifyPassword(password, storedHash))
            throw std::runtime_error("Invalid email or password");

        User user;
        user.id           = (*userJson).contains("id") ? (*userJson)["id"].get<std::string>() : "";
        user.name         = (*userJson)["name"].get<std::string>();
        user.email        = (*userJson)["email"].get<std::string>();
        user.balance      = (*userJson)["balance"].get<double>();
        user.passwordHash = storedHash;
        user.createdAt    = (*userJson).contains("createdAt") ? (*userJson)["createdAt"].get<std::string>() : getCurrentTimestamp();

        std::string token = generateToken(user.id, email);
        return {token, user};
    } else {
        // In-memory fallback
        std::lock_guard<std::mutex> lock(usersMutex_);
        for (auto& [id, u] : inMemoryUsers_) {
            if (u.email == email && verifyPassword(password, u.passwordHash)) {
                std::string token = generateToken(u.id, email);
                return {token, u};
            }
        }
        throw std::runtime_error("Invalid email or password");
    }
}

std::pair<std::string, std::string> AuthController::verifyToken(const std::string& token) {
    try {
        auto decoded = jwt::decode(token);
        auto verifier = jwt::verify()
            .allow_algorithm(jwt::algorithm::hs256{JWT_SECRET})
            .with_issuer("NexTrade");

        verifier.verify(decoded);

        std::string userId = decoded.get_subject();
        std::string email  = decoded.get_payload_claim("email").as_string();
        return {userId, email};
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Invalid token: ") + e.what());
    }
}

std::optional<User> AuthController::getUserById(const std::string& userId) {
    auto& db = MongoManager::getInstance();

    if (db.isConnected()) {
        // Query by id field (which is converted from _id by MongoToJson)
        auto userJson = db.findOne(COL_USERS, make_document(kvp("_id", bsoncxx::oid{bsoncxx::stdx::string_view{userId}})));
        if (!userJson) return std::nullopt;

        User user;
        user.id      = (*userJson).contains("id") ? (*userJson)["id"].get<std::string>() : userId;
        user.name    = (*userJson)["name"].get<std::string>();
        user.email   = (*userJson)["email"].get<std::string>();
        user.balance = (*userJson)["balance"].get<double>();
        return user;
    } else {
        std::lock_guard<std::mutex> lock(usersMutex_);
        auto it = inMemoryUsers_.find(userId);
        if (it == inMemoryUsers_.end()) return std::nullopt;
        return it->second;
    }
}

bool AuthController::updateBalance(const std::string& userId, double newBalance) {
    auto& db = MongoManager::getInstance();

    if (db.isConnected()) {
        long n = db.updateOne(
            COL_USERS,
            make_document(kvp("_id", bsoncxx::oid{bsoncxx::stdx::string_view{userId}})),
            make_document(kvp("$set", make_document(kvp("balance", newBalance))))
        );
        return n > 0;
    } else {
        std::lock_guard<std::mutex> lock(usersMutex_);
        auto it = inMemoryUsers_.find(userId);
        if (it == inMemoryUsers_.end()) return false;
        it->second.balance = newBalance;
        return true;
    }
}

} // namespace NexTrade
