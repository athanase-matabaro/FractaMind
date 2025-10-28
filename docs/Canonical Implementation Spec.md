# FractaMind — Canonical Implementation Spec 

This is **the** canonical single source of truth for FractaMind. It expands the earlier spec with explicit API contracts, exact prompt templates, developer checklists, performance expectations, accessibility and privacy considerations, and a clear launch checklist for the hackathon.

> Version: 0.2 — Expanded implementation & engineering details
> Last updated: 2025-10-28

---

## Overview (one line)

FractaMind is a client-side web app + optional Chrome Extension that transforms text into an explorable, zoomable fractal of ideas; it runs summarization, expansion, and embedding generation locally via Chrome Built-in AI (Gemini Nano APIs) and stores data in IndexedDB for privacy and offline access.

---

## Table of contents

A. Technical goals & non-goals
B. Precise feature list (MVP + Phase 1 + Stretch)
C. Data model (JSON Schema, example payloads, and field-level semantics)
D. Local AI API contracts (requests/responses)
E. Exact Prompt Templates (copy-paste ready)
F. Indexing & search algorithm (embedding, dimensionality, mapping to key space, search pipeline)
G. Fractal renderer API & interaction contract (events, lifecycle)
H. Onboarding flows + microcopy (finalized)
I. Personalization storage and signals
J. Persistence, backup, and export formats
K. Performance expectations and test plan
L. Privacy, security, and compliance notes
M. Developer checklist & hackathon timeline
N. Demo script & recording checklist
O. Appendix: helper pseudocode, libraries & resources

---

## A. Technical goals & non-goals

**Goals**

* Fully client-side AI interactions using Chrome Built-in AI APIs: Summarizer, Writer, Prompt, Embeddings (or equivalent). No server needed for MVP.
* Fast visual interaction: generate top-level fractal from 1–2k words in ≤10s on typical laptop/mobile device (Gemini Nano latency dependent).
* Local, privacy-preserving storage in IndexedDB with export/import JSON.
* Clean API boundaries for a local agent to call expand/summarize/search deterministically.

**Non-goals (for the hackathon)**

* Real-time multi-user collaboration (server required).
* Heavy-duty ANN libraries in WASM (may be considered post-hackathon).

---

## B. Precise feature list

**MVP (must-have for hackathon)**

1. Text import (clipboard + paste + URL text extraction for simple pages).
2. Top-level Summarizer: turn document → 3–7 nodes. Uses Summarizer API with JSON output.
3. Zoomable fractal canvas (SVG/Canvas).
4. Expand node → Writer API: produces 2–4 child nodes per expand.
5. Local Embeddings: generate embedding vector for each node and store.
6. Simple semantic search: linear scan or hilbert-key-assisted range scan returning top-K.
7. Persistent storage: IndexedDB store for nodes, embeddings, metadata, and prefs.
8. Onboarding: micro-commitment + animated seed build.
9. Export: export current project as JSON and Markdown summary.

**Phase 1 (nice-to-have)**

* Hilbert / Morton ordering for faster locality searches.
* Preferences & persona presets (concise vs detailed, academic vs creative).
* Node-editing & Rewriter API integration.
* Visual polish: node growth animations, color depth based on node depth.

**Stretch (optional)**

* Image/audio multimodal node inputs using Prompt API multimodal support.
* Optional Firebase sync/hybrid mode.
* Exporters for Notion/Obsidian, deep-link share.

---

## C. Data model — JSON Schema + examples

**Canonical FractalProject (root)**

```json
{
  "id": "project-uuid",
  "title": "Project title",
  "rootNodeId": "node-1-uuid",
  "nodes": {"node-1-uuid": {...}, "node-2-uuid": {...}},
  "prefs": {...},
  "createdAt": "2025-10-28T08:00:00Z",
  "updatedAt": "2025-10-28T08:10:00Z",
  "version": "0.2"
}
```

**FractalNode schema (concise)**

```json
{
  "id": "uuid-v4",
  "title": "short title",
  "text": "full node text",
  "summary": "optional summary",
  "children": ["id1","id2"],
  "parent": "id or null",
  "embedding": [0.001, -0.22, ...],
  "hilbertKey": 1234567890,
  "meta": {
    "sourceUrl": "https://...",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601",
    "createdBy": "local"
  },
  "history": [{"type":"create","at":"ISO8601"}]
}
```

