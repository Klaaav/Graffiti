import { useState, useRef, useEffect } from 'react';
import { setSetting, setFpsCap, setResolutionScale, setQualityAuto, importWallpaper, generateDepthMap, getStatus, listWallpapers, fileExists } from '../ipc';
import { applyWallpaper, setEffect, removeEffect } from '../wallpaperManager';
import { saveWallpaperPairing, loadEffectSettings, saveEffectSettings, saveActiveSession, getActiveSession, saveSelectedEffect, loadSelectedEffect } from '../store';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import EffectDial from '../components/EffectDial';

export default function Effects() {
  const [fpsCap, setFpsCapState] = useState(60);
  const [resolutionScale, setResolutionScaleState] = useState(1.0);
  const [liveFps, setLiveFps] = useState<number>(0);

  // Cursor Reveal Settings
  const [brushSize, setBrushSize] = useState(160);
  const [crBrushHardness, setCRBrushHardness] = useState(0.2);
  const [crTrailLength, setCRTrailLength] = useState(1.0);
  const [crFadeSpeed, setCRFadeSpeed] = useState(0.035);
  const [crFadeWhenResting, setCRFadeWhenResting] = useState(true);

  const debounceTimer = useRef<number | null>(null);

  // Depth Parallax State
  const [isGeneratingDepth, setIsGeneratingDepth] = useState(false);
  const [testWallpaper, setTestWallpaper] = useState<string | null>(null);
  const [depthError, setDepthError] = useState<string | null>(null);
  const [parallaxStrength, setParallaxStrength] = useState(0.05);

  // Unified effect tracker
  const [activeEffect, setActiveEffect] = useState<string | null>(null); // Actual running effect
  const [selectedEffect, setSelectedEffect] = useState<string | null>('cursor_reveal'); // Effect being configured in Hero
  const [isGalleryCollage, setIsGalleryCollage] = useState(false);
  const didInitFromActive = useRef(false);

  // Gravity Lens State
  const [glBaseImage, setGLBaseImage] = useState<string | null>(null);
  const [glStrength, setGLStrength] = useState(5.0);
  const [glRadius, setGLRadius] = useState(0.08);
  const [glStiffness, setGLStiffness] = useState(50.0);
  const [glDamping, setGLDamping] = useState(0.90);
  const [glDispersion, setGLDispersion] = useState(0.02);
  const [glDarkening, setGLDarkening] = useState(0.5);
  const [glTrailLength, setGLTrailLength] = useState(1.0);
  const [glFadeDecay, setGLFadeDecay] = useState(0.92);

  // Gravity Lens Transparent State
  const [gltBaseImage, setgltBaseImage] = useState<string | null>(null);
  const [gltDepth, setgltDepth] = useState(0.03);
  const [gltRadius, setgltRadius] = useState(0.08);
  const [gltStiffness, setgltStiffness] = useState(50.0);
  const [gltDamping, setgltDamping] = useState(0.90);
  const [gltDispersion, setgltDispersion] = useState(0.02);
  const [gltDarkening, setgltDarkening] = useState(0.15);
  const [gltShading, setgltShading] = useState(0.5);
  const [gltTrailLength, setgltTrailLength] = useState(1.0);
  const [gltFadeDecay, setgltFadeDecay] = useState(0.92);

  // Stone Press V2 (Space Ball) State
  const [sp2BaseImage, setsp2BaseImage] = useState<string | null>(null);
  const [sp2Depth, setsp2Depth] = useState(2.0);
  const [sp2Radius, setsp2Radius] = useState(0.3);
  const [sp2Stiffness, setsp2Stiffness] = useState(50.0);
  const [sp2Damping, setsp2Damping] = useState(0.90);
  const [sp2Darkening, setsp2Darkening] = useState(0.0);
  const [sp2DirectionalShading, setsp2DirectionalShading] = useState(0.0);
  const [sp2ParallaxStrength, setsp2ParallaxStrength] = useState(0.2);

  // Brick Outline State
  const [boBaseImage, setBOBaseImage] = useState<string | null>(null);
  const [boBrickWidth, setBOBrickWidth] = useState(100.0);
  const [boBrickHeight, setBOBrickHeight] = useState(50.0);
  const [boLineThickness, setBOLineThickness] = useState(3.0);
  const [boEffectRadius, setBOEffectRadius] = useState(0.20);
  const [boEdgeSoftness, setBOEdgeSoftness] = useState(0.10);
  const [boGlowIntensity, setBOGlowIntensity] = useState(1.0);
  const [boOutlineColor, setBOOutlineColor] = useState('#ffffff');

  // Push all effect settings to backend (called after re-initializing renderer)
  const rePushActiveEffectSettings = async () => {
    if (activeEffect === 'cursor_reveal') {
      await setSetting('brushSize', brushSize);
      await setSetting('brushHardness', crBrushHardness);
      await setSetting('trailLength', crTrailLength);
      await setSetting('fadeSpeed', crFadeSpeed);
      await setSetting('fadeWhenResting', crFadeWhenResting ? 1 : 0);
    } else if (activeEffect === 'gravity_lens') {
      await setSetting('lensStrength', glStrength);
      await setSetting('lensRadius', glRadius);
      await setSetting('stiffness', glStiffness);
      await setSetting('damping', glDamping);
      await setSetting('dispersion', glDispersion);
      await setSetting('coreDarkening', glDarkening);
      await setSetting('trailLength', glTrailLength);
      await setSetting('fadeDecay', glFadeDecay);
    } else if (activeEffect === 'gravity_lens_transparent') {
      await setSetting('pressDepth', gltDepth);
      await setSetting('pressRadius', gltRadius);
      await setSetting('stiffness', gltStiffness);
      await setSetting('damping', gltDamping);
      await setSetting('dispersion', gltDispersion);
      await setSetting('coreDarkening', gltDarkening);
      await setSetting('shadingStrength', gltShading);
      await setSetting('trailLength', gltTrailLength);
      await setSetting('fadeDecay', gltFadeDecay);
    } else if (activeEffect === 'stone_press_v2') {
      await setSetting('pressDepth', sp2Depth);
      await setSetting('pressRadius', sp2Radius);
      await setSetting('stiffness', sp2Stiffness);
      await setSetting('damping', sp2Damping);
      await setSetting('depthDarkening', sp2Darkening);
      await setSetting('directionalShading', sp2DirectionalShading);
      await setSetting('parallaxStrength', sp2ParallaxStrength);
    } else if (activeEffect === 'brick_outline') {
      await setSetting('brickWidth', boBrickWidth);
      await setSetting('brickHeight', boBrickHeight);
      await setSetting('lineThickness', boLineThickness);
      await setSetting('effectRadius', boEffectRadius);
      await setSetting('edgeSoftness', boEdgeSoftness);
      await setSetting('glowIntensity', boGlowIntensity);
      const hex = boOutlineColor;
      const r = parseInt(hex.slice(1, 3), 16) / 255.0;
      const g = parseInt(hex.slice(3, 5), 16) / 255.0;
      const b = parseInt(hex.slice(5, 7), 16) / 255.0;
      await setSetting('outlineColorR', r);
      await setSetting('outlineColorG', g);
      await setSetting('outlineColorB', b);
    } else if (activeEffect === 'depth_parallax') {
      await setSetting('parallaxStrength', parallaxStrength);
    }
  };

  useEffect(() => {
    const loadGlobals = async () => {
      try {
        const crSettings = await loadEffectSettings('cursor_reveal');
        if (crSettings) {
          if (crSettings.layerA) setLayerA(crSettings.layerA);
          if (crSettings.layerB) setLayerB(crSettings.layerB);
          setBrushSize(crSettings.brushSize ?? 160);
          setCRBrushHardness(crSettings.brushHardness ?? 0.2);
          setCRTrailLength(crSettings.trailLength ?? 1.0);
          setCRFadeSpeed(crSettings.fadeSpeed ?? 0.035);
          setCRFadeWhenResting((crSettings.fadeWhenResting ?? 1) === 1);
          setSetting('brushSize', crSettings.brushSize ?? 160);
          setSetting('brushHardness', crSettings.brushHardness ?? 0.2);
          setSetting('trailLength', crSettings.trailLength ?? 1.0);
          setSetting('fadeSpeed', crSettings.fadeSpeed ?? 0.035);
          setSetting('fadeWhenResting', crSettings.fadeWhenResting ?? 1);
        }

        const dpSettings = await loadEffectSettings('depth_parallax');
        if (dpSettings) {
          if (dpSettings.testWallpaper) setTestWallpaper(dpSettings.testWallpaper);
          setParallaxStrength(dpSettings.parallaxStrength ?? 0.05);
          setSetting('parallaxStrength', dpSettings.parallaxStrength ?? 0.05);
        }

        const glSettings = await loadEffectSettings('gravity_lens');
        if (glSettings) {
          if (glSettings.baseImage) setGLBaseImage(glSettings.baseImage);
          setGLStrength(glSettings.lensStrength ?? 5.0);
          setGLRadius(glSettings.lensRadius ?? 0.3);
          setGLStiffness(glSettings.stiffness ?? 50.0);
          setGLDamping(glSettings.damping ?? 0.90);
          setGLDispersion(glSettings.dispersion ?? 0.02);
          setGLDarkening(glSettings.coreDarkening ?? 0.5);
          setGLTrailLength(glSettings.trailLength ?? 1.0);
          setGLFadeDecay(glSettings.fadeDecay ?? 0.92);
        }

        const gltSettings = await loadEffectSettings('gravity_lens_transparent');
        if (gltSettings) {
          if (gltSettings.baseImage) setgltBaseImage(gltSettings.baseImage);
          setgltDepth(gltSettings.pressDepth ?? 0.03);
          setgltRadius(gltSettings.pressRadius ?? 0.08);
          setgltStiffness(gltSettings.stiffness ?? 50.0);
          setgltDamping(gltSettings.damping ?? 0.90);
          setgltDispersion(gltSettings.dispersion ?? 0.02);
          setgltDarkening(gltSettings.coreDarkening ?? 0.15);
          setgltShading(gltSettings.shadingStrength ?? 0.5);
          setgltTrailLength(gltSettings.trailLength ?? 1.0);
          setgltFadeDecay(gltSettings.fadeDecay ?? 0.92);
        }

        const sp2Settings = await loadEffectSettings('stone_press_v2');
        if (sp2Settings) {
          if (sp2Settings.baseImage) setsp2BaseImage(sp2Settings.baseImage);
          setsp2Depth(sp2Settings.pressDepth ?? 2.0);
          setsp2Radius(sp2Settings.pressRadius ?? 0.3);
          setsp2Stiffness(sp2Settings.stiffness ?? 50.0);
          setsp2Damping(sp2Settings.damping ?? 0.90);
          setsp2Darkening(sp2Settings.depthDarkening ?? 0.0);
          setsp2DirectionalShading(sp2Settings.directionalShading ?? 0.0);
          setsp2ParallaxStrength(sp2Settings.parallaxStrength ?? 0.2);
        }

        const boSettings = await loadEffectSettings('brick_outline');
        if (boSettings) {
          if (boSettings.baseImage) setBOBaseImage(boSettings.baseImage);
          setBOBrickWidth(boSettings.brickWidth ?? 100.0);
          setBOBrickHeight(boSettings.brickHeight ?? 50.0);
          setBOLineThickness(boSettings.lineThickness ?? 3.0);
          setBOEffectRadius(boSettings.effectRadius ?? 0.20);
          setBOEdgeSoftness(boSettings.edgeSoftness ?? 0.10);
          setBOGlowIntensity(boSettings.glowIntensity ?? 1.0);
          setBOOutlineColor(boSettings.outlineColor ?? '#ffffff');
        }

        const session = await getActiveSession();
        if (session) {
          setIsGalleryCollage(!!session.isGalleryCollage);
        }

        const lastSelected = await loadSelectedEffect();
        if (lastSelected) setSelectedEffect(lastSelected);
      } catch (err) {
        console.error("Failed to load global effect settings:", err);
      }
    };
    loadGlobals();

    const handleBeforeUnload = () => {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }

      const crSettings = {
        layerA, layerB,
        brushSize, brushHardness: crBrushHardness, trailLength: crTrailLength,
        fadeSpeed: crFadeSpeed, fadeWhenResting: crFadeWhenResting ? 1 : 0,
      };
      saveEffectSettings('cursor_reveal', crSettings);

      saveEffectSettings('depth_parallax', { parallaxStrength, testWallpaper });

      const glSettings = {
        baseImage: glBaseImage,
        lensStrength: glStrength, lensRadius: glRadius, stiffness: glStiffness,
        damping: glDamping, dispersion: glDispersion, coreDarkening: glDarkening,
        trailLength: glTrailLength, fadeDecay: glFadeDecay,
      };
      saveEffectSettings('gravity_lens', glSettings);

      const gltSettings = {
        baseImage: gltBaseImage,
        pressDepth: gltDepth, pressRadius: gltRadius, stiffness: gltStiffness,
        damping: gltDamping, dispersion: gltDispersion, coreDarkening: gltDarkening,
        shadingStrength: gltShading, trailLength: gltTrailLength, fadeDecay: gltFadeDecay,
      };
      saveEffectSettings('gravity_lens_transparent', gltSettings);

      const sp2Settings = {
        baseImage: sp2BaseImage,
        pressDepth: sp2Depth, pressRadius: sp2Radius, stiffness: sp2Stiffness,
        damping: sp2Damping, depthDarkening: sp2Darkening, directionalShading: sp2DirectionalShading,
        parallaxStrength: sp2ParallaxStrength
      };
      saveEffectSettings('stone_press_v2', sp2Settings);

      const boSettings = {
        baseImage: boBaseImage,
        brickWidth: boBrickWidth, brickHeight: boBrickHeight, lineThickness: boLineThickness,
        effectRadius: boEffectRadius, edgeSoftness: boEdgeSoftness, glowIntensity: boGlowIntensity,
        outlineColor: boOutlineColor
      };
      saveEffectSettings('brick_outline', boSettings);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await getStatus();
        if (status) {
          if (status.fpsCap !== undefined) setFpsCapState(status.fpsCap);
          if (status.resolutionScale !== undefined) setResolutionScaleState(status.resolutionScale);
          if (status.fps !== undefined) setLiveFps(status.fps);
          
          if (status.activePlugin) {
            // Convert PascalCase DLL name (e.g. "StonePressV2.dll") to snake_case UI name (e.g. "stone_press_v2")
            let uiName = status.activePlugin
              .replace('.dll', '')
              .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
              .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
              .toLowerCase();
  
            // Validate it's a known effect
            const knownEffects = ['cursor_reveal', 'gravity_lens', 'gravity_lens_transparent',
                                  'stone_press_v2', 'depth_parallax', 'brick_outline'];
            if (!knownEffects.includes(uiName)) uiName = 'none';
  
            const newActive = uiName === 'none' ? null : uiName;
            setActiveEffect(newActive);
            if (!didInitFromActive.current) {
              didInitFromActive.current = true;
              if (newActive) setSelectedEffect(newActive);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch status:", err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Removed strict isGalleryCollage lock on cursor_reveal
  }, [isGalleryCollage, selectedEffect]);

  useEffect(() => {
    if (selectedEffect) saveSelectedEffect(selectedEffect).catch(() => {});
  }, [selectedEffect]);

  const handleRemoveEffect = async () => {
    try {
      console.log("[UI] Stop Effect clicked. Triggering removeEffect() IPC...");
      await removeEffect();
      console.log("[UI] removeEffect() IPC returned successfully.");
      setActiveEffect(null);
      await saveActiveSession(null);
      console.log("[UI] Active session cleared.");
    } catch (err: any) {
      console.error("Failed to remove effect", err);
      alert(`Failed to remove effect: ${err.toString()}`);
    }
  };

  const activateDepthParallax = async () => {
    if (!testWallpaper) return;
    if (!(await fileExists(testWallpaper))) {
      alert("Wallpaper file is missing or was deleted. Please import it again.");
      return;
    }
    try {
      const depthImage = testWallpaper.replace(/\.[^/.]+$/, "") + "_depth.png";
      await applyWallpaper(testWallpaper, depthImage);
      await setEffect('depth_parallax');
      setActiveEffect('depth_parallax');
      setSelectedEffect('depth_parallax');
      await saveWallpaperPairing(testWallpaper, 'depth_parallax', { parallaxStrength });
      await saveActiveSession({ layerA: testWallpaper, layerB: depthImage, effect: 'depth_parallax', isGalleryCollage });
      await setSetting('parallaxStrength', parallaxStrength);
    } catch (err: any) {
      console.error("Failed to activate depth parallax", err);
      alert(`Failed to activate effect: ${err.toString()}`);
    }
  };



  const [layerA, setLayerA] = useState<string | null>(null);
  const [layerB, setLayerB] = useState<string | null>(null);

  const handleFpsCapChange = async (fps: number) => {
    setFpsCapState(fps);
    await setFpsCap(fps);
  };

  const handleResolutionScaleChange = async (scale: number) => {
    setResolutionScaleState(scale);
    await setResolutionScale(scale);
    await rePushActiveEffectSettings();
  };

  const handleQualityAuto = async () => {
    await setQualityAuto();
    await rePushActiveEffectSettings();
    // the polling getStatus will update the UI buttons automatically
  };

  const handleCRSettingChange = (key: string, val: number, setter: React.Dispatch<React.SetStateAction<number>>) => {
    setter(val);
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => setSetting(key, val), 50);
  };

  const [showImportPickerFor, setShowImportPickerFor] = useState<{ setter: React.Dispatch<React.SetStateAction<string | null>>, effectType: string, onComplete?: (path: string) => void } | null>(null);
  const [pickerWallpapers, setPickerWallpapers] = useState<string[]>([]);
  const [pickerSource, setPickerSource] = useState<'options' | 'gallery'>('options');

  const handleImport = async (setLayer: React.Dispatch<React.SetStateAction<string | null>>, effectType: string, onComplete?: (path: string) => void) => {
    setShowImportPickerFor({ setter: setLayer, effectType, onComplete });
    setPickerSource('options');
    try {
      const list = await listWallpapers();
      setPickerWallpapers(list);
    } catch (err) {
      setPickerWallpapers([]);
    }
  };

  const executeNativeImport = async (setLayer: React.Dispatch<React.SetStateAction<string | null>>, onComplete?: (path: string) => void) => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpeg', 'jpg', 'webp', 'bmp'] }]
    });
    if (selected && typeof selected === 'string') {
      try {
        const newPath = await importWallpaper(selected);
        setLayer(newPath);
        onComplete?.(newPath);
      } catch (err) {
        console.error("Failed to import wallpaper:", err);
      }
    }
  };

  const activateEffect = async () => {
    if (!layerA || !layerB) return;
    if (!(await fileExists(layerA)) || !(await fileExists(layerB))) {
      alert("One or both wallpaper files are missing. Please import them again.");
      return;
    }
    try {
      await applyWallpaper(layerA, layerB);
      await setEffect('cursor_reveal');
      setActiveEffect('cursor_reveal');
      setSelectedEffect('cursor_reveal');
      await saveActiveSession({ layerA, layerB, effect: 'cursor_reveal', isGalleryCollage });
      await setSetting('brushSize', brushSize);
      await setSetting('brushHardness', crBrushHardness);
      await setSetting('trailLength', crTrailLength);
      await setSetting('fadeSpeed', crFadeSpeed);
      await setSetting('fadeWhenResting', crFadeWhenResting ? 1 : 0);
    } catch (err: any) {
      alert(`Failed to activate effect: ${err.toString()}`);
    }
  };

  const activateGravityLens = async () => {
    if (!glBaseImage) return;
    if (!(await fileExists(glBaseImage))) {
      alert("Wallpaper file is missing or was deleted. Please import it again.");
      return;
    }
    try {
      await applyWallpaper(glBaseImage, "");
      await setEffect('gravity_lens');
      setActiveEffect('gravity_lens');
      setSelectedEffect('gravity_lens');
      await saveActiveSession({ layerA: glBaseImage, layerB: "", effect: 'gravity_lens', isGalleryCollage });
      await setSetting('lensStrength', glStrength);
      await setSetting('lensRadius', glRadius);
      await setSetting('stiffness', glStiffness);
      await setSetting('damping', glDamping);
      await setSetting('dispersion', glDispersion);
      await setSetting('coreDarkening', glDarkening);
      await setSetting('trailLength', glTrailLength);
      await setSetting('fadeDecay', glFadeDecay);
    } catch (err) { }
  };

  const activateGravityLensTransparent = async () => {
    if (!gltBaseImage) return;
    if (!(await fileExists(gltBaseImage))) {
      alert("Wallpaper file is missing or was deleted. Please import it again.");
      return;
    }
    try {
      await applyWallpaper(gltBaseImage, "");
      await setEffect('gravity_lens_transparent');
      setActiveEffect('gravity_lens_transparent');
      setSelectedEffect('gravity_lens_transparent');
      await saveActiveSession({ layerA: gltBaseImage, layerB: "", effect: 'gravity_lens_transparent', isGalleryCollage });
      await setSetting('pressDepth', gltDepth);
      await setSetting('pressRadius', gltRadius);
      await setSetting('stiffness', gltStiffness);
      await setSetting('damping', gltDamping);
      await setSetting('dispersion', gltDispersion);
      await setSetting('coreDarkening', gltDarkening);
      await setSetting('shadingStrength', gltShading);
      await setSetting('trailLength', gltTrailLength);
      await setSetting('fadeDecay', gltFadeDecay);
    } catch (err) { }
  };

  const activateStonePressV2 = async () => {
    if (!sp2BaseImage) return;
    if (!(await fileExists(sp2BaseImage))) {
      alert("Wallpaper file is missing or was deleted. Please import it again.");
      return;
    }
    try {
      await applyWallpaper(sp2BaseImage, "");
      await setEffect('stone_press_v2');
      setActiveEffect('stone_press_v2');
      setSelectedEffect('stone_press_v2');
      await saveActiveSession({ layerA: sp2BaseImage, layerB: "", effect: 'stone_press_v2', isGalleryCollage });
      await setSetting('pressDepth', sp2Depth);
      await setSetting('pressRadius', sp2Radius);
      await setSetting('stiffness', sp2Stiffness);
      await setSetting('damping', sp2Damping);
      await setSetting('depthDarkening', sp2Darkening);
      await setSetting('directionalShading', sp2DirectionalShading);
      await setSetting('parallaxStrength', sp2ParallaxStrength);
    } catch (err) { }
  };

  const activateBrickOutline = async () => {
    if (!boBaseImage) return;
    if (!(await fileExists(boBaseImage))) {
      alert("Wallpaper file is missing or was deleted. Please import it again.");
      return;
    }
    try {
      await applyWallpaper(boBaseImage, "");
      await setEffect('brick_outline');
      setActiveEffect('brick_outline');
      setSelectedEffect('brick_outline');
      await saveActiveSession({ layerA: boBaseImage, layerB: "", effect: 'brick_outline', isGalleryCollage });
      await setSetting('brickWidth', boBrickWidth);
      await setSetting('brickHeight', boBrickHeight);
      await setSetting('lineThickness', boLineThickness);
      await setSetting('effectRadius', boEffectRadius);
      await setSetting('edgeSoftness', boEdgeSoftness);
      await setSetting('glowIntensity', boGlowIntensity);
    } catch (err) { }
  };

  const handleGLSettingChange = (key: string, val: number, setter: React.Dispatch<React.SetStateAction<number>>) => {
    setter(val);
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => setSetting(key, val), 50);
  };
  const handleGLTSettingChange = (key: string, val: number, setter: React.Dispatch<React.SetStateAction<number>>) => {
    setter(val);
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => setSetting(key, val), 50);
  };
  const handleSP2SettingChange = (key: string, val: number, setter: React.Dispatch<React.SetStateAction<number>>) => {
    setter(val);
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => setSetting(key, val), 50);
  };
  const handleBOSettingChange = (key: string, val: number) => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      setSetting(key, val);
    }, 50);
  };

  const handleBOColorChange = (hex: string) => {
    setBOOutlineColor(hex);
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      const r = parseInt(hex.slice(1, 3), 16) / 255.0;
      const g = parseInt(hex.slice(3, 5), 16) / 255.0;
      const b = parseInt(hex.slice(5, 7), 16) / 255.0;
      setSetting('outlineColorR', r);
      setSetting('outlineColorG', g);
      setSetting('outlineColorB', b);
    }, 50);
  };

  const EFFECT_LABELS: Record<string, string> = {
    cursor_reveal:            'Cursor Reveal',
    gravity_lens:             'Gravity Lens',
    gravity_lens_transparent: 'Glass Lens',
    stone_press_v2:           'Space Ball',
    brick_outline:            'Brick Outline',
    depth_parallax:           'Depth Parallax',
  };

  const EFFECT_DESCRIPTIONS: Record<string, string> = {
    cursor_reveal:            'Reveals a hidden wallpaper layer as your cursor moves — like brushing away dust to uncover artwork beneath. Two image layers blend seamlessly at the brush edge.',
    gravity_lens:             'Warps your wallpaper around your cursor with fluid physics. The lens bends light like a gravitational field, creating a living, reactive desktop.',
    gravity_lens_transparent: 'A transparent glass lens that distorts and magnifies through your wallpaper with realistic refraction. The desktop beneath bends and shimmers.',
    stone_press_v2:           'Simulates pressing your cursor into a stone surface — the material deforms, shades, and springs back with tactile depth illusion.',
    brick_outline:            'Traces glowing outlines around brick patterns near your cursor, illuminating the structure as if lit from within.',
    depth_parallax:           'Generates a 3D depth map from your wallpaper using AI, then creates a parallax layer effect that follows cursor movement for a subtle 3D illusion.',
  };

  const EFFECT_TAGS: Record<string, string[]> = {
    cursor_reveal:            ['Dual Layer', 'Brush', 'Reveal'],
    gravity_lens:             ['Physics', 'Lens', 'Warp'],
    gravity_lens_transparent: ['Glass', 'Refraction', 'Transparent'],
    stone_press_v2:           ['Depth', '3D', 'Tactile'],
    brick_outline:            ['Outline', 'Glow', 'Structural'],
    depth_parallax:           ['AI Depth', '3D', 'Parallax'],
  };

  const renderActivateButton = () => {
    if (!selectedEffect) return null;
    const activatorMap: Record<string, { fn: () => void; disabled: boolean }> = {
      cursor_reveal:            { fn: activateEffect,                  disabled: !layerA || !layerB },
      gravity_lens:             { fn: activateGravityLens,             disabled: !glBaseImage },
      gravity_lens_transparent: { fn: activateGravityLensTransparent,  disabled: !gltBaseImage },
      stone_press_v2:           { fn: activateStonePressV2,            disabled: !sp2BaseImage },
      brick_outline:            { fn: activateBrickOutline,            disabled: !boBaseImage },
      depth_parallax:           { fn: activateDepthParallax,           disabled: !testWallpaper || isGeneratingDepth },
    };
    const item = activatorMap[selectedEffect];
    if (!item) return null;
    const isReapply = activeEffect === selectedEffect;
    const label = isGeneratingDepth && selectedEffect === 'depth_parallax'
      ? 'Generating…'
      : isReapply ? 'Re-Apply' : '▶ Activate';
    return (
      <button className="effects-activate-btn" onClick={item.fn} disabled={item.disabled}>
        {label}
      </button>
    );
  };

  const renderQualityStrip = () => (
    <div className="quality-strip">
      <span className={`quality-strip-fps${liveFps > 0 ? ' live' : ''}`}>
        {liveFps > 0 ? `${liveFps.toFixed(0)} FPS` : 'Idle'}
      </span>
      <div className="quality-strip-group">
        <span className="quality-strip-label">Frame Rate</span>
        <div className="chip-group">
          <button className={fpsCap === 30 ? 'active' : ''} onClick={() => handleFpsCapChange(30)}>30</button>
          <button className={fpsCap === 60 ? 'active' : ''} onClick={() => handleFpsCapChange(60)}>60</button>
          <button className={fpsCap === 0 ? 'active' : ''} onClick={() => handleFpsCapChange(0)}>Max</button>
        </div>
      </div>
      <div className="quality-strip-group">
        <span className="quality-strip-label">Resolution</span>
        <div className="chip-group">
          <button className={resolutionScale === 1.0 ? 'active' : ''} onClick={() => handleResolutionScaleChange(1.0)}>Native</button>
          <button className={resolutionScale === 0.75 ? 'active' : ''} onClick={() => handleResolutionScaleChange(0.75)}>75%</button>
          <button className={resolutionScale === 0.5 ? 'active' : ''} onClick={() => handleResolutionScaleChange(0.5)}>Half</button>
        </div>
      </div>
      <button className="ghost" onClick={handleQualityAuto} style={{ fontSize: '0.72rem', padding: '4px 10px', marginLeft: 'auto' }}>Auto</button>
    </div>
  );

  const renderActiveEffectControls = () => {
    if (selectedEffect === 'cursor_reveal') {
      return (
        <div className="effect-controls animate-fade-in">
          <div className="effect-section">
            <div className="effect-section-label">Wallpaper Layers</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Layer A – Background</div>
                <button className={`effect-import-btn${layerA ? ' has-file' : ''}`} onClick={() => handleImport(setLayerA, 'cursor_reveal')}>
                  {layerA ? layerA.split('\\').pop() : 'Import Image…'}
                </button>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Layer B – Reveal</div>
                <button className={`effect-import-btn${layerB ? ' has-file' : ''}`} onClick={() => handleImport(setLayerB, 'cursor_reveal')}>
                  {layerB ? layerB.split('\\').pop() : 'Import Image…'}
                </button>
              </div>
            </div>
          </div>
          <div className="effect-section">
            <div className="effect-section-label">Parameters</div>
            <div className="effect-params">
              <div className="control-group"><label>Brush Size ({brushSize}px)</label><input type="range" min="50" max="300" step="0.1" value={brushSize} onChange={(e) => handleCRSettingChange('brushSize', parseFloat(e.target.value), setBrushSize)} /></div>
              <div className="control-group"><label>Brush Hardness ({crBrushHardness.toFixed(2)})</label><input type="range" min="0.0" max="1.0" step="0.001" value={crBrushHardness} onChange={(e) => handleCRSettingChange('brushHardness', parseFloat(e.target.value), setCRBrushHardness)} /></div>
              <div className="control-group"><label>Trail Length ({crTrailLength.toFixed(1)}s)</label><input type="range" min="0.0" max="5.0" step="0.01" value={crTrailLength} onChange={(e) => handleCRSettingChange('trailLength', parseFloat(e.target.value), setCRTrailLength)} /></div>
              <div className="control-group"><label>Fade Out Speed ({crFadeSpeed.toFixed(3)})</label><input type="range" min="0.005" max="0.1" step="0.001" value={crFadeSpeed} onChange={(e) => handleCRSettingChange('fadeSpeed', parseFloat(e.target.value), setCRFadeSpeed)} /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '4px' }}>
              <input type="checkbox" id="crFadeResting" checked={crFadeWhenResting} onChange={(e) => {
                setCRFadeWhenResting(e.target.checked);
                handleCRSettingChange('fadeWhenResting', e.target.checked ? 1 : 0, () => {});
              }} style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }} />
              <label htmlFor="crFadeResting" style={{ margin: 0, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Disappear when cursor is resting</label>
            </div>
          </div>
        </div>
      );
    }
    if (selectedEffect === 'gravity_lens') {
      return (
        <div className="effect-controls animate-fade-in">
          <div className="effect-section">
            <div className="effect-section-label">Base Wallpaper</div>
            <button className={`effect-import-btn${glBaseImage ? ' has-file' : ''}`} onClick={() => handleImport(setGLBaseImage, 'gravity_lens')}>
              {glBaseImage ? glBaseImage.split('\\').pop() : 'Import Image…'}
            </button>
          </div>
          <div className="effect-section">
            <div className="effect-section-label">Parameters</div>
            <div className="effect-params">
              <div className="control-group"><label>Lens Strength ({glStrength.toFixed(1)})</label><input type="range" min="0" max="20" step="0.01" value={glStrength} onChange={(e) => handleGLSettingChange('lensStrength', parseFloat(e.target.value), setGLStrength)} /></div>
              <div className="control-group"><label>Lens Radius ({glRadius.toFixed(2)})</label><input type="range" min="0.02" max="0.25" step="0.001" value={glRadius} onChange={(e) => handleGLSettingChange('lensRadius', parseFloat(e.target.value), setGLRadius)} /></div>
              <div className="control-group"><label>Spring Stiffness ({glStiffness.toFixed(0)})</label><input type="range" min="10" max="200" step="0.1" value={glStiffness} onChange={(e) => handleGLSettingChange('stiffness', parseFloat(e.target.value), setGLStiffness)} /></div>
              <div className="control-group"><label>Spring Damping ({glDamping.toFixed(2)})</label><input type="range" min="0.70" max="0.99" step="0.001" value={glDamping} onChange={(e) => handleGLSettingChange('damping', parseFloat(e.target.value), setGLDamping)} /></div>
              <div className="control-group"><label>Chromatic Dispersion ({glDispersion.toFixed(3)})</label><input type="range" min="0" max="0.1" step="0.001" value={glDispersion} onChange={(e) => handleGLSettingChange('dispersion', parseFloat(e.target.value), setGLDispersion)} /></div>
              <div className="control-group"><label>Trail Length ({glTrailLength.toFixed(1)}s)</label><input type="range" min="0" max="5" step="0.01" value={glTrailLength} onChange={(e) => handleGLSettingChange('trailLength', parseFloat(e.target.value), setGLTrailLength)} /></div>
              <div className="control-group"><label>Fade Speed ({glFadeDecay >= 0.99 ? 'Never' : glFadeDecay.toFixed(2)})</label><input type="range" min="0.80" max="1.0" step="0.001" value={glFadeDecay} onChange={(e) => handleGLSettingChange('fadeDecay', parseFloat(e.target.value), setGLFadeDecay)} /></div>
            </div>
          </div>
        </div>
      );
    }
    if (selectedEffect === 'gravity_lens_transparent') {
      return (
        <div className="effect-controls animate-fade-in">
          <div className="effect-section">
            <div className="effect-section-label">Base Wallpaper</div>
            <button className={`effect-import-btn${gltBaseImage ? ' has-file' : ''}`} onClick={() => handleImport(setgltBaseImage, 'gravity_lens_transparent')}>
              {gltBaseImage ? gltBaseImage.split('\\').pop() : 'Import Image…'}
            </button>
          </div>
          <div className="effect-section">
            <div className="effect-section-label">Parameters</div>
            <div className="effect-params">
              <div className="control-group"><label>Press Depth ({gltDepth.toFixed(3)})</label><input type="range" min="0" max="0.15" step="0.001" value={gltDepth} onChange={(e) => handleGLTSettingChange('pressDepth', parseFloat(e.target.value), setgltDepth)} /></div>
              <div className="control-group"><label>Press Radius ({gltRadius.toFixed(2)})</label><input type="range" min="0.02" max="0.25" step="0.001" value={gltRadius} onChange={(e) => handleGLTSettingChange('pressRadius', parseFloat(e.target.value), setgltRadius)} /></div>
              <div className="control-group"><label>Spring Stiffness ({gltStiffness.toFixed(0)})</label><input type="range" min="10" max="200" step="0.1" value={gltStiffness} onChange={(e) => handleGLTSettingChange('stiffness', parseFloat(e.target.value), setgltStiffness)} /></div>
              <div className="control-group"><label>Spring Damping ({gltDamping.toFixed(2)})</label><input type="range" min="0.70" max="0.99" step="0.001" value={gltDamping} onChange={(e) => handleGLTSettingChange('damping', parseFloat(e.target.value), setgltDamping)} /></div>
              <div className="control-group"><label>Chromatic Dispersion ({gltDispersion.toFixed(3)})</label><input type="range" min="0" max="0.1" step="0.001" value={gltDispersion} onChange={(e) => handleGLTSettingChange('dispersion', parseFloat(e.target.value), setgltDispersion)} /></div>
              <div className="control-group"><label>Core Darkening ({gltDarkening.toFixed(2)})</label><input type="range" min="0" max="1.0" step="0.001" value={gltDarkening} onChange={(e) => handleGLTSettingChange('coreDarkening', parseFloat(e.target.value), setgltDarkening)} /></div>
              <div className="control-group"><label>Directional Shading ({gltShading.toFixed(2)})</label><input type="range" min="0" max="1.0" step="0.001" value={gltShading} onChange={(e) => handleGLTSettingChange('shadingStrength', parseFloat(e.target.value), setgltShading)} /></div>
              <div className="control-group"><label>Trail Length ({gltTrailLength.toFixed(1)}s)</label><input type="range" min="0" max="5" step="0.01" value={gltTrailLength} onChange={(e) => handleGLTSettingChange('trailLength', parseFloat(e.target.value), setgltTrailLength)} /></div>
              <div className="control-group"><label>Fade Speed ({gltFadeDecay >= 0.99 ? 'Never' : gltFadeDecay.toFixed(2)})</label><input type="range" min="0.80" max="1.0" step="0.001" value={gltFadeDecay} onChange={(e) => handleGLTSettingChange('fadeDecay', parseFloat(e.target.value), setgltFadeDecay)} /></div>
            </div>
          </div>
        </div>
      );
    }
    if (selectedEffect === 'stone_press_v2') {
      return (
        <div className="effect-controls animate-fade-in">
          <div className="effect-section">
            <div className="effect-section-label">Base Wallpaper</div>
            <button className={`effect-import-btn${sp2BaseImage ? ' has-file' : ''}`} onClick={() => handleImport(setsp2BaseImage, 'stone_press_v2')}>
              {sp2BaseImage ? sp2BaseImage.split('\\').pop() : 'Import Image…'}
            </button>
          </div>
          <div className="effect-section">
            <div className="effect-section-label">Parameters</div>
            <div className="effect-params">
              <div className="control-group"><label>Press Depth ({sp2Depth.toFixed(2)})</label><input type="range" min="0" max="10.0" step="0.01" value={sp2Depth} onChange={(e) => handleSP2SettingChange('pressDepth', parseFloat(e.target.value), setsp2Depth)} /></div>
              <div className="control-group"><label>Press Radius ({sp2Radius.toFixed(2)})</label><input type="range" min="0.01" max="1.0" step="0.001" value={sp2Radius} onChange={(e) => handleSP2SettingChange('pressRadius', parseFloat(e.target.value), setsp2Radius)} /></div>
              <div className="control-group"><label>Spring Stiffness ({sp2Stiffness.toFixed(0)})</label><input type="range" min="10" max="300" step="0.1" value={sp2Stiffness} onChange={(e) => handleSP2SettingChange('stiffness', parseFloat(e.target.value), setsp2Stiffness)} /></div>
              <div className="control-group"><label>Spring Damping ({sp2Damping.toFixed(2)})</label><input type="range" min="0.70" max="0.99" step="0.001" value={sp2Damping} onChange={(e) => handleSP2SettingChange('damping', parseFloat(e.target.value), setsp2Damping)} /></div>
              <div className="control-group"><label>Depth Darkening ({sp2Darkening.toFixed(2)})</label><input type="range" min="0" max="1.0" step="0.001" value={sp2Darkening} onChange={(e) => handleSP2SettingChange('depthDarkening', parseFloat(e.target.value), setsp2Darkening)} /></div>
              <div className="control-group"><label>Directional Shading ({sp2DirectionalShading.toFixed(2)})</label><input type="range" min="0" max="1.0" step="0.001" value={sp2DirectionalShading} onChange={(e) => handleSP2SettingChange('directionalShading', parseFloat(e.target.value), setsp2DirectionalShading)} /></div>
              <div className="control-group"><label>Parallax Strength ({sp2ParallaxStrength.toFixed(2)})</label><input type="range" min="0" max="1.0" step="0.001" value={sp2ParallaxStrength} onChange={(e) => handleSP2SettingChange('parallaxStrength', parseFloat(e.target.value), setsp2ParallaxStrength)} /></div>
            </div>
          </div>
        </div>
      );
    }
    if (selectedEffect === 'brick_outline') {
      return (
        <div className="effect-controls animate-fade-in">
          <div className="effect-section">
            <div className="effect-section-label">Base Wallpaper</div>
            <button className={`effect-import-btn${boBaseImage ? ' has-file' : ''}`} onClick={() => handleImport(setBOBaseImage, 'brick_outline')}>
              {boBaseImage ? boBaseImage.split('\\').pop() : 'Import Image…'}
            </button>
          </div>
          <div className="effect-section">
            <div className="effect-section-label">Parameters</div>
            <div className="effect-params">
              <div className="control-group"><label>Brick Width ({boBrickWidth.toFixed(1)})</label><input type="range" min="10" max="300" step="0.1" value={boBrickWidth} onChange={(e) => { const v = parseFloat(e.target.value); setBOBrickWidth(v); handleBOSettingChange('brickWidth', v); }} /></div>
              <div className="control-group"><label>Brick Height ({boBrickHeight.toFixed(1)})</label><input type="range" min="10" max="300" step="0.1" value={boBrickHeight} onChange={(e) => { const v = parseFloat(e.target.value); setBOBrickHeight(v); handleBOSettingChange('brickHeight', v); }} /></div>
              <div className="control-group"><label>Line Thickness ({boLineThickness.toFixed(1)})</label><input type="range" min="0.5" max="10" step="0.01" value={boLineThickness} onChange={(e) => { const v = parseFloat(e.target.value); setBOLineThickness(v); handleBOSettingChange('lineThickness', v); }} /></div>
              <div className="control-group"><label>Effect Radius ({boEffectRadius.toFixed(2)})</label><input type="range" min="0.01" max="1.0" step="0.001" value={boEffectRadius} onChange={(e) => { const v = parseFloat(e.target.value); setBOEffectRadius(v); handleBOSettingChange('effectRadius', v); }} /></div>
              <div className="control-group"><label>Edge Softness ({boEdgeSoftness.toFixed(2)})</label><input type="range" min="0.0" max="0.5" step="0.001" value={boEdgeSoftness} onChange={(e) => { const v = parseFloat(e.target.value); setBOEdgeSoftness(v); handleBOSettingChange('edgeSoftness', v); }} /></div>
              <div className="control-group"><label>Glow Intensity ({boGlowIntensity.toFixed(2)})</label><input type="range" min="0.0" max="3.0" step="0.01" value={boGlowIntensity} onChange={(e) => { const v = parseFloat(e.target.value); setBOGlowIntensity(v); handleBOSettingChange('glowIntensity', v); }} /></div>
              <div className="control-group" style={{ gridColumn: '1 / -1' }}>
                <label>Outline Color</label>
                <input type="color" value={boOutlineColor} onChange={(e) => handleBOColorChange(e.target.value)} style={{ width: '100%', height: '36px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (selectedEffect === 'depth_parallax') {
      return (
        <div className="effect-controls animate-fade-in">
          <div className="effect-section">
            <div className="effect-section-label">Test Wallpaper</div>
            <button className={`effect-import-btn${testWallpaper ? ' has-file' : ''}`} onClick={() => handleImport(setTestWallpaper, 'depth_parallax', async (newPath) => {
              setIsGeneratingDepth(true);
              setDepthError(null);
              try {
                await generateDepthMap(newPath);
              } catch (err: any) {
                setDepthError('Depth generation failed: ' + err.toString());
              } finally {
                setIsGeneratingDepth(false);
              }
            })}>
              {testWallpaper ? testWallpaper.split('\\').pop() : 'Import Image…'}
            </button>
            {isGeneratingDepth && <p style={{ color: 'var(--accent)', marginTop: '8px', fontSize: '0.8rem' }}>Generating ML Depth Map…</p>}
            {depthError && <p style={{ color: 'var(--danger)', marginTop: '8px', fontSize: '0.8rem' }}>{depthError}</p>}
          </div>
          <div className="effect-section">
            <div className="effect-section-label">Parameters</div>
            <div className="control-group">
              <label>Parallax Strength ({parallaxStrength.toFixed(3)})</label>
              <input type="range" min="0.01" max="0.2" step="0.001" value={parallaxStrength} onChange={(e) => {
                const val = parseFloat(e.target.value);
                setParallaxStrength(val);
                if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
                debounceTimer.current = window.setTimeout(() => setSetting('parallaxStrength', val), 50);
              }} />
            </div>
          </div>
        </div>
      );
    }
    return null;
  };


  return (
    <div className="effects-layout">
      {/* Header */}
      <div className="effects-header">
        <h2 className="effects-header-title">Effects Studio</h2>
        <span className="effects-header-quote">"Same wallpaper.<br />A different world."</span>
      </div>

      {/* 3-column body */}
      <div className="effects-body">
        {/* Col 1: dial */}
        <EffectDial
          selectedEffect={selectedEffect}
          activeEffect={activeEffect}
          onSelect={(id) => setSelectedEffect(id)}
        />

        {/* Col 2 (center): quality + sliders */}
        <div className="effects-controls-panel">
          {renderQualityStrip()}
          {renderActiveEffectControls()}
        </div>

        {/* Col 3 (right): description, centered */}
        <div className="effects-info">
          {selectedEffect ? (
            <>
              <div className="effects-info-content">
                <h2 className="effects-info-name">{EFFECT_LABELS[selectedEffect]}</h2>
                {activeEffect === selectedEffect && (
                  <span className="effects-info-active-badge">● Active</span>
                )}
                <div className="effects-info-divider" />
                <p className="effects-info-desc">{EFFECT_DESCRIPTIONS[selectedEffect]}</p>
                <div className="effects-info-tags">
                  {EFFECT_TAGS[selectedEffect]?.map(tag => (
                    <span key={tag} className="effects-info-tag">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="effects-info-footer">
                {renderActivateButton()}
                <button
                  className="effects-stop-btn"
                  onClick={handleRemoveEffect}
                  disabled={!activeEffect}
                >
                  Stop Effect
                </button>
              </div>
            </>
          ) : (
            <p style={{ margin: 'auto', fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
              Select an effect
            </p>
          )}
        </div>
      </div>

      {/* Wallpaper picker modal */}
      {showImportPickerFor && (
        <div className="modal-overlay" onClick={() => setShowImportPickerFor(null)}>
          <div
            className="card"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '500px', width: '100%', padding: '24px' }}
          >
            <h2 style={{ marginTop: 0 }}>Select Wallpaper Source</h2>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <button className={pickerSource === 'options' ? 'primary' : 'secondary'} onClick={() => setPickerSource('options')} style={{ flex: 1 }}>File Explorer</button>
              <button className={pickerSource === 'gallery' ? 'primary' : 'secondary'} onClick={() => setPickerSource('gallery')} style={{ flex: 1 }}>My Baked Wallpapers</button>
            </div>
            {pickerSource === 'options' && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <button className="primary" onClick={async () => {
                  await executeNativeImport(showImportPickerFor.setter, showImportPickerFor.onComplete);
                  setShowImportPickerFor(null);
                }}>Browse Local Files…</button>
              </div>
            )}
            {pickerSource === 'gallery' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                {pickerWallpapers.length === 0 ? (
                  <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>No baked wallpapers found.</p>
                ) : (
                  pickerWallpapers.map((wp, idx) => (
                    <div key={idx}
                      style={{ position: 'relative', cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: '2px solid transparent' }}
                      onClick={() => { showImportPickerFor.setter(wp); showImportPickerFor.onComplete?.(wp); setShowImportPickerFor(null); }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                    >
                      <img src={convertFileSrc(wp)} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ))
                )}
              </div>
            )}
            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button className="secondary" onClick={() => setShowImportPickerFor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
