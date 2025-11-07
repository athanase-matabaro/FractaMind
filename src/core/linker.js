/**
 * linker.js - Phase 6: Semantic Link Management
 *
 * Handles creation, update, querying, and confidence scoring for semantic links between nodes.
 * Links represent relationships like "clarifies", "contradicts", "elaborates", etc.
 *
 * Key functions:
 * - createLink: Create a new semantic link
 * - upsertLink: Update existing or create new link
 * - queryLinks: Query links with filters
 * - removeLink: Delete a link
 * - computeLinkConfidence: Calculate multi-signal confidence score
 */

import { saveLink, getLink, queryLinks as dbQueryLinks, deleteLink } from '../db/fractamind-indexer.js';
import { CONTEXTUALIZATION } from '../config.js';

// Generate namespaced GUID for linkId
function generateLinkId(projectId, sourceNodeId, targetNodeId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `link_${projectId}_${sourceNodeId}_${targetNodeId}_${timestamp}_${random}`;
}

/**
 * Validate link object has required fields
 * @param {Object} link
 * @throws {Error} if validation fails
 */
function validateLink(link) {
  if (!link.sourceNodeId) throw new Error('[LINKER] sourceNodeId is required');
  if (!link.targetNodeId) throw new Error('[LINKER] targetNodeId is required');
  if (link.sourceNodeId === link.targetNodeId) {
    throw new Error('[LINKER] Cannot link node to itself');
  }
  if (!link.relationType) throw new Error('[LINKER] relationType is required');
  if (!link.projectId) throw new Error('[LINKER] projectId is required');

  // Validate relationType is in taxonomy
  const validTypes = CONTEXTUALIZATION.RELATION_TYPES.map(t => t.id);
  if (!validTypes.includes(link.relationType)) {
    console.warn(`[LINKER] Unknown relationType: ${link.relationType}. Allowed:`, validTypes);
  }

  // Validate confidence range
  if (link.confidence !== undefined) {
    if (typeof link.confidence !== 'number' || link.confidence < 0 || link.confidence > 1) {
      throw new Error('[LINKER] confidence must be a number between 0 and 1');
    }
  }
}

/**
 * Create a new semantic link
 * @param {Object} linkData - { sourceNodeId, targetNodeId, relationType, projectId, confidence?, provenance?, weight?, metadata? }
 * @param {Object} options - { skipValidation: boolean }
 * @returns {Promise<Object>} Created link
 */
export async function createLink(linkData, options = {}) {
  const { skipValidation = false } = options;

  if (!skipValidation) {
    validateLink(linkData);
  }

  const now = new Date().toISOString();
  const linkId = linkData.linkId || generateLinkId(
    linkData.projectId,
    linkData.sourceNodeId,
    linkData.targetNodeId
  );

  const link = {
    linkId,
    projectId: linkData.projectId,
    sourceNodeId: linkData.sourceNodeId,
    targetNodeId: linkData.targetNodeId,
    relationType: linkData.relationType,
    confidence: linkData.confidence || 0.5,
    provenance: linkData.provenance || { method: 'manual', timestamp: now },
    weight: linkData.weight || 1.0,
    active: linkData.active !== undefined ? linkData.active : true,
    metadata: linkData.metadata || {},
    createdAt: now,
    updatedAt: now,
    history: [{
      timestamp: now,
      action: 'created',
      note: linkData.provenance?.note || 'Link created',
    }],
  };

  const confidenceStr = link.confidence.toFixed(2);
  console.log(`[LINKER] Creating link ${linkId}: ${link.sourceNodeId} --[${link.relationType}]--> ${link.targetNodeId} (confidence: ${confidenceStr})`);

  return await saveLink(link);
}

/**
 * Update existing link or create if doesn't exist (upsert)
 * @param {Object} linkData - Link data with linkId or source/target pair
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated link
 */
export async function upsertLink(linkData, updates = {}) {
  let existingLink = null;

  // Try to find existing link
  if (linkData.linkId) {
    existingLink = await getLink(linkData.linkId);
  } else if (linkData.sourceNodeId && linkData.targetNodeId && linkData.relationType) {
    // Query for existing link with same source/target/type
    const matches = await dbQueryLinks({
      sourceNodeId: linkData.sourceNodeId,
      targetNodeId: linkData.targetNodeId,
      relationType: linkData.relationType,
      limit: 1,
    });
    if (matches.length > 0) {
      existingLink = matches[0];
    }
  }

  if (existingLink) {
    // Update existing
    const now = new Date().toISOString();
    const updatedLink = {
      ...existingLink,
      ...updates,
      updatedAt: now,
      history: [
        ...existingLink.history,
        {
          timestamp: now,
          action: 'updated',
          note: updates.note || 'Link updated',
          changes: Object.keys(updates),
        },
      ],
    };

    console.log(`[LINKER] Updating link ${existingLink.linkId}`);
    return await saveLink(updatedLink);
  } else {
    // Create new
    return await createLink({ ...linkData, ...updates });
  }
}

/**
 * Query links with filters
 * Thin wrapper over dbQueryLinks with logging
 * @param {Object} filters - { sourceNodeId?, targetNodeId?, projectId?, relationType?, active?, limit?, sortBy? }
 * @returns {Promise<Array>} Matching links
 */
