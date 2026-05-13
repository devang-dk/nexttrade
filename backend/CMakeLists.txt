cmake_minimum_required(VERSION 3.16)
project(NexTrade VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# vcpkg toolchain — set VCPKG_ROOT env or pass -DCMAKE_TOOLCHAIN_FILE
if(DEFINED ENV{VCPKG_ROOT})
  set(CMAKE_TOOLCHAIN_FILE "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake"
      CACHE STRING "vcpkg toolchain")
endif()

# ===== Find Packages =====
find_package(Crow CONFIG REQUIRED)
find_package(mongocxx CONFIG REQUIRED)
find_package(bsoncxx CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
find_package(CURL CONFIG REQUIRED)
find_package(OpenSSL REQUIRED)

# ===== Source Files =====
file(GLOB_RECURSE SOURCES
  "src/*.cpp"
  "src/**/*.cpp"
)

add_executable(nextrade ${SOURCES})

# ===== Include Directories =====
target_include_directories(nextrade PRIVATE
  ${CMAKE_SOURCE_DIR}/include
)

# ===== Link Libraries =====
target_link_libraries(nextrade PRIVATE
  Crow::Crow
  mongo::mongocxx_shared
  mongo::bsoncxx_shared
  nlohmann_json::nlohmann_json
  CURL::libcurl
  OpenSSL::SSL
  OpenSSL::Crypto
)

# ===== Compile Options =====
if(MSVC)
  target_compile_options(nextrade PRIVATE /W3 /O2)
else()
  target_compile_options(nextrade PRIVATE -Wall -Wextra -O2)
endif()

# ===== Copy frontend assets to build dir =====
add_custom_command(TARGET nextrade POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory
    "${CMAKE_SOURCE_DIR}/../frontend"
    "${CMAKE_BINARY_DIR}/frontend"
  COMMENT "Copying frontend files..."
)

message(STATUS "NexTrade C++ Backend configured.")
message(STATUS "  C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "  Build Type:   ${CMAKE_BUILD_TYPE}")
