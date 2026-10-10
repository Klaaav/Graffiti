# Unresolved Architectural Issues (Graffiti Renderer)

This document tracks two major interconnected issues related to the Windows Desktop Window Manager (DWM) and `WorkerW` hierarchy handling in our C++ renderer. Both issues stem from how Windows processes desktop wallpaper changes and window Z-ordering.

## 1. The "Effect / Wallpaper Disappears" Issue
**Symptom:**
Initially, applying an effect would cause both the effect and the wallpaper to vanish completely. Later in development, this morphed into just the *effect* disappearing, while the desktop wallpaper remained visible.

**Root Cause:**
Windows handles desktop backgrounds by drawing them on a specific `WorkerW` window deep in the DWM hierarchy. When our renderer launches, it uses `SetParent` to attach its DirectX swap chain window to this `WorkerW`. However, whenever the system wallpaper changes, Windows Explorer can dynamically destroy, recreate, or reposition these `WorkerW` windows. Because our renderer's HWND was attached to an *old* or *invalidated* `WorkerW`, it became unlinked from the active desktop rendering chain, causing the DirectX content (the effect) to disappear from view.

## 2. The "Black Screen of Death" Issue
**Symptom:**
After attempting to fix the above issue by forcefully calling `SystemParametersInfoA(SPI_SETDESKWALLPAPER)` on the IPC thread whenever an effect was activated, the entire screen would go black. Crucially, the right-click desktop menu became completely inaccessible.

**Root Cause:**
This was the catastrophic extreme of the `WorkerW` recreation problem.
1. The user clicks "Activate Effect" in the UI.
2. The IPC background thread receives the command and calls `SystemParametersInfoA(SPI_SETDESKWALLPAPER)` to set the physical Windows desktop background.
3. This API call sends a system-wide `SPIF_SENDCHANGE` message.
4. Explorer receives the message and immediately rebuilds the desktop hierarchy (`WorkerW`).
5. Because our renderer's window was created as a `WS_POPUP`, and its parent `WorkerW` was just destroyed/repositioned by Explorer, the renderer window ended up "orphaned" at the very top of the Z-order—*above* the desktop icons and right-click menus.
6. The renderer immediately called `ShowWindow(SW_SHOW)`, painting a solid black DirectX frame over everything before the plugin had a chance to load the actual image texture.

## How they are Connected
Both issues are fundamentally the same problem: **Race conditions between our renderer and Windows Explorer over the `WorkerW` hierarchy.**
* In Issue 1, the renderer window ended up completely hidden (behind the new `WorkerW` or detached).
* In Issue 2, the renderer window ended up completely dominant (above all desktop icons) because we triggered the `WorkerW` rebuild manually on a background thread while the renderer main thread was trying to draw.

**Future Fix Considerations:**
Any future attempt to fix this must decouple the `SystemParametersInfoA` wallpaper change from the renderer's `ShowWindow` state. 
- The renderer window must *never* be created with `WS_VISIBLE`.
- After `SystemParametersInfoA` is called, the renderer must wait (e.g., `Sleep(200)`) for Explorer to finish rebuilding the desktop.
- The renderer must actively call `GetWorkerW()` *after* the delay and re-parent itself using `SetParent(hwnd, freshWorkerW)`.
- `ShowWindow(SW_SHOW)` must only be called *after* the active plugin has successfully loaded its texture into GPU memory to avoid black flashes.

## Current Repository Status
Due to the cascading nature of these DWM race conditions—and the fact that each debugging attempt to patch the `WorkerW` parenting logic introduced secondary visual artifacts or complete unresponsiveness—all fixes attempted on this date were ultimately discarded. We performed a hard reset (`git stash`) to revert the codebase entirely to the previous stable Git commit (`d622ce3`), ensuring that no residual experimental code was left in the renderer. Any future attempts to fix these issues must be built cleanly on top of this reverted, stable foundation.
