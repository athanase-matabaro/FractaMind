Project summary (elevator pitch)

FractaMind — a privacy-first, client-side “fractal knowledge explorer.”
Turn any text (webpage, note, research doc) into a navigable fractal of ideas: zoom to expand ideas into sub-ideas, zoom out to get summaries, and search with a locality-preserving fractal index for fast offline lookup — all powered locally with Chrome Built-in AI (Gemini Nano + Summarizer/Writer/Prompt APIs). It’s for writers, students, researchers, and curious minds who want a visual, recursive way to think.

Core value propositions

Recursive discovery: Users explore ideas by zooming like a fractal — not just nested lists.

Privacy & offline: All AI runs client-side, no data leaves the device. Great for sensitive research.

Speed & locality: Space-filling curve (e.g., Hilbert) based indexing keeps related concepts near each other for fast local searches.

Beautiful demo: Strong visual and interaction design — judges love it.

High-level user flows

Import / Capture — paste a webpage URL, paste text, or drag a file.

Fractalize — the app creates a top-level summary, then auto-suggests child nodes (subtopics). Each child is a node in the fractal.

Explore — visually zoom/expand nodes; each expansion triggers a local Writer API call to generate deeper nodes or the Summarizer to collapse.

Search — semantic search uses locally computed embeddings mapped via a Hilbert curve to a sorted 1-D index for fast candidate retrieval.

Edit & Save — user edits node text, merges nodes, pins nodes. Local storage / optional Firebase sync (hybrid) for cross-device.

MVP features (what to build for hackathon)

Minimal scope to win:

Import text from clipboard or URL (fetch + local parse).

Generate top-level 3–5 summary nodes (Summarizer API).

Visual fractal UI: interactive zoomable nodes rendered in Canvas/SVG/Three.js.

Expand node → Writer API generates 3 child nodes. Collapse → Summarizer returns condensed text.

Local semantic search: generate embeddings (client-side API), index them; simple K-NN retrieval.

Chrome Extension or PWA with offline capability.

Demo video showing import → fractal exploration → search → export.
APIs used: Prompt API (for structured generation), Writer, Summarizer, and Embedding/Prompt for semantic search.

Stretch / wow features (if time allows)

Hilbert curve mapping to linearize embeddings for fast range queries & cache-friendly storage.

Save/load fractals as JSON with history + versioning.

Deep-linkable nodes (share a URL that opens the app at that zoom/branch).

Multi-modal nodes: attach images/audio that the Prompt API can analyze.

Notebook integration: export to markdown, Notion, Obsidian.

Customizable generative “styles” (concise, poetic, technical).

Fractal diffing (compare two versions by overlaying fractal trees).

Technical architecture (client-side focused)

Frontend: React + Zustand (or Redux) for state; Canvas / SVG with D3 or Three.js for zoomable fractal rendering. Tailwind for quick UI.

Build target: PWA + Chrome Extension (same code with tiny wrapper).

AI: Chrome Built-in AI (Gemini Nano) via Prompt API, Writer API, Summarizer API, Embeddings (if provided). Everything invoked client-side.

Storage: IndexedDB for offline persistence (store fractal JSON, embeddings index). Optionally Firebase for hybrid sync.

Search index: store embeddings in IndexedDB; for speed precompute a Z-order or Hilbert index value per embedding to store sorted keys. For retrieval: do coarse range scan (by index) → fine-grain re-rank with cosine similarity.

Communication flow: UI actions → local AI API call → update node tree → persist.

Data structures & algorithm details

Fractal node (JSON):

{
  "id": "uuid",
  "text": "...",
  "summary": "...",
  "children": ["id1","id2"],
  "parent": "id0",
  "embedding": [0.12, -0.33, ...],
  "hilbertKey": 123456789
}


Indexing pipeline

Generate embedding for node text (Gemini/embed or local equivalent).

Project embedding to lower dim (e.g., PCA or product quantization) if needed.

Map to integer coordinates and compute Hilbert/Z-order key.

Store node with key in a sorted store (IndexedDB using key as index).
Search

Query embedding → compute query Hilbert key → find range around key (±k) → fetch candidates → compute cosine similarity → return top-K.

UI / Interaction patterns (make it feel fractal)

Canvas zoom (pinch/scroll): zoom out shows summaries; zoom in expands nodes progressively.

Click or double-tap node to expand synchronously (UI shows spinner while Gemini Nano writes).

Hover shows micro-summary tooltip.

Breadcrumb-like overlay shows path to root.

Keyboard shortcuts: e = expand, s = summarize, / = search.

Prompt engineering — templates

Top-level summarize (Summarizer API):

