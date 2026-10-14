import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { enable as enableAuto, disable as disableAuto, isEnabled as isAutoEnabled } from '@tauri-apps/plugin-autostart';
import './index.css';

import {
  setSetting,
  setFpsCap,
  setResolutionScale,
  setQualityAuto,
  importWallpaper,
  importWebAsset,
  startWebWallpaper,
  stopWebWallpaper,
} from './ipc';
import { applyWallpaper, setEffect as applyEffectEngine, removeEffect } from './wallpaperManager';
import {
  loadSettings,
  saveSettings,
  AppSettings,
  defaultSettings,
  resetToDefaults,
  getActiveSession,
  saveActiveSession,
  saveEffectSettings,
  saveQualitySetting,
  loadSelectedEffect,
  saveSelectedEffect,
} from './store';

// Master parameter specifications for the 6 native effects
const EFFECTS_DATA: Record<string, Array<{ name: string; key: string; min: number; max: number; step: number; val: number; unit: string }>> = {
  'Cursor Reveal': [
    { name: 'Brush Size', key: 'brushSize', min: 20, max: 400, step: 1, val: 160, unit: 'px' },
    { name: 'Brush Hardness', key: 'brushHardness', min: 0, max: 1, step: 0.05, val: 0.20, unit: '' },
    { name: 'Trail Length', key: 'trailLength', min: 0.1, max: 5, step: 0.1, val: 1.0, unit: 's' },
    { name: 'Fade Out Speed', key: 'fadeSpeed', min: 0.005, max: 0.2, step: 0.005, val: 0.035, unit: '' },
  ],
  'Gravity Lens': [
    { name: 'Lens Strength', key: 'lensStrength', min: 0, max: 15, step: 0.5, val: 5.0, unit: '' },
    { name: 'Lens Radius', key: 'lensRadius', min: 0.01, max: 0.5, step: 0.01, val: 0.08, unit: '' },
    { name: 'Spring Stiffness', key: 'stiffness', min: 10, max: 150, step: 1, val: 50, unit: '' },
    { name: 'Spring Damping', key: 'damping', min: 0.1, max: 1, step: 0.05, val: 0.90, unit: '' },
    { name: 'Chromatic Dispersion', key: 'dispersion', min: 0, max: 0.1, step: 0.005, val: 0.02, unit: '' },
    { name: 'Core Darkening', key: 'coreDarkening', min: 0, max: 1, step: 0.05, val: 0.50, unit: '' },
    { name: 'Fade Speed', key: 'fadeDecay', min: 0.8, max: 1, step: 0.01, val: 0.92, unit: '' },
  ],
  'Glass Lens': [
    { name: 'Press Depth', key: 'pressDepth', min: 0.005, max: 0.2, step: 0.005, val: 0.03, unit: '' },
    { name: 'Press Radius', key: 'pressRadius', min: 0.01, max: 0.5, step: 0.01, val: 0.08, unit: '' },
    { name: 'Spring Stiffness', key: 'stiffness', min: 10, max: 150, step: 1, val: 50, unit: '' },
    { name: 'Spring Damping', key: 'damping', min: 0.1, max: 1, step: 0.05, val: 0.90, unit: '' },
    { name: 'Chromatic Dispersion', key: 'dispersion', min: 0, max: 0.1, step: 0.005, val: 0.02, unit: '' },
    { name: 'Core Darkening', key: 'coreDarkening', min: 0, max: 1, step: 0.05, val: 0.15, unit: '' },
    { name: 'Directional Shading', key: 'shadingStrength', min: 0, max: 1, step: 0.05, val: 0.50, unit: '' },
    { name: 'Fade Speed', key: 'fadeDecay', min: 0.8, max: 1, step: 0.01, val: 0.92, unit: '' },
  ],
  'Space Ball': [
    { name: 'Press Depth', key: 'pressDepth', min: 0.5, max: 5, step: 0.1, val: 2.0, unit: '' },
    { name: 'Press Radius', key: 'pressRadius', min: 0.05, max: 1, step: 0.05, val: 0.30, unit: '' },
    { name: 'Spring Stiffness', key: 'stiffness', min: 10, max: 300, step: 1, val: 50, unit: '' },
    { name: 'Spring Damping', key: 'damping', min: 0.1, max: 1, step: 0.05, val: 0.90, unit: '' },
    { name: 'Parallax Strength', key: 'parallaxStrength', min: 0, max: 1, step: 0.05, val: 0.20, unit: '' },
  ],
  'Brick Outline': [
    { name: 'Brick Width', key: 'brickWidth', min: 20, max: 300, step: 5, val: 100, unit: 'px' },
    { name: 'Brick Height', key: 'brickHeight', min: 10, max: 200, step: 5, val: 50, unit: 'px' },
    { name: 'Line Thickness', key: 'lineThickness', min: 1, max: 12, step: 0.5, val: 3.0, unit: 'px' },
    { name: 'Effect Radius', key: 'effectRadius', min: 0.01, max: 1, step: 0.01, val: 0.20, unit: '' },
    { name: 'Glow Intensity', key: 'glowIntensity', min: 0.1, max: 3, step: 0.1, val: 1.0, unit: '' },
  ],
  'Depth Parallax': [
    { name: 'Parallax Strength', key: 'parallaxStrength', min: 0.01, max: 0.3, step: 0.005, val: 0.05, unit: '' },
  ],
};

