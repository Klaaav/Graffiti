# Graffiti Desktop App — UI Redesign Specification & Master Prompt

> **Read this entire document before designing or implementing.** This is the complete product, design system, and technical specification for redesigning the official desktop application for **Graffiti** (A Klaaav Product). It can be used directly as an input prompt for Google Stitch, design agents, or human developers.

---

## 1. Executive Summary & Mission

Build a completely revamped, studio-grade desktop application interface for **Graffiti**, a lightweight Windows utility that turns user-imported wallpaper images and 3D models into interactive, GPU-accelerated desktop wallpapers.

The existing backend is a high-performance **DirectX 11 / C++ native renderer** coupled with a **Tauri v2** shell. The frontend is built with **React 19, TypeScript, Vite, and Tailwind CSS**.

The goal of this redesign is to elevate the UI from an early utility prototype into a **refined, tactile, dark-luxury creative instrument**—reminiscent of high-end audio hardware (Teenage Engineering, Braun, Ableton) merged with modern creative workstation software (Figma, Linear, Blender).

---

## 2. Brand Identity & Design System

### 2.1 Aesthetic Principles
- **Tactile Instrument, Not Web Form**: Controls should feel weighted and deliberate. Use rotary knobs, segmented switches, precision sliders, and crisp telemetry readouts rather than generic web form inputs.
- **Obsidian & Metallic Gold Palette**: Deep, pitch-black charcoal backgrounds with subtle warm metallic gold accents. Never use generic neon blues, purples, or vibrant AI gradients.
- **Restraint & Purpose**: Every pixel serves a function. Generous micro-spacing, razor-sharp 1px borders, subtle inner shadows, and zero visual clutter.
- **Glass & Depth Hierarchy**: Use layered glassmorphism with discipline—elevated control panels cast soft ambient shadows over the deep base canvas.

### 2.2 Color Tokens
| Token | Hex Value | Purpose |
| :--- | :--- | :--- |
| `bg-canvas` | `#080706` | Deepest base background / window frame |
| `bg-surface` | `#110F0D` | Primary card panels, sidebar, stage backings |
| `bg-surface-elevated` | `#1A1713` | Hover states, dropdowns, modal layers |
| `border-subtle` | `rgba(201, 162, 77, 0.12)` | 1px hairline division borders |
| `border-active` | `rgba(201, 162, 77, 0.35)` | Active selection and focused inputs |
| `gold-primary` | `#C9A24D` | Brand identity accent, active toggles, key indicators |
| `gold-bright` | `#E8C97A` | Glow highlights, active rotary knobs, hover states |
| `gold-muted` | `#8C7136` | Secondary accents, disabled indicators |
| `text-primary` | `#F5F2EB` | Primary typography, headers, active values |
| `text-secondary` | `#999182` | Descriptive labels, secondary navigation |
| `text-tertiary` | `#5C5549` | Placeholder text, subtle units, telemetry tags |

### 2.3 Typography
- **Display Headings**: High-contrast modern serif with refined proportions (e.g., *Bodoni Moda*, *Cinzel*, or *Outfit* display).
- **Interface & Body**: Ultra-clean geometric neo-grotesque sans-serif (e.g., *Inter*, *Geist*, *SF Pro Display*).
- **Telemetry & Numbers**: Monospaced tabular figures for real-time FPS counters, coordinates, and slider values (e.g., *JetBrains Mono*, *Geist Mono*).

### 2.4 Form Factor & Window Chrome
- **Window Dimensions**: Default `920 × 640` px (resizable, min width `800 × 580` px).
- **Custom Titlebar**: Custom frameless titlebar integrated seamlessly into the window background:
  - Left: Minimal Graffiti icon mark (`/logos/Graffiti_New_Logo_Transparent.png`) + app title `"GRAFFITI"` (monospace, tracking `0.2em`).
  - Center: Window drag region (`data-tauri-drag-region`).
  - Right: Minimalist Windows window controls (Minimize, Maximize, Close) with subtle hover micro-interactions.

