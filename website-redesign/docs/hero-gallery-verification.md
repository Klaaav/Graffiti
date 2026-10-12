# Hero and feature-copy verification

## Delivered

- Replaced the rejected orbital “G” panel with original, faceted cursor artwork and layered gold/coral planes. The SVG is inline in `src/components/HeroMotion.astro`; pointer motion is bounded and event-driven. The exact logo remains the only raster image in the hero.
- Renamed the third feature to Gallery, including navigation, heading, accessibility labels, component path, CSS selectors, and documentation.
- Gallery description: “Draw custom shapes and fill them with images or solid colors to create a wallpaper that’s entirely your own.”
- Web Wallpaper note: “Web Wallpaper renders 3D models in an embedded WebView, which can use more RAM and GPU resources than native image effects.”
- Gallery copy and media have separate grid areas on desktop and stack on smaller screens.

## Actual checks

`npm run build` passed with no build warnings.

`npm run check:ui` passed against the production preview at `http://127.0.0.1:4335/`, using a separate headless Edge process through `playwright-core`. No existing browser profile was accessed, and no CDP connection was used.

Scenarios checked:
- Desktop: 1440 × 1000
- Wide desktop: 1920 × 1080
- Tablet: 768 × 1024
- Mobile: 390 × 844
- Touch mobile: 390 × 844
- Reduced motion: 390 × 844

Assertions checked the loaded, large logo; pointer-reactive hero layers; static touch/reduced-motion artwork; visible keyboard focus and Enter navigation; the six-effect order; Gallery navigation and exact feature copy; absence of the old Assembly label; non-overlapping Gallery copy and media; the fully visible final collage; the new WebView note; and absence of horizontal overflow, local asset errors, and page JavaScript errors during these scenarios.

Screenshots and structured results are in `docs/verification/`. Desktop/mobile artwork, Gallery, and Web Wallpaper copy captures were reviewed. The final pass confirmed the mobile header, artwork link spacing, and reduced-motion Gallery caption corrections.

The Impeccable detector was also run. It still reports a font-style warning for the Arial artwork caption and advisory findings for the inherited type ramp and Gallery grid. This was not a clean detector pass, and no whole-site audit score is claimed.

These checks cover the requested hero and wording changes. They do not claim performance benchmarks, remote feedback submission, installer verification, or a new 3D rotation regression test.
