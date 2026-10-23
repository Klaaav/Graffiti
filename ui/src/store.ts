import { load, Store } from '@tauri-apps/plugin-store';
import { setSetting, setSettingStr } from './ipc';

let storeInstance: Store | null = null;
let storePromise: Promise<Store> | null = null;
let storeWriteQueue: Promise<void> = Promise.resolve();
let effectSettingsCache: Record<string, Record<string, any>> | null = null;
let effectSettingsCachePromise: Promise<Record<string, Record<string, any>>> | null = null;

async function getStore(): Promise<Store> {
    if (!storePromise) {
        storePromise = load('settings.json', { autoSave: false });
    }
    if (!storeInstance) storeInstance = await storePromise;
    return storeInstance;
}

function enqueueStoreWrite<T>(operation: () => Promise<T>): Promise<T> {
    const next = storeWriteQueue.then(operation);
    storeWriteQueue = next.then(() => undefined, () => undefined);
    return next;
}

async function waitForStoreWrites(): Promise<void> {
    await storeWriteQueue;
}

async function getEffectSettingsCache(): Promise<Record<string, Record<string, any>>> {
    if (effectSettingsCache) return effectSettingsCache;
    if (!effectSettingsCachePromise) {
        effectSettingsCachePromise = (async () => {
            const store = await getStore();
            effectSettingsCache = await store.get<Record<string, Record<string, any>>>('effectSettings') || {};
            return effectSettingsCache;
        })();
    }
    return effectSettingsCachePromise;
}

export interface EffectSettings {
    cursor_reveal: {
        layerA?: string;
        layerB?: string;
        brushSize: number;
        brushHardness: number;
        trailLength: number;
        fadeSpeed: number;
        fadeWhenResting: number;
    };
    depth_parallax: {
        testWallpaper?: string;
        depthMap?: string;
        parallaxStrength: number;
    };
    gravity_lens: {
        baseImage?: string;
        lensStrength: number;
        lensRadius: number;
        stiffness: number;
        damping: number;
        dispersion: number;
        coreDarkening: number;
        trailLength: number;
        fadeDecay: number;
    };
    gravity_lens_transparent: {
        baseImage?: string;
        pressDepth: number;
        pressRadius: number;
        stiffness: number;
        damping: number;
        dispersion: number;
        coreDarkening: number;
        trailLength: number;
        fadeDecay: number;
    };
    stone_press_v2: {
        baseImage?: string;
        pressDepth: number;
        pressRadius: number;
        stiffness: number;
        damping: number;
        depthDarkening: number;
        directionalShading: number;
        parallaxStrength: number;
    };
    brick_outline: {
        baseImage?: string;
        brickWidth: number;
        brickHeight: number;
        lineThickness: number;
        effectRadius: number;
        edgeSoftness: number;
        glowIntensity: number;
        outlineColor: string;
    };
}

export interface AppSettings {
    idleTimeout: number; // 0 = disabled
    pauseHidden: boolean;
    pauseFullscreen: boolean;
    pauseBattery: boolean;
    pauseSessionLocked: boolean;
    preferredGPU: string;
}

export const defaultSettings: AppSettings = {
    idleTimeout: 60, // 60 seconds
    pauseHidden: true,
    pauseFullscreen: true,
    pauseBattery: false,
    pauseSessionLocked: true,
    preferredGPU: 'Automatic',
};

export async function loadSettings(): Promise<AppSettings> {
    await waitForStoreWrites();
    const store = await getStore();
    const idleTimeout = await store.get<number>('idleTimeout');
    const pauseHidden = await store.get<boolean>('pauseHidden');
    const pauseFullscreen = await store.get<boolean>('pauseFullscreen');
    const pauseBattery = await store.get<boolean>('pauseBattery');
    const pauseSessionLocked = await store.get<boolean>('pauseSessionLocked');
    const preferredGPU = await store.get<string>('preferredGPU');

    return {
        idleTimeout: idleTimeout ?? defaultSettings.idleTimeout,
        pauseHidden: pauseHidden ?? defaultSettings.pauseHidden,
        pauseFullscreen: pauseFullscreen ?? defaultSettings.pauseFullscreen,
        pauseBattery: pauseBattery ?? defaultSettings.pauseBattery,
        pauseSessionLocked: pauseSessionLocked ?? defaultSettings.pauseSessionLocked,
        preferredGPU: preferredGPU ?? defaultSettings.preferredGPU,
    };
}

export async function saveSettings(settings: AppSettings) {
    let oldGPU: string | null = null;
    await enqueueStoreWrite(async () => {
        const store = await getStore();
        await store.set('idleTimeout', settings.idleTimeout);
        await store.set('pauseHidden', settings.pauseHidden);
        await store.set('pauseFullscreen', settings.pauseFullscreen);
        await store.set('pauseBattery', settings.pauseBattery);
        await store.set('pauseSessionLocked', settings.pauseSessionLocked);

        // Check if GPU changed, and only apply if it did, since it triggers restart.
        oldGPU = await store.get<string>('preferredGPU') || null;
        await store.set('preferredGPU', settings.preferredGPU);
        await store.save();
    });

    const gpuChanged = oldGPU !== null
        ? oldGPU !== settings.preferredGPU
        : settings.preferredGPU !== defaultSettings.preferredGPU;
    await applySettingsToBackend(settings, gpuChanged);
}

