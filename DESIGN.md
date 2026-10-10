---
name: Graffiti
description: Interactive desktop wallpaper engine with GPU-accelerated effects
colors:
  accent: "#D4A574"
  accent-hover: "#C4956A"
  accent-muted: "rgba(212, 165, 116, 0.15)"
  accent-border: "rgba(212, 165, 116, 0.3)"
  bg-base: "#111111"
  bg-surface: "#1A1918"
  bg-elevated: "#222120"
  bg-inset: "rgba(0, 0, 0, 0.3)"
  text-primary: "#F0ECE6"
  text-secondary: "#8A8580"
  text-tertiary: "#5A5550"
  danger: "#C45C5C"
  danger-hover: "#B04848"
  border-subtle: "rgba(255, 255, 255, 0.06)"
  border-hover: "rgba(255, 255, 255, 0.12)"
typography:
  display:
    fontFamily: "Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.8rem"
    fontWeight: 600
    lineHeight: 1
  title:
    fontFamily: "Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 500
    lineHeight: 1.4
    textTransform: "uppercase"
    letterSpacing: "0.08em"
rounded:
  lg: "10px"
  md: "8px"
  sm: "6px"
  xs: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "32px"
  content-padding: "32px 40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#1A1918"
    rounded: "{rounded.sm}"
    padding: "8px 18px"
  button-secondary:
    backgroundColor: "rgba(255, 255, 255, 0.04)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "8px 18px"
  button-danger:
    backgroundColor: "rgba(196, 92, 92, 0.12)"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
    padding: "8px 18px"
  card:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  sidebar:
    width: "52px"
    backgroundColor: "{colors.bg-surface}"
  effect-dial:
    diameter: "300px"
    nodeSize: "56px"
    centerSize: "120px"
---

# Design System: Graffiti

## Overview

**Creative North Star: "The Velvet Darkroom"**

Graffiti's interface is a warm, dark environment where content — wallpapers, 3D models, shader effects — takes center stage. The UI exists as a quiet, confident frame. The visual identity is built on a warm amber-gold accent (#D4A574) against near-black surfaces with warm undertones, creating a sophisticated feel that avoids the typical cyan/purple "tech demo" aesthetic.

The system uses the Windows native font stack (Segoe UI Variable) for seamless desktop integration. Hierarchy is established through weight variation and uppercase tracked labels rather than dramatic size changes. The layout uses a 52px icon-only sidebar for navigation, leaving maximum space for content.

The signature interaction is a **Circular Effect Dial** — 6 GPU effects positioned around a ring via CSS transforms, with a center hub showing the selected effect's name and status. This replaces the traditional card grid with a distinctive, spatially memorable selection mechanism.

