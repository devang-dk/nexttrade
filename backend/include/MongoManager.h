#pragma once
// =====================================================================
// MongoManager.h — MongoDB connection pool and CRUD helpers
// =====================================================================

#include <mongocxx/client.hpp>
#include <mongocxx/instance.hpp>
#include <mongocxx/pool.hpp>
#include <mongocxx/uri.hpp>
#include <bsoncxx/json.hpp>
#include <bsoncxx/builder/stream/document.hpp>
#include <bsoncxx/builder/basic/document.hpp>
#include <bsoncxx/builder/basic/kvp.hpp>
#include <bsoncxx/types.hpp>
#include <optional>
#include <string>
#include <vector>
#include <memory>
#include <stdexcept>
#include <nlohmann/json.hpp>

using json   = nlohmann::json;
using bsoncxx::builder::basic::kvp;
using bsoncxx::builder::basic::make_document;

namespace NexTrade {

class MongoManager {
public:
    static MongoManager& getInstance();

    // Connect to MongoDB (call once at startup)
    void connect(const std::string& uri, const std::string& dbName);

    // ===== CRUD Helpers =====

    // Insert a document, returns the inserted _id as string
    std::string insertOne(const std::string& collection, const bsoncxx::document::value& doc);

    // Find a single document by filter, returns optional json
    std::optional<json> findOne(const std::string& collection, const bsoncxx::document::value& filter);

    // Find many documents by filter, returns vector of json
    std::vector<json> findMany(const std::string& collection,
                               const bsoncxx::document::value& filter,
                               int limit  = 100,
                               int skip   = 0);

    // Update one document, returns modified count
    long updateOne(const std::string& collection,
                   const bsoncxx::document::value& filter,
                   const bsoncxx::document::value& update,
                   bool upsert = false);

    // Delete one document
    long deleteOne(const std::string& collection, const bsoncxx::document::value& filter);

    // Check if connected
    bool isConnected() const { return connected_; }

    // Helper: bson document to json
    static json bsonToJson(const bsoncxx::document::view& view);

private:
    MongoManager() = default;
    ~MongoManager() = default;
    MongoManager(const MongoManager&) = delete;
    MongoManager& operator=(const MongoManager&) = delete;

    std::unique_ptr<mongocxx::instance> instance_;
    std::unique_ptr<mongocxx::pool>     pool_;
    std::string                         dbName_;
    bool                                connected_ = false;
};

} // namespace NexTrade
