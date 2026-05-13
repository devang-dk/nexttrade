#pragma once
// =====================================================================
// AuthController.h — User registration, login, and JWT management
// =====================================================================

#include "Common.h"
#include <string>
#include <tuple>

namespace NexTrade {

class AuthController {
public:
    // Register a new user — returns (JWT token, User)
    static std::pair<std::string, User> registerUser(
        const std::string& name,
        const std::string& email,
        const std::string& password
    );

    // Login existing user — returns (JWT token, User)
    static std::pair<std::string, User> loginUser(
        const std::string& email,
        const std::string& password
    );

    // Verify JWT token — returns (userId, email) or throws
    static std::pair<std::string, std::string> verifyToken(const std::string& token);

    // Fetch user by ID
    static std::optional<User> getUserById(const std::string& userId);

    // Update user balance
    static bool updateBalance(const std::string& userId, double newBalance);

private:
    static std::string hashPassword(const std::string& password);
    static bool        verifyPassword(const std::string& password, const std::string& hash);
    static std::string generateToken(const std::string& userId, const std::string& email);
    static std::string generateId();

    // In-memory user store (fallback when MongoDB not available)
    static std::map<std::string, User> inMemoryUsers_;
    static std::mutex                  usersMutex_;
};

} // namespace NexTrade
