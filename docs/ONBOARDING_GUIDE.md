# FractaMind Onboarding Guide

**Version**: 1.1.0
**Last Updated**: 2025-11-06
**Target Audience**: New users, developers implementing onboarding flows

---

## Overview

FractaMind's onboarding experience is designed to minimize friction and maximize user success. The flow emphasizes:

1. **Low Commitment**: Start with just text or a URL
2. **Quick Wins**: See results in under 2 minutes
3. **Privacy-First**: Clear messaging about local processing
4. **Accessibility**: Full keyboard navigation and screen reader support
5. **Contextual Help**: Helper chips, keyboard shortcuts, and progress feedback

---

## User Journey

### Step 1: Hero Section

**Location**: Homepage (`/`)

**First Impression**:
- Hero title: "Explore ideas like a fractal"
- Subtitle: "Turn any text into an interactive, zoomable map of knowledge. Privacy-first — runs on your device."
- Privacy badge: "All processing happens locally in your browser — private & offline by default."

**Call-to-Action**:
- Primary CTA: "Paste text or URL to begin" (opens OnboardPopover)
- Secondary CTA: "See demo" (opens OnboardPopover with demo content)

**Animations**:
- Staggered fade-in (title → subtitle → privacy badge)
- Animated SeedFractal background (gentle pulse, rotating rings)
- Hover effects on CTAs (lift and scale)

**Key Messaging**:
- Emphasize privacy and local processing
- Show visual fractal metaphor with animated SeedFractal
- Low barrier to entry ("paste text or URL")

---

### Step 2: OnboardPopover Modal

**Trigger**: Click "Paste text or URL to begin" or "See demo"

**Purpose**: Collect user input and initiate document processing

#### UI Elements

1. **Title**: "Start Your Knowledge Fractal"

2. **Textarea** (with floating label):
   - Label: "Paste text, an article, or a URL to explore:"
   - Placeholder: Shows when focused:
     ```
     Paste your content here... (up to ~10,000 words)

     Examples:
     • Copy/paste an article or research paper
     • Drop a URL to extract text
     • Enter your notes or brainstorm ideas
     ```
   - Floating label: Moves to top when focused or filled
   - Character limit: ~10,000 words

3. **Helper Chips** (shown when textarea is empty):
   - "Paste an article"
   - "URL"
   - "Notes"
   - Purpose: Contextual suggestions to guide user
   - Fade out when user starts typing

4. **Keyboard Hint** (shown below textarea):
   - Visual: `Ctrl` + `Enter` to generate (on Windows/Linux)
   - Visual: `Cmd` + `Enter` to generate (on Mac)
   - Uses semantic `<kbd>` elements
   - Screen reader accessible

5. **Privacy Hint** (below keyboard hint):
   - "All processing happens locally in your browser. Your data never leaves your device."
   - Distinct styling with left border accent
   - Reinforces privacy messaging

6. **ExamplesCarousel** (optional, below textarea):
   - Quick-start samples for different personas:
     - 📚 Student: Study notes
     - 🚀 Founder: Business plan
     - 📰 Journalist: Research article
   - Click to populate textarea
   - Allows users to try immediately without preparing content

7. **ToneSelector** (optional, below examples):
   - Concise: Quick summaries, essential points only
   - Deep: Detailed analysis with context
   - Creative: Engaging, narrative style
   - Persisted to localStorage
   - Keyboard accessible (arrow keys)

8. **Submit Button**:
   - Default state: "Generate Fractal"
   - Submitting state: "Processing..."
   - Disabled when textarea empty