---

## 3. Navigation & App Shell Structure

The app shell utilizes a **Left Navigation Rail + Top Telemetry Header + Main Stage** layout:

```
+-------------------------------------------------------------------------------+
| [GF] GRAFFITI             [Window Drag Region]              [—] [口] [✕]      |
+--------+----------------------------------------------------------------------+
|        | [Header] Active Effect / Breadcrumbs         [FPS: 60] [1.0x] [Mon:1]|
|  NAV   +----------------------------------------------------------------------+
|  RAIL  |                                                                      |
|        |                                                                      |
| (✨)   |                                                                      |
| Effects|                                                                      |
|        |                            MAIN STAGE                                |
| (🧊)   |                     (Interactive Studio Area)                        |
| 3D Web |                                                                      |
|        |                                                                      |
| (🖼️)   |                                                                      |
| Gallery|                                                                      |
|        |                                                                      |
| (⚙️)   |                                                                      |
| Setts  |                                                                      |
|        |                                                                      |
| (💎)   |                                                                      |
| About  |                                                                      |
+--------+----------------------------------------------------------------------+
```

### Navigation Items:
1. **Effects Studio** (`/effects`): The core engine room—configure, tune, and test the 6 native 2D interactive wallpaper shaders.
2. **3D Web Wallpaper** (`/web-wallpaper`): Interactive 3D model engine (GLTF/GLB) with cursor orbit tracking.
3. **Wallpaper Gallery** (`/gallery`): Wallpaper library management, dual-layer pairing, and local image importing.
4. **Settings & Engine** (`/settings`): Autostart, power-saving rules, multi-monitor configuration, and hardware performance caps.
5. **About & System** (`/about`): Product info, DirectX 11 engine telemetry, and project attribution.

---

## 4. Screen-by-Screen Specifications

### 4.1 Screen 1: Effects Studio (`Effects.tsx`)
The primary creative surface. Users choose an effect, inspect live changes in an interactive preview, and fine-tune physical parameters.

#### A. Telemetry & Quality Strip (Top Bar)
| Control | Type | Options / Range | IPC Action / Key | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **FPS Telemetry** | Badge | Numerical read | Real-time `liveFps` | Displays `Idle` if 0, active FPS in green |
| **Frame Rate Cap** | Segmented Chips | `30` \| `60` \| `Max` (0) | `setFpsCap(fps)` | Persists in store |
| **Resolution Scale** | Segmented Chips | `Native` (1.0) \| `75%` (0.75) \| `Half` (0.50) | `setResolutionScale(scale)` | Persists in store |
| **Auto Optimization** | Ghost Button | Action trigger | `setQualityAuto()` | Auto-detects GPU capabilities |

#### B. Exact Parameter Sliders by Effect

##### 1. Cursor Reveal (`cursor_reveal`)
*Two-layer brush erasing mechanism that reveals artwork beneath.*
- **Wallpaper Layers**:
  - `Layer A (Background)`: Local file path picker (`importWallpaper`)
  - `Layer B (Reveal)`: Local file path picker (`importWallpaper`)
- **Sliders & Inputs**:
  | Control | Min | Max | Step | Default | Unit / Format | IPC Key |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | **Brush Size** | `50` | `300` | `0.1` | `160` | `px` | `brushSize` |
  | **Brush Hardness** | `0.00` | `1.00` | `0.001` | `0.20` | decimal | `brushHardness` |
  | **Trail Length** | `0.0` | `5.0` | `0.01` | `1.0` | `s` | `trailLength` |
  | **Fade Out Speed**| `0.005`| `0.100`| `0.001` | `0.035` | decimal | `fadeSpeed` |
  | **Disappear When Resting** | Checkbox toggle | — | `true` | boolean | `fadeWhenResting` (1 or 0) |