export async function applySettingsToBackend(settings: AppSettings, gpuChanged = false) {
    await setSetting('engine.idleTimeout', settings.idleTimeout);
    await setSetting('engine.pauseHidden', settings.pauseHidden ? 1 : 0);
    await setSetting('engine.pauseFullscreen', settings.pauseFullscreen ? 1 : 0);
    await setSetting('engine.pauseBattery', settings.pauseBattery ? 1 : 0);
    await setSetting('engine.pauseSessionLocked', settings.pauseSessionLocked ? 1 : 0);
    
    if (gpuChanged) {
        // This will restart the renderer!
        await setSettingStr('engine.preferredGPU', settings.preferredGPU);
    }
}

export async function resetToDefaults() {
    await enqueueStoreWrite(async () => {
        const store = await getStore();
        await store.clear();
        await store.save();
        effectSettingsCache = {};
        effectSettingsCachePromise = Promise.resolve(effectSettingsCache);
    });
    await applySettingsToBackend(defaultSettings, true); // true to force restart and apply default GPU
}

export interface WallpaperPairing {
    effect: string;
    settings: Record<string, any>;
}

export async function getWallpaperPairing(wallpaperPath: string): Promise<WallpaperPairing | null> {
    await waitForStoreWrites();
    const store = await getStore();
    const pairings = await store.get<Record<string, WallpaperPairing>>('wallpaperPairings') || {};
    return pairings[wallpaperPath] || null;
}

export async function saveWallpaperPairing(wallpaperPath: string, effect: string, settings: Record<string, any>) {
    await enqueueStoreWrite(async () => {
        const store = await getStore();
        const pairings = await store.get<Record<string, WallpaperPairing>>('wallpaperPairings') || {};
        pairings[wallpaperPath] = { effect, settings };
        await store.set('wallpaperPairings', pairings);
        await store.save();
    });
}

export async function loadEffectSettings(effect: string): Promise<Record<string, any> | null> {
    await waitForStoreWrites();
    const effectSettings = await getEffectSettingsCache();
    const settings = effectSettings[effect];
    return settings ? { ...settings } : null;
}

export async function saveEffectSettings(effect: string, settings: Record<string, any>) {
    await enqueueStoreWrite(async () => {
        const store = await getStore();
        const effectSettings = await getEffectSettingsCache();
        // Merge against the in-memory latest value while writes are serialized.
        effectSettings[effect] = { ...(effectSettings[effect] || {}), ...settings };
        await store.set('effectSettings', effectSettings);
        await store.save();
    });
}

export interface ActiveSession {
    layerA: string;
    layerB: string;
    effect: string;
    isGalleryCollage?: boolean;
}

export async function getActiveSession(): Promise<ActiveSession | null> {
    await waitForStoreWrites();
    const store = await getStore();
    return await store.get<ActiveSession>('activeSession') || null;
}

export async function saveActiveSession(session: ActiveSession | null) {
    await enqueueStoreWrite(async () => {
        const store = await getStore();
        await store.set('activeSession', session);
        await store.save();
    });
}

// Hydrate the workspace from one local IPC read. Renderer startup (and ML
// inference) must never delay showing saved filenames or slider values.
export async function loadStartupState() {
    await waitForStoreWrites();
    const store = await getStore();
    const values = Object.fromEntries(await store.entries<any>());
    const effects: Record<string, Record<string, any>> = values.effectSettings || {};
    effectSettingsCache = effects;
    effectSettingsCachePromise = Promise.resolve(effects);
    return {
        settings: {
            idleTimeout: values.idleTimeout ?? defaultSettings.idleTimeout,
            pauseHidden: values.pauseHidden ?? defaultSettings.pauseHidden,
            pauseFullscreen: values.pauseFullscreen ?? defaultSettings.pauseFullscreen,
            pauseBattery: values.pauseBattery ?? defaultSettings.pauseBattery,
            pauseSessionLocked: values.pauseSessionLocked ?? defaultSettings.pauseSessionLocked,
            preferredGPU: values.preferredGPU ?? defaultSettings.preferredGPU,
        } as AppSettings,
        quality: {
            fpsCap: (values.fpsCap ?? null) as number | null,
            resolutionScale: (values.resolutionScale ?? null) as number | null,
            resolutionMode: (values.resolutionMode ?? null) as string | null,
        },
        effects,
        selectedEffect: (values.lastSelectedEffect ?? null) as string | null,
        session: (values.activeSession ?? null) as ActiveSession | null,
    };
}

export async function loadQualitySettings(): Promise<{
    fpsCap: number | null;
    resolutionScale: number | null;
    resolutionMode: string | null;
}> {
    await waitForStoreWrites();
    const store = await getStore();
    const fpsCap = await store.get<number>('fpsCap');
    const resolutionScale = await store.get<number>('resolutionScale');
    const resolutionMode = await store.get<string>('resolutionMode');
    return {
        fpsCap: fpsCap ?? null,
        resolutionScale: resolutionScale ?? null,
        resolutionMode: resolutionMode ?? null,
    };
}

export async function saveQualitySetting(key: 'fpsCap' | 'resolutionScale', value: number) {
    await enqueueStoreWrite(async () => {
        const store = await getStore();
        await store.set(key, value);
        await store.save();
    });
}

export async function saveResolutionMode(mode: string) {
    await enqueueStoreWrite(async () => {
        const store = await getStore();
        await store.set('resolutionMode', mode);
        await store.save();
    });
}

export async function saveSelectedEffect(effectId: string) {
    await enqueueStoreWrite(async () => {
        const store = await getStore();
        await store.set('lastSelectedEffect', effectId);
        await store.save();
    });
}

export async function loadSelectedEffect(): Promise<string | null> {
    await waitForStoreWrites();
    const store = await getStore();
    return await store.get<string>('lastSelectedEffect') || null;
}
