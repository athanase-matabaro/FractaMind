# Phase 6: Contextualization and Semantic Linking

**Status:** ✅ Implemented (v1.0)
**Date:** January 2025
**Feature Flag:** `FEATURE_CONTEXTUAL_LINKS` (enabled by default)

## Overview

Phase 6 introduces a contextualization layer that automatically discovers and suggests semantic relationships between nodes in the knowledge graph. The system uses multi-signal confidence scoring to identify meaningful connections and provides a user-friendly interface for accepting or rejecting suggestions.

### Key Features

- **Automated Link Discovery**: Morton-range prefiltering + cosine similarity re-ranking
- **Multi-Signal Confidence Scoring**: Semantic, lexical, AI, and contextual signals
- **9 Relation Types**: Clarifies, contradicts, elaborates, example-of, causes, depends-on, similar-to, references, related
- **Provenance Tracking**: Complete history of how links were created, updated, and by whom
- **Interactive UI**: Accept/reject suggestions with confidence meters and rationale
- **Performance Optimized**: <300ms for suggestion generation on 2k nodes

---

## Architecture

### Core Modules

#### 1. **Linker** (`src/core/linker.js`)

Manages the lifecycle of semantic links between nodes.

**Key Functions:**

```javascript
// Create a new semantic link
await createLink({
  projectId: 'my-project',
  sourceNodeId: 'node-a',
  targetNodeId: 'node-b',
  relationType: 'clarifies',
  confidence: 0.85,
  provenance: {
    method: 'auto-suggestion',
    note: 'High semantic similarity',
    aiPrompt: 'Clarifies: explains the concept',
    timestamp: new Date().toISOString(),
  },
});

// Query links by filters
const links = await queryLinksFiltered({
  sourceNodeId: 'node-a',
  projectId: 'my-project',
  relationType: 'clarifies',
  limit: 10,
});

// Compute confidence from signals
const confidence = computeLinkConfidence({
  semantic: 0.9,   // Cosine similarity
  ai: 0.8,         // AI extraction confidence
  lexical: 0.6,    // N-gram overlap
  contextual: 0.5, // Context decay bias
});
// Returns: 0.8 (weighted average)
```

**Validation:**
- No self-links (sourceNodeId ≠ targetNodeId)
- Confidence ∈ [0, 1]
- Relation type must be in taxonomy
- All required fields present

#### 2. **Contextualizer** (`src/core/contextualizer.js`)

Generates semantic link suggestions using spatial indexing and similarity scoring.

**Algorithm:**

```
1. Fetch source node and embedding
2. Morton-range prefilter: Get ~topK*3 candidates from spatial index
3. For each candidate:
   a. Compute semantic similarity (cosine)
   b. Compute lexical similarity (tri-gram Jaccard)
   c. Compute contextual bias (recency decay)
   d. Calculate preliminary score: 0.6*semantic + 0.2*lexical + 0.2*contextual
4. Filter by similarity threshold (default: 0.78)
5. Sort by preliminary score, take top 2*topK
6. Generate relation labels (mock or AI)
7. Compute final confidence scores
8. Sort by final score, return topK
```

**Usage:**

```javascript
const suggestions = await suggestLinks('source-node-id', {
  topK: 8,
  mode: 'mock',              // 'mock' or 'live'
  projectId: 'my-project',
  includeContextBias: true,
  contextHistory: {
    recentNodes: ['node-1', 'node-2'],
    recencyWindow: 3600000,  // 1 hour in ms
  },
});

// Returns array of suggestions:
// [
//   {
//     candidateNodeId: 'node-x',
//     title: 'Deep Learning Basics',
//     snippet: 'Deep learning is a subset...',
//     relationType: 'elaborates',
//     rationale: 'Elaborates: provides detailed explanation',
//     confidence: 0.87,
//     score: 0.87,
//     similarity: 0.91,
//     mode: 'mock',
//     timestamp: '2025-01-07T...',
//   },
//   ...
// ]
```

#### 3. **Searcher** (`src/core/searcher.js`)

Extended with pairwise scoring for confidence computation.

```javascript
// Compute similarity between two nodes
const similarity = await scorePair('node-a', 'node-b');
// Returns normalized similarity ∈ [0, 1]
```

---

## Data Model

### Link Schema

