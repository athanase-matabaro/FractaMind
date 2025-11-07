/**
 * contextualizer.js - Phase 6: Contextual Link Suggestion Engine
 *
 * Generates semantic link suggestions for nodes using:
 * 1. Morton-range prefilter to find spatially near nodes
 * 2. Cosine similarity re-ranking
 * 3. Context manager bias (recency, user actions)
 * 4. AI relation extraction (in live mode) or deterministic labels (mock mode)
 *
 * Key functions:
 * - suggestLinks: Generate top-K link suggestions for a node
 * - scorePair: Score similarity between two nodes
 * - batchSuggest: Generate suggestions for multiple nodes
 */

import { getNode, rangeScanByMortonHex } from '../db/fractamind-indexer.js';
import { scorePair, generateSnippet } from './searcher.js';
import { computeLinkConfidence, computeLexicalSimilarity } from './linker.js';
import { CONTEXTUALIZATION } from '../config.js';

// Simple deterministic hash for mock mode relation assignment
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Compute contextual bias score based on recency and user actions
 * Uses exponential decay based on CONTEXT_HALF_LIFE_HOURS
 *
 * @param {string} sourceNodeId - Source node ID
 * @param {string} candidateNodeId - Candidate node ID
 * @param {Object} contextHistory - Optional context history { recentNodes: [], userActions: {} }
 * @returns {number} Bias score [0, 1]
 */
function computeContextualBias(sourceNodeId, candidateNodeId, contextHistory = null) {
  if (!contextHistory) return 0;

  const { recentNodes = [], userActions = {} } = contextHistory;

  let biasScore = 0;

  // Recency bias: nodes accessed recently get higher score
  const candidateIndex = recentNodes.indexOf(candidateNodeId);
  if (candidateIndex >= 0) {
    // Exponential decay based on position in recent list
    const halfLife = CONTEXTUALIZATION.CONTEXT_HALF_LIFE_HOURS;
    const hoursAgo = candidateIndex; // Simplified: use index as proxy for hours
    const decayFactor = Math.pow(0.5, hoursAgo / halfLife);
    biasScore += 0.5 * decayFactor; // Weight = 0.5 for recency
  }

  // User action bias: nodes with similar actions to source
  const sourceActions = userActions[sourceNodeId] || {};
  const candidateActions = userActions[candidateNodeId] || {};

  const actionTypes = ['viewed', 'edited', 'linked'];
  let actionOverlap = 0;
  for (const actionType of actionTypes) {
    if (sourceActions[actionType] && candidateActions[actionType]) {
      actionOverlap += 1;
    }
  }

  if (actionOverlap > 0) {
    biasScore += 0.3 * (actionOverlap / actionTypes.length); // Weight = 0.3 for action similarity
  }

  return Math.min(1, biasScore); // Clamp to [0, 1]
}

/**
 * Generate relation type and rationale using AI or deterministic mock
 *
 * @param {Object} sourceNode - Source node { id, title, text, ... }
 * @param {Object} candidateNode - Candidate node
 * @param {number} similarity - Cosine similarity score
 * @param {string} mode - 'live' or 'mock'
 * @returns {Promise<{relationType: string, rationale: string, aiConfidence: number}>}
 */
async function generateRelationLabel(sourceNode, candidateNode, similarity, mode = 'mock') {
  if (mode === 'mock') {
    // Deterministic mock mode for testing
    const hash = hashString(sourceNode.id + candidateNode.id);
    const relationTypes = CONTEXTUALIZATION.RELATION_TYPES;
    const relationIndex = hash % relationTypes.length;
    const relation = relationTypes[relationIndex];

    // Generate deterministic rationale
    const rationale = `${relation.label}: ${relation.description}`;

    // AI confidence is based on similarity in mock mode
    const aiConfidence = similarity;

    return {
      relationType: relation.id,
      rationale,
      aiConfidence,
    };
  } else {
    // Live mode: Use AI to generate relation label
    // TODO: Implement AI relation extraction using Writer API
    // For now, fall back to mock mode
    console.warn('[CONTEXT] Live AI relation extraction not yet implemented, using mock mode');
    return await generateRelationLabel(sourceNode, candidateNode, similarity, 'mock');
  }
}

/**
 * Suggest semantic links for a node
 *
 * Algorithm:
 * 1. Morton-range scan to get ~topK*3 nearest neighbors (prefilter)
 * 2. Compute cosine similarity for each candidate
 * 3. Apply contextual bias if provided
 * 4. Filter by threshold
 * 5. Generate relation labels for top candidates
 * 6. Compute final confidence scores
 * 7. Return sorted suggestions
 *
 * @param {string} nodeId - Node ID to generate suggestions for
 * @param {Object} options - { topK, includeContextBias, contextHistory, mode, projectId, radiusPower }
 * @returns {Promise<Array>} Array of suggestions sorted by score
 */