##### 2. Gravity Lens (`gravity_lens`)
*Fluid gravitational lensing distortion warping around the cursor.*
- **Base Wallpaper**: Single local image picker
- **Sliders & Inputs**:
  | Control | Min | Max | Step | Default | Unit / Format | IPC Key |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | **Lens Strength** | `0.0` | `20.0` | `0.01` | `5.0` | multiplier | `lensStrength` |
  | **Lens Radius** | `0.02` | `0.25` | `0.001` | `0.08` | normalized | `lensRadius` |
  | **Spring Stiffness**| `10` | `200` | `0.1` | `50` | integer | `stiffness` |
  | **Spring Damping** | `0.70` | `0.99` | `0.001` | `0.90` | ratio | `damping` |
  | **Chromatic Dispersion**| `0.000`| `0.100`| `0.001` | `0.020` | spectral | `dispersion` |
  | **Core Darkening** | `0.00` | `1.00` | `0.001` | `0.50` | intensity | `coreDarkening` |
  | **Trail Length** | `0.0` | `5.0` | `0.01` | `1.0` | `s` | `trailLength` |
  | **Fade Speed** | `0.80` | `1.00` | `0.001` | `0.92` | `Never` if >= 0.99 | `fadeDecay` |

##### 3. Glass Lens (`gravity_lens_transparent`)
*Transparent refraction lens designed for clean desktop icon passthrough.*
- **Base Wallpaper**: Single local image picker
- **Sliders & Inputs**:
  | Control | Min | Max | Step | Default | Unit / Format | IPC Key |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | **Press Depth** | `0.000` | `0.150` | `0.001` | `0.030` | depth | `pressDepth` |
  | **Press Radius** | `0.02` | `0.25` | `0.001` | `0.08` | normalized | `pressRadius` |
  | **Spring Stiffness**| `10` | `200` | `0.1` | `50` | integer | `stiffness` |
  | **Spring Damping** | `0.70` | `0.99` | `0.001` | `0.90` | ratio | `damping` |
  | **Chromatic Dispersion**| `0.000`| `0.100`| `0.001` | `0.020` | spectral | `dispersion` |
  | **Core Darkening** | `0.00` | `1.00` | `0.001` | `0.15` | intensity | `coreDarkening` |
  | **Directional Shading** | `0.00` | `1.00` | `0.001` | `0.50` | shadow | `shadingStrength` |
  | **Trail Length** | `0.0` | `5.0` | `0.01` | `1.0` | `s` | `trailLength` |
  | **Fade Speed** | `0.80` | `1.00` | `0.001` | `0.92` | decay factor | `fadeDecay` |

##### 4. Space Ball (`stone_press_v2`)
*Tactile elastic surface deformation with spring momentum and lighting.*
- **Base Wallpaper**: Single local image picker
- **Sliders & Inputs**:
  | Control | Min | Max | Step | Default | Unit / Format | IPC Key |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | **Press Depth** | `0.00` | `10.00` | `0.01` | `2.00` | depth | `pressDepth` |
  | **Press Radius** | `0.01` | `1.00` | `0.001` | `0.30` | normalized | `pressRadius` |
  | **Spring Stiffness**| `10` | `300` | `0.1` | `50` | integer | `stiffness` |
  | **Spring Damping** | `0.70` | `0.99` | `0.001` | `0.90` | ratio | `damping` |
  | **Depth Darkening**| `0.00` | `1.00` | `0.001` | `0.00` | shadow | `depthDarkening` |
  | **Directional Shading**| `0.00` | `1.00` | `0.001` | `0.00` | bevel light | `directionalShading` |
  | **Parallax Strength**| `0.00` | `1.00` | `0.001` | `0.20` | displacement | `parallaxStrength` |

