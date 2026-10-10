# Design Map

## Spacing Scale
- Base unit: **8px**
- Scale: 4, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128px
- Section padding: 128px top, 96px bottom
- Button padding: 12px vertical, 32px horizontal
- Heading margins: h1 32px, h2 24px, h3 12px
- Footer: 64px top, 32px bottom
- Container horizontal padding: 48px

## Font Hierarchy
| Role | Size | Weight | Line-height | Family | Notes |
|------|------|--------|-------------|--------|-------|
| Hero (h1) | 128px | 500 | 1.0 | Bodoni Moda | Flush line-height, functions as graphic mark |
| h2 | 60px | 500 | 1.25 | Bodoni Moda | Letter-spacing: normal |
| h3 | 48px | 500 | 1.0 | Bodoni Moda | Letter-spacing: -1.2px (tracked tight) |
| Body large | 24px | 400 | 1.625 | General Sans | max-width: 672px |
| Body | 18px | 400 | -- | General Sans | |
| Caption | 14px | 400 | -- | General Sans | Also used for buttons (uppercase, 1.4px tracking) |
| Label | 12px | 400 | -- | General Sans | |
| Mono | -- | -- | -- | ui-monospace | Used on 5 elements |

## Color Palette
| Role | Value | Notes |
|------|-------|-------|
| Background | `#0b0a08` | Near-black, warm brown undertone. 79% area. |
| Surface raised | `#16130e` | Subtle section differentiation. 2.2% area. |
| Surface overlay | `rgba(11,10,8,0.94)` | Nav/fixed overlays. Same warm base. |
| Text primary | `#f5efe2` | Warm off-white. |
| Text secondary | `#a89c87` | Warm taupe. 28 elements. |
| Accent | `#c9a24d` | Muted gold. 5 elements only. |
| Accent muted | `rgba(212,175,106,0.25)` | Borders/hover states. Quarter opacity. |
| Border/rule | `#443e33` | Dark warm brown. Low-contrast dividers. |

## Image Ratios
| Usage | Ratio | Rendered size |
|-------|-------|---------------|
| Logo/monogram | 1:1 | 512px |
| Gallery hero | 1:1 | 629px |

## Component Tokens
- **Border radius**: 0px on all meaningful components (buttons, sections). 4px on small UI elements. Pill radius on decorative dots only.
- **Shadows**: None perceivable. Depth through opacity/color layering.
- **Buttons**: 14px, uppercase, letter-spacing 1.4px, padding 12px/32px, 0px radius, weight 400.
- **Grid**: No CSS Grid. Flexbox layout. Container max-width 1280px, 48px horizontal padding.
- **Motion**: Spatial transforms at 0.5s with overshoot easing `cubic-bezier(0.25, 1, 0.5, 1)`. Color/state at 0.15s standard. Dramatic entrance at 2.5s. `prefers-reduced-motion` respected.
- **Focus**: `:focus-visible` present (keyboard accessibility).

---

# Taste DNA

### Editorial Over Interface
- **Trigger**: When choosing a typographic identity for a GPU utility's marketing page...
- **Decision**: Chose Bodoni serif display + General Sans body pairing over the uniform geometric sans-serif that dominates developer-tool marketing.
- **Reason**: A wallpaper engine sells an aesthetic experience, not a workflow. The Bodoni communicates that the product cares about visual taste -- which is the product's core promise. A uniform sans-serif would position it as "another dev tool."
- **Evidence**: Bodoni Moda at 128px/500 for h1, 60px for h2, 48px for h3. General Sans at 24px/400 for body. Serif reserved for headings only -- never body text.

### Warm-Tinted Neutrals Over Pure Darks
- **Trigger**: When building a dark palette for a product that runs behind desktop icons all day...
- **Decision**: Tinted every neutral toward amber/brown (`#0b0a08`, `#a89c87`, `#443e33`, `#f5efe2`) and refused any pure gray -- accepting higher maintenance cost.
- **Reason**: Warm tinting prevents the cold-terminal feeling of pure dark UIs. Since the product lives on the desktop permanently, the palette must feel like a living room wall, not a code editor.
- **Evidence**: Background `#0b0a08` with visible brown undertone. Secondary text `#a89c87` (warm taupe). Zero pure grays in entire palette. Even overlays use `rgba(11,10,8,0.94)` -- same warm base with alpha.

### No Cards, No Shadows -- Trust the Padding
- **Trigger**: When organizing six effect showcases into a scrollable page...
- **Decision**: Refused card containers or box shadows, relying on 128px/96px section padding and background color shifts. Most product marketing pages would wrap each feature in a bordered/shadowed card.
- **Reason**: On a near-black surface, card borders create visual clutter rather than clarity. 128px of top padding gives enough silence between sections that the eye resets without needing container edges.
- **Evidence**: 0 cards detected. 0 perceivable shadows. Section padding 128px top / 96px bottom. Background shifts from `#0b0a08` to `#16130e` for subtle section differentiation.

### Gold Scarcity Over Gold Saturation
- **Trigger**: When gold (`#c9a24d`) is the only chromatic color in a warm-neutral palette...
- **Decision**: Restricted gold to 5 text elements and 25%-opacity borders, rather than saturating headings, backgrounds, or illustrations.
- **Reason**: If gold appeared everywhere it becomes neutral. By making gold rare, each gold element carries meaning -- "this is the thing worth looking at." The hero headline is off-white, not gold -- even the most prominent element stays restrained.
- **Evidence**: Gold `#c9a24d` on 5 text elements vs. warm taupe `#a89c87` on 28 elements. Accent borders at `rgba(212,175,106,0.25)`. Accent occupies <1% of page area.
