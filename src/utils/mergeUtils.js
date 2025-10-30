/**
 * mergeUtils.js - Utilities for merging and deduplicating federated search results
 */

/**
 * Compute a simple content hash for deduplication
 * @param {string} text - Text content to hash
 * @returns {string} - Hexadecimal hash string
 */
export function computeContentHash(text) {
  if (!text) return '00000000';

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Deduplicate search candidates by content hash
 * Keeps the result with the highest finalScore when duplicates are found
 *
 * @param {Array} candidates - Array of search result objects
 * @returns {Array} - Deduplicated array with duplicateCount and otherProjectIds added
 */
export function dedupeCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  // Group by content hash
  const hashMap = new Map();

  for (const candidate of candidates) {
    const hash = candidate.contentHash || computeContentHash(candidate.text || candidate.title);

    if (!hashMap.has(hash)) {
      hashMap.set(hash, {
        ...candidate,
        contentHash: hash,
        duplicateCount: 1,
        otherProjectIds: []
      });
    } else {
      const existing = hashMap.get(hash);
      existing.duplicateCount++;

      // Track other project IDs
      if (candidate.projectId && !existing.otherProjectIds.includes(candidate.projectId)) {
        existing.otherProjectIds.push(candidate.projectId);
      }

      // Keep the one with higher score
      if (candidate.finalScore > existing.finalScore) {
        // Preserve duplicate tracking
        const { duplicateCount, otherProjectIds } = existing;
        hashMap.set(hash, {
          ...candidate,
          contentHash: hash,
          duplicateCount,
          otherProjectIds: [...otherProjectIds, existing.projectId].filter(Boolean)
        });
      } else {
        // Add current project to otherProjectIds
        if (candidate.projectId && !existing.otherProjectIds.includes(candidate.projectId)) {
          existing.otherProjectIds.push(candidate.projectId);
        }
      }
    }
  }

  return Array.from(hashMap.values());
}

/**
 * Merge and sort results from multiple projects
 *
 * @param {Array<Array>} projectResults - Array of result arrays from different projects
 * @param {Object} options - Merge options
 * @param {number} options.topK - Maximum number of results to return
 * @param {boolean} options.dedupe - Whether to deduplicate by content hash
 * @returns {Array} - Merged and sorted results
 */
export function mergeProjectResults(projectResults, options = {}) {
  const { topK = 50, dedupe = true } = options;

  if (!Array.isArray(projectResults)) {
    return [];
  }

  // Flatten all project results
  let merged = projectResults.flat();

  // Deduplicate if requested
  if (dedupe) {
    merged = dedupeCandidates(merged);
  }

  // Sort by finalScore descending
  merged.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

  // Return top K
  return merged.slice(0, topK);
}

/**
 * Normalize scores across projects using z-score normalization
 *
 * @param {Array} results - Results with similarity scores
 * @param {string} scoreField - Field name containing the score (default: 'sim')
 * @returns {Array} - Results with normalized scores
 */
export function normalizeScores(results, scoreField = 'sim') {
  if (!Array.isArray(results) || results.length === 0) {
    return results;
  }

  // Calculate mean and standard deviation
  const scores = results.map(r => r[scoreField] || 0);
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Avoid division by zero
  if (stdDev === 0) {
    return results.map(r => ({
      ...r,
      normalizedScore: 0.5 // All scores are the same
    }));
  }

  // Apply z-score normalization and convert to 0-1 range
  return results.map(r => {
    const zScore = (r[scoreField] - mean) / stdDev;
    // Convert z-score to 0-1 range using sigmoid function
    const normalizedScore = 1 / (1 + Math.exp(-zScore));

    return {
      ...r,
      normalizedScore
    };
  });
}

/**
 * Apply freshness boost based on node creation/modification time
 *
 * @param {Array} results - Results with timestamps
 * @param {Object} options - Freshness options
 * @param {number} options.maxBoost - Maximum boost multiplier (default: 1.5)
 * @param {number} options.decayHalfLife - Half-life in days (default: 30)
 * @returns {Array} - Results with freshness boost applied
 */
export function applyFreshnessBoost(results, options = {}) {
  const { maxBoost = 1.5, decayHalfLife = 30 } = options;

  if (!Array.isArray(results) || results.length === 0) {
    return results;
  }

  const now = Date.now();
  const halfLifeMs = decayHalfLife * 24 * 60 * 60 * 1000;

  return results.map(result => {
    const timestamp = result.createdAt || result.modifiedAt || result.timestamp;

    if (!timestamp) {
      return {
        ...result,
        freshnessBoost: 1.0
      };
    }

    const age = now - new Date(timestamp).getTime();
    const ageInHalfLives = age / halfLifeMs;

    // Exponential decay: boost = 1 + (maxBoost - 1) * e^(-ln(2) * age/halfLife)
    const freshnessBoost = 1 + (maxBoost - 1) * Math.exp(-Math.LN2 * ageInHalfLives);

    return {
      ...result,
      freshnessBoost
    };
  });
}

/**
 * Generate a namespaced node ID to avoid collisions across projects
 *
 * @param {string} projectId - Project identifier
 * @param {string} nodeId - Node identifier within project
 * @returns {string} - Namespaced ID in format "projectId::nodeId"
 */
export function namespaceNodeId(projectId, nodeId) {
  return `${projectId}::${nodeId}`;
}

/**
 * Parse a namespaced node ID back into project and node parts
 *
 * @param {string} namespacedId - Namespaced ID in format "projectId::nodeId"
 * @returns {Object} - Object with projectId and nodeId properties
 */
export function parseNamespacedId(namespacedId) {
  if (!namespacedId || typeof namespacedId !== 'string') {
    return { projectId: null, nodeId: null };
  }

  const parts = namespacedId.split('::');

  if (parts.length !== 2) {
    return { projectId: null, nodeId: namespacedId };
  }

  return {
    projectId: parts[0],
    nodeId: parts[1]
  };
}

/**
 * Group results by project ID
 *
 * @param {Array} results - Array of search results
 * @returns {Map} - Map of projectId -> array of results
 */
export function groupByProject(results) {
  const grouped = new Map();

  for (const result of results) {
    const projectId = result.projectId || 'unknown';

    if (!grouped.has(projectId)) {
      grouped.set(projectId, []);
    }

    grouped.get(projectId).push(result);
  }

  return grouped;
}
