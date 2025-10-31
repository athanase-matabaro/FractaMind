# FractaMind Developer Documentation

This directory contains technical specifications and developer guides for FractaMind.

---

## Key Documents

### [Canonical Implementation Spec.md](Canonical%20Implementation%20Spec.md)
**Complete technical specification** covering:
- Full architecture diagrams
- API contracts for Chrome Built-in AI APIs
- Prompt templates (summarization, expansion, rewriting)
- IndexedDB schema and Morton key indexing algorithm
- Component specifications and user flows
- Performance benchmarks and optimization strategies

**Start here** if you're implementing core features or need to understand the complete system design.

---

### [Project summary.md](Project%20summary.md)
**High-level overview** including:
- Elevator pitch and problem statement
- User personas and use cases
- Architecture summary (3-layer stack)
- MVP feature list and roadmap
- Demo script for presentations

**Start here** if you're new to the project or need a quick refresher.

---

### [core_concept.md](core_concept.md)
**Original vision document** covering:
- Conceptual foundation (fractal knowledge exploration)
- Inspiration and design philosophy
- Early use cases and thought experiments
- Privacy-first principles

**Start here** if you want to understand the "why" behind FractaMind.

---

## Import Flow Documentation (Phase 1 - COMPLETE ✅)

### Running the Import Flow

1. **Start the development server**:
   ```bash
   npm start
   ```

2. **Open the app** in Chrome Canary (with Built-in AI enabled)

3. **Use the ChoreComponent**:
   - Click "Paste Text or URL to Begin"
   - Paste document text (up to ~10,000 words)
   - Click "Generate Fractal"

4. **Watch the progress**:
   - "Analyzing document..." — Summarization in progress
   - "Generating embeddings..." — Creating vector embeddings
   - "Saving to database..." — Persisting to IndexedDB
   - "Import complete!" — Success!

5. **Inspect the result**:
   - Open Chrome DevTools Console
   - Check IndexedDB: Application → IndexedDB → fractamind-db
   - View created nodes in the success card

### Import Pipeline Architecture

The import flow follows this sequence:

```
User Input (ChoreComponent)
  ↓
handleSeedSubmit() [src/core/importer.js]
  ↓
importDocument() → summarizeDocument() [src/ai/chromeAI.js]
  ↓
parseSummaryToNodes() → Create FractalNode objects
  ↓
attachEmbeddingsAndKeys() → batchGenerateEmbeddings() [src/ai/chromeAI.js]
  ↓
computeQuantizationParams() [src/db/fractamind-indexer.js]
  ↓
computeMortonKeyFromEmbedding() → Generate Morton hex keys
  ↓
persistProject() → saveNode() [src/db/fractamind-indexer.js]
  ↓
Success!
```

### Key Files

- **[src/ai/chromeAI.js](../src/ai/chromeAI.js)** — Chrome Built-in AI wrappers
  - `summarizeDocument(text, options)` — Summarize into 3-7 topics
  - `generateEmbedding(text)` — Generate Float32Array embedding
  - `batchGenerateEmbeddings(texts)` — Batch embedding generation

- **[src/core/importer.js](../src/core/importer.js)** — Import pipeline
  - `handleSeedSubmit(text, projectMeta, onProgress)` — Main entry point
  - `importDocument(text, projectMeta)` — Summarization + node creation
  - `parseSummaryToNodes(summaryResult, options)` — Parse AI output to nodes
  - `attachEmbeddingsAndKeys(nodes)` — Embed + Morton key computation
  - `persistProject(data)` — Save to IndexedDB

- **[src/components/chore-component/ChoreComponent.jsx](../src/components/chore-component/ChoreComponent.jsx)** — UI entry point

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test importer.test.js

# Watch mode
npm test -- --watch
```

### Example Usage

```javascript
import { handleSeedSubmit } from './core/importer';

const text = `
  Artificial Intelligence is transforming industries...

  Machine learning enables computers to learn from data...

  Natural language processing allows computers to understand human language...
`;

const result = await handleSeedSubmit(
  text,
  { name: 'AI Overview', sourceUrl: null },
  (progress) => console.log(progress)
);