export async function queryLinksFiltered(filters = {}) {
  const traceId = Math.random().toString(36).substring(2, 9);
  console.log(`[LINKER:${traceId}] Query links with filters:`, filters);

  const results = await dbQueryLinks(filters);

  console.log(`[LINKER:${traceId}] Found ${results.length} links`);
  return results;
}

/**
 * Remove/delete a link
 * @param {string} linkId
 * @returns {Promise<boolean>} Success
 */
export async function removeLink(linkId) {
  console.log(`[LINKER] Removing link ${linkId}`);
  return await deleteLink(linkId);
}

/**
 * Compute link confidence score from multiple signals
 * Formula: confidence = clamp(w_sim*sim + w_ai*aiConf + w_lex*lexScore + w_bias*bias, 0, 1)
 *
 * @param {Object} signals - { semantic: cosine_sim, ai: ai_confidence, lexical: n-gram_overlap, contextual: bias_score }
 * @param {Object} weights - Optional custom weights (defaults from config)
 * @returns {number} Confidence score [0, 1]
 */
export function computeLinkConfidence(signals = {}, weights = null) {
  const w = weights || CONTEXTUALIZATION.CONFIDENCE_WEIGHTS;

  const semantic = signals.semantic || 0;
  const ai = signals.ai || 0;
  const lexical = signals.lexical || 0;
  const contextual = signals.contextual || 0;

  const confidence =
    w.semantic * semantic +
    w.ai * ai +
    w.lexical * lexical +
    w.contextual * contextual;

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Compute lexical similarity using n-gram overlap (Jaccard similarity on character 3-grams)
 * @param {string} text1
 * @param {string} text2
 * @returns {number} Similarity score [0, 1]
 */
export function computeLexicalSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  const n = 3; // tri-grams
  const getNGrams = (text) => {
    const ngrams = new Set();
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i <= normalized.length - n; i++) {
      ngrams.add(normalized.substring(i, i + n));
    }
    return ngrams;
  };

  const set1 = getNGrams(text1);
  const set2 = getNGrams(text2);

  // Jaccard similarity
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Get all links for a specific node (both as source and target)
 * @param {string} nodeId
 * @param {Object} options - { projectId?, active?, limit? }
 * @returns {Promise<{outgoing: Array, incoming: Array}>} Links organized by direction
 */
export async function getNodeLinks(nodeId, options = {}) {
  const { projectId, active, limit = 100 } = options;

  const [outgoing, incoming] = await Promise.all([
    dbQueryLinks({ sourceNodeId: nodeId, projectId, active, limit, sortBy: 'confidence' }),
    dbQueryLinks({ targetNodeId: nodeId, projectId, active, limit, sortBy: 'confidence' }),
  ]);

  return { outgoing, incoming };
}

/**
 * Check if a link would create a cycle (optional validation)
 * Simple BFS to detect if adding link creates cycle
 * @param {string} sourceNodeId
 * @param {string} targetNodeId
 * @param {string} projectId
 * @returns {Promise<boolean>} True if cycle would be created
 */
export async function wouldCreateCycle(sourceNodeId, targetNodeId, projectId) {
  // BFS from targetNodeId to see if we can reach sourceNodeId
  const visited = new Set();
  const queue = [targetNodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    if (current === sourceNodeId) {
      return true; // Cycle detected
    }

    // Get outgoing links from current node
    const links = await dbQueryLinks({
      sourceNodeId: current,
      projectId,
      active: true,
      limit: 50,
    });

    for (const link of links) {
      if (!visited.has(link.targetNodeId)) {
        queue.push(link.targetNodeId);
      }
    }
  }

  return false;
}

/**
 * Batch update link confidences
 * Useful for background recomputation
 * @param {Array<{linkId: string, confidence: number}>} updates
 * @returns {Promise<number>} Number of links updated
 */
export async function batchUpdateConfidences(updates) {
  console.log(`[LINKER] Batch updating ${updates.length} link confidences`);
  let count = 0;

  for (const { linkId, confidence } of updates) {
    try {
      const link = await getLink(linkId);
      if (link) {
        await upsertLink({ linkId }, {
          confidence,
          note: 'Confidence recomputed',
        });
        count++;
      }
    } catch (err) {
      console.error(`[LINKER] Failed to update link ${linkId}:`, err);
    }
  }

  console.log(`[LINKER] Successfully updated ${count}/${updates.length} links`);
  return count;
}

/**
 * Get link statistics for a project
 * @param {string} projectId
 * @returns {Promise<Object>} Statistics { totalLinks, byRelationType, avgConfidence }
 */
export async function getLinkStatistics(projectId) {
  const allLinks = await dbQueryLinks({ projectId, active: true, limit: 10000 });

  const byRelationType = {};
  let totalConfidence = 0;

  for (const link of allLinks) {
    byRelationType[link.relationType] = (byRelationType[link.relationType] || 0) + 1;
    totalConfidence += link.confidence || 0;
  }

  return {
    totalLinks: allLinks.length,
    byRelationType,
    avgConfidence: allLinks.length > 0 ? totalConfidence / allLinks.length : 0,
  };
}

// Export for testing and external use
export default {
  createLink,
  upsertLink,
  queryLinksFiltered,
  removeLink,
  computeLinkConfidence,
  computeLexicalSimilarity,
  getNodeLinks,
  wouldCreateCycle,
  batchUpdateConfidences,
  getLinkStatistics,
};