#### Keyboard Shortcuts (NEW in v1.1)

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Ctrl+Enter` (Windows/Linux) | Submit form | Only when textarea has content |
| `Cmd+Enter` (Mac) | Submit form | Only when textarea has content |
| `Escape` | Close modal | Works at any time |
| `Tab` | Navigate elements | Logical tab order maintained |
| `Shift+Tab` | Navigate backwards | Reverse tab order |
| Arrow keys | Navigate ToneSelector | When focused on tone buttons |

**Best Practices**:
- Always show visual keyboard hints (don't hide for "advanced" users)
- Use semantic `<kbd>` elements for screen reader support
- Test keyboard shortcuts on Windows, Mac, and Linux

#### Accessibility Features (Enhanced in v1.1)

1. **Floating Label Pattern**:
   - WCAG 2.1 compliant
   - Label always visible (never hidden)
   - Smooth transition on focus/fill
   - Clear visual hierarchy

2. **aria-live Region**:
   - Announces progress without interrupting user
   - `aria-live="polite"` (non-intrusive)
   - `aria-atomic="true"` (reads entire message)
   - Screen reader only (visually hidden)

   **Announcements**:
   - Progress: "Analyzing document — this may take up to 2 minutes. All processing happens locally."
   - Success: "Analysis complete — fractal ready."
   - Fallback: "AI not reachable — using local demo summary to continue."

3. **aria-describedby Links**:
   - Textarea linked to:
     - Helper hint (examples and word limit)
     - Keyboard hint (Ctrl+Enter shortcut)
     - Privacy hint (local processing message)
   - Provides full context for screen reader users

4. **Focus Management**:
   - Auto-focus textarea on modal open
   - Focus trap within modal (Tab doesn't escape)
   - Restore focus to trigger button on close
   - Visible focus indicators using `--focus-ring` token

5. **Keyboard Navigation**:
   - All interactive elements keyboard accessible
   - Logical tab order
   - Enter/Space to activate buttons
   - Escape to close modal

6. **Screen Reader Compatibility**:
   - Tested with NVDA (Windows), VoiceOver (Mac), JAWS
   - Semantic HTML (`<button>`, `<label>`, `<dialog>`)
   - Clear aria-labels and roles

---

### Step 3: Processing Flow

**Duration**: 30 seconds to 2 minutes (depending on document size and AI availability)

**Visual Feedback**:
1. Modal backdrop blur intensifies (4px → 8px)
2. FractalSeed animation plays (growing branches)
3. Progress messages update sequentially:
   - "Analyzing document..."
   - "Summarizing..."
   - "Generating embeddings..."
   - "Complete!"

**aria-live Announcements**:
- Start: "Analyzing document — this may take up to 2 minutes. All processing happens locally."
- Success: "Analysis complete — fractal ready."
- Fallback (if AI unavailable): "AI not reachable — using local demo summary to continue."

**Timeout Handling**:
- If AI takes longer than expected, show fallback button:
  - "AI taking longer — Continue with demo summary"
- Allows user to proceed without blocking
- Maintains positive experience even if AI fails

---

### Step 4: Success & Transition

**Success State**:
- Message: "Nice — your idea map is ready."
- FractalSeed animation completes
- Modal closes automatically after 500ms delay

**Transition**:
- Fade out modal
- Navigate to Fractal Canvas view
- Show fractal visualization with root node expanded

**First-Time User Tour** (optional, future enhancement):
- 3-step tooltip tour:
  1. "Zoom & Navigate" (pinch/scroll to zoom, drag to pan)
  2. "Expand Nodes" (click nodes to grow children)
  3. "Search & Save" (semantic search, export to JSON/Markdown)

---

## Implementation Details

### Components

- **Hero**: [src/components/Hero/Hero.jsx](../src/components/Hero/)
- **OnboardPopover**: [src/components/OnboardPopover/OnboardPopover.jsx](../src/components/OnboardPopover/)
- **ExamplesCarousel**: [src/components/ExamplesCarousel/ExamplesCarousel.jsx](../src/components/ExamplesCarousel/)
- **ToneSelector**: [src/components/ToneSelector/ToneSelector.jsx](../src/components/ToneSelector/)
- **FractalSeed**: [src/components/FractalSeed/FractalSeed.jsx](../src/components/FractalSeed/)

### Strings & Microcopy

All onboarding copy is centralized in [src/i18n/strings.js](../src/i18n/strings.js):

```javascript
strings.hero = {
  title: 'Explore ideas like a fractal',
  subtitle: 'Turn any text into an interactive, zoomable map of knowledge. Privacy-first — runs on your device.',
  ctaPrimary: 'Paste text or URL to begin',
  ctaSecondary: 'See demo',
  privacyBadge: 'All processing happens locally in your browser — private & offline by default.',
};

