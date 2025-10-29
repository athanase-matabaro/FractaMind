# Memory Layer - Contextual Memory & Semantic Timeline

## Overview

FractaMind's Memory Layer records user interactions with timestamps, embeddings, and metadata to provide contextual awareness and temporal navigation. All data is stored locally in IndexedDB and never leaves the device.

## Architecture

### Components

1. **Memory Core** (`src/core/memory.js`)
   - Persistent interaction storage
   - IndexedDB-based with efficient indexes
   - Base64-encoded embeddings

2. **Context Manager** (`src/core/contextManager.js`)
   - Decay-weighted relevance scoring
   - Semantic similarity + temporal recency
   - Configurable scoring parameters

3. **Timeline View** (`src/viz/TimelineView.jsx`)
   - Visual interaction history
   - Time-based filtering
   - Keyboard-accessible navigation

4. **Context Suggestions** (`src/components/NodeDetails/ContextSuggestions.jsx`)
   - Inline relevant node recommendations
   - Automatic embedding-based matching

## Core Concepts

### Interaction Types

Supported action types:
- `view`: User views a node
- `search`: Semantic search query
- `expand`: Node expansion (creates children)
- `rewrite`: AI rewrite applied
- `edit`: Manual text edit
- `export`: Project export
- `import`: Document import

### Storage Schema

**IndexedDB Store**: `memory`

**Record Structure**:
```javascript
{
  id: "uuid-v4",                    // Unique interaction ID
  nodeId: "node-id" | null,         // Associated node (null for global actions)
  actionType: "view" | "search" | ...,
  at: "2025-10-29T12:34:56.789Z",  // ISO 8601 timestamp
  embedding: "base64-encoded-float32array",  // Embedding vector (nullable)
  meta: {                           // Free-form metadata
    title: "Node Title",
    queryText: "search query",
    rewriteOptions: { tone: "concise", length: "medium" },
    // ... action-specific fields
  }
}
```

**Indexes**:
- `byAt`: Sort by timestamp (newest first)
- `byNodeId`: Filter interactions for specific nodes
- `byActionType`: Filter by action type

### Decay-Weighted Relevance Scoring

**Formula**:
```
Score_i = α * semantic_similarity + β * exp(-ln(2) * Δt / halfLife)
```

**Parameters**:
- `α` (alpha): Semantic weight (default 0.7)
- `β` (beta): Recency weight (default 0.3)
- `Δt`: Time difference in hours
- `halfLife`: Recency half-life in hours (default 72)

**Interpretation**:
- **High semantic + recent**: Score ≈ 0.9-1.0
- **High semantic + old**: Score ≈ 0.5-0.7
- **Low semantic + recent**: Score ≈ 0.2-0.4
- **Low semantic + old**: Score ≈ 0.0-0.1

**Example**:
```javascript
// Node viewed 2 hours ago with 80% similarity
semantic_sim = 0.8
Δt = 2 hours
recency = exp(-ln(2) * 2 / 72) = 0.981

score = 0.7 * 0.8 + 0.3 * 0.981 = 0.56 + 0.294 = 0.854
```

## API Reference

### Memory Core

#### `initMemoryDB(): Promise<void>`

Initialize IndexedDB with memory store and indexes.

```javascript
import { initMemoryDB } from './src/core/memory.js';

await initMemoryDB();
```

#### `recordInteraction(options): Promise<{id, at}>`

Record a user interaction.

**Parameters**:
- `nodeId` (string | null): Node ID (null for global actions)
- `actionType` (string): One of: `view`, `search`, `expand`, `rewrite`, `edit`, `export`, `import`
- `embedding` (Array | Float32Array, optional): Embedding vector
- `meta` (object, optional): Free-form metadata

**Returns**: `{id, at}` - Record ID and timestamp

**Example**:
```javascript
import { recordInteraction } from './src/core/memory.js';

await recordInteraction({
  nodeId: 'node-123',
  actionType: 'view',
  embedding: nodeEmbedding,
  meta: {
    title: 'My Node',
    duration: 45, // seconds
  },
});
```

#### `getRecentInteractions(options): Promise<Array<Record>>`

Retrieve recent interactions.

**Parameters**:
- `limit` (number, default 100): Maximum records to return
- `filter` (object, optional): Filter criteria
  - `actionType` (string): Filter by action type
  - `nodeId` (string): Filter by node ID

**Returns**: Array of interaction records (newest first)

**Example**:
```javascript
import { getRecentInteractions } from './src/core/memory.js';

// Get last 50 interactions
const recent = await getRecentInteractions({ limit: 50 });

// Get all searches
const searches = await getRecentInteractions({
  limit: 100,
  filter: { actionType: 'search' },
});

// Get interactions for specific node
const nodeHistory = await getRecentInteractions({
  limit: 20,
  filter: { nodeId: 'node-123' },
});
```

#### `getInteractionsForNode(nodeId, options): Promise<Array<Record>>`

Get interactions for a specific node.

**Parameters**:
- `nodeId` (string): Node ID
- `options.limit` (number, default 50): Maximum records

**Returns**: Array of interaction records for the node

