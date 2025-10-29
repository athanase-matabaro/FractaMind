# Federation Layer Architecture

**Phase 5: Multi-Document Federation & Workspace Search**

## Overview

The Federation Layer enables FractaMind to manage multiple imported projects in a unified workspace, providing cross-project semantic search with intelligent ranking. All operations are client-side with IndexedDB persistence.

---

## Core Concepts

### 1. Project Registry
Central metadata store for all workspace projects.

**Schema** ([projectRegistry.js](../src/core/projectRegistry.js)):
```javascript
{
  projectId: string (uuid),
  name: string,
  importDate: ISO8601,
  rootNodeId: string,
  nodeCount: number,
  embeddingCount: number,
  lastAccessed: ISO8601,
  isActive: boolean,        // Included in searches
  weight: number (0.1-2.0), // Ranking multiplier
  meta: {
    sourceUrl?: string,
    description?: string,
    tags?: string[]
  }
}
```

**Key Operations**:
- `registerProject(metadata)` - Add/update project
- `listProjects({ activeOnly })` - Query projects
- `setProjectActive(id, bool)` - Toggle search inclusion
- `setProjectWeight(id, weight)` - Adjust ranking bias
- `touchProject(id)` - Update lastAccessed for freshness
- `getProjectStats()` - Aggregate statistics

---

### 2. Federated Index Manager
Manages separate IndexedDB stores per project with shared quantization.

**Architecture** ([federation.js](../src/core/federation.js)):
- **Per-project stores**: `project_{projectId}` object stores
- **Shared quantization**: Global `quantParams` for Morton key consistency
- **Spatial indexing**: Morton keys enable fast locality searches
- **Incremental updates**: Add/update/remove nodes without full reindex

**Database Structure**:
```
fractamind-federation-db
├── federationMeta (global metadata)
│   └── { key: "quantParams", value: {...}, updatedAt }
├── project_abc123 (nodes for project abc123)
│   ├── id (primary key)
│   ├── byMorton (index)
│   └── byTitle (index)
└── project_def456 (nodes for project def456)
    └── ...
```

**Key Operations**:
- `initFederation()` - Initialize database
- `addProjectIndex(projectId, nodes, {recomputeQuant})` - Index project nodes
- `removeProjectIndex(projectId)` - Delete project index
- `updateProjectNodes(projectId, nodesToUpdate)` - Incremental update
- `searchProjectByMorton(projectId, mortonHex, radiusHex)` - Spatial search
- `getProjectNodes(projectId, {limit, offset})` - Retrieve nodes
- `computeGlobalQuantParams(projects)` - Compute shared quantization
- `getFederationStats()` - Workspace statistics

---

### 3. Cross-Project Searcher
Parallel semantic search across active projects with ranking fusion.

**Algorithm** ([crossSearcher.js](../src/core/crossSearcher.js)):

#### Step 1: Query Embedding
```javascript
queryEmbedding = await generateEmbedding(queryText);
```

#### Step 2: Compute Morton Key
```javascript
mortonKeyHex = computeMortonKeyFromEmbedding(queryEmbedding, quantParams);
```

#### Step 3: Progressive Radius Search
Perform 3 iterations with widening radii:
- Iteration 1: `radiusHex = 0x1000`
- Iteration 2: `radiusHex = 0x5000`
- Iteration 3: `radiusHex = 0x10000`

Stop early if `results.length >= topK`.

#### Step 4: Per-Project Candidate Retrieval
```javascript
for each active project:
  candidates = await searchProjectByMorton(projectId, mortonHex, radiusHex);
  results = candidates.filter(node => node.embedding).map(node => ({
    projectId,
    nodeId: node.id,
    title: node.title,
    rawSimilarity: cosineSimilarity(queryEmbedding, node.embedding)
  }));
```

#### Step 5: Score Normalization
Normalize scores within each project to avoid bias:
```javascript
normalizedScore = (rawSimilarity - minScore) / (maxScore - minScore)
```

