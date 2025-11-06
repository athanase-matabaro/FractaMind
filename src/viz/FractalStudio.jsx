/**
 * FractalStudio - Desktop Editor with Three-Panel Layout (v1.2)
 *
 * Professional fractal creation environment with:
 * - Left Panel: Project Browser (thumbnails, search, new project)
 * - Center Panel: Fractal Canvas (zoom, parameters, toolbar)
 * - Right Panel: Inspector (properties) + Timeline (keyframes, playhead)
 *
 * Specifications:
 * - 1440x1024 optimized layout
 * - Glass morphism panels (14px radius, soft shadows)
 * - 24px gutter between panels
 * - Real-time parameter updates (240ms ease-out)
 * - Collapsible panels for focus mode
 *
 * @param {Object} props
 * @param {string} props.projectId - Current project ID
 * @param {string} props.rootNodeId - Root node to visualize
 * @param {Object} props.quantParams - Quantization parameters
 * @param {Function} props.onNodeSelect - Callback when node selected
 */

import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import FractalCanvas from './FractalCanvas';
import './FractalStudio.css';

const FractalStudio = ({ projectId, rootNodeId, quantParams, onNodeSelect }) => {
  // Panel visibility state
  const [showProjectBrowser, setShowProjectBrowser] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);

  // Selected node for inspector
  const [selectedNode, setSelectedNode] = useState(null);

  // Zoom level (1x, 2x, 4x)
  const [zoomLevel, setZoomLevel] = useState(1);

  // Parameter overlay visibility
  const [showParameterOverlay, setShowParameterOverlay] = useState(true);

  /**
   * Handle node selection from canvas
   */
  const handleNodeSelect = useCallback((node) => {
    setSelectedNode(node);
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  }, [onNodeSelect]);

  /**
   * Handle zoom level change
   */
  const handleZoomChange = useCallback((level) => {
    setZoomLevel(level);
  }, []);

  /**
   * Toggle panel visibility
   */
  const toggleProjectBrowser = useCallback(() => {
    setShowProjectBrowser((prev) => !prev);
  }, []);

  const toggleInspector = useCallback(() => {
    setShowInspector((prev) => !prev);
  }, []);

  const toggleTimeline = useCallback(() => {
    setShowTimeline((prev) => !prev);
  }, []);

  return (
    <div className="fractal-studio" role="application" aria-label="Fractal Studio">
      {/* Top Toolbar */}
      <div className="studio-toolbar">
        <div className="toolbar-left">
          <button
            className="toolbar-button"
            onClick={toggleProjectBrowser}
            aria-label="Toggle project browser"
            aria-pressed={showProjectBrowser}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M2 4h16M2 10h16M2 16h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Projects
          </button>
        </div>

        <div className="toolbar-center">
          <span className="toolbar-title">FractalMind Studio</span>
        </div>

        <div className="toolbar-right">
          <button
            className="toolbar-button"
            onClick={toggleInspector}
            aria-label="Toggle inspector"
            aria-pressed={showInspector}
          >
            Inspector
          </button>
          <button
            className="toolbar-button"
            onClick={toggleTimeline}
            aria-label="Toggle timeline"
            aria-pressed={showTimeline}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* Three-Panel Layout */}
      <div className="studio-layout">
        {/* Left Panel: Project Browser */}
        {showProjectBrowser && (
          <aside
            className="studio-panel studio-panel-left"
            role="complementary"
            aria-label="Project browser"
          >
            <div className="panel-header">
              <h2 className="panel-title">Projects</h2>
              <button className="panel-close" onClick={toggleProjectBrowser} aria-label="Close panel">
                ×
              </button>
            </div>

            <div className="panel-content">
              {/* Search */}
              <div className="project-search">
                <input
                  type="search"
                  placeholder="Search projects..."
                  className="project-search-input"
                  aria-label="Search projects"
                />
              </div>

              {/* New Project Button */}
              <button className="project-new-button">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                New Project
              </button>

              {/* Project Thumbnails */}
              <div className="project-list">
                <div className="project-item project-item-active">
                  <div className="project-thumbnail">
                    <div className="project-thumbnail-placeholder" />
                  </div>
                  <div className="project-meta">
                    <span className="project-name">Current Project</span>
                    <span className="project-date">Today, 2:30 PM</span>
                  </div>
                </div>

                {/* Placeholder items */}
                <div className="project-item">
                  <div className="project-thumbnail">
                    <div className="project-thumbnail-placeholder" />
                  </div>
                  <div className="project-meta">
                    <span className="project-name">Research Notes</span>
                    <span className="project-date">Yesterday</span>
                  </div>
                </div>

                <div className="project-item">
                  <div className="project-thumbnail">
                    <div className="project-thumbnail-placeholder" />
                  </div>
                  <div className="project-meta">
                    <span className="project-name">Article Analysis</span>
                    <span className="project-date">2 days ago</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Center Panel: Fractal Canvas */}
        <main
          className="studio-panel studio-panel-center"
          role="main"
          aria-label="Fractal canvas"
        >
          {/* Zoom Controls */}
          <div className="canvas-zoom-controls">
            <button
              className={`zoom-button ${zoomLevel === 1 ? 'zoom-button-active' : ''}`}
              onClick={() => handleZoomChange(1)}
              aria-label="Zoom 1x"
            >
              1x
            </button>
            <button
              className={`zoom-button ${zoomLevel === 2 ? 'zoom-button-active' : ''}`}
              onClick={() => handleZoomChange(2)}
              aria-label="Zoom 2x"
            >
              2x
            </button>
            <button
              className={`zoom-button ${zoomLevel === 4 ? 'zoom-button-active' : ''}`}
              onClick={() => handleZoomChange(4)}
              aria-label="Zoom 4x"
            >
              4x
            </button>
          </div>

          {/* Parameter Overlay Toggle */}
          <button
            className="canvas-parameter-toggle"
            onClick={() => setShowParameterOverlay(!showParameterOverlay)}
            aria-label="Toggle parameter overlay"
            aria-pressed={showParameterOverlay}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Canvas Wrapper */}
          <div className="canvas-wrapper">
            <FractalCanvas
              projectId={projectId}
              rootNodeId={rootNodeId}
              quantParams={quantParams}
              onNodeSelect={handleNodeSelect}
            />
          </div>

          {/* Parameter Overlay */}
          {showParameterOverlay && (
            <div className="canvas-parameter-overlay">
              <div className="parameter-chip">
                <span className="parameter-label">Nodes</span>
                <span className="parameter-value">42</span>
              </div>
              <div className="parameter-chip">
                <span className="parameter-label">Depth</span>
                <span className="parameter-value">5</span>
              </div>
              <div className="parameter-chip">
                <span className="parameter-label">Scale</span>
                <span className="parameter-value">{zoomLevel}x</span>
              </div>
            </div>
          )}
        </main>

        {/* Right Panel: Inspector + Timeline */}
        {showInspector && (
          <aside
            className="studio-panel studio-panel-right"
            role="complementary"
            aria-label="Inspector and timeline"
          >
            {/* Inspector Section */}
            <div className="inspector-section">
              <div className="panel-header">
                <h2 className="panel-title">Inspector</h2>
                <button className="panel-close" onClick={toggleInspector} aria-label="Close panel">
                  ×
                </button>
              </div>

              <div className="panel-content">
                {selectedNode ? (
                  <div className="inspector-content">
                    <div className="inspector-field">
                      <label className="inspector-label">Title</label>
                      <input
                        type="text"
                        className="inspector-input"
                        value={selectedNode.title}
                        readOnly
                      />
                    </div>

                    <div className="inspector-field">
                      <label className="inspector-label">Type</label>
                      <span className="inspector-value">{selectedNode.type || 'node'}</span>
                    </div>

                    <div className="inspector-field">
                      <label className="inspector-label">Children</label>
                      <span className="inspector-value">{selectedNode.children?.length || 0}</span>
                    </div>

                    {/* Accordion Sections */}
                    <details className="inspector-accordion" open>
                      <summary className="accordion-summary">Properties</summary>
                      <div className="accordion-content">
                        <p className="inspector-text">{selectedNode.text || 'No text available'}</p>
                      </div>
                    </details>

                    <details className="inspector-accordion">
                      <summary className="accordion-summary">Metadata</summary>
                      <div className="accordion-content">
                        <div className="inspector-meta-item">
                          <span className="meta-key">ID:</span>
                          <span className="meta-value">{selectedNode.id}</span>
                        </div>
                        <div className="inspector-meta-item">
                          <span className="meta-key">Created:</span>
                          <span className="meta-value">
                            {selectedNode.meta?.createdAt || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="inspector-empty">
                    <p>Select a node to view properties</p>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Section */}
            {showTimeline && (
              <div className="timeline-section">
                <div className="panel-header">
                  <h2 className="panel-title">Timeline</h2>
                  <button className="panel-close" onClick={toggleTimeline} aria-label="Close timeline">
                    ×
                  </button>
                </div>

                <div className="timeline-content">
                  {/* Playhead */}
                  <div className="timeline-playhead">
                    <button className="timeline-play-button" aria-label="Play animation">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 2l10 6-10 6V2z" fill="currentColor" />
                      </svg>
                    </button>
                    <div className="timeline-scrubber">
                      <div className="timeline-track" />
                      <div className="timeline-thumb" style={{ left: '30%' }} />
                    </div>
                    <span className="timeline-time">0:03</span>
                  </div>

                  {/* Keyframes */}
                  <div className="timeline-keyframes">
                    <div className="keyframe" style={{ left: '0%' }} />
                    <div className="keyframe" style={{ left: '30%' }} />
                    <div className="keyframe" style={{ left: '60%' }} />
                    <div className="keyframe" style={{ left: '90%' }} />
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};

FractalStudio.propTypes = {
  projectId: PropTypes.string.isRequired,
  rootNodeId: PropTypes.string.isRequired,
  quantParams: PropTypes.object,
  onNodeSelect: PropTypes.func,
};

export default FractalStudio;
