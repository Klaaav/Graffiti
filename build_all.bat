@echo off
setlocal

set "LOGFILE=%~dp0build_log.txt"
echo ===== Build Script ===== > "%LOGFILE%"

:: Find VS
for /f "usebackq tokens=*" %%i in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -property installationPath`) do set "VSDIR=%%i"
if not defined VSDIR (
    echo ERROR: Visual Studio not found >> "%LOGFILE%"
    exit /b 1
)

call "%VSDIR%\Common7\Tools\VsDevCmd.bat" -arch=x64 >nul 2>&1

echo. >> "%LOGFILE%"
echo === Building web_wallpaper === >> "%LOGFILE%"
cd /d "C:\My_Proj\InteractWall\web_wallpaper"
cl.exe /EHsc /MD /O2 /std:c++17 main.cpp ..\renderer\src\power\PowerManager.cpp /I.\webview2\build\native\include /link /SUBSYSTEM:WINDOWS /OUT:web_wallpaper.exe .\webview2\build\native\x64\WebView2LoaderStatic.lib user32.lib gdi32.lib advapi32.lib ole32.lib shell32.lib shlwapi.lib version.lib wtsapi32.lib >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo ERROR: web_wallpaper build failed >> "%LOGFILE%"
    exit /b 1
)
echo web_wallpaper build OK >> "%LOGFILE%"

echo. >> "%LOGFILE%"
echo === Building renderer === >> "%LOGFILE%"
cd /d "C:\My_Proj\InteractWall\renderer\build"
cmake --build . --config Release >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo ERROR: renderer build failed >> "%LOGFILE%"
    exit /b 1
)
echo renderer build OK >> "%LOGFILE%"

echo. >> "%LOGFILE%"
echo === All native builds complete === >> "%LOGFILE%"
