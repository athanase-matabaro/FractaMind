/**
 * rewriter.js - Node rewriting and history management
 *
 * Handles rewriting node text with Writer API and maintaining version history
 * Features:
 * - Rewrite with tone/length options
 * - Version history (FIFO, max 10 entries)
 * - Content deduplication (SHA-256)
 * - Automatic embedding regeneration
 * - Morton key recomputation
 */

import { rewriteText, generateEmbedding } from '../ai/chromeAI.js';
import {
  getNode,
  saveNode,
  computeMortonKeyFromEmbedding,
} from '../db/fractamind-indexer.js';

/**
 * Compute SHA-256 hash of content for deduplication
 * @param {string} content - Content to hash
 * @returns {Promise<string>} - Hex string hash
 */
async function hashContent(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Add entry to node history (FIFO, max 10 entries)
 * @param {Object} node - Node object
 * @param {Object} entry - History entry
 * @returns {Array} - Updated history array
 */
function addToHistory(node, entry) {
  const history = node.history || [];
  const newHistory = [...history, entry];

  // Keep only last 10 entries (FIFO)
  if (newHistory.length > 10) {
    return newHistory.slice(-10);
  }

  return newHistory;
}

/**
 * Rewrite node text with specified options
 *
 * @param {string} nodeId - Node ID to rewrite
 * @param {Object} options - Rewrite options
 * @param {string} options.tone - Tone: 'concise' | 'technical' | 'creative' | 'formal' | 'casual'
 * @param {string} options.length - Length: 'short' | 'medium' | 'long'
 * @param {string} options.instruction - Optional custom instruction
 * @param {boolean} options.autoAccept - Auto-accept suggestion without confirmation (default: false)
 * @param {Object} options.quantParams - Quantization params for Morton key (optional)
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{original: string, suggestion: string, node: Object}>} - Original and suggested text
 */
export async function rewriteNode(nodeId, options = {}) {
  const {
    tone = 'concise',
    length = 'medium',
    instruction = '',
    autoAccept = false,
    quantParams = null,
    onProgress = null,
  } = options;

  onProgress?.({ step: 'loading', progress: 0.1, message: 'Loading node...' });

  // Load node
  const node = await getNode(nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }

  const originalText = node.text;

  onProgress?.({ step: 'rewriting', progress: 0.3, message: 'Generating rewrite suggestion...' });

  // Generate rewrite suggestion
  const suggestion = await rewriteText(originalText, {
    tone,
    length,
    instruction,
  });

  onProgress?.({ step: 'complete', progress: 1.0, message: 'Rewrite suggestion ready' });

  // Return suggestion for user confirmation (unless autoAccept)
  if (!autoAccept) {
    return {
      original: originalText,
      suggestion,
      node,
    };
  }

  // Auto-accept: apply the rewrite immediately
  return await acceptRewrite(nodeId, suggestion, {
    tone,
    length,
    quantParams,
    onProgress,
  });
}

/**
 * Accept a rewrite suggestion and update node
 *
 * @param {string} nodeId - Node ID
 * @param {string} newText - New text to apply
 * @param {Object} options - Options
 * @param {string} options.tone - Tone used for rewrite
 * @param {string} options.length - Length used for rewrite
 * @param {Object} options.quantParams - Quantization params
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} - Updated node
 */
export async function acceptRewrite(nodeId, newText, options = {}) {
  const { tone, length, quantParams = null, onProgress = null } = options;

  onProgress?.({ step: 'loading', progress: 0.1, message: 'Loading node...' });

  // Load node
  const node = await getNode(nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }

  const originalText = node.text;

  // Check if content is identical (dedupe)
  const originalHash = await hashContent(originalText);
  const newHash = await hashContent(newText);

  if (originalHash === newHash) {
    console.log('Content unchanged after rewrite, skipping history entry');
    return node; // No change needed
  }

  onProgress?.({ step: 'history', progress: 0.3, message: 'Saving version history...' });

  // Add to history
  const historyEntry = {
    at: new Date().toISOString(),
    text: originalText,
    type: 'rewrite-original',
    meta: { tone, length },
  };

  const updatedHistory = addToHistory(node, historyEntry);

  onProgress?.({ step: 'embedding', progress: 0.5, message: 'Regenerating embedding...' });

  // Regenerate embedding for new text
  const combinedText = `${node.title}. ${newText}`;
  const newEmbedding = await generateEmbedding(combinedText);

  onProgress?.({ step: 'indexing', progress: 0.7, message: 'Recomputing search index...' });

  // Recompute Morton key
  let newMortonKey = node.hilbertKeyHex; // Keep existing if no quantParams

  if (quantParams) {
    const embeddingArray = Array.isArray(newEmbedding)
      ? newEmbedding
      : Array.from(newEmbedding);

    newMortonKey = computeMortonKeyFromEmbedding(embeddingArray, quantParams);
  }

  // Update node
  const updatedNode = {
    ...node,
    text: newText,
    embedding: Array.from(newEmbedding),
    hilbertKeyHex: newMortonKey,
    history: updatedHistory,
    meta: {
      ...node.meta,
      updatedAt: new Date().toISOString(),
      lastRewrite: new Date().toISOString(),
    },
  };

  onProgress?.({ step: 'saving', progress: 0.9, message: 'Saving node...' });

  // Save to IndexedDB
  await saveNode(updatedNode);

  onProgress?.({ step: 'complete', progress: 1.0, message: 'Rewrite applied successfully' });

  console.log(`Node ${nodeId} rewritten and saved`);

  return updatedNode;
}

/**
 * Reject a rewrite suggestion (no action taken)
 *
 * @param {string} nodeId - Node ID
 * @param {string} _suggestion - Rejected suggestion (reserved for future analytics)
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
export async function rejectRewrite(nodeId, _suggestion) {
  console.log(`Rewrite suggestion rejected for node ${nodeId}`);
  // Could optionally log rejection for analytics
  // For now, just a no-op
}

/**
 * Get rewrite history for a node
 *
 * @param {string} nodeId - Node ID
 * @returns {Promise<Array>} - History entries
 */
export async function getRewriteHistory(nodeId) {
  const node = await getNode(nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }

  return node.history || [];
}

/**
 * Restore node to a previous version from history
 *
 * @param {string} nodeId - Node ID
 * @param {number} historyIndex - Index in history array to restore
 * @param {Object} options - Options
 * @param {Object} options.quantParams - Quantization params
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} - Restored node
 */
export async function restoreFromHistory(nodeId, historyIndex, options = {}) {
  const { quantParams = null, onProgress = null } = options;

  onProgress?.({ step: 'loading', progress: 0.1, message: 'Loading node history...' });

  const node = await getNode(nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }

  const history = node.history || [];
  if (historyIndex < 0 || historyIndex >= history.length) {
    throw new Error(`Invalid history index: ${historyIndex}`);
  }

  const historyEntry = history[historyIndex];
  const restoredText = historyEntry.text;

  onProgress?.({ step: 'restoring', progress: 0.3, message: 'Restoring previous version...' });

  // Use acceptRewrite to apply the historical text
  // This will regenerate embeddings, update Morton key, and add to history
  return await acceptRewrite(nodeId, restoredText, {
    tone: 'original',
    length: 'original',
    quantParams,
    onProgress,
  });
}

/**
 * Batch rewrite multiple nodes
 *
 * @param {Array<string>} nodeIds - Array of node IDs
 * @param {Object} options - Rewrite options (same as rewriteNode)
 * @returns {Promise<Map>} - Map of nodeId → { original, suggestion, node }
 */
export async function batchRewriteNodes(nodeIds, options = {}) {
  const results = new Map();

  for (const nodeId of nodeIds) {
    try {
      const result = await rewriteNode(nodeId, options);
      results.set(nodeId, result);
    } catch (error) {
      console.error(`Failed to rewrite node ${nodeId}:`, error);
      results.set(nodeId, { error: error.message });
    }
  }

  return results;
}

/**
 * Get rewrite statistics for a node
 *
 * @param {string} nodeId - Node ID
 * @returns {Promise<Object>} - Statistics
 */
export async function getRewriteStats(nodeId) {
  const node = await getNode(nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }

  const history = node.history || [];
  const rewriteEntries = history.filter((e) => e.type === 'rewrite-original');

  return {
    totalRewrites: rewriteEntries.length,
    lastRewrite: node.meta?.lastRewrite || null,
    historySize: history.length,
    originalCreatedAt: node.meta?.createdAt || null,
    currentWordCount: node.text.split(/\s+/).length,
    hasHistory: history.length > 0,
  };
}
