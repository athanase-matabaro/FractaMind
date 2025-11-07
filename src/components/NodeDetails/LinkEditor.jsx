/**
 * LinkEditor.jsx - Phase 6: Link Creation/Editing Modal
 *
 * Modal form for creating and editing semantic links between nodes.
 * Features:
 * - Source node (readonly or search)
 * - Target node search/dropdown
 * - Relation type selector (from config taxonomy)
 * - Confidence slider (editable)
 * - Note textarea
 * - Accept/Cancel buttons
 * - Validation (no self-links, cycle detection optional)
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { CONTEXTUALIZATION, FEATURE_FLAGS } from '../../config.js';
import { createLink, upsertLink, wouldCreateCycle } from '../../core/linker.js';
import './LinkEditor.css';

/**
 * LinkEditor Component
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback when modal closes
 * @param {Function} props.onLinkCreated - Callback when link is created (link) => {}
 * @param {Object} props.sourceNode - Source node { id, title, ... }
 * @param {Object} props.suggestion - Optional suggestion to pre-fill
 * @param {string} props.projectId - Project ID
 * @param {Array} props.availableNodes - Array of nodes user can link to (optional)
 */
function LinkEditor({
  isOpen,
  onClose,
  onLinkCreated,
  sourceNode,
  suggestion = null,
  projectId,
  availableNodes = [],
}) {
  const [targetNodeId, setTargetNodeId] = useState('');
  const [relationType, setRelationType] = useState('related');
  const [confidence, setConfidence] = useState(0.5);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [cycleWarning, setCycleWarning] = useState(false);

  // Pre-fill from suggestion
  useEffect(() => {
    if (suggestion) {
      setTargetNodeId(suggestion.candidateNodeId || '');
      setRelationType(suggestion.relationType || 'related');
      setConfidence(suggestion.confidence || 0.5);
      setNote(suggestion.rationale || '');
    }
  }, [suggestion]);

  // Check for cycles when target changes
  useEffect(() => {
    if (targetNodeId && sourceNode) {
      checkCycle();
    }
  }, [targetNodeId, sourceNode]);

  async function checkCycle() {
    if (!FEATURE_FLAGS.FEATURE_CONTEXTUAL_LINKS) return;

    try {
      const hasCycle = await wouldCreateCycle(sourceNode.id, targetNodeId, projectId);
      setCycleWarning(hasCycle);
    } catch (err) {
      console.error('[LinkEditor] Error checking cycle:', err);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!targetNodeId) {
      setError('Please select a target node');
      return;
    }

    if (targetNodeId === sourceNode.id) {
      setError('Cannot link a node to itself');
      return;
    }

    if (!relationType) {
      setError('Please select a relation type');
      return;
    }

    if (cycleWarning) {
      const confirmCycle = window.confirm(
        'This link would create a cycle in the graph. Are you sure you want to proceed?'
      );
      if (!confirmCycle) {
        return;
      }
    }

    createLinkAction();
  }

  async function createLinkAction() {
    setIsSubmitting(true);
    setError(null);

    try {
      const linkData = {
        projectId,
        sourceNodeId: sourceNode.id,
        targetNodeId,
        relationType,
        confidence,
        provenance: {
          method: suggestion ? 'auto-suggestion' : 'manual',
          note,
          aiPrompt: suggestion?.rationale || null,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          sourceTitle: sourceNode.title,
          createdViaUI: true,
        },
      };

      const link = suggestion
        ? await upsertLink(linkData, linkData)
        : await createLink(linkData);

      console.log('[LinkEditor] Link created:', link.linkId);

      if (onLinkCreated) {
        onLinkCreated(link);
      }

      // Close modal
      onClose();

      // Reset form
      resetForm();

    } catch (err) {
      console.error('[LinkEditor] Error creating link:', err);
      setError(err.message || 'Failed to create link');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setTargetNodeId('');
    setRelationType('related');
    setConfidence(0.5);
    setNote('');
    setError(null);
    setCycleWarning(false);
  }

  function handleClose() {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="link-editor-backdrop" onClick={handleClose}>
      <div className="link-editor-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="link-editor-close"
          onClick={handleClose}
          disabled={isSubmitting}
          aria-label="Close"
        >
          ×
        </button>

        <h2 className="link-editor-title">
          {suggestion ? 'Accept Link Suggestion' : 'Create Semantic Link'}
        </h2>

        <form className="link-editor-form" onSubmit={handleSubmit}>
          {/* Source Node (readonly) */}
          <div className="link-editor-field">
            <label className="link-editor-label">From:</label>
            <div className="link-editor-readonly">
              {sourceNode.title || sourceNode.id}
            </div>
          </div>

          {/* Target Node (select or readonly if from suggestion) */}
          <div className="link-editor-field">
            <label htmlFor="target-node" className="link-editor-label">
              To: *
            </label>
            {suggestion ? (
              <div className="link-editor-readonly">{suggestion.title}</div>
            ) : (
              <select
                id="target-node"
                className="link-editor-select"
                value={targetNodeId}
                onChange={(e) => setTargetNodeId(e.target.value)}
                disabled={isSubmitting}
                required
              >
                <option value="">Select a node...</option>
                {availableNodes
                  .filter(n => n.id !== sourceNode.id)
                  .map(node => (
                    <option key={node.id} value={node.id}>
                      {node.title || node.id}
                    </option>
                  ))}
              </select>
            )}
            {cycleWarning && (
              <div className="link-editor-warning">
                ⚠️ This link would create a cycle in the graph
              </div>
            )}
          </div>

          {/* Relation Type */}
          <div className="link-editor-field">
            <label htmlFor="relation-type" className="link-editor-label">
              Relation Type: *
            </label>
            <select
              id="relation-type"
              className="link-editor-select"
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              disabled={isSubmitting}
              required
            >
              {CONTEXTUALIZATION.RELATION_TYPES.map(rel => (
                <option key={rel.id} value={rel.id}>
                  {rel.icon} {rel.label} — {rel.description}
                </option>
              ))}
            </select>
          </div>

          {/* Confidence Slider */}
          <div className="link-editor-field">
            <label htmlFor="confidence" className="link-editor-label">
              Confidence: {(confidence * 100).toFixed(0)}%
            </label>
            <input
              id="confidence"
              type="range"
              min="0"
              max="1"
              step="0.05"
              className="link-editor-slider"
              value={confidence}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              disabled={isSubmitting}
            />
          </div>

          {/* Note */}
          <div className="link-editor-field">
            <label htmlFor="note" className="link-editor-label">
              Note:
            </label>
            <textarea
              id="note"
              className="link-editor-textarea"
              rows="3"
              placeholder="Optional note about this link..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="link-editor-error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Actions */}
          <div className="link-editor-actions">
            <button
              type="button"
              className="link-editor-btn link-editor-btn-secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="link-editor-btn link-editor-btn-primary"
              disabled={isSubmitting || !targetNodeId}
            >
              {isSubmitting ? 'Creating...' : 'Create Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

LinkEditor.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onLinkCreated: PropTypes.func,
  sourceNode: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
  }).isRequired,
  suggestion: PropTypes.shape({
    candidateNodeId: PropTypes.string,
    title: PropTypes.string,
    relationType: PropTypes.string,
    confidence: PropTypes.number,
    rationale: PropTypes.string,
  }),
  projectId: PropTypes.string.isRequired,
  availableNodes: PropTypes.arrayOf(PropTypes.object),
};

export default LinkEditor;
