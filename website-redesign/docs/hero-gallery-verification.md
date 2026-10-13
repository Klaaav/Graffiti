# Hero and feature-copy verification

## Delivered

- Replaced the rejected orbital “G” panel and the earlier filled cursor sculpture with a typographic signal poster: a large GRAFFITI wordmark rotated 90 degrees left, rendered as a hollow yellow-gold outline with a faint echo, reticle, four distinct geometric marker nodes, and a restrained pointer trace. The extra hero caption and effect-library prompt were removed so the final `I` remains visible. The poster is authored in `src/components/HeroMotionAlt.astro`; pointer motion is bounded and event-driven. The exact logo remains the only raster image in the hero.
- Renamed the third feature to Gallery, including navigation, heading, accessibility labels, component path, CSS selectors, and documentation.
- Gallery description: “Draw custom shapes and fill them with images or solid colors to create a wallpaper that’s entirely your own.”
- Web Wallpaper note: “Web Wallpaper renders 3D models in an embedded WebView, which can use more RAM and GPU resources than native image effects.”
- Gallery copy and media have separate grid areas on desktop and stack on smaller screens.
- Download uses the logo-gold field; Gallery's collage label is covered with a solid `GALLERY` stamp; feedback categories are buttons and saved browser feedback can be expanded with `View feedback`. The attribution reads `A product of Klaav`, and the button/effect-row scanlines use smooth easing rather than stepped motion.
- The header local-account status was removed; the Effects stage now reports `ACTIVE EFFECT / [selection]`; Feedback includes three small gold/coral hard-offset tiles behind the form.
- Effects copy now says `Take your wallpaper to a whole new level with six cursor-reactive effects.` Web Wallpaper keeps only `Import a GLB model and let it live behind the desktop.` Download now describes the app as `A lightweight Windows app for turning the wallpaper you already own into a responsive desktop scene.`
- Hero copy now names the complete product surface: cursor-reactive effects, the shape-based Gallery, and 3D wallpapers running locally on Windows.
- The copy audit removed internal or mismatched phrasing: the effect queue now says `Select a clip to preview it. / One effect loads at a time.`; the Gallery stamp says `GALLERY`; Download explains that Version 1.0 is available with planned upgrades listed alongside it; and Feedback explains that notes are saved only in the current browser.
- Download now opens a large themed version popup with Version 1.0 current, Version 1.1 planned upgrades, and the tracked NSIS installer. The installer measures 100,073,110 bytes (95.44 MiB / 100.07 MB).
- The custom cursor now uses the supplied reference's cropped arrow as a transparent image asset, with a small control-state shadow; the reference's title, hand, and footer text are excluded.
- The hero now responds to viewport height so the full “Make the desktop move.” headline and all eight `GRAFFITI` letters are visible on entry. Supporting copy has its own row; mobile places the wordmark beside the logo/headline. The rotated wrapper uses intrinsic text width, and the echo offset scales with its font size. The hero `WALLPAPER / 001` label was trimmed to `001`.
- Gallery's existing appearance and animation phases are preserved, with 30% less animation travel: desktop 250vh → 175vh; smaller screens 180vh → 126vh. Total section heights include the pinned viewport and are now 275vh and 226vh.

## Actual checks

`npm run build` passed with no build warnings.

`UI_TEST_BROWSER=chromium npm run check:ui` passed against the production preview at `http://127.0.0.1:4335/`, using a separate headless Chromium process through `playwright-core`. No existing browser profile was accessed, and no CDP connection was used.

Scenarios checked:
- Desktop: 1440 × 1000
- Wide desktop: 1920 × 1080
- Compact laptop: 1280 × 600 at 1.5 device scale
- Short wide desktop: 1920 × 720
- Tablet: 768 × 1024
- Mobile: 390 × 844
- Short mobile: 390 × 640
- Narrow mobile: 320 × 568
- Touch mobile: 390 × 844
- Reduced motion: 390 × 844

Assertions checked the loaded, large logo; the vertical hollow wordmark and absence of the oversized pointer sculpture; removal of the extra hero caption/prompt; four geometric marker nodes; pointer-reactive reticle/trace state; removal of the local-account header badge; the active-effect stage label; exact Effects, Web Wallpaper, and Download copy; the transparent arrow cursor asset; static touch/reduced-motion artwork; visible keyboard focus and Enter navigation; the six-effect order; Gallery navigation and exact feature copy; absence of the old Assembly label; non-overlapping Gallery copy and media; the fully visible final collage; the new WebView note; Feedback decoration; and absence of horizontal overflow, local asset errors, and page JavaScript errors during these scenarios.

Entry-viewport regression checks run before any scroll or screenshot: a DOM Range measures the complete headline and each of the eight letters in both outline layers at `scrollY = 0`. All ten scenarios passed viewport containment and stage-clipping checks. Pointer motion also keeps both text layers within the stage. The reproduction before the fix at 1280 × 640 put the headline block's bottom at 743px and the wordmark text's bottom at 783px, outside that viewport.

Gallery checks measure the actual section height minus the viewport and compare it with the previous travel. Every animated scenario measured a 30% reduction. The halfway assembly state remains intermediate; the collage is fully opaque by 80% of the shortened travel. Reduced motion retains its static presentation. The narrow-mobile scenario also caught and verified a footer brand-wrap correction that removes horizontal overflow.

Screenshots and structured results are in `docs/verification/`. Fresh compact-laptop, wide/short desktop, tablet, and mobile entry captures were reviewed, along with the completed Gallery view and `cursor-arrow.png`. The full wordmark and headline are visible together without scrolling; the vertical rail no longer overlays the headline.

The last available Impeccable detector run against `src/` found 0 anti-patterns and advisory findings for intentional display/micro type sizes, warm registration colors, and the measurement-grid overlay. It was not rerun after this hero revision because the Windows launcher is unavailable in the Linux worker shell; no new detector score is claimed here.

These checks cover the requested hero and wording changes. They do not claim performance benchmarks, remote feedback submission, installer verification, or a new 3D rotation regression test.