**Field-level semantics (short)**

* `embedding`: float32 vector (length 768 or API-provided). Stored as Float32Array -> Base64 or compressed typed array for IndexedDB.
* `hilbertKey`: 64-bit integer mapping from quantized embedding coordinates for locality queries. Use Morton (Z-order) if Hilbert library unavailable.
* `history`: small delta objects to avoid storing full snapshots.

**Example node (realistic)**

```json
{
  "id":"node-1-uuid",
  "title":"Fractal Search: idea",
  "text":"Fractal Search is a concept where we map embeddings using a space-filling curve...",
  "summary":"Map embeddings to 1D to preserve locality.",
  "children":["node-2-uuid","node-3-uuid"],
  "parent":null,
  "embedding":[0.012,-0.333,0.77,...],
  "hilbertKey":834723984723,
  "meta":{"createdBy":"local","createdAt":"2025-10-28T09:05:00Z","sourceUrl":""},
  "history":[{"type":"create","at":"2025-10-28T09:05:00Z"}]
}
```

---

## D. Local AI API contracts (client-facing endpoints)

These are not server endpoints — they are local client functions wrapping the Chrome Built-in AI calls. Keep them deterministic and idempotent where possible.

**1) expandNode**

* Input:

```js
{ action: 'expand', nodeId: 'uuid', style: 'concise' }
```

* Output:

```js
{ status: 'ok', parentId:'uuid', newNodes: [ {id, title, text, embedding, hilbertKey, meta} ], timeMs: 1200 }
```

* Notes: Expand should be safe to call multiple times; duplicate child detection uses content hash.

**2) summarizeNode**

* Input: `{ action: 'summarize', nodeId: 'uuid', maxPoints: 5 }`
* Output: `{ status: 'ok', nodeId: 'uuid', summary: '...', timeMs: 600 }`

**3) searchQuery**

* Input: `{ action: 'search', query: 'string', topK: 10 }` or `{ action: 'search', queryEmbedding: [...], topK }`
* Output: `{ status:'ok', results: [{nodeId, score, title, snippet}], timeMs }`

**4) importDocument**

* Input: `{ action: 'import', text: '...', sourceUrl: '' }`
* Output: `{ status:'ok', projectId:'project-uuid', rootNodeId:'node-1-uuid' }`

**Error contract**

* Always return structured errors: `{ status:'error', code:'RATE_LIMIT'|'API_ERROR'|'IO_ERROR', message:'...'}`

---

## E. Prompt templates (copy-paste ready)

Use the Prompt API with `response_format: application/json` if available; otherwise parse with robust JSON extraction logic.

**Summarize Document → Top-level nodes**

```
System: You are a concise summarizer. Return JSON array of 5 objects.
User: Summarize the following document into 5 distinct subtopics. For each subtopic return:
- title (max 6 words)
- summary (one short sentence)
- keyPoints (2 short bullet points)
Document: "{document_text}"

Return strictly valid JSON like: [{"title":"...","summary":"...","keyPoints":["...","..."]}, ...]
```

**Expand Node → Child nodes**

```
System: You are an idea-expander. Output JSON array of 3 objects.
User: Given this node title and text, generate 3 child nodes that expand it. For each child return:
- title (5 words max)
- text (2-3 sentences)
Keep output as valid JSON.
NodeTitle: "{title}"
NodeText: "{text}"
```

**Rewriter (tone/length control)**

```
System: You rewrite content in a requested style.
User: Re-write the following text in a {tone} tone and approx {wordCount} words. Preserve meaning but adapt style.
Text: "{text}"

Return only the rewritten text.
```

**Embedding call**

* Use the embedding endpoint the Built-in AI provides. Send `text` and receive vector.

**Robustness tip**

* Wrap parsing in a tolerant JSON parser that can recover from stray backticks, trailing commas, or prefix text. If parsing fails, fallback to plain-text extraction using regex patterns (titles and bullet points heuristics).

---

## F. Indexing & search algorithm (detailed)

Design goal: fast candidate retrieval on client with limited resources. We'll use a hybrid approach: quantized embedding → Morton key (Z-order) → range scan → re-rank.

**1) Embedding vector size**

* Assume API returns 512–1536 floats depending on model. Use whichever length is native. For storage, downcast to Float32.

**2) Dimensionality reduction**