console.log('Created nodes:', result.nodes.length);
console.log('Root:', result.rootNode.title);
```

---

## Fractal View Documentation (Phase 2 - COMPLETE ✅)

### Using the Fractal View

1. **Start the development server**:
   ```bash
   npm start
   ```

2. **Import a document**:
   - Click "Paste Text or URL to Begin"
   - Paste document text
   - Click "Generate Fractal"
   - Wait for import to complete

3. **Open Fractal View**:
   - Click "Open Fractal View" button in success card
   - Or click "Open Fractal View →" button in modal

4. **Interact with the fractal**:
   - **Pan**: Click and drag canvas
   - **Zoom**: Mouse wheel (zoom towards cursor)
   - **Select node**: Left-click any node → opens details panel
   - **Expand node**: Right-click any node → generates child nodes via AI
   - **Reset view**: Click "Reset View" button in HUD
   - **Toggle labels**: Click "Toggle Labels" button in HUD

5. **Navigate back**:
   - Click "← Back to Import" button (top-left)

### Fractal View Features

- **Radial Tree Layout**: Root at center, children radiate outward
- **Visual Encoding**: Node size = child count, color = depth (purple → blue)
- **Interactive Expansion**: Right-click to generate child nodes via Writer API
- **Node Details Panel**: Click to view full text, metadata, expand button
- **HUD Controls**: Node count, zoom level, reset view, toggle labels
- **Accessibility**: Keyboard navigation, ARIA labels, screen reader support

### Architecture Documentation

See **[docs/FRACTAL_VIEW.md](./FRACTAL_VIEW.md)** for:
- Complete architecture diagrams
- Radial layout algorithm
- Pan/zoom implementation
- Expansion pipeline details
- Testing strategy
- Performance optimizations

### Key Files

- **[src/viz/FractalCanvas.jsx](../src/viz/FractalCanvas.jsx)** — Main visualization component
- **[src/viz/FractalCanvas.css](../src/viz/FractalCanvas.css)** — Canvas styling
- **[src/core/expander.js](../src/core/expander.js)** — Node expansion logic
- **[src/main.jsx](../src/main.jsx)** — View routing (import ↔ fractal)

### Testing

```bash
# Run all tests
npm test

# Run Fractal Canvas tests
npm test fractalCanvas.test.js

# Run Expander tests
npm test expander.test.js

