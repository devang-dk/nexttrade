// =====================================================================
// MongoManager.cpp — MongoDB connection pool and CRUD implementation
// =====================================================================

#include "db/MongoManager.h"
#include <iostream>
#include <sstream>
#include <bsoncxx/oid.hpp>

namespace NexTrade {

MongoManager& MongoManager::getInstance() {
    static MongoManager instance;
    return instance;
}

void MongoManager::connect(const std::string& uri, const std::string& dbName) {
    try {
        instance_ = std::make_unique<mongocxx::instance>();
        mongocxx::uri mongoUri{uri};
        pool_      = std::make_unique<mongocxx::pool>(mongoUri);
        dbName_    = dbName;
        connected_ = true;
        
        // Test connection
        auto client = pool_->acquire();
        auto db     = (*client)[dbName_];
        db.list_collections({}).begin(); // ping
        std::cout << "[MongoDB] Connected to: " << uri << "/" << dbName << std::endl;

        // Create indexes
        createIndexes();
    } catch (const std::exception& e) {
        connected_ = false;
        throw std::runtime_error(std::string("MongoDB connection failed: ") + e.what());
    }
}

void MongoManager::createIndexes() {
    auto client = pool_->acquire();
    auto db     = (*client)[dbName_];

    // users: unique index on email
    db[COL_USERS].create_index(
        make_document(kvp("email", 1)),
        mongocxx::options::index{}.unique(true)
    );

    // portfolios: compound index user+symbol
    db[COL_PORTFOLIOS].create_index(
        make_document(kvp("userId", 1), kvp("symbol", 1)),
        mongocxx::options::index{}.unique(true)
    );

    // orders: index on userId + timestamp desc
    db[COL_ORDERS].create_index(
        make_document(kvp("userId", 1), kvp("timestamp", -1))
    );

    // transactions: index on userId + timestamp desc
    db[COL_TRANSACTIONS].create_index(
        make_document(kvp("userId", 1), kvp("timestamp", -1))
    );
}

std::string MongoManager::insertOne(const std::string& collection,
                                    const bsoncxx::document::value& doc) {
    if (!connected_) throw std::runtime_error("Not connected to MongoDB");
    auto client = pool_->acquire();
    auto col    = (*client)[dbName_][collection];
    auto result = col.insert_one(doc.view());
    if (!result) throw std::runtime_error("Insert failed");
    return result->inserted_id().get_oid().value.to_string();
}

std::optional<json> MongoManager::findOne(const std::string& collection,
                                           const bsoncxx::document::value& filter) {
    if (!connected_) return std::nullopt;
    auto client = pool_->acquire();
    auto col    = (*client)[dbName_][collection];
    auto result = col.find_one(filter.view());
    if (!result) return std::nullopt;
    return bsonToJson(result->view());
}

std::vector<json> MongoManager::findMany(const std::string& collection,
                                          const bsoncxx::document::value& filter,
                                          int limit, int skip) {
    std::vector<json> results;
    if (!connected_) return results;

    auto client = pool_->acquire();
    auto col    = (*client)[dbName_][collection];

    mongocxx::options::find opts;
    if (limit > 0) opts.limit(limit);
    if (skip  > 0) opts.skip(skip);

    auto cursor = col.find(filter.view(), opts);
    for (auto& doc : cursor) {
        results.push_back(bsonToJson(doc));
    }
    return results;
}

long MongoManager::updateOne(const std::string& collection,
                              const bsoncxx::document::value& filter,
                              const bsoncxx::document::value& update,
                              bool upsert) {
    if (!connected_) return 0;
    auto client = pool_->acquire();
    auto col    = (*client)[dbName_][collection];

    mongocxx::options::update opts;
    opts.upsert(upsert);

    auto result = col.update_one(filter.view(), update.view(), opts);
    return result ? result->modified_count() : 0;
}

long MongoManager::deleteOne(const std::string& collection,
                              const bsoncxx::document::value& filter) {
    if (!connected_) return 0;
    auto client = pool_->acquire();
    auto col    = (*client)[dbName_][collection];
    auto result = col.delete_one(filter.view());
    return result ? result->deleted_count() : 0;
}

json MongoManager::bsonToJson(const bsoncxx::document::view& view) {
    // Use bsoncxx's built-in JSON serializer
    std::string jsonStr = bsoncxx::to_json(view);
    auto parsed = json::parse(jsonStr);

    // Convert $oid to plain string for id field
    if (parsed.contains("_id") && parsed["_id"].contains("$oid")) {
        parsed["id"] = parsed["_id"]["$oid"].get<std::string>();
        parsed.erase("_id");
    }
    return parsed;
}

} // namespace NexTrade
