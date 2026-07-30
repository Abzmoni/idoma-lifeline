/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "on-secondary-fixed-variant": "#3e4755",
        "surface-bright": "#fff8f6",
        "surface-container-highest": "#f7ddd4",
        "on-background": "#261913",
        "outline": "#CFCBC0", // Override for structural border
        "inverse-primary": "#ffb595",
        "surface": "#ffffff", // Standard card surface
        "secondary": "#565f6d",
        "surface-container-high": "#fce3d9",
        "secondary-fixed-dim": "#bec7d7",
        "error-container": "#ffdad6",
        "outline-variant": "#e1bfb2",
        "on-error-container": "#93000a",
        "inverse-surface": "#3c2d27",
        "on-secondary-fixed": "#131c28",
        "tertiary-container": "#0076d2",
        "tertiary-fixed": "#d4e3ff",
        "on-surface-variant": "#594137",
        "primary-container": "#c64f00",
        "on-error": "#ffffff",
        "on-primary-container": "#fffbff",
        "on-tertiary-fixed-variant": "#004883",
        "primary": "#E8600C", // Override for Signal Orange
        "primary-fixed-dim": "#ffb595",
        "tertiary-fixed-dim": "#a4c9ff",
        "inverse-on-surface": "#ffede7",
        "error": "#ba1a1a",
        "primary-fixed": "#ffdbcc",
        "secondary-fixed": "#dae3f4",
        "secondary-container": "#dae3f4",
        "on-secondary-container": "#5c6573",
        "surface-dim": "#eed5cb",
        "on-tertiary-fixed": "#001c39",
        "surface-variant": "#f7ddd4",
        "on-secondary": "#ffffff",
        "background": "#fff8f6",
        "surface-container-low": "#fff1ec",
        "on-tertiary-container": "#fdfcff",
        "tertiary": "#005da8",
        "surface-container": "#ffe9e1",
        "on-surface": "#261913",
        "on-tertiary": "#ffffff",
        "on-primary-fixed-variant": "#7c2e00",
        "surface-tint": "#a23f00",
        "surface-container-lowest": "#ffffff",
        "on-primary": "#ffffff",
        "on-primary-fixed": "#351000",
        "status-green": "#2E7D32",
        "shelter-brown": "#A85C32",
        "water-blue": "#1C6E8C",
        "medical-red": "#C4453C",
        "food-gold": "#C99A2E",
        "safe-green": "#1F8A78",
        "hazard-red": "#C4453C",
        "signal-orange": "#E8600C",
        "ink": "#1B2430",
        "cool-stone": "#F1F2EE",
        "border-grey": "#CFCBC0"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px",
        "none": "0px"
      },
      spacing: {
        "gutter": "16px",
        "base": "4px",
        "margin-desktop": "32px",
        "margin-mobile": "16px",
        "touch-target": "48px"
      },
      fontFamily: {
        "body-md": ["Public Sans", "sans-serif"],
        "data-sm": ["IBM Plex Mono", "monospace"],
        "headline-lg": ["Public Sans", "sans-serif"],
        "headline-sm": ["Public Sans", "sans-serif"],
        "headline-md": ["Public Sans", "sans-serif"],
        "body-lg": ["Public Sans", "sans-serif"],
        "data-lg": ["IBM Plex Mono", "monospace"],
        "label-caps": ["Public Sans", "sans-serif"]
      },
      fontSize: {
        "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
        "data-sm": ["13px", { "lineHeight": "18px", "fontWeight": "500" }],
        "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "headline-sm": ["20px", { "lineHeight": "28px", "fontWeight": "600" }],
        "headline-md": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
        "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "400" }],
        "data-lg": ["16px", { "lineHeight": "24px", "fontWeight": "500" }],
        "label-caps": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700" }]
      }
    }
  },
  plugins: [],
}
