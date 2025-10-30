/**
 * FederatedResults.jsx - Display grouped search results from federated projects
 */

import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import './FederatedResults.css';

/**
 * FederatedResults Component
 * Displays search results grouped by project with actions
 *
 * @param {Object} props - Component props
 * @param {Array} props.results - Search results array
 * @param {Function} props.onResultClick - Handler for result click
 * @param {Function} props.onCenterNode - Handler to center node on canvas
 * @param {Function} props.onOpenDetails - Handler to open node details
 * @param {Function} props.onAddToFocus - Handler to add node to focus list
 * @param {boolean} props.groupByProject - Whether to group results by project
 * @returns {JSX.Element}
 */
function FederatedResults({
  results = [],
  onResultClick,
  onCenterNode,
  onOpenDetails,
  onAddToFocus,
  groupByProject = true
}) {
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [selectedResultId, setSelectedResultId] = useState(null);

  // Group results by project
  const groupedResults = useMemo(() => {
    if (!groupByProject) {
      return { all: results };
    }

    const groups = {};
    for (const result of results) {
      const projectId = result.projectId || 'unknown';
      if (!groups[projectId]) {
        groups[projectId] = [];
      }
      groups[projectId].push(result);
    }
    return groups;
  }, [results, groupByProject]);

  // Toggle project expansion
  const toggleProject = (projectId) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // Handle result click
  const handleResultClick = (result) => {
    setSelectedResultId(result.nodeId);
    onResultClick?.(result);
  };

  // Handle keyboard navigation
  const handleResultKeyDown = (e, result) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleResultClick(result);
    }
  };

  // Render a single result item
  const renderResult = (result, index) => {
    const isSelected = selectedResultId === result.nodeId;
    const resultId = `result-${result.projectId}-${result.nodeId}`;

    return (
      <div
        key={resultId}
        className={`federated-result-item ${isSelected ? 'selected' : ''}`}
        onClick={() => handleResultClick(result)}
        onKeyDown={(e) => handleResultKeyDown(e, result)}
        tabIndex={0}
        role="button"
        aria-label={`Result ${index + 1}: ${result.title}`}
      >
        <div className="result-header">
          <h4 className="result-title">{result.title || 'Untitled'}</h4>
          <div className="result-score">
            {Math.round((result.finalScore || result.sim || 0) * 100)}%
          </div>
        </div>

        {result.snippet && (
          <p className="result-snippet">{result.snippet}</p>
        )}

        {result.nodePath && result.nodePath.length > 0 && (
          <div className="result-path">
            {result.nodePath.map((pathNode, i) => (
              <span key={i} className="path-segment">
                {i > 0 && ' › '}
                {pathNode.title || pathNode.id}
              </span>
            ))}
          </div>
        )}

        <div className="result-meta">
          {result.duplicateCount > 1 && (
            <span className="duplicate-badge" title={`Found in ${result.duplicateCount} projects`}>
              {result.duplicateCount} copies
            </span>
          )}

          {result.freshnessBoost > 1.1 && (
            <span className="fresh-badge" title="Recently updated">
              Fresh
            </span>
          )}
        </div>

        <div className="result-actions">
          <button
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onCenterNode?.(result);
            }}
            title="Center on canvas"
            aria-label="Center this node on canvas"
          >
            🎯
          </button>

          <button
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails?.(result);
            }}
            title="Open details"
            aria-label="Open node details"
          >
            📄
          </button>

          <button
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAddToFocus?.(result);
            }}
            title="Add to focus list"
            aria-label="Add to focus list"
          >
            ⭐
          </button>
        </div>
      </div>
    );
  };

  // Render project group
  const renderProjectGroup = (projectId, projectResults) => {
    const isExpanded = expandedProjects.has(projectId);
    const resultCount = projectResults.length;

    return (
      <div key={projectId} className="project-group">
        <div
          className="project-header"
          onClick={() => toggleProject(projectId)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleProject(projectId);
            }
          }}
          tabIndex={0}
          role="button"
          aria-expanded={isExpanded}
          aria-label={`Project ${projectId}, ${resultCount} results`}
        >
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
          <h3 className="project-name">{projectId}</h3>
          <span className="result-count">{resultCount} results</span>
        </div>

        {isExpanded && (
          <div className="project-results" role="list">
            {projectResults.map((result, index) => renderResult(result, index))}
          </div>
        )}
      </div>
    );
  };

  // Empty state
  if (results.length === 0) {
    return (
      <div className="federated-results empty">
        <div className="empty-state">
          <p>No results found</p>
          <p className="empty-hint">Try adjusting your search query or selecting more projects</p>
        </div>
      </div>
    );
  }

  return (
    <div className="federated-results" role="region" aria-label="Search results">
      <div className="results-header">
        <h2 className="results-title">
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </h2>

        {groupByProject && Object.keys(groupedResults).length > 1 && (
          <button
            className="toggle-all-btn"
            onClick={() => {
              if (expandedProjects.size === 0) {
                setExpandedProjects(new Set(Object.keys(groupedResults)));
              } else {
                setExpandedProjects(new Set());
              }
            }}
            aria-label={expandedProjects.size === 0 ? 'Expand all' : 'Collapse all'}
          >
            {expandedProjects.size === 0 ? 'Expand all' : 'Collapse all'}
          </button>
        )}
      </div>

      <div className="results-container">
        {groupByProject ? (
          Object.entries(groupedResults).map(([projectId, projectResults]) =>
            renderProjectGroup(projectId, projectResults)
          )
        ) : (
          <div className="flat-results" role="list">
            {results.map((result, index) => renderResult(result, index))}
          </div>
        )}
      </div>
    </div>
  );
}

FederatedResults.propTypes = {
  results: PropTypes.arrayOf(PropTypes.shape({
    projectId: PropTypes.string,
    nodeId: PropTypes.string.isRequired,
    title: PropTypes.string,
    snippet: PropTypes.string,
    finalScore: PropTypes.number,
    sim: PropTypes.number,
    nodePath: PropTypes.array,
    duplicateCount: PropTypes.number,
    freshnessBoost: PropTypes.number
  })),
  onResultClick: PropTypes.func,
  onCenterNode: PropTypes.func,
  onOpenDetails: PropTypes.func,
  onAddToFocus: PropTypes.func,
  groupByProject: PropTypes.bool
};

export default FederatedResults;
