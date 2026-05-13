// =====================================================================
// main.cpp — NexTrade C++ Backend Entry Point
// Crow HTTP Framework + MongoDB + WebSocket
// =====================================================================

#include <crow.h>
#include <crow/middlewares/cors.h>
#include <iostream>
#include <thread>
#include <atomic>
#include <mutex>
#include <set>
#include "Common.h"
#include "db/MongoManager.h"
#include "auth/AuthController.h"
#include "trading/TradingController.h"
#include "market/MarketDataService.h"
#include "payment/PaymentService.h"

using namespace NexTrade;

// ===== Global WebSocket connection set =====
std::mutex wsMutex;
std::set<crow::websocket::connection*> wsConnections;

// ===== JWT Middleware =====
struct JwtMiddleware {
    struct context {
        std::string userId;
        std::string userEmail;
        bool        authenticated = false;
    };

    void before_handle(crow::request& req, crow::response& res, context& ctx) {
        auto authHeader = req.get_header_value("Authorization");
        if (authHeader.empty() || authHeader.substr(0, 7) != "Bearer ") return;
        
        std::string token = authHeader.substr(7);
        try {
            auto [userId, email] = AuthController::verifyToken(token);
            ctx.userId        = userId;
            ctx.userEmail     = email;
            ctx.authenticated = true;
        } catch (...) {
            // Invalid token — context.authenticated remains false
        }
    }

    void after_handle(crow::request&, crow::response&, context&) {}
};

// ===== Require Auth Helper =====
#define REQUIRE_AUTH(ctx) \
    if (!(ctx).authenticated) { \
        return crow::response(401, errorResponse("Unauthorized — please log in", 401).dump()); \
    }

