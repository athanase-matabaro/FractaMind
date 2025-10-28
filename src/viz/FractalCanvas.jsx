/**
 * FractalCanvas - Interactive fractal visualization for FractaMind
 *
 * Features:
 * - Pan and zoom (mouse/touch)
 * - Node click/right-click for expansion
 * - Keyboard navigation (arrow keys, Enter, Space)
 * - Visual encoding (size by children, color by depth)
 * - HUD controls (zoom reset, center, toggle labels)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getNode } from '../db/fractamind-indexer';
import { expandNode } from '../core/expander';
import './FractalCanvas.css';

const FractalCanvas = ({ projectId, rootNodeId, onNodeSelect }) => {
  // State
  const [nodes, setNodes] = useState(new Map());
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandingNodeId, setExpandingNodeId] = useState(null);
  const [showLabels, setShowLabels] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  // Transform state (pan/zoom)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Refs
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  /**
   * Load node tree recursively
   */
  const loadNodeTree = useCallback(async (nodeId, depth = 0, maxDepth = 10) => {
    if (depth > maxDepth) return null;

    try {
      const node = await getNode(nodeId);
      if (!node) return null;

      // Add to nodes map
      setNodes((prev) => new Map(prev).set(nodeId, node));

      // Load children recursively
      if (node.children && node.children.length > 0) {
        await Promise.all(
          node.children.map((childId) => loadNodeTree(childId, depth + 1, maxDepth))
        );
      }

      return node;
    } catch (err) {
      console.error(`Failed to load node ${nodeId}:`, err);
      return null;
    }
  }, []);

  /**
   * Initialize: Load project and node tree
   */
  useEffect(() => {
    if (!rootNodeId) return;

    const init = async () => {
      try {
        setError(null);
        await loadNodeTree(rootNodeId);
      } catch (err) {
        setError(`Failed to load project: ${err.message}`);
      }
    };

    init();
  }, [rootNodeId, loadNodeTree]);

  /**
   * Calculate node positions using radial layout
   */
  const calculateNodePositions = useCallback(() => {
    if (nodes.size === 0) return new Map();

    const positions = new Map();
    const visited = new Set();

    const rootNode = nodes.get(rootNodeId);
    if (!rootNode) return positions;

    // Position root at center
    positions.set(rootNodeId, { x: 0, y: 0, depth: 0 });
    visited.add(rootNodeId);

    // BFS to position children radially
    const queue = [{ nodeId: rootNodeId, depth: 0, angle: 0, angleSpan: Math.PI * 2 }];

    while (queue.length > 0) {
      const { nodeId, depth, angle, angleSpan } = queue.shift();
      const node = nodes.get(nodeId);

      if (!node || !node.children || node.children.length === 0) continue;

      const radius = (depth + 1) * 200; // Distance from parent
      const childCount = node.children.length;
      const angleStep = angleSpan / Math.max(childCount, 1);

      node.children.forEach((childId, idx) => {
        if (visited.has(childId)) return;

        const childAngle = angle - angleSpan / 2 + angleStep * (idx + 0.5);
        const x = radius * Math.cos(childAngle);
        const y = radius * Math.sin(childAngle);

        positions.set(childId, { x, y, depth: depth + 1 });
        visited.add(childId);

        queue.push({
          nodeId: childId,
          depth: depth + 1,
          angle: childAngle,
          angleSpan: angleStep * 0.8, // Narrow span for next level
        });
      });
    }

    return positions;
  }, [nodes, rootNodeId]);

  /**
   * Calculate node visual properties
   */
  const getNodeVisuals = useCallback((node) => {
    const childCount = node.children?.length || 0;
    const depth = node.meta?.depth || 0;

    // Radius based on log(1 + childCount)
    const baseRadius = 30;
    const radius = baseRadius * (1 + Math.log(1 + childCount) * 0.5);

    // Color based on depth (gradient from purple to blue)
    const depthRatio = Math.min(depth / 5, 1);
    const hue = 260 - depthRatio * 60; // 260 (purple) to 200 (blue)
    const color = `hsl(${hue}, 70%, 60%)`;

    return { radius, color };
  }, []);

  /**
   * Handle node click
   */
  const handleNodeClick = useCallback(
    (nodeId, event) => {
      event.stopPropagation();
      setSelectedNodeId(nodeId);

      if (onNodeSelect) {
        const node = nodes.get(nodeId);
        onNodeSelect(node);
      }
    },
    [nodes, onNodeSelect]
  );

  /**
   * Handle node right-click (expand)
   */
  const handleNodeRightClick = useCallback(
    async (nodeId, event) => {
      event.preventDefault();
      event.stopPropagation();

      if (expandingNodeId) return; // Already expanding

      setExpandingNodeId(nodeId);
      setError(null);

      try {
        const newChildren = await expandNode(nodeId, {
          maxChildren: 3,
          style: 'concise',
          onProgress: setProgress,
        });

        // Reload the node tree to include new children
        if (newChildren.length > 0) {
          await loadNodeTree(nodeId, 0, 2); // Reload with depth 2
        }

        setProgress(null);
      } catch (err) {
        setError(`Expansion failed: ${err.message}`);
        setProgress(null);
      } finally {
        setExpandingNodeId(null);
      }
    },
    [expandingNodeId, loadNodeTree]
  );

  /**
   * Pan/Zoom: Mouse wheel handler
   */
  const handleWheel = useCallback((event) => {
    event.preventDefault();

    const delta = -event.deltaY * 0.001;
    const newScale = Math.max(0.1, Math.min(5, transform.scale * (1 + delta)));

    // Zoom towards mouse position
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = event.clientX - rect.left - rect.width / 2;
    const mouseY = event.clientY - rect.top - rect.height / 2;

    const scaleRatio = newScale / transform.scale;
    const newX = transform.x - mouseX * (scaleRatio - 1);
    const newY = transform.y - mouseY * (scaleRatio - 1);

    setTransform({ x: newX, y: newY, scale: newScale });
  }, [transform]);

  /**
   * Pan/Zoom: Mouse drag handlers
   */
  const handleMouseDown = useCallback((event) => {
    if (event.button !== 0) return; // Left button only
    setIsDragging(true);
    setDragStart({ x: event.clientX - transform.x, y: event.clientY - transform.y });
  }, [transform]);

  const handleMouseMove = useCallback(
    (event) => {
      if (!isDragging) return;

      const newX = event.clientX - dragStart.x;
      const newY = event.clientY - dragStart.y;

      setTransform((prev) => ({ ...prev, x: newX, y: newY }));
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * HUD: Reset zoom/center
   */
  const handleResetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  /**
   * Keyboard navigation
   */
  const handleKeyDown = useCallback(
    (event) => {
      if (!selectedNodeId) return;

      const selectedNode = nodes.get(selectedNodeId);
      if (!selectedNode) return;

      switch (event.key) {
        case 'Enter':
          // Expand node
          handleNodeRightClick(selectedNodeId, { preventDefault: () => {}, stopPropagation: () => {} });
          break;

        case ' ':
          // Toggle node details (space)
          event.preventDefault();
          // TODO: Show/hide full text panel
          break;

        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          // Navigate to siblings or parent/children
          event.preventDefault();
          // TODO: Implement arrow key navigation
          break;

        case 'Escape':
          setSelectedNodeId(null);
          break;

        default:
          break;
      }
    },
    [selectedNodeId, nodes, handleNodeRightClick]
  );

  // Attach event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  /**
   * Render canvas
   */
  const nodePositions = calculateNodePositions();
  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : null;

  return (
    <div className="fractal-canvas-container" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* HUD Controls */}
      <div className="fractal-hud">
        <button onClick={handleResetView} className="hud-button" aria-label="Reset view">
          ⟲ Reset View
        </button>
        <button
          onClick={() => setShowLabels(!showLabels)}
          className="hud-button"
          aria-label="Toggle labels"
        >
          {showLabels ? '🏷️ Hide Labels' : '🏷️ Show Labels'}
        </button>
        <div className="hud-info">
          Nodes: {nodes.size} | Zoom: {transform.scale.toFixed(2)}x
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="fractal-alert fractal-alert-error">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} className="alert-close">
            ×
          </button>
        </div>
      )}

      {/* Progress Indicator */}
      {progress && (
        <div className="fractal-progress">
          <div className="progress-bar" style={{ width: `${progress.progress * 100}%` }} />
          <p className="progress-message">{progress.message}</p>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`fractal-canvas ${isDragging ? 'dragging' : ''}`}
        role="application"
        aria-label="Fractal knowledge graph"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        {/* Render nodes */}
        {Array.from(nodes.entries()).map(([nodeId, node]) => {
          const pos = nodePositions.get(nodeId);
          if (!pos) return null;

          const visuals = getNodeVisuals(node);
          const isSelected = nodeId === selectedNodeId;
          const isExpanding = nodeId === expandingNodeId;

          return (
            <div
              key={nodeId}
              className={`fractal-node ${isSelected ? 'selected' : ''} ${isExpanding ? 'expanding' : ''}`}
              style={{
                left: `calc(50% + ${pos.x}px)`,
                top: `calc(50% + ${pos.y}px)`,
                width: `${visuals.radius * 2}px`,
                height: `${visuals.radius * 2}px`,
              }}
              onClick={(e) => handleNodeClick(nodeId, e)}
              onContextMenu={(e) => handleNodeRightClick(nodeId, e)}
              role="button"
              tabIndex={0}
              aria-label={`Node: ${node.title}`}
              aria-expanded={node.children && node.children.length > 0}
            >
              <div
                className="node-circle"
                style={{ backgroundColor: visuals.color }}
              >
                {isExpanding && <div className="node-spinner" />}
              </div>
              {showLabels && (
                <div className="node-label">
                  <div className="node-title">{node.title}</div>
                  {node.children && node.children.length > 0 && (
                    <div className="node-child-count">{node.children.length}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Render edges */}
        <svg className="fractal-edges" style={{ pointerEvents: 'none' }}>
          {Array.from(nodes.entries()).map(([nodeId, node]) => {
            if (!node.children || node.children.length === 0) return null;

            const parentPos = nodePositions.get(nodeId);
            if (!parentPos) return null;

            return node.children.map((childId) => {
              const childPos = nodePositions.get(childId);
              if (!childPos) return null;

              return (
                <line
                  key={`${nodeId}-${childId}`}
                  x1={`calc(50% + ${parentPos.x}px)`}
                  y1={`calc(50% + ${parentPos.y}px)`}
                  x2={`calc(50% + ${childPos.x}px)`}
                  y2={`calc(50% + ${childPos.y}px)`}
                  className="edge-line"
                  strokeWidth={2 / transform.scale}
                />
              );
            });
          })}
        </svg>
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="node-details-panel">
          <button
            onClick={() => setSelectedNodeId(null)}
            className="panel-close"
            aria-label="Close panel"
          >
            ×
          </button>
          <h3>{selectedNode.title}</h3>
          <p className="node-text">{selectedNode.text}</p>
          <div className="panel-meta">
            <div>
              <strong>Depth:</strong> {selectedNode.meta?.depth || 0}
            </div>
            <div>
              <strong>Children:</strong> {selectedNode.children?.length || 0}
            </div>
            <div>
              <strong>Created:</strong>{' '}
              {new Date(selectedNode.meta?.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div className="panel-actions">
            <button
              onClick={(e) => handleNodeRightClick(selectedNodeId, { preventDefault: () => {}, stopPropagation: () => {} })}
              className="btn btn-primary"
              disabled={expandingNodeId === selectedNodeId}
            >
              {expandingNodeId === selectedNodeId ? 'Expanding...' : 'Expand Node'}
            </button>
            <button className="btn btn-secondary" disabled>
              Edit (Coming Soon)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FractalCanvas;
