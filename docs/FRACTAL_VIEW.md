# Fractal View Architecture

This document describes the architecture, interaction model, and implementation details of FractaMind's Fractal Canvas visualization component.

---

## Overview

The **Fractal View** is the core interactive visualization of FractaMind. It renders the knowledge graph as a zoomable, explorable fractal where:

- **Root node** appears at the center
- **Child nodes** radiate outward in a hierarchical tree layout
- **Zoom in** to explore deeper levels of detail
- **Right-click** any node to expand it (generate child nodes via AI)
- **Click** any node to view its details
- **Pan/zoom** freely to navigate the knowledge space

---

## Component Architecture

### File Structure

```
/src/viz/
  - FractalCanvas.jsx         # Main React component
  - FractalCanvas.css         # Styling for canvas, HUD, node details panel
  - fractalCanvas.test.js     # Component tests (14 test cases)

/src/core/
  - expander.js               # Node expansion logic with AI integration
  - expander.test.js          # Expander unit tests
```

### Data Flow

```
User Import → IndexedDB
                ↓
        FractalCanvas loads root node
                ↓
        BFS traversal loads tree (depth 2)
                ↓
        Calculate radial positions
                ↓
        Render nodes + edges on canvas
                ↓
        User right-click → expandNode()
                ↓
        AI generates children → save to IndexedDB
                ↓
        Reload tree → re-render
```

---

## Key Features

### 1. Radial Tree Layout

Nodes are positioned using a **radial tree layout** algorithm:

- **Root node**: Position (0, 0) at center
- **Depth N nodes**: Positioned at radius `(N + 1) * 200px`
- **Angular spacing**: Evenly distributed children within parent's angle span
- **BFS traversal**: Ensures proper parent-child angle inheritance

**Algorithm** (simplified):

```javascript
function calculateNodePositions(rootNode, nodes) {
  const positions = new Map();
  const queue = [{ nodeId: rootNode.id, depth: 0, angle: 0, angleSpan: Math.PI * 2 }];

  while (queue.length > 0) {
    const { nodeId, depth, angle, angleSpan } = queue.shift();
    const node = nodes.get(nodeId);

    // Position calculation
    const radius = (depth + 1) * 200;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    positions.set(nodeId, { x, y, depth });

    // Queue children with subdivided angles
    const childCount = node.children.length;
    const angleStep = angleSpan / childCount;
    node.children.forEach((childId, idx) => {
      const childAngle = angle - angleSpan / 2 + angleStep * (idx + 0.5);
      queue.push({ nodeId: childId, depth: depth + 1, angle: childAngle, angleSpan: angleStep });
    });
  }

  return positions;
}
```

### 2. Visual Encoding

**Node Size**: Encodes number of children
```javascript
const baseRadius = 20;
const childCount = node.children.length;
const radius = baseRadius * (1 + Math.log(1 + childCount) * 0.5);
```

**Node Color**: Encodes depth (purple → blue gradient)
```javascript
const maxDepth = 5;
const depthRatio = Math.min(depth / maxDepth, 1);
const hue = 260 - depthRatio * 60; // 260 (purple) → 200 (blue)
const color = `hsl(${hue}, 70%, 60%)`;
```

**Stroke**: Selected node has thicker stroke + glow effect

### 3. Pan & Zoom

**Transform State**:
```javascript
const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
```

**Zoom Implementation** (mouse wheel → zoom towards cursor):
```javascript
const handleWheel = (event) => {
  event.preventDefault();
  const delta = -event.deltaY * 0.001;
  const newScale = Math.max(0.1, Math.min(5, transform.scale * (1 + delta)));

  // Zoom towards mouse position
  const rect = canvasRef.current.getBoundingClientRect();
  const mouseX = event.clientX - rect.left - rect.width / 2;
  const mouseY = event.clientY - rect.top - rect.height / 2;

  const scaleRatio = newScale / transform.scale;
  const newX = mouseX - (mouseX - transform.x) * scaleRatio;
  const newY = mouseY - (mouseY - transform.y) * scaleRatio;

  setTransform({ x: newX, y: newY, scale: newScale });
};
```

**Pan Implementation** (drag to move):
```javascript
const handleMouseMove = (event) => {
  if (isPanning) {
    const dx = event.clientX - panStart.x;
    const dy = event.clientY - panStart.y;
    setTransform((prev) => ({
      ...prev,
      x: panStart.transformX + dx,
      y: panStart.transformY + dy,
    }));
  }
};
```

