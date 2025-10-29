# FractaMind Design System

**Version**: 1.0.0
**Date**: 2025-10-29
**Status**: Implementation Complete

---

## Overview

The FractaMind Design System provides a comprehensive set of design tokens, components, and guidelines for building consistent, accessible, and delightful user experiences. The system follows the fractal metaphor at its core - recursive, self-similar patterns that scale elegantly.

### Design Principles

1. **Fractal Metaphor**: Recursive, self-similar patterns across all scales
2. **Privacy-First**: All design decisions support local-first architecture
3. **Accessibility**: WCAG 2.1 AA compliance minimum, AAA where feasible
4. **Performance**: CSS/SVG animations prioritized over JavaScript
5. **Progressive Enhancement**: Graceful degradation for older browsers
6. **Reduced Motion**: Respect `prefers-reduced-motion` media query

---

## Design Tokens

Design tokens are the atomic building blocks of the design system. They ensure consistency across the application.

### Location

- **Source**: [src/ui/design-tokens.js](../src/ui/design-tokens.js)
- **CSS Variables**: [src/styles/global.css](../src/styles/global.css)

### Token Categories

#### 1. Colors

**Primary Palette** (Twilight Gradient Theme):
```javascript
colors.bgGradientStart = '#667eea'  // Soft indigo
colors.bgGradientEnd = '#764ba2'    // Deep purple
colors.accent = '#667eea'           // Primary interactive
colors.accentMuted = '#a5b4fc'      // Hover states
colors.accentDark = '#4c51bf'       // Active states
```

**Text Colors**:
```javascript
colors.textPrimary = '#1f2937'      // Body text
colors.textSecondary = '#6b7280'    // Secondary text
colors.textMuted = '#9ca3af'        // Hints/labels
colors.textInverse = '#ffffff'      // On dark backgrounds
```

**Semantic Colors**:
```javascript
colors.success = '#10b981'          // Success states
colors.successMuted = '#d1fae5'     // Success backgrounds
colors.warning = '#f59e0b'          // Warnings
colors.warningMuted = '#fef3c7'     // Warning backgrounds
colors.error = '#ef4444'            // Errors
colors.errorMuted = '#fee2e2'       // Error backgrounds
colors.info = '#3b82f6'             // Info states
colors.infoMuted = '#dbeafe'        // Info backgrounds
```

**Usage**:
```css
/* CSS */
background: var(--color-accent);
color: var(--color-text-primary);

/* JavaScript */
import { colors } from './ui/design-tokens';
<div style={{ background: colors.accent }} />
```

#### 2. Typography

**Font Scale** (Modular scale, base 16px):
```javascript
typeScale.h1 = '48px'          // Hero headlines
typeScale.h2 = '32px'          // Section titles
typeScale.h3 = '24px'          // Subsection titles
typeScale.h4 = '20px'          // Card titles
typeScale.body = '16px'        // Base body text
typeScale.bodyLarge = '18px'   // Large body
typeScale.bodySmall = '14px'   // Small body
typeScale.small = '12px'       // Labels, captions
typeScale.tiny = '10px'        // Fine print
```

**Font Families**:
```javascript
typeScale.fontSans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...'
typeScale.fontMono = '"SF Mono", Monaco, "Cascadia Code", ...'
```

**Font Weights**:
```javascript
typeScale.weightLight = 300
typeScale.weightNormal = 400
typeScale.weightMedium = 500
typeScale.weightSemibold = 600
typeScale.weightBold = 700
```

**Line Heights**:
```javascript
typeScale.lineHeightTight = 1.2     // Headlines
typeScale.lineHeightNormal = 1.5    // Body text
typeScale.lineHeightRelaxed = 1.75  // Readable paragraphs
```

**Usage**:
```css
font-size: var(--font-size-h1);
font-family: var(--font-sans);
font-weight: var(--font-weight-semibold);
line-height: var(--line-height-relaxed);
```

#### 3. Spacing

**Spacing Scale** (Based on 4px unit):
```javascript
spacing.xs = 4      // 4px  - Tight spacing
spacing.sm = 8      // 8px  - Small gaps
spacing.md = 16     // 16px - Base spacing
spacing.lg = 24     // 24px - Section gaps
spacing.xl = 40     // 40px - Large sections
spacing.xxl = 64    // 64px - Hero sections
spacing.xxxl = 96   // 96px - Page sections
```

**Usage**:
```css
padding: var(--spacing-md);
margin: var(--spacing-lg) var(--spacing-xl);
gap: var(--spacing-sm);
```

#### 4. Motion

