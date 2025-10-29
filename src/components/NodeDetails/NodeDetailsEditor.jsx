/**
 * NodeDetailsEditor.jsx - Node editing and rewriting UI
 *
 * Features:
 * - View node details (title, text, metadata)
 * - Edit mode with textarea
 * - Rewriter modal with tone/length options
 * - Side-by-side comparison (Original | Suggested)
 * - History viewer
 * - Accept/Reject rewrite suggestions
 */

import { useState, useEffect } from 'react';
import { rewriteNode, acceptRewrite, rejectRewrite, getRewriteHistory, getRewriteStats } from '../../core/rewriter.js';
import './NodeDetailsEditor.css';

const NodeDetailsEditor = ({ node, quantParams, onNodeUpdate, onClose }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(node.text);
  const [showRewriter, setShowRewriter] = useState(false);
  const [rewriteOptions, setRewriteOptions] = useState({
    tone: 'concise',
    length: 'medium',
    instruction: '',
  });
  const [rewriteSuggestion, setRewriteSuggestion] = useState(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [progress, setProgress] = useState({ step: '', progress: 0, message: '' });
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [stats, setStats] = useState(null);

  // Load history and stats on mount
  useEffect(() => {
    loadHistoryAndStats();
  }, [node.id]);

  const loadHistoryAndStats = async () => {
    try {
      const [historyData, statsData] = await Promise.all([
        getRewriteHistory(node.id),
        getRewriteStats(node.id),
      ]);
      setHistory(historyData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load history/stats:', err);
    }
  };

  // Handle manual edit save
  const handleSaveEdit = async () => {
    try {
      setProgress({ step: 'saving', progress: 0.5, message: 'Saving changes...' });

      // Use acceptRewrite to handle embedding regeneration
      const updatedNode = await acceptRewrite(node.id, editedText, {
        tone: 'manual-edit',
        length: 'custom',
        quantParams,
        onProgress: setProgress,
      });

      setIsEditing(false);
      setProgress({ step: 'complete', progress: 1.0, message: 'Saved!' });

      // Notify parent
      onNodeUpdate?.(updatedNode);

      // Reload history
      await loadHistoryAndStats();

      // Clear progress after delay
      setTimeout(() => setProgress({ step: '', progress: 0, message: '' }), 2000);
    } catch (err) {
      console.error('Failed to save edit:', err);
      setError(err.message || 'Failed to save changes');
      setProgress({ step: 'error', progress: 0, message: '' });
    }
  };

  const handleCancelEdit = () => {
    setEditedText(node.text);
    setIsEditing(false);
  };

  // Handle rewrite generation
  const handleGenerateRewrite = async () => {
    try {
      setIsRewriting(true);
      setError(null);
      setRewriteSuggestion(null);

      const result = await rewriteNode(node.id, {
        ...rewriteOptions,
        quantParams,
        onProgress: setProgress,
      });

      setRewriteSuggestion(result.suggestion);
    } catch (err) {
      console.error('Rewrite failed:', err);
      setError(err.message || 'Rewrite failed');
    } finally {
      setIsRewriting(false);
    }
  };

  // Handle accept rewrite
  const handleAcceptRewrite = async () => {
    if (!rewriteSuggestion) return;

    try {
      setIsAccepting(true);
      setError(null);

      const updatedNode = await acceptRewrite(node.id, rewriteSuggestion, {
        ...rewriteOptions,
        quantParams,
        onProgress: setProgress,
      });

      setShowRewriter(false);
      setRewriteSuggestion(null);
      setProgress({ step: 'complete', progress: 1.0, message: 'Rewrite applied!' });

      // Notify parent
      onNodeUpdate?.(updatedNode);

      // Reload history
      await loadHistoryAndStats();

      // Clear progress after delay
      setTimeout(() => setProgress({ step: '', progress: 0, message: '' }), 2000);
    } catch (err) {
      console.error('Failed to accept rewrite:', err);
      setError(err.message || 'Failed to apply rewrite');
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle reject rewrite
  const handleRejectRewrite = () => {
    rejectRewrite(node.id, rewriteSuggestion);
    setRewriteSuggestion(null);
    setShowRewriter(false);
  };

  // Calculate word count
  const wordCount = node.text.split(/\s+/).filter(w => w.length > 0).length;
  const suggestionWordCount = rewriteSuggestion
    ? rewriteSuggestion.split(/\s+/).filter(w => w.length > 0).length
    : 0;

  return (
    <div className="node-details-editor">
      <div className="node-details-header">
        <h3 className="node-details-title">{node.title}</h3>
        <button
          className="node-details-close"
          onClick={onClose}
          aria-label="Close node details"
        >
          ×
        </button>
      </div>

      <div className="node-details-content">
        {/* Metadata */}
        <div className="node-details-metadata">
          <div className="metadata-item">
            <span className="metadata-label">Depth:</span>
            <span className="metadata-value">{node.meta?.depth || 0}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Words:</span>
            <span className="metadata-value">{wordCount}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Created:</span>
            <span className="metadata-value">
              {node.meta?.createdAt
                ? new Date(node.meta.createdAt).toLocaleDateString()
                : 'Unknown'}
            </span>
          </div>
          {stats && stats.totalRewrites > 0 && (
            <div className="metadata-item">
              <span className="metadata-label">Rewrites:</span>
              <span className="metadata-value">{stats.totalRewrites}</span>
            </div>
          )}
        </div>

        {/* Text content */}
        {!isEditing && !showRewriter && (
          <div className="node-details-text-view">
            <p className="node-details-text">{node.text}</p>

            <div className="node-details-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setIsEditing(true)}
                aria-label="Edit node text"
              >
                Edit
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowRewriter(true)}
                aria-label="Open rewriter"
              >
                Rewriter
              </button>
              {history.length > 0 && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowHistory(!showHistory)}
                  aria-label="Toggle history"
                >
                  History ({history.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Edit mode */}
        {isEditing && (
          <div className="node-details-edit-mode">
            <textarea
              className="node-details-textarea"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={10}
              autoFocus
              aria-label="Edit node text"
            />

            <div className="node-details-actions">
              <button
                className="btn btn-secondary"
                onClick={handleCancelEdit}
                disabled={progress.step === 'saving'}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveEdit}
                disabled={progress.step === 'saving' || editedText === node.text}
              >
                {progress.step === 'saving' ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Rewriter modal */}
        {showRewriter && (
          <div className="node-details-rewriter">
            <h4 className="rewriter-heading">Rewrite with AI</h4>

            {!rewriteSuggestion && (
              <div className="rewriter-options">
                <div className="rewriter-option">
                  <label htmlFor="rewrite-tone">Tone:</label>
                  <select
                    id="rewrite-tone"
                    value={rewriteOptions.tone}
                    onChange={(e) =>
                      setRewriteOptions({ ...rewriteOptions, tone: e.target.value })
                    }
                  >
                    <option value="concise">Concise</option>
                    <option value="technical">Technical</option>
                    <option value="creative">Creative</option>
                    <option value="formal">Formal</option>
                    <option value="casual">Casual</option>
                  </select>
                </div>

                <div className="rewriter-option">
                  <label htmlFor="rewrite-length">Length:</label>
                  <select
                    id="rewrite-length"
                    value={rewriteOptions.length}
                    onChange={(e) =>
                      setRewriteOptions({ ...rewriteOptions, length: e.target.value })
                    }
                  >
                    <option value="short">Short (~60% of original)</option>
                    <option value="medium">Medium (similar length)</option>
                    <option value="long">Long (~140% of original)</option>
                  </select>
                </div>

                <div className="rewriter-option">
                  <label htmlFor="rewrite-instruction">
                    Custom Instruction (optional):
                  </label>
                  <textarea
                    id="rewrite-instruction"
                    value={rewriteOptions.instruction}
                    onChange={(e) =>
                      setRewriteOptions({ ...rewriteOptions, instruction: e.target.value })
                    }
                    rows={3}
                    placeholder="e.g., Focus on technical accuracy, or Add more examples..."
                  />
                </div>

                <div className="rewriter-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowRewriter(false)}
                    disabled={isRewriting}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerateRewrite}
                    disabled={isRewriting}
                  >
                    {isRewriting ? 'Generating...' : 'Generate Suggestion'}
                  </button>
                </div>
              </div>
            )}

            {/* Side-by-side comparison */}
            {rewriteSuggestion && (
              <div className="rewriter-comparison">
                <div className="comparison-column">
                  <h5>Original ({wordCount} words)</h5>
                  <div className="comparison-text">{node.text}</div>
                </div>

                <div className="comparison-divider" />

                <div className="comparison-column">
                  <h5>Suggested ({suggestionWordCount} words)</h5>
                  <div className="comparison-text">{rewriteSuggestion}</div>
                </div>

                <div className="rewriter-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={handleRejectRewrite}
                    disabled={isAccepting}
                  >
                    Reject
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleAcceptRewrite}
                    disabled={isAccepting}
                  >
                    {isAccepting ? 'Accepting...' : 'Accept'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History viewer */}
        {showHistory && history.length > 0 && (
          <div className="node-details-history">
            <h4 className="history-heading">Version History</h4>
            <div className="history-list">
              {history.map((entry, index) => (
                <div key={index} className="history-entry">
                  <div className="history-entry-header">
                    <span className="history-entry-date">
                      {new Date(entry.at).toLocaleString()}
                    </span>
                    <span className="history-entry-type">{entry.type}</span>
                  </div>
                  <p className="history-entry-text">
                    {entry.text.slice(0, 200)}
                    {entry.text.length > 200 && '...'}
                  </p>
                  {entry.meta && (
                    <div className="history-entry-meta">
                      {entry.meta.tone && <span>Tone: {entry.meta.tone}</span>}
                      {entry.meta.length && <span>Length: {entry.meta.length}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress indicator */}
        {progress.message && (
          <div className="node-details-progress">
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${progress.progress * 100}%` }}
              />
            </div>
            <p className="progress-message">{progress.message}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="node-details-error" role="alert">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeDetailsEditor;
