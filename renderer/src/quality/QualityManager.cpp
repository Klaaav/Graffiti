#include "QualityManager.h"
#include <iostream>
#include <algorithm>

QualityTier QualityManager::s_currentTier = {};
bool QualityManager::s_tierChanged = false;

QualityTier QualityManager::GetTierSettings(QualityTierLevel level) {
    QualityTier tier = {};
    tier.level = level;
    switch (level) {
        case QUALITY_TIER_LOW:
            tier.fpsCap = 30;
            tier.disableOptionalPasses = true;
            break;
        case QUALITY_TIER_BALANCED:
            tier.fpsCap = 60;
            tier.disableOptionalPasses = false;
            break;
        case QUALITY_TIER_HIGH:
            tier.fpsCap = 0; // Uncapped/VSync
            tier.disableOptionalPasses = false;
            break;
    }
    return tier;
}

static int s_fpsCap = 60;
static float s_resolutionScale = 1.0f;
static uint64_t s_cachedVramMB = 0;
static std::string s_cachedAdapterName;

void QualityManager::Initialize(uint64_t vramMB, const std::string& adapterName) {
    std::cout << "[Quality] Initializing QualityManager...\n";
    s_cachedVramMB = vramMB;
    s_cachedAdapterName = adapterName;
    ApplyAutoDetected();
}

void QualityManager::ApplyAutoDetected() {
    std::string lowerAdapter = s_cachedAdapterName;
    std::transform(lowerAdapter.begin(), lowerAdapter.end(), lowerAdapter.begin(), ::tolower);
    bool isIntegrated = (lowerAdapter.find("intel") != std::string::npos) ||
                        (lowerAdapter.find("radeon graphics") != std::string::npos);

    if (s_cachedVramMB < 1536 || isIntegrated) {
        s_fpsCap = 30;
        s_resolutionScale = 0.5f;
        std::cout << "[Quality] Auto -> 30 FPS / Half resolution (low VRAM or integrated GPU)\n";
    } else {
        s_fpsCap = 60;
        s_resolutionScale = 1.0f;
        std::cout << "[Quality] Auto -> 60 FPS / Native resolution\n";
    }
}

void QualityManager::SetFpsCap(int fps) {
    s_fpsCap = fps;
    std::cout << "[Quality] FPS cap set to " << fps << "\n";
}
int QualityManager::GetFpsCap() { return s_fpsCap; }

void QualityManager::SetResolutionScale(float scale) { s_resolutionScale = scale; }
float QualityManager::GetResolutionScale() { return s_resolutionScale; }

void QualityManager::SetQualityTierOverride(QualityTierLevel level) {
    if (s_currentTier.level != level) {
        s_currentTier = GetTierSettings(level);
        s_tierChanged = true;
        std::cout << "[Quality] Quality Tier overridden to: " << (int)level << "\n";
    }
}

const QualityTier* QualityManager::GetCurrentTier() {
    return &s_currentTier;
}

bool QualityManager::HasTierChanged() {
    return s_tierChanged;
}

void QualityManager::ClearTierChangedFlag() {
    s_tierChanged = false;
}
