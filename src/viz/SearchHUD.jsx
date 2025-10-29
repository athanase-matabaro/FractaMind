/**
 * SearchHUD.jsx - Search UI overlay for FractalCanvas
 *
 * Provides semantic search interface with:
 * - Input box with keyboard shortcut (/) to focus
 * - Debounced search (250ms)
 * - Results dropdown with title, snippet, and score
 * - Clicking result centers node on canvas and opens details
 * - Keyboard navigation (arrows + Enter)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { semanticSearch } from '../core/searcher.js';
import './SearchHUD.css';

const SearchHUD = ({ projectId, quantParams, onResultSelect, disabled = false }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isExpanded, setIsExpanded] = useState(false);

  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Handle "/" keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only if not typing in another input
        if (
          document.activeElement.tagName !== 'INPUT' &&
          document.activeElement.tagName !== 'TEXTAREA'
        ) {
          e.preventDefault();
          inputRef.current?.focus();
          setIsExpanded(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search
  const performSearch = useCallback(
    async (searchQuery) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const searchResults = await semanticSearch(searchQuery, {
          projectId,
          topK: 10,
          quantParams,
          radiusPower: 12,
        });

        setResults(searchResults);
        setSelectedIndex(-1);
      } catch (err) {
        console.error('Search failed:', err);
        setError(err.message || 'Search failed');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [projectId, quantParams]
  );

  // Handle input change with debouncing
  const handleInputChange = useCallback(
    (e) => {
      const newQuery = e.target.value;
      setQuery(newQuery);

      // Clear previous timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        performSearch(newQuery);
      }, 250); // 250ms debounce
    },
    [performSearch]
  );

  // Handle keyboard navigation in results
  const handleKeyDown = useCallback(
    (e) => {
      if (results.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        handleResultClick(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsExpanded(false);
        setQuery('');
        setResults([]);
        inputRef.current?.blur();
      }
    },
    [results, selectedIndex]
  );

  // Handle result selection
  const handleResultClick = useCallback(
    (result) => {
      console.log('Search result selected:', result.nodeId, result.title);
      onResultSelect?.(result);

      // Clear search
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
      setIsExpanded(false);
    },
    [onResultSelect]
  );

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex];
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  return (
    <div className={`search-hud ${isExpanded ? 'search-hud-expanded' : ''}`}>
      <div className="search-hud-input-container">
        <input
          ref={inputRef}
          type="text"
          className="search-hud-input"
          placeholder="Search across ideas — try 'sustainable cooling' (press / to focus)"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsExpanded(true)}
          onBlur={() => {
            // Delay to allow result clicks to register
            setTimeout(() => {
              if (!query && results.length === 0) {
                setIsExpanded(false);
              }
            }, 200);
          }}
          disabled={disabled}
          aria-label="Search nodes by semantic similarity"
          aria-expanded={isExpanded && (results.length > 0 || isSearching)}
          aria-controls="search-results"
          aria-activedescendant={selectedIndex >= 0 ? `result-${selectedIndex}` : undefined}
        />

        {isSearching && (
          <div className="search-hud-spinner" aria-label="Searching..." role="status">
            <div className="spinner-circle" />
          </div>
        )}

        {!isSearching && query && (
          <button
            className="search-hud-clear"
            onClick={() => {
              setQuery('');
              setResults([]);
              setSelectedIndex(-1);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {isExpanded && (results.length > 0 || error || (query && !isSearching && results.length === 0)) && (
        <div
          id="search-results"
          ref={resultsRef}
          className="search-hud-results"
          role="listbox"
          aria-label="Search results"
        >
          {error && (
            <div className="search-hud-error" role="alert">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!error && query && !isSearching && results.length === 0 && (
            <div className="search-hud-no-results">
              <p>No results found for "{query}"</p>
              <p className="search-hud-hint">
                Try different keywords or check if the project has been indexed.
              </p>
            </div>
          )}

          {!error &&
            results.map((result, index) => (
              <div
                key={result.nodeId}
                id={`result-${index}`}
                className={`search-hud-result ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleResultClick(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                role="option"
                aria-selected={index === selectedIndex}
                tabIndex={-1}
              >
                <div className="search-hud-result-header">
                  <h4 className="search-hud-result-title">{result.title}</h4>
                  <span
                    className="search-hud-result-score"
                    title={`Similarity score: ${(result.score * 100).toFixed(1)}%`}
                  >
                    {(result.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="search-hud-result-snippet">{result.snippet}</p>
              </div>
            ))}
        </div>
      )}

      {isExpanded && results.length > 0 && (
        <div className="search-hud-footer">
          <span className="search-hud-hint">
            Use ↑↓ to navigate, Enter to select, Esc to close
          </span>
        </div>
      )}
    </div>
  );
};

export default SearchHUD;