**Duration** (in milliseconds):
```javascript
motion.instant = 0       // No animation
motion.fast = 120        // Quick (hover, focus)
motion.normal = 240      // Standard transitions
motion.slow = 400        // Deliberate animations
motion.slower = 600      // Page transitions
```

**Easing Curves**:
```javascript
motion.easeIn = 'cubic-bezier(0.4, 0, 1, 1)'
motion.easeOut = 'cubic-bezier(0, 0, 0.2, 1)'
motion.easeInOut = 'cubic-bezier(0.4, 0, 0.2, 1)'
motion.easeSpring = 'cubic-bezier(0.34, 1.56, 0.64, 1)'  // Bouncy
```

**Usage**:
```css
transition: all var(--motion-fast) var(--motion-ease-out);
animation-duration: var(--motion-normal);
animation-timing-function: var(--motion-ease-spring);
```

#### 5. Border Radius

```javascript
radius.none = 0
radius.sm = 6       // Subtle rounding
radius.md = 12      // Standard rounding
radius.lg = 16      // Prominent rounding
radius.xl = 24      // Very rounded
radius.full = 9999  // Pill shape
```

#### 6. Breakpoints

**Mobile-First Approach**:
```javascript
breakpoints.xs = 0      // Extra small (phones, portrait)
breakpoints.sm = 640    // Small (phones, landscape)
breakpoints.md = 768    // Medium (tablets)
breakpoints.lg = 1024   // Large (desktops)
breakpoints.xl = 1280   // Extra large (wide desktops)
breakpoints.xxl = 1536  // Extra extra large
```

**Usage**:
```css
@media (max-width: 639px) { /* Mobile */ }
@media (min-width: 640px) { /* Tablet+ */ }
@media (min-width: 1024px) { /* Desktop+ */ }
```

#### 7. Z-Index Scale

**Layering System**:
```javascript
zIndex.base = 0
zIndex.dropdown = 100
zIndex.sticky = 200
zIndex.fixed = 300
zIndex.modalBackdrop = 400
zIndex.modal = 500
zIndex.popover = 600
zIndex.tooltip = 700
zIndex.toast = 800
```

---

## Components

### Core Components

#### 1. Hero

**Location**: [src/components/Hero/](../src/components/Hero/)

**Purpose**: Full-bleed hero section with twilight gradient background.

**Anatomy**:
- Left: Headline + subhead + CTAs + privacy badge
- Right: Animated FractalSeed preview

**Props**:
```typescript
interface HeroProps {
  onStartImport?: (result: ImportResult) => void;
  onDemoStart?: () => void;
  demoMode?: boolean;
}
```

**Usage**:
```jsx
<Hero
  onStartImport={(result) => console.log('Import complete', result)}
  onDemoStart={() => console.log('Demo started')}
  demoMode={true}
/>
```

**Responsive Behavior**:
- Desktop (1024px+): 60vh height, side-by-side layout
- Tablet (640-1023px): 50vh height, stacked layout
- Mobile (<640px): 45vh height, visual above content

**Accessibility**:
- `role="banner"` on hero section
- `aria-labelledby` referencing hero title
- All CTAs have accessible names
- Privacy badge has `aria-label` for screen readers

#### 2. FractalSeed

**Location**: [src/components/FractalSeed/](../src/components/FractalSeed/)

**Purpose**: Animated SVG visualization that grows from dot → branches → 6-node fractal.

**Props**:
```typescript
interface FractalSeedProps {
  size?: number;              // Default: 200
  color?: string;             // Default: '#667eea'
  animationDelay?: number;    // Default: 0 (ms)
  reducedMotion?: boolean;    // Default: auto-detect
  autoPlay?: boolean;         // Default: true
  onComplete?: () => void;
}
```

**Animation**:
- **Branches**: CSS `stroke-dashoffset` animation (0 → length)
- **Nodes**: CSS `transform: scale(0 → 1.2 → 1)` with opacity fade-in
- **Glow**: Radial gradient with pulse animation
- **Duration**: 1200ms normal, 100ms reduced motion

**Usage**:
```jsx
<FractalSeed
  size={280}
  color="#ffffff"
  animationDelay={300}
  onComplete={() => console.log('Animation complete')}
/>
```

**Accessibility**:
- `role="img"` with descriptive `aria-label`
- `aria-live="polite"` for state announcements
- Screen reader text: "Fractal seed idle" → "growing" → "ready"

#### 3. OnboardPopover

**Location**: [src/components/OnboardPopover/](../src/components/OnboardPopover/)

**Purpose**: Modal dialog for document import and onboarding flow.

