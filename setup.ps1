# =====================================================================
# setup.ps1 — NexTrade Platform Setup Script
# Run: powershell -ExecutionPolicy Bypass -File setup.ps1
# =====================================================================

Write-Host ""
Write-Host "  _   _   ______  __   _______   ____  ____ ___  ____  ____" -ForegroundColor Cyan
Write-Host " | \ | | |  ____| \ \ / /__   __|  _ \|  _ \_ _||  \/  ||  __|" -ForegroundColor Cyan
Write-Host " |  \| | | |__     \ V /   | |  | |_) | |_) | | | \  / || |__" -ForegroundColor Cyan
Write-Host " | . ` | |  __| /\ >  <    | |  |  _ <|  _ <| | | |\/| ||  __|" -ForegroundColor Cyan
Write-Host " |_|\_|_||_____| \/ /_/\_\  |_|  |_| \_\_| \_\___||_|  |_||____|" -ForegroundColor Cyan
Write-Host ""
Write-Host " Stock Trading Platform — Setup Script" -ForegroundColor Yellow
Write-Host " ======================================" -ForegroundColor Yellow
Write-Host ""

$ErrorActionPreference = "Continue"

# ===== Step 1: Check Prerequisites =====
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Green

# Check VS Code
if (Get-Command "code" -ErrorAction SilentlyContinue) {
    Write-Host "  [✓] VS Code found" -ForegroundColor Green
} else {
    Write-Host "  [!] VS Code not found in PATH — open it manually from Start Menu" -ForegroundColor Yellow
}

# Check CMake
if (Get-Command "cmake" -ErrorAction SilentlyContinue) {
    Write-Host "  [✓] CMake found: $(cmake --version | Select-Object -First 1)" -ForegroundColor Green
} else {
    Write-Host "  [✗] CMake not found!" -ForegroundColor Red
    Write-Host "      → Download: https://cmake.org/download/"
    Write-Host "      → Install and add to PATH, then re-run this script."
}

# Check vcpkg
if ($env:VCPKG_ROOT -and (Test-Path "$env:VCPKG_ROOT/vcpkg.exe")) {
    Write-Host "  [✓] vcpkg found at: $env:VCPKG_ROOT" -ForegroundColor Green
} else {
    Write-Host "  [!] vcpkg not found (VCPKG_ROOT not set)" -ForegroundColor Yellow
    Write-Host "      → Run: git clone https://github.com/microsoft/vcpkg.git C:\vcpkg"
    Write-Host "      → Then: C:\vcpkg\bootstrap-vcpkg.bat"
    Write-Host "      → Then add to your environment: [System.Environment]::SetEnvironmentVariable('VCPKG_ROOT','C:\vcpkg','User')"
}

# Check MongoDB
$mongoRunning = $false
try {
    $nc = New-Object System.Net.Sockets.TcpClient
    $nc.Connect("localhost", 27017)
    $nc.Close()
    $mongoRunning = $true
    Write-Host "  [✓] MongoDB is running on port 27017" -ForegroundColor Green
} catch {
    Write-Host "  [!] MongoDB not running — the backend will run in demo mode (no persistence)" -ForegroundColor Yellow
    Write-Host "      → Download: https://www.mongodb.com/try/download/community"
}

# Check git
if (Get-Command "git" -ErrorAction SilentlyContinue) {
    Write-Host "  [✓] Git found" -ForegroundColor Green
} else {
    Write-Host "  [!] Git not found — needed for vcpkg" -ForegroundColor Yellow
}

Write-Host ""

# ===== Step 2: Open Frontend in Browser =====
Write-Host "[2/6] Launching frontend in browser..." -ForegroundColor Green
$frontendPath = "$PSScriptRoot\frontend\index.html"
if (Test-Path $frontendPath) {
    Start-Process $frontendPath
    Write-Host "  [✓] Opened: $frontendPath" -ForegroundColor Green
    Write-Host "  NOTE: The frontend works fully in DEMO MODE (no backend needed)" -ForegroundColor Cyan
} else {
    Write-Host "  [✗] Frontend not found at: $frontendPath" -ForegroundColor Red
}

Write-Host ""

# ===== Step 3: Install vcpkg dependencies =====
Write-Host "[3/6] Installing C++ dependencies via vcpkg..." -ForegroundColor Green
if ($env:VCPKG_ROOT -and (Test-Path "$env:VCPKG_ROOT/vcpkg.exe")) {
    Push-Location "$PSScriptRoot\backend"
    & "$env:VCPKG_ROOT\vcpkg.exe" install `
        crow `
        mongo-cxx-driver `
        nlohmann-json `
        curl `
        openssl `
        jwt-cpp 2>&1 | Write-Host
    Pop-Location
    Write-Host "  [✓] Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  [!] Skipping — vcpkg not configured" -ForegroundColor Yellow
    Write-Host "      See Step 1 above to install vcpkg"
}

Write-Host ""

# ===== Step 4: Configure CMake =====
Write-Host "[4/6] Configuring CMake build..." -ForegroundColor Green
$buildDir = "$PSScriptRoot\backend\build"
if (-not (Test-Path $buildDir)) { New-Item -ItemType Directory -Path $buildDir | Out-Null }

if ((Get-Command "cmake" -ErrorAction SilentlyContinue) -and $env:VCPKG_ROOT) {
    Push-Location $buildDir
    cmake .. `
        -DCMAKE_TOOLCHAIN_FILE="$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" `
        -DCMAKE_BUILD_TYPE=Release 2>&1 | Write-Host
    Pop-Location
    Write-Host "  [✓] CMake configured" -ForegroundColor Green
} else {
    Write-Host "  [!] Skipping CMake — prerequisites not met" -ForegroundColor Yellow
}

Write-Host ""

# ===== Step 5: Build =====
Write-Host "[5/6] Building C++ backend..." -ForegroundColor Green
if ((Get-Command "cmake" -ErrorAction SilentlyContinue) -and (Test-Path "$buildDir/CMakeCache.txt")) {
    cmake --build $buildDir --config Release 2>&1 | Write-Host
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [✓] Build successful!" -ForegroundColor Green
    } else {
        Write-Host "  [✗] Build failed — check errors above" -ForegroundColor Red
    }
} else {
    Write-Host "  [!] Skipping build — CMake not configured" -ForegroundColor Yellow
}

Write-Host ""

# ===== Step 6: Launch Backend =====
Write-Host "[6/6] Launching NexTrade backend server..." -ForegroundColor Green
$exe = "$buildDir\Release\nextrade.exe"
if (Test-Path $exe) {
    Write-Host "  Starting backend on http://localhost:8080 ..." -ForegroundColor Cyan
    Start-Process $exe
    Write-Host "  [✓] Backend started!" -ForegroundColor Green
} else {
    Write-Host "  [!] Backend executable not found — running in demo mode" -ForegroundColor Yellow
    Write-Host "      The frontend works fully standalone with simulated market data."
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " NexTrade Platform Ready!" -ForegroundColor Yellow
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Frontend:  Open frontend\index.html in your browser" -ForegroundColor White
Write-Host " Backend:   http://localhost:8080" -ForegroundColor White
Write-Host " WebSocket: ws://localhost:8080/ws/prices" -ForegroundColor White
Write-Host " Health:    http://localhost:8080/health" -ForegroundColor White
Write-Host ""
Write-Host " Demo Credentials:" -ForegroundColor Yellow
Write-Host "  Click 'Try Demo Account' on the login page" -ForegroundColor White
Write-Host "  Starting balance: `$10,000 paper trading" -ForegroundColor White
Write-Host ""
Write-Host " Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
