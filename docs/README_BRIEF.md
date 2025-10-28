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

## Next Development Tasks

### Phase 1: Import & Summarization ✅ COMPLETE
- ✅ **Text Input Pipeline** — Handle pasted text via ChoreComponent
- ✅ **Summarizer Integration** — Connect Chrome Summarizer/Prompt API
- ✅ **Node Creation** — Parse AI response into `FractalNode` objects with UUIDs
- ✅ **Embedding Generation** — Generate vectors using Chrome Embeddings API
- ✅ **Morton Key Computation** — Compute locality-preserving indices
- ✅ **Persistence** — Save nodes to IndexedDB using `fractamind-indexer.js`
- ⏳ **URL Extraction** — Fetch and parse HTML (future enhancement)

### Phase 2: Visualization
- [ ] **Canvas Renderer** — Draw nodes as circles/rectangles with titles
- [ ] **Tree Layout Algorithm** — Position nodes using radial or hierarchical layout
- [ ] **Zoom/Pan Controls** — Implement mouse wheel zoom and drag-to-pan
- [ ] **Node Interaction** — Hover states, click handlers, focus rings
- [ ] **Depth Styling** — Color gradient based on node depth (root → leaf)

### Phase 3: Node Expansion
- [ ] **Writer API Integration** — Call Chrome Writer API to expand nodes
- [ ] **Child Node Generation** — Parse 2-4 child nodes from AI response
- [ ] **Tree Update** — Add children to parent node, update IndexedDB
- [ ] **Embedding Generation** — Call Embeddings API for each new node
- [ ] **Morton Key Computation** — Use `computeMortonKeyFromEmbedding()` from indexer
- [ ] **Index Update** — Save Morton keys to `mortonIndex` store

### Phase 4: Semantic Search
- [ ] **Search UI** — Input bar with debounced queries
- [ ] **Query Embedding** — Generate embedding for search text
- [ ] **Range Scan** — Use `rangeScanByMortonHex()` to fetch candidates
- [ ] **Cosine Reranking** — Compute cosine similarity on full embeddings
- [ ] **Result Highlighting** — Visualize matching nodes on canvas

### Phase 5: Export & Polish
- [ ] **JSON Export** — Serialize full fractal tree
- [ ] **Markdown Export** — Convert tree to nested bullet list
- [ ] **Subtree Filtering** — Export only selected branches
- [ ] **Node Editing** — Allow users to edit titles/text
- [ ] **Rewriter Integration** — Use Prompt API to rephrase or summarize
- [ ] **Animations** — Smooth transitions for expand/collapse
- [ ] **Keyboard Navigation** — Arrow keys, Enter, Space shortcuts
- [ ] **Accessibility Audit** — Screen reader testing, ARIA improvements

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