##### 5. Brick Outline (`brick_outline`)
*Architectural grid outline that lights up and glows when cursor approaches.*
- **Base Wallpaper**: Single local image picker
- **Sliders & Inputs**:
  | Control | Min | Max | Step | Default | Unit / Format | IPC Key |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | **Brick Width** | `10.0` | `300.0` | `0.1` | `100.0` | `px` | `brickWidth` |
  | **Brick Height** | `10.0` | `300.0` | `0.1` | `50.0` | `px` | `brickHeight` |
  | **Line Thickness** | `0.5` | `10.0` | `0.01` | `3.0` | `px` | `lineThickness` |
  | **Effect Radius** | `0.01` | `1.00` | `0.001` | `0.20` | normalized | `effectRadius` |
  | **Edge Softness** | `0.00` | `0.50` | `0.001` | `0.10` | falloff | `edgeSoftness` |
  | **Glow Intensity** | `0.00` | `3.00` | `0.01` | `1.00` | luminosity | `glowIntensity` |
  | **Outline Color** | Color Picker | — | `#ffffff` | Hex Color | `outlineColor` |

##### 6. Depth Parallax (`depth_parallax`)
*AI-generated 3D spatial parallax that shifts planes based on mouse coordinate.*
- **Test Wallpaper**: Single local image picker
- **ML Depth Map Action**: "Generate ML Depth Map" (`generateDepthMap(imagePath)`) with progress spinner & error alerts
- **Sliders & Inputs**:
  | Control | Min | Max | Step | Default | Unit / Format | IPC Key |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | **Parallax Strength** | `0.010` | `0.200` | `0.001` | `0.050` | spatial scale | `parallaxStrength` |

---

### 4.2 Screen 2: 3D Web Wallpaper Studio (`WebWallpaper.tsx`)
Configures real-time 3D model wallpapers rendered via embedded WebView2.

#### A. Controls & Sliders
| Control | Component Type | Range / Options | Default | Description / IPC Target |
| :--- | :--- | :--- | :--- | :--- |
| **Model Importer** | Button / Dropzone | File filter: `*.glb` | None | `importWebAsset(path)` &rarr; `modelPath` |
| **Background Mode** | Segmented Switch | `Color` \| `Image` | `Color` | Switches background rendering mode |
| **Background Color** | Color input | Hex code | `#1a1a2e` | Hex color string |
| **Background Image** | Button / Dropzone | File filter: `*.png, *.jpg` | None | `importWebAsset(path)` &rarr; `bgImage` |
| **Zoom Factor** | Precision Slider | `min=0.1, max=5.0, step=0.1` | `1.0x` | Camera distance multiplier |
| **Horizontal Offset**| Precision Slider | `min=-2.0, max=2.0, step=0.05` | `0.00` | X-axis model translation |
| **Vertical Offset** | Precision Slider | `min=-2.0, max=2.0, step=0.05` | `0.00` | Y-axis model translation |
| **Orbit Sensitivity**| Precision Slider | `min=0.0, max=2.0, step=0.1` | `0.2x` | Cursor tracking angular rotation factor |
| **Vertical Rotation**| Toggle Switch | `On` \| `Off` | `On` | Allows/locks pitch angle rotation |
| **Apply / Stop** | Dual Action CTA | Primary Gold / Ghost | — | `startWebWallpaper` / `stopWebWallpaper` |
| **Resource Notice** | Warning Badge | Static readout | — | `"Uses ~250-350MB RAM via WebView2"` |

---

### 4.3 Screen 3: Wallpaper Library & Collage Studio (`Gallery.tsx`)
A gallery where users manage their personal wallpaper collection, pair images for dual-layer effects, or create custom polygon collages.

#### Layout Composition:
- **Import Header**: Drag-and-drop zone accepting `.jpg`, `.png`, `.webp` images up to 8K.
- **Collage & Polygonal Canvas**:
  - Interactive canvas supporting custom polygon shape drawing.
  - Per-shape image assignment, pan, zoom, and rotation controls.
  - Background options: Color (`#1a1a1a`) or Image, with fit modes (`cover`, `contain`, `stretch`, `tile`).
  - Action buttons: "Save Baked Wallpaper", "Apply as Wallpaper", and "Clear".