**Features**:
- Textarea for pasting content
- ExamplesCarousel for quick-start samples
- ToneSelector for personalization
- Demo mode with mock processing
- Real import integration

**Props**:
```typescript
interface OnboardPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: ImportResult) => void;
  demoMode?: boolean;         // Default: true
  onImport?: (text: string, options: ImportOptions) => Promise<ImportResult>;
}
```

**Processing Flow**:
1. Analyzing document... (800ms)
2. Summarizing... (1200ms) + FractalSeed animation
3. Embedding... (1000ms) + FractalSeed continues
4. Complete! (500ms)
5. Call `onSuccess` with result

**Usage**:
```jsx
<OnboardPopover
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onSuccess={(result) => handleImportSuccess(result)}
  demoMode={true}
/>
```

**Accessibility**:
- `role="dialog"` with `aria-modal="true"`
- `aria-labelledby` referencing dialog title
- Escape key to close
- Backdrop click to close
- Focus trap within modal
- Auto-focus textarea on open

#### 4. ToneSelector

**Location**: [src/components/ToneSelector/](../src/components/ToneSelector/)

**Purpose**: Allow users to select content tone preference.

**Options**:
- **Concise**: Quick summaries, essential points only
- **Deep**: Detailed analysis with context
- **Creative**: Engaging, narrative style

**Props**:
```typescript
interface ToneSelectorProps {
  defaultTone?: 'concise' | 'deep' | 'creative';  // Default: 'concise'
  onChange?: (tone: string) => void;
  showDescription?: boolean;                       // Default: true
}
```

**Persistence**:
- Saves to localStorage: `fractamind:tone-preference`
- Emits custom event: `window.dispatchEvent('tone:changed', { detail: { tone } })`

**Usage**:
```jsx
<ToneSelector
  defaultTone="concise"
  onChange={(tone) => console.log('Tone changed:', tone)}
  showDescription={true}
/>
```

**Accessibility**:
- `role="radiogroup"` for button group
- Each button has `role="radio"` with `aria-checked`
- Arrow key navigation (Left/Right/Up/Down)
- Wrap-around navigation
- Only selected button is `tabIndex="0"`
- Screen reader announcement on change

#### 5. ExamplesCarousel

**Location**: [src/components/ExamplesCarousel/](../src/components/ExamplesCarousel/)

**Purpose**: Display example quick-pastes for different user personas.

**Examples**:
- **Student** 📚: Study notes and learning materials
- **Founder** 🚀: Business plans and strategy docs
- **Journalist** 📰: Research and investigation notes

**Props**:
```typescript
interface ExamplesCarouselProps {
  onExampleSelect: (example: Example) => void;
}

interface Example {
  id: string;
  title: string;
  description: string;
  content: string;
  icon: string;
}
```

**Usage**:
```jsx
<ExamplesCarousel
  onExampleSelect={(example) => {
    setText(example.content);
    console.log('Selected:', example.title);
  }}
/>
```

**Accessibility**:
- `role="region"` with `aria-labelledby`
- `role="list"` for grid, `role="listitem"` for cards
- `tabIndex="0"` for keyboard navigation
- Enter/Space to select
- Screen reader announcement on selection

---

## Microcopy Guidelines

### Voice & Tone

- **Friendly but Professional**: Approachable without being overly casual
- **Clear and Concise**: Short sentences, active voice
- **Empowering**: Focus on user capabilities, not limitations
- **Privacy-Conscious**: Reinforce local-first architecture

### Examples

**Good**:
- "Paste text or URL to begin"
- "Nice — your idea map is ready."
- "Processing stays on-device"

**Avoid**:
- "Please paste your text here and then click the button below to continue"
- "Your amazing idea map has been successfully created!"
- "Don't worry, your data is safe"

### Key Phrases

| Context | Copy |
|---------|------|
| Success | "Nice — your idea map is ready." |
| Processing | "Growing ideas — one branch at a time." |
| Privacy | "Processing stays on-device" |
| Empty State | "No projects yet. Import a document to get started." |
| Error | "Something went wrong. Please try again." |
| Loading | "Analyzing document..." |

### Accessibility Labels

- **Be Specific**: "Close onboarding dialog" not "Close"
- **Include Context**: "Concise: Quick summaries, essential points only"
- **Announce State Changes**: "Selected tone: Deep"

---

## Animation Guidelines

### Principles

1. **Purposeful**: Every animation should have a reason
2. **Subtle**: Enhance, don't distract
3. **Performant**: CSS/SVG over JavaScript
4. **Respectful**: Honor `prefers-reduced-motion`

### Standard Patterns