export async function suggestLinks(nodeId, options = {}) {
  const {
    topK = CONTEXTUALIZATION.SUGGEST_TOP_K,
    includeContextBias = true,
    contextHistory = null,
    mode = 'mock', // 'live' or 'mock'
    projectId = null,
    radiusPower = 12,
  } = options;

  const traceId = Math.random().toString(36).substring(2, 9);
  console.log(`[CONTEXT:${traceId}] Generating suggestions for node ${nodeId} (topK=${topK}, mode=${mode})`);

  try {
    // Step 1: Fetch source node
    const sourceNode = await getNode(nodeId);
    if (!sourceNode) {
      throw new Error(`Source node ${nodeId} not found`);
    }

    if (!sourceNode.hilbertKeyHex) {
      throw new Error(`Source node ${nodeId} has no Morton key`);
    }

    // Step 2: Morton-range prefilter
    const radiusHex = Math.pow(2, radiusPower).toString(16).padStart(16, '0');
    const prefilteredIds = await rangeScanByMortonHex(
      sourceNode.hilbertKeyHex,
      radiusHex,
      { limit: topK * 3 }
    );

    console.log(`[CONTEXT:${traceId}] Prefiltered ${prefilteredIds.length} candidates`);

    if (prefilteredIds.length === 0) {
      return [];
    }

    // Step 3: Score each candidate
    const candidates = [];
    for (const candidateId of prefilteredIds) {
      // Skip self
      if (candidateId === nodeId) continue;

      // Fetch candidate node
      const candidateNode = await getNode(candidateId);
      if (!candidateNode) continue;

      // Filter by project if specified
      if (projectId && candidateNode.meta?.projectId !== projectId) {
        continue;
      }

      // Compute semantic similarity
      const semantic = await scorePair(nodeId, candidateId);

      // Compute lexical similarity
      const lexical = computeLexicalSimilarity(sourceNode.text || '', candidateNode.text || '');

      // Compute contextual bias
      const contextual = includeContextBias
        ? computeContextualBias(nodeId, candidateId, contextHistory)
        : 0;

      // Combined score (before AI confidence)
      const preliminaryScore = semantic * 0.6 + lexical * 0.2 + contextual * 0.2;

      candidates.push({
        candidateNodeId: candidateId,
        candidateNode,
        semantic,
        lexical,
        contextual,
        preliminaryScore,
      });
    }

    // Step 4: Filter by similarity threshold
    const threshold = CONTEXTUALIZATION.LINK_SIM_THRESHOLD;
    const filteredCandidates = candidates.filter(c => c.semantic >= threshold || c.preliminaryScore >= threshold);

    console.log(`[CONTEXT:${traceId}] ${filteredCandidates.length} candidates after threshold filter`);

    // Step 5: Sort by preliminary score and take top topK*2 for AI labeling
    filteredCandidates.sort((a, b) => b.preliminaryScore - a.preliminaryScore);
    const topCandidates = filteredCandidates.slice(0, topK * 2);

    // Step 6: Generate relation labels (batched if in live mode)
    const suggestions = [];
    for (const candidate of topCandidates) {
      const { relationType, rationale, aiConfidence } = await generateRelationLabel(
        sourceNode,
        candidate.candidateNode,
        candidate.semantic,
        mode
      );

      // Compute final confidence score
      const confidence = computeLinkConfidence({
        semantic: candidate.semantic,
        ai: aiConfidence,
        lexical: candidate.lexical,
        contextual: candidate.contextual,
      });

      suggestions.push({
        candidateNodeId: candidate.candidateNodeId,
        title: candidate.candidateNode.title || 'Untitled',
        snippet: generateSnippet(candidate.candidateNode.text),
        relationType,
        rationale,
        confidence,
        score: confidence, // Final score is the confidence
        similarity: candidate.semantic,
        lexicalSimilarity: candidate.lexical,
        contextualBias: candidate.contextual,
        mode,
        timestamp: new Date().toISOString(),
      });
    }

    // Step 7: Sort by final score and return topK
    suggestions.sort((a, b) => b.score - a.score);
    const topSuggestions = suggestions.slice(0, topK);

    console.log(`[CONTEXT:${traceId}] Returning ${topSuggestions.length} suggestions`);

    return topSuggestions;

  } catch (error) {
    console.error(`[CONTEXT:${traceId}] Error generating suggestions:`, error);
    return [];
  }
}

/**
 * Batch generate suggestions for multiple nodes
 * Useful for background processing and backfilling
 *
 * @param {string} projectId - Project ID
 * @param {Object} options - { topK, mode, limit, progressCallback }
 * @returns {Promise<Map>} Map of nodeId → suggestions array
 */
export async function batchSuggest(projectId, options = {}) {
  const {
    topK = CONTEXTUALIZATION.SUGGEST_TOP_K,
    mode = 'mock',
    limit = CONTEXTUALIZATION.LINK_MAX_BATCH,
    progressCallback = null,
  } = options;

  console.log(`[CONTEXT] Batch suggesting for project ${projectId} (limit=${limit})`);

  // TODO: Implement getAllNodes with projectId filter
  // For now, return empty map
  console.warn('[CONTEXT] batchSuggest requires getAllNodes implementation');

  const results = new Map();

  // Placeholder: would iterate over project nodes here
  if (progressCallback) {
    progressCallback({ processed: 0, total: 0, message: 'Not yet implemented' });
  }

  return results;
}

/**
 * Get context history for a user session
 * Placeholder for future context manager integration
 *
 * @param {string} userId - User ID or session ID
 * @returns {Object} Context history { recentNodes: [], userActions: {} }
 */
export function getContextHistory(userId) {
  // TODO: Implement context manager to track user actions
  // For now, return empty context
  console.warn(`[CONTEXT] Context history not yet implemented for user ${userId}`);
  return {
    recentNodes: [],
    userActions: {},
  };
}

/**
 * Export for testing and external use
 */
export default {
  suggestLinks,
  batchSuggest,
  getContextHistory,
};
