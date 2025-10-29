/**
 * WorkspaceView - Federated multi-project dashboard and search interface
 *
 * Features:
 * - Display all loaded projects with metadata cards
 * - Toggle projects active/inactive for search
 * - Adjust project weights (ranking bias)
 * - Cross-project semantic search with grouped results
 * - Click to navigate to node in FractalCanvas
 * - Keyboard shortcuts: / (focus search), Tab (switch groups), Enter (open node)
 * - Project statistics and workspace overview
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listProjects, setProjectActive, setProjectWeight, deleteProject, getProjectStats } from '../core/projectRegistry.js';
import { crossProjectSearch } from '../core/crossSearcher.js';
import { getFederationStats } from '../core/federation.js';
import './WorkspaceView.css';

const WorkspaceView = ({ onNodeClick, onClose }) => {
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [projectStats, setProjectStats] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState(new Set());

  const searchInputRef = useRef(null);

  const loadProjects = useCallback(async () => {
    try {
      const allProjects = await listProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const pStats = await getProjectStats();
      setProjectStats(pStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  // Load projects and stats on mount
  useEffect(() => {
    loadProjects();
    loadStats();
  }, [loadProjects, loadStats]);

  // Perform cross-project search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await crossProjectSearch(searchQuery, {
        topK: 30,
        applyWeights: true,
        applyFreshness: true,
        onProgress: (projectId, current, total) => {
          console.log(`Searching ${current}/${total}: ${projectId}`);
        }
      });

      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError(error.message);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Debounced search on query change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Toggle project active state
  const handleToggleActive = useCallback(async (projectId, currentState) => {
    try {
      await setProjectActive(projectId, !currentState);
      await loadProjects();
      await loadStats();
    } catch (error) {
      console.error('Failed to toggle project:', error);
    }
  }, [loadProjects, loadStats]);

  // Update project weight
  const handleWeightChange = useCallback(async (projectId, newWeight) => {
    try {
      await setProjectWeight(projectId, parseFloat(newWeight));
      await loadProjects();
    } catch (error) {
      console.error('Failed to update weight:', error);
    }
  }, [loadProjects]);

  // Delete project
  const handleDeleteProject = useCallback(async (projectId) => {
    if (!confirm('Remove this project from workspace? (Nodes will remain in the main database)')) {
      return;
    }

    try {
      await deleteProject(projectId);
      await loadProjects();
      await loadStats();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }, [loadProjects, loadStats]);

  // Handle result click
  const handleResultClick = useCallback((result) => {
    if (onNodeClick) {
      onNodeClick({
        nodeId: result.nodeId,
        projectId: result.projectId
      });
    }
  }, [onNodeClick]);

  // Toggle project expansion in results
  const toggleProjectExpansion = useCallback((projectId) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  // Group search results by project
  const groupedResults = searchResults.reduce((acc, result) => {
    if (!acc[result.projectId]) {
      acc[result.projectId] = [];
    }
    acc[result.projectId].push(result);
    return acc;
  }, {});

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // / to focus search
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Escape to close
      if (e.key === 'Escape') {
        if (onClose) {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="workspace-view">
      {/* Header */}
      <div className="workspace-header">
        <div className="workspace-header-left">
          <h1 className="workspace-title">🏢 Workspace</h1>
          {projectStats && (
            <div className="workspace-stats">
              <span className="stat">{projectStats.totalProjects} projects</span>
              <span className="stat-separator">•</span>
              <span className="stat">{projectStats.activeProjects} active</span>
              <span className="stat-separator">•</span>
              <span className="stat">{projectStats.totalNodes} nodes</span>
            </div>
          )}
        </div>
        <button
          className="workspace-close-btn"
          onClick={onClose}
          aria-label="Close workspace"
        >
          ✕
        </button>
      </div>

      {/* Search Bar */}
      <div className="workspace-search-section">
        <div className="workspace-search-bar">
          <span className="search-icon">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            className="workspace-search-input"
            placeholder="Search across all active projects... (press / to focus)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isSearching}
          />
          {isSearching && <span className="search-spinner">⏳</span>}
        </div>
        {searchError && (
          <div className="search-error">
            ⚠️ {searchError}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="workspace-content">
        {/* Search Results */}
        {searchQuery && searchResults.length > 0 && (
          <div className="search-results-section">
            <h2 className="section-title">
              Search Results ({searchResults.length})
            </h2>
            <div className="search-results-grouped">
              {Object.entries(groupedResults).map(([projectId, results]) => {
                const project = projects.find(p => p.projectId === projectId);
                const isExpanded = expandedProjects.has(projectId);

                return (
                  <div key={projectId} className="result-project-group">
                    <button
                      className="project-group-header"
                      onClick={() => toggleProjectExpansion(projectId)}
                    >
                      <span className="project-group-icon">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <span className="project-group-name">
                        {project?.name || projectId}
                      </span>
                      <span className="project-group-count">
                        {results.length} results
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="result-items">
                        {results.map((result, idx) => (
                          <button
                            key={`${result.nodeId}-${idx}`}
                            className="result-item"
                            onClick={() => handleResultClick(result)}
                          >
                            <div className="result-header">
                              <span className="result-title">{result.title}</span>
                              <span className="result-score">
                                {(result.finalScore * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="result-snippet">{result.snippet}</p>
                            <div className="result-meta">
                              <span className="result-meta-item">
                                Similarity: {(result.rawSimilarity * 100).toFixed(0)}%
                              </span>
                              <span className="result-meta-separator">•</span>
                              <span className="result-meta-item">
                                Weight: {result.projectWeight.toFixed(1)}x
                              </span>
                              {result.freshnessBoost > 1.0 && (
                                <>
                                  <span className="result-meta-separator">•</span>
                                  <span className="result-meta-item result-fresh">
                                    +{((result.freshnessBoost - 1.0) * 100).toFixed(0)}% fresh
                                  </span>
                                </>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {searchQuery && searchResults.length === 0 && !isSearching && !searchError && (
          <div className="search-empty">
            <span className="search-empty-icon">🔍</span>
            <p>No results found for &ldquo;{searchQuery}&rdquo;</p>
            <p className="search-empty-hint">Try different keywords or check if projects are active</p>
          </div>
        )}

        {/* Project Cards */}
        {!searchQuery && (
          <div className="projects-section">
            <h2 className="section-title">Projects</h2>
            <div className="project-cards">
              {projects.map(project => (
                <div
                  key={project.projectId}
                  className={`project-card ${!project.isActive ? 'project-card-inactive' : ''} ${selectedProjectId === project.projectId ? 'project-card-selected' : ''}`}
                  onClick={() => setSelectedProjectId(project.projectId)}
                >
                  <div className="project-card-header">
                    <h3 className="project-name">{project.name}</h3>
                    <div className="project-actions">
                      <button
                        className={`project-toggle ${project.isActive ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(project.projectId, project.isActive);
                        }}
                        aria-label={project.isActive ? 'Deactivate' : 'Activate'}
                        title={project.isActive ? 'Included in searches' : 'Excluded from searches'}
                      >
                        {project.isActive ? '👁️' : '👁️‍🗨️'}
                      </button>
                      <button
                        className="project-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.projectId);
                        }}
                        aria-label="Delete project"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="project-metadata">
                    <div className="project-meta-item">
                      <span className="meta-label">Nodes:</span>
                      <span className="meta-value">{project.nodeCount}</span>
                    </div>
                    <div className="project-meta-item">
                      <span className="meta-label">Imported:</span>
                      <span className="meta-value">
                        {new Date(project.importDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="project-meta-item">
                      <span className="meta-label">Last Used:</span>
                      <span className="meta-value">
                        {new Date(project.lastAccessed).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="project-weight-control">
                    <label htmlFor={`weight-${project.projectId}`} className="weight-label">
                      Search Weight: {project.weight.toFixed(1)}x
                    </label>
                    <input
                      id={`weight-${project.projectId}`}
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.1"
                      value={project.weight}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleWeightChange(project.projectId, e.target.value);
                      }}
                      className="weight-slider"
                      disabled={!project.isActive}
                    />
                  </div>

                  {project.meta?.description && (
                    <p className="project-description">{project.meta.description}</p>
                  )}

                  {project.meta?.tags && project.meta.tags.length > 0 && (
                    <div className="project-tags">
                      {project.meta.tags.map(tag => (
                        <span key={tag} className="project-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {projects.length === 0 && (
              <div className="projects-empty">
                <span className="projects-empty-icon">📁</span>
                <p>No projects in workspace yet</p>
                <p className="projects-empty-hint">Import documents to create projects</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="workspace-shortcuts">
        <span className="shortcut"><kbd>/</kbd> Focus search</span>
        <span className="shortcut"><kbd>Esc</kbd> Close</span>
        <span className="shortcut"><kbd>Enter</kbd> Open selected</span>
      </div>
    </div>
  );
};

export default WorkspaceView;