#### Fade In
```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.element {
  animation: fade-in var(--motion-normal) var(--motion-ease-out);
}
```

#### Slide Up
```css
@keyframes slide-up {
  from {
    transform: translateY(40px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal {
  animation: slide-up var(--motion-normal) var(--motion-ease-out);
}
```

#### Scale In
```css
@keyframes scale-in {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.node {
  animation: scale-in var(--motion-fast) var(--motion-ease-spring);
}
```

### Reduced Motion

**Always include**:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Component-specific**:
```css
@media (prefers-reduced-motion: reduce) {
  .fractal-seed {
    animation: none;
  }

  .hero-seed-wrapper {
    animation: none; /* Disable floating effect */
  }
}
```

---

## Accessibility Checklist

### Color Contrast

- ✅ **AA Minimum**: 4.5:1 for normal text, 3:1 for large text
- ✅ **AAA Goal**: 7:1 for normal text, 4.5:1 for large text

**Test**:
```bash
# Use Chrome DevTools Lighthouse or axe DevTools
npm run test:axe
```

### Keyboard Navigation

- ✅ **Tab Order**: Logical flow through interactive elements
- ✅ **Focus Visible**: Clear focus indicators (2px outline, 2px offset)
- ✅ **Escape Key**: Close modals/popovers
- ✅ **Arrow Keys**: Navigate radio groups, carousels
- ✅ **Enter/Space**: Activate buttons

### Screen Readers

- ✅ **Semantic HTML**: Use `<button>`, `<nav>`, `<main>`, etc.
- ✅ **ARIA Labels**: `aria-label`, `aria-labelledby`, `aria-describedby`
- ✅ **Live Regions**: `aria-live="polite"` for dynamic content
- ✅ **Roles**: `role="dialog"`, `role="radiogroup"`, etc.
- ✅ **States**: `aria-checked`, `aria-expanded`, `aria-selected`

### Testing

```bash
# Automated tests
npm run test:axe

# Manual tests
# 1. Navigate with Tab key only
# 2. Use screen reader (macOS VoiceOver, NVDA, JAWS)
# 3. Test with keyboard only (no mouse)
# 4. Enable high contrast mode
# 5. Increase text size to 200%
```

---

## Usage Examples

### Example 1: Button with Hover Effect

```jsx
<button
  className="custom-button"
  aria-label="Import document"
>
  Import
</button>
```

```css
.custom-button {
  padding: var(--spacing-md) var(--spacing-xl);
  background: var(--color-accent);
  color: var(--color-white);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--motion-fast) var(--motion-ease-out);
  box-shadow: var(--shadow-sm);
}

.custom-button:hover:not(:disabled) {
  background: var(--color-accent-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.custom-button:active:not(:disabled) {
  transform: translateY(0);
}

.custom-button:focus-visible {
  outline: 2px solid var(--color-white);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .custom-button:hover:not(:disabled) {
    transform: none;
  }
}
```

### Example 2: Card with Gradient Background

```jsx
<div className="gradient-card" role="article">
  <h3>Fractal Node</h3>
  <p>This is a node in your knowledge fractal.</p>
</div>
```

```css
.gradient-card {
  padding: var(--spacing-lg);
  background: linear-gradient(
    135deg,
    var(--color-bg-gradient-start) 0%,
    var(--color-bg-gradient-end) 100%
  );
  border-radius: var(--radius-lg);
  color: var(--color-white);
  box-shadow: var(--shadow-md);
  transition: transform var(--motion-fast) var(--motion-ease-out);
}

.gradient-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.gradient-card h3 {
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  margin-bottom: var(--spacing-sm);
}

.gradient-card p {
  font-size: var(--font-size-body);
  line-height: var(--line-height-relaxed);
  opacity: 0.95;
}
```

---

## Resources

### Documentation
- [Design Tokens](../src/ui/design-tokens.js)
- [Global CSS](../src/styles/global.css)
- [i18n Strings](../src/i18n/strings.js)

### External References
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design Motion](https://m3.material.io/styles/motion/overview)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Inclusive Components](https://inclusive-components.design/)

### Tools
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [Chrome Lighthouse](https://developers.google.com/web/tools/lighthouse)

---

## Changelog

### Version 1.0.0 (2025-10-29)
- Initial release
- Design tokens system (colors, typography, spacing, motion)
- Core components (Hero, FractalSeed, OnboardPopover, ToneSelector, ExamplesCarousel)
- Comprehensive accessibility support
- Reduced motion support
- i18n strings system
- Full test coverage

---

**Maintained by**: FractaMind Team
**Last Updated**: 2025-10-29
