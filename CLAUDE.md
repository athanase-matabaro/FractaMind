# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FractaMind is a privacy-first, client-side web application and Chrome Extension that transforms text into an explorable fractal of ideas. It uses Chrome Built-in AI (Gemini Nano) to run AI operations locally in the browser, ensuring user data never leaves the device.

**Core Concept**: Recursive knowledge exploration - zoom in to expand ideas into sub-ideas, zoom out for summaries. Think of it as navigating knowledge the way you navigate a fractal: broad overview → detailed branches.

## Development Workflow & Conventions

### Git Branching Strategy

**IMPORTANT**: Always create a new branch for any feature, bug fix, or refactoring. Never commit directly to `main`.

#### Branch Naming Convention

```
<type>/<short-description>
```

**Types**:
- `feat/` - New features (e.g., `feat/semantic-search`, `feat/node-expansion`)
- `fix/` - Bug fixes (e.g., `fix/modal-close-button`, `fix/embedding-quantization`)
- `refactor/` - Code refactoring without behavior changes (e.g., `refactor/indexer-api`)
- `docs/` - Documentation updates (e.g., `docs/api-reference`, `docs/setup-guide`)
- `test/` - Adding or updating tests (e.g., `test/chore-component-coverage`)
- `chore/` - Maintenance tasks, dependencies (e.g., `chore/update-deps`, `chore/ci-setup`)
- `perf/` - Performance improvements (e.g., `perf/morton-key-optimization`)

#### Workflow

```bash
# 1. Create a new branch from main
git checkout main
git pull origin main
git checkout -b feat/your-feature-name

# 2. Make changes, commit following Conventional Commits
git add .
git commit -m "feat(search): add semantic search with Morton indexing"

# 3. Push branch to remote
git push -u origin feat/your-feature-name

# 4. Open a Pull Request on GitHub
# 5. After review and approval, merge via GitHub (squash and merge recommended)
# 6. Delete the branch after merge
```

#### Pull Request Guidelines

- **Title**: Follow commit convention (e.g., `feat(ai): integrate Chrome Summarizer API`)
- **Description**: Include:
  - Summary of changes
  - Why this change is needed
  - Screenshots (if UI changes)
  - Link to related issue
- **Checklist**:
  - [ ] Tests pass locally
  - [ ] Linting passes
  - [ ] Documentation updated
  - [ ] No merge conflicts

### File Organization Conventions

**CRITICAL**: Always place files in their correct location according to this structure. Never create files in the wrong directory.

```
/src
  /ai                - Chrome Built-in AI API wrappers and helpers
    - summarizer.js  - Summarizer API wrapper
    - writer.js      - Writer API wrapper
    - embeddings.js  - Embeddings API wrapper
    - prompt.js      - Prompt API wrapper

  /components        - React UI components (each in its own folder)
    /chore-component - Initial onboarding/hero widget
      - ChoreComponent.jsx
      - ChoreComponent.css
      - ChoreComponent.test.js
      - index.js
    /fractal-canvas  - Main fractal visualization component
    /search-bar      - Semantic search input component
    /node-card       - Individual fractal node UI

  /db                - IndexedDB and persistence layer
    - fractamind-indexer.js  - Morton key indexing & range queries
    - schema.js      - Database schema definitions
    - migrations.js  - Schema version migrations

  /viz               - Canvas/SVG rendering and layout algorithms
    - fractal-renderer.js  - Main canvas renderer
    - layout.js      - Tree layout algorithms (radial, hierarchical)
    - zoom-pan.js    - Zoom and pan controls

  /utils             - Shared utilities and helpers
    - morton-key.js  - Morton curve computation
    - vector.js      - Vector math (cosine similarity, dot product)
    - uuid.js        - UUID generation
    - text.js        - Text processing utilities

  /hooks             - Custom React hooks
    - useIndexedDB.js
    - useAI.js
    - useDebounce.js

  /constants         - Application constants
    - config.js      - Configuration values
    - api.js         - API constants

  /styles            - Global styles (component styles stay with components)
    - index.css      - Global CSS reset and base styles
    - theme.css      - Color palette, typography, spacing

  - main.jsx         - React application entry point
  - App.jsx          - Root React component (if extracted from main.jsx)

/docs                - Technical documentation
  - Canonical Implementation Spec.md
  - Project summary.md
  - core_concept.md
  - README_BRIEF.md

/tests               - Integration tests and test fixtures
  /fixtures          - Sample data for tests
  /integration       - End-to-end tests

/scripts             - Build and utility scripts
  - setup.sh         - Development environment setup
  - export-schema.js - Export database schema for docs

- index.html         - HTML entry point
- package.json       - Dependencies and scripts
- vite.config.js     - Vite bundler configuration
- jest.setup.js      - Jest test setup
- .gitignore         - Git ignore rules
- README.md          - Main project documentation
- CONTRIBUTING.md    - Contributor guidelines
- LICENSE            - MIT License
- CLAUDE.md          - This file
```

