import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';
import { enable as enableAuto, disable as disableAuto, isEnabled as isAutoEnabled } from '@tauri-apps/plugin-autostart';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Settings as SettingsIcon } from 'lucide-react';
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
  isWebWallpaperReady,
  getWebConfig,
  getWebAssetsDir,
  generateDepthMap,
  getStatus,
  getAdapters,
  getBakedWallpapersDir,
  listWallpapers,
  saveBakedWallpaper,
  saveBakedProject,
  loadBakedProject,
  deleteBakedWallpaper,
  fileExists,
} from './ipc';
import { applyWallpaper, setEffect as applyEffectEngine, removeEffect } from './wallpaperManager';
import {
  loadStartupState,
  saveSettings,
  applySettingsToBackend,
  AppSettings,
  defaultSettings,
  resetToDefaults,
  saveActiveSession,
  saveEffectSettings,
  saveQualitySetting,
  saveResolutionMode,
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
  overlayOpacity?: number;
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

const normalizeProject = (stored: Project): Project => ({
  ...stored,
  version: stored.version || '1.0',
  background: {
    type: stored.background?.type === 'image' ? 'image' : 'color',
    value: stored.background?.value || '#242825',
    fit: stored.background?.fit || 'cover',
  },
  shapes: (stored.shapes || []).map((shape, index) => ({
    ...shape,
    id: shape.id || `shape-${Date.now()}-${index}`,
    name: shape.name || `Shape ${index + 1}`,
    vertices: shape.vertices?.length >= 3 ? shape.vertices : [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]],
    imagePath: shape.imagePath || null,
    color: shape.color || '#efff1b',
    overlayOpacity: typeof shape.overlayOpacity === 'number' ? shape.overlayOpacity : 0.18,
    transform: {
      panX: Number(shape.transform?.panX ?? 0),
      panY: Number(shape.transform?.panY ?? 0),
      zoom: Number(shape.transform?.zoom ?? 1),
      rotate: Number(shape.transform?.rotate ?? 0),
    },
  })),
});

const getPathFileName = (path: string): string => path.split(/[\\/]/).pop() || path;

const hexToRgb = (hex: string): [number, number, number] | null => {
  const value = hex.trim().replace('#', '');
  const expanded = value.length === 3 ? value.split('').map((part) => part + part).join('') : value;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return [
    parseInt(expanded.slice(0, 2), 16),
    parseInt(expanded.slice(2, 4), 16),
    parseInt(expanded.slice(4, 6), 16),
  ];
};

const getReadableTextColor = (background: string): string => {
  const rgb = hexToRgb(background);
  if (!rgb) return '#151815';
  const luminance = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (foreground: number) => {
    const lighter = Math.max(luminance, foreground);
    const darker = Math.min(luminance, foreground);
    return (lighter + 0.05) / (darker + 0.05);
  };
  return contrast(0.0) >= contrast(1.0) ? '#151815' : '#f5f4ed';
};

const resolveShapeColor = (shape: Shape, accentColor: string): string => {
  const storedColor = shape.color?.trim();
  if (!storedColor) return accentColor;
  const normalized = storedColor.toLowerCase();
  return normalized === '#efff1b' || normalized === '#dfff4f' ? accentColor : storedColor;
};

