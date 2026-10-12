---
name: Graffiti Transmission
description: Retro-futurist brutalist product site for responsive Windows wallpapers
colors:
  void: "#0c0d0c"
  void-soft: "#161816"
  gold: "#d6aa4a"
  gold-light: "#f0cf75"
  ivory: "#f7efd9"
  muted: "#a49b87"
  coral: "#ef634d"
  line: "#3c3d35"
typography:
  display:
    fontFamily: "Arial Narrow, Franklin Gothic Medium, Arial Black, Arial, sans-serif"
    fontSize: "clamp(54px, 6.6vw, 106px)"
    fontWeight: 900
    lineHeight: 0.84
    letterSpacing: "-0.065em"
  body:
    fontFamily: "Cascadia Mono, SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Cascadia Mono, SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.12em"
    textTransform: "uppercase"
rounded:
  none: "0px"
spacing:
  rail: "52px"
  section: "132px 52px 164px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.void}"
    rounded: "{rounded.none}"
    padding: "13px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ivory}"
    rounded: "{rounded.none}"
    padding: "13px 18px"
---

# Design System: Graffiti Transmission

## Overview

**Creative North Star: “The Desktop Transmission”**

The page treats Graffiti as a signal arriving from a local machine: black void, warm gold logo, ivory transmission text, and a coral status light. The visual language is retro-futurist brutalism, built from hard edges, visible structure, clipped metadata, and one deliberate motion response. The exact Graffiti logo is the hero's first visual event. Beside it, an original dimensional cursor illustration floats over layered gold-and-coral planes. It is a brand illustration, not a simulated product effect; the real recordings follow in the Effects section.

Sections move from the kinetic cursor artwork to a real effect queue, the Gallery composition board, a Web Wallpaper viewport, and the utility modules. There is no stock photo in the hero. The layered cursor uses inline SVG and bounded, pointer-driven transforms, with a static reduced-motion and touch presentation.

**Key Characteristics:**
- Exact gold Graffiti logo oversized in the first viewport.
- Near-black void with logo gold, warm ivory, muted telemetry, and coral status.
- Condensed heavy sans display type paired with compact monospace telemetry.
- Square panels, 2px structural rules, and restrained hard-offset shadows.
- A single event-driven scanline sweep for button hover/focus.

## Colors

The palette is derived from the supplied logo's antique gold and its black field; coral is reserved for live or attention states.