### 4. Node Expansion

**User Interaction**: Right-click on node → generate child nodes

**Expansion Pipeline**:
1. User right-clicks node
2. Check if already expanding → ignore if true
3. Call `expandNode(nodeId, options)` from `src/core/expander.js`
4. Show progress indicator (animated spinner + progress message)
5. AI generates 2-4 child nodes via Writer API
6. Deduplicate by content hash
7. Generate embeddings + Morton keys
8. Save children to IndexedDB
9. Update parent's `children` array
10. Reload tree from IndexedDB
11. Re-calculate positions and re-render

**Code**:
```javascript
const handleNodeRightClick = async (nodeId, event) => {
  event.preventDefault();

  if (expandingNodeId) {
    console.log('Already expanding a node, ignoring');
    return;
  }

  setExpandingNodeId(nodeId);
  setProgress({ step: 'expanding', progress: 0.5, message: 'Expanding node...' });

  try {
    const newChildren = await expandNode(nodeId, {
      maxChildren: 3,
      style: 'concise',
      onProgress: (prog) => setProgress(prog),
    });

    console.log(`Expanded node ${nodeId}, created ${newChildren.length} children`);

    // Reload tree to include new children
    await loadNodeTree(nodeId, 0, 2);
    setProgress({ step: 'complete', progress: 1.0, message: '' });
  } catch (error) {
    console.error('Expansion failed:', error);
    setProgress({ step: 'error', progress: 0, message: `Expansion failed: ${error.message}` });
  } finally {
    setExpandingNodeId(null);
  }
};
```

### 5. Node Details Panel

**Trigger**: Click on any node

**Panel Content**:
- Node title (large heading)
- Full node text
- Metadata: depth, created date, created by
- "Expand Node" button (alternative to right-click)
- "Close" button

**Implementation**:
```javascript
const [selectedNodeId, setSelectedNodeId] = useState(null);

const handleNodeClick = (nodeId) => {
  setSelectedNodeId(nodeId);
  if (onNodeSelect) {
    const node = nodes.get(nodeId);
    onNodeSelect(node);
  }
};

// Render panel
{selectedNodeId && (
  <div className="fractal-node-details-panel">
    <button onClick={() => setSelectedNodeId(null)}>Close</button>
    <h3>{selectedNode.title}</h3>
    <p>{selectedNode.text}</p>
    <button onClick={() => handleNodeRightClick(selectedNodeId, {})}>
      Expand Node
    </button>
  </div>
)}
```

---

## HUD Controls

The canvas includes a **Heads-Up Display (HUD)** overlay with controls:

**Controls**:
1. **Reset View** button: Reset pan/zoom to default
2. **Toggle Labels** button: Show/hide node title labels
3. **Node Count**: Display total nodes loaded
4. **Zoom Level**: Display current zoom percentage

**Positioning**:
- Top-left corner
- Semi-transparent background
- Z-index above canvas, below modals

---

## Accessibility

### Keyboard Navigation

- **Tab**: Move focus between nodes
- **Enter**: Select focused node (open details panel)
- **Space**: Expand focused node
- **Escape**: Close details panel

### Screen Reader Support

- All nodes have `role="button"` and `aria-label`
- Canvas has `role="application"` with descriptive label
- Expansion state indicated via `aria-expanded` attribute
- Progress indicators have `aria-live="polite"` regions

**Example**:
```jsx
<button
  role="button"
  aria-label={`Node: ${node.title}. ${node.children.length} children. Depth ${depth}.`}
  aria-expanded={node.children.length > 0}
  onClick={() => handleNodeClick(node.id)}
  onContextMenu={(e) => handleNodeRightClick(node.id, e)}
>
  {/* Node circle */}
</button>
```

---

## Performance Optimizations

### 1. Virtualization (Future)

Current implementation loads full tree up to depth 2. For large graphs (1000+ nodes), implement **viewport culling**:

- Only render nodes within visible canvas bounds
- Use spatial index (quadtree) for fast visibility checks

### 2. Memoization

Key functions are memoized with `useCallback`:
```javascript
const calculateNodePositions = useCallback(() => { /* ... */ }, [nodes]);
const getNodeVisuals = useCallback((node) => { /* ... */ }, [selectedNodeId]);
```

### 3. Debounced Rendering

Pan/zoom updates are throttled to 60fps via `requestAnimationFrame`.