[IN]: {document_text}
[PROMPT]: Summarize this document into 5 concise, distinct subtopics. For each subtopic return: title (5 words max), 1-sentence description, and 2 bullet points of detail. Output JSON.


Expand node (Writer API):

[IN]: Node title: {title}, Node text: {text}
[PROMPT]: Generate 3 child nodes that meaningfully expand this node. For each child return: title, 2-sentence explanation. Output JSON array.


Refactor / Rewriter (for user edits):

[PROMPT]: Rephrase this node text in a {tone} tone (concise / detailed / technical). Keep semantics but adjust length to ~{N} words.


Embedding call:

Use API that returns a vector per node text.

Minimal code sketches

Generate child nodes (JS pseudocode)

async function expandNode(node) {
  const prompt = buildExpandPrompt(node.title, node.text)
  const response = await chromeAiClient.writer.generate({ prompt })
  const children = parseJson(response.text) // 3 child nodes
  for (const child of children) {
    const id = uuid()
    const text = child.text
    const emb = await chromeAiClient.embed(text)
    const key = hilbertKeyFromEmbedding(emb)
    saveNode({id, text, emb, hilbertKey: key, parent: node.id})
  }
  updateNodeChildren(node.id, childrenIds)
}


Hilbert key (conceptual)

Reduce embedding to 16 dims → normalize to [0, 2^16) → interleave dims into Hilbert key. Use existing JS library for Hilbert or Z-order.

Demo script (≤ 3 minutes) — tightly choreographed

(0:00–0:10) Title card: “FractaMind — Fractal Knowledge Explorer (PWA/Extension)”

(0:10–0:30) Show importing: paste URL → app parses & generates top-level fractal (auto animation).

(0:30–1:10) Zoom into a top node — expand to show child nodes (Writer API live generation). Narration: “zoom to expand, summarize to compress.”

(1:10–1:40) Show semantic search: type a query → fast local results come up (visual highlight on fractal). Mention Hilbert index/local search.

(1:40–2:10) Edit a node (user changes text), show Rewriter API to convert tone; persist locally.

(2:10–2:40) Show export to Markdown / share link demonstration.

(2:40–3:00) Close with “why this matters” + callouts: privacy (client-side), offline, multimodal-ready.

GitHub repo layout (what judges will check)
/fractamind
  /public
  /src
    /components
    /ai (wrappers for Prompt/Writer/Summarizer)
    /viz (canvas fractal renderer)
    /db (IndexedDB + indexer)
    /utils (hilbert, embedding helpers)
  manifest.json (for extension)
  README.md (how to run locally, license)
  demo.mp4 (or link)
  LICENSE


Include sample dataset and quickstart scripts.

Judging criteria and how we win

Novelty & UX: visually unique fractal navigation; judges love novel UX that demonstrates real thought.

Technical use of Built-in AI: do live client-side calls and show how you use multiple APIs. Mention offline mode.

Impact / Practicality: pick a use-case for hackathon — e.g., research note-taking for students, journalist research tool. Include user flow benefits.

Feasibility: keep MVP small and dependable.

Risks & mitigation

Latency of client-side generation: show graceful UI states and local caching; pre-generate children when idle.

Embedding size/storage: quantize embeddings and store in IndexedDB. Only store top-k per node if necessary.

Complexity of Hilbert mapping: implement simple Z-order curve (Morton) if Hilbert is too slow to code. It’s still locality-preserving.

Metrics to show in submission

Time to generate top-level fractal from a 2000-word document.

Average expand latency (ms).

Storage footprint for 100 nodes (MB).

Search recall/precision demo on simple dataset (qualitative).

Roadmap for hackathon (2-day plan)

Day 0 (prep): set up project scaffold, read Chrome AI docs, craft prompt templates.

Day 1 (MVP): implement import + Summarizer calls, basic fractal renderer, expand node writer pipeline, IndexedDB store.

Day 2 (polish): implement embeddings + fast search, add export, finalize demo video, README, cleanup and tests.

Deliverables for submission

Public GitHub repo with license and README.

Working hosted demo (Vercel/Netlify) or Chrome extension package + instructions.

<3-minute demo video on YouTube/Vimeo.

Short written description (what APIs used, problem statement, features).

Quick UX copy/snippets (for README & demo)

“FractaMind organizes knowledge like nature organizes branches: expand where you need detail, collapse to see the whole.”

“Uses Gemini Nano locally via Chrome Built-in AI: Summarizer, Writer, Prompt, and Embeddings.”

Small creative ideas to make judges smile

Animated fractal transition synced to the AI generation (child nodes ‘grow’ like branches).

Easter-egg mode: “fractalist” theme that turns your notes into a printable fractal poster (fun visualization).

A “merge nodes” animation that shows two branches fusing into one.