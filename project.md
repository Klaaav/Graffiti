# Project Graffiti (formerly InteractWall)

## Overview
Graffiti is an interactive, physics-based, and highly optimized desktop wallpaper engine built natively for Windows. It allows users to apply dynamic, GPU-accelerated visual effects over their standard desktop backgrounds, fully reacting to mouse movements and system events without obscuring desktop icons.

## Technology Stack
The project is built on a high-performance, multi-language architecture to balance rendering speed with a modern user interface:

### 1. Rendering Engine (C++ / DirectX 11)
- **Graphics API:** DirectX 11 (HLSL shaders).
- **Window Management:** Win32 API, specifically targeting the undocumented `WorkerW` window hierarchy of the Desktop Window Manager (DWM) to render visuals directly onto the desktop, strictly behind user icons.
- **Plugin System:** Modular architecture where every visual effect (e.g., Gravity Lens, Depth Parallax) is compiled as an independent DLL, hot-swapped dynamically via the core `GraffitiRenderer.exe`.
- **Power Management:** Custom C++ hooks detect full-screen applications, battery saver modes, and locked sessions to throttle or completely pause the GPU swap chain, ensuring zero impact on gaming or battery life.

### 2. User Interface (React / TypeScript / Vite)
- A modern, lightweight, responsive frontend built with React.
- Uses Vite for lightning-fast HMR and building.
- Communicates user settings and plugin activations to the backend.

### 3. Application Shell & IPC (Tauri / Rust)
- **Framework:** Tauri wraps the React frontend in a lightweight WebView.
- **System Integration:** Rust handles system tray functionality, window spawning, and file system management.
- **IPC Bridge:** A robust Named Pipe and JSON-based Inter-Process Communication (IPC) system bridges the React UI, the Rust backend, and the C++ renderer.
- **Machine Learning:** Uses `ort` (ONNX Runtime for Rust) to execute on-device ML inference for AI-driven depth map generation.

## Features
- **Dynamic Visual Plugins:**
  - **Depth Parallax:** Uses AI to infer 3D depth from a 2D image, allowing the wallpaper to shift and tilt based on mouse position.
  - **Gravity Lens:** Simulates gravitational distortion and refraction of the desktop background tracking the cursor.
  - **Stone Press / Brick Outline:** Interactive geometric deformations of the wallpaper.
  - **Cursor Reveal:** A blackout effect where the mouse acts as a localized light source revealing the image beneath.
- **On-Device AI:** Automatically generates depth maps for any user-uploaded image locally, completely offline.
- **Quality Controls:** User-configurable FPS caps and resolution scaling (sub-sampling) to heavily reduce GPU overhead.
- **Gallery & Persistence:** Locally saves user preferences, specific effect configurations, and custom wallpapers.

## Major Development Challenges
1. **The `WorkerW` Hack:** Rendering behind desktop icons but above the static wallpaper requires injecting a window into Windows Explorer's `WorkerW` hierarchy. This behavior is entirely undocumented by Microsoft and prone to breaking during system UI refreshes.
2. **GPU State Management:** Hot-swapping C++ plugin DLLs in real-time requires meticulous teardown and rebuilding of Direct3D Render Target Views (RTVs), Constant Buffers, and Shader Resource Views. Early attempts led to memory leaks and hard crashes.
3. **Packaging ML Models:** Ensuring the massive `depth_model.onnx` file was correctly resolved across development environments, NSIS setups, and MSI bundles without crashing the Rust backend.
4. **Cross-Process Synchronization:** Keeping the UI state perfectly synced with the physical C++ rendering loop via async pipes without hanging either thread.

## Current Unsolved Issues & Bugs
Currently, the codebase is parked at a stable fallback commit (`d622ce3`) due to severe, unresolved architectural bugs regarding the DWM:

1. **The "Black Screen of Death" (WorkerW Race Condition):** 
   - When a user applies a new effect, the IPC thread calls `SystemParametersInfoA` to set the physical Windows background. 
   - This causes Windows Explorer to rebuild the `WorkerW` hierarchy. 
   - Our renderer window becomes un-parented or mis-ordered, jumping *above* the desktop icons, rendering an opaque black screen that blocks right-click context menus.
2. **Effect/Wallpaper Disappearance:** 
   - A milder variant of the above bug where the renderer gets pushed so far back in the Z-order (or detached entirely) that the effect completely vanishes from the screen.
3. **Web Wallpaper Integration on Hold:** 
   - Attempts to integrate HTML/JS/CSS-based "Web Wallpapers" via WebView2 into the C++ renderer caused massive stability issues. The code was backed up to `C:\My_Proj\WebWallpaper_Backup` and integration is currently postponed until the core C++ `WorkerW` bugs are definitively fixed.
