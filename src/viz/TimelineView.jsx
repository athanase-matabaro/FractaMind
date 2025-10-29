/**
 * TimelineView - Semantic timeline visualization of user interactions
 *
 * Features:
 * - Displays interactions chronologically with time scale
 * - Color-coded action dots
 * - Clickable items to focus nodes in FractalCanvas
 * - Keyboard navigation (arrow keys, Enter)
 * - Time range filters (1h, 24h, 7d, 30d, all)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getRecentInteractions, getMemoryStats } from '../core/memory.js';
import { getNode } from '../db/fractamind-indexer.js';
import TimelineItem from './TimelineItem.jsx';
import './TimelineView.css';

// Time filter options (in milliseconds)
const TIME_FILTERS = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  'all': Infinity,
};

// Group interactions by date
function groupByDate(interactions) {
  const groups = {};
  const now = new Date();

  interactions.forEach(interaction => {
    const date = new Date(interaction.at);
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    let key;
    if (diffDays === 0) {
      key = 'Today';
    } else if (diffDays === 1) {
      key = 'Yesterday';
    } else if (diffDays < 7) {
      key = `${diffDays} days ago`;
    } else if (diffDays < 30) {
      key = `${Math.floor(diffDays / 7)} weeks ago`;
    } else {
      key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(interaction);
  });

  return groups;
}

const TimelineView = ({ onItemClick, onClose }) => {
  const [interactions, setInteractions] = useState([]);
  const [filteredInteractions, setFilteredInteractions] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [stats, setStats] = useState(null);
  const [nodeTitles, setNodeTitles] = useState(new Map());

  const itemRefs = useRef([]);

  // Load interactions
  const loadInteractions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getRecentInteractions({ limit: 200 });
      setInteractions(data);

      // Load node titles
      const titles = new Map();
      const nodeIds = [...new Set(data.map(i => i.nodeId).filter(Boolean))];

      await Promise.all(
        nodeIds.map(async nodeId => {
          try {
            const node = await getNode(nodeId);
            if (node) {
              titles.set(nodeId, node.title);
            }
          } catch (err) {
            console.error(`Failed to load node ${nodeId}:`, err);
          }
        })
      );

      setNodeTitles(titles);

      // Load stats
      const memoryStats = await getMemoryStats();
      setStats(memoryStats);
    } catch (err) {
      console.error('Failed to load interactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  // Apply time filter
  useEffect(() => {
    const filterMs = TIME_FILTERS[activeFilter];
    const cutoff = Date.now() - filterMs;

    const filtered = interactions.filter(i => {
      const timestamp = new Date(i.at).getTime();
      return timestamp >= cutoff;
    });

    setFilteredInteractions(filtered);
    setSelectedIndex(-1);
  }, [interactions, activeFilter]);

  // Handle item click
  const handleItemClick = useCallback((interaction) => {
    if (interaction.nodeId && onItemClick) {
      onItemClick(interaction);
    }
  }, [onItemClick]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (filteredInteractions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredInteractions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleItemClick(filteredInteractions[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
    }
  }, [filteredInteractions, selectedIndex, handleItemClick, onClose]);

  // Focus selected item
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].focus();
    }
  }, [selectedIndex]);

  // Group interactions by date
  const groupedInteractions = groupByDate(filteredInteractions);

  return (
    <div className="timeline-view" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="timeline-header">
        <h2 className="timeline-title">Interaction Timeline</h2>

        <div className="timeline-filters">
          {Object.keys(TIME_FILTERS).map(filter => (
            <button
              key={filter}
              className={`timeline-filter-btn ${activeFilter === filter ? 'active' : ''}`}
              onClick={() => setActiveFilter(filter)}
              aria-label={`Filter by ${filter}`}
            >
              {filter}
            </button>
          ))}
        </div>

        {onClose && (
          <button
            className="timeline-filter-btn"
            onClick={onClose}
            aria-label="Close timeline"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Content */}
      <div className="timeline-content">
        {loading && (
          <div className="timeline-loading">
            <p>Loading interactions...</p>
          </div>
        )}

        {error && (
          <div className="timeline-empty">
            <div className="timeline-empty-icon">⚠️</div>
            <p>Error loading timeline: {error}</p>
            <button
              className="timeline-filter-btn"
              onClick={loadInteractions}
              style={{ marginTop: '1rem' }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filteredInteractions.length === 0 && (
          <div className="timeline-empty">
            <div className="timeline-empty-icon">📭</div>
            <p>No interactions in this time range</p>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>
              Start exploring nodes to build your timeline
            </p>
          </div>
        )}

        {!loading && !error && filteredInteractions.length > 0 && (
          <>
            {/* Stats */}
            {stats && (
              <div className="timeline-stats">
                <div className="timeline-stat">
                  <div className="timeline-stat-value">{stats.totalRecords}</div>
                  <div className="timeline-stat-label">Total Interactions</div>
                </div>
                <div className="timeline-stat">
                  <div className="timeline-stat-value">
                    {Object.keys(stats.byActionType).length}
                  </div>
                  <div className="timeline-stat-label">Action Types</div>
                </div>
                <div className="timeline-stat">
                  <div className="timeline-stat-value">{filteredInteractions.length}</div>
                  <div className="timeline-stat-label">Shown</div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="timeline-container">
              <div className="timeline-axis" />

              {Object.entries(groupedInteractions).map(([dateLabel, items]) => (
                <div key={dateLabel} className="timeline-date-group">
                  <h3 className="timeline-date-header">{dateLabel}</h3>

                  <div className="timeline-items">
                    {items.map((interaction) => {
                      const globalIndex = filteredInteractions.indexOf(interaction);
                      return (
                        <TimelineItem
                          key={interaction.id}
                          interaction={interaction}
                          nodeTitle={nodeTitles.get(interaction.nodeId)}
                          onClick={handleItemClick}
                          isSelected={globalIndex === selectedIndex}
                          tabIndex={globalIndex === selectedIndex ? 0 : -1}
                          ref={el => (itemRefs.current[globalIndex] = el)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TimelineView;