strings.onboard = {
  title: 'Start Your Knowledge Fractal',
  textareaLabel: 'Paste text, an article, or a URL to explore:',
  helperHint: 'Examples: copy/paste an article, drop a URL, or paste notes. Max ~10,000 words.',
  keyboardHint: 'Press Ctrl+Enter to generate',
  privacyHint: 'All processing happens locally in your browser. Your data never leaves your device.',
  progressAnnouncement: 'Analyzing document — this may take up to 2 minutes. All processing happens locally.',
  successAnnouncement: 'Analysis complete — fractal ready.',
  fallbackAnnouncement: 'AI not reachable — using local demo summary to continue.',
  submitButton: 'Generate Fractal',
  submittingButton: 'Processing...',
};
```

**Why Centralized**:
- Easy to update copy without touching components
- Future i18n support (translations)
- Consistent messaging across the app
- A/B testing copy variations

---

## Copy Guidelines

### Voice & Tone

- **Friendly but Professional**: Approachable without being overly casual
- **Clear and Concise**: Short sentences, active voice
- **Empowering**: Focus on user capabilities ("Explore", "Turn into", "Start")
- **Privacy-Conscious**: Reinforce local-first architecture repeatedly

### Key Principles

1. **Reduce Uncertainty**: Tell users what will happen ("this may take up to 2 minutes")
2. **Emphasize Privacy**: Repeat "local processing" message throughout
3. **Show Progress**: Never leave users wondering if something is happening
4. **Provide Examples**: Concrete suggestions beat abstract instructions
5. **Use Active Voice**: "Generate Fractal" not "Fractal will be generated"

### Examples

**Good**:
- ✅ "Paste text or URL to begin"
- ✅ "Analyzing document — this may take up to 2 minutes"
- ✅ "All processing happens locally in your browser"
- ✅ "Press Ctrl+Enter to generate"

**Avoid**:
- ❌ "Click here to start" (vague)
- ❌ "Please wait while we process your document" (implies cloud processing)
- ❌ "You can use the keyboard shortcut Ctrl+Enter if you want" (too wordy)
- ❌ "Don't worry, your data is safe" (defensive, raises concerns)

---

## User Testing Checklist

### Functional Testing

- [ ] Hero section loads with animations
- [ ] Primary CTA opens OnboardPopover
- [ ] Secondary CTA opens OnboardPopover with demo content
- [ ] Textarea accepts paste input (text and URLs)
- [ ] Floating label moves to top when focused
- [ ] Helper chips disappear when user types
- [ ] Keyboard shortcut (Ctrl+Enter) submits form
- [ ] Escape key closes modal
- [ ] ExamplesCarousel populates textarea on click
- [ ] ToneSelector persists selection to localStorage
- [ ] Processing flow shows progress messages
- [ ] Success message displays and modal closes
- [ ] Error handling shows fallback button

### Accessibility Testing

- [ ] Keyboard-only navigation works (no mouse)
- [ ] Tab order is logical (textarea → examples → tone → submit)
- [ ] Focus indicators visible (using `--focus-ring`)
- [ ] Screen reader announces all elements correctly
- [ ] aria-live region announces progress (test with NVDA/VoiceOver)
- [ ] Floating label never hides (always visible)
- [ ] Color contrast ≥ 4.5:1 for all text
- [ ] Reduced motion respected (animations disabled)

### Performance Testing

- [ ] Hero animations smooth at 60fps
- [ ] Modal opens/closes without jank
- [ ] Processing flow doesn't block UI
- [ ] Large documents (10,000 words) process within timeout
- [ ] Fallback triggers appropriately if AI unavailable

### Cross-Browser Testing

- [ ] Chrome (90+)
- [ ] Firefox (88+)
- [ ] Safari (14+)
- [ ] Edge (90+)
- [ ] Mobile Safari (iOS 14+)
- [ ] Mobile Chrome (Android 10+)

---

## Metrics & Analytics

### Key Onboarding Metrics

1. **Completion Rate**: % of users who complete onboarding
   - Target: ≥ 70%
   - Measure: Users who submit form / Users who open modal

2. **Time to First Fractal**: Median time from CTA click to fractal view
   - Target: ≤ 90 seconds
   - Measure: Timestamp difference (click → success)

3. **Drop-off Points**: Where do users abandon onboarding?
   - Modal opened but not submitted
   - Processing started but canceled
   - Timeout fallback used

4. **Input Methods**: What do users paste?
   - Text content
   - URLs
   - Example carousel
   - Character count distribution

5. **Keyboard Shortcut Usage**: % of users using Ctrl+Enter
   - Target: ≥ 20% (for power users)
   - Measure: Submit via keyboard / Total submits

### Event Tracking

```javascript
// Example events to track (pseudocode)
analytics.track('onboard_modal_opened');
analytics.track('onboard_example_selected', { example: 'student' });
analytics.track('onboard_tone_selected', { tone: 'concise' });
analytics.track('onboard_form_submitted', { method: 'keyboard_shortcut', char_count: 2400 });
analytics.track('onboard_processing_started');
analytics.track('onboard_processing_success', { duration_ms: 45000 });
analytics.track('onboard_processing_fallback', { reason: 'timeout' });
analytics.track('onboard_modal_closed', { stage: 'processing' });
```

---

## Troubleshooting

### Common Issues

**1. Modal won't open**
- Check that Hero component is properly initialized
- Verify `isOpen` state is toggling correctly
- Ensure no CSS `display: none` overrides

**2. Keyboard shortcut not working**
- Verify event listener attached when modal opens
- Check for conflicts with browser shortcuts
- Test on different operating systems (Windows, Mac, Linux)

**3. aria-live announcements not heard**
- Use actual screen reader (NVDA, VoiceOver, JAWS)
- Verify `aria-live="polite"` attribute present
- Check that announcements are updating state (not just props)
- Ensure element is not `display: none` (use `.sr-only` class instead)

**4. Floating label doesn't move**
- Check CSS transitions are applied
- Verify JavaScript adds/removes floating class correctly
- Ensure `--duration-base` token is defined

**5. Processing timeout**
- Check that timeout is set appropriately (default: 2 minutes)
- Verify fallback button appears
- Test with various document sizes

---

## Future Enhancements

### Planned for v1.2

- [ ] First-time user tour (3-step tooltip guide)
- [ ] Onboarding progress persistence (resume if interrupted)
- [ ] URL auto-extraction preview
- [ ] Drag-and-drop file support (.txt, .md, .pdf)
- [ ] Sample content library with more examples
- [ ] Video tutorial (embedded in modal)

### Under Consideration

- [ ] Voice input for accessibility
- [ ] Browser extension for one-click import from any page
- [ ] Mobile-optimized onboarding flow
- [ ] Collaborative onboarding (share fractal link with friend)
- [ ] Gamification (achievement: "First Fractal Created 🎉")

---

## Resources

### Internal Documentation

- [Design System](./DESIGN_SYSTEM.md) - Design tokens, animations, accessibility
- [i18n Strings](../src/i18n/strings.js) - All microcopy
- [OnboardPopover Component](../src/components/OnboardPopover/)

### External References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Floating Labels Are Problematic](https://www.nngroup.com/articles/floating-labels/) - Nielsen Norman Group
- [Accessible Modal Dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) - W3C
- [Keyboard Shortcuts Best Practices](https://www.nngroup.com/articles/keyboard-accessibility/)

---

## Changelog

### Version 1.1.0 (2025-11-06)
- Added floating label pattern to textarea
- Added helper chips for contextual suggestions
- Added keyboard shortcut (Ctrl+Enter) with visual hint
- Added aria-live announcements for progress
- Enhanced backdrop blur intensity during processing
- Improved screen reader support with aria-describedby
- Updated copy and privacy messaging
- Performance optimizations (GPU-accelerated animations)

### Version 1.0.0 (2025-10-29)
- Initial onboarding flow
- Hero section with CTAs
- OnboardPopover modal
- ExamplesCarousel for quick-start
- ToneSelector for personalization
- Processing flow with FractalSeed animation
- Demo mode support

---

**Maintained by**: FractaMind Team
**Last Updated**: 2025-11-06
**Questions?**: Open an issue on GitHub