**Example**:
```javascript
import { getInteractionsForNode } from './src/core/memory.js';

const nodeInteractions = await getInteractionsForNode('node-123', { limit: 30 });
```

#### `purgeMemory(options): Promise<number>`

Delete old interactions.

**Parameters**:
- `olderThanMs` (number): Delete records older than this (milliseconds)

**Returns**: Number of records deleted

**Example**:
```javascript
import { purgeMemory } from './src/core/memory.js';

// Delete interactions older than 90 days
const deleted = await purgeMemory({
  olderThanMs: 90 * 24 * 60 * 60 * 1000,
});

console.log(`Purged ${deleted} old records`);
```

#### `getMemoryStats(): Promise<Object>`

Get memory statistics.

**Returns**: Object with:
- `totalRecords` (number): Total interaction count
- `oldestRecord` (number): Oldest timestamp (ms)
- `newestRecord` (number): Newest timestamp (ms)
- `byActionType` (object): Counts by action type

**Example**:
```javascript
import { getMemoryStats } from './src/core/memory.js';

const stats = await getMemoryStats();
console.log(`Total: ${stats.totalRecords}`);
console.log(`Views: ${stats.byActionType.view}`);
```

#### `clearAllMemory(): Promise<void>`

**⚠️ Dangerous**: Delete all memory records. Use for testing only.

```javascript
import { clearAllMemory } from './src/core/memory.js';

await clearAllMemory();
```

### Context Manager

#### `getContextSuggestions(options): Promise<Array<Suggestion>>`

Get contextually relevant nodes based on decay-weighted scoring.

**Parameters**:
- `queryEmbedding` (Array | Float32Array): Query embedding vector
- `topN` (number, default 5): Number of suggestions
- `recencyHalfLifeHours` (number, default 72): Recency half-life
- `alpha` (number, default 0.7): Semantic weight
- `beta` (number, default 0.3): Recency weight
- `maxInteractions` (number, default 1000): Max interactions to consider

**Returns**: Array of `{nodeId, score, reason, title, ...}`

**Example**:
```javascript
import { getContextSuggestions } from './src/core/contextManager.js';

const suggestions = await getContextSuggestions({
  queryEmbedding: currentNodeEmbedding,
  topN: 3,
  recencyHalfLifeHours: 48, // 2-day half-life
  alpha: 0.8, // Prioritize semantic similarity
  beta: 0.2,
});

suggestions.forEach(s => {
  console.log(`${s.title} (score: ${s.score.toFixed(2)}) - ${s.reason}`);
});
```

#### `getRecentContext(options): Promise<Array<Context>>`

Get recently interacted nodes (simplified, no embeddings required).

**Parameters**:
- `limit` (number, default 50): Max interactions

**Returns**: Array of `{nodeId, title, actionType, at, hoursAgo, meta}`

**Example**:
```javascript
import { getRecentContext } from './src/core/contextManager.js';

const recentNodes = await getRecentContext({ limit: 10 });
```

#### `getContextStats(): Promise<Object>`

Get context statistics for monitoring.

**Returns**: Stats object with interaction counts, unique nodes, time span

**Example**:
```javascript
import { getContextStats } from './src/core/contextManager.js';

const stats = await getContextStats();
console.log(`Unique nodes: ${stats.uniqueNodes}`);
console.log(`Span: ${stats.timeSpan.spanHours.toFixed(1)} hours`);
```

## Usage Patterns

### Recording Interactions

**On Node View**:
```javascript
// In FractalCanvas or node click handler
await recordInteraction({
  nodeId: selectedNode.id,
  actionType: 'view',
  embedding: selectedNode.embedding,
  meta: {
    title: selectedNode.title,
    depth: selectedNode.meta.depth,
  },
});
```

**On Search**:
```javascript
// In SearchHUD after search completes
await recordInteraction({
  nodeId: null, // Global action
  actionType: 'search',
  meta: {
    queryText: searchQuery,
    resultsCount: results.length,
  },
});
```

**On Expand**:
```javascript
// In FractalCanvas after node expansion
await recordInteraction({
  nodeId: parentNodeId,
  actionType: 'expand',
  embedding: parentNode.embedding,
  meta: {
    title: parentNode.title,
    childrenCreated: newChildren.length,
  },
});
```

**On Rewrite**:
```javascript
// In NodeDetailsEditor after accepting rewrite
await recordInteraction({
  nodeId: node.id,
  actionType: 'rewrite',
  embedding: updatedNode.embedding,
  meta: {
    title: node.title,
    rewriteOptions: { tone: 'concise', length: 'medium' },
  },
});
```

**On Edit**:
```javascript
// In NodeDetailsEditor after manual edit
await recordInteraction({
  nodeId: node.id,
  actionType: 'edit',
  embedding: updatedNode.embedding,
  meta: {
    title: node.title,
    changeLength: newText.length - oldText.length,
  },
});
```

### Displaying Context Suggestions

```jsx
import ContextSuggestions from './components/NodeDetails/ContextSuggestions';

<ContextSuggestions
  currentNodeEmbedding={node.embedding}
  onSuggestionClick={(suggestion) => {
    // Navigate to suggested node
    navigateToNode(suggestion.nodeId);
  }}
  limit={3}
/>
```