#### File Placement Rules

1. **React Components**:
   - Place in `/src/components/<component-name>/`
   - Each component gets its own folder with: `Component.jsx`, `Component.css`, `Component.test.js`, `index.js`
   - Use PascalCase for component files (e.g., `ChoreComponent.jsx`)
   - Use kebab-case for folder names (e.g., `chore-component/`)

2. **AI API Wrappers**:
   - Place in `/src/ai/`
   - Use kebab-case for filenames (e.g., `summarizer.js`, `embeddings.js`)
   - Each file exports a single API wrapper

3. **Database/Persistence**:
   - Place in `/src/db/`
   - Indexer, schema, and migrations go here

4. **Utilities**:
   - Place in `/src/utils/`
   - Small, reusable functions with no dependencies on other modules
   - Use kebab-case (e.g., `morton-key.js`, `vector.js`)

5. **Tests**:
   - Unit tests: Co-locate with source file (e.g., `Component.test.js` next to `Component.jsx`)
   - Integration tests: Place in `/tests/integration/`
   - Test fixtures: Place in `/tests/fixtures/`

6. **Documentation**:
   - Technical specs: `/docs/`
   - Code comments: Inline JSDoc comments in source files
   - README files: Root and `/docs/`

### Development Commands

```bash
# Start development server
npm start

# Run tests
npm test
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report

# Linting
npm run lint
npm run lint -- --fix

# Build for production
npm run build
npm run preview
```

## Architecture

### Key Components

**1. Indexing Layer** (`src/db/fractamind-indexer.js`)
- IndexedDB wrapper for persistence
- Morton (Z-order) key computation for embeddings
- Provides fast locality-preserving searches

**2. Frontend** (`src/components/`)
- React + Canvas/SVG renderer for fractal visualization
- Handles import, expand, collapse, search UI flows
- ChoreComponent: Initial onboarding/hero widget

**3. AI Integration** (`src/ai/`)
- Chrome Built-in AI APIs: Summarizer, Writer, Prompt, Embeddings
- All operations run locally (privacy-first)

### Data Model

**FractalNode Structure**:
```json
{
  "id": "uuid-v4",
  "title": "short title (5-6 words max)",
  "text": "full node text",
  "summary": "optional summary",
  "children": ["child-id-1", "child-id-2"],
  "parent": "parent-id or null",
  "embedding": [0.001, -0.22, ...],
  "hilbertKeyHex": "hex-string",
  "meta": {
    "sourceUrl": "https://...",
    "createdAt": "ISO8601",
    "createdBy": "local"
  }
}
```

**Key Field Semantics**:
- `embedding`: Float32 vector (512-1536 dims depending on API). Full vector stored for ranking.
- `hilbertKeyHex`: Morton key (hex string) computed from quantized, dimension-reduced embedding for fast range queries
- `children`: Array of node IDs for tree structure

### Indexing Algorithm

The indexer uses **Morton (Z-order) curve** mapping to preserve locality:

1. **Reduce dimensions**: Take first 8-16 dims from full embedding (or use block averaging)
2. **Quantize**: Normalize each dim to [0,1] using per-project min/max, then quantize to 16-bit integers (0-65535)
3. **Interleave bits**: Create Morton key by interleaving bits across dimensions (MSB-first)
4. **Store as hex**: Convert BigInt key to hex string for IndexedDB indexing

**Search Pipeline**:
1. Query text → embedding vector
2. Reduce dims → quantize → compute query Morton key
3. Range scan: fetch nodes with keys in `[queryKey - radius, queryKey + radius]`
4. Re-rank candidates using cosine similarity on full embeddings
5. Return top-K results

See `src/fractamind-indexer.js:108-275` for implementation details.

### IndexedDB Schema

**Stores**:
- `nodes`: Main object store, keyed by `id`, indexed by `hilbertKeyHex`
- `mortonIndex`: Maps `{ mortonHex, nodeId }` for range queries

**API Functions** (from indexer):
- `initDB()`: Initialize database
- `saveNode(node)`: Save/update node and its Morton index entry
- `getNode(id)`: Retrieve node by ID
- `deleteNode(id)`: Remove node and cleanup index entries
- `rangeScanByMortonHex(centerHex, radiusHex, {limit})`: Range search for semantic neighbors
- `computeQuantizationParams(embeddings, {reducedDims, bits, reduction})`: Compute min/max for quantization
- `computeMortonKeyFromEmbedding(embedding, quantParams)`: Generate Morton key from embedding

## AI API Integration

### Chrome Built-in AI APIs Used