const createBakedImageProject = (path: string, aspectRatio: Project['aspectRatio'] = 'auto'): Project => ({
  ...DEFAULT_PROJECT,
  aspectRatio: aspectRatio || 'auto',
  background: { ...DEFAULT_PROJECT.background },
  shapes: [{
    id: `baked-image-${Date.now()}`,
    name: getPathFileName(path).replace(/\.[^/.]+$/, '') || 'Baked image',
    vertices: [[0.04, 0.04], [0.96, 0.04], [0.96, 0.96], [0.04, 0.96]],
    imagePath: path,
    transform: { panX: 0, panY: 0, zoom: 1, rotate: 0 },
    color: '#efff1b',
    overlayOpacity: 0,
  }],
});

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
  const resolutionModes = ['native', '75', 'half', 'auto'];
  const resScales = [1.0, 0.75, 0.5, 1.0];
  const fpsOptions = ['60', 'Max', '30'];
  const fpsValues = [60, 0, 30];
  const [resIdx, setResIdx] = useState(0);
  const [fpsIdx, setFpsIdx] = useState(0);
  const [liveFps, setLiveFps] = useState(0);

  // ─── Effect Selection ───────────────────────
  const [selectedEffect, setSelectedEffect] = useState<string>('Cursor Reveal');
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [isActivatingEffect, setIsActivatingEffect] = useState(false);

  // ─── Per-Effect Images ──────────────────────
  const [effectImages, setEffectImages] = useState<Record<string, Record<string, string | null>>>({
    'Cursor Reveal': { layerA: null, layerB: null },
    'Gravity Lens': { baseImage: null },
    'Glass Lens': { baseImage: null },
    'Space Ball': { baseImage: null },
    'Brick Outline': { baseImage: null },
    'Depth Parallax': { testWallpaper: null, depthMap: null },
  });

  // ─── Per-Effect Slider Parameters ───────────
  const [effectParams, setEffectParams] = useState<Record<string, Record<string, number>>>({});

  // ─── Effect-Specific States ─────────────────
  const [boOutlineColor, setBOOutlineColor] = useState('#ffffff');
  const [crFadeWhenResting, setCRFadeWhenResting] = useState(true);
  const [isGeneratingDepth, setIsGeneratingDepth] = useState(false);
  const [depthError, setDepthError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const initGenerationRef = useRef(0);
  const desktopOperationRef = useRef(0);

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
  const [isActivatingWeb, setIsActivatingWeb] = useState(false);

  // ─── App Settings ───────────────────────────
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartError, setAutostartError] = useState<string | null>(null);
  const [gpuAdapters, setGpuAdapters] = useState<string[]>([]);

  // ─── Theme ──────────────────────────────────
  const [highlightColor, setHighlightColor] = useState('#dfff4f');
  const [secondaryColor, setSecondaryColor] = useState('#f4f6f4');

  useEffect(() => {
    const root = document.documentElement;
    const highlightInk = getReadableTextColor(highlightColor);
    const secondaryInk = getReadableTextColor(secondaryColor);
    // Keep muted copy in the same readable ink family as primary copy. A
    // blended pastel looked attractive on the default palette but became
    // unreadable when a user chose a saturated/dark theme surface.
    const secondaryMuted = secondaryInk;
    root.style.setProperty('--highlight-ink', highlightInk);
    root.style.setProperty('--highlight-muted', highlightInk);
    root.style.setProperty('--secondary-ink', secondaryInk);
    root.style.setProperty('--secondary-muted', secondaryMuted);
    root.style.setProperty('--ink', secondaryInk);
    root.style.setProperty('--muted', secondaryMuted);
  }, [highlightColor, secondaryColor]);

  // ─── Gallery / Canvas Studio ───────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [project, setProject] = useState<Project>(DEFAULT_PROJECT);
  const projectRef = useRef<Project>(DEFAULT_PROJECT);
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
      projectRef.current = prev;
      saveProject(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex.current < history.current.length - 1) {
      historyIndex.current++;
      const next = history.current[historyIndex.current];
      setProject(next);
      projectRef.current = next;
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

  useEffect(() => {
    if (!sidePopupOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        !target.closest('.effects-side-popup') &&
        !target.closest('#btn-choose-effect') &&
        !target.closest('#btn-open-sliders')
      ) {
        setSidePopupOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [sidePopupOpen]);

  // ─── Refs ───────────────────────────────────
  const glbFileInputRef = useRef<HTMLInputElement | null>(null);
  const bgImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimer = useRef<number | null>(null);
  const depthGenerationPromisesRef = useRef<Record<string, Promise<string>>>({});

  const getDepthMapPath = (imagePath: string): string =>
    imagePath.replace(/\.[^/.]+$/, '') + '_depth.png';

  const joinWindowsPath = (directory: string, fileName: string): string =>
    `${directory.replace(/[\\/]+$/, '')}\\${fileName}`;

  const waitForWebWallpaperReady = async (timeoutMs = 30000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await isWebWallpaperReady()) return;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
    }
    throw new Error(`The Web wallpaper did not finish attaching within ${timeoutMs / 1000} seconds.`);
  };

  const retryStartupCommand = async <T,>(label: string, operation: () => Promise<T>, attempts = 5): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        if (attempt < attempts) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 250 * attempt));
        }
      }
    }
    throw new Error(`${label} failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  };

  const ensureDepthMap = async (imagePath: string, knownDepthPath?: string | null): Promise<string> => {
    const candidates = [knownDepthPath, getDepthMapPath(imagePath)].filter(
      (candidate, index, all): candidate is string => Boolean(candidate) && all.indexOf(candidate) === index,
    );

    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        setEffectImages((prev) => ({
          ...prev,
          'Depth Parallax': { ...prev['Depth Parallax'], testWallpaper: imagePath, depthMap: candidate },
        }));
        return candidate;
      }
    }

    const existingGeneration = depthGenerationPromisesRef.current[imagePath];
    if (existingGeneration) return existingGeneration;

    const generation = (async () => {
      setIsGeneratingDepth(true);
      setDepthError(null);
      try {
        const generatedPath = await generateDepthMap(imagePath);
        if (!generatedPath || !(await fileExists(generatedPath))) {
          throw new Error('The depth generator returned no usable depth-map file.');
        }
        setEffectImages((prev) => ({
          ...prev,
          'Depth Parallax': { ...prev['Depth Parallax'], testWallpaper: imagePath, depthMap: generatedPath },
        }));
        return generatedPath;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setDepthError(message);
        setEffectImages((prev) => ({
          ...prev,
          'Depth Parallax': { ...prev['Depth Parallax'], testWallpaper: imagePath, depthMap: null },
        }));
        throw new Error(message);
      } finally {
        setIsGeneratingDepth(false);
      }
    })();

    depthGenerationPromisesRef.current[imagePath] = generation;
    try {
      return await generation;
    } finally {
      if (depthGenerationPromisesRef.current[imagePath] === generation) {
        delete depthGenerationPromisesRef.current[imagePath];
      }
    }
  };

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

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
    const generation = ++initGenerationRef.current;
    let cancelled = false;
    const isCurrent = () => !cancelled && initGenerationRef.current === generation;
    const initialDesktopOperation = desktopOperationRef.current;
    const canRestoreDesktop = () => isCurrent() && desktopOperationRef.current === initialDesktopOperation;
    const splashTimer = setTimeout(() => setShowSplash(false), 1100);

    // Restore theme
    const savedHL = localStorage.getItem('graffiti_theme_highlight');
    const savedSec = localStorage.getItem('graffiti_theme_secondary');
    if (savedHL) { setHighlightColor(savedHL); document.documentElement.style.setProperty('--highlight', savedHL); }
    if (savedSec) { setSecondaryColor(savedSec); document.documentElement.style.setProperty('--secondary', savedSec); }

    void (async () => {
      try {
        const enabled = await isAutoEnabled();
        if (isCurrent()) setAutostartEnabled(enabled);
      } catch (err) {
        console.warn('Unable to read Windows startup registration:', err);
        if (isCurrent()) setAutostartError('Windows startup registration is unavailable.');
      }
    })();

    getBakedWallpapersDir().then((dir) => { if (isCurrent()) setBakedWallpapersDir(dir); }).catch(() => {});

    // Load real baked wallpapers from %APPDATA%\Graffiti\baked_wallpapers
    listWallpapers().then(wps => {
      if (!isCurrent()) return;
      setRealBakedWallpapers(wps);
      if (wps.length > 0) {
        const lastSlash = Math.max(wps[0].lastIndexOf('\\'), wps[0].lastIndexOf('/'));
        if (lastSlash >= 0) setBakedWallpapersDir(wps[0].substring(0, lastSlash + 1));
      }
    }).catch(console.error);

    // Load per-effect settings from store
    const loadAllEffectSettings = async () => {
      try {
        const startup = await loadStartupState();
        const { quality, effects, settings } = startup;
        if (!isCurrent()) return;
        setAppSettings(settings);
        if (quality.fpsCap !== null) {
          const fIdx = fpsValues.indexOf(quality.fpsCap);
          if (fIdx >= 0) setFpsIdx(fIdx);
        }
        if (quality.resolutionMode) {
          const rIdx = resolutionModes.indexOf(quality.resolutionMode);
          if (rIdx >= 0) setResIdx(rIdx);
        } else if (quality.resolutionScale !== null) {
          const rIdx = resScales.indexOf(quality.resolutionScale);
          if (rIdx >= 0) setResIdx(rIdx);
        }

        // Populate initial params from defaults
        const initialParams: Record<string, Record<string, number>> = {};
        Object.entries(EFFECTS_DATA).forEach(([effName, paramsList]) => {
          initialParams[effName] = {};
          paramsList.forEach(p => { initialParams[effName][p.key] = p.val; });
        });

        // Load saved per-effect settings and images
        const newImages: Record<string, Record<string, string | null>> = Object.fromEntries(
          Object.entries(effectImages).map(([effect, images]) => [effect, { ...images }]),
        );

        // Cursor Reveal
        const crSettings = effects.cursor_reveal;
        initialParams['Cursor Reveal'].fadeWhenResting = crSettings?.fadeWhenResting != null
          ? (crSettings.fadeWhenResting > 0.5 ? 1 : 0)
          : 1;
        if (crSettings) {
          if (crSettings.layerA) newImages['Cursor Reveal'].layerA = crSettings.layerA;
          if (crSettings.layerB) newImages['Cursor Reveal'].layerB = crSettings.layerB;
          if (crSettings.brushSize != null) initialParams['Cursor Reveal'].brushSize = crSettings.brushSize;
          if (crSettings.brushHardness != null) initialParams['Cursor Reveal'].brushHardness = crSettings.brushHardness;
          if (crSettings.trailLength != null) initialParams['Cursor Reveal'].trailLength = crSettings.trailLength;
          if (crSettings.fadeSpeed != null) initialParams['Cursor Reveal'].fadeSpeed = crSettings.fadeSpeed;
          if (crSettings.fadeWhenResting != null) {
            initialParams['Cursor Reveal'].fadeWhenResting = crSettings.fadeWhenResting > 0.5 ? 1 : 0;
            if (isCurrent()) setCRFadeWhenResting(crSettings.fadeWhenResting > 0.5);
          }
        }

        // Gravity Lens
        const glSettings = effects.gravity_lens;
        if (glSettings) {
          if (glSettings.baseImage) newImages['Gravity Lens'].baseImage = glSettings.baseImage;
          ['lensStrength', 'lensRadius', 'stiffness', 'damping', 'dispersion', 'coreDarkening', 'trailLength', 'fadeDecay'].forEach(k => {
            if (glSettings[k] != null) initialParams['Gravity Lens'][k] = glSettings[k];
          });
        }

        // Glass Lens
        const gltSettings = effects.gravity_lens_transparent;
        if (gltSettings) {
          if (gltSettings.baseImage) newImages['Glass Lens'].baseImage = gltSettings.baseImage;
          ['pressDepth', 'pressRadius', 'stiffness', 'damping', 'dispersion', 'coreDarkening', 'shadingStrength', 'trailLength', 'fadeDecay'].forEach(k => {
            if (gltSettings[k] != null) initialParams['Glass Lens'][k] = gltSettings[k];
          });
        }

        // Space Ball
        const sp2Settings = effects.stone_press_v2;
        if (sp2Settings) {
          if (sp2Settings.baseImage) newImages['Space Ball'].baseImage = sp2Settings.baseImage;
          ['pressDepth', 'pressRadius', 'stiffness', 'damping', 'depthDarkening', 'directionalShading', 'parallaxStrength'].forEach(k => {
            if (sp2Settings[k] != null) initialParams['Space Ball'][k] = sp2Settings[k];
          });
        }

        // Brick Outline
        const boSettings = effects.brick_outline;
        const savedOutlineColor = boSettings?.outlineColor || '#ffffff';
        const defaultOutline = hexToRgb(savedOutlineColor) || [255, 255, 255];
        initialParams['Brick Outline'].outlineColorR = defaultOutline[0] / 255;
        initialParams['Brick Outline'].outlineColorG = defaultOutline[1] / 255;
        initialParams['Brick Outline'].outlineColorB = defaultOutline[2] / 255;
        if (boSettings) {
          if (boSettings.baseImage) newImages['Brick Outline'].baseImage = boSettings.baseImage;
          ['brickWidth', 'brickHeight', 'lineThickness', 'effectRadius', 'edgeSoftness', 'glowIntensity'].forEach(k => {
            if (boSettings[k] != null) initialParams['Brick Outline'][k] = boSettings[k];
          });
          if (boSettings.outlineColor && isCurrent()) setBOOutlineColor(boSettings.outlineColor);
          if (boSettings.outlineColor) {
            const outline = hexToRgb(boSettings.outlineColor);
            if (outline) {
              initialParams['Brick Outline'].outlineColorR = outline[0] / 255;
              initialParams['Brick Outline'].outlineColorG = outline[1] / 255;
              initialParams['Brick Outline'].outlineColorB = outline[2] / 255;
            }
          }
        }

        // Depth Parallax
        const dpSettings = effects.depth_parallax;
        if (dpSettings) {
          if (dpSettings.testWallpaper) newImages['Depth Parallax'].testWallpaper = dpSettings.testWallpaper;
          if (dpSettings.depthMap) newImages['Depth Parallax'].depthMap = dpSettings.depthMap;
          if (dpSettings.parallaxStrength != null) initialParams['Depth Parallax'].parallaxStrength = dpSettings.parallaxStrength;
        }

        if (!isCurrent()) return;
        setEffectImages(newImages);
        setEffectParams(initialParams);

        // Restore selected effect
        const lastSelected = startup.selectedEffect;
        if (!isCurrent()) return;
        if (lastSelected && ENGINE_ID_TO_DISPLAY[lastSelected]) {
          setSelectedEffect(ENGINE_ID_TO_DISPLAY[lastSelected]);
        }

        // The UI is ready now, even on a cold renderer launch. Restore the
        // desktop afterwards, and let a user action supersede this restore.
        setSettingsLoaded(true);
        if (!canRestoreDesktop()) return;
        try {
          await retryStartupCommand('Startup settings', () => applySettingsToBackend(settings, false));
          if (!canRestoreDesktop()) return;
          if (quality.fpsCap !== null) await setFpsCap(quality.fpsCap);
          if (!canRestoreDesktop()) return;
          if (quality.resolutionMode === 'auto') {
            await setQualityAuto();
          } else {
            const rIdx = quality.resolutionMode ? resolutionModes.indexOf(quality.resolutionMode) : -1;
            const scale = rIdx >= 0 ? resScales[rIdx] : quality.resolutionScale;
            if (scale !== null) await setResolutionScale(scale);
          }
        } catch (err) {
          console.warn('Failed to restore renderer configuration:', err);
        }
        if (!canRestoreDesktop()) return;
        void getAdapters().then(adapters => {
          if (isCurrent()) setGpuAdapters(adapters);
        }).catch(() => {});

        // Restore the actual desktop session, not only the UI badge. This is
        // especially important for Windows autostart, where the app starts
        // hidden and must re-attach the native renderer or Web wallpaper.
        const session = startup.session;
        if (!canRestoreDesktop()) return;
        if (session) {
          try {
            if (session.effect === 'web-wallpaper') {
              const config = await getWebConfig();
              const assetsDir = await getWebAssetsDir();
              const modelName = typeof config?.model === 'string' ? config.model : '';
              if (!modelName) throw new Error('Saved Web wallpaper model is missing.');

              const modelPath = joinWindowsPath(assetsDir, modelName);
              if (!(await fileExists(modelPath))) {
                throw new Error(`Saved Web wallpaper model is missing: ${modelPath}`);
              }

              const backgroundName = typeof config?.backgroundImage === 'string' ? config.backgroundImage : '';
              const backgroundPath = backgroundName ? joinWindowsPath(assetsDir, backgroundName) : undefined;
              if (config?.backgroundType === 'image' && backgroundPath && !(await fileExists(backgroundPath))) {
                throw new Error(`Saved Web wallpaper background is missing: ${backgroundPath}`);
              }
              if (!canRestoreDesktop()) return;
              await startWebWallpaper(
                modelPath,
                config?.backgroundType === 'image' ? 'image' : 'color',
                typeof config?.backgroundColor === 'string' ? config.backgroundColor : '#000000',
                backgroundPath,
                Number(config?.rotationFactor ?? 0.2),
                Number(config?.zoomFactor ?? 1.0),
                Number(config?.offsetX ?? 0.0),
                Number(config?.offsetY ?? 0.0),
                Boolean(config?.enableVerticalRotation ?? true),
                Number(config?.initialRotationX ?? 0.0),
                Number(config?.initialRotationY ?? 0.0),
              );
              await waitForWebWallpaperReady();
              if (!canRestoreDesktop()) return;
              setWebModelPath(modelPath);
              setWebBgType(config?.backgroundType === 'image' ? 'image' : 'color');
              setWebBgColor(typeof config?.backgroundColor === 'string' ? config.backgroundColor : '#000000');
              setWebBgImage(backgroundPath || null);
              setWebSens(Number(config?.rotationFactor ?? 0.2));
              setWebZoom(Number(config?.zoomFactor ?? 1.0));
              setWebHOff(Number(config?.offsetX ?? 0.0));
              setWebVOff(Number(config?.offsetY ?? 0.0));
              setWebStatus('Running on Desktop');
            } else if (session.isGalleryCollage || session.effect === 'none') {
              await removeEffect();
              if (!canRestoreDesktop()) return;
              if (session.layerA && await fileExists(session.layerA)) {
                await applyWallpaper(session.layerA, '');
              }
              setActiveEffect(null);
            } else {
              const displayEffect = session.effect ? ENGINE_ID_TO_DISPLAY[session.effect] : undefined;
              if (!displayEffect) throw new Error(`Unknown saved effect: ${session.effect}`);

              let layerA = session.layerA || '';
              let layerB = session.layerB || '';
              const savedImages = newImages[displayEffect] || {};

              if (displayEffect === 'Cursor Reveal') {
                layerA = layerA || savedImages.layerA || '';
                layerB = layerB || savedImages.layerB || '';
              } else if (displayEffect === 'Depth Parallax') {
                layerA = layerA || savedImages.testWallpaper || '';
                if (layerA) {
                  layerB = await ensureDepthMap(layerA, layerB || savedImages.depthMap);
                  newImages['Depth Parallax'] = { ...savedImages, testWallpaper: layerA, depthMap: layerB };
                  await saveEffectSettings('depth_parallax', { testWallpaper: layerA, depthMap: layerB });
                }
              } else {
                layerA = layerA || savedImages.baseImage || '';
              }

              if (!layerA || !(await fileExists(layerA))) {
                throw new Error(`Saved wallpaper is missing for ${displayEffect}.`);
              }
              if (layerB && !(await fileExists(layerB))) {
                throw new Error(`Saved secondary wallpaper is missing for ${displayEffect}.`);
              }

              if (!canRestoreDesktop()) return;
              await applyEffectEngine(session.effect);
              if (!canRestoreDesktop()) return;
              await applyWallpaper(layerA, layerB);
              const params = initialParams[displayEffect] || {};
              for (const [key, value] of Object.entries(params)) {
                if (!canRestoreDesktop()) return;
                await setSetting(key, value);
              }
              if (canRestoreDesktop()) {
                setActiveEffect(displayEffect);
                await saveActiveSession({ effect: session.effect, layerA, layerB });
              }
            }
          } catch (restoreError) {
            console.warn('Saved desktop session could not be restored:', restoreError);
          }
        }

        if (!isCurrent()) return;
        setSettingsLoaded(true);
      } catch (err) {
        if (!isCurrent()) return;
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

    return () => {
      cancelled = true;
      clearTimeout(splashTimer);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 2. LIVE FPS + STATUS POLLING (every 1s)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const fetchStatus = async () => {
      const desktopOperation = desktopOperationRef.current;
      try {
        if (document.hidden) return;
        const status = await getStatus();
        if (!cancelled && desktopOperationRef.current === desktopOperation && status) {
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
      } catch (_) { /* status polling failure is non-fatal */ } finally {
        if (!cancelled) timer = window.setTimeout(fetchStatus, 1000);
      }
    };
    fetchStatus();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  // Load gallery project on mount
  useEffect(() => {
    const loadStoredProject = async () => {
      try {
        const store = await load('gallery-project.json');
        const proj = await store.get<Project>('project');
        if (proj && proj.shapes) {
          const normalizedProj = normalizeProject(proj);
          setProject(normalizedProj);
          projectRef.current = normalizedProj;
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
    const accentColor = highlightColor;
    const lightColor = secondaryColor;
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
            const shapeColor = resolveShapeColor(shape, accentColor);
            const overlayOpacity = Math.max(0, Math.min(1, shape.overlayOpacity ?? 0));
            if (overlayOpacity > 0 && shapeColor) {
              ctx.globalAlpha = overlayOpacity;
              ctx.fillStyle = shapeColor;
              ctx.fillRect(-cw, -ch, cw * 2, ch * 2);
              ctx.globalAlpha = 1;
            }
          } else {
           ctx.fillStyle = resolveShapeColor(shape, accentColor) || (shape.id === effectiveSelectedShapeId ? accentColor : lightColor);
           ctx.fill();
         }
       } else {
         ctx.fillStyle = resolveShapeColor(shape, accentColor) || (shape.id === effectiveSelectedShapeId ? accentColor : lightColor);
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
       ctx.strokeStyle = shape.id === effectiveSelectedShapeId ? lightColor : resolveShapeColor(shape, accentColor);
      ctx.stroke();

      // Vertex handles on selected shape in IDLE mode
      if (shape.id === effectiveSelectedShapeId && editorState === 'IDLE') {
        shape.vertices.forEach(v => {
          const [vx, vy] = toPx(v[0], v[1]);
          ctx.beginPath();
          ctx.arc(vx, vy, 6, 0, Math.PI * 2);
           ctx.fillStyle = lightColor;
           ctx.fill();
           ctx.strokeStyle = 'rgba(0, 0, 0, 0.82)';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }

    });

    // 3. Draw Snapping Indicators
    if (previewCursor && (previewCursor.snapX || previewCursor.snapY) && (editorState === 'DRAWING' || dragRef.current?.active)) {
      ctx.save();
       ctx.strokeStyle = accentColor;
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

       ctx.fillStyle = accentColor;
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
       ctx.strokeStyle = accentColor;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < drawingShape.length; i++) {
        const pt = toPx(drawingShape[i][0], drawingShape[i][1]);
         ctx.fillStyle = i === 0 ? lightColor : accentColor;
        ctx.fillRect(pt[0] - 5, pt[1] - 5, 10, 10);
         ctx.strokeStyle = 'rgba(0, 0, 0, 0.82)';
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
   }, [openModal, project, drawingShape, editorState, selectedShapeId, previewCursor, canvasTick, canvasResizeCount, highlightColor, secondaryColor]);

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
    await saveResolutionMode(resolutionModes[nextIdx]);
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
        await applyImageToEffect(effect, imageKey, imported);
      }
    } catch (err) {
      console.error('Failed to import image:', err);
    }
  };

  const applyImageToEffect = async (effect: string, imageKey: string, path: string) => {
    const engineId = EFFECT_TO_ENGINE_ID[effect];

    if (effect === 'Depth Parallax' && imageKey === 'testWallpaper') {
      setEffectImages(prev => ({
        ...prev,
        [effect]: { ...prev[effect], testWallpaper: path, depthMap: null },
      }));
      try {
        const depthMap = await ensureDepthMap(path);
        if (engineId) {
          await saveEffectSettings(engineId, { testWallpaper: path, depthMap });
        }
      } catch (err) {
        console.error('Depth generation failed:', err);
      }
      return;
    }

    setEffectImages(prev => ({
      ...prev,
      [effect]: { ...prev[effect], [imageKey]: path },
    }));

    if (engineId) {
      await saveEffectSettings(engineId, { [imageKey]: path });
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

    // Only push live values to the renderer when this is the effect currently
    // running. A selected-but-inactive effect must not mutate another plugin's
    // global setting before the user activates it.
    if (activeEffect === selectedEffect) {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
      debounceTimer.current = window.setTimeout(() => {
        void setSetting(paramKey, value).catch((err) => {
          console.warn(`Failed to update ${selectedEffect} parameter ${paramKey}:`, err);
        });
      }, 50);
    }

    const engineId = EFFECT_TO_ENGINE_ID[selectedEffect];
    if (engineId) {
      // Persist only the changed key here. The store serializes these writes,
      // so rapid slider events cannot overwrite one another with stale state.
      void saveEffectSettings(engineId, { [paramKey]: value }).catch((err) => {
        console.warn(`Failed to persist ${selectedEffect} parameter ${paramKey}:`, err);
      });
    }
  };

  const handleOutlineColorChange = (hex: string) => {
    setBOOutlineColor(hex);
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    if (activeEffect === 'Brick Outline') {
      debounceTimer.current = window.setTimeout(() => {
        void Promise.all([
          setSetting('outlineColorR', parseInt(hex.slice(1, 3), 16) / 255.0),
          setSetting('outlineColorG', parseInt(hex.slice(3, 5), 16) / 255.0),
          setSetting('outlineColorB', parseInt(hex.slice(5, 7), 16) / 255.0),
        ]).catch((err) => console.warn('Failed to update Brick Outline color:', err));
      }, 50);
    }
    void saveEffectSettings('brick_outline', { outlineColor: hex }).catch((err) => {
      console.warn('Failed to persist Brick Outline color:', err);
    });
  };

  const handleFadeWhenRestingChange = (checked: boolean) => {
    setCRFadeWhenResting(checked);
    if (activeEffect === 'Cursor Reveal') {
      void setSetting('fadeWhenResting', checked ? 1 : 0).catch((err) => {
        console.warn('Failed to update Cursor Reveal resting behavior:', err);
      });
    }
    void saveEffectSettings('cursor_reveal', { fadeWhenResting: checked ? 1 : 0 }).catch((err) => {
      console.warn('Failed to persist Cursor Reveal resting behavior:', err);
    });
  };

  const handleSelectEffect = (effect: string) => {
    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    setSelectedEffect(effect);
  };

  // ═══════════════════════════════════════════════════════════════
  // 7. ACTIVATE EFFECT (per-effect logic)
  // ═══════════════════════════════════════════════════════════════
  const handleActivateEffect = async () => {
    if (isActivatingEffect || !settingsLoaded) return;
    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    const engineId = EFFECT_TO_ENGINE_ID[selectedEffect];
    if (!engineId) return;

    const images = effectImages[selectedEffect] || {};

    desktopOperationRef.current++;
    setIsActivatingEffect(true);
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
      } else if (selectedEffect === 'Depth Parallax') {
        if (!images.testWallpaper) {
          alert('Please import a wallpaper image first.');
          return;
        }
        if (!(await fileExists(images.testWallpaper))) {
          alert('Wallpaper file is missing or was deleted. Please import it again.');
          return;
        }
        const depthImage = await ensureDepthMap(images.testWallpaper, images.depthMap);
        images.depthMap = depthImage;
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
      }

      // Select the plugin before applying textures so the renderer always
      // receives the new wallpaper through the correct effect.
      await applyEffectEngine(engineId);

      if (selectedEffect === 'Cursor Reveal') {
        await applyWallpaper(images.layerA!, images.layerB!);
      } else if (selectedEffect === 'Depth Parallax') {
        await applyWallpaper(images.testWallpaper!, images.depthMap!);
      } else {
        await applyWallpaper(images.baseImage!, '');
      }

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
                     selectedEffect === 'Depth Parallax' ? images.depthMap || '' :
                     '';
      await saveActiveSession({ effect: engineId, layerA, layerB });

      // Save complete effect settings
      await saveEffectSettings(engineId, { ...params, ...images });

      // Save wallpaper pairing
      await saveWallpaperPairing(layerA, engineId, params);

    } catch (err) {
      console.error('Failed to activate effect:', err);
      alert('Failed to activate effect: ' + err);
    } finally {
      setIsActivatingEffect(false);
    }
  };

  const handleStopEffect = async () => {
    desktopOperationRef.current++;
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
    if (isActivatingWeb) return;

    desktopOperationRef.current++;
    setIsActivatingWeb(true);
    setWebStatus('Preparing desktop surface…');
    try {
      await startWebWallpaper(webModelPath, webBgType, webBgColor, webBgImage || undefined, webSens, webZoom, webHOff, webVOff, true, 0, 0);

      setWebStatus('Waiting for Web wallpaper to attach…');
      await waitForWebWallpaperReady();

      setWebStatus('Running on Desktop');
      await saveActiveSession({ effect: 'web-wallpaper', layerA: '', layerB: '' });
      setOpenModal(null);
    } catch (err) {
      console.error('Failed to start 3D wallpaper:', err);
      setWebStatus('Activation failed');
      alert('Failed to start 3D wallpaper: ' + (err instanceof Error ? err.message : err));
    } finally {
      setIsActivatingWeb(false);
    }
  };

  const handleStop3D = async () => {
    desktopOperationRef.current++;
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
      setAutostartError(null);
      if (autostartEnabled) await disableAuto();
      else await enableAuto();
      setAutostartEnabled(await isAutoEnabled());
    } catch (err) {
      console.error('Failed to toggle autostart:', err);
      setAutostartError('Could not update Windows startup registration.');
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
    e.currentTarget.setPointerCapture?.(e.pointerId);
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

    // 3. Image layers use direct mouse gestures by default. Hold Alt/Ctrl to
    // move the polygon mask instead of the image inside it.
    if (clickedShapeId) {
      const clickedShape = project.shapes.find(s => s.id === clickedShapeId);
      if (clickedShape) {
        if (clickedShape.imagePath && !e.altKey && !e.ctrlKey) {
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
      projectRef.current = {
        ...projectRef.current,
        shapes: projectRef.current.shapes.map(s => {
          if (s.id !== dragRef.current!.shapeId) return s;
          const newVertices = [...s.vertices];
          newVertices[dragRef.current!.vertexIdx!] = [snappedNx, snappedNy];
          return { ...s, vertices: newVertices };
        }),
      };
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
      projectRef.current = {
        ...projectRef.current,
        shapes: projectRef.current.shapes.map(s => s.id === dragRef.current!.shapeId
          ? { ...s, transform: { ...s.transform, panX: dragRef.current!.initialPanX! + dx, panY: dragRef.current!.initialPanY! + dy } }
          : s),
      };
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
      projectRef.current = {
        ...projectRef.current,
        shapes: projectRef.current.shapes.map(s => {
          if (s.id !== dragRef.current!.shapeId) return s;
          const moved = dragRef.current!.initialVertices!.map(([vx, vy]) => [
            Math.max(0, Math.min(1, vx + dx)),
            Math.max(0, Math.min(1, vy + dy))
          ] as [number, number]);
          return { ...s, vertices: moved };
        }),
      };
      return;
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.active) {
      dragRef.current.active = false;
      commitHistory(projectRef.current);
      saveProject(projectRef.current);
    }
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleCanvasPointerLeave = () => {
    if (dragRef.current?.active) {
      dragRef.current.active = false;
      commitHistory(projectRef.current);
      saveProject(projectRef.current);
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
      name: `Shape ${projectRef.current.shapes.length + 1}`,
      vertices: drawingShape,
      imagePath: null,
      transform: { panX: 0, panY: 0, zoom: 1, rotate: 0 },
      color: highlightColor,
      overlayOpacity: 0.18,
    };
    const nextProj: Project = {
      ...projectRef.current,
      shapes: [...projectRef.current.shapes, newShape]
    };
    setProject(nextProj);
    projectRef.current = nextProj;
    commitHistory(nextProj);
    saveProject(nextProj);
    setSelectedShapeId(newShape.id);
    setDrawingShape([]);
    setEditorState('IDLE');
  };

  const importShapeImage = async (): Promise<string | null> => {
    try {
      const selected = await open({
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
        multiple: false,
      });
      if (typeof selected === 'string') {
        return await importWallpaper(selected);
      }
    } catch (err) {
      console.error('Failed to import shape image:', err);
    }
    return null;
  };

  const handleAssignShapeImage = async (shapeId: string) => {
    const imported = await importShapeImage();
    if (!imported) return;
    const nextProj: Project = {
      ...projectRef.current,
      shapes: projectRef.current.shapes.map(s =>
        s.id === shapeId ? { ...s, imagePath: imported, overlayOpacity: s.overlayOpacity ?? 0.18 } : s
      )
    };
    setProject(nextProj);
    projectRef.current = nextProj;
    commitHistory(nextProj);
    saveProject(nextProj);
  };

  const handleAddImageShape = async () => {
    const imported = await importShapeImage();
    if (!imported) return;
    const count = projectRef.current.shapes.length;
    const inset = Math.min(0.08 + count * 0.025, 0.24);
    const newShape: Shape = {
      id: `shape-${Date.now()}`,
      name: `Image ${count + 1}`,
      vertices: [[inset, inset], [1 - inset, inset], [1 - inset, 1 - inset], [inset, 1 - inset]],
      imagePath: imported,
      transform: { panX: 0, panY: 0, zoom: 1, rotate: 0 },
      color: highlightColor,
      overlayOpacity: 0,
    };
    const nextProj: Project = { ...projectRef.current, shapes: [...projectRef.current.shapes, newShape] };
    setProject(nextProj);
    projectRef.current = nextProj;
    commitHistory(nextProj);
    await saveProject(nextProj);
    setSelectedShapeId(newShape.id);
  };

  const handleClearShapeImage = (shapeId: string) => {
    const nextProj: Project = {
      ...projectRef.current,
      shapes: projectRef.current.shapes.map(s =>
        s.id === shapeId ? { ...s, imagePath: null } : s
      )
    };
    setProject(nextProj);
    projectRef.current = nextProj;
    commitHistory(nextProj);
    saveProject(nextProj);
  };

  const handleDeleteShape = (shapeId: string) => {
    const nextProj: Project = {
      ...projectRef.current,
      shapes: projectRef.current.shapes.filter(s => s.id !== shapeId)
    };
    setProject(nextProj);
    projectRef.current = nextProj;
    commitHistory(nextProj);
    saveProject(nextProj);
    if (selectedShapeId === shapeId) {
      setSelectedShapeId(nextProj.shapes[0]?.id || null);
    }
  };

  const handleUpdateShapeColor = (shapeId: string, color: string) => {
    const nextProj: Project = {
      ...projectRef.current,
      shapes: projectRef.current.shapes.map(s =>
        s.id === shapeId ? { ...s, color } : s
      )
    };
    setProject(nextProj);
    projectRef.current = nextProj;
    saveProject(nextProj);
  };

  const handleUpdateShapeOverlay = (shapeId: string, overlayOpacity: number) => {
    const nextProj: Project = {
      ...projectRef.current,
      shapes: projectRef.current.shapes.map(s =>
        s.id === shapeId ? { ...s, overlayOpacity } : s
      )
    };
    setProject(nextProj);
    projectRef.current = nextProj;
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
       projectRef.current = nextProj;
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
          ...projectRef.current,
          background: { ...projectRef.current.background, type: 'image', value: imported }
        };
        setProject(nextProj);
        projectRef.current = nextProj;
        commitHistory(nextProj);
        saveProject(nextProj);
      }
    } catch (err) {
      console.error('Failed to import canvas background image:', err);
    }
  };

  const handleSetBgType = (type: 'color' | 'image') => {
    const nextProj: Project = {
      ...projectRef.current,
      background: { ...projectRef.current.background, type }
    };
    setProject(nextProj);
    projectRef.current = nextProj;
    commitHistory(nextProj);
    saveProject(nextProj);
  };

  const handleSetBgColor = (color: string) => {
    const nextProj: Project = {
      ...projectRef.current,
      background: { ...projectRef.current.background, type: 'color', value: color }
    };
    setProject(nextProj);
    projectRef.current = nextProj;
    saveProject(nextProj);
  };

  const handleSetBgFit = (fit: 'cover' | 'contain' | 'stretch' | 'tile') => {
    const nextProj: Project = {
      ...projectRef.current,
      background: { ...projectRef.current.background, fit }
    };
    setProject(nextProj);
    projectRef.current = nextProj;
    commitHistory(nextProj);
    saveProject(nextProj);
  };

  const handleClearAllCanvas = async () => {
    if (confirm("Clear the canvas background and all image/shape layers?")) {
      const current = projectRef.current;
      const clearedProject: Project = {
        ...DEFAULT_PROJECT,
        aspectRatio: current.aspectRatio || DEFAULT_PROJECT.aspectRatio,
        background: { ...DEFAULT_PROJECT.background },
        shapes: [],
      };
      setProject(clearedProject);
      projectRef.current = clearedProject;
      commitHistory(clearedProject);
      saveProject(clearedProject);
      setSelectedShapeId(null);
      setDrawingShape([]);
      setEditorState('IDLE');
      setPreviewCursor(null);
      dragRef.current = null;
      setHasPreviousCanvas(false);
      setCanvasTick(t => t + 1);
      try {
        const store = await load('gallery-project.json');
        await store.delete('canvas_previous_project');
        await store.save();
      } catch (err) {
        console.error('Failed to clear previous canvas backup:', err);
      }
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
    const accentColor = highlightColor;
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
            const shapeColor = resolveShapeColor(shape, accentColor);
            const overlayOpacity = Math.max(0, Math.min(1, shape.overlayOpacity ?? 0));
            if (overlayOpacity > 0 && shapeColor) {
              ctx.globalAlpha = overlayOpacity;
              ctx.fillStyle = shapeColor;
              ctx.fillRect(-cw, -ch, cw * 2, ch * 2);
              ctx.globalAlpha = 1;
            }
          } else {
           ctx.fillStyle = resolveShapeColor(shape, accentColor);
           ctx.fill();
         }
       } else {
         ctx.fillStyle = resolveShapeColor(shape, accentColor);
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
       ctx.strokeStyle = resolveShapeColor(shape, accentColor);
      ctx.stroke();
      ctx.restore();
    });

    const blob = await new Promise<Blob | null>(res => offCanvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Failed to encode canvas to PNG');
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  };

  const handleActivateCanvas = async () => {
    desktopOperationRef.current++;
    try {
      setIsBaking(true);
      const bytes = await bakeCanvas();
      const savedPath = await saveBakedWallpaper('active-collage.png', bytes);
      const savedProject = normalizeProject(projectRef.current);
      projectRef.current = savedProject;
      const store = await load('gallery-project.json');
      await store.set('project', savedProject);
      if (savedPath) {
        await saveBakedProject(savedPath, savedProject);
        await store.set(`baked_proj_${savedPath}`, savedProject);
        await store.set(`baked_proj_${getPathFileName(savedPath)}`, savedProject);
      }
      await store.set('baked_proj_active-collage.png', savedProject);
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
      const savedProject = normalizeProject(projectRef.current);
      projectRef.current = savedProject;
      const store = await load('gallery-project.json');
      await store.set('project', savedProject);
      await store.set(`baked_proj_${filename}`, savedProject);
      if (savedPath) {
        await saveBakedProject(savedPath, savedProject);
        await store.set(`baked_proj_${savedPath}`, savedProject);
        await store.set(`baked_proj_${getPathFileName(savedPath)}`, savedProject);
      }
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
    desktopOperationRef.current++;
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
      const filename = getPathFileName(path);
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
    if (!settingsLoaded) return true;
    const images = effectImages[selectedEffect] || {};
    if (selectedEffect === 'Cursor Reveal') return !images.layerA || !images.layerB;
    if (selectedEffect === 'Depth Parallax') return !images.testWallpaper || isGeneratingDepth;
    return !images.baseImage;
  };

  const closeModalFromBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) setOpenModal(null);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      {/* ─── SPLASH SCREEN ─── */}
      <div id="splash-screen" className={showSplash ? '' : 'hidden'}>
          <div className="splash-logo-box" aria-label="Graffiti">
            <img src="/logos/Graffiti_New_Logo_Transparent.png" alt="Graffiti" />
          </div>
      </div>

      {/* ─── MAIN BENTO WORKSPACE ─── */}
      <main className="workspace-wrapper" aria-label="Graffiti wallpaper workspace">
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
              <div className={`effects-image-list ${(EFFECT_IMAGE_KEYS[selectedEffect] || []).length > 1 ? 'multi-image-list' : ''}`}>
                {(EFFECT_IMAGE_KEYS[selectedEffect] || []).map(imgKey => {
                  const path = getEffectImagePath(selectedEffect, imgKey);
                  const label = EFFECT_IMAGE_LABELS[selectedEffect]?.[imgKey] || imgKey;
                  return (
                    <button
                      key={imgKey}
                      className="pill-select-btn image-select-btn"
                      onClick={() => handleImportImage(selectedEffect, imgKey)}
                    >
                      <span className="image-select-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                        <span className="image-select-label">{EFFECT_IMAGE_KEYS[selectedEffect].length > 1 ? label : 'Choose image'}</span>
                        <span className="image-select-name">{path ? getPathFileName(path) : (EFFECT_IMAGE_KEYS[selectedEffect].length > 1 ? 'Choose image' : 'Choose image')}</span>
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
              <div style={{ padding: '8px 16px', fontSize: '0.8rem', color: 'var(--text-dark)', fontWeight: 600 }}>
                 Warning: {depthError}
              </div>
            )}

            <div className="effects-bottom-bar">
              <button
                className="btn-dark-pill"
                id="btn-activate-effect"
                onClick={handleActivateEffect}
                disabled={isActivateDisabled() || isActivatingEffect}
                style={{ opacity: isActivateDisabled() || isActivatingEffect ? 0.5 : 1 }}
              >
                {isActivatingEffect ? 'Applying…' :
                 isGeneratingDepth && selectedEffect === 'Depth Parallax' ? 'Generating…' :
                 activeEffect === selectedEffect ? 'Re-Apply' : 'Activate'}
              </button>
              <button className="btn-outline-pill" id="btn-stop-effect" onClick={handleStopEffect} disabled={isActivatingEffect}>
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
                        onClick={() => { handleSelectEffect(name); setSidePopupView('sliders'); }}
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
                    <div className="sliders-image-imports" style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                            <span className="image-select-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px' }}>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                              <span className="image-select-name">{path ? getPathFileName(path) : 'Import Image…'}</span>
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
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-dark)', fontWeight: 500, padding: '4px 0' }}>
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
            <div className="settings-circle-badge" aria-hidden="true"><SettingsIcon size={31} strokeWidth={2.25} /></div>
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

          <div className="mini-card-about">
            <button className="about-bottom-trigger" onClick={() => setOpenModal('modal-about')}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>Workspace guide</div>
            </button>
          </div>
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
          <div className="modal-backdrop" onMouseDown={closeModalFromBackdrop}>
            <div className="popup-window large">
              <div className="popup-top-bar">
                <h2>Canvas Studio</h2>
                <button className="close-circle-x" onClick={() => setOpenModal(null)}>✕</button>
              </div>

              <div className="canvas-workspace-grid">
                <div className="canvas-editor-column">
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
                        : (dragRef.current?.active
                          ? 'grabbing'
                          : (selectedShape?.imagePath ? 'grab' : 'default'))
                    }}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                    onPointerLeave={handleCanvasPointerLeave}
                    onWheel={handleCanvasWheel}
                  />
                </div>
                <div className="canvas-bottom-toolbar">
                    {editorState === 'DRAWING' ? (
                      <>
                        <span style={{ color: 'var(--secondary)', fontSize: '0.78rem', padding: '0 8px', display: 'flex', alignItems: 'center' }}>
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
                                   const current = normalizeProject(projectRef.current);
                                   const restored = normalizeProject(prev);
                                   await store.set('canvas_previous_project', current);
                                   setProject(restored);
                                   projectRef.current = restored;
                                   commitHistory(restored);
                                   await saveProject(restored);
                                   await store.save();
                                   setSelectedShapeId(restored.shapes[0]?.id || null);
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
                        <button className="toolbar-btn" onClick={handleAddImageShape}>
                          + Image Layer
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
                          const next: Project = { ...projectRef.current, aspectRatio: e.target.value };
                          setProject(next);
                          projectRef.current = next;
                          commitHistory(next);
                          saveProject(next);
                        }}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-soft)',
                           background: 'var(--secondary)',
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
                               background: 'var(--secondary)',
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
                               background: s.id === effectiveSelectedShapeId ? 'var(--highlight)' : 'var(--secondary)',
                              color: s.id === effectiveSelectedShapeId ? 'var(--text-dark)' : 'inherit',
                              fontWeight: s.id === effectiveSelectedShapeId ? 700 : 500,
                              cursor: 'pointer',
                              border: 'none',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: resolveShapeColor(s, highlightColor), display: 'inline-block', border: '1px solid rgba(0,0,0,0.2)' }} />
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
                           style={{ background: 'transparent', border: 'none', color: 'var(--text-dark)', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                          Delete
                        </button>
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fill Color</div>
                      <input
                        type="color"
                         value={resolveShapeColor(selectedShape, highlightColor)}
                        onChange={(e) => handleUpdateShapeColor(selectedShape.id, e.target.value)}
                        style={{ width: '100%', height: '36px', border: 'none', borderRadius: '10px', cursor: 'pointer', marginBottom: '8px' }}
                      />

                      {selectedShape.imagePath && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Color Overlay</span>
                            <strong style={{ color: 'var(--text-dark)' }}>{Math.round((selectedShape.overlayOpacity ?? 0) * 100)}%</strong>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={selectedShape.overlayOpacity ?? 0}
                            onChange={(e) => handleUpdateShapeOverlay(selectedShape.id, parseFloat(e.target.value))}
                            style={{ width: '100%', cursor: 'pointer' }}
                          />
                        </div>
                      )}

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Image</div>
                      <button
                        className="pill-select-btn"
                        style={{ width: '100%', fontSize: '0.8rem' }}
                        onClick={() => handleAssignShapeImage(selectedShape.id)}
                      >
                        <span>{selectedShape.imagePath ? selectedShape.imagePath.split(/[\\/]/).pop() : 'Add Image…'}</span>
                        <span className="caret">Browse</span>
                      </button>

                      {selectedShape.imagePath && (
                        <>
                          <button
                            className="btn-outline-pill"
                            style={{ width: '100%', marginTop: '6px', fontSize: '0.76rem' }}
                            onClick={() => handleClearShapeImage(selectedShape.id)}
                          >
                            Remove Image
                          </button>

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
                            <button
                              type="button"
                              className="btn-outline-pill transform-reset-btn"
                              title="Reset Rotation (0°)"
                              onClick={() => updateShapeTransform(selectedShape.id, { rotate: 0 })}
                            >
                              Reset rotation
                            </button>
                          </div>

                          <div className="canvas-gesture-help">
                            <strong>Mouse controls:</strong> drag the image to position it, scroll to zoom, and use <strong>Shift + scroll</strong> to rotate. Hold <strong>Alt</strong> while dragging to move the mask; drag corners to reshape it.
                          </div>
                        </>
                      )}

                      <button
                        className="btn-outline-pill"
                         style={{ width: '100%', marginTop: '8px', borderColor: 'var(--text-dark)', color: 'var(--text-dark)', fontSize: '0.76rem' }}
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
        <div className="modal-backdrop" onMouseDown={closeModalFromBackdrop}>
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
                             color: 'var(--text-dark)',
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
                               const filename = getPathFileName(path);
                               const currentProject = normalizeProject(projectRef.current);

                               // Save older canvas shapes state so user can always restore them!
                               await store.set('canvas_previous_project', currentProject);
                               setHasPreviousCanvas(true);

                               // Prefer metadata stored beside the PNG. This keeps the
                               // editable layer project tied to the baked file even if
                               // the store key/path representation changes.
                               let bakedProj: Project | null = null;
                               try {
                                 bakedProj = await loadBakedProject(path) as Project | null;
                               } catch (_) {
                                 // Older builds do not have the sidecar command; use the
                                 // legacy store entries below.
                               }
                               if (!bakedProj) bakedProj = (await store.get<Project>(`baked_proj_${path}`)) ?? null;
                               if (!bakedProj && filename) {
                                 bakedProj = (await store.get<Project>(`baked_proj_${filename}`)) ?? null;
                               }

                               let nextProj: Project;
                               if (bakedProj) {
                                 const normalizedBaked = normalizeProject(bakedProj);
                                 // A metadata record with no layers still represents a flattened
                                 // baked image. Open that PNG as the only editable layer rather
                                 // than leaving the previous canvas underneath it.
                                 nextProj = normalizedBaked.shapes.length > 0
                                   ? normalizedBaked
                                   : createBakedImageProject(path, normalizedBaked.aspectRatio || currentProject.aspectRatio);
                               } else {
                                 // Legacy builds did not write a project manifest. For files
                                 // created by Graffiti, the current saved project is the best
                                 // recoverable source for the individual layers. Only fall
                                 // back to a single flattened layer when that source is not
                                 // available; a PNG alone cannot be decomposed back into its
                                 // original images.
                                 const looksLikeGraffitiBake = /^gallery-\d+\.[^/.]+$/i.test(filename)
                                   || filename.toLowerCase() === 'active-collage.png';
                                 nextProj = looksLikeGraffitiBake && currentProject.shapes.length > 1
                                   ? currentProject
                                   : createBakedImageProject(path, currentProject.aspectRatio);
                               }

                               setProject(nextProj);
                               projectRef.current = nextProj;
                               commitHistory(nextProj);
                               await saveProject(nextProj);
                               await store.save();
                               setSelectedShapeId(nextProj.shapes[0]?.id || null);
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
        <div className="modal-backdrop" onMouseDown={closeModalFromBackdrop}>
          <div className="popup-window large" style={{ maxWidth: '1040px', position: 'relative' }} aria-busy={isActivatingWeb}>
            <div className="popup-top-bar">
              <h2>Set 3D Web Wallpaper Model</h2>
              <button className="close-circle-x" onClick={() => setOpenModal(null)} disabled={isActivatingWeb}>✕</button>
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
                   onClick={handleActivate3D}
                   disabled={isActivatingWeb}
                 >{isActivatingWeb ? 'Applying Web Wallpaper…' : 'Activate 3D Wallpaper'}</button>
              </div>
            </div>

            {isActivatingWeb && (
              <div className="web-activation-overlay" role="status" aria-live="polite">
                <div className="web-activation-panel">
                  <div className="web-activation-spinner" aria-hidden="true" />
                  <div className="web-activation-title">Applying to your desktop</div>
                  <div className="web-activation-message">{webStatus}</div>
                  <p>Keep Graffiti open while the desktop surface initializes. Please do not close or minimize this window.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: THEME ═══════════════ */}
      {openModal === 'modal-theme' && (
        <div className="modal-backdrop" onMouseDown={closeModalFromBackdrop}>
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
        <div className="modal-backdrop" onMouseDown={closeModalFromBackdrop}>
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
        <div id="settings-page-view" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpenModal(null);
        }}>
          <div className="settings-page-container">
            <div className="popup-top-bar">
              <div>
                <span className="settings-eyebrow">ENGINE CONTROL</span>
                <h2>Settings</h2>
              </div>
              <button className="close-circle-x" onClick={() => setOpenModal(null)}>✕</button>
            </div>
            <div className="settings-sections">
              <section className="settings-section">
                <div className="settings-section-heading">
                  <div>
                    <span className="settings-section-kicker">01 / STARTUP</span>
                    <h3>Launch behavior</h3>
                  </div>
                  <span className="settings-section-mark">AUTO</span>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-title">Launch at Startup</div>
                    <div className="setting-description">Start Graffiti silently when signing into Windows.</div>
                    {autostartError && <div className="setting-description settings-inline-error">{autostartError}</div>}
                  </div>
                  <button
                    className={`toggle-pill ${autostartEnabled ? 'on' : ''}`}
                    aria-pressed={autostartEnabled}
                    onClick={handleToggleAutostart}
                  >
                    <span className="toggle-dot" />{autostartEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="setting-row setting-row-input">
                  <div>
                    <div className="setting-title">Idle Timeout</div>
                    <div className="setting-description">Pause the engine after no mouse movement. Set 0 to disable.</div>
                  </div>
                  <label className="settings-number-control">
                    <input type="number" min="0" value={appSettings.idleTimeout}
                      onChange={(e) => handleUpdateSetting('idleTimeout', parseFloat(e.target.value) || 0)} />
                    <span>sec</span>
                  </label>
                </div>
                <div className="setting-row setting-row-input">
                  <div>
                    <div className="setting-title">Renderer GPU</div>
                    <div className="setting-description">Choose the adapter used by native effects. Changing it restarts the renderer.</div>
                  </div>
                  <label className="settings-select-control">
                    <select value={appSettings.preferredGPU} onChange={(e) => handleUpdateSetting('preferredGPU', e.target.value)}>
                      <option value="Automatic">Automatic</option>
                      {gpuAdapters.filter((adapter) => adapter !== 'Automatic').map((adapter) => (
                        <option key={adapter} value={adapter}>{adapter}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section-heading">
                  <div>
                    <span className="settings-section-kicker">02 / POWER</span>
                    <h3>Pause rules</h3>
                  </div>
                  <span className="settings-section-mark">SMART</span>
                </div>
                <div className="settings-rule-grid">
                  <div className="setting-row">
                    <div>
                      <div className="setting-title">When hidden</div>
                      <div className="setting-description">Pause when a maximized window covers the desktop.</div>
                    </div>
                    <button className={`toggle-pill ${appSettings.pauseHidden ? 'on' : ''}`} onClick={() => handleUpdateSetting('pauseHidden', !appSettings.pauseHidden)}>
                      <span className="toggle-dot" />{appSettings.pauseHidden ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <div className="setting-title">Fullscreen</div>
                      <div className="setting-description">Pause during fullscreen games or video playback.</div>
                    </div>
                    <button className={`toggle-pill ${appSettings.pauseFullscreen ? 'on' : ''}`} onClick={() => handleUpdateSetting('pauseFullscreen', !appSettings.pauseFullscreen)}>
                      <span className="toggle-dot" />{appSettings.pauseFullscreen ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <div className="setting-title">Battery saver</div>
                      <div className="setting-description">Pause when unplugged or Battery Saver is active.</div>
                    </div>
                    <button className={`toggle-pill ${appSettings.pauseBattery ? 'on' : ''}`} onClick={() => handleUpdateSetting('pauseBattery', !appSettings.pauseBattery)}>
                      <span className="toggle-dot" />{appSettings.pauseBattery ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <div className="setting-title">Session lock</div>
                      <div className="setting-description">Pause when Windows is locked with Win + L.</div>
                    </div>
                    <button className={`toggle-pill ${appSettings.pauseSessionLocked ? 'on' : ''}`} onClick={() => handleUpdateSetting('pauseSessionLocked', !appSettings.pauseSessionLocked)}>
                      <span className="toggle-dot" />{appSettings.pauseSessionLocked ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="settings-section settings-danger-section">
                <div>
                  <span className="settings-section-kicker">03 / RECOVERY</span>
                  <h3>Restore defaults</h3>
                  <p>Restores the default rules and restarts the renderer engine.</p>
                </div>
                <button className="settings-reset-button" onClick={handleResetDefaults}>Reset settings</button>
              </section>
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
