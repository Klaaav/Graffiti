# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

General Windows desktop users who want their desktop to feel more alive without needing technical knowledge. Secondary audience: technically inclined and creative users who enjoy customizing visual effects, importing 3D models, and tweaking shader parameters.

## Product Purpose

Graffiti is a Windows desktop wallpaper engine that renders interactive, GPU-accelerated visual effects directly behind desktop icons. It turns static wallpapers into living, reactive surfaces — depth parallax from AI, physics-based distortions, cursor-responsive reveals, and full 3D model scenes — all running natively on the GPU with minimal resource impact. Success means a desktop that feels personal and alive without compromising system performance, privacy, or battery life.

## Positioning

- **Open source and free** where competitors (Wallpaper Engine) require paid plans.
- **Privacy-first**: fully offline, no accounts, no telemetry, no cloud dependency.
- **Native GPU rendering**: DirectX 11 shader pipeline renders at the hardware level — not through a browser layer — delivering lower CPU/memory overhead than browser-based alternatives.
- **On-device AI**: ONNX Runtime depth estimation turns any 2D image into a parallax 3D effect without manual depth maps or cloud processing.

## Operating Context

Single-user Windows desktop app. Runs as a system tray application with autostart capability. The DirectX renderer attaches to Explorer's WorkerW window hierarchy to paint behind icons. Effects are hot-swappable DLL plugins. A separate WebView2-based process handles 3D model wallpapers. Named pipe IPC (`\\.\pipe\Graffiti`) bridges the Tauri/React frontend to the C++ renderer. User data lives in `%APPDATA%\Graffiti` — wallpapers, configs, depth maps, and web assets.

## Capabilities and Constraints

**Capabilities:**
- Import any image as wallpaper with automatic AI depth map generation
- Five native shader effects: Depth Parallax, Gravity Lens, Stone Press, Brick Outline, Cursor Reveal
- 3D model wallpapers (.glb) via WebView2 with configurable rotation, zoom, offset
- FPS cap and resolution scaling for performance tuning
- Power-aware: pauses on battery, screen lock, fullscreen apps, and occlusion
- Session persistence and auto-restore on launch

**Constraints:**
- Windows only (depends on Explorer WorkerW hierarchy and DirectX 11)
- Only one rendering mode active at a time (native effects OR web wallpaper, never both)
- Web wallpaper mode uses significantly more RAM (~250-350MB) than native effects (~10-35MB)
- Single monitor support in current version

## Brand Commitments

- **Graffiti** is the product name and must remain branded throughout the app.
- Klaaav developer identity exists but is not required in-app.
- Privacy-first messaging ("fully offline, no accounts, no telemetry") is a core brand promise that must be preserved in all user-facing surfaces.

## Evidence on Hand

- Two logo assets: `logos/Graffiti_logo.jpeg` (product), `logos/Klaaav_logo.jpeg` (developer — optional in-app use).
- No testimonials, case studies, or press. Do not fabricate.
- Working demo with five shader effects and 3D web wallpaper mode.

## Product Principles

1. **Performance is invisible.** Effects must never noticeably impact the user's primary tasks, gaming, or battery life.
2. **Privacy by architecture.** No network calls, no accounts, no telemetry — not as a toggle, but as a design constraint.
3. **One image, instant magic.** Drop in a photo and the AI + shaders make it interactive — no manual setup, no depth maps, no configuration required.
4. **Native over emulated.** Prefer GPU-native rendering paths over browser-based approaches whenever possible.
5. **Open and accessible.** Free, open source, and usable without technical knowledge.
