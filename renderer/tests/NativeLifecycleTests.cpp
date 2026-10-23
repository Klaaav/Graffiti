#define NOMINMAX
#include "../src/power/PowerManager.h"
#include "../src/ipc/IPCServer.h"
#include "../src/ipc/json.hpp"
#include <cstdlib>
#include <iostream>

static void Check(bool condition, const char* message) {
    if (!condition) {
        std::cerr << "FAILED: " << message << "\n";
        std::exit(1);
    }
}

static void TestPauseAndFramePacing() {
    PowerManager::Initialize(nullptr);
    PowerManager::SetPauseHidden(false);
    PowerManager::SetPauseFullscreen(false);
    PowerManager::SetPauseBattery(false);
    PowerManager::SetPauseSessionLocked(false);
    PowerManager::SetIdleTimeout(0);
    PowerManager::Update();
    Check(PowerManager::ShouldRenderFrame(0), "uncapped active frame should render");
    Check(!PowerManager::ShouldRenderFrame(1), "capped frame should wait for its deadline");
    Check(!PowerManager::IsPaused(), "waiting for an FPS deadline must not suspend/resume the effect");

    PowerManager::SetPauseSessionLocked(true);
    PowerManager::SetSessionLocked(true);
    PowerManager::Update();
    Check(PowerManager::IsPaused(), "session lock should pause");
    Check(!PowerManager::ShouldRenderFrame(0), "paused state should suppress new animation frames");
    PowerManager::SetSessionLocked(false);
    PowerManager::SetPauseSessionLocked(false);
    PowerManager::Update();
    Check(!PowerManager::IsPaused(), "unlock should resume without the settings window");

    PowerManager::SetIdleTimeout(0.01f);
    Sleep(30);
    PowerManager::Update();
    Check(PowerManager::IsPaused(), "idle deadline should pause");
    PowerManager::OnMouseMove();
    Check(!PowerManager::IsPaused(), "desktop mouse input should wake the effect independently of the UI");
    std::cout << "PASS: frame pacing, lock/unlock and idle/mouse lifecycle\n";
}

static void TestCommandAcknowledgements() {
    // Never touch the installed app's live pipe or desktop state.
    const std::string name = R"(\\.\pipe\Graffiti-native-test-)" + std::to_string(GetCurrentProcessId());
    IPCServer::Start(name);
    for (int index = 0; index < 40; ++index) {
        HANDLE client = INVALID_HANDLE_VALUE;
        const ULONGLONG deadline = GetTickCount64() + 2000;
        while (client == INVALID_HANDLE_VALUE && GetTickCount64() < deadline) {
            client = CreateFileA(name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
            if (client == INVALID_HANDLE_VALUE) Sleep(1);
        }
        Check(client != INVALID_HANDLE_VALUE, "pipe connection should not incur multi-second probe retries");
        const std::string payload = nlohmann::json({{"cmd", "set_setting"}, {"key", "brushSize"}, {"value", index}}).dump() + "\n";
        DWORD written = 0, count = 0;
        Check(WriteFile(client, payload.data(), static_cast<DWORD>(payload.size()), &written, nullptr) != FALSE, "setting write should succeed");
        char buffer[4096] = {};
        Check(ReadFile(client, buffer, sizeof(buffer), &count, nullptr) != FALSE && count > 0,
            "every setting must be acknowledged before disconnecting");
        const auto response = nlohmann::json::parse(std::string(buffer, count));
        Check(response.value("status", "") == "queued", "acknowledgement should confirm queue receipt");
        const auto pending = IPCServer::GetPendingCommands();
        Check(pending.size() == 1 && pending[0].cmd == "set_setting" && pending[0].floatArg == index,
            "each rapid request must be queued exactly once before the acknowledgement");
        CloseHandle(client);
    }
    IPCServer::Stop();
    std::cout << "PASS: 40 acknowledged native commands, no drops or duplicates\n";
}

int main() {
    TestPauseAndFramePacing();
    TestCommandAcknowledgements();
    return 0;
}
