@echo off
setlocal

echo ====================================================
echo          Graffiti Admin Builder
echo ====================================================
echo.

set "ROOT=%~dp0"
cd /d "%ROOT%admin-console"

if not exist "node_modules" (
    echo [1/3] Installing admin app dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Admin dependency installation failed.
        exit /b %errorlevel%
    )
) else (
    echo [1/3] Admin dependencies already installed.
)

echo [2/3] Building the standalone admin app and Windows installer...
call npx tauri build
if %errorlevel% neq 0 (
    echo [ERROR] Standalone admin installer build failed.
    exit /b %errorlevel%
)

echo [3/3] Updating distribution folder...
cd /d "%ROOT%"
if not exist "downloads" mkdir "downloads"
copy /y "%ROOT%admin-console\src-tauri\target\release\bundle\nsis\GraffitiAdmin_1.0.0_x64-setup.exe" "%ROOT%downloads\GraffitiAdmin_1.0.0_x64-setup.exe" >nul
if %errorlevel% neq 0 (
    echo [ERROR] Could not copy the standalone admin installer.
    exit /b %errorlevel%
)

echo [OK] Standalone admin installer copied to:
echo      downloads\GraffitiAdmin_1.0.0_x64-setup.exe
exit /b 0
