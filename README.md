# Graffiti

Graffiti is an offline-first Windows desktop wallpaper engine. It combines a native DirectX 11 renderer with a Tauri + React workspace so a single image, collage, or 3D model can become an interactive desktop surface.

The UI opens into an independent studio-board layout inspired by modular creative tools: a lime **Effects Studio** card, **Gallery** and **Web wallpaper** cards, then smaller **Settings**, **Theme**, and **About** destinations. The interface keeps the controls text-led and deliberately avoids decorative icon clutter.

## What it does

- Applies GPU-native interactive wallpaper effects behind desktop icons.
- Imports local images and persists effect/image/quality settings between sessions.
- Generates an on-device depth map for the Depth Parallax effect.
- Builds polygon collages in Canvas Studio with solid or image fills, undo/redo, transform controls, save, and activate actions.
- Stores baked wallpapers locally and lets users activate or reopen them in Canvas Studio.
- Loads `.glb`/`.gltf` assets into a WebView2-powered 3D wallpaper surface.
- Pauses or reduces rendering for hidden windows, fullscreen apps, battery saver, idle time, and locked sessions according to Settings.
- Works without accounts, telemetry, or a cloud dependency.

## Effects

| Effect | What it changes |
| --- | --- |
| Cursor Reveal | Reveals a second wallpaper layer around the cursor. |
| Gravity Lens | Warps the wallpaper around the cursor with a fluid lens. |
| Glass Lens | Adds a transparent refraction and chromatic-dispersion lens. |
| Space Ball | Creates a tactile, deformable surface response. |
| Brick Outline | Lights procedural grid/brick edges near the cursor. |
| Depth Parallax | Uses the local ONNX depth model to shift an image in 3D space. |

## UI workflow

### Effects Studio

1. Click the **RES** and **FPS** circles above the card to cycle resolution scale and frame-rate cap.
2. Open **Choose Effect** to select one of the six native effects. The drawer is aligned to the card's top edge and opens on its right side.
3. Use **Choose image** to import or select a saved wallpaper. Cursor Reveal exposes separate background/reveal layers.
4. Open **Sliders** to adjust the selected effect's live parameters.
5. Click **Activate** to apply the configured effect or **Stop Effect** to remove it.

### Gallery

- **Canvas** opens the collage editor. Draw polygon shapes, set a solid or image background, assign images to shapes, adjust zoom/rotation, undo/redo, save a baked wallpaper, or activate the current canvas.
- **Baked Wallpapers** shows the locally saved wallpaper directory. Each saved collage can be activated or opened back in Canvas Studio to continue editing.

### Web wallpaper

- **Set Model** opens the 3D setup window with model import, solid/image background preview, camera sliders, and activation.
- **Stop 3D Wallpaper** removes the active WebView2 wallpaper.

### Smaller destinations

- **Settings** opens startup, idle, power, fullscreen, battery, session-lock, GPU, and reset controls.
- **Theme** persists the highlight and secondary color pickers. The default highlight is neon chartreuse and the default secondary color is soft white.
- **About** explains the end-to-end workflow, all effects, Web wallpaper memory usage, and the next planned update.

Every popup has an **X inside a circle** in its top bar so it can be closed without relying on outside-click behavior.

## Architecture

| Directory | Responsibility |
| --- | --- |
| `ui/` | React 19 + TypeScript + Vite frontend and Tauri v2 shell. |
| `ui/src/App.tsx` | UI state, persisted workspace flows, popup views, Canvas Studio, and IPC orchestration. |
| `ui/src/index.css` | Independent studio-board visual system and responsive layout. |
| `ui/src-tauri/` | Tauri commands, Rust IPC client, packaging configuration, and depth-map bridge. |
| `renderer/` | C++17 DirectX 11 renderer, named-pipe IPC server, quality/power managers, and shader plugins. |
| `web_wallpaper/` | Native WebView2 host for interactive 3D model wallpaper sessions. |
| `website/` | Astro marketing/documentation website. |
| `depth_model.onnx` | Local depth-estimation model used by Depth Parallax. |
| `downloads/` | Distribution artifacts produced by the Windows packaging script. |

The frontend talks to native code through Tauri commands and the `\\.\pipe\Graffiti` renderer IPC channel. Only one rendering mode is active at a time: a native effect, a gallery collage, or a Web wallpaper.

## Requirements

The shipped application is Windows-only because it relies on Explorer's desktop window hierarchy, DirectX 11, Windows named pipes, and WebView2.

- Windows 10/11 x64
- Visual Studio 2022 with Desktop development with C++
- Windows SDK and `fxc.exe`
- CMake 3.20 or newer
- Node.js 22.12 or newer
- Rust toolchain with the Tauri v2 prerequisites
- Microsoft Edge WebView2 Runtime for 3D wallpaper mode

## Development setup

From the repository root:

```powershell
cd ui
npm install
npm run build
```

Run the frontend in a browser-sized development window:

```powershell
npm run dev
```

Run the complete Tauri desktop shell after the native renderer and WebView2 executable are available:

```powershell
npx tauri dev
```

The Tauri development server uses `http://localhost:1420`.

## Native builds

Use a Visual Studio Developer Command Prompt or Developer PowerShell.

Build only the DirectX renderer:

```powershell
.\build.bat
```

Build the renderer and WebView2 helper together:

```powershell
.\build_all.bat
```

Build native components, package the Tauri NSIS/MSI installers, and copy the NSIS installer into `downloads/`:

```powershell
.\build_setup.bat
```

The scripts expect the checkout at `C:\My_Proj\InteractWall` unless the paths in the scripts are adjusted for another location.

## Local data

Graffiti stores user state under `%APPDATA%\Graffiti`, including:

- imported wallpapers;
- effect, theme, quality, and power settings;
- active-session information;
- Canvas Studio project metadata;
- baked wallpapers under `%APPDATA%\Graffiti\baked_wallpapers`.

Native effects typically use about **10–35 MB** of memory, while Web wallpaper mode uses about **250–350 MB** because it hosts WebView2 plus model and texture data. Actual usage depends on the model, textures, display resolution, and active effect.

## Verification

The UI production check is:

```powershell
cd ui
npm run build
```

This runs TypeScript checking followed by the Vite production bundle. Native builds should be verified on Windows with the scripts above because the DirectX, WebView2, and MSVC toolchain are Windows-specific.

## Privacy and offline behavior

Graffiti is designed as a local application. Wallpaper assets, settings, depth generation, and rendering stay on the device. The application does not require an account or a hosted service to operate.
