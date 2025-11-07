/**
 * ContextSuggestions - Phase 6: Display semantic link suggestions
 *
 * Shows top 6-8 suggestions with:
 * - Node title and snippet
 * - Relation type badge
 * - Confidence score
 * - Rationale
 * - Accept/Reject buttons
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { suggestLinks } from '../../core/contextualizer.js';
import { CONTEXTUALIZATION, FEATURE_FLAGS } from '../../config.js';
import LinkEditor from './LinkEditor.jsx';
import './ContextSuggestions.css';

const ContextSuggestions = ({
  currentNodeId,
  currentNode,
  projectId,
  availableNodes = [],
  onLinkCreated,
  onSuggestionClick,
  limit = 6
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [rejectedIds, setRejectedIds] = useState(new Set());

  // LinkEditor state
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);

  useEffect(() => {
    if (!currentNodeId || !expanded || !FEATURE_FLAGS.FEATURE_CONTEXTUAL_LINKS) {
      setSuggestions([]);
      return;
    }

    const loadSuggestions = async () => {
      setLoading(true);
      setError(null);

      try {
        const results = await suggestLinks(currentNodeId, {
          topK: limit,
          mode: 'mock', // TODO: Switch to 'live' when AI integration is ready
          projectId,
          includeContextBias: true,
        });
        setSuggestions(results);
        setRejectedIds(new Set()); // Reset rejected on new suggestions
      } catch (err) {
        console.error('[ContextSuggestions] Failed to load suggestions:', err);
        setError(err.message || 'Failed to generate suggestions');
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [currentNodeId, expanded, limit, projectId]);

  const handleSuggestionClick = (suggestion) => {
    onSuggestionClick?.(suggestion);
  };

  const handleAccept = (suggestion, e) => {
    e?.stopPropagation();
    console.log('[ContextSuggestions] Accepting suggestion:', suggestion.candidateNodeId);
    setSelectedSuggestion(suggestion);
    setLinkEditorOpen(true);
  };

  const handleReject = (suggestion, e) => {
    e?.stopPropagation();
    console.log('[ContextSuggestions] Rejecting suggestion:', suggestion.candidateNodeId);
    setRejectedIds(prev => new Set(prev).add(suggestion.candidateNodeId));
  };

  const handleLinkCreated = (link) => {
    console.log('[ContextSuggestions] Link created:', link.linkId);
    // Remove from suggestions list
    setSuggestions(prev => prev.filter(s => s.candidateNodeId !== link.targetNodeId));
    if (onLinkCreated) {
      onLinkCreated(link);
    }
  };

  const getRelationTypeIcon = (relationType) => {
    const relation = CONTEXTUALIZATION.RELATION_TYPES.find(r => r.id === relationType);
    return relation ? relation.icon : '🔗';
  };

  const getRelationTypeLabel = (relationType) => {
    const relation = CONTEXTUALIZATION.RELATION_TYPES.find(r => r.id === relationType);
    return relation ? relation.label : relationType;
  };

  if (!currentNodeId || !FEATURE_FLAGS.FEATURE_CONTEXTUAL_LINKS) {
    return null;
  }

  // Filter out rejected suggestions
  const visibleSuggestions = suggestions.filter(s => !rejectedIds.has(s.candidateNodeId));

  return (
    <>
      <div className="context-suggestions">
        <button
          className="context-suggestions-toggle"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide link suggestions' : 'Show link suggestions'}
        >
          <span className="context-suggestions-icon">🔗</span>
          <span className="context-suggestions-label">
            Link Suggestions
            {visibleSuggestions.length > 0 && !loading && expanded && (
              <span className="context-suggestions-count"> ({visibleSuggestions.length})</span>
            )}
          </span>
          <span className="context-suggestions-arrow">{expanded ? '▼' : '▶'}</span>
        </button>

        {expanded && (
          <div className="context-suggestions-content">
            {loading && (
              <div className="context-suggestions-loading">
                <div className="context-suggestions-spinner"></div>
                <p>Analyzing semantic relationships...</p>
              </div>
            )}

            {error && (
              <div className="context-suggestions-error">
                <strong>Error:</strong> {error}
              </div>
            )}

            {!loading && !error && visibleSuggestions.length === 0 && (
              <div className="context-suggestions-empty">
                <p>No link suggestions available</p>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.25rem' }}>
                  {suggestions.length > 0 && rejectedIds.size > 0
                    ? 'All suggestions have been rejected'
                    : 'Add more nodes to your project to see suggestions'}
                </p>
              </div>
            )}

            {!loading && !error && visibleSuggestions.length > 0 && (
              <div className="context-suggestions-list">
                {visibleSuggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.candidateNodeId}
                    className="context-suggestion-item"
                  >
                    <div className="context-suggestion-main" onClick={() => handleSuggestionClick(suggestion)}>
                      <div className="context-suggestion-header">
                        <span className="context-suggestion-rank">#{index + 1}</span>
                        <div className="context-suggestion-badges">
                          <span className="context-suggestion-relation-badge" title={getRelationTypeLabel(suggestion.relationType)}>
                            {getRelationTypeIcon(suggestion.relationType)} {getRelationTypeLabel(suggestion.relationType)}
                          </span>
                          <span className="context-suggestion-score" title={`Confidence: ${(suggestion.confidence * 100).toFixed(1)}%`}>
                            {(suggestion.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="context-suggestion-title">{suggestion.title}</div>

                      {suggestion.snippet && (
                        <div className="context-suggestion-snippet">{suggestion.snippet}</div>
                      )}

                      <div className="context-suggestion-rationale">{suggestion.rationale}</div>
                    </div>

                    <div className="context-suggestion-actions">
                      <button
                        className="context-suggestion-btn context-suggestion-btn-reject"
                        onClick={(e) => handleReject(suggestion, e)}
                        aria-label="Reject suggestion"
                        title="Reject this suggestion"
                      >
                        ✕ Reject
                      </button>
                      <button
                        className="context-suggestion-btn context-suggestion-btn-accept"
                        onClick={(e) => handleAccept(suggestion, e)}
                        aria-label="Accept suggestion"
                        title="Create this link"
                      >
                        ✓ Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* LinkEditor Modal */}
      {linkEditorOpen && selectedSuggestion && currentNode && (
        <LinkEditor
          isOpen={linkEditorOpen}
          onClose={() => {
            setLinkEditorOpen(false);
            setSelectedSuggestion(null);
          }}
          onLinkCreated={handleLinkCreated}
          sourceNode={currentNode}
          suggestion={selectedSuggestion}
          projectId={projectId}
          availableNodes={availableNodes}
        />
      )}
    </>
  );
};

ContextSuggestions.propTypes = {
  currentNodeId: PropTypes.string,
  currentNode: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
  }),
  projectId: PropTypes.string.isRequired,
  availableNodes: PropTypes.arrayOf(PropTypes.object),
  onLinkCreated: PropTypes.func,
  onSuggestionClick: PropTypes.func,
  limit: PropTypes.number,
};

export default ContextSuggestions;