```javascript
{
  linkId: 'link_proj_src_tgt_timestamp_random',
  projectId: 'project-123',
  sourceNodeId: 'node-a',
  targetNodeId: 'node-b',
  relationType: 'clarifies',
  confidence: 0.85,
  provenance: {
    method: 'manual' | 'auto-suggestion' | 'auto-backfill',
    note: 'User accepted suggestion',
    aiPrompt: 'AI-generated rationale',
    timestamp: '2025-01-07T...',
  },
  weight: 1.0,
  active: true,
  metadata: {
    sourceTitle: 'Neural Networks',
    createdViaUI: true,
  },
  createdAt: '2025-01-07T...',
  updatedAt: '2025-01-07T...',
  history: [
    {
      timestamp: '2025-01-07T...',
      action: 'created',
      note: 'Link created',
    },
    {
      timestamp: '2025-01-08T...',
      action: 'updated',
      note: 'Confidence updated',
      changes: ['confidence'],
    },
  ],
}
```

### IndexedDB Indices

**Store:** `links` (keyPath: `linkId`)

**Indices:**
1. `bySource` (sourceNodeId) - Find all outgoing links
2. `byTarget` (targetNodeId) - Find all incoming links
3. `byProjectId` (projectId) - Project-scoped queries
4. `byRelationType` (relationType) - Filter by relation
5. `byConfidence` (confidence) - Sort by confidence
6. `byActive` (active) - Filter inactive links
7. `bySourceAndType` ([sourceNodeId, relationType]) - Compound index
8. `byTargetAndType` ([targetNodeId, relationType]) - Compound index

**Query Performance:** <50ms for filtered queries (target)

---

## Relation Taxonomy

| ID | Icon | Label | Description | Use Case |
|----|------|-------|-------------|----------|
| `clarifies` | 💡 | Clarifies | Explains or elaborates on the target | Node A explains concept in Node B |
| `contradicts` | ⚠️ | Contradicts | Presents conflicting information | Node A disputes claim in Node B |
| `elaborates` | 📝 | Elaborates | Provides detailed expansion | Node A adds depth to Node B |
| `example-of` | 🔍 | Example Of | Concrete instance of abstract concept | Node A exemplifies Node B |
| `causes` | ➡️ | Causes | Causal relationship | Node A leads to Node B |
| `depends-on` | 🔗 | Depends On | Prerequisite relationship | Node A requires Node B |
| `similar-to` | ↔️ | Similar To | Analogous concepts | Node A resembles Node B |
| `references` | 📚 | References | Citation or mention | Node A cites Node B |
| `related` | 🔗 | Related | General association | Default catch-all |

---

## Confidence Scoring

### Formula

```
confidence = w_semantic * semantic_sim
           + w_ai * ai_confidence
           + w_lexical * lexical_sim
           + w_contextual * context_bias
```

### Default Weights

```javascript
{
  semantic: 0.5,    // Embedding cosine similarity
  ai: 0.3,          // AI relation extraction confidence
  lexical: 0.1,     // N-gram overlap (tri-grams)
  contextual: 0.1,  // Recency decay bias
}
```

### Signal Computation

**1. Semantic Similarity**
```javascript
// Cosine similarity of embeddings, normalized to [0, 1]
const rawSim = cosineSimilarity(embA, embB); // ∈ [-1, 1]
const semantic = (rawSim + 1) / 2;            // ∈ [0, 1]
```

**2. Lexical Similarity**
```javascript
// Jaccard similarity on character tri-grams
const ngrams1 = getNGrams(text1, 3);
const ngrams2 = getNGrams(text2, 3);
const intersection = ngrams1 ∩ ngrams2;
const union = ngrams1 ∪ ngrams2;
const lexical = |intersection| / |union|;
```

**3. AI Confidence**
- Mock mode: Uses semantic similarity as proxy
- Live mode: Confidence from AI relation extraction (TODO)

**4. Contextual Bias**
```javascript
// Exponential decay based on recency
const halfLife = 72 * 3600 * 1000; // 72 hours
const timeSinceInteraction = now - lastInteractionTime;
const decay = Math.exp(-Math.log(2) * timeSinceInteraction / halfLife);
```

---

## UI Components

### 1. LinkEditor Modal

**Location:** `src/components/NodeDetails/LinkEditor.jsx`

**Features:**
- Source node display (readonly)
- Target node selection (dropdown or pre-filled from suggestion)
- Relation type selector (9 types with icons)
- Confidence slider (0-100%)
- Note textarea for user comments
- Cycle detection with warning
- Form validation (no self-links, required fields)
- Accept/Cancel buttons

