/**
 * Design Tokens for FractaMind
 *
 * Central source of truth for colors, typography, spacing, motion, and other design primitives.
 * These tokens are used to maintain visual consistency across the application.
 *
 * Usage:
 * import { colors, typeScale, spacing } from './ui/design-tokens';
 *
 * Also exported as CSS custom properties in global.css for runtime theming.
 */

/**
 * Color palette
 * Inspired by twilight gradients and fractal aesthetics
 */
export const colors = {
  // Background gradients (twilight theme)
  bgGradientStart: '#667eea',  // Soft indigo
  bgGradientEnd: '#764ba2',    // Deep purple

  // Accent colors
  accent: '#667eea',           // Primary interactive color
  accentMuted: '#a5b4fc',      // Softer variant for hover states
  accentDark: '#4c51bf',       // Darker variant for active states

  // Text colors
  textPrimary: '#1f2937',      // Dark gray for body text
  textSecondary: '#6b7280',    // Medium gray for secondary text
  textMuted: '#9ca3af',        // Light gray for hints/labels
  textInverse: '#ffffff',      // White text on dark backgrounds

  // Semantic colors
  success: '#10b981',          // Green for success states
  successMuted: '#d1fae5',     // Light green background
  warning: '#f59e0b',          // Orange for warnings
  warningMuted: '#fef3c7',     // Light orange background
  error: '#ef4444',            // Red for errors
  errorMuted: '#fee2e2',       // Light red background
  info: '#3b82f6',             // Blue for informational states
  infoMuted: '#dbeafe',        // Light blue background

  // Neutral colors
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  black: '#000000',

  // Overlay & shadows
  overlayLight: 'rgba(0, 0, 0, 0.1)',
  overlayMedium: 'rgba(0, 0, 0, 0.3)',
  overlayDark: 'rgba(0, 0, 0, 0.6)',
  shadowSm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  shadowXl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

/**
 * Typography scale
 * Based on a modular scale for visual hierarchy
 */
export const typeScale = {
  // Font sizes
  h1: '48px',          // Hero headlines
  h2: '32px',          // Section titles
  h3: '24px',          // Subsection titles
  h4: '20px',          // Card titles
  body: '16px',        // Body text (base)
  bodyLarge: '18px',   // Large body text
  bodySmall: '14px',   // Small body text
  small: '12px',       // Labels, captions
  tiny: '10px',        // Fine print

  // Line heights
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,

  // Font weights
  weightLight: 300,
  weightNormal: 400,
  weightMedium: 500,
  weightSemibold: 600,
  weightBold: 700,

  // Font families
  fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontMono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
};

/**
 * Spacing scale
 * Powers margin, padding, and gap utilities
 * Based on 4px base unit
 */
export const spacing = {
  xs: 4,    // 4px
  sm: 8,    // 8px
  md: 16,   // 16px (base)
  lg: 24,   // 24px
  xl: 40,   // 40px
  xxl: 64,  // 64px
  xxxl: 96, // 96px
};

/**
 * Motion timing
 * Animation and transition durations in milliseconds
 */
export const motion = {
  instant: 0,      // No animation
  fast: 120,       // Quick interactions (hover, focus)
  normal: 240,     // Standard transitions
  slow: 400,       // Deliberate animations
  slower: 600,     // Page transitions

  // Easing curves
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy
};

/**
 * Border radius values
 * For consistent rounded corners
 */
export const radius = {
  none: 0,
  sm: 6,      // Subtle rounding
  md: 12,     // Standard rounding
  lg: 16,     // Prominent rounding
  xl: 24,     // Very rounded
  full: 9999, // Pill shape (fully rounded)
};

/**
 * Breakpoints for responsive design
 * Mobile-first approach
 */
export const breakpoints = {
  xs: 0,      // Extra small devices (phones, portrait)
  sm: 640,    // Small devices (phones, landscape)
  md: 768,    // Medium devices (tablets)
  lg: 1024,   // Large devices (desktops)
  xl: 1280,   // Extra large devices (wide desktops)
  xxl: 1536,  // Extra extra large devices
};

/**
 * Z-index scale
 * For consistent layering
 */
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
};

/**
 * Fractal-specific tokens
 * Design elements specific to the fractal visualization
 */
export const fractal = {
  // Node colors by depth
  depthColors: [
    '#667eea', // Depth 0 (root) - indigo
    '#a5b4fc', // Depth 1 - light indigo
    '#c7d2fe', // Depth 2 - lighter indigo
    '#e0e7ff', // Depth 3 - very light indigo
    '#f5f3ff', // Depth 4+ - almost white
  ],

  // Node sizes by depth
  nodeSizes: {
    root: 64,
    level1: 48,
    level2: 40,
    level3: 32,
    level4plus: 24,
  },

  // Animation timing for fractal growth
  growthDuration: 600,
  branchDelay: 100, // Delay between branches appearing

  // Connection line properties
  lineWidth: 2,
  lineColor: colors.gray300,
  lineColorActive: colors.accent,
};

/**
 * Export all tokens as a single object for convenience
 */
export const tokens = {
  colors,
  typeScale,
  spacing,
  motion,
  radius,
  breakpoints,
  zIndex,
  fractal,
};

/**
 * Generate CSS custom properties string
 * Can be injected into <style> tag or used in CSS-in-JS
 */
export function generateCSSVariables() {
  const vars = [];

  // Colors
  Object.entries(colors).forEach(([key, value]) => {
    vars.push(`--color-${camelToKebab(key)}: ${value};`);
  });

  // Type scale
  vars.push(`--font-sans: ${typeScale.fontSans};`);
  vars.push(`--font-mono: ${typeScale.fontMono};`);
  Object.entries(typeScale).forEach(([key, value]) => {
    if (key.startsWith('font') || key.startsWith('weight') || key.startsWith('lineHeight')) {
      vars.push(`--${camelToKebab(key)}: ${value};`);
    }
  });

  // Spacing
  Object.entries(spacing).forEach(([key, value]) => {
    vars.push(`--spacing-${key}: ${value}px;`);
  });

  // Motion
  Object.entries(motion).forEach(([key, value]) => {
    if (typeof value === 'number') {
      vars.push(`--motion-${key}: ${value}ms;`);
    } else {
      vars.push(`--motion-${camelToKebab(key)}: ${value};`);
    }
  });

  // Radius
  Object.entries(radius).forEach(([key, value]) => {
    vars.push(`--radius-${key}: ${value === 9999 ? '9999px' : `${value}px`};`);
  });

  // Z-index
  Object.entries(zIndex).forEach(([key, value]) => {
    vars.push(`--z-${camelToKebab(key)}: ${value};`);
  });

  return `:root {\n  ${vars.join('\n  ')}\n}`;
}

/**
 * Helper to convert camelCase to kebab-case
 */
function camelToKebab(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Default export for convenience
 */
export default tokens;