* For key computation, reduce to D=8–16 dims using random projection or PCA (cheap O(n*d^2) offline per project). Keep full embedding for ranking.

**3) Quantization**

* Normalize each reduced dim to [0, 1] using per-project min/max, then quantize to 16-bit integer (0..65535).

**4) Morton (Z-order) key**

* Interleave bits of quantized dims to produce a 64- or 128-bit key (use BigInt for JS). This yields a key where nearby vectors in space map to numerically nearby keys approximately.
* Store (hilbertKey) as stringified BigInt or hex for IndexedDB key ordering.

**5) Storage**

* Keep an IndexedDB object store `nodes` keyed by `id` with `hilbertKey` index sorted.
* Also keep `hilbertIndex` store mapping `hilbertKey` → `nodeId` for range queries.

**6) Query pipeline**

1. Query → embedding vector (qvec).
2. Reduce dims → quantize → compute queryKey.
3. Determine window radius: start with ±R where R is 2^k based on expected density; fetch nodes whose hilbertKey in [queryKey-R, queryKey+R] (range scan using IDB cursor).
4. Compute cosine similarity between full embeddings for fetched candidates and qvec.
5. Return top-K ranked results.

**Fallback**

* If candidate set small, widen radius until minCandidates reached or until limit (500 nodes) to avoid long scans.

**Complexity expectation**

* Average retrieval should read O(k) nodes where k << N for good quantization. For small projects (N<5000) linear scan is still acceptable on modern devices.

---

## G. Fractal renderer & interaction contract

**Renderer responsibilities**

* Render nodes with their `title` and a short snippet.
* Smoothly animate node addition, removal, expansion, collapse, and selection.
* Emit UI events to the app layer: `node:expand`, `node:collapse`, `node:select`, `canvas:zoom`, `node:drag`.

**Event payloads**

* `node:expand` → `{ nodeId: '...', position: {x,y} }`
* `node:select` → `{ nodeId }`
* `canvas:zoom` → `{ scale, center: {x,y} }`

**Lifecycle**

* On import: renderer receives project root and renders root node with children placeholders.
* Expand sequence: animate spinner on node -> await local expandNode -> animate new children growing from parent.

**Accessibility**

* Renderer must support keyboard navigation: arrow keys move focus; Enter expands; Space toggles summary.
* All nodes must have accessible labels for screen readers.

---

## H. Onboarding flows (finalized copy)

**Welcome screen**

* Headline: "Meet FractaMind — your private map of ideas."
* Subhead: "Paste an article or a paragraph and watch your thoughts grow into an explorable fractal."
* CTA primary: "Start with text" | secondary: "See demo".

**Micro-commitment**

* Field placeholder: "Paste 1–3 paragraphs or a URL"
* Help: "We’ll turn this into a zoomable idea map — no data leaves your device."

**3-step tour**

1. Zoom: "Pinch/scroll to zoom in and out of ideas."
2. Expand: "Click a node to grow related ideas."
3. Search & Save: "Search locally and save your project."

**Emotional microcopy**

* On seed complete: "Nice — a map of your idea has been born."
* On expand: "Growing ideas — one branch at a time."
* On save: "Saved locally. Only you have access to this map."

---

## I. Personalization (storage & signals)

**prefs object**

```json
{ "tone":"concise","domain":"academic","defaultExpandDepth":2 }
```

**Signals captured (local only)**

* Expand depth used, rewrites (tone chosen), node edit patterns (truncation counts), most used commands.
* Apply simple heuristics: if user often shortens AI expansions by >30% of length, default to `tone: concise`.

**Privacy controls**

* UI control: "Reset personalization" wipes `prefs` and `signals`.

---

## J. Persistence & export formats

* Primary storage: IndexedDB with versioned stores: `projects`, `nodes`, `hilbertIndex`, `prefs`, `cache`.
* Export formats: `project.json` (full), `summary.md` (top-level node summaries), `exportedNodes.csv` (flat).
* Import: allow `project.json` uploads to restore.

---

## K. Performance expectations & test plan

**Benchmarks (targets)**

* 2000-word import → top-level summarization + render: ≤ 10s on mid-range laptop (network independent).
* Expand latency: ≤ 2.5s average when model cached; otherwise small variance depending on device.
* Search query (embedding + range scan + re-rank) for 1k nodes: ≤ 300ms local (approx).

