import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';
import { enable as enableAuto, disable as disableAuto, isEnabled as isAutoEnabled } from '@tauri-apps/plugin-autostart';
import { convertFileSrc } from '@tauri-apps/api/core';
import PreviewCanvas from './pages/PreviewCanvas';
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
  generateDepthMap,
  getStatus,
  listWallpapers,
  saveBakedWallpaper,
  deleteBakedWallpaper,
  fileExists,
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
  loadEffectSettings,
  saveQualitySetting,
  loadQualitySettings,
  loadSelectedEffect,
  saveSelectedEffect,
  saveWallpaperPairing,
} from './store';

// ───────────────────────────────────────────────────────────────────
// Master parameter specifications for all 6 native effects
// Each entry matches the original Effects.tsx slider ranges exactly
// ───────────────────────────────────────────────────────────────────
const EFFECTS_DATA: Record<string, Array<{ name: string; key: string; min: number; max: number; step: number; val: number; unit: string }>> = {
  'Cursor Reveal': [
    { name: 'Brush Size',     key: 'brushSize',     min: 50,    max: 300,  step: 0.1,   val: 160,   unit: 'px' },
    { name: 'Brush Hardness', key: 'brushHardness',  min: 0,     max: 1,    step: 0.001, val: 0.20,  unit: '' },
    { name: 'Trail Length',   key: 'trailLength',    min: 0,     max: 5,    step: 0.01,  val: 1.0,   unit: 's' },
    { name: 'Fade Out Speed', key: 'fadeSpeed',      min: 0.005, max: 0.1,  step: 0.001, val: 0.035, unit: '' },
  ],
  'Gravity Lens': [
    { name: 'Lens Strength',        key: 'lensStrength',  min: 0,    max: 20,   step: 0.01,  val: 5.0,  unit: '' },
    { name: 'Lens Radius',          key: 'lensRadius',    min: 0.02, max: 0.25, step: 0.001, val: 0.08, unit: '' },
    { name: 'Spring Stiffness',     key: 'stiffness',     min: 10,   max: 200,  step: 0.1,   val: 50,   unit: '' },
    { name: 'Spring Damping',       key: 'damping',       min: 0.70, max: 0.99, step: 0.001, val: 0.90, unit: '' },
    { name: 'Chromatic Dispersion', key: 'dispersion',    min: 0,    max: 0.1,  step: 0.001, val: 0.02, unit: '' },
    { name: 'Core Darkening',       key: 'coreDarkening', min: 0,    max: 1,    step: 0.001, val: 0.50, unit: '' },
    { name: 'Trail Length',          key: 'trailLength',   min: 0,    max: 5,    step: 0.01,  val: 1.0,  unit: 's' },
    { name: 'Fade Speed',           key: 'fadeDecay',     min: 0.80, max: 1.0,  step: 0.001, val: 0.92, unit: '' },
  ],
  'Glass Lens': [
    { name: 'Press Depth',          key: 'pressDepth',       min: 0,    max: 0.15, step: 0.001, val: 0.03,  unit: '' },
    { name: 'Press Radius',         key: 'pressRadius',      min: 0.02, max: 0.25, step: 0.001, val: 0.08,  unit: '' },
    { name: 'Spring Stiffness',     key: 'stiffness',        min: 10,   max: 200,  step: 0.1,   val: 50,    unit: '' },
    { name: 'Spring Damping',       key: 'damping',          min: 0.70, max: 0.99, step: 0.001, val: 0.90,  unit: '' },
    { name: 'Chromatic Dispersion', key: 'dispersion',       min: 0,    max: 0.1,  step: 0.001, val: 0.02,  unit: '' },
    { name: 'Core Darkening',       key: 'coreDarkening',    min: 0,    max: 1,    step: 0.001, val: 0.15,  unit: '' },
    { name: 'Directional Shading',  key: 'shadingStrength',  min: 0,    max: 1,    step: 0.001, val: 0.50,  unit: '' },
    { name: 'Trail Length',          key: 'trailLength',      min: 0,    max: 5,    step: 0.01,  val: 1.0,   unit: 's' },
    { name: 'Fade Speed',           key: 'fadeDecay',        min: 0.80, max: 1.0,  step: 0.001, val: 0.92,  unit: '' },
  ],
  'Space Ball': [
    { name: 'Press Depth',          key: 'pressDepth',          min: 0,    max: 10,   step: 0.01,  val: 2.0,  unit: '' },
    { name: 'Press Radius',         key: 'pressRadius',         min: 0.01, max: 1.0,  step: 0.001, val: 0.30, unit: '' },
    { name: 'Spring Stiffness',     key: 'stiffness',           min: 10,   max: 300,  step: 0.1,   val: 50,   unit: '' },
    { name: 'Spring Damping',       key: 'damping',             min: 0.70, max: 0.99, step: 0.001, val: 0.90, unit: '' },
    { name: 'Depth Darkening',      key: 'depthDarkening',      min: 0,    max: 1,    step: 0.001, val: 0.0,  unit: '' },
    { name: 'Directional Shading',  key: 'directionalShading',  min: 0,    max: 1,    step: 0.001, val: 0.0,  unit: '' },
    { name: 'Parallax Strength',    key: 'parallaxStrength',    min: 0,    max: 1,    step: 0.001, val: 0.20, unit: '' },
  ],
  'Brick Outline': [
    { name: 'Brick Width',     key: 'brickWidth',     min: 10,   max: 300, step: 0.1,   val: 100,  unit: 'px' },
    { name: 'Brick Height',    key: 'brickHeight',    min: 10,   max: 300, step: 0.1,   val: 50,   unit: 'px' },
    { name: 'Line Thickness',  key: 'lineThickness',  min: 0.5,  max: 10,  step: 0.01,  val: 3.0,  unit: 'px' },
    { name: 'Effect Radius',   key: 'effectRadius',   min: 0.01, max: 1.0, step: 0.001, val: 0.20, unit: '' },
    { name: 'Edge Softness',   key: 'edgeSoftness',   min: 0,    max: 0.5, step: 0.001, val: 0.10, unit: '' },
    { name: 'Glow Intensity',  key: 'glowIntensity',  min: 0,    max: 3,   step: 0.01,  val: 1.0,  unit: '' },
  ],
  'Depth Parallax': [
    { name: 'Parallax Strength', key: 'parallaxStrength', min: 0.01, max: 0.2, step: 0.001, val: 0.05, unit: '' },
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

// Per-effect image key configuration
const EFFECT_IMAGE_KEYS: Record<string, string[]> = {
  'Cursor Reveal': ['layerA', 'layerB'],
  'Gravity Lens': ['baseImage'],
  'Glass Lens': ['baseImage'],
  'Space Ball': ['baseImage'],
  'Brick Outline': ['baseImage'],
  'Depth Parallax': ['testWallpaper'],
};

const EFFECT_IMAGE_LABELS: Record<string, Record<string, string>> = {
  'Cursor Reveal': { layerA: 'Layer A — Background', layerB: 'Layer B — Reveal' },
  'Gravity Lens': { baseImage: 'Base Wallpaper' },
  'Glass Lens': { baseImage: 'Base Wallpaper' },
  'Space Ball': { baseImage: 'Base Wallpaper' },
  'Brick Outline': { baseImage: 'Base Wallpaper' },
  'Depth Parallax': { testWallpaper: 'Test Wallpaper' },
};

interface Transform {
  panX: number;
  panY: number;
  zoom: number;
  rotate: number;
}

interface Shape {
  id: string;
  name: string;
  vertices: [number, number][];
  imagePath: string | null;
  transform: Transform;
  color?: string;
}

interface Background {
  type: 'color' | 'image';
  value: string;
  fit: 'cover' | 'contain' | 'stretch' | 'tile';
}

interface Project {
  version: string;
  background: Background;
  shapes: Shape[];
  aspectRatio?: 'auto' | '16:9' | '16:10' | '21:9' | '3:2' | '4:3' | string;
}

const DEFAULT_PROJECT: Project = {
  version: "1.0",
  background: { type: 'color', value: '#242825', fit: 'cover' },
  shapes: [],
  aspectRatio: 'auto'
};

const getMonitorAspect = (): { ratio: number; label: string } => {
  const w = (typeof window !== 'undefined' && window.screen?.width) ? window.screen.width : 1920;
  const h = (typeof window !== 'undefined' && window.screen?.height) ? window.screen.height : 1080;
  const ratio = (w > 0 && h > 0) ? (w / h) : (16 / 9);

  let label = `${w}×${h}`;
  if (Math.abs(ratio - 16 / 9) < 0.05) label = `16:9 (${w}×${h})`;
  else if (Math.abs(ratio - 16 / 10) < 0.05) label = `16:10 (${w}×${h})`;
  else if (Math.abs(ratio - 21 / 9) < 0.08 || Math.abs(ratio - 2.37) < 0.08) label = `21:9 Ultrawide (${w}×${h})`;
  else if (Math.abs(ratio - 32 / 9) < 0.1) label = `32:9 Super Ultrawide (${w}×${h})`;
  else if (Math.abs(ratio - 3 / 2) < 0.05) label = `3:2 (${w}×${h})`;
  else if (Math.abs(ratio - 4 / 3) < 0.05) label = `4:3 (${w}×${h})`;
  else label = `${ratio.toFixed(2)}:1 (${w}×${h})`;

  return { ratio, label };
};

const resolveProjectAspectRatio = (projAspect?: string): number => {
  if (!projAspect || projAspect === 'auto') {
    return getMonitorAspect().ratio;
  }
  if (projAspect === '16:9') return 16 / 9;
  if (projAspect === '16:10') return 16 / 10;
  if (projAspect === '21:9') return 21 / 9;
  if (projAspect === '3:2') return 3 / 2;
  if (projAspect === '4:3') return 4 / 3;
  const parsed = parseFloat(projAspect);
  return (!isNaN(parsed) && parsed > 0.3 && parsed < 4.0) ? parsed : (16 / 9);
};

// Simple utility to check if a point is inside a polygon (normalized [0..1] coordinates)
function isPointInPolygon(point: [number, number], vs: [number, number][]) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Compute center of a polygon (bounding box center in normalized [0..1] space)
function getPolygonCenter(vs: [number, number][]): [number, number] {
  if (vs.length === 0) return [0.5, 0.5];
  let minX = vs[0][0], maxX = vs[0][0], minY = vs[0][1], maxY = vs[0][1];
  for (let i = 1; i < vs.length; i++) {
    minX = Math.min(minX, vs[i][0]);
    maxX = Math.max(maxX, vs[i][0]);
    minY = Math.min(minY, vs[i][1]);
    maxY = Math.max(maxY, vs[i][1]);
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

// Compute normalized bounding box of a polygon
function getPolygonBounds(vs: [number, number][]) {
  if (vs.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let minX = vs[0][0], maxX = vs[0][0], minY = vs[0][1], maxY = vs[0][1];
  for (let i = 1; i < vs.length; i++) {
    minX = Math.min(minX, vs[i][0]);
    maxX = Math.max(maxX, vs[i][0]);
    minY = Math.min(minY, vs[i][1]);
    maxY = Math.max(maxY, vs[i][1]);
  }
  return { minX, maxX, minY, maxY };
}

export default function App() {
  // ─── Splash ─────────────────────────────────
  const [showSplash, setShowSplash] = useState(true);

  // ─── Quality & Engine ───────────────────────
  const resolutions = ['Native', '75%', 'Half', 'Auto'];
  const resScales = [1.0, 0.75, 0.5, 1.0];
  const fpsOptions = ['60', 'Max', '30'];
  const fpsValues = [60, 0, 30];
  const [resIdx, setResIdx] = useState(0);
  const [fpsIdx, setFpsIdx] = useState(0);
  const [liveFps, setLiveFps] = useState(0);

  // ─── Effect Selection ───────────────────────
  const [selectedEffect, setSelectedEffect] = useState<string>('Cursor Reveal');
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  // ─── Per-Effect Images ──────────────────────
  const [effectImages, setEffectImages] = useState<Record<string, Record<string, string | null>>>({
    'Cursor Reveal': { layerA: null, layerB: null },
    'Gravity Lens': { baseImage: null },
    'Glass Lens': { baseImage: null },
    'Space Ball': { baseImage: null },
    'Brick Outline': { baseImage: null },
    'Depth Parallax': { testWallpaper: null },
  });

  // ─── Per-Effect Slider Parameters ───────────
  const [effectParams, setEffectParams] = useState<Record<string, Record<string, number>>>({});

  // ─── Effect-Specific States ─────────────────
  const [boOutlineColor, setBOOutlineColor] = useState('#ffffff');
  const [crFadeWhenResting, setCRFadeWhenResting] = useState(true);
  const [isGeneratingDepth, setIsGeneratingDepth] = useState(false);
  const [depthError, setDepthError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // ─── Side Popup ─────────────────────────────
  const [sidePopupOpen, setSidePopupOpen] = useState(false);
  const [sidePopupView, setSidePopupView] = useState<'effects' | 'sliders'>('effects');

  // ─── Modals ─────────────────────────────────
  const [openModal, setOpenModal] = useState<string | null>(null);

  // ─── Wallpaper Picker ───────────────────────
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [pickerWallpapers, setPickerWallpapers] = useState<string[]>([]);
  const [pickerTarget, setPickerTarget] = useState<{ effect: string; imageKey: string } | null>(null);

  // ─── 3D Web Wallpaper ───────────────────────
  const [webModelPath, setWebModelPath] = useState<string | null>(null);
  const [webStatus, setWebStatus] = useState<string>('Standby');
  const [webBgType, setWebBgType] = useState<'color' | 'image'>('color');
  const [webBgColor, setWebBgColor] = useState<string>('#b6beb7');
  const [webBgImage, setWebBgImage] = useState<string | null>(null);
  const [webZoom, setWebZoom] = useState<number>(1.0);
  const [webHOff, setWebHOff] = useState<number>(0.0);
  const [webVOff, setWebVOff] = useState<number>(0.0);
  const [webSens, setWebSens] = useState<number>(0.2);

  // ─── App Settings ───────────────────────────
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);
  const [autostartEnabled, setAutostartEnabled] = useState(false);

  // ─── Theme ──────────────────────────────────
  const [highlightColor, setHighlightColor] = useState('#dfff4f');
  const [secondaryColor, setSecondaryColor] = useState('#f4f6f4');

  // ─── Gallery / Canvas Studio ───────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [project, setProject] = useState<Project>(DEFAULT_PROJECT);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<'IDLE' | 'DRAWING'>('IDLE');
  const [drawingShape, setDrawingShape] = useState<[number, number][]>([]);
  const [previewCursor, setPreviewCursor] = useState<{ x: number; y: number; snapX: boolean; snapY: boolean } | null>(null);
  const [realBakedWallpapers, setRealBakedWallpapers] = useState<string[]>([]);
  const [bakedWallpapersDir, setBakedWallpapersDir] = useState<string>('');
  const [isBaking, setIsBaking] = useState(false);
  const [hasPreviousCanvas, setHasPreviousCanvas] = useState(false);
  const [canvasTick, setCanvasTick] = useState(0);
  const [canvasResizeCount, setCanvasResizeCount] = useState(0);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});

  // History State
  const history = useRef<Project[]>([]);
  const historyIndex = useRef<number>(-1);

  const commitHistory = (p: Project) => {
    history.current = history.current.slice(0, historyIndex.current + 1);
    history.current.push(JSON.parse(JSON.stringify(p)));
    historyIndex.current++;
  };

  const handleUndo = () => {
    if (historyIndex.current > 0) {
      historyIndex.current--;
      const prev = history.current[historyIndex.current];
      setProject(prev);
      saveProject(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex.current < history.current.length - 1) {
      historyIndex.current++;
      const next = history.current[historyIndex.current];
      setProject(next);
      saveProject(next);
    }
  };

  // Interaction ref for dragging vertex, panning image, or moving shape
  const dragRef = useRef<{
    active: boolean;
    mode: 'pan' | 'vertex' | 'move-shape';
    startX?: number;
    startY?: number;
    initialPanX?: number;
    initialPanY?: number;
    shapeId?: string;
    vertexIdx?: number;
    initialVertices?: [number, number][];
  } | null>(null);

  // ─── Refs ───────────────────────────────────
  const glbFileInputRef = useRef<HTMLInputElement | null>(null);
  const bgImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimer = useRef<number | null>(null);

  const getImage = (path: string, onLoaded?: () => void): HTMLImageElement => {
    if (imageCache.current[path]) return imageCache.current[path];
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = convertFileSrc(path);
    img.onload = () => {
      imageCache.current[path] = img;
      setCanvasTick(t => t + 1);
      if (onLoaded) onLoaded();
    };
    img.onerror = (e) => {
      console.error("Failed to load image via convertFileSrc:", path, e);
    };
    imageCache.current[path] = img;
    return img;
  };

  // ═══════════════════════════════════════════════════════════════
  // 1. INIT: Load all persisted settings, restore session
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 1100);

    // Restore theme
    const savedHL = localStorage.getItem('graffiti_theme_highlight');
    const savedSec = localStorage.getItem('graffiti_theme_secondary');
    if (savedHL) { setHighlightColor(savedHL); document.documentElement.style.setProperty('--highlight', savedHL); }
    if (savedSec) { setSecondaryColor(savedSec); document.documentElement.style.setProperty('--secondary', savedSec); }

    isAutoEnabled().then(setAutostartEnabled).catch(() => {});
    loadSettings().then(setAppSettings).catch(console.error);

    // Load real baked wallpapers from %APPDATA%\Graffiti\baked_wallpapers
    listWallpapers().then(wps => {
      setRealBakedWallpapers(wps);
      if (wps.length > 0) {
        const lastSlash = Math.max(wps[0].lastIndexOf('\\'), wps[0].lastIndexOf('/'));
        if (lastSlash >= 0) setBakedWallpapersDir(wps[0].substring(0, lastSlash + 1));
      }
    }).catch(console.error);

    // Load per-effect settings from store
    const loadAllEffectSettings = async () => {
      try {
        // Quality settings
        const quality = await loadQualitySettings();
        if (quality.fpsCap !== null) {
          const fIdx = fpsValues.indexOf(quality.fpsCap);
          if (fIdx >= 0) setFpsIdx(fIdx);
          await setFpsCap(quality.fpsCap);
        }
        if (quality.resolutionScale !== null) {
          const rIdx = resScales.indexOf(quality.resolutionScale);
          if (rIdx >= 0) setResIdx(rIdx);
          await setResolutionScale(quality.resolutionScale);
        }

        // Populate initial params from defaults
        const initialParams: Record<string, Record<string, number>> = {};
        Object.entries(EFFECTS_DATA).forEach(([effName, paramsList]) => {
          initialParams[effName] = {};
          paramsList.forEach(p => { initialParams[effName][p.key] = p.val; });
        });

        // Load saved per-effect settings and images
        const newImages = { ...effectImages };

        // Cursor Reveal
        const crSettings = await loadEffectSettings('cursor_reveal');
        if (crSettings) {
          if (crSettings.layerA) newImages['Cursor Reveal'].layerA = crSettings.layerA;
          if (crSettings.layerB) newImages['Cursor Reveal'].layerB = crSettings.layerB;
          if (crSettings.brushSize != null) initialParams['Cursor Reveal'].brushSize = crSettings.brushSize;
          if (crSettings.brushHardness != null) initialParams['Cursor Reveal'].brushHardness = crSettings.brushHardness;
          if (crSettings.trailLength != null) initialParams['Cursor Reveal'].trailLength = crSettings.trailLength;
          if (crSettings.fadeSpeed != null) initialParams['Cursor Reveal'].fadeSpeed = crSettings.fadeSpeed;
          if (crSettings.fadeWhenResting != null) setCRFadeWhenResting(crSettings.fadeWhenResting === 1);
        }

        // Gravity Lens
        const glSettings = await loadEffectSettings('gravity_lens');
        if (glSettings) {
          if (glSettings.baseImage) newImages['Gravity Lens'].baseImage = glSettings.baseImage;
          ['lensStrength', 'lensRadius', 'stiffness', 'damping', 'dispersion', 'coreDarkening', 'trailLength', 'fadeDecay'].forEach(k => {
            if (glSettings[k] != null) initialParams['Gravity Lens'][k] = glSettings[k];
          });
        }

        // Glass Lens
        const gltSettings = await loadEffectSettings('gravity_lens_transparent');
        if (gltSettings) {
          if (gltSettings.baseImage) newImages['Glass Lens'].baseImage = gltSettings.baseImage;
          ['pressDepth', 'pressRadius', 'stiffness', 'damping', 'dispersion', 'coreDarkening', 'shadingStrength', 'trailLength', 'fadeDecay'].forEach(k => {
            if (gltSettings[k] != null) initialParams['Glass Lens'][k] = gltSettings[k];
          });
        }

        // Space Ball
        const sp2Settings = await loadEffectSettings('stone_press_v2');
        if (sp2Settings) {
          if (sp2Settings.baseImage) newImages['Space Ball'].baseImage = sp2Settings.baseImage;
          ['pressDepth', 'pressRadius', 'stiffness', 'damping', 'depthDarkening', 'directionalShading', 'parallaxStrength'].forEach(k => {
            if (sp2Settings[k] != null) initialParams['Space Ball'][k] = sp2Settings[k];
          });
        }

        // Brick Outline
        const boSettings = await loadEffectSettings('brick_outline');
        if (boSettings) {
          if (boSettings.baseImage) newImages['Brick Outline'].baseImage = boSettings.baseImage;
          ['brickWidth', 'brickHeight', 'lineThickness', 'effectRadius', 'edgeSoftness', 'glowIntensity'].forEach(k => {
            if (boSettings[k] != null) initialParams['Brick Outline'][k] = boSettings[k];
          });
          if (boSettings.outlineColor) setBOOutlineColor(boSettings.outlineColor);
        }

        // Depth Parallax
        const dpSettings = await loadEffectSettings('depth_parallax');
        if (dpSettings) {
          if (dpSettings.testWallpaper) newImages['Depth Parallax'].testWallpaper = dpSettings.testWallpaper;
          if (dpSettings.parallaxStrength != null) initialParams['Depth Parallax'].parallaxStrength = dpSettings.parallaxStrength;
        }

        setEffectImages(newImages);
        setEffectParams(initialParams);

        // Restore selected effect
        const lastSelected = await loadSelectedEffect();
        if (lastSelected && ENGINE_ID_TO_DISPLAY[lastSelected]) {
          setSelectedEffect(ENGINE_ID_TO_DISPLAY[lastSelected]);
        }

        // Restore active session
        const session = await getActiveSession();
        if (session) {
          if (session.effect === 'web-wallpaper') {
            setWebStatus('Running on Desktop');
          } else if (session.effect && ENGINE_ID_TO_DISPLAY[session.effect]) {
            setActiveEffect(ENGINE_ID_TO_DISPLAY[session.effect]);
          }
        }

        setSettingsLoaded(true);
      } catch (err) {
        console.error('Failed to load effect settings:', err);
        // Still populate defaults
        const initialParams: Record<string, Record<string, number>> = {};
        Object.entries(EFFECTS_DATA).forEach(([effName, paramsList]) => {
          initialParams[effName] = {};
          paramsList.forEach(p => { initialParams[effName][p.key] = p.val; });
        });
        setEffectParams(initialParams);
        setSettingsLoaded(true);
      }
    };
    loadAllEffectSettings();

    return () => clearTimeout(splashTimer);
  }, []);

  // Auto-persist effect params after settings are loaded (prevents overwriting store with defaults)
  useEffect(() => {
    if (!settingsLoaded) return;
    const engineId = EFFECT_TO_ENGINE_ID[selectedEffect];
    if (engineId && effectParams[selectedEffect]) {
      saveEffectSettings(engineId, effectParams[selectedEffect]);
    }
  }, [settingsLoaded, effectParams, selectedEffect]);

  // ═══════════════════════════════════════════════════════════════
  // 2. LIVE FPS + STATUS POLLING (every 1s)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await getStatus();
        if (status) {
          if (status.fps !== undefined) setLiveFps(status.fps);
          if (status.activePlugin) {
            let uiName = status.activePlugin
              .replace('.dll', '')
              .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
              .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
              .toLowerCase();
            const knownEffects = ['cursor_reveal', 'gravity_lens', 'gravity_lens_transparent', 'stone_press_v2', 'depth_parallax', 'brick_outline'];
            if (!knownEffects.includes(uiName)) uiName = 'none';
            const newActive = uiName === 'none' ? null : ENGINE_ID_TO_DISPLAY[uiName] || null;
            setActiveEffect(newActive);
          }
        }
      } catch (_) { /* status polling failure is non-fatal */ }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load gallery project on mount
  useEffect(() => {
    const loadStoredProject = async () => {
      try {
        const store = await load('gallery-project.json');
        const proj = await store.get<Project>('project');
        if (proj && proj.shapes) {
          const normalizedProj = {
            ...proj,
            shapes: proj.shapes.map((s, idx) => ({
              ...s,
              name: s.name || `Shape ${idx + 1}`,
              transform: s.transform || { panX: 0, panY: 0, zoom: 1, rotate: 0 }
            }))
          };
          setProject(normalizedProj);
          commitHistory(normalizedProj);
          if (normalizedProj.shapes.length > 0) {
            setSelectedShapeId(normalizedProj.shapes[0].id);
          }
        } else {
          commitHistory(DEFAULT_PROJECT);
        }
        const prev = await store.get<Project>('canvas_previous_project');
        if (prev && prev.shapes && prev.shapes.length > 0) {
          setHasPreviousCanvas(true);
        }
      } catch (err) {
        console.error("Failed to load gallery-project.json:", err);
        commitHistory(DEFAULT_PROJECT);
      }
    };
    loadStoredProject();

    const handleResize = () => setCanvasResizeCount(c => c + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard Shortcuts for Undo/Redo inside Canvas Studio
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (openModal !== 'modal-canvas') return;
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') || (e.ctrlKey && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openModal]);

  // ═══════════════════════════════════════════════════════════════
  // 3. CANVAS DRAW (when canvas modal is open)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (openModal !== 'modal-canvas' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const targetAspect = resolveProjectAspectRatio(project.aspectRatio);

    const padX = 48;
    const padY = 48;
    let availW = Math.max(100, rect.width - padX);
    let availH = Math.max(100, rect.height - padY);

    let cw = availW;
    let ch = availH;
    if (cw / ch > targetAspect) {
      cw = ch * targetAspect;
    } else {
      ch = cw / targetAspect;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${Math.round(cw)}px`;
    canvas.style.height = `${Math.round(ch)}px`;

    ctx.scale(dpr, dpr);

    const toPx = (nx: number, ny: number): [number, number] => [nx * cw, ny * ch];

    // 1. Draw Background
    const defaultBgColor = '#242825';
    if (project.background.type === 'color') {
      ctx.fillStyle = project.background.value || defaultBgColor;
      ctx.fillRect(0, 0, cw, ch);
    } else if (project.background.type === 'image' && project.background.value) {
      const img = imageCache.current[project.background.value] || getImage(project.background.value);
      if (img && img.complete && img.naturalWidth > 0) {
        if (project.background.fit === 'cover' || project.background.fit === 'contain') {
          const imgAspect = img.naturalWidth / img.naturalHeight;
          let drawW = cw, drawH = ch;
          if (project.background.fit === 'cover') {
            if (cw / ch > imgAspect) drawH = cw / imgAspect;
            else drawW = ch * imgAspect;
          } else {
            if (cw / ch > imgAspect) drawW = ch * imgAspect;
            else drawH = cw / imgAspect;
          }
          const dx = (cw - drawW) / 2;
          const dy = (ch - drawH) / 2;
          ctx.drawImage(img, dx, dy, drawW, drawH);
        } else if (project.background.fit === 'stretch') {
          ctx.drawImage(img, 0, 0, cw, ch);
        } else if (project.background.fit === 'tile') {
          const pat = ctx.createPattern(img, 'repeat');
          if (pat) {
            ctx.fillStyle = pat;
            ctx.fillRect(0, 0, cw, ch);
          }
        }
      } else {
        ctx.fillStyle = defaultBgColor;
        ctx.fillRect(0, 0, cw, ch);
      }
    } else {
      ctx.fillStyle = defaultBgColor;
      ctx.fillRect(0, 0, cw, ch);
    }

    // 2. Draw Shapes
    const effectiveSelectedShapeId = (selectedShapeId && project.shapes.some(s => s.id === selectedShapeId))
      ? selectedShapeId
      : (project.shapes[0]?.id || null);

    project.shapes.forEach((shape) => {
      if (shape.vertices.length < 3) return;

      ctx.save();
      ctx.beginPath();
      const start = toPx(shape.vertices[0][0], shape.vertices[0][1]);
      ctx.moveTo(start[0], start[1]);
      for (let i = 1; i < shape.vertices.length; i++) {
        const pt = toPx(shape.vertices[i][0], shape.vertices[i][1]);
        ctx.lineTo(pt[0], pt[1]);
      }
      ctx.closePath();
      ctx.clip();

      if (shape.imagePath) {
        const img = imageCache.current[shape.imagePath] || getImage(shape.imagePath);
        if (img && img.complete && img.naturalWidth > 0) {
          const center = getPolygonCenter(shape.vertices);
          const cPx = toPx(center[0], center[1]);

          ctx.translate(cPx[0] + shape.transform.panX * cw, cPx[1] + shape.transform.panY * ch);
          ctx.rotate(shape.transform.rotate);
          ctx.scale(shape.transform.zoom, shape.transform.zoom);

          const bounds = getPolygonBounds(shape.vertices);
          const shapeW = (bounds.maxX - bounds.minX) * cw;
          const shapeH = (bounds.maxY - bounds.minY) * ch;
          const scaleX = shapeW / img.naturalWidth;
          const scaleY = shapeH / img.naturalHeight;
          const defaultScale = Math.max(scaleX, scaleY) || 1;

          const scaledW = img.naturalWidth * defaultScale;
          const scaledH = img.naturalHeight * defaultScale;

          ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
        } else {
          ctx.fillStyle = shape.color || (shape.id === effectiveSelectedShapeId ? 'rgba(239, 255, 27, 0.24)' : 'rgba(248, 249, 244, 0.28)');
          ctx.fill();
        }
      } else {
        ctx.fillStyle = shape.color || (shape.id === effectiveSelectedShapeId ? 'rgba(239, 255, 27, 0.24)' : 'rgba(248, 249, 244, 0.28)');
        ctx.fill();
      }

      ctx.restore();

      // Stroke
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      for (let i = 1; i < shape.vertices.length; i++) {
        const pt = toPx(shape.vertices[i][0], shape.vertices[i][1]);
        ctx.lineTo(pt[0], pt[1]);
      }
      ctx.closePath();
      ctx.lineWidth = shape.id === effectiveSelectedShapeId ? 3.5 : 2;
      ctx.strokeStyle = shape.id === effectiveSelectedShapeId ? '#ffffff' : (shape.color || 'rgba(248, 249, 244, 0.7)');
      ctx.stroke();

      // Vertex handles on selected shape in IDLE mode
      if (shape.id === effectiveSelectedShapeId && editorState === 'IDLE') {
        shape.vertices.forEach(v => {
          const [vx, vy] = toPx(v[0], v[1]);
          ctx.beginPath();
          ctx.arc(vx, vy, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }

      // Shape label at centroid
      const center = getPolygonCenter(shape.vertices);
      const [lblX, lblY] = toPx(center[0], center[1]);
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 5;
      ctx.fillText(shape.name || 'Shape', lblX, lblY);
      ctx.restore();
    });

    // 3. Draw Snapping Indicators
    if (previewCursor && (previewCursor.snapX || previewCursor.snapY) && (editorState === 'DRAWING' || dragRef.current?.active)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 255, 27, 0.86)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const px = previewCursor.x * cw;
      const py = previewCursor.y * ch;
      if (previewCursor.snapX) {
        ctx.moveTo(px, 0);
        ctx.lineTo(px, ch);
      }
      if (previewCursor.snapY) {
        ctx.moveTo(0, py);
        ctx.lineTo(cw, py);
      }
      ctx.stroke();

      ctx.fillStyle = '#efff1b';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Active Drawing Shape
    if (editorState === 'DRAWING' && drawingShape.length > 0) {
      ctx.save();
      ctx.beginPath();
      const start = toPx(drawingShape[0][0], drawingShape[0][1]);
      ctx.moveTo(start[0], start[1]);
      for (let i = 1; i < drawingShape.length; i++) {
        const pt = toPx(drawingShape[i][0], drawingShape[i][1]);
        ctx.lineTo(pt[0], pt[1]);
      }
      if (previewCursor) {
        const pt = toPx(previewCursor.x, previewCursor.y);
        ctx.lineTo(pt[0], pt[1]);
      }

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#efff1b';
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < drawingShape.length; i++) {
        const pt = toPx(drawingShape[i][0], drawingShape[i][1]);
        ctx.fillStyle = i === 0 ? '#ffffff' : '#efff1b';
        ctx.fillRect(pt[0] - 5, pt[1] - 5, 10, 10);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(pt[0] - 5, pt[1] - 5, 10, 10);
      }
      ctx.restore();
    }

    // 5. Crisp canvas perimeter border so user clearly sees where canvas ends
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, cw - 1.5, ch - 1.5);
    ctx.restore();

    // 6. Watermark hint if canvas has no shapes
    if (project.shapes.length === 0 && project.background.type === 'color') {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '600 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Canvas Active • Click "+ Draw Shape" to place polygon masks', cw / 2, ch / 2);
      ctx.restore();
    }
  }, [openModal, project, drawingShape, editorState, selectedShapeId, previewCursor, canvasTick, canvasResizeCount]);

  // ═══════════════════════════════════════════════════════════════
  // 4. QUALITY HANDLERS
  // ═══════════════════════════════════════════════════════════════
  const handleCycleRes = async () => {
    const nextIdx = (resIdx + 1) % resolutions.length;
    setResIdx(nextIdx);
    if (resolutions[nextIdx] === 'Auto') {
      await setQualityAuto();
    } else {
      const scale = resScales[nextIdx];
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

  // ═══════════════════════════════════════════════════════════════
  // 5. IMAGE IMPORT (per-effect)
  // ═══════════════════════════════════════════════════════════════
  const handleImportImage = async (effect: string, imageKey: string) => {
    // Show picker: either browse or pick from saved wallpapers
    setPickerTarget({ effect, imageKey });
    try {
      const list = await listWallpapers();
      setPickerWallpapers(list);
    } catch { setPickerWallpapers([]); }
    setShowWallpaperPicker(true);
  };

  const executeDirectImport = async (effect: string, imageKey: string) => {
    try {
      const selected = await open({
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
        multiple: false,
      });
      if (typeof selected === 'string') {
        const imported = await importWallpaper(selected);
        applyImageToEffect(effect, imageKey, imported);
      }
    } catch (err) {
      console.error('Failed to import image:', err);
    }
  };

  const applyImageToEffect = async (effect: string, imageKey: string, path: string) => {
    setEffectImages(prev => ({
      ...prev,
      [effect]: { ...prev[effect], [imageKey]: path },
    }));

    // For Depth Parallax: auto-generate depth map
    if (effect === 'Depth Parallax' && imageKey === 'testWallpaper') {
      setIsGeneratingDepth(true);
      setDepthError(null);
      try {
        await generateDepthMap(path);
      } catch (err: any) {
        setDepthError('Depth generation failed: ' + err.toString());
      } finally {
        setIsGeneratingDepth(false);
      }
    }

    // Save to store
    const engineId = EFFECT_TO_ENGINE_ID[effect];
    if (engineId) {
      const savePayload: Record<string, any> = { [imageKey]: path };
      await saveEffectSettings(engineId, savePayload);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 6. SLIDER HANDLERS (with debounced IPC)
  // ═══════════════════════════════════════════════════════════════
  const handleSliderChange = (paramKey: string, value: number) => {
    setEffectParams(prev => ({
      ...prev,
      [selectedEffect]: {
        ...(prev[selectedEffect] || {}),
        [paramKey]: value,
      }
    }));

    // Debounced real-time IPC push
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => setSetting(paramKey, value), 50);

    // Save effect settings
    const current = { ...(effectParams[selectedEffect] || {}), [paramKey]: value };
    const engineId = EFFECT_TO_ENGINE_ID[selectedEffect];
    if (engineId) saveEffectSettings(engineId, current);
  };

  const handleOutlineColorChange = (hex: string) => {
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
    saveEffectSettings('brick_outline', { outlineColor: hex });
  };

  const handleFadeWhenRestingChange = (checked: boolean) => {
    setCRFadeWhenResting(checked);
    setSetting('fadeWhenResting', checked ? 1 : 0);
    saveEffectSettings('cursor_reveal', { fadeWhenResting: checked ? 1 : 0 });
  };

  // ═══════════════════════════════════════════════════════════════
  // 7. ACTIVATE EFFECT (per-effect logic)
  // ═══════════════════════════════════════════════════════════════
  const handleActivateEffect = async () => {
    const engineId = EFFECT_TO_ENGINE_ID[selectedEffect];
    if (!engineId) return;

    const images = effectImages[selectedEffect] || {};

    try {
      // ── Per-effect layerA / layerB logic ──
      if (selectedEffect === 'Cursor Reveal') {
        if (!images.layerA || !images.layerB) {
          alert('Please import both Layer A and Layer B images.');
          return;
        }
        if (!(await fileExists(images.layerA)) || !(await fileExists(images.layerB))) {
          alert('One or both wallpaper files are missing. Please import them again.');
          return;
        }
        await applyWallpaper(images.layerA, images.layerB);
      } else if (selectedEffect === 'Depth Parallax') {
        if (!images.testWallpaper) {
          alert('Please import a wallpaper image first.');
          return;
        }
        if (!(await fileExists(images.testWallpaper))) {
          alert('Wallpaper file is missing or was deleted. Please import it again.');
          return;
        }
        const depthImage = images.testWallpaper.replace(/\.[^/.]+$/, '') + '_depth.png';
        await applyWallpaper(images.testWallpaper, depthImage);
      } else {
        // Single-image effects
        const baseImage = images.baseImage;
        if (!baseImage) {
          alert('Please import a wallpaper image first.');
          return;
        }
        if (!(await fileExists(baseImage))) {
          alert('Wallpaper file is missing or was deleted. Please import it again.');
          return;
        }
        await applyWallpaper(baseImage, '');
      }

      // ── Set the shader effect ──
      await applyEffectEngine(engineId);

      // ── Push all slider parameters to backend ──
      const params = effectParams[selectedEffect] || {};
      for (const [k, v] of Object.entries(params)) {
        await setSetting(k, v);
      }

      // ── Special: Brick Outline color ──
      if (selectedEffect === 'Brick Outline') {
        const hex = boOutlineColor;
        const r = parseInt(hex.slice(1, 3), 16) / 255.0;
        const g = parseInt(hex.slice(3, 5), 16) / 255.0;
        const b = parseInt(hex.slice(5, 7), 16) / 255.0;
        await setSetting('outlineColorR', r);
        await setSetting('outlineColorG', g);
        await setSetting('outlineColorB', b);
      }

      // ── Special: Cursor Reveal fade when resting ──
      if (selectedEffect === 'Cursor Reveal') {
        await setSetting('fadeWhenResting', crFadeWhenResting ? 1 : 0);
      }

      setActiveEffect(selectedEffect);
      await saveSelectedEffect(engineId);

      // Build session for persistence
      const layerA = selectedEffect === 'Cursor Reveal' ? images.layerA || '' :
                     selectedEffect === 'Depth Parallax' ? images.testWallpaper || '' :
                     images.baseImage || '';
      const layerB = selectedEffect === 'Cursor Reveal' ? images.layerB || '' :
                     selectedEffect === 'Depth Parallax' ? (images.testWallpaper || '').replace(/\.[^/.]+$/, '') + '_depth.png' :
                     '';
      await saveActiveSession({ effect: engineId, layerA, layerB });

      // Save complete effect settings
      await saveEffectSettings(engineId, { ...params, ...images });

      // Save wallpaper pairing
      await saveWallpaperPairing(layerA, engineId, params);

    } catch (err) {
      console.error('Failed to activate effect:', err);
      alert('Failed to activate effect: ' + err);
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

  // ═══════════════════════════════════════════════════════════════
  // 8. 3D WEB WALLPAPER HANDLERS
  // ═══════════════════════════════════════════════════════════════
  const handleImportGlb = async () => {
    try {
      const selected = await open({
        filters: [{ name: '3D Models', extensions: ['glb', 'gltf'] }],
        multiple: false,
      });
      if (typeof selected === 'string') {
        const imported = await importWebAsset(selected);
        setWebModelPath(imported);
        return;
      }
    } catch (err) {
      console.warn('Tauri dialog not available:', err);
    }
    if (glbFileInputRef.current) glbFileInputRef.current.click();
  };

  const handleImportBgImage = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
        multiple: false,
      });
      if (typeof selected === 'string') {
        const imported = await importWebAsset(selected);
        setWebBgImage(imported);
        return;
      }
    } catch (err) {
      console.warn('Tauri dialog not available:', err);
    }
    if (bgImageFileInputRef.current) bgImageFileInputRef.current.click();
  };

  const handleActivate3D = async () => {
    if (!webModelPath) { alert('Please select a 3D .glb model first.'); return; }
    try {
      await startWebWallpaper(webModelPath, webBgType, webBgColor, webBgImage || undefined, webSens, webZoom, webHOff, webVOff, true, 0, 0);
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

  // ═══════════════════════════════════════════════════════════════
  // 9. THEME HANDLERS
  // ═══════════════════════════════════════════════════════════════
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
  const handleResetTheme = () => { handleHighlightChange('#dfff4f'); handleSecondaryChange('#f4f6f4'); };

  // ═══════════════════════════════════════════════════════════════
  // 10. SETTINGS HANDLERS
  // ═══════════════════════════════════════════════════════════════
  const handleToggleAutostart = async () => {
    try {
      if (autostartEnabled) { await disableAuto(); setAutostartEnabled(false); }
      else { await enableAuto(); setAutostartEnabled(true); }
    } catch (err) { console.error('Failed to toggle autostart:', err); }
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

  // ═══════════════════════════════════════════════════════════════
  // 11. CANVAS STUDIO & BAKED WALLPAPERS HANDLERS
  // ═══════════════════════════════════════════════════════════════
  const saveProject = async (projToSave: Project) => {
    try {
      const store = await load('gallery-project.json');
      await store.set('project', projToSave);
      await store.save();
    } catch (err) {
      console.error("Failed to save gallery project:", err);
    }
  };

  const getNormalizedMousePos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return [x, y];
  };

  const SNAP_THRESHOLD_PX = 15;
  const getSnappedNormalizedMousePos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number, boolean, boolean] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0, false, false];
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    let snapX = false;
    let snapY = false;

    if (x < SNAP_THRESHOLD_PX) { x = 0; snapX = true; }
    else if (x > rect.width - SNAP_THRESHOLD_PX) { x = rect.width; snapX = true; }

    if (y < SNAP_THRESHOLD_PX) { y = 0; snapY = true; }
    else if (y > rect.height - SNAP_THRESHOLD_PX) { y = rect.height; snapY = true; }

    return [
      Math.max(0, Math.min(1, x / rect.width)),
      Math.max(0, Math.min(1, y / rect.height)),
      snapX,
      snapY
    ];
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const [snappedNx, snappedNy] = getSnappedNormalizedMousePos(e);
    const [rawNx, rawNy] = getNormalizedMousePos(e);

    if (editorState === 'DRAWING') {
      // Connect to start point if clicking close to vertex 0
      if (drawingShape.length >= 3) {
        const startX = drawingShape[0][0];
        const startY = drawingShape[0][1];
        const dist = Math.hypot(snappedNx - startX, snappedNy - startY);
        if (dist < 0.04) {
          finishDrawingShape();
          return;
        }
      }
      setDrawingShape(prev => [...prev, [snappedNx, snappedNy]]);
      return;
    }

    // IDLE MODE:
    const activeShapeId = (selectedShapeId && project.shapes.some(s => s.id === selectedShapeId))
      ? selectedShapeId
      : (project.shapes[0]?.id || null);

    // 1. Check if clicking on a vertex handle of the selected shape
    if (activeShapeId && canvasRef.current) {
      const selShape = project.shapes.find(s => s.id === activeShapeId);
      if (selShape) {
        const rect = canvasRef.current.getBoundingClientRect();
        const hitIdx = selShape.vertices.findIndex(v => {
          const vxPx = v[0] * rect.width;
          const vyPx = v[1] * rect.height;
          const mxPx = (e.clientX - rect.left);
          const myPx = (e.clientY - rect.top);
          return Math.hypot(vxPx - mxPx, vyPx - myPx) <= 12;
        });

        if (hitIdx !== -1) {
          dragRef.current = {
            active: true,
            mode: 'vertex',
            shapeId: activeShapeId,
            vertexIdx: hitIdx
          };
          return;
        }
      }
    }

    // 2. Shape selection hit test (top to bottom)
    let clickedShapeId: string | null = null;
    for (let i = project.shapes.length - 1; i >= 0; i--) {
      if (isPointInPolygon([rawNx, rawNy], project.shapes[i].vertices)) {
        clickedShapeId = project.shapes[i].id;
        break;
      }
    }

    if (clickedShapeId) {
      setSelectedShapeId(clickedShapeId);
    }

    // 3. Initiate pan (for image) or move (for untextured shape)
    if (clickedShapeId) {
      const clickedShape = project.shapes.find(s => s.id === clickedShapeId);
      if (clickedShape) {
        if (clickedShape.imagePath) {
          dragRef.current = {
            active: true,
            mode: 'pan',
            shapeId: clickedShapeId,
            startX: rawNx,
            startY: rawNy,
            initialPanX: clickedShape.transform.panX,
            initialPanY: clickedShape.transform.panY
          };
        } else {
          dragRef.current = {
            active: true,
            mode: 'move-shape',
            shapeId: clickedShapeId,
            startX: rawNx,
            startY: rawNy,
            initialVertices: clickedShape.vertices.map(v => [v[0], v[1]])
          };
        }
      }
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [snappedNx, snappedNy, snapX, snapY] = getSnappedNormalizedMousePos(e);
    const [rawNx, rawNy] = getNormalizedMousePos(e);

    setPreviewCursor({ x: snappedNx, y: snappedNy, snapX, snapY });

    if (!dragRef.current?.active) return;

    if (dragRef.current.mode === 'vertex' && dragRef.current.shapeId) {
      setProject(prev => ({
        ...prev,
        shapes: prev.shapes.map(s => {
          if (s.id === dragRef.current!.shapeId) {
            const newVertices = [...s.vertices];
            newVertices[dragRef.current!.vertexIdx!] = [snappedNx, snappedNy];
            return { ...s, vertices: newVertices };
          }
          return s;
        })
      }));
      return;
    }

    if (dragRef.current.mode === 'pan' && dragRef.current.shapeId) {
      const dx = rawNx - dragRef.current.startX!;
      const dy = rawNy - dragRef.current.startY!;
      setProject(prev => ({
        ...prev,
        shapes: prev.shapes.map(s => {
          if (s.id === dragRef.current!.shapeId) {
            return {
              ...s,
              transform: {
                ...s.transform,
                panX: dragRef.current!.initialPanX! + dx,
                panY: dragRef.current!.initialPanY! + dy
              }
            };
          }
          return s;
        })
      }));
      return;
    }

    if (dragRef.current.mode === 'move-shape' && dragRef.current.shapeId && dragRef.current.initialVertices) {
      const dx = rawNx - dragRef.current.startX!;
      const dy = rawNy - dragRef.current.startY!;
      setProject(prev => ({
        ...prev,
        shapes: prev.shapes.map(s => {
          if (s.id === dragRef.current!.shapeId) {
            const moved = dragRef.current!.initialVertices!.map(([vx, vy]) => [
              Math.max(0, Math.min(1, vx + dx)),
              Math.max(0, Math.min(1, vy + dy))
            ] as [number, number]);
            return { ...s, vertices: moved };
          }
          return s;
        })
      }));
      return;
    }
  };

  const handleCanvasPointerUp = () => {
    if (dragRef.current?.active) {
      dragRef.current.active = false;
      commitHistory(project);
      saveProject(project);
    }
  };

  const handleCanvasPointerLeave = () => {
    if (dragRef.current?.active) {
      dragRef.current.active = false;
      commitHistory(project);
      saveProject(project);
    }
    setPreviewCursor(null);
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || project.shapes.length === 0) return;

    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const rawNx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawNy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    let targetShapeId = selectedShapeId;
    for (let i = project.shapes.length - 1; i >= 0; i--) {
      if (isPointInPolygon([rawNx, rawNy], project.shapes[i].vertices)) {
        targetShapeId = project.shapes[i].id;
        break;
      }
    }
    if (!targetShapeId && project.shapes.length > 0) {
      targetShapeId = project.shapes[0].id;
    }
    if (!targetShapeId) return;

    const targetShape = project.shapes.find(s => s.id === targetShapeId);
    if (!targetShape || !targetShape.imagePath) return;

    setSelectedShapeId(targetShapeId);

    if (e.shiftKey) {
      // Shift + Wheel = Rotate image
      const step = (e.deltaY > 0 ? -1 : 1) * (5 * Math.PI / 180);
      let newRotate = targetShape.transform.rotate + step;
      while (newRotate > Math.PI) newRotate -= Math.PI * 2;
      while (newRotate < -Math.PI) newRotate += Math.PI * 2;
      updateShapeTransform(targetShapeId, { rotate: newRotate });
    } else {
      // Normal Wheel = Zoom image
      const zoomDelta = e.deltaY * -0.0015;
      const newZoom = Math.max(0.1, Math.min(8.0, Number((targetShape.transform.zoom + zoomDelta).toFixed(2))));
      updateShapeTransform(targetShapeId, { zoom: newZoom });
    }
  };

  const startDrawing = () => {
    setEditorState('DRAWING');
    setSelectedShapeId(null);
    setDrawingShape([]);
  };

  const cancelDrawing = () => {
    setEditorState('IDLE');
    setDrawingShape([]);
  };

  const finishDrawingShape = () => {
    if (drawingShape.length < 3) return;
    const newShape: Shape = {
      id: `shape-${Date.now()}`,
      name: `Shape ${project.shapes.length + 1}`,
      vertices: drawingShape,
      imagePath: null,
      transform: { panX: 0, panY: 0, zoom: 1, rotate: 0 },
      color: '#efff1b'
    };
    const nextProj: Project = {
      ...project,
      shapes: [...project.shapes, newShape]
    };
    setProject(nextProj);
    commitHistory(nextProj);
    saveProject(nextProj);
    setSelectedShapeId(newShape.id);
    setDrawingShape([]);
    setEditorState('IDLE');
  };

  const handleAssignShapeImage = async (shapeId: string) => {
    try {
      const selected = await open({
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
        multiple: false,
      });
      if (typeof selected === 'string') {
        const imported = await importWallpaper(selected);
        const nextProj: Project = {
          ...project,
          shapes: project.shapes.map(s =>
            s.id === shapeId ? { ...s, imagePath: imported } : s
          )
        };
        setProject(nextProj);
        commitHistory(nextProj);
        saveProject(nextProj);
      }
    } catch (err) {
      console.error('Failed to import shape image:', err);
    }
  };

  const handleClearShapeImage = (shapeId: string) => {
    const nextProj: Project = {
      ...project,
      shapes: project.shapes.map(s =>
        s.id === shapeId ? { ...s, imagePath: null } : s
      )
    };
    setProject(nextProj);
    commitHistory(nextProj);
    saveProject(nextProj);
  };

  const handleDeleteShape = (shapeId: string) => {
    const nextProj: Project = {
      ...project,
      shapes: project.shapes.filter(s => s.id !== shapeId)
    };
    setProject(nextProj);
    commitHistory(nextProj);
    saveProject(nextProj);
    if (selectedShapeId === shapeId) {
      setSelectedShapeId(nextProj.shapes[0]?.id || null);
    }
  };

  const handleUpdateShapeColor = (shapeId: string, color: string) => {
    const nextProj: Project = {
      ...project,
      shapes: project.shapes.map(s =>
        s.id === shapeId ? { ...s, color } : s
      )
    };
    setProject(nextProj);
    saveProject(nextProj);
  };

  const updateShapeTransform = (shapeId: string, partial: Partial<Transform>) => {
    setProject(prev => {
      const nextProj: Project = {
        ...prev,
        shapes: prev.shapes.map(s =>
          s.id === shapeId ? { ...s, transform: { ...s.transform, ...partial } } : s
        )
      };
      saveProject(nextProj);
      return nextProj;
    });
  };

  const handleImportCanvasBackground = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
        multiple: false,
      });
      if (typeof selected === 'string') {
        const imported = await importWallpaper(selected);
        const nextProj: Project = {
          ...project,
          background: { ...project.background, type: 'image', value: imported }
        };
        setProject(nextProj);
        commitHistory(nextProj);
        saveProject(nextProj);
      }
    } catch (err) {
      console.error('Failed to import canvas background image:', err);
    }
  };

  const handleSetBgType = (type: 'color' | 'image') => {
    const nextProj: Project = {
      ...project,
      background: { ...project.background, type }
    };
    setProject(nextProj);
    commitHistory(nextProj);
    saveProject(nextProj);
  };

  const handleSetBgColor = (color: string) => {
    const nextProj: Project = {
      ...project,
      background: { ...project.background, type: 'color', value: color }
    };
    setProject(nextProj);
    saveProject(nextProj);
  };

  const handleSetBgFit = (fit: 'cover' | 'contain' | 'stretch' | 'tile') => {
    const nextProj: Project = {
      ...project,
      background: { ...project.background, fit }
    };
    setProject(nextProj);
    commitHistory(nextProj);
    saveProject(nextProj);
  };

  const handleClearAllCanvas = () => {
    if (confirm("Are you sure you want to clear all shapes from the canvas?")) {
      const clearedProject: Project = {
        ...project,
        shapes: []
      };
      setProject(clearedProject);
      commitHistory(clearedProject);
      saveProject(clearedProject);
      setSelectedShapeId(null);
      setDrawingShape([]);
      setEditorState('IDLE');
    }
  };

  const bakeCanvas = async (): Promise<Uint8Array> => {
    let maxSourceWidth = 0;

    if (project.background.type === 'image' && project.background.value) {
      const bgImg = imageCache.current[project.background.value] || getImage(project.background.value);
      if (bgImg && bgImg.complete) maxSourceWidth = Math.max(maxSourceWidth, bgImg.naturalWidth);
    }

    project.shapes.forEach(shape => {
      if (shape.imagePath) {
        const img = imageCache.current[shape.imagePath] || getImage(shape.imagePath);
        if (img && img.complete) maxSourceWidth = Math.max(maxSourceWidth, img.naturalWidth);
      }
    });

    if (maxSourceWidth === 0) maxSourceWidth = 1920;

    const targetAspect = resolveProjectAspectRatio(project.aspectRatio);
    const targetWidth = Math.min(3840, Math.max(1920, maxSourceWidth), window.screen.width * (window.devicePixelRatio || 1) || 1920);
    const targetHeight = Math.round(targetWidth / targetAspect);

    const offCanvas = document.createElement('canvas');
    offCanvas.width = targetWidth;
    offCanvas.height = targetHeight;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get offscreen 2D canvas context');

    const cw = targetWidth;
    const ch = targetHeight;
    const toPx = (nx: number, ny: number): [number, number] => [nx * cw, ny * ch];

    // 1. Draw Background
    const defaultBgColor = '#242825';
    if (project.background.type === 'color') {
      ctx.fillStyle = project.background.value || defaultBgColor;
      ctx.fillRect(0, 0, cw, ch);
    } else if (project.background.type === 'image' && project.background.value) {
      const img = imageCache.current[project.background.value] || getImage(project.background.value);
      if (img && img.complete && img.naturalWidth > 0) {
        if (project.background.fit === 'cover' || project.background.fit === 'contain') {
          const imgAspect = img.naturalWidth / img.naturalHeight;
          let drawW = cw, drawH = ch;
          if (project.background.fit === 'cover') {
            if (cw / ch > imgAspect) drawH = cw / imgAspect;
            else drawW = ch * imgAspect;
          } else {
            if (cw / ch > imgAspect) drawW = ch * imgAspect;
            else drawH = cw / imgAspect;
          }
          const dx = (cw - drawW) / 2;
          const dy = (ch - drawH) / 2;
          ctx.drawImage(img, dx, dy, drawW, drawH);
        } else if (project.background.fit === 'stretch') {
          ctx.drawImage(img, 0, 0, cw, ch);
        } else if (project.background.fit === 'tile') {
          const pat = ctx.createPattern(img, 'repeat');
          if (pat) {
            ctx.fillStyle = pat;
            ctx.fillRect(0, 0, cw, ch);
          }
        }
      } else {
        ctx.fillStyle = defaultBgColor;
        ctx.fillRect(0, 0, cw, ch);
      }
    } else {
      ctx.fillStyle = defaultBgColor;
      ctx.fillRect(0, 0, cw, ch);
    }

    // 2. Draw Shapes
    project.shapes.forEach((shape) => {
      if (shape.vertices.length < 3) return;

      ctx.save();
      ctx.beginPath();
      const start = toPx(shape.vertices[0][0], shape.vertices[0][1]);
      ctx.moveTo(start[0], start[1]);
      for (let i = 1; i < shape.vertices.length; i++) {
        const pt = toPx(shape.vertices[i][0], shape.vertices[i][1]);
        ctx.lineTo(pt[0], pt[1]);
      }
      ctx.closePath();
      ctx.clip();

      if (shape.imagePath) {
        const img = imageCache.current[shape.imagePath] || getImage(shape.imagePath);
        if (img && img.complete && img.naturalWidth > 0) {
          const center = getPolygonCenter(shape.vertices);
          const cPx = toPx(center[0], center[1]);

          ctx.translate(cPx[0] + shape.transform.panX * cw, cPx[1] + shape.transform.panY * ch);
          ctx.rotate(shape.transform.rotate);
          ctx.scale(shape.transform.zoom, shape.transform.zoom);

          const bounds = getPolygonBounds(shape.vertices);
          const shapeW = (bounds.maxX - bounds.minX) * cw;
          const shapeH = (bounds.maxY - bounds.minY) * ch;
          const scaleX = shapeW / img.naturalWidth;
          const scaleY = shapeH / img.naturalHeight;
          const defaultScale = Math.max(scaleX, scaleY) || 1;

          const scaledW = img.naturalWidth * defaultScale;
          const scaledH = img.naturalHeight * defaultScale;

          ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
        } else {
          ctx.fillStyle = shape.color || 'rgba(255, 255, 255, 0.1)';
          ctx.fill();
        }
      } else {
        ctx.fillStyle = shape.color || 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
      }

      ctx.restore();

      // Stroke
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      for (let i = 1; i < shape.vertices.length; i++) {
        const pt = toPx(shape.vertices[i][0], shape.vertices[i][1]);
        ctx.lineTo(pt[0], pt[1]);
      }
      ctx.closePath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = shape.color || 'rgba(248, 249, 244, 0.64)';
      ctx.stroke();
      ctx.restore();
    });

    const blob = await new Promise<Blob | null>(res => offCanvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Failed to encode canvas to PNG');
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  };

  const handleActivateCanvas = async () => {
    try {
      setIsBaking(true);
      const bytes = await bakeCanvas();
      const savedPath = await saveBakedWallpaper('active-collage.png', bytes);
      const store = await load('gallery-project.json');
      await store.set('project', project);
      if (savedPath) await store.set(`baked_proj_${savedPath}`, project);
      await store.set('baked_proj_active-collage.png', project);
      await store.save();
      await saveActiveSession({ layerA: savedPath, layerB: '', effect: 'none', isGalleryCollage: true });
      await removeEffect();
      await applyWallpaper(savedPath, '');
      setActiveEffect(null);
      setIsBaking(false);
      setOpenModal(null);
      const updated = await listWallpapers();
      setRealBakedWallpapers(updated);
    } catch (err: any) {
      setIsBaking(false);
      console.error('Failed to activate canvas collage:', err);
      alert(`Failed to activate canvas: ${err?.message || err}`);
    }
  };

  const handleSaveCanvasToBaked = async () => {
    try {
      setIsBaking(true);
      const bytes = await bakeCanvas();
      const filename = `gallery-${Date.now()}.png`;
      const savedPath = await saveBakedWallpaper(filename, bytes);
      const store = await load('gallery-project.json');
      await store.set('project', project);
      await store.set(`baked_proj_${filename}`, project);
      if (savedPath) await store.set(`baked_proj_${savedPath}`, project);
      await store.save();
      const updated = await listWallpapers();
      setRealBakedWallpapers(updated);
      setIsBaking(false);
      setOpenModal('modal-baked');
    } catch (err: any) {
      setIsBaking(false);
      console.error('Failed to save baked wallpaper:', err);
      alert(`Failed to save wallpaper: ${err?.message || err}`);
    }
  };

  const handleActivateBakedWallpaper = async (path: string) => {
    try {
      await saveActiveSession({ layerA: path, layerB: '', effect: 'none', isGalleryCollage: true });
      await removeEffect();
      await applyWallpaper(path, '');
      setActiveEffect(null);
      setOpenModal(null);
    } catch (err: any) {
      console.error('Failed to activate wallpaper:', err);
      alert(`Failed to activate: ${err?.message || err}`);
    }
  };

  const handleDeleteBakedWallpaper = async (path: string) => {
    if (!confirm('Are you sure you want to delete this baked wallpaper from your library?')) return;
    try {
      const filename = path.split('\\').pop() || '';
      const store = await load('gallery-project.json');
      await store.delete(`baked_proj_${path}`);
      if (filename) await store.delete(`baked_proj_${filename}`);
      await store.save();
      await deleteBakedWallpaper(path);
      const updated = await listWallpapers();
      setRealBakedWallpapers(updated);
    } catch (err: any) {
      console.error('Failed to delete wallpaper:', err);
      alert(`Failed to delete: ${err?.message || err}`);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════
  const getEffectImagePath = (effect: string, key: string): string | null => {
    return effectImages[effect]?.[key] || null;
  };

  const isActivateDisabled = (): boolean => {
    const images = effectImages[selectedEffect] || {};
    if (selectedEffect === 'Cursor Reveal') return !images.layerA || !images.layerB;
    if (selectedEffect === 'Depth Parallax') return !images.testWallpaper || isGeneratingDepth;
    return !images.baseImage;
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      {/* ─── SPLASH SCREEN ─── */}
      <div id="splash-screen" className={showSplash ? '' : 'hidden'}>
        <div className="splash-logo-box">
          <span className="splash-mark">G</span>
          <span>GRAFFITI</span>
        </div>
        <div className="splash-sub">Your wallpaper workspace</div>
      </div>

      {/* ─── MAIN BENTO WORKSPACE ─── */}
      <main className="workspace-wrapper" aria-label="Graffiti wallpaper workspace">
        <header className="studio-header">
          <div className="brand-lockup">
            <span className="brand-mark">G</span>
            <div>
              <div className="brand-name">GRAFFITI</div>
              <div className="brand-note">Desktop wallpaper lab</div>
            </div>
          </div>
          <div className="header-note">
            <span className="live-led" />
            <span>Offline by design</span>
            <span className="header-divider">/</span>
            <span>Build 1.0</span>
          </div>
        </header>

        {/* ═══════════════ CARD 1: EFFECTS STUDIO ═══════════════ */}
        <div className="card-effects-wrapper">
          {/* Quality Circle Badges */}
          <div className="card-effects-cutout">
            <button className="top-circle-btn" id="btn-cycle-res" title="Click to cycle Resolution" onClick={handleCycleRes}>
              <span className="circle-label">RES</span>
              <span className="circle-val">{resolutions[resIdx]}</span>
            </button>
            <button className="top-circle-btn" id="btn-cycle-fps" title="Click to cycle Frame Rate" onClick={handleCycleFps}>
              <span className="circle-label">FPS</span>
              <span className="circle-val">{fpsOptions[fpsIdx]}</span>
            </button>
          </div>

          <section className="card-effects">
            <div className="effects-header-meta">
              <div className="effects-status-tag">
                <span className={`status-dot ${activeEffect ? 'active' : ''}`} />
                <span>{activeEffect ? `Active: ${activeEffect}` : liveFps > 0 ? `${liveFps.toFixed(0)} FPS` : 'Native GPU Ready'}</span>
              </div>
              <h1 className="card-title" style={{ marginTop: '10px' }}>Effects Studio</h1>
              <p className="card-subtitle">Real-time interactive desktop shaders</p>
            </div>

            <div className="effects-controls-grid">
              <div className="control-row-split">
                <button className="pill-select-btn" id="btn-choose-effect" onClick={() => { setSidePopupView('effects'); setSidePopupOpen(true); }}>
                  <span>{selectedEffect}</span>
                  <span className="caret">▸</span>
                </button>
                <button className="pill-select-btn" id="btn-open-sliders" onClick={() => { setSidePopupView('sliders'); setSidePopupOpen(true); }}>
                  <span>Sliders</span>
                  <span className="caret">▸</span>
                </button>
              </div>

              {/* Per-effect image status display */}
              <div className="effects-image-list">
                {(EFFECT_IMAGE_KEYS[selectedEffect] || []).map(imgKey => {
                  const path = getEffectImagePath(selectedEffect, imgKey);
                  const label = EFFECT_IMAGE_LABELS[selectedEffect]?.[imgKey] || imgKey;
                  return (
                    <button
                      key={imgKey}
                      className="pill-select-btn image-select-btn"
                      onClick={() => handleImportImage(selectedEffect, imgKey)}
                    >
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                        <span className="image-select-label">{EFFECT_IMAGE_KEYS[selectedEffect].length > 1 ? label : 'Choose image'}</span>
                        <span>{path ? path.split('\\').pop() : (EFFECT_IMAGE_KEYS[selectedEffect].length > 1 ? 'Choose image' : 'Choose image')}</span>
                      </span>
                      <span className="caret">{path ? 'Change' : 'Browse'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Depth Parallax status messages */}
            {selectedEffect === 'Depth Parallax' && isGeneratingDepth && (
              <div style={{ padding: '8px 16px', fontSize: '0.8rem', color: 'var(--highlight)', fontWeight: 600 }}>
                 Generating ML depth map…
              </div>
            )}
            {selectedEffect === 'Depth Parallax' && depthError && (
              <div style={{ padding: '8px 16px', fontSize: '0.8rem', color: '#c45c5c', fontWeight: 600 }}>
                 Warning: {depthError}
              </div>
            )}

            <div className="effects-bottom-bar">
              <button
                className="btn-dark-pill"
                id="btn-activate-effect"
                onClick={handleActivateEffect}
                disabled={isActivateDisabled()}
                style={{ opacity: isActivateDisabled() ? 0.5 : 1 }}
              >
                {isGeneratingDepth && selectedEffect === 'Depth Parallax' ? 'Generating…' :
                 activeEffect === selectedEffect ? 'Re-Apply' : 'Activate'}
              </button>
              <button className="btn-outline-pill" id="btn-stop-effect" onClick={handleStopEffect}>
                Stop Effect
              </button>
            </div>
          </section>

          {/* ─── SIDE POPUP ─── */}
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
                        onClick={() => { setSelectedEffect(name); setSidePopupView('sliders'); }}
                      >
                        <span className="ef-name">{name}</span>
                        <span className="ef-sub">{EFFECTS_DATA[name].length} params</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* View B: Per-effect Image Imports + Sliders */}
                {sidePopupView === 'sliders' && (
                  <div className="sliders-list">
                    {/* Image Import Buttons */}
                    <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(EFFECT_IMAGE_KEYS[selectedEffect] || []).map(imgKey => {
                        const path = getEffectImagePath(selectedEffect, imgKey);
                        const label = EFFECT_IMAGE_LABELS[selectedEffect]?.[imgKey] || imgKey;
                        return (
                          <button
                            key={imgKey}
                            className={`pill-select-btn ${path ? 'active' : ''}`}
                            onClick={() => handleImportImage(selectedEffect, imgKey)}
                            style={{ fontSize: '0.82rem' }}
                          >
                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px' }}>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                              <span>{path ? path.split('\\').pop() : 'Import Image…'}</span>
                            </span>
                            <span className="caret" style={{ fontSize: '0.72rem' }}>Browse</span>
                          </button>
                        );
                      })}

                      {/* Depth Parallax: depth map status */}
                      {selectedEffect === 'Depth Parallax' && isGeneratingDepth && (
                        <div style={{ fontSize: '0.76rem', color: 'var(--highlight)', fontWeight: 600, padding: '4px 0' }}>
                           Generating depth map…
                        </div>
                      )}
                      {selectedEffect === 'Depth Parallax' && depthError && (
                        <div style={{ fontSize: '0.76rem', color: '#c45c5c', fontWeight: 500, padding: '4px 0' }}>
                          {depthError}
                        </div>
                      )}
                    </div>

                    {/* Parameter Sliders */}
                    {(EFFECTS_DATA[selectedEffect] || []).map((p) => {
                      const curVal = effectParams[selectedEffect]?.[p.key] ?? p.val;
                      return (
                        <div key={p.key} className="slider-group">
                          <div className="slider-label-row">
                            <span>{p.name}</span>
                            <span>{typeof curVal === 'number' ? (Number.isInteger(curVal) ? curVal : curVal.toFixed(3)) : curVal}{p.unit}</span>
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

                    {/* Special: Cursor Reveal — Fade When Resting */}
                    {selectedEffect === 'Cursor Reveal' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                        <input
                          type="checkbox"
                          id="crFadeResting"
                          checked={crFadeWhenResting}
                          onChange={(e) => handleFadeWhenRestingChange(e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--highlight)' }}
                        />
                        <label htmlFor="crFadeResting" style={{ margin: 0, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Disappear when cursor is resting
                        </label>
                      </div>
                    )}

                    {/* Special: Brick Outline — Color Picker */}
                    {selectedEffect === 'Brick Outline' && (
                      <div className="slider-group">
                        <div className="slider-label-row">
                          <span>Outline Color</span>
                          <span style={{ fontFamily: 'monospace' }}>{boOutlineColor}</span>
                        </div>
                        <input
                          type="color"
                          value={boOutlineColor}
                          onChange={(e) => handleOutlineColorChange(e.target.value)}
                          style={{ width: '100%', height: '36px', border: 'none', borderRadius: '10px', cursor: 'pointer', padding: 0, background: 'transparent' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {sidePopupView === 'effects' ? 'Select an effect to configure' : 'Live shader parameters'}
                </span>
                <button className="btn-dark-pill" style={{ padding: '8px 16px', fontSize: '0.78rem' }} onClick={() => setSidePopupOpen(false)}>
                  Done
                </button>
              </div>
            </aside>
          )}
        </div>

        {/* ═══════════════ CARD 2: GALLERY ═══════════════ */}
        <section className="bento-card card-gallery">
          <div className="gallery-top-row">
            <div>
              <h2 className="card-title">Gallery</h2>
              <p className="card-subtitle">Custom polygon masks & saved collages</p>
            </div>
            <span className="badge-outline">{realBakedWallpapers.length} Baked Saved</span>
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

        {/* ═══════════════ CARD 3: WEB WALLPAPER ═══════════════ */}
        <section className="bento-card card-web">
          <div className="web-header-row">
            <div>
              <h2 className="card-title">Web wallpaper</h2>
              <p className="card-subtitle">Interactive 3D GLB scenes & cursor camera</p>
            </div>
            <button className="btn-dark-pill" onClick={() => setOpenModal('modal-web')}>Set Model</button>
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
            <button className="btn-outline-pill" onClick={handleStop3D}>Stop 3D Wallpaper</button>
          </div>
        </section>

        {/* ═══════════════ CARD 4: SETTINGS / THEME / ABOUT ═══════════════ */}
        <div className="subgrid-three">
          <button className="mini-card-settings" onClick={() => setOpenModal('settings-page')}>
            <div className="settings-circle-badge">Open</div>
            <div className="settings-card-text">
              <div className="s-title">Settings</div>
              <div className="s-sub">Startup & power rules</div>
            </div>
          </button>

          <button className="mini-card-theme" onClick={() => setOpenModal('modal-theme')}>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>Theme</div>
                <div style={{ fontSize: '0.76rem', opacity: 0.7, marginTop: '2px' }}>Two color controls</div>
            </div>
            <div className="theme-wave-accent">
              <span className="theme-pill-indicator">Customize</span>
            </div>
          </button>

          <button className="mini-card-about" onClick={() => setOpenModal('modal-about')}>
            <div className="about-corner-badge">Read</div>
            <div className="about-top-header">
              <div className="about-white-circle">v2</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.25 }}>Documentation<br />& Memory Guide</div>
            </div>
            <div className="about-card-footer">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Complete Guide</div>
              <div className="about-stat-big">About</div>
              <div className="about-card-meta">6 effects · memory · next update</div>
            </div>
          </button>
        </div>
      </main>

      {/* ═══════════════ MODAL: CANVAS STUDIO ═══════════════ */}
      {openModal === 'modal-canvas' && (() => {
        const monitorInfo = getMonitorAspect();
        const effectiveSelectedShapeId = (selectedShapeId && project.shapes.some(s => s.id === selectedShapeId))
          ? selectedShapeId
          : (project.shapes[0]?.id || null);
        const selectedShape = project.shapes.find(s => s.id === effectiveSelectedShapeId) || null;

        return (
          <div className="modal-backdrop">
            <div className="popup-window large">
              <div className="popup-top-bar">
                <h2>Canvas Studio</h2>
                <button className="close-circle-x" onClick={() => setOpenModal(null)}>✕</button>
              </div>

              <div className="canvas-workspace-grid">
                <div className="drawing-board-container" ref={canvasContainerRef}>
                  <div style={{
                    position: 'absolute',
                    top: 14,
                    left: 18,
                    background: 'rgba(25, 28, 25, 0.88)',
                    backdropFilter: 'blur(8px)',
                    color: 'var(--highlight)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    pointerEvents: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    zIndex: 10
                  }}>
                    Canvas Ratio: {(!project.aspectRatio || project.aspectRatio === 'auto') ? `Auto (${monitorInfo.label})` : project.aspectRatio}
                  </div>

                  <canvas
                    ref={canvasRef}
                    id="collage-canvas"
                    style={{
                      cursor: editorState === 'DRAWING'
                        ? 'crosshair'
                        : (dragRef.current?.active ? 'grabbing' : 'default')
                    }}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                    onPointerLeave={handleCanvasPointerLeave}
                    onWheel={handleCanvasWheel}
                  />
                  <div className="canvas-bottom-toolbar">
                    {editorState === 'DRAWING' ? (
                      <>
                        <span style={{ color: '#ffffff', fontSize: '0.78rem', padding: '0 8px', display: 'flex', alignItems: 'center' }}>
                          Click to place points ({drawingShape.length}). Click start or Complete.
                        </span>
                        <button
                          className="toolbar-btn highlight"
                          onClick={finishDrawingShape}
                          disabled={drawingShape.length < 3}
                          style={{ opacity: drawingShape.length < 3 ? 0.5 : 1 }}
                        >
                          Complete Shape
                        </button>
                        <button className="toolbar-btn" onClick={cancelDrawing}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="toolbar-btn"
                          onClick={handleUndo}
                          disabled={historyIndex.current <= 0}
                          style={{ opacity: historyIndex.current <= 0 ? 0.5 : 1 }}
                          title="Undo (Ctrl+Z)"
                        >
                          Undo
                        </button>
                        <button
                          className="toolbar-btn"
                          onClick={handleRedo}
                          disabled={historyIndex.current >= history.current.length - 1}
                          style={{ opacity: historyIndex.current >= history.current.length - 1 ? 0.5 : 1 }}
                          title="Redo (Ctrl+Y)"
                        >
                          Redo
                        </button>
                        {hasPreviousCanvas && (
                          <button
                            className="toolbar-btn"
                            onClick={async () => {
                              try {
                                const store = await load('gallery-project.json');
                                const prev = await store.get<Project>('canvas_previous_project');
                                if (prev) {
                                  await store.set('canvas_previous_project', project);
                                  setProject(prev);
                                  commitHistory(prev);
                                  await saveProject(prev);
                                  await store.save();
                                  if (prev.shapes.length > 0) {
                                    setSelectedShapeId(prev.shapes[0].id);
                                  }
                                }
                              } catch (err) {
                                console.error('Failed to restore previous canvas shapes:', err);
                              }
                            }}
                            title="Restore older shapes that were in the canvas before opening a baked wallpaper"
                            style={{ borderColor: 'rgba(223, 255, 79, 0.5)', color: 'var(--highlight)' }}
                          >
                            Restore Shapes
                          </button>
                        )}
                        <button className="toolbar-btn highlight" onClick={startDrawing}>
                          + Draw Shape
                        </button>
                        <button className="toolbar-btn" onClick={handleClearAllCanvas} style={{ color: '#ff6b6b' }}>
                          Clear
                        </button>
                        <button
                          className="toolbar-btn highlight"
                          onClick={handleActivateCanvas}
                          disabled={isBaking}
                        >
                          {isBaking ? 'Baking…' : 'Activate'}
                        </button>
                        <button
                          className="toolbar-btn"
                          onClick={handleSaveCanvasToBaked}
                          disabled={isBaking}
                        >
                          {isBaking ? 'Saving…' : 'Save to Baked'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="canvas-sidebar">
                  {/* Canvas Ratio Selector */}
                  <div className="sidebar-box">
                    <h4>Canvas Ratio</h4>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Screen Ratio</span>
                      <select
                        value={project.aspectRatio || 'auto'}
                        onChange={(e) => {
                          const next: Project = { ...project, aspectRatio: e.target.value };
                          setProject(next);
                          commitHistory(next);
                          saveProject(next);
                        }}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-soft)',
                          background: '#f4f6f4',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          maxWidth: '160px'
                        }}
                      >
                        <option value="auto">Auto (Monitor: {monitorInfo.label})</option>
                        <option value="16:9">16:9 Widescreen</option>
                        <option value="16:10">16:10 Display</option>
                        <option value="21:9">21:9 Ultrawide</option>
                        <option value="3:2">3:2 Surface/Book</option>
                        <option value="4:3">4:3 Standard</option>
                      </select>
                    </div>
                    <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                      {(!project.aspectRatio || project.aspectRatio === 'auto')
                         ? `Auto-mimicking monitor: ${monitorInfo.label}`
                        : `Locked to ${project.aspectRatio}`}
                    </div>
                  </div>

                  <div className="sidebar-box">
                    <h4>Canvas Background</h4>
                    <div className="control-row-split" style={{ marginBottom: '8px' }}>
                      <button
                        type="button"
                        className={`pill-select-btn ${project.background.type === 'color' ? 'active' : ''}`}
                        onClick={() => handleSetBgType('color')}
                      >
                        Solid
                      </button>
                      <button
                        type="button"
                        className={`pill-select-btn ${project.background.type === 'image' ? 'active' : ''}`}
                        onClick={() => handleSetBgType('image')}
                      >
                        Image
                      </button>
                    </div>
                    {project.background.type === 'color' ? (
                      <input
                        type="color"
                        value={project.background.value}
                        onChange={(e) => handleSetBgColor(e.target.value)}
                        style={{ width: '100%', height: '38px', border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                      />
                    ) : (
                      <>
                        <button className="pill-select-btn" style={{ width: '100%', fontSize: '0.8rem', marginBottom: '8px' }} onClick={handleImportCanvasBackground}>
                          <span>{project.background.value ? project.background.value.split('\\').pop() : 'Browse Image…'}</span>
                          <span className="caret">Browse</span>
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Fit Mode</span>
                          <select
                            value={project.background.fit}
                            onChange={(e) => handleSetBgFit(e.target.value as any)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-soft)',
                              background: '#f4f6f4',
                              fontSize: '0.78rem'
                            }}
                          >
                            <option value="cover">Cover</option>
                            <option value="contain">Contain</option>
                            <option value="stretch">Stretch</option>
                            <option value="tile">Tile</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="sidebar-box">
                    <h4>Shapes List ({project.shapes.length})</h4>
                    {project.shapes.length === 0 ? (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0' }}>
                        No shapes yet. Click <strong>+ Draw Shape</strong> to draw custom masks.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                        {project.shapes.map((s) => (
                          <button
                            key={s.id}
                            className="shape-pill-item"
                            onClick={() => setSelectedShapeId(s.id)}
                            style={{
                              background: s.id === effectiveSelectedShapeId ? 'var(--highlight)' : 'var(--bg-card)',
                              color: s.id === effectiveSelectedShapeId ? 'var(--text-dark)' : 'inherit',
                              fontWeight: s.id === effectiveSelectedShapeId ? 700 : 500,
                              cursor: 'pointer',
                              border: 'none',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: s.color || '#efff1b', display: 'inline-block', border: '1px solid rgba(0,0,0,0.2)' }} />
                              {s.name}
                            </span>
                            <span className="shape-kind">{s.imagePath ? 'Image' : 'Solid'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected Shape Controls */}
                  {selectedShape && (
                    <div className="sidebar-box">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0 }}>{selectedShape.name}</h4>
                        <button
                          onClick={() => handleDeleteShape(selectedShape.id)}
                          title="Delete shape"
                          style={{ background: 'transparent', border: 'none', color: '#c45c5c', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                          Delete
                        </button>
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fill Color</div>
                      <input
                        type="color"
                        value={selectedShape.color || '#efff1b'}
                        onChange={(e) => handleUpdateShapeColor(selectedShape.id, e.target.value)}
                        style={{ width: '100%', height: '36px', border: 'none', borderRadius: '10px', cursor: 'pointer', marginBottom: '8px' }}
                      />

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Image</div>
                      <button
                        className="pill-select-btn"
                        style={{ width: '100%', fontSize: '0.8rem' }}
                        onClick={() => handleAssignShapeImage(selectedShape.id)}
                      >
                        <span>{selectedShape.imagePath ? selectedShape.imagePath.split('\\').pop() : 'Assign Image…'}</span>
                        <span className="caret">Browse</span>
                      </button>

                      {selectedShape.imagePath && (
                        <>
                          <button
                            className="btn-outline-pill"
                            style={{ width: '100%', marginTop: '6px', fontSize: '0.76rem' }}
                            onClick={() => handleClearShapeImage(selectedShape.id)}
                          >
                            Clear Image
                          </button>

                          {/* Zoom Controls */}
                          <div style={{ marginTop: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Zoom</span>
                              <strong style={{ color: 'var(--text-dark)' }}>{selectedShape.transform.zoom.toFixed(2)}x</strong>
                            </div>
                            <input
                              type="range"
                              min="0.1"
                              max="5.0"
                              step="0.01"
                              value={selectedShape.transform.zoom}
                              onChange={(e) => updateShapeTransform(selectedShape.id, { zoom: parseFloat(e.target.value) })}
                              style={{ width: '100%', cursor: 'pointer' }}
                            />
                            <div className="transform-btn-group">
                              <button
                                type="button"
                                className="transform-step-btn"
                                title="Zoom Out (-0.1x)"
                                onClick={() => updateShapeTransform(selectedShape.id, { zoom: Math.max(0.1, Number((selectedShape.transform.zoom - 0.1).toFixed(2))) })}
                              >
                                -0.1x
                              </button>
                              <button
                                type="button"
                                className="transform-step-btn"
                                title="Reset Zoom (1.0x)"
                                onClick={() => updateShapeTransform(selectedShape.id, { zoom: 1.0 })}
                              >
                                1.0x
                              </button>
                              <button
                                type="button"
                                className="transform-step-btn"
                                title="Zoom In (+0.1x)"
                                onClick={() => updateShapeTransform(selectedShape.id, { zoom: Math.min(5.0, Number((selectedShape.transform.zoom + 0.1).toFixed(2))) })}
                              >
                                +0.1x
                              </button>
                              <button
                                type="button"
                                className="transform-step-btn"
                                title="Enlarge (2.0x)"
                                onClick={() => updateShapeTransform(selectedShape.id, { zoom: 2.0 })}
                              >
                                2.0x
                              </button>
                            </div>
                          </div>

                          {/* Rotation Controls */}
                          <div style={{ marginTop: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Rotation</span>
                              <strong style={{ color: 'var(--text-dark)' }}>
                                {Math.round(selectedShape.transform.rotate * (180 / Math.PI))}°
                              </strong>
                            </div>
                            <input
                              type="range"
                              min="-180"
                              max="180"
                              step="1"
                              value={Math.round(selectedShape.transform.rotate * (180 / Math.PI))}
                              onChange={(e) => {
                                const deg = parseFloat(e.target.value);
                                updateShapeTransform(selectedShape.id, { rotate: (deg * Math.PI) / 180 });
                              }}
                              style={{ width: '100%', cursor: 'pointer' }}
                            />
                            <div className="transform-btn-group">
                              <button
                                type="button"
                                className="transform-step-btn"
                                title="Rotate Counter-Clockwise (-15°)"
                                onClick={() => {
                                  const curDeg = Math.round(selectedShape.transform.rotate * (180 / Math.PI));
                                  const nextDeg = curDeg - 15;
                                  updateShapeTransform(selectedShape.id, { rotate: (nextDeg * Math.PI) / 180 });
                                }}
                              >
                                -15°
                              </button>
                              <button
                                type="button"
                                className="transform-step-btn"
                                title="Reset Rotation (0°)"
                                onClick={() => updateShapeTransform(selectedShape.id, { rotate: 0 })}
                              >
                                0°
                              </button>
                              <button
                                type="button"
                                className="transform-step-btn"
                                title="Rotate Clockwise (+15°)"
                                onClick={() => {
                                  const curDeg = Math.round(selectedShape.transform.rotate * (180 / Math.PI));
                                  const nextDeg = curDeg + 15;
                                  updateShapeTransform(selectedShape.id, { rotate: (nextDeg * Math.PI) / 180 });
                                }}
                              >
                                +15°
                              </button>
                              <button
                                type="button"
                                className="transform-step-btn"
                                title="Rotate 90°"
                                onClick={() => {
                                  const curDeg = Math.round(selectedShape.transform.rotate * (180 / Math.PI));
                                  const nextDeg = (curDeg + 90) % 360;
                                  updateShapeTransform(selectedShape.id, { rotate: (nextDeg * Math.PI) / 180 });
                                }}
                              >
                                90°
                              </button>
                            </div>
                          </div>

                          <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.35, background: 'rgba(0,0,0,0.03)', padding: '6px 8px', borderRadius: '8px' }}>
                            <strong>Tips:</strong> Scroll wheel to zoom. <strong>Shift</strong> + scroll wheel to rotate. Drag inside shape to pan. Drag corners to adjust vertices.
                          </div>
                        </>
                      )}

                      <button
                        className="btn-outline-pill"
                        style={{ width: '100%', marginTop: '8px', borderColor: '#c45c5c', color: '#c45c5c', fontSize: '0.76rem' }}
                        onClick={() => handleDeleteShape(selectedShape.id)}
                      >
                        Delete Shape
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════ MODAL: BAKED WALLPAPERS ═══════════════ */}
      {openModal === 'modal-baked' && (
        <div className="modal-backdrop">
          <div className="popup-window" style={{ maxWidth: '880px', width: '92%' }}>
            <div className="popup-top-bar">
              <h2>Baked Wallpapers</h2>
              <button className="close-circle-x" onClick={() => setOpenModal(null)}>✕</button>
            </div>
            <div className="path-banner">
              <span>Saved Location: <strong>{bakedWallpapersDir || '%APPDATA%\\Graffiti\\baked_wallpapers\\'}</strong></span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Local Storage</span>
            </div>
            <div className="baked-grid" style={{ maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
              {realBakedWallpapers.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-dark)' }}>No Baked Wallpapers Yet</div>
                  <p style={{ fontSize: '0.84rem', marginTop: '6px', marginBottom: '20px', maxWidth: '420px', margin: '6px auto 20px' }}>
                    Create custom geometric collages, texture overlays and layer masks in Canvas Studio and save them directly here.
                  </p>
                  <button className="btn-dark-pill" onClick={() => setOpenModal('modal-canvas')}>
                    Open Canvas Studio
                  </button>
                </div>
              ) : (
                realBakedWallpapers.map((path, idx) => {
                  const fileName = path.split('\\').pop() || `Wallpaper #${idx + 1}`;
                  let title = fileName.replace(/\.[^/.]+$/, '');
                  let dateLabel = 'Saved Wallpaper';
                  const timestampMatch = fileName.match(/(\d{13})/);
                  if (timestampMatch) {
                    const date = new Date(Number(timestampMatch[1]));
                    if (!isNaN(date.getTime())) {
                      dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                      title = `Collage ${dateLabel}`;
                    }
                  }

                  return (
                    <div key={path} className="baked-card">
                      <div className="baked-preview" style={{ background: '#111311', border: '1px solid var(--border-soft)' }}>
                        <img
                          src={convertFileSrc(path)}
                          alt={fileName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '4px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '6px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{dateLabel}</div>
                        </div>
                        <button
                          className="ghost-icon-btn"
                          onClick={() => handleDeleteBakedWallpaper(path)}
                          title="Delete wallpaper from disk"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#c45c5c',
                            padding: '4px 6px',
                            borderRadius: '6px',
                            fontSize: '0.85rem'
                          }}
                        >
                           Delete
                        </button>
                      </div>
                      <div className="control-row-split" style={{ marginTop: '8px', gap: '8px' }}>
                        <button
                          className="btn-dark-pill"
                          style={{ padding: '8px 12px', fontSize: '0.76rem', flex: 1 }}
                          onClick={() => handleActivateBakedWallpaper(path)}
                        >
                          Activate
                        </button>
                        <button
                          className="btn-outline-pill"
                          style={{ padding: '8px 12px', fontSize: '0.76rem', flex: 1 }}
                          onClick={async () => {
                            try {
                              const store = await load('gallery-project.json');
                              const filename = path.split('\\').pop() || '';

                              // Save older canvas shapes state so user can always restore them!
                              await store.set('canvas_previous_project', project);
                              setHasPreviousCanvas(true);

                              // Check if this baked wallpaper has saved project metadata
                              let bakedProj = await store.get<Project>(`baked_proj_${path}`);
                              if (!bakedProj && filename) {
                                bakedProj = await store.get<Project>(`baked_proj_${filename}`);
                              }

                              let nextProj: Project;
                              if (bakedProj && bakedProj.shapes && bakedProj.shapes.length > 0) {
                                nextProj = {
                                  ...bakedProj,
                                  version: "1.0",
                                };
                              } else {
                                // Strictly keep existing shapes and update background image
                                nextProj = {
                                  ...project,
                                  background: { ...project.background, type: 'image', value: path }
                                };
                              }

                              setProject(nextProj);
                              commitHistory(nextProj);
                              await saveProject(nextProj);
                              await store.save();
                              if (nextProj.shapes.length > 0) {
                                setSelectedShapeId(nextProj.shapes[0].id);
                              }
                              setOpenModal('modal-canvas');
                            } catch (err) {
                              console.error('Failed to open baked wallpaper in canvas:', err);
                            }
                          }}
                        >
                          Open in Canvas
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: WEB WALLPAPER ═══════════════ */}
      {openModal === 'modal-web' && (
        <div className="modal-backdrop">
          <div className="popup-window large" style={{ maxWidth: '1040px' }}>
            <div className="popup-top-bar">
              <h2>Set 3D Web Wallpaper Model</h2>
              <button className="close-circle-x" onClick={() => setOpenModal(null)}>✕</button>
            </div>
            <input type="file" ref={glbFileInputRef} accept=".glb,.gltf" style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.[0]) setWebModelPath(URL.createObjectURL(e.target.files[0])); }} />
            <input type="file" ref={bgImageFileInputRef} accept="image/*" style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.[0]) setWebBgImage(URL.createObjectURL(e.target.files[0])); }} />

            <div className="canvas-workspace-grid" style={{ gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', paddingRight: '4px' }}>
                <button className="pill-select-btn" onClick={handleImportGlb}>
                  <span style={{ fontWeight: 700 }}>{webModelPath ? webModelPath.split(/[\/\\]/).pop() : 'Import .GLB Model…'}</span>
                  <span className="caret">Browse</span>
                </button>

                <div className="sidebar-box">
                  <h4>Background Type</h4>
                  <div className="control-row-split">
                    <button type="button" className={`pill-select-btn ${webBgType === 'color' ? 'active' : ''}`} onClick={() => setWebBgType('color')}>Solid</button>
                    <button type="button" className={`pill-select-btn ${webBgType === 'image' ? 'active' : ''}`} onClick={() => setWebBgType('image')}>Image</button>
                  </div>

                  {webBgType === 'color' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="color" value={webBgColor} onChange={(e) => setWebBgColor(e.target.value)}
                          style={{ width: '42px', height: '36px', border: '1px solid var(--border-soft)', borderRadius: '10px', cursor: 'pointer', background: 'transparent', padding: 0 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-dark)' }}>{webBgColor}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Presets:</span>
                        {['#111311', '#1a1a2e', '#b6beb7', '#f4f6f4', '#dfff4f'].map((preset) => (
                          <button key={preset} type="button" onClick={() => setWebBgColor(preset)}
                            style={{ width: '20px', height: '20px', borderRadius: '50%', background: preset, border: webBgColor === preset ? '2px solid var(--text-dark)' : '1px solid var(--border-soft)', cursor: 'pointer' }}
                            title={preset} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      <button type="button" className="pill-select-btn" onClick={handleImportBgImage}>
                        <span>{webBgImage ? webBgImage.split(/[\/\\]/).pop() : 'Browse Background Image…'}</span>
                        <span className="caret">Browse</span>
                      </button>
                      {webBgImage && (
                        <button type="button" className="btn-outline-pill" style={{ padding: '4px 10px', fontSize: '0.72rem', alignSelf: 'flex-start' }}
                          onClick={() => setWebBgImage(null)}>Clear Image</button>
                      )}
                    </div>
                  )}
                </div>

                <div className="sidebar-box">
                  <h4>Camera & Transform Sliders</h4>
                  <div className="slider-group"><div className="slider-label-row"><span>Zoom</span><span>{webZoom.toFixed(1)}x</span></div>
                    <input type="range" min="0.2" max="3" step="0.1" value={webZoom} onChange={e => setWebZoom(parseFloat(e.target.value))} /></div>
                  <div className="slider-group"><div className="slider-label-row"><span>Horizontal Offset</span><span>{webHOff.toFixed(1)}</span></div>
                    <input type="range" min="-2" max="2" step="0.1" value={webHOff} onChange={e => setWebHOff(parseFloat(e.target.value))} /></div>
                  <div className="slider-group"><div className="slider-label-row"><span>Vertical Offset</span><span>{webVOff.toFixed(1)}</span></div>
                    <input type="range" min="-2" max="2" step="0.1" value={webVOff} onChange={e => setWebVOff(parseFloat(e.target.value))} /></div>
                  <div className="slider-group"><div className="slider-label-row"><span>Cursor Sensitivity</span><span>{webSens.toFixed(2)}x</span></div>
                    <input type="range" min="0.05" max="1" step="0.05" value={webSens} onChange={e => setWebSens(parseFloat(e.target.value))} /></div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px', minHeight: '440px' }}>
                <div style={{ flex: 1, minHeight: '380px', position: 'relative', borderRadius: '22px', overflow: 'hidden' }}>
                  <PreviewCanvas modelPath={webModelPath} bgType={webBgType} bgColor={webBgColor} bgImage={webBgImage}
                    zoomFactor={webZoom} offsetX={webHOff} offsetY={webVOff} rotationFactor={webSens}
                    enableVerticalRotation={true}
                    style={{ width: '100%', height: '100%', minHeight: '380px', borderRadius: '22px' }} />
                </div>
                <button className="btn-dark-pill"
                  style={{ background: 'var(--highlight)', color: 'var(--text-dark)', width: '100%', padding: '14px', fontSize: '0.92rem' }}
                  onClick={handleActivate3D}>Activate 3D Wallpaper</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: THEME ═══════════════ */}
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
                <input type="color" value={highlightColor} onChange={(e) => handleHighlightChange(e.target.value)}
                  style={{ width: '54px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }} />
              </div>
              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Secondary Color</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Default: Soft White (#f4f6f4)</div>
                </div>
                <input type="color" value={secondaryColor} onChange={(e) => handleSecondaryChange(e.target.value)}
                  style={{ width: '54px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }} />
              </div>
              <button className="btn-outline-pill" onClick={handleResetTheme}>Reset to Default Palette</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: ABOUT ═══════════════ */}
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
                  <li><strong>Effects Studio:</strong> Click <em>Choose Effect</em> to pick a shader, import your wallpaper image(s), fine-tune <em>Sliders</em>, and hit <strong>Activate</strong>.</li>
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

      {/* ═══════════════ SETTINGS FULL OVERLAY ═══════════════ */}
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
                <button className={`toggle-pill ${autostartEnabled ? 'on' : ''}`} onClick={handleToggleAutostart}>
                  {autostartEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Idle Timeout (Seconds)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pause engine if mouse hasn't moved (0 to disable)</div>
                </div>
                <input type="number" value={appSettings.idleTimeout}
                  onChange={(e) => handleUpdateSetting('idleTimeout', parseFloat(e.target.value) || 0)}
                  style={{ width: '80px', padding: '8px 12px', borderRadius: '12px', border: '1px solid var(--border-soft)', fontWeight: 700, textAlign: 'center' }} />
              </div>
              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Pause When Hidden</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pause when desktop is covered by a maximized window</div>
                </div>
                <button className={`toggle-pill ${appSettings.pauseHidden ? 'on' : ''}`}
                  onClick={() => handleUpdateSetting('pauseHidden', !appSettings.pauseHidden)}>
                  {appSettings.pauseHidden ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Pause During Fullscreen</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pause during fullscreen games or video playback</div>
                </div>
                <button className={`toggle-pill ${appSettings.pauseFullscreen ? 'on' : ''}`}
                  onClick={() => handleUpdateSetting('pauseFullscreen', !appSettings.pauseFullscreen)}>
                  {appSettings.pauseFullscreen ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Pause on Battery</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pause when unplugged or Battery Saver is active</div>
                </div>
                <button className={`toggle-pill ${appSettings.pauseBattery ? 'on' : ''}`}
                  onClick={() => handleUpdateSetting('pauseBattery', !appSettings.pauseBattery)}>
                  {appSettings.pauseBattery ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <div style={{ fontWeight: 700 }}>Pause During Session Lock</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pause when Windows is locked (Win+L)</div>
                </div>
                <button className={`toggle-pill ${appSettings.pauseSessionLocked ? 'on' : ''}`}
                  onClick={() => handleUpdateSetting('pauseSessionLocked', !appSettings.pauseSessionLocked)}>
                  {appSettings.pauseSessionLocked ? 'ON' : 'OFF'}
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

      {/* ═══════════════ MODAL: WALLPAPER PICKER ═══════════════ */}
      {showWallpaperPicker && pickerTarget && (
        <div className="modal-backdrop" onClick={() => setShowWallpaperPicker(false)}>
          <div className="popup-window" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="popup-top-bar">
              <h2>Select Wallpaper Source</h2>
              <button className="close-circle-x" onClick={() => setShowWallpaperPicker(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Browse local files */}
              <button
                className="pill-select-btn"
                style={{ padding: '16px 20px', fontSize: '0.92rem' }}
                onClick={async () => {
                  setShowWallpaperPicker(false);
                  if (pickerTarget) {
                    await executeDirectImport(pickerTarget.effect, pickerTarget.imageKey);
                  }
                }}
              >
                 <span style={{ fontWeight: 700 }}>Browse local files…</span>
                <span className="caret">Open</span>
              </button>

              {/* Previously imported wallpapers */}
              {pickerWallpapers.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Previously Imported ({pickerWallpapers.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
                    {pickerWallpapers.map((wp, idx) => {
                      let imgSrc: string;
                      try { imgSrc = convertFileSrc(wp); } catch { imgSrc = wp; }
                      return (
                        <div
                          key={idx}
                          style={{ position: 'relative', cursor: 'pointer', borderRadius: '12px', overflow: 'hidden', border: '2px solid transparent', transition: 'border-color 0.2s' }}
                          onClick={() => {
                            if (pickerTarget) {
                              applyImageToEffect(pickerTarget.effect, pickerTarget.imageKey, wp);
                            }
                            setShowWallpaperPicker(false);
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--highlight)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                        >
                          <img src={imgSrc} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} alt="" />
                          <div style={{ fontSize: '0.65rem', padding: '4px 6px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {wp.split('\\').pop()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
