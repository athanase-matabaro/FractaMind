# Refactor Summary: CHOA → CHORE & Project Restructuring

This document summarizes the comprehensive refactoring completed on 2025-10-28.

---

## Changes Made

### 1. Component Renaming: CHOA → CHORE

All references to "CHOA" have been renamed to "CHORE" across the entire project.

#### Files Renamed
- `src/components/choa-component/` → `src/components/chore-component/`
- `ChoaComponent.jsx` → `ChoreComponent.jsx`
- `ChoaComponent.css` → `ChoreComponent.css`
- `ChoaComponent.test.js` → `ChoreComponent.test.js`

#### Content Updated
- All CSS class names: `.choa-*` → `.chore-*`
- All component references in JSX
- All imports and exports
- All documentation references
- All test cases

### 2. Folder Structure Reorganization

#### New Directory Structure Created

```
/src
  /ai                - Chrome Built-in AI API wrappers (NEW)
  /components        - React UI components
    /chore-component - Renamed from choa-component
  /db                - IndexedDB and persistence layer (NEW)
    - fractamind-indexer.js (MOVED from src/)
  /viz               - Canvas/SVG rendering (NEW - ready for future code)
  /utils             - Shared utilities (NEW - ready for future code)
  /hooks             - Custom React hooks (NEW - ready for future code)
  /constants         - Application constants (NEW - ready for future code)
```

#### Files Moved
- `src/fractamind-indexer.js` → `src/db/fractamind-indexer.js`

### 3. Git Branching Conventions Added

#### Updated Files
- **CONTRIBUTING.md**: Added comprehensive "Git Branching Strategy" section
- **CLAUDE.md**: Added "Development Workflow & Conventions" section

#### New Conventions

**Branch Naming Format**: `<type>/<short-description>`

**Branch Types**:
- `feat/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `test/` - Test additions/updates
- `chore/` - Maintenance tasks
- `perf/` - Performance improvements

**Key Rules**:
- ✅ Always create a branch for any change
- ❌ Never commit directly to `main`
- ✅ Use Pull Requests for all merges
- ✅ Delete branches after merge

### 4. File Organization Conventions Documented

Added comprehensive file placement rules to **CLAUDE.md**:

#### Placement Rules
1. **React Components**: `/src/components/<component-name>/` with Component.jsx, Component.css, Component.test.js, index.js
2. **AI API Wrappers**: `/src/ai/` with kebab-case filenames
3. **Database/Persistence**: `/src/db/`
4. **Utilities**: `/src/utils/` for reusable functions
5. **Tests**: Co-located with source files (unit) or `/tests/integration/` (E2E)
6. **Documentation**: `/docs/` for specs, inline JSDoc for code

#### Naming Conventions
- **Components**: PascalCase files (e.g., `ChoreComponent.jsx`), kebab-case folders (e.g., `chore-component/`)
- **Utilities/APIs**: kebab-case (e.g., `morton-key.js`, `embeddings.js`)
- **Constants**: kebab-case (e.g., `config.js`, `api.js`)

---

## Impact Summary

### Files Modified
✅ Component files: ChoreComponent.jsx, ChoreComponent.css, ChoreComponent.test.js, index.js
✅ Entry point: src/main.jsx
✅ Documentation: README.md, CONTRIBUTING.md, CLAUDE.md, SCAFFOLD_SUMMARY.md, docs/README_BRIEF.md

### Files Moved
✅ `src/fractamind-indexer.js` → `src/db/fractamind-indexer.js`

### Directories Created
✅ `/src/ai`
✅ `/src/db`
✅ `/src/viz`
✅ `/src/utils`
✅ `/src/hooks`
✅ `/src/constants`

### Breaking Changes
⚠️ **Import paths changed**:
- Old: `import fractamindIndexer from './fractamind-indexer.js'`
- New: `import fractamindIndexer from './db/fractamind-indexer.js'`

⚠️ **Component imports changed**:
- Old: `import ChoaComponent from './components/choa-component/ChoaComponent'`
- New: `import ChoreComponent from './components/chore-component/ChoreComponent'`

---

## Testing Verification

Before committing, verify:

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Run tests - all should pass
npm test

# 3. Run linting - should pass
npm run lint

# 4. Start dev server - should compile without errors
npm start

# 5. Manual test: Open browser, verify ChoreComponent renders
# 6. Manual test: Click "Paste Text or URL to Begin", modal should open
# 7. Manual test: Type text, click "Generate Fractal", alert should show
```

---

## Commit Message

Use this commit message for the refactor:

```
refactor: rename CHOA to CHORE, reorganize folder structure, add branching conventions

BREAKING CHANGE: Component renamed from ChoaComponent to ChoreComponent

- Rename all CHOA references to CHORE across codebase
- Rename choa-component/ to chore-component/
- Update all CSS classes from .choa-* to .chore-*
- Update all component imports and exports
- Move src/fractamind-indexer.js to src/db/fractamind-indexer.js
- Create organized folder structure: /ai, /db, /viz, /utils, /hooks, /constants
- Add comprehensive Git branching strategy to CONTRIBUTING.md
- Add file organization conventions to CLAUDE.md
- Document branch naming: <type>/<description> format
- Enforce PR workflow: never commit directly to main
- Update all documentation with new paths and conventions

Refs: Project restructuring for scalability
```

---

## Next Steps

### Immediate
1. Run verification tests (see Testing Verification above)
2. Commit changes with the message above
3. Push to new branch: `git checkout -b refactor/choa-to-chore-restructure`
4. Open Pull Request

### Future Development
Now that the structure is established, follow these conventions:

1. **New AI wrapper?** → Place in `/src/ai/`
2. **New component?** → Place in `/src/components/<name>/` with proper file structure
3. **New utility?** → Place in `/src/utils/`
4. **New hook?** → Place in `/src/hooks/`
5. **Working on feature?** → Create branch `feat/<name>` and open PR

---

## File Organization Reference

Quick reference for where to place new files:

| File Type | Location | Example |
|-----------|----------|---------|
| React Component | `/src/components/<name>/` | `ChoreComponent.jsx` |
| AI API Wrapper | `/src/ai/` | `summarizer.js` |
| Database Helper | `/src/db/` | `fractamind-indexer.js` |
| Utility Function | `/src/utils/` | `morton-key.js` |
| Custom Hook | `/src/hooks/` | `useIndexedDB.js` |
| Constant | `/src/constants/` | `config.js` |
| Visualization | `/src/viz/` | `fractal-renderer.js` |
| Integration Test | `/tests/integration/` | `semantic-search.test.js` |
| Test Fixture | `/tests/fixtures/` | `sample-nodes.json` |
| Documentation | `/docs/` | `api-reference.md` |

---

## Success Criteria ✅

All changes completed successfully:
- ✅ All CHOA references renamed to CHORE
- ✅ Folder structure reorganized with proper conventions
- ✅ CLAUDE.md updated with file organization rules
- ✅ CONTRIBUTING.md updated with Git branching strategy
- ✅ All documentation updated with correct paths
- ✅ Component files properly renamed and updated
- ✅ CSS classes renamed throughout
- ✅ Test file updated
- ✅ Import paths corrected

**Ready for commit and PR!** 🎉