# Watch mode
npm test -- --watch
```

---

## Next Development Tasks

### Phase 1: Import & Summarization ✅ COMPLETE
- ✅ **Text Input Pipeline** — Handle pasted text via ChoreComponent
- ✅ **Summarizer Integration** — Connect Chrome Summarizer/Prompt API
- ✅ **Node Creation** — Parse AI response into `FractalNode` objects with UUIDs
- ✅ **Embedding Generation** — Generate vectors using Chrome Embeddings API
- ✅ **Morton Key Computation** — Compute locality-preserving indices
- ✅ **Persistence** — Save nodes to IndexedDB using `fractamind-indexer.js`
- ⏳ **URL Extraction** — Fetch and parse HTML (future enhancement)

### Phase 2: Fractal Canvas + Expansion ✅ COMPLETE
- ✅ **Canvas Renderer** — Draw nodes as circles with titles
- ✅ **Tree Layout Algorithm** — Radial layout with BFS traversal
- ✅ **Zoom/Pan Controls** — Mouse wheel zoom + drag-to-pan
- ✅ **Node Interaction** — Click to select, right-click to expand
- ✅ **Depth Styling** — Color gradient purple → blue by depth
- ✅ **Writer API Integration** — Call Chrome Writer API to expand nodes
- ✅ **Child Node Generation** — Parse 2-4 child nodes from AI response
- ✅ **Tree Update** — Add children to parent node, update IndexedDB
- ✅ **Embedding Generation** — Call Embeddings API for each new node
- ✅ **Morton Key Computation** — Use `computeMortonKeyFromEmbedding()` from indexer
- ✅ **Index Update** — Save Morton keys to `mortonIndex` store
- ✅ **Node Details Panel** — Show full text, metadata, expand button
- ✅ **HUD Controls** — Reset view, toggle labels, node count, zoom level
- ✅ **Progress Indicators** — Animated progress during expansion
- ✅ **Error Handling** — Graceful failure with user-friendly messages
- ✅ **Accessibility** — Keyboard navigation, ARIA labels
- ✅ **Deduplication** — Prevent duplicate child nodes by content hash
- ✅ **Rate Limiting** — Exponential backoff for AI API calls

### Phase 3: Semantic Search ✅ COMPLETE
- ✅ **Search UI** — Input bar with debounced queries
- ✅ **Query Embedding** — Generate embedding for search text
- ✅ **Range Scan** — Use `rangeScanByMortonHex()` to fetch candidates
- ✅ **Cosine Reranking** — Compute cosine similarity on full embeddings
- ✅ **Result Highlighting** — Visualize matching nodes on canvas

### Phase 4: Export & Polish ✅ COMPLETE
- ✅ **JSON Export** — Serialize full fractal tree
- ✅ **Markdown Export** — Convert tree to nested bullet list
- ✅ **Subtree Filtering** — Export only selected branches
- ✅ **Node Editing** — Allow users to edit titles/text
- ✅ **Rewriter Integration** — Use Prompt API to rephrase or summarize
- ✅ **Animations** — Smooth transitions for expand/collapse
- ✅ **Keyboard Navigation** — Arrow keys, Enter, Space shortcuts
- ✅ **Accessibility Audit** — Screen reader testing, ARIA improvements

### Phase 5: Multi-Document Federation & Workspace ✅ COMPLETE
- ✅ **Project Registry** — Manage multiple imported projects
- ✅ **Federation Index** — Track active projects for cross-search
- ✅ **Cross-Project Search** — Semantic search across all projects
- ✅ **Result Merging** — Deduplicate and normalize scores
- ✅ **Workspace UI** — Project cards with toggle/weight controls
- ✅ **Freshness Boost** — Prioritize recently updated content
- ✅ **Project Weights** — Bias search results (0.1x - 3.0x)
- ✅ **Grouped Results** — Display results by project
- ✅ **Navigation** — Click result to open in fractal view

---

## Workspace View Documentation (Phase 5 - COMPLETE ✅)

### Using the Workspace

The Workspace provides a unified interface for managing and searching across multiple FractaMind projects.

#### Accessing the Workspace

1. **From Import View**:
   - Click "🏢 Workspace" button (top menu)

2. **From Fractal View**:
   - Click "🏢 Workspace" button (top-left controls)

#### Workspace Features

**Project Management**:
- View all imported projects as cards
- See node count, creation date, and status for each project
- Toggle projects active/inactive for search
- Adjust project weights (0.1x - 3.0x) to bias search results
- Delete projects (with confirmation)

**Federated Search**:
- Search across all active projects simultaneously
- Results grouped by project with expand/collapse
- Each result shows:
  - Title and snippet
  - Similarity score (normalized)
  - Project weight multiplier
  - Freshness boost (for recent content)
- Click any result to navigate to that node in fractal view

**Keyboard Shortcuts**:
- `/` — Focus search input
- `g` — Toggle result grouping
- Arrow keys — Navigate results
- Enter — Open selected result
- Escape — Close workspace

#### Cross-Project Search Algorithm

1. **Query Embedding**: Generate embedding for search text
2. **Per-Project Scan**: For each active project:
   - Compute Morton key using project's quantization params
   - Run range scan to get candidate nodes
   - Calculate cosine similarity
   - Apply project weight and freshness boost
3. **Merge & Deduplicate**:
   - Combine results from all projects
   - Remove duplicates (same content across projects)
   - Sort by final score
4. **Return Top K**: Default 30 results

#### Architecture Documentation

See **[docs/FEDERATION_LAYER.md](./FEDERATION_LAYER.md)** for:
- Complete federation architecture
- Cross-search algorithm details
- Project weighting and scoring formulas
- Deduplication strategy
- Performance considerations
- Testing approach

### Key Files

**Core Logic**:
- **[src/core/projectRegistry.js](../src/core/projectRegistry.js)** — Project metadata storage
- **[src/core/federation.js](../src/core/federation.js)** — Federated index manager
- **[src/core/crossSearcher.js](../src/core/crossSearcher.js)** — Cross-project search engine
- **[src/utils/mergeUtils.js](../src/utils/mergeUtils.js)** — Result merging utilities

**UI Components**:
- **[src/viz/WorkspaceView.jsx](../src/viz/WorkspaceView.jsx)** — Main workspace interface
- **[src/viz/FederatedResults.jsx](../src/viz/FederatedResults.jsx)** — Search results display
- **[src/hooks/useWorkspace.js](../src/hooks/useWorkspace.js)** — Workspace state hook

### Testing

```bash
# Run all federation tests
npm test -- federation.test.js crossSearcher.test.js projectRegistry.test.js

