# Graffiti - Marketing Website Design System

## Core Philosophy
Graffiti is a lightweight, native Windows 10/11 desktop app that turns a user's own imported wallpaper images into interactive, cursor-reactive desktop wallpapers using GPU-accelerated effects. 
- **Zero built-in wallpapers:** Users import their own.
- **Fully local/private:** No accounts, no cloud, no uploads.
- **Extremely performance-conscious:** Native C++/Direct3D11 renderer, near-zero resource use when hidden/fullscreen gaming/locked.
- **Qualitative language only:** Never state specific RAM/CPU/GPU numbers (e.g., use "negligible footprint", "stays out of your way").

## Brand
- **Primary:** "Graffiti" (Dominant)
- **Secondary:** "Klaaav" (Small mark, footer "A Klaaav product").

## Design Tokens

### Colors
- **Background:** `#0A0A0A` (Deep near-black)
- **Accent:** `#00F0FF` (Vibrant Cyan)
- **Text:** 
  - Primary: `#FAFAFA`
  - Secondary: `#A1A1AA` (Zinc-400)
- **Borders/Subtle:** `#27272A` (Zinc-800)

### Typography
Sourced via Fontshare:
- **Headlines:** `Clash Display` (Bold, impactful)
- **Body:** `Satoshi` (Clean, legible)
- **Labels/Technical:** `IBM Plex Mono` (Monospaced, precise)

### Motion & Easing
**AVOID ALL DEFAULT SPRING/BOUNCE EASING.**
Use these predefined cubic-bezier curves for a smooth, premium feel:
- `ease-out-expo`: `cubic-bezier(0.19, 1, 0.22, 1)` (Snappy reveal, smooth settle)
- `ease-in-out-circ`: `cubic-bezier(0.85, 0, 0.15, 1)` (Dramatic sweeping motion)
- `ease-out-quart`: `cubic-bezier(0.25, 1, 0.5, 1)` (Standard UI interactions)

### Spacing Scale
Uses standard Tailwind spacing scale (e.g., `4`, `8`, `16`, `24`, `32`, `64`), heavily favoring generous whitespace to let elements breathe.

## Architectural "Avoid" List
*Any future phases MUST adhere to this list.*
- ❌ **No 3-column icon-circle-heading card grids** as the default section pattern.
- ❌ **No glassmorphism** (Except exclusively on the floating navigation bar).
- ❌ **No decorative gradient blobs** in the background.
- ❌ **No bouncy or springy easing.** Motion should feel deliberate, digital, and premium.

## Core Effects (For Content Reference)
1. **Cursor Reveal:** Hidden second wallpaper layer revealed beneath the cursor.
2. **Gravity Lens:** Cursor acts as a localized gravitational lens, warping nearby pixels.
3. **Gravity Lens – Transparent:** Cursor presses inward like a heavy stone on stretched fabric.
4. **Space Ball:** A dramatic large-scale gravitational funnel.
5. **Brick Outline:** A glowing procedural running-bond brick pattern overlaid.
6. **Wallpaper Depth Parallax:** Auto-generates a 3D depth map from any photo via on-device ML.

## Additional Features
- **Gallery/Collage Builder:** Draw custom polygon shapes, place images, bake into one wallpaper.
- **Web Wallpaper Mode (Beta):** Interactive 3D models (heavier-weight optional mode).