1. **Summarizer API**: Generate 3-7 top-level nodes from document
2. **Writer API**: Expand nodes into 2-4 child nodes
3. **Prompt API**: Structured JSON generation, rewriting
4. **Embeddings API**: Generate vectors for semantic search

### Prompt Templates

**Document Summarization** (top-level nodes):
```
System: You are a concise summarizer. Return JSON array of 5 objects.
User: Summarize the following document into 5 distinct subtopics. For each subtopic return:
- title (max 6 words)
- summary (one short sentence)
- keyPoints (2 short bullet points)
Document: "{document_text}"

Return strictly valid JSON like: [{"title":"...","summary":"...","keyPoints":["...","..."]}, ...]
```

**Node Expansion**:
```
System: You are an idea-expander. Output JSON array of 3 objects.
User: Given this node title and text, generate 3 child nodes that expand it. For each child return:
- title (5 words max)
- text (2-3 sentences)
Keep output as valid JSON.
NodeTitle: "{title}"
NodeText: "{text}"
```

**Important**: Always use robust JSON parsing that can recover from stray backticks, trailing commas, or prefix text. Fallback to regex extraction if parsing fails.

## Implementation Priorities

### MVP (Hackathon-ready):
1. Text import (clipboard + paste + URL extraction)
2. Top-level summarization (3-7 nodes)
3. Zoomable fractal canvas renderer
4. Node expansion (Writer API → child nodes)
5. Local embeddings + semantic search
6. IndexedDB persistence
7. JSON + Markdown export

### Phase 1 (Post-MVP):
- Hilbert curve optimization (currently using Morton)
- Personalization presets (tone: concise vs detailed)
- Node editing + Rewriter integration
- Visual polish (animations, depth-based colors)

### Stretch Features:
- Multimodal nodes (images/audio via Prompt API)
- Firebase hybrid sync (opt-in)
- Deep-linkable nodes
- Export to Notion/Obsidian

## Important Conventions

**Privacy-First Architecture**:
- All AI operations must run client-side
- No data leaves the device for core flows
- If adding sync (Firebase), make it opt-in and encrypted
- Never log sensitive content to console in production

**Performance Targets**:
- 2000-word import → summarization + render: ≤10s
- Node expansion latency: ≤2.5s (model cached)
- Search query (1k nodes): ≤300ms

**Accessibility**:
- Keyboard navigation required: arrows move focus, Enter expands, Space toggles
- All nodes need accessible labels for screen readers
- Support standard zoom/pan gestures

## Key Technical Details

**Morton Key Computation** (src/db/fractamind-indexer.js:255-275):
- Uses BigInt for 64-128 bit keys
- Interleaves bits MSB-first across dimensions
- Stores as hex string (no "0x" prefix) for IndexedDB compatibility

**Quantization Parameters** (src/db/fractamind-indexer.js:179-212):
- Computed once per project from sample embeddings
- Stores min/max per reduced dimension
- Prevents degenerate ranges with epsilon checks

**Range Search** (src/db/fractamind-indexer.js:108-155):
- Exact match: `radiusHexOrNumber = null`
- Range query: numeric offset or hex radius
- Returns node IDs (not full nodes) for efficiency

## Common Patterns

**Adding a new node**:
```javascript
// 1. Generate content via AI
const childNodes = await writerAPI.expand(parentNode);

// 2. For each child, compute embedding and Morton key
const embedding = await embeddingAPI.embed(childNode.text);
const mortonKey = computeMortonKeyFromEmbedding(embedding, quantParams);

// 3. Save to IndexedDB
await saveNode({
  id: uuid(),
  title: childNode.title,
  text: childNode.text,
  embedding: embedding,
  hilbertKeyHex: mortonKey,
  parent: parentNode.id,
  children: [],
  meta: { createdAt: new Date().toISOString(), createdBy: 'local' }
});
```

**Semantic search**:
```javascript
// 1. Get query embedding
const qvec = await embeddingAPI.embed(queryText);

// 2. Compute Morton key
const qkey = computeMortonKeyFromEmbedding(qvec, quantParams);

// 3. Range scan (adjust radius as needed)
const candidateIds = await rangeScanByMortonHex(qkey, 0x1000, { limit: 200 });

// 4. Load candidates and re-rank by cosine similarity
const candidates = await Promise.all(candidateIds.map(id => getNode(id)));
const ranked = candidates
  .map(c => ({ node: c, score: cosineSimilarity(qvec, c.embedding) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, topK);
```

## References

- **Canonical Spec**: `docs/Canonical Implementation Spec.md` - Complete implementation details, prompt templates, API contracts
- **Project Summary**: `docs/Project summary.md` - High-level architecture, user flows, demo script
- **Core Concept**: `docs/core_concept.md` - Original vision and use cases
