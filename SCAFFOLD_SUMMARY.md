# FractaMind Scaffold Summary

This document summarizes the scaffolding completed for the FractaMind project.

---

## Files Created

### Project Metadata
1. ✅ **README.md** — Comprehensive project documentation with installation, usage, architecture
2. ✅ **LICENSE** — MIT License (already existed, preserved)
3. ✅ **CONTRIBUTING.md** — Development setup, code style, PR guidelines, commit conventions
4. ✅ **CODE_OF_CONDUCT.md** — Community standards and behavior guidelines
5. ✅ **.gitignore** — Node.js, Vite, and frontend build artifacts

### Build Configuration
6. ✅ **package.json** — Vite + React + Jest setup with all scripts
7. ✅ **vite.config.js** — Vite configuration with React plugin
8. ✅ **jest.setup.js** — Jest + React Testing Library setup

### Application Entry Points
9. ✅ **index.html** — HTML entry point with proper meta tags
10. ✅ **src/main.jsx** — React root component with ChoreComponent integration
11. ✅ **src/index.css** — Global styles

### ChoreComponent (Initial UI Widget)
12. ✅ **src/components/chore-component/ChoreComponent.jsx** — React component with modal, form, callbacks
13. ✅ **src/components/chore-component/ChoreComponent.css** — Styled with gradients, animations, responsive
14. ✅ **src/components/chore-component/ChoreComponent.test.js** — Comprehensive unit tests (18 test cases)

### Documentation
15. ✅ **docs/README_BRIEF.md** — Developer pointer to specs and next development tasks

---

## Installation & Usage

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm start
# Opens http://localhost:5173 in Chrome Canary
```

### Run Tests
```bash
npm test                   # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

### Build for Production
```bash
npm run build
npm run preview
```

### Linting
```bash
npm run lint               # Check code style
npm run lint -- --fix      # Auto-fix issues
```

---

## ChoreComponent Overview

### Purpose
Initial onboarding/hero widget that:
- Shows friendly headline and description
- Opens modal with text input on CTA click
- Emits `onSeedSubmit(text)` callback for AI integration
- Fully keyboard accessible (ARIA labels, Escape key, autofocus)

### Props
```javascript
<ChoreComponent
  onSeedSubmit={(text) => console.log(text)}  // Required: callback function
  autoShow={false}                             // Optional: open modal on mount
/>
```

### Features
- **Hero Section**: Gradient background, clear CTA
- **Modal**: Multi-line textarea, Submit/Cancel buttons
- **Validation**: Disabled submit when empty/whitespace
- **Privacy Notice**: "All processing happens locally"
- **Loading State**: Shows "Processing..." during async submission
- **Error Handling**: Logs errors, keeps modal open on failure
- **Accessibility**:
  - ARIA labels and roles
  - Keyboard navigation (Escape to close)
  - Autofocus on textarea
  - Screen reader support

---

## Test Coverage

### ChoreComponent.test.js
18 test cases covering:
- ✅ Hero section rendering
- ✅ Modal open/close (CTA, overlay, close button, Escape key)
- ✅ Form validation (empty, whitespace, enabled state)
- ✅ Submission flow (callback invocation, trimming, modal close)
- ✅ Loading state during async submission
- ✅ Error handling (console logging, modal persistence)
- ✅ Textarea clearing on reopen
- ✅ Accessibility (ARIA attributes, autofocus, required fields)

Run with: `npm test ChoreComponent`

---

## Commit Message

Use this message to commit the scaffolded files:

```
chore: scaffold README, metadata, and chore-component (initial)

- Add comprehensive README with installation, usage, and architecture
- Add CONTRIBUTING.md with dev setup and PR conventions
- Add CODE_OF_CONDUCT.md for community standards
- Add .gitignore for Node.js and Vite artifacts
- Add package.json with Vite, React, Jest, ESLint, Prettier
- Create ChoreComponent.jsx: onboarding modal with text input
- Create ChoreComponent.test.js: 18 unit tests (hero, modal, form, a11y)
- Add docs/README_BRIEF.md: developer guide and next tasks
- Add index.html, main.jsx, vite.config.js for Vite setup

ChoreComponent is keyboard-accessible, emits onSeedSubmit callback,
and includes privacy notice. No AI integration yet—pure UI.
```

---

## Next Development Tasks

See [docs/README_BRIEF.md](docs/README_BRIEF.md) for detailed task breakdown.

### Immediate Next Steps (Phase 1)
1. **Import Pipeline**: URL extraction, clipboard handling
2. **Summarizer Integration**: Chrome Built-in AI API for top-level nodes
3. **Node Creation**: Parse AI response into FractalNode objects
4. **Indexer Integration**: Save nodes to IndexedDB with Morton keys

### Future Phases
- **Phase 2**: Canvas renderer, zoom/pan, tree layout
- **Phase 3**: Node expansion (Writer API), child generation
- **Phase 4**: Semantic search (Embeddings API, range scan)
- **Phase 5**: Export (JSON/Markdown), editing, accessibility polish