const EFFECT_TO_ENGINE_ID: Record<string, string> = {
  'Cursor Reveal': 'cursor_reveal',
  'Gravity Lens': 'gravity_lens',
  'Glass Lens': 'gravity_lens_transparent',
  'Space Ball': 'stone_press_v2',
  'Brick Outline': 'brick_outline',
  'Depth Parallax': 'depth_parallax',
};

const ENGINE_ID_TO_DISPLAY: Record<string, string> = {
  cursor_reveal: 'Cursor Reveal',
  gravity_lens: 'Gravity Lens',
  gravity_lens_transparent: 'Glass Lens',
  stone_press_v2: 'Space Ball',
  brick_outline: 'Brick Outline',
  depth_parallax: 'Depth Parallax',
};

interface BakedCollage {
  id: number;
  title: string;
  date: string;
  color: string;
  points: Array<{ x: number; y: number }>;
}

export default function App() {
  // Splash screen state
  const [showSplash, setShowSplash] = useState(true);

  // Quality & Engine states
  const resolutions = ['Native', '75%', 'Half', 'Auto'];
  const resScales = [1.0, 0.75, 0.5, 1.0];
  const fpsOptions = ['60', 'Max', '30'];
  const fpsValues = [60, 0, 30];

  const [resIdx, setResIdx] = useState(0);
  const [fpsIdx, setFpsIdx] = useState(0);

  // Active / Selected Effect state
  const [selectedEffect, setSelectedEffect] = useState<string>('Cursor Reveal');
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [layerB, setLayerB] = useState<string | null>(null);

  // Sliders state (cached per effect)
  const [effectParams, setEffectParams] = useState<Record<string, Record<string, number>>>({});

  // Side popup state
  const [sidePopupOpen, setSidePopupOpen] = useState(false);
  const [sidePopupView, setSidePopupView] = useState<'effects' | 'sliders'>('effects');

  // Modals state
  const [openModal, setOpenModal] = useState<string | null>(null);

  // 3D Web Wallpaper state
  const [webModelPath, setWebModelPath] = useState<string | null>(null);
  const [webStatus, setWebStatus] = useState<string>('Standby');
  const [webBgType, setWebBgType] = useState<'color' | 'image'>('color');
  const [webBgColor, setWebBgColor] = useState<string>('#b6beb7');
  const [webBgImage, setWebBgImage] = useState<string | null>(null);
  const [webZoom, setWebZoom] = useState<number>(1.0);
  const [webHOff, setWebHOff] = useState<number>(0.0);
  const [webVOff, setWebVOff] = useState<number>(0.0);
  const [webSens, setWebSens] = useState<number>(0.2);

  // Settings state
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);
  const [autostartEnabled, setAutostartEnabled] = useState(false);

  // Theme customizer state
  const [highlightColor, setHighlightColor] = useState('#dfff4f');
  const [secondaryColor, setSecondaryColor] = useState('#f4f6f4');

  // Gallery / Canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasBgColor, setCanvasBgColor] = useState('#181a18');
  const [shapeFillColor, setShapeFillColor] = useState('#dfff4f');
  const [canvasShapes, setCanvasShapes] = useState<Array<{ name: string; color: string; points: Array<{ x: number; y: number }> }>>([
    { name: 'Shape 1', color: '#dfff4f', points: [{ x: 110, y: 90 }, { x: 540, y: 130 }, { x: 580, y: 390 }, { x: 140, y: 370 }] }
  ]);
  const [bakedCollages, setBakedCollages] = useState<BakedCollage[]>([
    { id: 1, title: 'Neon Split Polygon', date: 'Saved Today', color: '#dfff4f', points: [{ x: 110, y: 90 }, { x: 540, y: 130 }, { x: 490, y: 380 }, { x: 150, y: 360 }] },
    { id: 2, title: 'Dual Diagonal Mask', date: 'Saved Yesterday', color: '#84f5d5', points: [{ x: 60, y: 60 }, { x: 620, y: 80 }, { x: 580, y: 410 }, { x: 90, y: 390 }] },
    { id: 3, title: 'Minimalist Center Frame', date: 'Saved 3 days ago', color: '#ffffff', points: [{ x: 180, y: 110 }, { x: 520, y: 110 }, { x: 520, y: 370 }, { x: 180, y: 370 }] }
  ]);

  // 1. Initial Launch & Session Restore
  useEffect(() => {
    // Splash screen fade
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1100);

    // Restore custom theme colors from localStorage
    const savedHL = localStorage.getItem('graffiti_theme_highlight');
    const savedSec = localStorage.getItem('graffiti_theme_secondary');
    if (savedHL) {
      setHighlightColor(savedHL);
      document.documentElement.style.setProperty('--highlight', savedHL);
    }
    if (savedSec) {
      setSecondaryColor(savedSec);
      document.documentElement.style.setProperty('--secondary', savedSec);
    }

    // Initialize Autostart status
    isAutoEnabled().then(setAutostartEnabled).catch(() => {});

    // Initialize App & Quality Settings
    loadSettings().then(setAppSettings).catch(console.error);

    // Initialize Selected Effect & Active Session
    loadSelectedEffect().then((ef) => {
      if (ef && ENGINE_ID_TO_DISPLAY[ef]) {
        setSelectedEffect(ENGINE_ID_TO_DISPLAY[ef]);
      }
    });

    getActiveSession().then((session) => {
      if (session) {
        if (session.effect === 'web-wallpaper') {
          setWebStatus('Running on Desktop');
        } else if (session.effect && ENGINE_ID_TO_DISPLAY[session.effect]) {
          setActiveEffect(ENGINE_ID_TO_DISPLAY[session.effect]);
          if (session.layerA) setSelectedImage(session.layerA);
          if (session.layerB) setLayerB(session.layerB);
        }
      }
    });

    // Populate initial params
    const initialParams: Record<string, Record<string, number>> = {};
    Object.entries(EFFECTS_DATA).forEach(([effName, paramsList]) => {
      initialParams[effName] = {};
      paramsList.forEach(p => {
        initialParams[effName][p.key] = p.val;
      });
    });
    setEffectParams(initialParams);

    return () => clearTimeout(splashTimer);
  }, []);

  // 2. Draw canvas whenever shapes or background change
  useEffect(() => {
    if (openModal !== 'modal-canvas' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    canvasShapes.forEach(shape => {
      ctx.beginPath();
      shape.points.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fillStyle = shape.color + '44';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = shape.color;
      ctx.stroke();

      shape.points.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.stroke();
      });
    });
  }, [openModal, canvasBgColor, canvasShapes]);

  // 3. Handlers for Quality (RES & FPS)
  const handleCycleRes = async () => {
    const nextIdx = (resIdx + 1) % resolutions.length;
    setResIdx(nextIdx);
    const scale = resScales[nextIdx];
    if (resolutions[nextIdx] === 'Auto') {
      await setQualityAuto();
    } else {
      await setResolutionScale(scale);
      await saveQualitySetting('resolutionScale', scale);
    }
  };

  const handleCycleFps = async () => {
    const nextIdx = (fpsIdx + 1) % fpsOptions.length;
    setFpsIdx(nextIdx);
    const fps = fpsValues[nextIdx];
    await setFpsCap(fps);
    await saveQualitySetting('fpsCap', fps);
  };

  // 4. Handlers for Effects
  const handleChooseImage = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
        multiple: false,
      });
      if (typeof selected === 'string') {
        const imported = await importWallpaper(selected);
        setSelectedImage(imported);
        // For Cursor reveal, also set default layerB if empty
        if (!layerB) setLayerB(imported);
      }
    } catch (err) {
      console.error('Failed to import image:', err);
    }
  };

  const handleSliderChange = (paramKey: string, value: number) => {
    setEffectParams(prev => ({
      ...prev,
      [selectedEffect]: {
        ...(prev[selectedEffect] || {}),
        [paramKey]: value,
      }
    }));

    // Real-time IPC push to running shader
    setSetting(paramKey, value);

    // Save effect settings
    const current = { ...(effectParams[selectedEffect] || {}), [paramKey]: value };
    const engineId = EFFECT_TO_ENGINE_ID[selectedEffect];
    if (engineId) {
      saveEffectSettings(engineId, current);
    }
  };

  const handleActivateEffect = async () => {
    const engineId = EFFECT_TO_ENGINE_ID[selectedEffect];
    if (!engineId) return;

    try {
      if (selectedImage) {
        await applyWallpaper(selectedImage, layerB || selectedImage);
      }
      await applyEffectEngine(engineId);

      // Push all parameters to backend
      const params = effectParams[selectedEffect] || {};
      for (const [k, v] of Object.entries(params)) {
        await setSetting(k, v);
      }

      setActiveEffect(selectedEffect);
      await saveSelectedEffect(engineId);
      await saveActiveSession({
        effect: engineId,
        layerA: selectedImage || '',
        layerB: layerB || selectedImage || '',
      });
    } catch (err) {
      console.error('Failed to activate effect:', err);
    }
  };

  const handleStopEffect = async () => {
    try {
      await removeEffect();
      setActiveEffect(null);
      await saveActiveSession(null);
    } catch (err) {
      console.error('Failed to stop effect:', err);
    }
  };

  // 5. 3D Web Wallpaper Handlers
  const handleImportGlb = async () => {
    try {
      const selected = await open({
        filters: [{ name: '3D Models', extensions: ['glb', 'gltf'] }],
        multiple: false,
      });
      if (typeof selected === 'string') {
        const imported = await importWebAsset(selected);
        setWebModelPath(imported);
      }
    } catch (err) {
      console.error('Failed to import model:', err);
    }
  };

  const handleActivate3D = async () => {
    if (!webModelPath) {
      alert('Please select a 3D .glb model first.');
      return;
    }
    try {
      await startWebWallpaper(
        webModelPath,
        webBgType,
        webBgColor,
        webBgImage || undefined,
        webSens,
        webZoom,
        webHOff,
        webVOff,
        true,
        0,
        0
      );
      setWebStatus('Running on Desktop');
      await saveActiveSession({ effect: 'web-wallpaper', layerA: '', layerB: '' });
      setOpenModal(null);
    } catch (err) {
      console.error('Failed to start 3D wallpaper:', err);
      alert('Failed to start 3D wallpaper: ' + err);
    }
  };

  const handleStop3D = async () => {
    try {
      await stopWebWallpaper();
      setWebStatus('Standby');
      await saveActiveSession(null);
    } catch (err) {
      console.error('Failed to stop 3D wallpaper:', err);
    }
  };

  // 6. Theme Customization Handlers
  const handleHighlightChange = (color: string) => {
    setHighlightColor(color);
    document.documentElement.style.setProperty('--highlight', color);
    localStorage.setItem('graffiti_theme_highlight', color);
  };

  const handleSecondaryChange = (color: string) => {
    setSecondaryColor(color);
    document.documentElement.style.setProperty('--secondary', color);
    localStorage.setItem('graffiti_theme_secondary', color);
  };

  const handleResetTheme = () => {
    handleHighlightChange('#dfff4f');
    handleSecondaryChange('#f4f6f4');
  };

  // 7. Settings Handlers
  const handleToggleAutostart = async () => {
    try {
      if (autostartEnabled) {
        await disableAuto();
        setAutostartEnabled(false);
      } else {
        await enableAuto();
        setAutostartEnabled(true);
      }
    } catch (err) {
      console.error('Failed to toggle autostart:', err);
    }
  };

  const handleUpdateSetting = async (key: keyof AppSettings, val: any) => {
    const updated = { ...appSettings, [key]: val };
    setAppSettings(updated);
    await saveSettings(updated);
  };

  const handleResetDefaults = async () => {
    if (confirm('Reset all settings to defaults? This will restart the renderer engine.')) {
      await resetToDefaults();
      setAppSettings(defaultSettings);
    }
  };

  return (
    <>
      {/* 1. INITIAL LOGO SPLASH SCREEN */}
      <div id="splash-screen" className={showSplash ? '' : 'hidden'}>
        <div className="splash-logo-box">Graffiti</div>
        <div className="splash-sub">Your Wallpaper Workspace</div>
      </div>

      {/* 2. MAIN BENTO WORKSPACE */}
      <main className="workspace-wrapper">

        {/* ================= CARD 1: EFFECTS STUDIO ================= */}
        <div className="card-effects-wrapper">
          {/* Two Floating Circles above Card 1: Resolution & FPS */}
          <div className="card-effects-cutout">
            <button
              className="top-circle-btn"
              id="btn-cycle-res"
              title="Click to cycle Resolution"
              onClick={handleCycleRes}
            >
              <span className="circle-label">RES</span>
              <span className="circle-val">{resolutions[resIdx]}</span>
            </button>
            <button
              className="top-circle-btn"
              id="btn-cycle-fps"
              title="Click to cycle Frame Rate"
              onClick={handleCycleFps}
            >
              <span className="circle-label">FPS</span>
              <span className="circle-val">{fpsOptions[fpsIdx]}</span>
            </button>
          </div>

          <section className="card-effects">
            <div className="effects-header-meta">
              <div className="effects-status-tag">
                <span className={`status-dot ${activeEffect ? 'active' : ''}`} />
                <span>{activeEffect ? `Active: ${activeEffect}` : 'Native GPU Ready'}</span>
              </div>
              <h1 className="card-title" style={{ marginTop: '10px' }}>Effects Studio</h1>
              <p className="card-subtitle">Real-time interactive desktop shaders</p>
            </div>

            <div className="effects-controls-grid">
              <div className="control-row-split">
                {/* Choose Effect button */}
                <button
                  className="pill-select-btn"
                  id="btn-choose-effect"
                  onClick={() => {
                    setSidePopupView('effects');
                    setSidePopupOpen(true);
                  }}
                >
                  <span>{selectedEffect}</span>
                  <span className="caret">▸</span>
                </button>

                {/* Sliders button */}
                <button
                  className="pill-select-btn"
                  id="btn-open-sliders"
                  onClick={() => {
                    setSidePopupView('sliders');
                    setSidePopupOpen(true);
                  }}
                >
                  <span>Sliders</span>
                  <span className="caret">▸</span>
                </button>
              </div>

              {/* Choose Image button */}
              <button
                className="pill-select-btn"
                id="btn-choose-image"
                onClick={handleChooseImage}
              >
                <span>{selectedImage ? selectedImage.split('\\').pop() : 'Choose Image'}</span>
                <span className="caret">Browse</span>
              </button>
            </div>

            <div className="effects-bottom-bar">
              <button className="btn-dark-pill" id="btn-activate-effect" onClick={handleActivateEffect}>
                Activate
              </button>
              <button className="btn-outline-pill" id="btn-stop-effect" onClick={handleStopEffect}>
                Stop Effect
              </button>
            </div>
          </section>

          {/* SIDE POPUP: Aligned to top border & right side of Effects Studio */}
          {sidePopupOpen && (
            <aside className="effects-side-popup" id="effects-side-popup">
              <div>
                <div className="popup-top-bar">
                  <h2>{sidePopupView === 'effects' ? 'Choose Effect' : `${selectedEffect} Sliders`}</h2>
                  <button className="close-circle-x" onClick={() => setSidePopupOpen(false)}>✕</button>
                </div>

                {/* View A: Effect Selector */}
                {sidePopupView === 'effects' && (
                  <div className="effect-option-list">
                    {Object.keys(EFFECTS_DATA).map(name => (
                      <button
                        key={name}
                        className={`effect-item-btn ${selectedEffect === name ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedEffect(name);
                          setSidePopupView('sliders');
                        }}
                      >
                        <span className="ef-name">{name}</span>
                        <span className="ef-sub">{EFFECTS_DATA[name].length} params</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* View B: Dynamic Sliders */}
                {sidePopupView === 'sliders' && (
                  <div className="sliders-list">
                    {(EFFECTS_DATA[selectedEffect] || []).map((p) => {
                      const curVal = effectParams[selectedEffect]?.[p.key] ?? p.val;
                      return (
                        <div key={p.key} className="slider-group">
                          <div className="slider-label-row">
                            <span>{p.name}</span>
                            <span>{curVal}{p.unit}</span>
                          </div>
                          <input
                            type="range"
                            min={p.min}
                            max={p.max}
                            step={p.step}
                            value={curVal}
                            onChange={(e) => handleSliderChange(p.key, parseFloat(e.target.value))}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {sidePopupView === 'effects' ? 'Select an effect to configure' : 'Live shader parameters'}
                </span>
                <button
                  className="btn-dark-pill"
                  style={{ padding: '8px 16px', fontSize: '0.78rem' }}
                  onClick={() => setSidePopupOpen(false)}
                >
                  Done
                </button>
              </div>
            </aside>
          )}
        </div>

        {/* ================= CARD 2: GALLERY ================= */}
        <section className="bento-card card-gallery">
          <div className="gallery-top-row">
            <div>
              <h2 className="card-title">Gallery</h2>
              <p className="card-subtitle">Custom polygon masks & saved collages</p>
            </div>
            <span className="badge-outline">{bakedCollages.length} Baked Saved</span>
          </div>

          <div className="gallery-capsules">
            <button className="gallery-capsule-btn" onClick={() => setOpenModal('modal-canvas')}>
              <span className="cap-num">Workspace 01</span>
              <div>
                <div className="cap-title">Canvas</div>
                <div className="cap-desc">Draw shapes, fill colors or images & layer masks</div>
              </div>
            </button>

            <button className="gallery-capsule-btn" onClick={() => setOpenModal('modal-baked')}>
              <span className="cap-num">Library 02</span>
              <div>
                <div className="cap-title">Baked Wallpapers</div>
                <div className="cap-desc">Activate or re-open saved collages on Canvas</div>
              </div>
            </button>
          </div>

          <div className="gallery-timeline-line">
            <span>Local Storage Engine</span>
            <span>Non-destructive editing</span>
          </div>
        </section>

        {/* ================= CARD 3: WEB WALLPAPER ================= */}
        <section className="bento-card card-web">
          <div className="web-header-row">
            <div>
              <h2 className="card-title">Web wallpaper</h2>
              <p className="card-subtitle">Interactive 3D GLB scenes & cursor camera</p>
            </div>
            <button className="btn-dark-pill" onClick={() => setOpenModal('modal-web')}>
              Set Model
            </button>
          </div>

          <div className="web-bars-stack">
            <div className="roadmap-bar muted">
              <span>Active Model</span>
              <span>{webModelPath ? webModelPath.split('\\').pop() : 'None Loaded (.glb)'}</span>
            </div>
            <div className="roadmap-bar highlight-bar">
              <span>3D Engine State</span>
              <span>{webStatus}</span>
            </div>
          </div>

          <div className="web-actions-row">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Hardware-accelerated WebGL viewport
            </span>
            <button className="btn-outline-pill" onClick={handleStop3D}>
              Stop 3D Wallpaper
            </button>
          </div>
        </section>

        {/* ================= CARD 4 AREA: SETTINGS, THEME, ABOUT ================= */}
        <div className="subgrid-three">
          {/* Mini Card 1: Settings */}
          <button className="mini-card-settings" onClick={() => setOpenModal('settings-page')}>
            <div className="settings-circle-badge">S</div>
            <div className="settings-card-text">
              <div className="s-title">Settings</div>
              <div className="s-sub">Startup & power rules</div>
            </div>
          </button>

          {/* Mini Card 2: Theme */}
          <button className="mini-card-theme" onClick={() => setOpenModal('modal-theme')}>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>Theme</div>
              <div style={{ fontSize: '0.76rem', opacity: 0.7, marginTop: '2px' }}>Highlight & Secondary</div>
            </div>
            <div className="theme-wave-accent">
              <span className="theme-pill-indicator">Customize</span>
            </div>
          </button>

          {/* Mini Card 3: About */}
          <div className="mini-card-about">
            <div className="about-top-box">
              <div className="about-top-header">
                <div className="about-white-circle">v2</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.25 }}>Documentation<br />& Memory Guide</div>
              </div>
              <div className="about-stat-big">6 Effects</div>
            </div>

            <button className="about-bottom-trigger" onClick={() => setOpenModal('modal-about')}>
              <div className="about-corner-badge">↗</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Complete Guide</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-dark)' }}>About</div>
            </button>
          </div>
        </div>

      </main>

      {/* ================= POPUP 1: CANVAS STUDIO ================= */}
      {openModal === 'modal-canvas' && (
        <div className="modal-backdrop">
          <div className="popup-window large">
            <div className="popup-top-bar">
              <h2>Canvas Studio</h2>
              <button className="close-circle-x" onClick={() => setOpenModal(null)}>✕</button>
            </div>

            <div className="canvas-workspace-grid">
              <div className="drawing-board-container">
                <canvas ref={canvasRef} id="collage-canvas" width={700} height={480} />
                <div className="canvas-bottom-toolbar">
                  <button className="toolbar-btn" onClick={() => {
                    if (canvasShapes.length > 1) setCanvasShapes(prev => prev.slice(0, -1));
                  }}>Undo</button>
                  <button className="toolbar-btn" onClick={() => {
                    const idx = canvasShapes.length + 1;
                    setCanvasShapes(prev => [
                      ...prev,
                      { name: `Shape ${idx}`, color: shapeFillColor, points: [{ x: 160 + idx * 20, y: 120 }, { x: 460, y: 120 }, { x: 480, y: 340 }, { x: 160, y: 340 }] }
                    ]);
                  }}>+ Shape</button>
                  <button className="toolbar-btn highlight" onClick={() => {
                    setOpenModal(null);
                    alert('Canvas collage activated as current wallpaper layout!');
                  }}>Activate</button>
                  <button className="toolbar-btn" onClick={() => {
                    setBakedCollages(prev => [
                      {
                        id: Date.now(),
                        title: `Custom Collage #${prev.length + 1}`,
                        date: 'Just Now',
                        color: canvasShapes[0]?.color || '#dfff4f',
                        points: canvasShapes[0]?.points || []
                      },
                      ...prev
                    ]);
                    setOpenModal(null);
                  }}>Save to Baked</button>
                </div>
              </div>

              <div className="canvas-sidebar">
                <div className="sidebar-box">
                  <h4>Canvas Background</h4>
                  <input
                    type="color"
                    value={canvasBgColor}
                    onChange={(e) => setCanvasBgColor(e.target.value)}
                    style={{ width: '100%', height: '38px', border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                  />
                </div>

                <div className="sidebar-box">
                  <h4>Shapes List</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {canvasShapes.map(s => (
                      <div key={s.name} className="shape-pill-item">
                        <span>{s.name}</span>
                        <span>✓</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sidebar-box">
                  <h4>Shape Fill</h4>
                  <input
                    type="color"
                    value={shapeFillColor}
                    onChange={(e) => {
                      setShapeFillColor(e.target.value);
                      if (canvasShapes.length) {
                        setCanvasShapes(prev => {
                          const copy = [...prev];
                          copy[copy.length - 1].color = e.target.value;
                          return copy;
                        });
                      }
                    }}
                    style={{ width: '100%', height: '36px', border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                  />
                  <button className="btn-outline-pill" style={{ width: '100%' }} onClick={() => {
                    if (canvasShapes.length > 0) setCanvasShapes(prev => prev.slice(0, -1));
                  }}>
                    Delete Shape
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= POPUP 2: BAKED WALLPAPERS ================= */}
      {openModal === 'modal-baked' && (
        <div className="modal-backdrop">
          <div className="popup-window">
            <div className="popup-top-bar">
              <h2>Baked Wallpapers</h2>
              <button className="close-circle-x" onClick={() => setOpenModal(null)}>✕</button>
            </div>

            <div className="path-banner">
              <span>Saved Location: <strong>C:\Users\Public\Documents\Graffiti\BakedWallpapers\</strong></span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Local Disk</span>
            </div>

            <div className="baked-grid">
              {bakedCollages.map(item => (
                <div key={item.id} className="baked-card">
                  <div className="baked-preview" style={{ border: `2px solid ${item.color}` }}>
                    <span>{item.title}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{item.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.date}</div>
                  <div className="control-row-split" style={{ marginTop: '4px' }}>
                    <button
                      className="btn-dark-pill"
                      style={{ padding: '8px 12px', fontSize: '0.76rem' }}
                      onClick={() => {
                        setOpenModal(null);
                        alert(`Activated: ${item.title}`);
                      }}
                    >
                      Activate
                    </button>
                    <button
                      className="btn-outline-pill"
                      style={{ padding: '8px 12px', fontSize: '0.76rem' }}
                      onClick={() => {
                        setCanvasShapes([{ name: 'Shape 1', color: item.color, points: JSON.parse(JSON.stringify(item.points)) }]);
                        setOpenModal('modal-canvas');
                      }}
                    >
                      Open in Canvas
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= POPUP 3: WEB WALLPAPER ================= */}
      {openModal === 'modal-web' && (
        <div className="modal-backdrop">
          <div className="popup-window">
            <div className="popup-top-bar">
              <h2>Set 3D Web Wallpaper Model</h2>
              <button className="close-circle-x" onClick={() => setOpenModal(null)}>✕</button>
            </div>

            <div className="canvas-workspace-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <button className="pill-select-btn" onClick={handleImportGlb}>
                  <span>{webModelPath ? webModelPath.split('\\').pop() : 'Import .GLB Model…'}</span>
                  <span className="caret">Browse</span>
                </button>

                <div className="sidebar-box">
                  <h4>Background Type</h4>
                  <div className="control-row-split">
                    <button
                      className={`pill-select-btn ${webBgType === 'color' ? 'active' : ''}`}
                      onClick={() => setWebBgType('color')}
                    >
                      Solid
                    </button>
                    <button
                      className={`pill-select-btn ${webBgType === 'image' ? 'active' : ''}`}
                      onClick={() => setWebBgType('image')}
                    >
                      Image
                    </button>
                  </div>
                  {webBgType === 'color' ? (
                    <input
                      type="color"
                      value={webBgColor}
                      onChange={(e) => setWebBgColor(e.target.value)}
                      style={{ width: '100%', height: '36px', border: 'none', borderRadius: '8px' }}
                    />
                  ) : (
                    <button className="pill-select-btn" onClick={async () => {
                      const sel = await open({ filters: [{ name: 'Images', extensions: ['png', 'jpg'] }] });
                      if (typeof sel === 'string') {
                        const imp = await importWebAsset(sel);
                        setWebBgImage(imp);
                      }
                    }}>
                      <span>{webBgImage ? webBgImage.split('\\').pop() : 'Browse Background…'}</span>
                    </button>
                  )}
                </div>

                <div className="sidebar-box">
                  <h4>Camera & Transform Sliders</h4>
                  <div className="slider-group">
                    <div className="slider-label-row"><span>Zoom</span><span>{webZoom.toFixed(1)}x</span></div>
                    <input type="range" min="0.2" max="3" step="0.1" value={webZoom} onChange={e => setWebZoom(parseFloat(e.target.value))} />
                  </div>
                  <div className="slider-group">
                    <div className="slider-label-row"><span>Horizontal Offset</span><span>{webHOff.toFixed(1)}</span></div>
                    <input type="range" min="-2" max="2" step="0.1" value={webHOff} onChange={e => setWebHOff(parseFloat(e.target.value))} />
                  </div>
                  <div className="slider-group">
                    <div className="slider-label-row"><span>Vertical Offset</span><span>{webVOff.toFixed(1)}</span></div>
                    <input type="range" min="-2" max="2" step="0.1" value={webVOff} onChange={e => setWebVOff(parseFloat(e.target.value))} />
                  </div>
                  <div className="slider-group">
                    <div className="slider-label-row"><span>Cursor Sensitivity</span><span>{webSens.toFixed(2)}x</span></div>
                    <input type="range" min="0.05" max="1" step="0.05" value={webSens} onChange={e => setWebSens(parseFloat(e.target.value))} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#181a18', borderRadius: '22px', padding: '24px', color: '#fff' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Interactive Viewport Preview</div>
                <div style={{ textAlign: 'center', margin: 'auto 0' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--highlight)' }}>
                    {webModelPath ? webModelPath.split('\\').pop() : 'No .GLB Model Selected'}
                  </div>
                  <p style={{ fontSize: '0.78rem', opacity: 0.6, marginTop: '6px' }}>Left-click + drag to test rotation</p>
                </div>
                <button
                  className="btn-dark-pill"
                  style={{ background: 'var(--highlight)', color: 'var(--text-dark)', width: '100%' }}
                  onClick={handleActivate3D}
                >
                  Activate 3D Wallpaper
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= POPUP 4: THEME CUSTOMIZER ================= */}
      {openModal === 'modal-theme' && (
        <div className="modal-backdrop">
          <div className="popup-window compact">
            <div className="popup-top-bar">
              <h2>App Theme</h2>
              <button className="close-circle-x" onClick={() => setOpenModal(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Highlight Color</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Default: Neon Chartreuse (#dfff4f)</div>
                </div>
                <input
                  type="color"
                  value={highlightColor}
                  onChange={(e) => handleHighlightChange(e.target.value)}
                  style={{ width: '54px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }}
                />
              </div>

              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Secondary Color</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Default: Soft White (#f4f6f4)</div>
                </div>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => handleSecondaryChange(e.target.value)}
                  style={{ width: '54px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }}
                />
              </div>

              <button className="btn-outline-pill" onClick={handleResetTheme}>
                Reset to Default Palette
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= POPUP 5: ABOUT ================= */}
      {openModal === 'modal-about' && (
        <div className="modal-backdrop">
          <div className="popup-window">
            <div className="popup-top-bar">
              <h2>About Graffiti Workspace</h2>
              <button className="close-circle-x" onClick={() => setOpenModal(null)}>✕</button>
            </div>

            <div className="about-scroll-sections">
              <div className="about-info-card">
                <h3>Step-by-Step: How to Use</h3>
                <ol>
                  <li><strong>Set Global Output:</strong> Click the two top circular badges above Effects Studio to set your target <strong>Resolution</strong> and <strong>FPS</strong>.</li>
                  <li><strong>Effects Studio:</strong> Click <em>Choose Effect</em> to pick a shader, choose your local wallpaper image, fine-tune <em>Sliders</em>, and hit <strong>Activate</strong>.</li>
                  <li><strong>Gallery Collages:</strong> Open <em>Canvas</em> to draw custom polygon masks, or open <em>Baked Wallpapers</em> to re-edit or activate creations.</li>
                  <li><strong>Web Wallpaper:</strong> Click <em>Set Model</em> to load a 3D <code>.glb</code> asset, adjust camera offsets, and render live on your desktop.</li>
                </ol>
              </div>

              <div className="about-info-card">
                <h3>All 6 Effects Explained</h3>
                <ul>
                  <li><strong>Cursor Reveal:</strong> Blends two wallpaper layers, uncovering the hidden layer around your cursor like a brush.</li>
                  <li><strong>Gravity Lens:</strong> Warps the wallpaper around the cursor using fluid gravitational refraction physics.</li>
                  <li><strong>Glass Lens:</strong> Magnifies and refracts through a realistic glass sphere with chromatic dispersion.</li>
                  <li><strong>Space Ball:</strong> Simulates pressing a 3D sphere into a tactile, deformable surface with directional shading.</li>
                  <li><strong>Brick Outline:</strong> Illuminates procedural brick/grid edges strictly around the cursor position.</li>
                  <li><strong>Depth Parallax:</strong> Uses an on-device AI depth map to shift layers as your mouse moves.</li>
                </ul>
              </div>

              <div className="about-info-card">
                <h3>Memory Costs of Web Wallpaper</h3>
                <p>Unlike native 2D GPU shaders (~25–45 MB VRAM), <strong>Web Wallpaper</strong> initializes an embedded Chromium/WebView2 context:</p>
                <ul>
                  <li><strong>Base WebView Overhead:</strong> ~90 MB – 140 MB RAM.</li>
                  <li><strong>GLB Geometry & Textures:</strong> ~60 MB – 250 MB GPU VRAM depending on poly count.</li>
                  <li><strong>Optimization Tip:</strong> Enable <em>Pause When Hidden</em> in Settings to reduce idle power draw.</li>
                </ul>
              </div>

              <div className="about-info-card">
                <h3>What the Next Update Brings (v2.1)</h3>
                <ul>
                  <li><strong>Audio-Reactive Shaders:</strong> Real-time audio spectrum bindings for all 6 studio effects and 3D models.</li>
                  <li><strong>Multi-Monitor Span:</strong> Assign independent effects or 3D models per display.</li>
                  <li><strong>Shattered Mirror & Voronoï Shaders:</strong> New procedural cursor fracture effects.</li>
                  <li><strong>Draco-Compressed GLB:</strong> Up to 60% lower VRAM usage on Web Wallpapers.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= SETTINGS FULL OVERLAY ================= */}
      {openModal === 'settings-page' && (
        <div id="settings-page-view">
          <div className="settings-page-container">
            <div className="popup-top-bar">
              <h2>Settings</h2>
              <button className="close-circle-x" onClick={() => setOpenModal(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Launch at Startup</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Start Graffiti silently when signing into Windows</div>
                </div>
                <button
                  className={`toggle-pill ${autostartEnabled ? 'on' : ''}`}
                  onClick={handleToggleAutostart}
                >
                  {autostartEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Idle Timeout (Seconds)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pause engine if mouse hasn't moved (0 to disable)</div>
                </div>
                <input
                  type="number"
                  value={appSettings.idleTimeout}
                  onChange={(e) => handleUpdateSetting('idleTimeout', parseFloat(e.target.value) || 0)}
                  style={{ width: '80px', padding: '8px 12px', borderRadius: '12px', border: '1px solid var(--border-soft)', fontWeight: 700, textAlign: 'center' }}
                />
              </div>

              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Pause When Hidden</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pause when desktop is covered by a maximized window</div>
                </div>
                <button
                  className={`toggle-pill ${appSettings.pauseHidden ? 'on' : ''}`}
                  onClick={() => handleUpdateSetting('pauseHidden', !appSettings.pauseHidden)}
                >
                  {appSettings.pauseHidden ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Pause During Fullscreen</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pause during fullscreen games or video playback</div>
                </div>
                <button
                  className={`toggle-pill ${appSettings.pauseFullscreen ? 'on' : ''}`}
                  onClick={() => handleUpdateSetting('pauseFullscreen', !appSettings.pauseFullscreen)}
                >
                  {appSettings.pauseFullscreen ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Pause on Battery</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pause when unplugged or Battery Saver is active</div>
                </div>
                <button
                  className={`toggle-pill ${appSettings.pauseBattery ? 'on' : ''}`}
                  onClick={() => handleUpdateSetting('pauseBattery', !appSettings.pauseBattery)}
                >
                  {appSettings.pauseBattery ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="setting-row" style={{ marginTop: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#c45c5c' }}>Reset to Defaults</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Restores default settings and restarts the renderer</div>
                </div>
                <button className="btn-outline-pill" style={{ borderColor: '#c45c5c', color: '#c45c5c' }} onClick={handleResetDefaults}>
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