### Primary
- **Logo Gold** (#d6aa4a): primary action fill, active effect state, cursor artwork, and model framing.
- **Signal Gold** (#f0cf75): emphasized text and readable gold-on-black details.

### Secondary
- **Status Coral** (#ef634d): live indicators, queue activity, the cursor artwork's rear plane, and WebView labeling.

### Neutral
- **Transmission Void** (#0c0d0c): page ground and header rail.
- **Soft Void** (#161816): stage surfaces and inactive queue rows.
- **Warm Ivory** (#f7efd9): primary readable text and high-contrast rules.
- **Telemetry Muted** (#a49b87): supporting copy and non-active metadata.
- **Structural Line** (#3c3d35): low-emphasis dividers.

### Named Rules
**The Gold Signal Rule.** Gold is the product signal: use it for actions, active states, and real media framing rather than filling every surface.

## Typography

**Display Font:** Arial Narrow / Franklin Gothic Medium / Arial Black fallback stack.

**Body and telemetry:** Cascadia Mono / SFMono-Regular / Consolas fallback stack.

**Character:** The display stack is compressed, heavy, and declarative; the monospace layer reads like a local diagnostic feed. The pairing makes the page feel like a working system rather than a brochure.

### Hierarchy
- **Display** (900, `clamp(54px, 6.6vw, 106px)`, `.84`): hero and section statements.
- **Title** (900, `clamp(50px, 6vw, 92px)`, `.84`): model module titles. Gallery uses `clamp(44px, 4.4vw, 64px)` with `.95` line-height to keep its explanation distinct from the composition.
- **Body** (400, `13px`, `1.7`): product explanations and utility copy.
- **Label** (400, `10px`, `.12em`, uppercase): navigation, telemetry, section indexes, state readouts.

### Named Rules
**The Signal Hierarchy Rule.** Display type names the action; monospace type explains the state. Do not use an eyebrow to carry essential meaning that a heading cannot carry.

## Layout

The page uses a max-width 1440px broadcast canvas with a 68px signal rail. The opening is a two-column grid: oversized logo and action on the left, dimensional cursor illustration on the right. The effects module switches to a live stage plus a vertical queue. Gallery uses a sticky two-column composition with separate copy and media areas, becoming a vertical stack below 920px. The model module uses a copy/viewport split. Download and feedback use three-column utility rows on desktop and stack into single-column modules below 920px.

The primary desktop side padding is 52px. Mobile uses 22px content padding, keeps the logo large, collapses the effect queue to full width, and preserves the Gallery composition as the primary visual. The cursor artwork's link has its own bottom row on smaller screens.

## Elevation & Depth

The hero's depth comes from authored SVG facets and three separate planes, not a bordered card. Limited hard-offset shadows remain part of the brutalist media language: `14px 14px 0 #0c0d0c` for the Gallery composition and a coral offset for the model viewport. There is no backdrop blur or ambient shadow system.

## Shapes

All primary controls, panels, and sections use square corners (`0px`). Borders are 1–2px and explain structure. The cursor artwork uses deliberately faceted geometry; the Gallery stamp is a small physical mark rather than a container.

## Components

### Buttons
- **Shape:** square, no radius (`0px`).
- **Primary:** logo gold fill, void text, 2px gold border, `13px 18px` padding.
- **Hover / Focus:** warm-gold shift plus one 760ms stepped scanline sweep; never loops automatically.
- **Ghost:** transparent with a structural-line border, muted text, and the same action-triggered sweep.

### Effect Queue
- **Style:** full-width text rows with number, name, and arrow; no nested card shells.
- **State:** the active row uses a soft-void fill, brighter text, and a clear gold arrow; hover motion is clipped within each row.
- **Performance:** only the selected recording is mounted after the effect section enters the viewport.

### Media Stages
- **Effect stage:** 2px ivory frame with crosshair and live status label.
- **Gallery composition:** gold field, black frame, and four source images that transform into the supplied collage. Product copy explains custom shapes filled with images or solid colors, rather than narrating the website animation.
- **3D viewport:** gold frame, coral hard-offset shadow, fixed 3.8m radius, pointer-driven yaw/pitch only with horizontal input mapped in the expected screen direction.
- **Web Wallpaper note:** explains the embedded WebView and potential RAM/GPU cost relative to native image effects, without benchmark claims or camera telemetry in the explanatory copy.

### Kinetic Cursor Artwork
- Original inline SVG in `src/components/HeroMotion.astro`; no replacement logo, wallpaper photo, or extra rendering engine.
- Faceted gold cursor above a coral sheet, wire plane, and gold contour sheet.
- Pointer events update two CSS variables through a single scheduled frame; CSS transforms move the separate layers by small, bounded amounts.
- No perpetual render loop. Touch and reduced-motion visitors get the static artwork and the same working link to Effects.

### Inputs / Fields
- **Style:** transparent fields with 2px bottom rules, monospace labels, and no rounded shells.
- **Focus:** gold rule and visible gold outline.
- **Status:** local feedback explicitly says it was saved in this browser and makes no remote-success claim.

### Navigation

The signal rail uses a concise brand lockup, local status indicator, sparse section links, and one action. Links collapse at 920px while the action remains available.

## Do's and Don'ts

- **Do** keep the exact logo large and visible before the first scroll.
- **Do** use gold where the user can act or where real media is being framed.
- **Do** preserve the queue order: Cursor reveal, Glass lens, Depth parallax, Gravity lens, Brick outline, Space ball.
- **Do** keep the model's camera radius fixed; use public copy to explain Web Wallpaper's WebView rendering and resource trade-off.
- **Do** provide visible focus states and a reduced-motion path.
- **Don't** reintroduce luxury serif typography, rounded cards, glassmorphism, or gradient text.
- **Don't** autoplay all six videos; mount the selected recording only.
- **Don't** show a download success or feedback success claim without a real destination.
- **Don't** use continuous button animation; the scanline is user-triggered.