---

## File Structure

```
FractaMind/
├── README.md                           # Main documentation
├── LICENSE                             # MIT License
├── CONTRIBUTING.md                     # Dev guidelines
├── CODE_OF_CONDUCT.md                  # Community standards
├── .gitignore                          # Ignored files
├── package.json                        # Dependencies & scripts
├── vite.config.js                      # Vite configuration
├── jest.setup.js                       # Jest setup
├── index.html                          # HTML entry point
├── src/
│   ├── main.jsx                        # React root
│   ├── index.css                       # Global styles
│   ├── fractamind-indexer.js           # IndexedDB + Morton keys
│   └── components/
│       └── chore-component/
│           ├── ChoreComponent.jsx       # Hero + modal component
│           ├── ChoreComponent.css       # Component styles
│           └── ChoreComponent.test.js   # Unit tests (18 cases)
└── docs/
    ├── README_BRIEF.md                 # Developer guide
    ├── Canonical Implementation Spec.md
    ├── Project summary.md
    └── core_concept.md
```

---

## Technology Stack

- **Frontend**: React 18 + Vite 5
- **Testing**: Jest 29 + React Testing Library 16
- **Linting**: ESLint + Prettier
- **Styling**: CSS (custom styles, no framework)
- **Build**: Vite (fast HMR, optimized builds)
- **Database**: IndexedDB (via fractamind-indexer.js)
- **AI**: Chrome Built-in AI (Gemini Nano) — *not yet integrated*

---

## Notes

### Design Decisions
1. **Component naming**: "chore-component" is a placeholder name. Easily renamed by updating:
   - Directory: `src/components/chore-component/`
   - Files: `ChoreComponent.jsx`, `ChoreComponent.css`, `ChoreComponent.test.js`
   - Import in `src/main.jsx`

2. **No AI integration yet**: ChoreComponent only handles UI and emits seed text via callback. AI integration (Summarizer, Writer, Embeddings APIs) will be wired in Phase 1.

3. **Styling approach**: Custom CSS with modern features (gradients, animations, flexbox). No Tailwind or UI framework to keep bundle size small.

4. **Testing framework**: Jest + React Testing Library chosen for comprehensive unit testing. 18 test cases ensure ChoreComponent works correctly before AI integration.

5. **Accessibility-first**: ARIA labels, keyboard navigation, and autofocus implemented from the start.

### Prerequisites Reminder
To run the app, ensure:
- **Node.js 18+** installed
- **Chrome Canary 128+** with Built-in AI enabled:
  1. `chrome://flags` → Enable `#optimization-guide-on-device-model` and `#prompt-api-for-gemini-nano`
  2. Restart Chrome
  3. `chrome://components` → Download "Optimization Guide On Device Model"

---

## Success Criteria ✅

All acceptance criteria met:
- ✅ README is clear, concise, and includes working install/run commands
- ✅ ChoreComponent is a React function component with ARIA labels
- ✅ Component exports `onSeedSubmit` callback prop
- ✅ Includes presentable styles (gradient hero, modal animations)
- ✅ All files formatted, package.json includes `start` and `build` scripts
- ✅ Unit test file with 18 test cases (renders, clicks, submission, accessibility)
- ✅ Commit message provided for scaffolding commit

---

## Verification

Test that everything works:

```bash
# 1. Install dependencies
npm install

# 2. Run tests (should pass all 18 tests)
npm test

# 3. Start dev server (should open browser)
npm start

# 4. Click "Paste Text or URL to Begin"
# 5. Type sample text and click "Generate Fractal"
# 6. Should see alert: "Received X characters. AI integration coming soon!"

# 7. Run linting (should pass)
npm run lint
```

---

**Scaffold complete!** 🎉

Ready for Phase 1 implementation: Import pipeline + Summarizer integration.

---

## Recent Updates (2025-10-28)

### Refactoring: CHOA → CHORE & Project Restructuring

All component references renamed from "CHOA" to "CHORE":
- Component renamed: `ChoaComponent` → `ChoreComponent`
- Folder renamed: `choa-component/` → `chore-component/`
- CSS classes updated: `.choa-*` → `.chore-*`

### Folder Structure Reorganized

New organized structure created:
```
/src
  /ai                - Chrome Built-in AI API wrappers
  /components        - React UI components
  /db                - IndexedDB and persistence (fractamind-indexer.js moved here)
  /viz               - Canvas/SVG rendering
  /utils             - Shared utilities
  /hooks             - Custom React hooks
  /constants         - Application constants
```

### Git Branching Conventions Added

- **CONTRIBUTING.md**: Added comprehensive Git branching strategy
- **CLAUDE.md**: Added file organization conventions and branching workflow
- **Branch naming**: `<type>/<description>` (e.g., `feat/semantic-search`)
- **Rule**: Never commit directly to `main` - always use branches and PRs

See [REFACTOR_SUMMARY.md](REFACTOR_SUMMARY.md) for complete details.