#### Step 6: Apply Weights and Freshness
```javascript
freshnessBoost = 1.0 + 0.2 * exp(-daysSinceAccess / 30)
finalScore = normalizedScore * projectWeight * freshnessBoost
```

#### Step 7: Global Ranking
```javascript
allResults.sort((a, b) => b.finalScore - a.finalScore).slice(0, topK)
```

**Fallbacks**:
- No quantization params → Linear scan all nodes
- No embeddings → Skip project or use title/text substring match
- Embedding API failure → Error (requires Chrome Built-in AI)

**Key Operations**:
- `crossProjectSearch(queryText, {topK, projectIds, applyWeights, applyFreshness, onProgress})` - Multi-project search
- `searchWithinProject(projectId, queryText, {topK})` - Single-project search
- `getSearchSuggestions()` - Query suggestions (TODO)

---

## Ranking Formula

### Final Score Calculation
```
finalScore = cosineSimilarity * projectWeight * freshnessBoost
```

### Components

**1. Cosine Similarity**
```
cosineSim = (A · B) / (||A|| × ||B||)
```
- Range: [-1, 1]
- Threshold: 0.1 (filter low-relevance results)

**2. Project Weight**
```
weight ∈ [0.1, 2.0]
```
- Default: 1.0
- User-adjustable via workspace UI slider
- Purpose: Bias important projects (e.g., documentation > notes)

**3. Freshness Boost**
```
boost = 1.0 + 0.2 * exp(-daysSinceAccess / 30)
```
- Range: [1.0, 1.2]
- Decay half-life: ~21 days
- Recently accessed projects get up to 20% boost

### Example

Given:
- `cosineSim = 0.85`
- `projectWeight = 1.5` (important project)
- `daysSinceAccess = 2` → `boost ≈ 1.187`

```
finalScore = 0.85 × 1.5 × 1.187 ≈ 1.513
```

---

## Integration Points

### Import Pipeline
**File**: [importer.js](../src/core/importer.js)

When a document is imported:
1. Parse and create nodes
2. Generate embeddings
3. Persist to main IndexedDB
4. **Register in workspace** (new):
   ```javascript
   await registerProject({
     projectId: project.id,
     name: project.name,
     nodeCount: nodes.length,
     embeddingCount: nodes.filter(n => n.embedding).length
   });
   await addProjectIndex(project.id, nodes);
   ```

### Workspace View
**File**: [WorkspaceView.jsx](../src/viz/WorkspaceView.jsx)

**Features**:
- Project cards with metadata (nodes, import date, last access)
- Toggle active/inactive (👁️ icon)
- Adjust search weight (slider 0.1-2.0x)
- Delete projects (🗑️ icon)
- Cross-project search bar (debounced, 500ms)
- Grouped search results (expandable per project)
- Keyboard shortcuts:
  - `/` - Focus search
  - `Tab` - Switch project groups
  - `Enter` - Open selected node
  - `Esc` - Close workspace

### Main App Navigation
**File**: [main.jsx](../src/main.jsx)

**Views**:
```
import → fractal → timeline
              ↓
         workspace
```

**Routing**:
- From fractal view: Click "🏢 Workspace" button
- From workspace: Click search result → focus node in fractal view
- Close buttons return to previous view

---

## Data Flow Diagram

