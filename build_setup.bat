@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo             Graffiti Setup Builder
echo ====================================================
echo.

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo [1/4] Compiling native components (Renderer, Shaders, Web Wallpaper)...
call "%ROOT%build_all.bat"
if %errorlevel% neq 0 (
    echo [ERROR] Native compilation failed.
    exit /b %errorlevel%
)
echo [OK] Native components compiled successfully.
echo.

echo [2/4] Building UI and packaging Tauri Windows installers (NSIS + MSI)...
cd /d "%ROOT%ui"
call npx tauri build
if %errorlevel% neq 0 (
    echo [ERROR] Tauri installer build failed.
    exit /b %errorlevel%
)
echo [OK] Installers built successfully.
echo.

echo [3/4] Updating Graffiti distribution folder...
cd /d "%ROOT%"
if not exist "downloads" mkdir "downloads"
copy /y "%ROOT%ui\src-tauri\target\release\bundle\nsis\Graffiti_1.0.0_x64-setup.exe" "%ROOT%downloads\Graffiti_1.0.0_x64-setup.exe" >nul
if %errorlevel% equ 0 (
    echo [OK] Copied latest setup to downloads\Graffiti_1.0.0_x64-setup.exe
)

echo [4/4] Building the standalone admin installer...
call "%ROOT%build_admin.bat"
if %errorlevel% neq 0 (
    echo [ERROR] Standalone admin installer build failed.
    exit /b %errorlevel%
)
echo.
echo ====================================================
echo           Setup Files Created Successfully!
echo ====================================================
echo Graffiti NSIS Installer:
echo   ui\src-tauri\target\release\bundle\nsis\Graffiti_1.0.0_x64-setup.exe
echo   downloads\Graffiti_1.0.0_x64-setup.exe
echo.
echo Graffiti MSI Package:
echo   ui\src-tauri\target\release\bundle\msi\Graffiti_1.0.0_x64_en-US.msi
echo.
echo Standalone Admin NSIS Installer:
echo   admin-console\src-tauri\target\release\bundle\nsis\GraffitiAdmin_1.0.0_x64-setup.exe
echo   downloads\GraffitiAdmin_1.0.0_x64-setup.exe
echo ====================================================