int main() {
    std::cout << R"(
  _   _          _____              _      
 | \ | |   ___  |_   _|  _ __   __ _ __| | ___ 
 |  \| |  / _ \   | |   | '__| / _` |/ _` |/ _ \
 | |\  | |  __/   | |   | |   | (_| | (_| |  __/
 |_| \_|  \___|   |_|   |_|    \__,_|\__,_|\___|
 Stock Trading Platform — C++ Backend v1.0
    )" << std::endl;

    // ===== Init MongoDB =====
    try {
        MongoManager::getInstance().connect(DB_CONNECTION_URI, DB_NAME);
        std::cout << "[✓] MongoDB connected: " << DB_CONNECTION_URI << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "[!] MongoDB connection failed: " << e.what() << std::endl;
        std::cerr << "    Running without persistence (demo mode)" << std::endl;
    }

    // ===== Init Crow App =====
    crow::App<crow::CORSHandler, JwtMiddleware> app;

    // Configure CORS
    auto& cors = app.get_middleware<crow::CORSHandler>();
    cors.global()
        .headers("Content-Type", "Authorization")
        .methods("GET"_method, "POST"_method, "PUT"_method, "DELETE"_method, "OPTIONS"_method)
        .origin("*");

    // =========================================================
    // ===== HEALTH CHECK =====
    // =========================================================
    CROW_ROUTE(app, "/health")([]() {
        return crow::response(200, json{
            {"status",  "ok"},
            {"service", "NexTrade API"},
            {"version", "1.0.0"},
            {"time",    getCurrentTimestamp()}
        }.dump());
    });

    // =========================================================
    // ===== AUTH ROUTES =====
    // =========================================================

    // POST /api/auth/register
    CROW_ROUTE(app, "/api/auth/register").methods("POST"_method)(
    [](const crow::request& req) {
        try {
            auto body = json::parse(req.body);
            std::string name     = body.at("name").get<std::string>();
            std::string email    = body.at("email").get<std::string>();
            std::string password = body.at("password").get<std::string>();

            if (name.empty() || email.empty() || password.empty())
                return crow::response(400, errorResponse("All fields are required").dump());
            if (password.size() < 8)
                return crow::response(400, errorResponse("Password must be at least 8 characters").dump());

            auto [token, user] = AuthController::registerUser(name, email, password);
            auto resp = json{
                {"token", token},
                {"user",  user.toJSON()}
            };
            return crow::response(201, resp.dump());

        } catch (const json::exception& e) {
            return crow::response(400, errorResponse("Invalid request body").dump());
        } catch (const std::exception& e) {
            return crow::response(400, errorResponse(e.what()).dump());
        }
    });

    // POST /api/auth/login
    CROW_ROUTE(app, "/api/auth/login").methods("POST"_method)(
    [](const crow::request& req) {
        try {
            auto body = json::parse(req.body);
            std::string email    = body.at("email").get<std::string>();
            std::string password = body.at("password").get<std::string>();

            auto [token, user] = AuthController::loginUser(email, password);
            auto resp = json{
                {"token", token},
                {"user",  user.toJSON()}
            };
            return crow::response(200, resp.dump());

        } catch (const std::exception& e) {
            return crow::response(401, errorResponse(e.what(), 401).dump());
        }
    });

    // =========================================================
    // ===== MARKET DATA ROUTES =====
    // =========================================================

    // GET /api/market/quote/:symbol
    CROW_ROUTE(app, "/api/market/quote/<string>")(
    [](const crow::request& req, const std::string& symbol) {
        try {
            auto quote = MarketDataService::getQuote(symbol);
            return crow::response(200, quote.toJSON().dump());
        } catch (const std::exception& e) {
            return crow::response(500, errorResponse(e.what()).dump());
        }
    });

    // GET /api/market/history/:symbol?interval=1M
    CROW_ROUTE(app, "/api/market/history/<string>")(
    [](const crow::request& req, const std::string& symbol) {
        std::string interval = req.url_params.get("interval") 
                             ? req.url_params.get("interval") 
                             : "1M";
        try {
            auto bars = MarketDataService::getHistory(symbol, interval);
            json arr = json::array();
            for (auto& b : bars) arr.push_back(b.toJSON());
            return crow::response(200, arr.dump());
        } catch (const std::exception& e) {
            return crow::response(500, errorResponse(e.what()).dump());
        }
    });

    // GET /api/market/search?q=APPL
    CROW_ROUTE(app, "/api/market/search")(
    [](const crow::request& req) {
        std::string query = req.url_params.get("q") ? req.url_params.get("q") : "";
        try {
            auto results = MarketDataService::search(query);
            return crow::response(200, results.dump());
        } catch (const std::exception& e) {
            return crow::response(500, errorResponse(e.what()).dump());
        }
    });

    // GET /api/market/movers
    CROW_ROUTE(app, "/api/market/movers")(
    [](const crow::request& req) {
        try {
            auto movers = MarketDataService::getMarketMovers();
            return crow::response(200, movers.dump());
        } catch (const std::exception& e) {
            return crow::response(500, errorResponse(e.what()).dump());
        }
    });

    // =========================================================
    // ===== PORTFOLIO ROUTES (Protected) =====
    // =========================================================

    // GET /api/portfolio
    CROW_ROUTE(app, "/api/portfolio")(
    [&app](const crow::request& req) {
        auto& ctx = app.get_context<JwtMiddleware>(req);
        REQUIRE_AUTH(ctx);
        try {
            auto holdings = TradingController::getPortfolio(ctx.userId);
            return crow::response(200, holdings.dump());
        } catch (const std::exception& e) {
            return crow::response(500, errorResponse(e.what()).dump());
        }
    });

    // POST /api/orders/buy
    CROW_ROUTE(app, "/api/orders/buy").methods("POST"_method)(
    [&app](const crow::request& req) {
        auto& ctx = app.get_context<JwtMiddleware>(req);
        REQUIRE_AUTH(ctx);
        try {
            auto body   = json::parse(req.body);
            std::string symbol = body.at("symbol").get<std::string>();
            int    shares     = body.at("shares").get<int>();
            double price      = body.at("price").get<double>();
            std::string type  = body.value("orderType", "market");

            auto result = TradingController::placeBuyOrder(ctx.userId, symbol, shares, price, type);
            return crow::response(200, result.dump());
        } catch (const std::exception& e) {
            return crow::response(400, errorResponse(e.what()).dump());
        }
    });

    // POST /api/orders/sell
    CROW_ROUTE(app, "/api/orders/sell").methods("POST"_method)(
    [&app](const crow::request& req) {
        auto& ctx = app.get_context<JwtMiddleware>(req);
        REQUIRE_AUTH(ctx);
        try {
            auto body   = json::parse(req.body);
            std::string symbol = body.at("symbol").get<std::string>();
            int    shares     = body.at("shares").get<int>();
            double price      = body.at("price").get<double>();
            std::string type  = body.value("orderType", "market");

            auto result = TradingController::placeSellOrder(ctx.userId, symbol, shares, price, type);
            return crow::response(200, result.dump());
        } catch (const std::exception& e) {
            return crow::response(400, errorResponse(e.what()).dump());
        }
    });

    // GET /api/orders/history
    CROW_ROUTE(app, "/api/orders/history")(
    [&app](const crow::request& req) {
        auto& ctx = app.get_context<JwtMiddleware>(req);
        REQUIRE_AUTH(ctx);
        try {
            int limit  = req.url_params.get("limit") ? std::stoi(req.url_params.get("limit")) : 50;
            int offset = req.url_params.get("offset") ? std::stoi(req.url_params.get("offset")) : 0;
            auto orders = TradingController::getOrderHistory(ctx.userId, limit, offset);
            return crow::response(200, orders.dump());
        } catch (const std::exception& e) {
            return crow::response(500, errorResponse(e.what()).dump());
        }
    });

    // =========================================================
    // ===== PAYMENT ROUTES (Protected) =====
    // =========================================================

    // POST /api/payment/deposit
    CROW_ROUTE(app, "/api/payment/deposit").methods("POST"_method)(
    [&app](const crow::request& req) {
        auto& ctx = app.get_context<JwtMiddleware>(req);
        REQUIRE_AUTH(ctx);
        try {
            auto body   = json::parse(req.body);
            double amount = body.at("amount").get<double>();
            std::string card = body.value("cardNumber", "");

            if (amount < 10.0)  throw std::runtime_error("Minimum deposit is $10.00");
            if (amount > 100000) throw std::runtime_error("Maximum deposit is $100,000");

            auto result = PaymentService::deposit(ctx.userId, amount, card);
            return crow::response(200, result.dump());
        } catch (const std::exception& e) {
            return crow::response(400, errorResponse(e.what()).dump());
        }
    });

    // POST /api/payment/withdraw
    CROW_ROUTE(app, "/api/payment/withdraw").methods("POST"_method)(
    [&app](const crow::request& req) {
        auto& ctx = app.get_context<JwtMiddleware>(req);
        REQUIRE_AUTH(ctx);
        try {
            auto body   = json::parse(req.body);
            double amount = body.at("amount").get<double>();

            if (amount < 10.0) throw std::runtime_error("Minimum withdrawal is $10.00");
            auto result = PaymentService::withdraw(ctx.userId, amount);
            return crow::response(200, result.dump());
        } catch (const std::exception& e) {
            return crow::response(400, errorResponse(e.what()).dump());
        }
    });

    // GET /api/payment/history
    CROW_ROUTE(app, "/api/payment/history")(
    [&app](const crow::request& req) {
        auto& ctx = app.get_context<JwtMiddleware>(req);
        REQUIRE_AUTH(ctx);
        try {
            auto txs = PaymentService::getTransactionHistory(ctx.userId);
            return crow::response(200, txs.dump());
        } catch (const std::exception& e) {
            return crow::response(500, errorResponse(e.what()).dump());
        }
    });

    // =========================================================
    // ===== WEBSOCKET — Real-time Price Stream =====
    // =========================================================
    CROW_WEBSOCKET_ROUTE(app, "/ws/prices")
        .onopen([](crow::websocket::connection& conn) {
            std::lock_guard<std::mutex> lock(wsMutex);
            wsConnections.insert(&conn);
            std::cout << "[WS] Client connected. Total: " << wsConnections.size() << std::endl;
        })
        .onclose([](crow::websocket::connection& conn, const std::string&) {
            std::lock_guard<std::mutex> lock(wsMutex);
            wsConnections.erase(&conn);
            std::cout << "[WS] Client disconnected. Total: " << wsConnections.size() << std::endl;
        })
        .onmessage([](crow::websocket::connection& conn, const std::string& data, bool) {
            // Client can send {"action":"subscribe","symbols":["AAPL","TSLA"]}
            try {
                auto msg = json::parse(data);
                if (msg.value("action", "") == "ping") {
                    conn.send_text(json{{"action", "pong"}}.dump());
                }
            } catch (...) {}
        });

    // ===== Background thread: broadcast prices every 2 seconds =====
    std::atomic<bool> running{true};
    std::thread priceBroadcaster([&running]() {
        const std::vector<std::string> symbols = {
            "AAPL","TSLA","NVDA","MSFT","GOOGL","AMZN","META","NFLX","AMD","DIS"
        };
        static std::map<std::string, double> prices = {
            {"AAPL",189.45},{"TSLA",248.72},{"NVDA",912.30},{"MSFT",415.18},
            {"GOOGL",174.50},{"AMZN",193.25},{"META",513.80},{"NFLX",635.40},
            {"AMD",178.60},{"DIS",112.45}
        };

        while (running) {
            std::this_thread::sleep_for(std::chrono::seconds(2));
            if (wsConnections.empty()) continue;

            json updates = json::array();
            for (auto& sym : symbols) {
                double change = ((double)rand() / RAND_MAX - 0.5) * 0.4;
                prices[sym]   = std::max(0.01, prices[sym] + change);
                double pct    = change / prices[sym] * 100;
                updates.push_back({
                    {"symbol", sym},
                    {"price",  std::round(prices[sym] * 100) / 100.0},
                    {"change", std::round(pct * 100) / 100.0}
                });
            }

            std::string payload = updates.dump();
            std::lock_guard<std::mutex> lock(wsMutex);
            for (auto* conn : wsConnections) {
                try { conn->send_text(payload); } catch (...) {}
            }
        }
    });

    // ===== Start server =====
    std::cout << "[✓] NexTrade API running on port " << SERVER_PORT << std::endl;
    std::cout << "[✓] WebSocket endpoint: ws://localhost:" << SERVER_PORT << "/ws/prices" << std::endl;
    std::cout << "[✓] Frontend at: http://localhost:" << SERVER_PORT << "/index.html" << std::endl;
    std::cout << "Press Ctrl+C to stop.\n" << std::endl;

    app.port(SERVER_PORT)
       .multithreaded()
       .run();

    running = false;
    priceBroadcaster.join();
    return 0;
}
