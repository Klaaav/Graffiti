#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <wrl.h>
#include <WebView2.h>
#include <string>
#include <cstdio>
#include <vector>
#include <fstream>
#include <sstream>
#include "../power/PowerManager.h"

using namespace Microsoft::WRL;

HWND g_hWnd = nullptr;
ComPtr<ICoreWebView2Controller> webviewController;
ComPtr<ICoreWebView2> webview;

// ---- Diagnostic globals (populated before WebView2 init, sent to page later) ----
static char g_diagJson[2048] = {0};

// Forward declarations
LRESULT CALLBACK WndProc(HWND, UINT, WPARAM, LPARAM);

std::wstring GetBasePath() {
    WCHAR exePath[MAX_PATH];
    GetModuleFileNameW(nullptr, exePath, MAX_PATH);
    std::wstring basePath = exePath;
    size_t lastSlash = basePath.find_last_of(L"\\/");
    if (lastSlash != std::wstring::npos) {
        basePath = basePath.substr(0, lastSlash);
    }
    return basePath;
}

std::wstring GetConfigString() {
    char appData[MAX_PATH];
    size_t len;
    getenv_s(&len, appData, MAX_PATH, "APPDATA");
    std::string configPath = std::string(appData) + "\\Graffiti\\web_config.json";
    
    std::ifstream file(configPath);
    if (!file.is_open()) {
        return L"{\"type\":\"config\", \"model\":\"\", \"backgroundType\":\"color\", \"backgroundColor\":\"#000000\"}";
    }
    std::stringstream buffer;
    buffer << file.rdbuf();
    std::string content = buffer.str();
    
    int wchars = MultiByteToWideChar(CP_UTF8, 0, content.c_str(), -1, NULL, 0);
    std::vector<wchar_t> wstr(wchars);
    MultiByteToWideChar(CP_UTF8, 0, content.c_str(), -1, &wstr[0], wchars);
    return std::wstring(wstr.data());
}

// ---------------------------------------------------------------
// WorkerW helpers
// ---------------------------------------------------------------
HWND g_defView = nullptr;
HWND g_workerw = nullptr;

struct WorkerWSearch {
    HWND targetParent = nullptr;
    HWND siblingWorkerW = nullptr;
};

BOOL CALLBACK EnumWindowsProc(HWND hwnd, LPARAM lParam) {
    HWND defView = FindWindowExA(hwnd, nullptr, "SHELLDLL_DefView", nullptr);
    if (defView != nullptr) {
        g_defView = defView; 
        WorkerWSearch* search = reinterpret_cast<WorkerWSearch*>(lParam);
        search->targetParent = hwnd;
        search->siblingWorkerW = FindWindowExA(nullptr, hwnd, "WorkerW", nullptr);
        return FALSE; 
    }
    return TRUE;
}

HWND GetWorkerW() {
    HWND progman = FindWindowA("Progman", nullptr);
    if (!progman) return nullptr;

    SendMessageTimeoutA(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, nullptr);
    SendMessageTimeoutA(progman, 0x052C, 0x0000000D, 0, SMTO_NORMAL, 1000, nullptr);
    SendMessageTimeoutA(progman, 0x052C, 0x0000000D, 1, SMTO_NORMAL, 1000, nullptr);

    WorkerWSearch search;
    
    for (int i = 0; i < 20; i++) {
        search.siblingWorkerW = nullptr;
        search.targetParent = nullptr;
        g_defView = nullptr;
        
        EnumWindows(EnumWindowsProc, reinterpret_cast<LPARAM>(&search));

        if (search.siblingWorkerW) return search.siblingWorkerW;
        Sleep(50);
    }

    if (search.targetParent) {
        HWND childWorkerW = FindWindowExA(search.targetParent, nullptr, "WorkerW", nullptr);
        if (childWorkerW) return childWorkerW;
    }
    
    HWND fallbackWorkerW = nullptr;
    EnumWindows([](HWND hwnd, LPARAM lParam) -> BOOL {
        char className[256];
        GetClassNameA(hwnd, className, sizeof(className));
        if (strcmp(className, "WorkerW") == 0) {
            if (FindWindowExA(hwnd, nullptr, "SHELLDLL_DefView", nullptr) == nullptr) {
                if (IsWindowVisible(hwnd)) {
                    HWND* pFallback = reinterpret_cast<HWND*>(lParam);
                    *pFallback = hwnd;
                    return FALSE; 
                }
            }
        }
        return TRUE;
    }, reinterpret_cast<LPARAM>(&fallbackWorkerW));

    return fallbackWorkerW;
}

#include <thread>

void MonitorParentProcess(DWORD parentPid) {
    HANDLE hParent = OpenProcess(SYNCHRONIZE, FALSE, parentPid);
    if (hParent) {
        std::thread([hParent]() {
            WaitForSingleObject(hParent, INFINITE);
            CloseHandle(hParent);
            ExitProcess(0);
        }).detach();
    }
}

