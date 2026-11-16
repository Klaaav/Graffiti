#include <iostream>
#include <dxgi.h>
#include <windows.h>

#pragma comment(lib, "dxgi.lib")

int main() {
    IDXGIFactory1* pFactory = nullptr;
    if (FAILED(CreateDXGIFactory1(__uuidof(IDXGIFactory1), (void**)&pFactory))) {
        std::cout << "Failed to create DXGI factory." << std::endl;
        return 1;
    }

    IDXGIAdapter1* pAdapter = nullptr;
    for (UINT i = 0; pFactory->EnumAdapters1(i, &pAdapter) != DXGI_ERROR_NOT_FOUND; ++i) {
        DXGI_ADAPTER_DESC1 desc;
        pAdapter->GetDesc1(&desc);
        
        char adapterName[256] = {};
        WideCharToMultiByte(CP_UTF8, 0, desc.Description, -1, adapterName, sizeof(adapterName), nullptr, nullptr);
        
        SIZE_T vramMB = desc.DedicatedVideoMemory / (1024 * 1024);
        
        std::cout << "Adapter " << i << ": " << adapterName << std::endl;
        std::cout << "  Dedicated VRAM: " << vramMB << " MB" << std::endl;
        
        pAdapter->Release();
    }

    pFactory->Release();
    return 0;
}
