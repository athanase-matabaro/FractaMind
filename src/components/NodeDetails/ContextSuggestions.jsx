/**
 * ContextSuggestions - Display contextually relevant nodes based on decay-weighted scoring
 *
 * Shows top 3-5 suggestions with:
 * - Node title
 * - Relevance score
 * - Brief reason (recent action + semantic similarity)
 * - Click to navigate
 */

import React, { useState, useEffect } from 'react';
import { getContextSuggestions } from '../../core/contextManager.js';
import './ContextSuggestions.css';

const ContextSuggestions = ({ currentNodeEmbedding, onSuggestionClick, limit = 3 }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!currentNodeEmbedding || !expanded) {
      setSuggestions([]);
      return;
    }

    const loadSuggestions = async () => {
      setLoading(true);
      setError(null);

      try {
        const results = await getContextSuggestions({
          queryEmbedding: currentNodeEmbedding,
          topN: limit,
        });
        setSuggestions(results);
      } catch (err) {
        console.error('Failed to load context suggestions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [currentNodeEmbedding, expanded, limit]);

  const handleSuggestionClick = (suggestion) => {
    onSuggestionClick?.(suggestion);
  };

  if (!currentNodeEmbedding) {
    return null;
  }

  return (
    <div className="context-suggestions">
      <button
        className="context-suggestions-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide context suggestions' : 'Show context suggestions'}
      >
        <span className="context-suggestions-icon">🧠</span>
        <span className="context-suggestions-label">Context Suggestions</span>
        <span className="context-suggestions-arrow">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="context-suggestions-content">
          {loading && (
            <div className="context-suggestions-loading">
              <p>Finding relevant nodes...</p>
            </div>
          )}

          {error && (
            <div className="context-suggestions-error">
              <p>Failed to load suggestions: {error}</p>
            </div>
          )}

          {!loading && !error && suggestions.length === 0 && (
            <div className="context-suggestions-empty">
              <p>No contextual suggestions yet</p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                Interact with more nodes to build context
              </p>
            </div>
          )}

          {!loading && !error && suggestions.length > 0 && (
            <div className="context-suggestions-list">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.nodeId}
                  className="context-suggestion-item"
                  onClick={() => handleSuggestionClick(suggestion)}
                  aria-label={`Navigate to ${suggestion.title}`}
                >
                  <div className="context-suggestion-header">
                    <span className="context-suggestion-rank">#{index + 1}</span>
                    <span className="context-suggestion-score">
                      {(suggestion.score * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="context-suggestion-title">{suggestion.title}</div>

                  <div className="context-suggestion-reason">{suggestion.reason}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextSuggestions;
