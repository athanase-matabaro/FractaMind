# FractaMind 🧠

> Transform any text into an explorable fractal of ideas — privately, in your browser.

**FractaMind** is a privacy-first, client-side web application that turns documents, articles, and notes into an interactive, zoomable fractal visualization. Each idea branches into sub-ideas, which branch further — like navigating knowledge the way you'd explore a fractal landscape.

---

## The Problem

Information overload is real. Long articles, research papers, and documentation are hard to digest. Traditional outlines are static. Search is often too broad or too narrow. We need a way to:

- **Explore knowledge spatially** — zoom in for details, zoom out for context
- **Discover connections** — find semantically similar ideas across your knowledge base
- **Preserve privacy** — keep sensitive notes and research fully offline

FractaMind solves this by combining fractal visualization with local AI-powered summarization and semantic search — all running in your browser, with zero data leaving your device.

---

## What It Does

1. **Import** — Paste text, drop a document, or extract from a URL
2. **Summarize** — Chrome Built-in AI (Gemini Nano) generates 3-7 top-level idea nodes
3. **Explore** — Click a node to expand it into 2-4 child nodes; zoom in/out to navigate the fractal
4. **Search** — Semantic search powered by local embeddings and Morton (Z-order) indexing
5. **Export** — Save your fractal as JSON or Markdown for reuse in Notion, Obsidian, etc.

**All AI operations run locally.** No API keys. No cloud services. Your data never leaves your device.

---

## Key Features (MVP)

- ✅ **Privacy-first architecture** — Chrome Built-in AI APIs (Summarizer, Writer, Embeddings, Prompt)
- ✅ **Fractal visualization** — Zoomable canvas/SVG renderer with depth-based styling
- ✅ **Recursive expansion** — Click any node to generate child ideas
- ✅ **Semantic search** — Fast locality-preserving search using Morton curve indexing
- ✅ **Offline-ready** — IndexedDB persistence; works without network
- ✅ **Keyboard accessible** — Arrow keys, Enter, Space navigation; screen reader support
- ✅ **Export** — JSON and Markdown formats

---

## Architecture Summary

FractaMind is built on three core layers:

### 1. **AI Layer** (Chrome Built-in AI)
- **Summarizer API** — Generate top-level nodes from documents
- **Writer API** — Expand nodes into child ideas
- **Prompt API** — Structured JSON generation and rewriting
- **Embeddings API** — Generate 512-1536 dim vectors for semantic search

### 2. **Indexing Layer** ([fractamind-indexer.js](src/db/fractamind-indexer.js))
- **IndexedDB** wrapper for persistent node storage
- **Morton (Z-order) key** computation for embeddings
  - Dimension reduction (full vector → 8-16 dims)
  - Quantization (float → 16-bit integers)
  - Bit interleaving (multi-dim → 1D sortable key)
- **Range search** — Fast `O(log n)` locality queries for semantic neighbors

### 3. **Frontend** (React + Canvas/SVG)
- **ChoreComponent** — Onboarding hero widget for text import
- **Fractal renderer** — Zoomable visualization with pan/zoom gestures
- **Node editor** — Expand, collapse, edit, and delete nodes

### Data Model

Each **FractalNode** stores:
- `id` (UUID), `title` (5-6 words), `text` (full content), `summary`
- `embedding` (full vector for ranking), `hilbertKeyHex` (Morton key for indexing)
- `children` (array of child IDs), `parent` (parent ID or null)
- `meta` (sourceUrl, createdAt, createdBy)

See [CLAUDE.md](CLAUDE.md) for complete data schemas and indexing algorithms.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Chrome Canary** 128+ with Chrome Built-in AI enabled:
  1. Navigate to `chrome://flags`
  2. Enable `#optimization-guide-on-device-model` and `#prompt-api-for-gemini-nano`
  3. Restart Chrome
  4. Visit `chrome://components` and download "Optimization Guide On Device Model"

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/fractamind.git
cd fractamind

# Install dependencies
npm install
```

### Development Server

```bash
# Start Vite dev server (hot reload enabled)
npm start

# App will open at http://localhost:5173
```

### Build for Production

```bash
# Create optimized bundle in /dist
npm run build

# Preview production build
npm run preview
```

---

## Usage

### 1. Launch the App
Open Chrome Canary and navigate to `http://localhost:5173` after running `npm start`.

### 2. Import Text
- The **ChoreComponent** modal will appear on first load
- Paste text (up to ~10,000 words) or a URL to extract
- Click **Submit** — the app will generate 3-7 top-level summary nodes

### 3. Explore the Fractal
- **Click a node** to expand it into 2-4 child ideas
- **Zoom/pan** using mouse wheel or pinch gestures
- **Search** using the search bar (semantic similarity ranking)

### 4. Export
- Click **Export** → choose JSON or Markdown
- Import into Notion, Obsidian, or save for later

---

## Developer Notes

### Key Files

- [src/db/fractamind-indexer.js](src/db/fractamind-indexer.js) — IndexedDB + Morton key indexing
- [docs/Canonical Implementation Spec.md](docs/Canonical%20Implementation%20Spec.md) — Complete technical specification
- [CLAUDE.md](CLAUDE.md) — Project overview, conventions, prompt templates
- [src/components/chore-component/](src/components/chore-component/) — Initial onboarding UI component

### Prompt Templates

All AI prompt templates are documented in [CLAUDE.md](CLAUDE.md#prompt-templates). Key prompts:

- **Document Summarization** — Extract 5 top-level subtopics with titles + key points
- **Node Expansion** — Generate 3 child nodes from a parent node
- **Search Reranking** — Use cosine similarity on full embeddings after Morton range scan

### Running Tests

```bash
# Run all tests (Jest + React Testing Library)
npm test

# Watch mode for development
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Linting

```bash
# Check code style (ESLint)
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

---

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup and workflow
- Code style conventions
- Pull request guidelines

---

## Next Steps (Development Roadmap)

- [ ] **Import Pipeline** — Text extraction from URLs, PDFs, and clipboard
- [ ] **Summarizer Integration** — Connect Chrome Summarizer API to generate top-level nodes
- [ ] **Fractal Renderer** — Canvas/SVG visualization with zoom, pan, and depth-based styling
- [ ] **Node Expansion** — Wire Writer API to expand nodes into children
- [ ] **Indexer Integration** — Generate embeddings, compute Morton keys, and persist nodes
- [ ] **Semantic Search** — Range scan + cosine reranking for top-K results
- [ ] **Export Flows** — JSON and Markdown export with subtree filtering
- [ ] **Visual Polish** — Animations, color gradients by depth, accessibility improvements

---

## Performance Targets

- **Import → Render** (2000 words): ≤10s
- **Node Expansion**: ≤2.5s (model cached)
- **Search Query** (1k nodes): ≤300ms

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Credits

Built with:
- [Chrome Built-in AI](https://developer.chrome.com/docs/ai/built-in) (Gemini Nano)
- [React](https://react.dev) + [Vite](https://vitejs.dev)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- Morton curve indexing inspired by [Spatial Indexing Algorithms](https://en.wikipedia.org/wiki/Z-order_curve)

Created for exploring knowledge fractally. Contributions and feedback welcome!

---

**NOTE**: This project is in early MVP stage. The `chore-component` is a placeholder name for the initial onboarding widget — renaming is straightforward (see [src/components/chore-component/](src/components/chore-component/)).
