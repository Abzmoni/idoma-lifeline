---
name: Idoma Lifeline Civil Infrastructure
colors:
  surface: '#fff8f6'
  surface-dim: '#eed5cb'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ec'
  surface-container: '#ffe9e1'
  surface-container-high: '#fce3d9'
  surface-container-highest: '#f7ddd4'
  on-surface: '#261913'
  on-surface-variant: '#594137'
  inverse-surface: '#3c2d27'
  inverse-on-surface: '#ffede7'
  outline: '#8d7165'
  outline-variant: '#e1bfb2'
  surface-tint: '#a23f00'
  primary: '#9e3d00'
  on-primary: '#ffffff'
  primary-container: '#c64f00'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb595'
  secondary: '#565f6d'
  on-secondary: '#ffffff'
  secondary-container: '#dae3f4'
  on-secondary-container: '#5c6573'
  tertiary: '#005da8'
  on-tertiary: '#ffffff'
  tertiary-container: '#0076d2'
  on-tertiary-container: '#fdfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb595'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7c2e00'
  secondary-fixed: '#dae3f4'
  secondary-fixed-dim: '#bec7d7'
  on-secondary-fixed: '#131c28'
  on-secondary-fixed-variant: '#3e4755'
  tertiary-fixed: '#d4e3ff'
  tertiary-fixed-dim: '#a4c9ff'
  on-tertiary-fixed: '#001c39'
  on-tertiary-fixed-variant: '#004883'
  background: '#fff8f6'
  on-background: '#261913'
  surface-variant: '#f7ddd4'
typography:
  headline-lg:
    fontFamily: Public Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Public Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  data-lg:
    fontFamily: IBM Plex Mono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  data-sm:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-caps:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
spacing:
  base: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  touch-target: 48px
---

## Brand & Style

This design system is engineered for critical utility, drawing direct inspiration from international emergency signage, civil infrastructure, and humanitarian relief protocols (WHO/Red Cross). The aesthetic is strictly functional, prioritizing information density and rapid cognitive processing over decorative expression.

The visual style is **High-Contrast / Functional**, utilizing a "paper-and-ink" digital equivalent to ensure legibility under harsh sunlight or during high-stress situations. By removing all non-essential styling, the system reduces cognitive load, allowing users to focus entirely on resource navigation and safety data. 

**Core Principles:**
- **Utility over Aesthetics:** Every element must serve a functional purpose.
- **Civic Authority:** The interface should feel like an official, reliable government or NGO instrument.
- **Immediate Recognition:** Use of standardized symbols and high-contrast color-coding for instant identification of resource types.

## Colors

The palette is rooted in a neutral, non-reflective "cool stone-gray" background to minimize eye strain. The primary accent, Signal Orange, is reserved for high-priority actions and critical alerts.

**Resource Categorization:**
Color must always be paired with a distinct icon or shape to ensure accessibility for color-blind users.
- **Shelter (#A85C32):** Earth-toned brown for stability and housing.
- **Water (#1C6E8C):** Deep slate blue for hydration and sanitation.
- **Medical & Hazard (#C4453C):** High-visibility red for urgent care and danger zones.
- **Food (#C99A2E):** Ochre yellow for sustenance.
- **Safe Zone (#1F8A78):** Deep teal-green for security and clearance.

**Functional Grayscale:**
- **Background (#F1F2EE):** Dead-matte surface to prevent glare.
- **Ink (#1B2430):** High-contrast text for maximum readability.
- **Borders (#CFCBC0):** Structural definition without adding visual noise.

## Typography

The typography system uses two distinct families to separate narrative information from technical data.

- **Public Sans:** Used for all interface labels, instructions, and headlines. It provides a clean, neutral, and institutional feel that remains legible even at low resolutions.
- **IBM Plex Mono:** Strictly reserved for coordinates, timestamps, distance measurements, and technical identifiers. The monospaced nature ensures that numerical data is easy to scan and compare in tabular formats.

**Hierarchy Rules:**
- Use `headline-lg` only for page titles or critical status headers.
- Use `label-caps` for metadata categories (e.g., "LAST UPDATED", "DISTANCE").
- All body text should maintain a minimum weight of 400 to prevent font thinning on low-quality mobile displays.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a strict 4px baseline rhythm. Given the emergency nature of the system, all interactive elements must prioritize a minimum touch target of 48x48px to accommodate use with gloves or in shaky environments.

- **Mobile:** 4-column grid. Single column stacking for resource lists. Bottom-anchored navigation for one-handed use.
- **Desktop:** 12-column grid. Split-screen view: Map (8 cols) and Resource Directory (4 cols).
- **Margins:** Consistent 16px margins on mobile to maximize screen real estate, increasing to 32px on desktop for readability.

Gutters are kept tight (16px) to maintain a dense, "control panel" feel, ensuring as much data as possible is visible above the fold.

## Elevation & Depth

This design system avoids shadows to maintain a flat, printed-matter aesthetic that performs well on e-ink and low-end LCD screens. Depth is communicated through **Bold Borders** and **Tonal Layers**.

- **Level 0 (Background):** `#F1F2EE` (Cool Stone).
- **Level 1 (Cards/Containers):** White (`#FFFFFF`) with a 1px solid border of `#CFCBC0`.
- **Level 2 (Active/Critical):** Primary Orange `#E8600C` used as a thick 4px top border on cards to denote high-priority alerts.

Interactive states (hover/active) should use high-contrast color inversions (e.g., Ink background with White text) rather than soft shadows or blurs.

## Shapes

The shape language is strictly **Sharp (0px)**. Right angles reinforce the architectural and civic nature of the system. 

Circles are reserved exclusively for **Map Markers** and **Radio Buttons** to differentiate them from structural layout elements like buttons and containers. This "square-for-structure, circle-for-data" logic helps users quickly identify actionable navigation points on a complex map.

## Components

**Buttons:**
- **Primary:** Solid `#E8600C` (Signal Orange) with `#FFFFFF` text. All caps, bold weight.
- **Secondary:** Transparent background, 2px solid `#1B2430` (Ink) border.
- **Critical/Emergency:** Solid `#C4453C` (Medical Red).

**Inputs & Fields:**
- Rectangular with 1px `#CFCBC0` borders. 
- Labels must always be visible (no floating labels). 
- Focus states use a 2px inner stroke of Signal Orange.

**Cards:**
- Used for resource listings. Features a 1px border.
- Header area uses `data-sm` for coordinates and `headline-sm` for the resource name.
- Status indicators (Open/Closed) use a high-contrast pill format with the resource marker colors.

**Map Markers:**
- Must combine color + icon + unique shape-container (e.g., a square with a pointed bottom) to ensure accessibility. 
- Markers scale up by 20% when selected.

**Lists:**
- High-density rows separated by 1px horizontal lines. 
- Use IBM Plex Mono for all numerical list data (e.g., "2.4km", "14:02").