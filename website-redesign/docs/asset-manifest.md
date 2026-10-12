# Graffiti redesign asset manifest

The original files in `website/` remain unchanged. The redesign copies them into `public/`.

## Effect recordings

The six supplied recordings are integrated as lazy, visibility-gated `<video>` elements. No FFmpeg installation was available in the worker, so the source files remain unchanged and no trim/encode derivatives are claimed.

| Source | Selected range | Output |
| --- | --- | --- |
| Space ball.mp4 | Full source (range not measurable without ffprobe) | `public/effects/Space ball.mp4` |
| Gravity lens.mp4 | Full source (range not measurable without ffprobe) | `public/effects/Gravity lens.mp4` |
| Glass lens.mp4 | Full source (range not measurable without ffprobe) | `public/effects/Glass lens.mp4` |
| Depth parallax.mp4 | Full source (range not measurable without ffprobe) | `public/effects/Depth parallax.mp4` |
| Cursor reveal.mp4 | Full source (range not measurable without ffprobe) | `public/effects/Cursor reveal.mp4` |
| Brick outline.mp4 | Full source (range not measurable without ffprobe) | `public/effects/Brick outline.mp4` |

Only the selected recording is mounted; it uses `preload="metadata"` after the effects section enters view.

The presentation order is intentionally: **Cursor reveal → Glass lens → Depth parallax → Gravity lens → Brick outline → Space ball**.

## Gallery and model

- `public/gallery/gallery-687040847e79317109d01c56117af16628f95e6cde2148ec984e09d1b2cee8d9.png` is the supplied final collage.
- The four neighboring source images move into the Gallery composition on scroll, then the supplied collage resolves over them.
- `public/models/model.glb` is the existing model copied unchanged from the original site's public assets.
- `public/logos/logo_transparent.png` is the exact existing logo copied unchanged.

The hero uses no supplied wallpaper image. Its original inline SVG cursor sculpture is authored in `src/components/HeroMotion.astro`, with faceted gold/coral planes and small pointer-driven transforms. It is brand illustration rather than a product recording. No Noomo imagery or logo was copied; the supplied Graffiti logo remains unchanged.

## Verified destinations

The original project did not contain a working installer URL or feedback endpoint. The Download section stays visibly pending rather than inventing a destination or version. Feedback is intentionally local-only and never displays a remote success state.