**Props:**
```javascript
<LinkEditor
  isOpen={true}
  onClose={() => {}}
  onLinkCreated={(link) => console.log(link)}
  sourceNode={{ id: 'node-a', title: 'Neural Networks' }}
  suggestion={null}  // Or pre-fill from suggestion
  projectId="my-project"
  availableNodes={nodes}
/>
```

### 2. ContextSuggestions Panel

**Location:** `src/components/NodeDetails/ContextSuggestions.jsx`

**Features:**
- Expandable panel with suggestion count badge
- Loading spinner during generation
- Displays 6-8 suggestions with:
  - Relation type badge with icon
  - Confidence percentage meter
  - Node title and snippet (2 lines)
  - AI-generated rationale
- Accept/Reject buttons for each suggestion
- Opens LinkEditor on accept
- Filters out rejected suggestions

**Props:**
```javascript
<ContextSuggestions
  currentNodeId="node-a"
  currentNode={{ id: 'node-a', title: '...' }}
  projectId="my-project"
  availableNodes={nodes}
  onLinkCreated={(link) => {}}
  onSuggestionClick={(suggestion) => {}}
  limit={6}
/>
```

---

## Scripts

### 1. Backfill Links

**Script:** `scripts/backfill_links_from_summaries.js`

Generates suggestions for all nodes and optionally auto-accepts high-confidence links.

```bash
# Dry run to preview
node scripts/backfill_links_from_summaries.js --project my-proj --dry-run

# Backfill with auto-accept threshold
node scripts/backfill_links_from_summaries.js \
  --project my-proj \
  --auto-accept 0.85 \
  --batch-size 50

# Process first 100 nodes
node scripts/backfill_links_from_summaries.js \
  --project my-proj \
  --limit 100 \
  --verbose
```

### 2. Recompute Confidence

**Script:** `scripts/links_recompute_confidence.js`

Recomputes confidence scores for existing links (useful after formula changes or embedding updates).

```bash
# Dry run
node scripts/links_recompute_confidence.js --project my-proj --dry-run

# Recompute with minimum delta filter
node scripts/links_recompute_confidence.js \
  --project my-proj \
  --min-delta 0.05

# Process in batches
node scripts/links_recompute_confidence.js \
  --project my-proj \
  --batch-size 100 \
  --verbose
```

### 3. Performance Measurement

**Script:** `scripts/measure_link_suggest_perf.js`

Benchmarks suggestion engine to validate performance targets.

```bash
# Basic benchmark
node scripts/measure_link_suggest_perf.js --project my-proj

# Comprehensive with JSON output
node scripts/measure_link_suggest_perf.js \
  --project my-proj \
  --samples 50 \
  --output perf-results.json

# With warmup
node scripts/measure_link_suggest_perf.js \
  --project my-proj \
  --warmup 5 \
  --verbose
```

**Targets:**
- Suggestion latency P95: <300ms ✓
- DB query latency P95: <50ms ✓

---

## Testing

### Unit Tests

**Linker:** `tests/core/linker.test.js` (30+ test cases)
- Link creation with validation
- Update/upsert operations
- Querying and filtering
- Confidence scoring
- Lexical similarity
- Cycle detection
- Batch operations
- Statistics

**Contextualizer:** `tests/core/contextualizer.test.js` (25+ test cases)
- Suggestion generation (mock mode)
- Relation type assignment
- Multi-signal confidence scoring
- Filtering and thresholds
- Context bias computation
- Performance characteristics
- Error handling

**PoC Integration:** `tests/core/phase6-poc.test.js`
- End-to-end link creation flow
- Suggestion → Link creation pipeline

### Running Tests

```bash
# Run all Phase 6 tests
npm test tests/core/linker.test.js
npm test tests/core/contextualizer.test.js
npm test tests/core/phase6-poc.test.js

# Run with coverage
npm test -- --coverage
```

---

## Configuration

**File:** `src/config.js`

```javascript
export const FEATURE_FLAGS = {
  FEATURE_CONTEXTUAL_LINKS: true,  // Enable/disable Phase 6
};

export const CONTEXTUALIZATION = {
  SUGGEST_TOP_K: 8,                      // Default suggestions per node
  LINK_SIM_THRESHOLD: 0.78,              // Min similarity for candidates
  CONTEXT_HALF_LIFE_HOURS: 72,           // Recency decay half-life
  LINK_MAX_BATCH: 2000,                  // Max batch size for operations

  CONFIDENCE_WEIGHTS: {
    semantic: 0.5,
    ai: 0.3,
    lexical: 0.1,
    contextual: 0.1,
  },

  RELATION_TYPES: [
    { id: 'clarifies', label: 'Clarifies', icon: '💡', description: '...' },
    // ... 8 more types
  ],
};
```