```
┌─────────────┐
│   User      │
│  imports    │
│  document   │
└──────┬──────┘
       ↓
┌──────────────────────────────────────┐
│  Import Pipeline (importer.js)       │
│  1. Summarize                        │
│  2. Generate embeddings              │
│  3. Persist to fractamind-db         │
│  4. Register in projectRegistry      │──┐
│  5. Add to federation index          │  │
└──────────────────────────────────────┘  │
                                           │
       ┌───────────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│  Federation Databases                │
│  ┌────────────────────────────────┐  │
│  │ fractamind-federation-db       │  │
│  │  ├── federationMeta            │  │
│  │  │   └── quantParams           │  │
│  │  ├── project_abc123            │  │
│  │  │   └── nodes with Morton keys│  │
│  │  └── project_def456            │  │
│  │      └── nodes with Morton keys│  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ fractamind-federation-db       │  │
│  │  └── projectRegistry           │  │
│  │      └── project metadata      │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
       │
       │  User opens Workspace View
       ↓
┌──────────────────────────────────────┐
│  WorkspaceView.jsx                   │
│  1. List all projects                │
│  2. Show project cards               │
│  3. Accept search query              │
└──────┬───────────────────────────────┘
       │  User searches "neural networks"
       ↓
┌──────────────────────────────────────┐
│  crossProjectSearch                  │
│  1. Generate query embedding         │
│  2. Compute Morton key               │
│  3. Parallel search active projects: │
│     ├── searchProjectByMorton(p1)    │
│     ├── searchProjectByMorton(p2)    │
│     └── searchProjectByMorton(p3)    │
│  4. Normalize scores per project     │
│  5. Apply weights & freshness        │
│  6. Merge and rank globally          │
│  7. Return top-K results             │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  WorkspaceView displays results      │
│  Grouped by project (expandable):    │
│  ▶ Project A (3 results)             │
│  ▼ Project B (5 results)             │
│    ├── Node 1 (score: 95%)           │
│    ├── Node 2 (score: 87%)           │
│    └── ...                           │
└──────┬───────────────────────────────┘
       │  User clicks result
       ↓
┌──────────────────────────────────────┐
│  main.jsx switches to fractal view   │
│  FractalCanvas focuses clicked node  │
└──────────────────────────────────────┘
```

---

## Performance Characteristics

### Indexing
- **Initial index creation**: O(N log N) for N nodes
- **Incremental update**: O(K log N) for K updated nodes
- **Space overhead**: ~2x (main DB + federation DB)

### Search
- **Morton range scan**: O(log N + M) for M candidates
- **Cosine re-rank**: O(M × D) for D dimensions
- **Cross-project search**: O(P × (log N + M)) for P projects
- **Target latency**: <500ms for 1000 nodes across 5 projects

### Storage
- **Per project**: ~1-2MB per 100 nodes (with 768-dim embeddings)
- **Registry**: ~1KB per project
- **Quantization params**: ~512 bytes (shared)

---

## Privacy & Security

### Local-Only Operation
- **No server communication**: All AI operations via Chrome Built-in AI
- **IndexedDB storage**: Data never leaves device
- **No analytics**: Zero telemetry or tracking

### Data Isolation
- Projects stored in separate object stores
- Deletion removes project index but preserves main DB nodes
- No cross-origin access (single-origin policy)

---

## API Reference

### ProjectRegistry

```javascript
import {
  initRegistry,
  registerProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  setProjectActive,
  setProjectWeight,
  touchProject,
  getProjectStats,
  clearAllProjects
} from './core/projectRegistry.js';
```

### Federation

```javascript
import {
  initFederation,
  addProjectIndex,
  removeProjectIndex,
  updateProjectNodes,
  getProjectNodes,
  getProjectNode,
  searchProjectByMorton,
  getAllProjectIds,
  computeGlobalQuantParams,
  getQuantParams,
  clearAllIndices,
  getFederationStats
} from './core/federation.js';
```

### CrossSearcher

```javascript
import {
  crossProjectSearch,
  searchWithinProject,
  getSearchSuggestions
} from './core/crossSearcher.js';

// Example usage
const results = await crossProjectSearch('machine learning', {
  topK: 20,
  projectIds: null, // null = all active projects
  applyWeights: true,
  applyFreshness: true,
  onProgress: (projectId, current, total) => {
    console.log(`Searching ${current}/${total}: ${projectId}`);
  }
});

// Result format
results = [
  {
    projectId: 'abc123',
    projectName: 'AI Notes',
    nodeId: 'node-456',
    title: 'Neural Networks Basics',
    text: '...',
    snippet: 'Neural networks are computational models...',
    rawSimilarity: 0.87,
    normalizedSimilarity: 0.95,
    projectWeight: 1.5,
    freshnessBoost: 1.18,
    finalScore: 1.68,
    node: { /* full node object */ }
  },
  // ...
]
```