**Testing plan**

1. Unit tests for local DB operations (read/write/rollback).
2. Integration test for expand -> node creation -> render cycle (headless, mock AI).
3. End-to-end demo test using sample document; measure timings and record.
4. Accessibility checks: keyboard navigation + screen reader labels.

---

## L. Privacy & security notes

* No user data leaves the device for core flows. If hybrid sync used (Firebase), it must be opt-in and encrypted at rest using a user-supplied key.
* Store embeddings and texts only in IndexedDB. Avoid logging sensitive content to console in release build.
* For any analytics or crash reporting, require explicit opt-in and anonymize payloads.

---

## M. Developer checklist & hackathon timeline (2-day sprint)

**Pre-hackathon prep (night before)**

* Sign up for Chrome Built-in AI early preview and get API keys & docs.
* Scaffold project (create React+Tailwind scaffold + PWA manifest + extension manifest).
* Implement IndexedDB wrapper (simple CRUD).

**Day 1 (MVP core)**

* Implement import & Summarizer -> top-level nodes (1–3 hours).
* Build basic fractal renderer showing nodes with titles (2–3 hours).
* Implement expandNode pipeline calling Writer API and persisting node (2–3 hours).
* Wire simple UI: import -> animate seed -> enable expand.

**Day 2 (polish & submission)**

* Add embeddings + simple linear search (2 hours).
* Add onboarding micro-commitment and tour (1–2 hours).
* Make export -> project.json & markdown (1 hour).
* Record the 3-minute demo video (2 hours including edits).
* Write README, license, and submission form content (1 hour).

---

## N. Demo script (finalized <3 minutes)

1. 0:00–0:06 — Title card / tagline.
2. 0:06–0:20 — Paste a paragraph; show animated seed generation; voice: "Paste an idea; FractaMind turns it into a map locally."
3. 0:20–0:40 — Expand a node; show child nodes generated live (caption: "Expand — AI generates branches").
4. 0:40–0:55 — Do a quick search for a keyword; highlight returned nodes.
5. 0:55–1:15 — Edit a node and run Rewriter to make it concise; show saved change.
6. 1:15–1:35 — Export to Markdown; show local file saved.
7. 1:35–1:50 — Mention privacy & offline: show settings toggling offline mode.
8. 1:50–2:45 — Show one real use-case briefly (student summarizing article -> building notes).
9. 2:45–3:00 — Closing: show repo link and invite judges to open-source repo (license noted).

---

## O. Appendix: helper pseudocode & libraries

**Morton key helper (conceptual)**

```js
function quantize(vec, mins, maxs, bits=16) {
  // normalize and quantize to integer
}
function mortonKey(quantizedArray) {
  // interleave bits into BigInt
}
```

**Search pseudocode**

```js
async function localSearch(queryText, topK=10) {
  const qvec = await ai.embed(queryText)
  const qreduced = project(qvec)
  const qkey = mortonKey(quantize(qreduced))
  const window = computeWindow(qkey)
  const candidates = idb.rangeScan(window)
  const scored = candidates.map(c => ({ id:c.id, score:cosine(qvec, c.embedding) }))
  return topKByScore(scored, topK)
}
```

**Recommended libs & resources**

* D3.js for layout & transitions (or Three.js if 3D desired).
* localForage (wrapper over IndexedDB).
* hilbert / morton JS libraries (search npm for 'hilbert' / 'morton').
* Chrome Built-in AI docs (Prompt API / Summarizer / Writer / Embedding) — the project depends on access.

---

## Final notes & next steps (what I updated)

I expanded the canonical implementation spec to include: precise local API contracts, copy-paste-ready prompt templates, an explicit indexing & search pipeline using Morton (Z-order) keys, detailed onboarding microcopy, accessibility notes, performance targets, and a clear hackathon timeline. This document is designed to be handed to a small dev team (or your local agent) so they can start implementing without further questions.

Next tangible outputs I can produce immediately (pick any):

* A ready-to-run React starter repository (files scaffolded + minimal Canvas renderer).
* Exact JS code for the IndexedDB wrapper + morton key generator.
* Copy-paste prompt payloads formatted for Chrome Built-in AI Prompt API calls (JSON).
* The 3-minute demo narration script and a storyboard with timestamps.

"I already picked the next file to produce earlier; choose one from the four above and I'll generate it now."