**Environment Variables:**

```bash
# .env
VITE_FEATURE_CONTEXTUAL_LINKS=true
VITE_CONTEXT_SUGGEST_TOPK=8
VITE_LINK_SIM_THRESHOLD=0.78
VITE_CONTEXT_HALF_LIFE_HOURS=72
VITE_LINK_MAX_BATCH=2000
```

---

## Performance Optimization

### 1. Morton-Range Prefiltering

Instead of comparing against all N nodes, we use spatial indexing:

```
Naive approach:  O(N) comparisons
Morton approach: O(log N + K) where K << N
```

For 2000 nodes, reduces comparisons from 2000 to ~24 candidates.

### 2. Compound Indices

IndexedDB compound indices enable efficient filtered queries:

```javascript
// Fast: Uses bySourceAndType compound index
queryLinks({ sourceNodeId: 'node-a', relationType: 'clarifies' });

// Slow: Full table scan
queryLinks({ confidence: 0.85 });
```

### 3. Batch Operations

```javascript
// Good: Single transaction for 100 updates
await batchUpdateConfidences(updates);

// Bad: 100 individual transactions
for (const update of updates) {
  await upsertLink(update);
}
```

---

## Future Enhancements (Phase 6.1)

### Planned Features

1. **Live AI Mode**
   - Replace mock relation labeling with Writer API
   - Extract relation types from node content with prompts
   - Stream suggestions as they're generated

2. **FractalCanvas Edge Animations**
   - Render semantic links as animated edges
   - Color-code by relation type
   - Animate on link acceptance

3. **Context Manager Integration**
   - Track user navigation history
   - Weight recent nodes in contextual bias
   - Session-aware suggestion ranking

4. **Link Visualization**
   - Graph view showing link structure
   - Filter by relation type
   - Confidence heat map

5. **Bidirectional Link Analysis**
   - Detect inconsistent bidirectional links
   - Suggest reverse relations
   - Symmetric relation enforcement

6. **Link Quality Metrics**
   - User feedback tracking (accepted/rejected)
   - Precision/recall measurement
   - Continuous model improvement

---

## Troubleshooting

### Issue: Suggestions are empty

**Cause:** No candidate nodes meet similarity threshold

**Solution:**
```javascript
// Lower threshold in config.js
LINK_SIM_THRESHOLD: 0.70  // Was 0.78
```

### Issue: Suggestions are slow

**Cause:** Large node count or missing embeddings

**Solutions:**
1. Check embeddings: `node.embedding` should exist for all nodes
2. Reduce `topK`: Generate fewer suggestions
3. Increase `radiusPower`: Smaller Morton range
4. Run performance benchmark to identify bottleneck

### Issue: Links not persisting

**Cause:** IndexedDB schema version mismatch

**Solution:**
1. Check `DB_VERSION` in `fractamind-indexer.js` (should be 2)
2. Clear IndexedDB in DevTools → Application → Storage
3. Reload application to trigger schema migration

### Issue: Cycle detection fails

**Cause:** Large graph or deep cycles

**Solution:**
- Cycle detection uses BFS with 50-link limit per node
- For very large graphs, may need to increase limit or disable

---

## API Reference

### Linker API

```javascript
import {
  createLink,
  upsertLink,
  queryLinksFiltered,
  removeLink,
  computeLinkConfidence,
  computeLexicalSimilarity,
  getNodeLinks,
  wouldCreateCycle,
  batchUpdateConfidences,
  getLinkStatistics,
} from './src/core/linker.js';
```

### Contextualizer API

```javascript
import { suggestLinks } from './src/core/contextualizer.js';
```

### Searcher API

```javascript
import { scorePair } from './src/core/searcher.js';
```

---

## Contributing

When extending Phase 6:

1. **Maintain backward compatibility** - Don't break existing link schemas
2. **Update tests** - Add test cases for new features
3. **Document changes** - Update this file and CHANGELOG_PHASE6.md
4. **Validate performance** - Run benchmark script before/after changes
5. **Follow naming conventions** - Use existing patterns for consistency

---

## References

- **Phase 6 Specification:** Original task document
- **Proof-of-Concept Test:** `tests/core/phase6-poc.test.js`
- **Configuration:** `src/config.js`
- **Database Schema:** `src/db/fractamind-indexer.js` (version 2)

---

**Last Updated:** January 7, 2025
**Version:** 1.0.0
**Maintainer:** FractaMind Team