# Run merge utils tests
npm test -- mergeUtils.test.js

# Run all tests
npm test
```

### Example: Programmatic Workspace Usage

```javascript
import { listProjects } from './core/projectRegistry';
import { crossProjectSearch } from './core/crossSearcher';
import { dedupeCandidates } from './utils/mergeUtils';

// List all projects
const projects = await listProjects();
console.log(`${projects.length} projects found`);

// Search across all projects
const results = await crossProjectSearch('artificial intelligence', {
  topK: 20,
  projectIds: null, // null = search all active projects
  applyWeights: true,
  applyFreshness: true
});

console.log(`Found ${results.length} results`);
results.forEach(r => {
  console.log(`- ${r.title} (${r.projectId}) - ${(r.finalScore * 100).toFixed(0)}%`);
});

// Deduplicate results manually
const deduped = dedupeCandidates(results);
console.log(`After dedup: ${deduped.length} unique results`);
```

---

## Quick Reference

### Project Structure
```
/src
  /components        - React UI (ChoaComponent, FractalCanvas, SearchBar)
  /ai                - Chrome Built-in AI API wrappers
  /viz               - Canvas/SVG rendering logic
  /db                - IndexedDB helpers (fractamind-indexer.js)
  /utils             - Morton key, embedding, UUID generation
/docs                - This directory (specs, guides)
/tests               - Integration tests and fixtures
```

### Key Indexer Functions
From [src/db/fractamind-indexer.js](../src/db/fractamind-indexer.js):
- `initDB()` — Initialize IndexedDB
- `saveNode(node)` — Save node and update Morton index
- `getNode(id)` — Retrieve node by UUID
- `deleteNode(id)` — Remove node and cleanup index
- `rangeScanByMortonHex(centerHex, radiusHex, {limit})` — Semantic search
- `computeMortonKeyFromEmbedding(embedding, quantParams)` — Generate Morton key

### Chrome Built-in AI API Availability
Check if APIs are available:
```javascript
const canSummarize = 'ai' in window && 'summarizer' in window.ai;
const canWrite = 'ai' in window && 'writer' in window.ai;
const canEmbed = 'ai' in window && 'embeddings' in window.ai;
```

---

## AI Configuration & Resilience

FractaMind includes robust AI wrapper functions with timeout handling and deterministic fallbacks to ensure the UI never hangs when Chrome Built-in AI is unavailable or slow.

### Environment Configuration

Create a `.env` file (copy from `.env.example`):

```env
# AI Mode
# Options: 'live' (use Chrome Built-in AI) | 'mock' (use deterministic fallbacks)
VITE_AI_MODE=live

# AI Timeout (milliseconds)
# Default: 15000 (15 seconds)
# Increase for slow devices, decrease for faster failure detection
VITE_AI_TIMEOUT_MS=15000

# Feature Flags
VITE_FEATURE_WORKSPACE=true

# Development
VITE_ENABLE_DEBUG_LOGS=false
```

### AI Wrapper Functions

All AI functions in **[src/ai/chromeAI.js](../src/ai/chromeAI.js)** include:

1. **Timeout Protection**: All API calls wrapped with configurable timeout (default 15s)
2. **Automatic Fallback**: On timeout or API unavailability, returns deterministic mock
3. **Mock Mode**: Force mock mode for testing via `VITE_AI_MODE=mock`
4. **Local Logging**: Console warnings for fallback events (no external tracking)

**Available Functions**:
- `summarizeDocument(text, options)` — Summarize into 3-7 topics (with fallback)
- `generateEmbedding(text, options)` — Generate Float32Array embedding (deterministic mock)
- `batchGenerateEmbeddings(texts, options)` — Batch embedding generation (with fallback)
- `expandNode(nodeText, options)` — Generate 2-4 child nodes (with fallback)
- `rewriteText(text, options)` — Rewrite with tone adjustment (with fallback)

**Example Usage**:
```javascript
import { generateEmbedding } from './ai/chromeAI.js';

// Automatic timeout and fallback
const embedding = await generateEmbedding('machine learning', {
  timeoutMs: 10000, // Override default timeout
  dims: 512
});

// Force mock mode (for testing)
const mockEmbedding = await generateEmbedding('test', { mock: true });

