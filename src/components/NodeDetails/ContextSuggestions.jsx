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

      <style jsx>{`
        .context-suggestions {
          margin-top: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .context-suggestions-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #f9fafb;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .context-suggestions-toggle:hover {
          background: #f3f4f6;
        }

        .context-suggestions-toggle:focus {
          outline: 2px solid #3b82f6;
          outline-offset: -2px;
        }

        .context-suggestions-icon {
          font-size: 1.25rem;
        }

        .context-suggestions-label {
          flex: 1;
          font-weight: 600;
          color: #374151;
          text-align: left;
        }

        .context-suggestions-arrow {
          color: #9ca3af;
          font-size: 0.75rem;
        }

        .context-suggestions-content {
          padding: 1rem;
          background: white;
        }

        .context-suggestions-loading,
        .context-suggestions-error,
        .context-suggestions-empty {
          text-align: center;
          padding: 1rem;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .context-suggestions-error {
          color: #ef4444;
        }

        .context-suggestions-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .context-suggestion-item {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 0.75rem;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .context-suggestion-item:hover {
          border-color: #3b82f6;
          background: #eff6ff;
          transform: translateX(2px);
        }

        .context-suggestion-item:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .context-suggestion-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .context-suggestion-rank {
          font-size: 0.75rem;
          font-weight: 700;
          color: #9ca3af;
        }

        .context-suggestion-score {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.125rem 0.5rem;
          background: #3b82f6;
          color: white;
          border-radius: 4px;
        }

        .context-suggestion-title {
          font-weight: 600;
          color: #111827;
          margin-bottom: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .context-suggestion-reason {
          font-size: 0.75rem;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
};

export default ContextSuggestions;