**Key Characteristics:**
- Warm amber-gold (#D4A574) single accent against warm blacks
- Flat tonal stacking — surfaces differentiated by lightness, not blur or transparency
- Desktop-native sidebar navigation (icon-only, 52px width)
- Circular effect dial as the primary interaction
- Uppercase tracked labels for section headings
- System font stack for native feel

## Colors

The palette is monochromatic warm-dark with a single amber-gold accent. Every surface is a shade of warm near-black; color appears only as the accent, danger state, or semantic indicator.

### Primary
- **Amber Gold** (#D4A574): The sole accent color. Active navigation, primary buttons, slider thumbs, active borders, chip selections, and version badges.
- **Amber Hover** (#C4956A): Slightly deeper for hover states on primary buttons.
- **Amber Muted** (rgba(212, 165, 116, 0.15)): Low-opacity background for selected states, active chips, and badges.
- **Amber Border** (rgba(212, 165, 116, 0.3)): Accent-tinted borders for active cards and selected elements.

### Neutral
- **Base** (#111111): Root background. Warm near-black.
- **Surface** (#1A1918): Card and panel backgrounds. Warm dark with visible separation from base.
- **Elevated** (#222120): Dial nodes, hover states. One step lighter.
- **Inset** (rgba(0, 0, 0, 0.3)): Recessed areas — input backgrounds, settings rows.
- **Text Primary** (#F0ECE6): Warm off-white for headings and primary content.
- **Text Secondary** (#8A8580): Warm gray for descriptions and helper text.
- **Text Tertiary** (#5A5550): Muted for labels, placeholders, and disabled states.
- **Border** (rgba(255, 255, 255, 0.06)): Hairline borders. Barely visible.
- **Border Hover** (rgba(255, 255, 255, 0.12)): Slightly stronger on hover.

### Semantic
- **Danger** (#C45C5C): Muted red for destructive actions.
- **Warning** (#D4A060): Amber-tinted warning for resource alerts (WebView2 memory).

### Named Rules
**The One Accent Rule.** Only amber-gold appears as an accent. Danger red is semantic, not decorative.

## Typography

**System Font:** Segoe UI Variable → Segoe UI → system-ui → sans-serif

**Character:** The Windows system font stack provides native desktop feel without web-font loading. Weight variation (400 body, 500 labels, 600 headings) creates hierarchy. Uppercase tracked labels (0.08em) at small sizes act as section dividers.

### Hierarchy
- **Display** (600, 1.8rem): App name on About page.
- **Title** (600, 1.35rem, letter-spacing -0.01em): Page titles.
- **Body** (400, 0.85rem, line-height 1.5): Descriptions, settings text.
- **Label** (500, 0.7rem, uppercase, letter-spacing 0.08em): Section labels, control labels.
- **Micro** (500-700, 0.6rem): Dial labels, badge text, status indicators.

### Named Rules
**The Weight-Not-Size Rule.** Size differences between levels are small. Weight carries emphasis.

## Layout

The app uses a **fixed left sidebar + scrollable content area**. The sidebar is 52px wide with icon-only navigation, the brand logo at top, settings/about icons at bottom.

Content sits in a scrollable area with 32px vertical and 40px horizontal padding. No radial gradient or atmospheric effects — flat color.

Pages use these layouts:
- **Effects**: Single column — quality controls → circular dial → controls panel
- **Gallery**: Two-column — canvas left, inspector right, floating action bar
- **3D Wallpaper**: Single column, max-width 660px
- **Settings**: Single column, max-width 700px, stacked settings rows
- **About**: Centered column, max-width 480px

## Elevation & Depth

The system uses **flat tonal stacking** — no backdrop-blur, no glassmorphism, no box-shadow depth. Surfaces are differentiated purely by background lightness: base (#111) → surface (#1A1918) → elevated (#222120) → inset (rgba(0,0,0,0.3)).

The only visual elevation is the sidebar's right border (1px at 6% white opacity).

### Named Rules
**No Glow, No Blur.** Interactive feedback is communicated through color change (accent border, accent background), not through glow or shadow effects.

## Shapes

Radius hierarchy: 10px for cards, 8px for dial nodes and inset panels, 6px for buttons and inputs, 4px for badges. 50% for dial nodes (circles).

Borders are 1px at 6% white opacity. Active states use amber-tinted borders at 30% opacity.

## Components

### Buttons
- **Primary:** Amber-gold background, dark text (#1A1918), 600 weight. No glow, no shadow.
- **Secondary:** 4% white background, full text color, 6% white border. Border strengthens on hover.
- **Danger:** 12% red background, red text, 20% red border. Fills solid red on hover.
- **Ghost:** Transparent, secondary text color. For "Auto" and minor actions.
- **Toggle:** On/Off buttons. "On" uses amber muted bg + amber text + amber border. "Off" uses secondary styling.
- **Chip:** Grouped selectors (FPS, resolution). Active chip gets amber muted bg + amber text.

### Cards
- **Standard:** bg-surface background, 1px border at 6% white, 10px radius, 20px padding.
- **Inset:** bg-inset background, same border, 8px radius, 14px padding. For sub-sections within cards.
- **Active border:** Cards with selected content show amber-border (30% accent) instead of default border.

### Sidebar Navigation
- **Width:** 52px, bg-surface background, right border.
- **Brand:** 28px logo at top, 6px radius.
- **Links:** 36x36px circles, 8px radius. Icons at 18px. Tertiary color at rest, amber background on active.
- **Grouping:** Main nav (Effects, Gallery, 3D) at top; utility nav (Settings, About) at bottom.

### Circular Effect Dial (Signature Component)
A ring of 6 effect nodes positioned via CSS transforms at 60° intervals around a 300px diameter. Center hub (120px) shows selected effect name and running/ready status.

- **Ring:** 1px border circle, border-color at 6% white.
- **Nodes:** 56px circles, bg-elevated, 2px border. Selected: amber border + amber muted background. Active: amber border + 3px amber muted outer ring.
- **Labels:** Below each node, 0.6rem uppercase, tertiary color. Amber when selected/active.
- **Center:** bg-surface background, 1px border. Name in 0.75rem/600 weight. Status in 0.6rem uppercase.
- **Connectors:** 1px lines from center toward each node. Amber tint on active connector.

### Range Sliders
- **Track:** 4px height, 8% white background, 2px radius.
- **Thumb:** 14px circle, solid amber, 2px bg-base border. No glow.

### Settings Row
Horizontal layout: icon + label/description left, control right. Inset background, 8px radius, 12px vertical / 14px horizontal padding.

## Do's and Don'ts

### Do:
- **Do** use the amber-gold accent sparingly — interactive elements and active states only.
- **Do** maintain flat tonal stacking: base → surface → elevated → inset. No blur.
- **Do** use weight (400→500→600) and uppercase tracking as the primary differentiators.
- **Do** use the system font stack for native desktop feel.
- **Do** keep borders at 1px and very low opacity. Accent borders for active states only.

### Don't:
- **Don't** introduce cyan, purple, or any second accent hue.
- **Don't** use backdrop-blur, glassmorphism, or translucent panel backgrounds.
- **Don't** add box-shadow depth, glow effects, or hover transforms (translateY, scale).
- **Don't** use Inter or any web font — the system stack is intentional.
- **Don't** use light backgrounds. Content must always be the brightest element.