int APIENTRY WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    if (lpCmdLine && strlen(lpCmdLine) > 0) {
        DWORD parentPid = static_cast<DWORD>(atoi(lpCmdLine));
        if (parentPid > 0) {
            MonitorParentProcess(parentPid);
        }
    }

    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    WNDCLASSEXA wc = {};
    wc.cbSize        = sizeof(WNDCLASSEXA);
    wc.style         = CS_CLASSDC;
    wc.lpfnWndProc   = WndProc;
    wc.hInstance     = hInstance;
    wc.hCursor       = LoadCursor(nullptr, IDC_ARROW);
    wc.lpszClassName = "WebWallpaperClass";

    RegisterClassExA(&wc);

    HWND workerW = GetWorkerW();
    if (!workerW) {
        std::ofstream log("C:\\My_Proj\\InteractWall\\renderer\\build\\Release\\crash.log", std::ios_base::app);
        log << "GetWorkerW failed" << std::endl;
        return 1;
    }
    g_workerw = workerW;

    int screenWidth  = GetSystemMetrics(SM_CXSCREEN);
    int screenHeight = GetSystemMetrics(SM_CYSCREEN);

    // Create hidden popup first to avoid cross-thread locking and flashing
    g_hWnd = CreateWindowExA(0, "WebWallpaperClass", "WebWallpaper",
        WS_POPUP, // Remove WS_VISIBLE initially to prevent WebView2 init failure
        0, 0, screenWidth, screenHeight,
        nullptr, nullptr, hInstance, nullptr);

    if (!g_hWnd) {
        std::ofstream log("C:\\My_Proj\\InteractWall\\renderer\\build\\Release\\crash.log", std::ios_base::app);
        log << "CreateWindowExA failed" << std::endl;
        return 1;
    }
    
    std::ofstream log2("C:\\My_Proj\\InteractWall\\renderer\\build\\Release\\crash.log", std::ios_base::app);
    log2 << "Window created, starting webview" << std::endl;

    PowerManager::Initialize(g_hWnd);

    char appData[MAX_PATH];
    size_t len;
    getenv_s(&len, appData, MAX_PATH, "APPDATA");
    
    std::wstring userDataFolder = GetBasePath() + L"\\webview_data";
    std::string assetsPath = std::string(appData) + "\\Graffiti\\web_assets";
    
    int wchars = MultiByteToWideChar(CP_UTF8, 0, assetsPath.c_str(), -1, NULL, 0);
    std::vector<wchar_t> wstr(wchars);
    MultiByteToWideChar(CP_UTF8, 0, assetsPath.c_str(), -1, &wstr[0], wchars);
    static std::wstring s_assetsFolder = wstr.data();

    HRESULT hr = CreateCoreWebView2EnvironmentWithOptions(nullptr, userDataFolder.c_str(), nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
                if (FAILED(result)) {
                    std::ofstream log("C:\\My_Proj\\InteractWall\\renderer\\build\\Release\\crash.log", std::ios_base::app);
                    log << "CreateCoreWebView2EnvironmentWithOptions FAILED: " << std::hex << result << std::endl;
                    return result;
                }
                env->CreateCoreWebView2Controller(g_hWnd,
                    Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                            if (FAILED(result) || !controller) {
                                std::ofstream log("C:\\My_Proj\\InteractWall\\renderer\\build\\Release\\crash.log", std::ios_base::app);
                                log << "CreateCoreWebView2Controller FAILED: " << std::hex << result << std::endl;
                                return result;
                            }

                            webviewController = controller;
                            webviewController->get_CoreWebView2(&webview);

                            // Now that WebView2 is initialized, reparent and show our window
                            LONG style = GetWindowLongA(g_hWnd, GWL_STYLE);
                            style &= ~WS_POPUP;
                            style |= WS_CHILD;
                            SetWindowLongA(g_hWnd, GWL_STYLE, style);
                            SetWindowPos(g_hWnd, nullptr, 0, 0, 0, 0, SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER);

                            SetParent(g_hWnd, g_workerw);

                            if (g_defView && GetParent(g_hWnd) == GetParent(g_defView)) {
                                SetWindowPos(g_hWnd, g_defView, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                            } else {
                                SetWindowPos(g_hWnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                            }

                            ShowWindow(g_hWnd, SW_SHOW);
                            ShowWindow(g_hWnd, SW_RESTORE);

                            ComPtr<ICoreWebView2Controller2> controller2;
                            webviewController.As(&controller2);
                            if (controller2) {
                                COREWEBVIEW2_COLOR transparent = { 0, 0, 0, 0 };
                                controller2->put_DefaultBackgroundColor(transparent);
                            }

                            RECT bounds;
                            GetClientRect(g_hWnd, &bounds);
                            webviewController->put_Bounds(bounds);
                            webviewController->put_IsVisible(TRUE);

                            ComPtr<ICoreWebView2_3> webview3;
                            webview.As(&webview3);
                            if (webview3) {
                                webview3->SetVirtualHostNameToFolderMapping(
                                    L"app-assets.local",
                                    s_assetsFolder.c_str(),
                                    COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW
                                );
                            }

                            webview->add_NavigationCompleted(
                                Callback<ICoreWebView2NavigationCompletedEventHandler>(
                                    [](ICoreWebView2* sender, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT {
                                        std::wstring config = GetConfigString();
                                        webview->PostWebMessageAsJson(config.c_str());
                                        return S_OK;
                                    }).Get(), nullptr);

                            webview->add_WebMessageReceived(
                                Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                                    [](ICoreWebView2* sender, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
                                        LPWSTR message;
                                        if (SUCCEEDED(args->TryGetWebMessageAsString(&message))) {
                                            if (wcscmp(message, L"\"READY\"") == 0) {
                                                std::ofstream log("C:\\My_Proj\\InteractWall\\renderer\\build\\Release\\crash.log", std::ios_base::app);
                                                log << "Received READY" << std::endl;
                                                char appData[MAX_PATH];
                                                size_t len;
                                                getenv_s(&len, appData, MAX_PATH, "APPDATA");
                                                std::string lockFile = std::string(appData) + "\\Graffiti\\web_ready.lock";
                                                FILE* f = nullptr;
                                                if (fopen_s(&f, lockFile.c_str(), "w") == 0) {
                                                    fputs("1", f);
                                                    fclose(f);
                                                }
                                            }
                                            CoTaskMemFree(message);
                                        }
                                        return S_OK;
                                    }).Get(), nullptr);

                            webview->Navigate(L"https://app-assets.local/index.html");

                            SetTimer(g_hWnd, 1, 16, nullptr); // Mouse tracking timer
                            SetTimer(g_hWnd, 2, 500, nullptr); // Power manager timer

                            return S_OK;
                        }).Get());
                return S_OK;
            }).Get());

    if (FAILED(hr)) {
        std::ofstream log("C:\\My_Proj\\InteractWall\\renderer\\build\\Release\\crash.log");
        log << "CreateCoreWebView2EnvironmentWithOptions failed with hr: " << hr << std::endl;
        return 1;
    }

    MSG msg;
    while (GetMessage(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    CoUninitialize();
    return 0;
}

LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam) {
    static PowerState lastState = POWER_STATE_VISIBLE_ACTIVE;

    switch (message) {
    case WM_TIMER:
        if (wParam == 1 && webview) {
            POINT pt;
            if (GetCursorPos(&pt)) {
                int screenWidth  = GetSystemMetrics(SM_CXSCREEN);
                int screenHeight = GetSystemMetrics(SM_CYSCREEN);

                float nx = (static_cast<float>(pt.x) / screenWidth) * 2.0f - 1.0f;
                float ny = (static_cast<float>(pt.y) / screenHeight) * 2.0f - 1.0f; 

                char json[128];
                snprintf(json, sizeof(json), "{\"type\":\"mousemove\", \"x\":%f, \"y\":%f}", nx, ny);

                int wchars_num = MultiByteToWideChar(CP_UTF8, 0, json, -1, NULL, 0);
                std::vector<wchar_t> wstr(wchars_num);
                MultiByteToWideChar(CP_UTF8, 0, json, -1, &wstr[0], wchars_num);
                webview->PostWebMessageAsJson(wstr.data());
            }
        }
        else if (wParam == 2 && webview) {
            // Watchdog check
            HWND currentParent = GetParent(g_hWnd);
            if (!currentParent || !IsWindow(currentParent) || !IsWindowVisible(currentParent)) {
                HWND newWorkerW = GetWorkerW();
                if (newWorkerW) {
                    SetParent(g_hWnd, newWorkerW);
                    SetWindowPos(g_hWnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                    g_workerw = newWorkerW;
                }
            }
            
            PowerManager::Update();
            PowerState currentState = PowerManager::GetState();
            if (currentState != lastState) {
                lastState = currentState;
                if (currentState == POWER_STATE_HIDDEN_FULLSCREEN || 
                    currentState == POWER_STATE_HIDDEN_OCCLUDED || 
                    currentState == POWER_STATE_HIDDEN_BATTERY || 
                    currentState == POWER_STATE_HIDDEN_SESSION_LOCKED) {
                    webview->PostWebMessageAsJson(L"{\"type\":\"power\", \"action\":\"pause\"}");
                } else {
                    webview->PostWebMessageAsJson(L"{\"type\":\"power\", \"action\":\"resume\"}");
                }
            }
        }
        break;
    case WM_SIZE:
        if (webviewController != nullptr) {
            RECT bounds;
            GetClientRect(hWnd, &bounds);
            webviewController->put_Bounds(bounds);
        }
        break;
    case WM_DESTROY:
        PostQuitMessage(0);
        break;
    case WM_MOUSEMOVE:
        PowerManager::OnMouseMove();
        break;
    default:
        return DefWindowProc(hWnd, message, wParam, lParam);
    }
    return 0;
}