- **Wallpaper Library Grid**:
  - High-density grid with hover preview and delete actions.
  - "Quick Generate Depth Map" button for instant Depth Parallax pairing.

---

### 4.4 Screen 4: Settings & Performance (`Settings.tsx`)
Clean, organized toggle cards for hardware and system behavior.

#### Exact Settings Matrix:
| Category | Setting | Component Type | Default | Description / Action |
| :--- | :--- | :--- | :--- | :--- |
| **System** | **Launch at Startup** | Toggle `On / Off` | `false` | Silently starts Graffiti when signing into Windows (`@tauri-apps/plugin-autostart`) |
| **Power** | **Idle Timeout** | Number input (`step=0.1`) | `0` (disabled) | Pauses engine if mouse is motionless for N seconds |
| **Power** | **Pause When Hidden** | Toggle `On / Off` | `true` | Pauses rendering when desktop is covered by normal windows |
| **Power** | **Pause During Fullscreen**| Toggle `On / Off` | `true` | Zero GPU usage during games or fullscreen media |
| **Power** | **Pause on Battery** | Toggle `On / Off` | `false` | Automatically conserves laptop battery |
| **Power** | **Pause on Lock Screen** | Toggle `On / Off` | `true` | Pauses when session is locked or on Remote Desktop |
| **Danger** | **Reset to Defaults** | Red Button | — | Re-initializes all settings and restarts renderer |

---

### 4.5 Screen 5: About & System (`About.tsx`)
1. **Branding**:
   - Exact golden Graffiti emblem (`Graffiti_New_Logo_Transparent.png`).
   - Title: `Graffiti`
   - Version: `v1.0.0 (Build 2026.10)`
   - Tagline: *"Your wallpapers, alive."*
2. **System Architecture**:
   - Engine: Native C++ DirectX 11 FLIP Engine
   - Host: Tauri v2 + React 19 + Rust
3. **Links & Attribution**:
   - GitHub Repository link ([`github.com/Klaaav/Graffiti`](https://github.com/Klaaav/Graffiti)).
   - Attribution: *"A Klaaav Product"*.

---

## 5. Technical Stack & Implementation Boundary

- **Path Boundary**: All UI files live inside `C:\My_Proj\InteractWall\ui\src\`.
- **Core Dependencies**:
  - React 19 (`react`, `react-dom`)
  - React Router DOM v7 (`react-router-dom`)
  - Tailwind CSS + Vanilla CSS tokens in `ui/src/index.css`
  - Lucide Icons (`lucide-react`)
  - Three.js (`three`, `@react-three/fiber`, `@react-three/drei`)
  - Tauri API v2 (`@tauri-apps/api`, `@tauri-apps/plugin-autostart`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-store`)
- **Backend IPC Calls (Must be preserved in `ui/src/ipc.ts`)**:
  - `applyWallpaper(layerA, layerB)`
  - `setEffect(effectName)`
  - `setSetting(key, value)`
  - `setFpsCap(fps)`
  - `setResolutionScale(scale)`
  - `startWebWallpaper(...)` / `stopWebWallpaper()`
  - `isAutostart()` / `enableAutostart()` / `disableAutostart()`

---

## 6. Acceptance Criteria

1. **Aesthetic Excellence**: Looks like a finished, award-winning desktop utility. Zero generic boilerplate or unstyled controls.
2. **Responsiveness**: All transitions, slider movements, and tab switches execute at 60 FPS without layout jumps.
3. **Persistence**: Changes made to sliders and settings automatically persist across app restarts via `store.ts`.
4. **Window Ergonomics**: Smooth window dragging via titlebar, working minimize/maximize/close buttons.
5. **Production Quality**: No missing icons, no broken layout on resize, no console errors.