### 4. Lazy Loading

Tree loading is depth-limited (default: depth 2). Deeper nodes are loaded on-demand during expansion.

---

## Integration with Main App

### Routing (src/main.jsx)

```javascript
const [currentView, setCurrentView] = useState('import'); // 'import' | 'fractal'
const [importedProject, setImportedProject] = useState(null);

const handleOpenFractalView = () => {
  if (importedProject) {
    setCurrentView('fractal');
  }
};

return (
  <div className="app">
    {currentView === 'import' && (
      <ChoreComponent
        onSeedSubmit={onSeedSubmit}
        onSuccess={handleSuccess}
        onOpenFractalView={handleOpenFractalView}
      />
    )}

    {currentView === 'fractal' && importedProject && (
      <FractalCanvas
        projectId={importedProject.project.id}
        rootNodeId={importedProject.rootNode.id}
        onNodeSelect={handleNodeSelect}
      />
    )}
  </div>
);
```

### Navigation Flow

1. **Import View**: User pastes text → ChoreComponent
2. **Import Success**: "Open Fractal View" button appears
3. **Click Button**: Calls `onOpenFractalView()` → switches `currentView` to 'fractal'
4. **Fractal View**: FractalCanvas loads root node from IndexedDB
5. **"Back to Import" button**: Returns to import view

---

## Testing

### Test Coverage (src/viz/fractalCanvas.test.js)

**14 Test Cases**:

1. ✅ Renders canvas container
2. ✅ Loads and displays root node
3. ✅ Loads and displays child nodes
4. ✅ Displays HUD controls
5. ✅ Displays node count and zoom level
6. ✅ Selects node on click
7. ✅ Opens node details panel when selected
8. ✅ Closes node details panel on close button
9. ✅ Expands node on right-click
10. ✅ Shows progress indicator during expansion
11. ✅ Toggles labels on button click
12. ✅ Resets view on reset button click
13. ✅ Handles expansion errors gracefully
14. ✅ Prevents duplicate expansions
15. ✅ Has accessible ARIA labels
16. ✅ Is keyboard navigable

**Mocking Strategy**:
- Mock `../db/fractamind-indexer` for IndexedDB calls
- Mock `../core/expander` for AI expansion
- Use React Testing Library for component interactions
- Use `waitFor()` for async state updates

---

## Future Enhancements

### Phase 3 (Planned):

1. **Semantic Search UI**: Search bar in HUD → highlight matching nodes
2. **Node Editing**: Click to edit node text → regenerate embeddings
3. **Hilbert Curve Migration**: Replace Morton keys with Hilbert for better locality
4. **Visual Themes**: Color presets (depth-based, semantic clustering, custom)
5. **Animation**: Smooth transitions when nodes are added/removed
6. **Minimap**: Small overview map in corner for navigation
7. **Multi-root Support**: Switch between different root nodes

### Stretch Goals:

- **3D Visualization**: Use Three.js for 3D fractal tree
- **VR Mode**: Immersive knowledge exploration in VR
- **Collaborative Editing**: Sync with Firebase for multi-user sessions
- **Export Visualizations**: PNG/SVG export of current view

---

## Troubleshooting

### Common Issues

**Issue**: Nodes not appearing after import
- **Cause**: IndexedDB not initialized
- **Fix**: Ensure `initDB()` is called before first import

**Issue**: Expansion fails with "rate limit exceeded"
- **Cause**: Chrome AI API rate limits
- **Fix**: Exponential backoff is implemented in `expander.js` (3 retries)

**Issue**: Canvas is blank / black screen
- **Cause**: Transform state out of bounds
- **Fix**: Click "Reset View" button or refresh page

**Issue**: Right-click opens browser context menu instead of expanding
- **Cause**: `event.preventDefault()` not called
- **Fix**: Verified in code - should be working

---

## References

- **Component Source**: [src/viz/FractalCanvas.jsx](../src/viz/FractalCanvas.jsx)
- **Expander Logic**: [src/core/expander.js](../src/core/expander.js)
- **Tests**: [src/viz/fractalCanvas.test.js](../src/viz/fractalCanvas.test.js)
- **Project Summary**: [Project summary.md](./Project%20summary.md)
- **Implementation Spec**: [Canonical Implementation Spec.md](./Canonical%20Implementation%20Spec.md)

---

**Last Updated**: 2025-10-29
**Phase**: Phase 2 Complete
**Status**: Ready for testing