---

## Future Enhancements

### Phase 6 Candidates
1. **Project Templates**: Pre-configured project types (docs, notes, research)
2. **Advanced Filters**: Date range, node count, embedding quality
3. **Search History**: Recent queries with caching
4. **Project Groups**: Organize projects into folders/tags
5. **Export Federation**: Backup entire workspace as JSON
6. **Import Federation**: Restore workspace from backup
7. **Collaborative Workspaces**: Firebase sync (opt-in, encrypted)
8. **Smart Suggestions**: Recommend related projects based on query
9. **Project Analytics**: Most accessed nodes, search patterns
10. **Custom Ranking**: User-defined scoring functions

### Performance Optimizations
- **Lazy loading**: Virtualize project cards for 100+ projects
- **Worker threads**: Parallel embedding generation
- **Caching**: LRU cache for frequent searches
- **Incremental indexing**: Background re-indexing on idle
- **Compression**: DEFLATE compressed embeddings

### UI/UX Improvements
- **Visual search**: Upload image → find similar nodes
- **Timeline integration**: Filter timeline by project
- **Bulk operations**: Batch activate/deactivate projects
- **Drag-and-drop**: Reorder project priority
- **Dark mode**: Theme support

---

## Testing

### Test Files (To Be Implemented)
- `tests/projectRegistry.test.js` - 10 tests
- `tests/federation.test.js` - 12 tests
- `tests/crossSearcher.test.js` - 15 tests
- `tests/WorkspaceView.test.jsx` - 8 tests

### Test Coverage Goals
- Unit tests: >90% coverage
- Integration tests: Critical paths (import → register → search)
- E2E tests: Full user flow (manual QA)

### Key Test Scenarios
1. **Registry CRUD**: Register, update, delete, query projects
2. **Federation indexing**: Add, remove, update indices
3. **Cross-project search**: Parallel search, score normalization, ranking
4. **Freshness boost**: Time-based decay validation
5. **Weight adjustment**: Verify score impact
6. **Empty states**: No projects, no results, no embeddings
7. **Error handling**: API failures, missing data, corrupt indices
8. **Performance**: 1000 nodes, 10 projects, <500ms search

---

## Troubleshooting

### Common Issues

**Q: Search returns no results**
- Check if projects are active (🏢 Workspace → toggle 👁️ icon)
- Verify embeddings were generated during import
- Ensure Chrome Built-in AI is enabled (chrome://flags)

**Q: Project not appearing in workspace**
- Check browser console for registration errors
- Verify import completed successfully
- Try re-importing document

**Q: Slow search performance**
- Reduce number of active projects
- Check embedding dimensions (768 recommended)
- Clear browser cache and re-import

**Q: Inconsistent rankings**
- Reset project weights to 1.0 (default)
- Check lastAccessed timestamps (freshness boost)
- Verify quantization params are consistent

**Q: Database size growing too large**
- Delete unused projects from workspace
- Export and re-import to compact database
- Use browser DevTools → Application → Clear storage

### Debug Mode

Enable verbose logging:
```javascript
localStorage.setItem('FM_DEBUG_FEDERATION', 'true');
```

View logs in console:
- `[ProjectRegistry]` - Registry operations
- `[Federation]` - Index operations
- `[CrossSearcher]` - Search queries and scores

---

## References

- **Morton Z-order curve**: Spatial indexing for embeddings
- **Cosine similarity**: Vector similarity metric
- **Exponential decay**: Freshness boost formula
- **IndexedDB**: Browser-based persistent storage
- **Chrome Built-in AI**: Local embedding generation

---

**Version**: 0.5.0-alpha
**Last Updated**: 2025-10-29
**Author**: FractaMind Dev Team
**License**: MIT