// Embedding is ALWAYS returned (never throws, never hangs)
console.log(embedding.length); // 512
```

### Deterministic Mock Fallbacks

When Chrome Built-in AI is unavailable or times out, FractaMind uses deterministic mocks from **[src/ai/mockHelpers.js](../src/ai/mockHelpers.js)**:

- **Embeddings**: SHA-256 hash of text → normalized 512-dim vector (same input = same output)
- **Summaries**: Sentence chunking → topic extraction (reproducible structure)
- **Expansions**: Word chunking → child node generation (deterministic titles)
- **Rewrites**: Tone-based transformations (concise/technical/creative)

**Why Deterministic?**
- Enables reliable unit testing (no randomness)
- Same document → same fractal structure
- Reproducible search results for demos

### UI Error Handling

The **[OnboardPopover](../src/components/OnboardPopover/OnboardPopover.jsx)** component demonstrates robust error handling:

**Timeout Detection**:
- When AI times out, error message displays: "AI processing timed out. You can retry or continue with a demo summary."
- Two action buttons appear:
  - **Retry**: Attempts AI processing again
  - **Continue with demo summary**: Uses mock fallback and continues workflow

**Accessibility**:
- Error messages use `aria-live="polite"` for screen reader announcements
- All action buttons have descriptive `aria-label` attributes
- Progress updates announced during processing

**Example**:
```jsx
{error && (
  <div className="onboard-error" role="alert" aria-live="polite">
    <strong>Error:</strong> {error}
    {aiTimedOut && (
      <div className="onboard-error-actions">
        <button onClick={handleRetry} aria-label="Retry AI processing">
          Retry
        </button>
        <button onClick={handleUseDemoSummary} aria-label="Continue with demo summary instead">
          Continue with demo summary
        </button>
      </div>
    )}
  </div>
)}
```

### Debugging Tips

**If Chrome Built-in AI is not working**:

1. **Check API Availability**:
   ```javascript
   console.log('window.ai:', window.ai);
   console.log('Summarizer:', window.ai?.summarizer);
   console.log('Embeddings:', window.ai?.embedding);
   console.log('Writer:', window.ai?.writer);
   ```

2. **Force Mock Mode** (for development without AI):
   - Set `VITE_AI_MODE=mock` in `.env`
   - Restart dev server: `npm start`
   - All AI operations will use deterministic fallbacks

3. **Test Timeout Handling**:
   - Set very low timeout: `VITE_AI_TIMEOUT_MS=100`
   - Trigger import → should timeout and show Retry/Demo buttons
   - Reset to default: `VITE_AI_TIMEOUT_MS=15000`

4. **Check Console Warnings**:
   ```
   Chrome Embeddings API not available. Using deterministic mock.
   AI fallback used { reason: 'Operation timed out', mode: 'live', timestamp: '...' }
   ```

5. **Enable Chrome Built-in AI** (Chrome Canary):
   - Navigate to `chrome://flags/#optimization-guide-on-device-model`
   - Enable "Prompt API for Gemini Nano"
   - Restart Chrome Canary
   - Verify: Open DevTools Console → Type `window.ai` → Should return object

**If tests are failing**:

1. **Run with mock mode**:
   ```bash
   VITE_AI_MODE=mock npm test
   ```

2. **Check specific test files**:
   ```bash
   # Test AI wrappers
   npm test -- tests/ai/safeWrapper.test.js

   # Test UI fallback behavior
   npm test -- tests/ui/onboardFallback.test.jsx
   ```

3. **Verify mock determinism**:
   ```bash
   node -e "
     const { mockEmbeddingFromText } = require('./src/ai/mockHelpers.js');
     const e1 = mockEmbeddingFromText('test');
     const e2 = mockEmbeddingFromText('test');
     console.log('Deterministic:', JSON.stringify(e1) === JSON.stringify(e2));
   "
   ```

### Testing
```bash
npm test                   # Run all tests
npm test -- --watch        # Watch mode
npm test ChoaComponent     # Run specific test
npm test -- --coverage     # Generate coverage report
```

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup, code style, and PR guidelines.

---

## Questions?

- **Technical specs**: See [Canonical Implementation Spec.md](Canonical%20Implementation%20Spec.md)
- **Architecture overview**: See [Project summary.md](Project%20summary.md)
- **Project context**: See [../CLAUDE.md](../CLAUDE.md)
- **Issues/Discussions**: Use GitHub Issues for bugs, GitHub Discussions for questions

Happy hacking! 🚀
