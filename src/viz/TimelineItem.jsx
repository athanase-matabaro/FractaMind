/**
 * TimelineItem - Individual interaction item in timeline
 */

import React from 'react';

// Action type icons
const ACTION_ICONS = {
  view: '👁️',
  search: '🔍',
  expand: '🌿',
  rewrite: '✏️',
  edit: '📝',
  export: '📤',
  import: '📥',
};

// Format time difference
function formatTimeAgo(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return 'just now';
  }
}

const TimelineItem = ({
  interaction,
  nodeTitle,
  onClick,
  onKeyDown,
  isSelected = false,
  tabIndex = -1,
}) => {
  const { actionType, at, meta = {} } = interaction;
  const icon = ACTION_ICONS[actionType] || '•';

  const handleClick = () => {
    onClick?.(interaction);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(interaction);
    }
    onKeyDown?.(e, interaction);
  };

  return (
    <div
      className={`timeline-item ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={tabIndex}
      role="button"
      aria-label={`${actionType} action on ${nodeTitle || 'unknown node'} at ${formatTimeAgo(at)}`}
    >
      <div className={`timeline-item-dot action-${actionType}`} />

      <div className="timeline-item-icon">{icon}</div>

      <div className="timeline-item-content">
        <div className="timeline-item-header">
          <span className="timeline-item-action">{actionType}</span>
          <span className="timeline-item-time">{formatTimeAgo(at)}</span>
        </div>

        {nodeTitle && <div className="timeline-item-title">{nodeTitle}</div>}

        {/* Meta information */}
        {Object.keys(meta).length > 0 && (
          <div className="timeline-item-meta">
            {meta.queryText && (
              <span className="timeline-item-meta-badge">Query: {meta.queryText.slice(0, 30)}{meta.queryText.length > 30 ? '...' : ''}</span>
            )}
            {meta.rewriteOptions && (
              <span className="timeline-item-meta-badge">
                {meta.rewriteOptions.tone || 'default'} tone
              </span>
            )}
            {meta.source && (
              <span className="timeline-item-meta-badge">Source: {meta.source}</span>
            )}
            {meta.childrenCreated && (
              <span className="timeline-item-meta-badge">+{meta.childrenCreated} children</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineItem;