### Showing Timeline

```jsx
import TimelineView from './viz/TimelineView';

<TimelineView
  onItemClick={(interaction) => {
    // Focus node in fractal canvas
    focusNode(interaction.nodeId);
  }}
  onClose={() => setView('fractal')}
/>
```

## Data Retention & Privacy

### Automatic Cleanup

Recommended: Purge interactions older than 90 days automatically.

```javascript
// Run periodically (e.g., on app startup)
async function cleanupOldMemory() {
  const retentionDays = 90;
  const deleted = await purgeMemory({
    olderThanMs: retentionDays * 24 * 60 * 60 * 1000,
  });
  console.log(`Cleaned up ${deleted} old interactions`);
}

// Schedule cleanup
setInterval(cleanupOldMemory, 24 * 60 * 60 * 1000); // Daily
```

### Privacy Considerations

- **Local-only storage**: All data stored in IndexedDB, never transmitted
- **No cloud sync**: Memory layer is client-side only
- **User control**: Provide UI for manual purge and stats inspection
- **Embeddings**: Store only when available; don't block interactions
- **Sensitive data**: Avoid storing passwords, API keys, or PII in `meta`

### User Settings

Allow users to configure:
- Retention period (default: 90 days)
- Enable/disable memory recording
- Manual purge button
- View memory stats dashboard

## Performance Targets

- **Record interaction**: < 50ms
- **Get recent interactions (200 records)**: < 100ms
- **Context suggestions (1000 interactions)**: < 200ms
- **Timeline rendering (200 items)**: < 60ms frame time

## Performance Optimization

### For Large Datasets (>1000 interactions)

1. **Sampling**: Sample interactions instead of processing all
2. **Early pruning**: Filter by date range before scoring
3. **Batch processing**: Process in chunks of 100-200
4. **Index optimization**: Use IndexedDB range queries

```javascript
// Example: Sample recent interactions
const allInteractions = await getRecentInteractions({ limit: 2000 });
const sampled = allInteractions.filter((_, i) => i % 2 === 0); // Sample every 2nd
```

## Troubleshooting

### Issue: Suggestions not appearing

**Check**:
1. Memory DB initialized? (`await initMemoryDB()`)
2. Interactions recorded? (Check with `getMemoryStats()`)
3. Node has embedding? (Required for semantic similarity)
4. Recent interactions? (Recency weight decays quickly)

**Debug**:
```javascript
const stats = await getMemoryStats();
console.log('Total interactions:', stats.totalRecords);

const recent = await getRecentInteractions({ limit: 5 });
console.log('Recent interactions:', recent);
```

### Issue: Timeline empty

**Check**:
1. Interactions recorded with nodeId? (Not null)
2. Time filter too restrictive? (Try "all")
3. IndexedDB working? (Check browser console)

### Issue: Performance slow

**Solutions**:
1. Reduce `maxInteractions` parameter
2. Purge old interactions
3. Sample interactions before scoring
4. Increase `recencyHalfLifeHours` to reduce candidates

## Extending the Memory Layer

### Adding Custom Action Types

Edit `src/core/memory.js`:
```javascript
const validActionTypes = [
  'view', 'search', 'expand', 'rewrite', 'edit', 'export', 'import',
  'comment', 'tag', 'bookmark', // Your custom types
];
```

### Custom Scoring Algorithms

Create alternative scoring function:
```javascript
// src/core/customScorer.js
export function customScore(interaction, queryEmbedding, options) {
  const semanticSim = cosineSimilarity(queryEmbedding, interaction.embedding);
  const recency = computeDecay(hoursAgo, options.halfLife);

  // Custom logic: boost certain action types
  const actionBoost = interaction.actionType === 'rewrite' ? 1.2 : 1.0;

  return (options.alpha * semanticSim + options.beta * recency) * actionBoost;
}
```

### Custom Metadata

Store custom fields in `meta`:
```javascript
await recordInteraction({
  nodeId: 'node-123',
  actionType: 'view',
  meta: {
    title: 'My Node',
    duration: 45,
    scrollDepth: 0.8,
    fromSearch: true,
    tags: ['important', 'review'],
  },
});
```

## FAQ

**Q: Does memory layer work offline?**
A: Yes, fully offline. Uses IndexedDB for client-side storage.

**Q: Can I sync memory across devices?**
A: Not in this version. Consider implementing encrypted cloud backup separately.

**Q: How much storage does it use?**
A: ~1KB per interaction. 1000 interactions ≈ 1MB (including embeddings).

**Q: Can I export memory data?**
A: Yes, use `getRecentInteractions()` and serialize to JSON.

**Q: Does it affect app performance?**
A: Minimal. Recording is async and non-blocking. Suggestions compute in <200ms.

**Q: What happens if IndexedDB is unavailable?**
A: Memory layer gracefully degrades. App continues working without memory features.

---

**Version**: 1.0.0
**Last Updated**: 2025-10-29
**Maintainer**: FractaMind Team
