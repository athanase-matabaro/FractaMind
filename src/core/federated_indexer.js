/**
 * federated_indexer.js
 *
 * Phase 7: Federated cross-project embedding cache and search infrastructure
 *
 * Provides:
 * - Multi-project embedding caching with Morton key indexing
 * - Cross-project similarity search with project-aware filtering
 * - Global sharded Morton index for fast candidate prefiltering
 * - Memory-efficient caching strategy with LRU eviction
 *
 * Usage:
 *   await federatedIndexer.addProject(projectId, nodes);
 *   const results = await federatedIndexer.searchAcrossProjects(queryEmbedding, {
 *     projects: ['proj1', 'proj2'],
 *     topK: 20
 *   });
 *   const embedding = await federatedIndexer.getEmbedding(nodeId);
 */

import { getNode, getAllNodes } from '../db/fractamind-indexer.js';
import { PHASE7 } from '../config.js';

/////////////////////////
// In-memory Cache    //
/////////////////////////

/**
 * Global cache structure:
 * {
 *   projects: Map<projectId, ProjectCache>,
 *   globalMortonIndex: Map<mortonPrefix, Set<{projectId, nodeId}>>,
 *   cacheSize: number,
 *   maxCacheSize: number
 * }
 */
const federatedCache = {
  projects: new Map(), // projectId -> ProjectCache
  globalMortonIndex: new Map(), // mortonPrefix (first 8 chars) -> Set of {projectId, nodeId}
  cacheSize: 0,
  maxCacheSize: PHASE7.REASONER_MAX_BATCH * 2, // ~4000 nodes
  accessOrder: [], // LRU tracking: array of {projectId, nodeId}
};

/**
 * ProjectCache structure:
 * {
 *   projectId: string,
 *   nodes: Map<nodeId, CachedNode>,
 *   mortonIndex: Map<mortonPrefix, Set<nodeId>>,
 *   lastAccess: number,
 *   nodeCount: number
 * }
 */
class ProjectCache {
  constructor(projectId) {
    this.projectId = projectId;
    this.nodes = new Map(); // nodeId -> {embedding, mortonKey, metadata}
    this.mortonIndex = new Map(); // mortonPrefix -> Set of nodeIds
    this.lastAccess = Date.now();
    this.nodeCount = 0;
  }

  addNode(nodeId, embedding, mortonKey, metadata = {}) {
    // Add to nodes map
    this.nodes.set(nodeId, {
      embedding,
      mortonKey,
      metadata,
      cachedAt: Date.now(),
    });

    // Add to Morton index (use first 8 chars as prefix for coarse bucketing)
    const prefix = mortonKey.substring(0, 8);
    if (!this.mortonIndex.has(prefix)) {
      this.mortonIndex.set(prefix, new Set());
    }
    this.mortonIndex.get(prefix).add(nodeId);

    this.nodeCount++;
    this.lastAccess = Date.now();
  }

  getNode(nodeId) {
    this.lastAccess = Date.now();
    return this.nodes.get(nodeId);
  }

  getMortonCandidates(mortonPrefix) {
    this.lastAccess = Date.now();
    return this.mortonIndex.get(mortonPrefix) || new Set();
  }

  getAllNodes() {
    this.lastAccess = Date.now();
    return Array.from(this.nodes.values());
  }

  clear() {
    this.nodes.clear();
    this.mortonIndex.clear();
    this.nodeCount = 0;
  }
}

/////////////////////////
// LRU Cache Management//
/////////////////////////

/**
 * Evict least recently used nodes to maintain cache size limit
 */
function evictLRU() {
  while (federatedCache.cacheSize > federatedCache.maxCacheSize && federatedCache.accessOrder.length > 0) {
    const oldest = federatedCache.accessOrder.shift();
    const projectCache = federatedCache.projects.get(oldest.projectId);

    if (projectCache && projectCache.nodes.has(oldest.nodeId)) {
      projectCache.nodes.delete(oldest.nodeId);
      projectCache.nodeCount--;
      federatedCache.cacheSize--;

      // Clean up empty project caches
      if (projectCache.nodeCount === 0) {
        projectCache.clear();
        federatedCache.projects.delete(oldest.projectId);
      }
    }
  }
}

/**
 * Record access for LRU tracking
 */
function recordAccess(projectId, nodeId) {
  federatedCache.accessOrder.push({ projectId, nodeId });

  // Limit access order array size
  if (federatedCache.accessOrder.length > federatedCache.maxCacheSize * 2) {
    federatedCache.accessOrder = federatedCache.accessOrder.slice(-federatedCache.maxCacheSize);
  }
}

/////////////////////////
// Public API         //
/////////////////////////

/**
 * Add or update a project's nodes in the federated cache
 * @param {string} projectId - Project identifier
 * @param {Array} nodes - Array of node objects with {id, embedding, hilbertKeyHex, ...}
 * @returns {Promise<void>}
 */
export async function addProject(projectId, nodes) {
  if (!projectId || !Array.isArray(nodes)) {
    throw new Error('Invalid arguments: projectId and nodes array required');
  }

  // Create or get project cache
  let projectCache = federatedCache.projects.get(projectId);
  if (!projectCache) {
    projectCache = new ProjectCache(projectId);
    federatedCache.projects.set(projectId, projectCache);
  } else {
    // Clear existing cache for this project
    federatedCache.cacheSize -= projectCache.nodeCount;
    projectCache.clear();
  }

  // Add nodes to cache
  for (const node of nodes) {
    if (!node.id || !node.embedding || !node.hilbertKeyHex) {
      console.warn(`[FED_INDEX] Skipping node ${node.id}: missing embedding or Morton key`);
      continue;
    }

    // Add to project cache
    projectCache.addNode(node.id, node.embedding, node.hilbertKeyHex, {
      title: node.title,
      projectId: node.projectId || projectId,
      createdAt: node.createdAt,
    });

    // Add to global Morton index
    const prefix = node.hilbertKeyHex.substring(0, 8);
    if (!federatedCache.globalMortonIndex.has(prefix)) {
      federatedCache.globalMortonIndex.set(prefix, new Set());
    }
    federatedCache.globalMortonIndex.get(prefix).add(JSON.stringify({ projectId, nodeId: node.id }));

    federatedCache.cacheSize++;
    recordAccess(projectId, node.id);
  }

  // Evict if over capacity
  evictLRU();

  console.log(`[FED_INDEX] Added project ${projectId} with ${nodes.length} nodes (cache size: ${federatedCache.cacheSize})`);
}

/**
 * Get embedding for a specific node (cache-first, then DB fallback)
 * @param {string} nodeId - Node identifier
 * @param {string} projectId - Optional project hint for faster lookup
 * @returns {Promise<Array|null>} Embedding vector or null
 */
export async function getEmbedding(nodeId, projectId = null) {
  // Try cache first
  if (projectId) {
    const projectCache = federatedCache.projects.get(projectId);
    if (projectCache) {
      const cached = projectCache.getNode(nodeId);
      if (cached) {
        recordAccess(projectId, nodeId);
        return cached.embedding;
      }
    }
  } else {
    // Search all cached projects
    for (const [projId, projectCache] of federatedCache.projects) {
      const cached = projectCache.getNode(nodeId);
      if (cached) {
        recordAccess(projId, nodeId);
        return cached.embedding;
      }
    }
  }

  // Fallback to DB
  try {
    const node = await getNode(nodeId);
    if (node && node.embedding) {
      // Opportunistically cache
      if (node.projectId) {
        let projectCache = federatedCache.projects.get(node.projectId);
        if (!projectCache) {
          projectCache = new ProjectCache(node.projectId);
          federatedCache.projects.set(node.projectId, projectCache);
        }
        projectCache.addNode(nodeId, node.embedding, node.hilbertKeyHex, {
          title: node.title,
          projectId: node.projectId,
        });
        federatedCache.cacheSize++;
        evictLRU();
      }
      return node.embedding;
    }
  } catch (err) {
    console.error(`[FED_INDEX] Error fetching node ${nodeId}:`, err);
  }

  return null;
}

/**
 * Search across multiple projects using Morton-range prefiltering
 * @param {Array} queryEmbedding - Query embedding vector
 * @param {Object} options - Search options
 * @param {Array<string>} options.projects - Project IDs to search (required)
 * @param {number} options.topK - Number of results to return (default: 20)
 * @param {number} options.prefilterMultiplier - Prefilter multiplier (default: 3)
 * @param {string} options.queryMortonKey - Pre-computed Morton key for query (optional)
 * @returns {Promise<Array>} Array of {nodeId, projectId, similarity, metadata}
 */
export async function searchAcrossProjects(queryEmbedding, options = {}) {
  const {
    projects,
    topK = 20,
    prefilterMultiplier = 3,
    queryMortonKey = null,
  } = options;

  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error('At least one project ID required for cross-project search');
  }

  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new Error('Query embedding required');
  }

  const startTime = Date.now();
  const candidates = [];

  // Step 1: Prefilter using Morton key proximity (if provided)
  if (queryMortonKey) {
    const prefix = queryMortonKey.substring(0, 8);
    const prefixInt = parseInt(prefix, 16);

    // Scan nearby Morton prefixes (±radius in hex space)
    const radius = 256; // Adjust based on empirical results
    for (let offset = -radius; offset <= radius; offset += 16) {
      const scanPrefix = (prefixInt + offset).toString(16).padStart(8, '0').substring(0, 8);

      const globalCandidates = federatedCache.globalMortonIndex.get(scanPrefix);
      if (globalCandidates) {
        for (const candidateStr of globalCandidates) {
          const { projectId, nodeId } = JSON.parse(candidateStr);

          // Filter by requested projects
          if (!projects.includes(projectId)) continue;

          const projectCache = federatedCache.projects.get(projectId);
          if (!projectCache) continue;

          const cached = projectCache.getNode(nodeId);
          if (cached) {
            candidates.push({
              nodeId,
              projectId,
              embedding: cached.embedding,
              metadata: cached.metadata,
            });
          }
        }
      }

      // Stop if we have enough candidates
      if (candidates.length >= topK * prefilterMultiplier * projects.length) {
        break;
      }
    }
  } else {
    // No Morton key provided - scan all nodes in specified projects
    for (const projectId of projects) {
      const projectCache = federatedCache.projects.get(projectId);
      if (!projectCache) {
        // Try to load from DB
        try {
          const nodes = await getAllNodes(projectId);
          if (nodes && nodes.length > 0) {
            await addProject(projectId, nodes);
            const refreshedCache = federatedCache.projects.get(projectId);
            if (refreshedCache) {
              for (const [nodeId, cached] of refreshedCache.nodes) {
                candidates.push({
                  nodeId,
                  projectId,
                  embedding: cached.embedding,
                  metadata: cached.metadata,
                });
              }
            }
          }
        } catch (err) {
          console.warn(`[FED_INDEX] Failed to load project ${projectId}:`, err.message);
        }
        continue;
      }

      // Add all nodes from this project as candidates
      for (const [nodeId, cached] of projectCache.nodes) {
        candidates.push({
          nodeId,
          projectId,
          embedding: cached.embedding,
          metadata: cached.metadata,
        });
      }
    }
  }

  // Step 2: Compute cosine similarity for all candidates
  for (const candidate of candidates) {
    candidate.similarity = cosineSimilarity(queryEmbedding, candidate.embedding);
  }

  // Step 3: Sort by similarity and take topK
  candidates.sort((a, b) => b.similarity - a.similarity);
  const results = candidates.slice(0, topK);

  const elapsed = Date.now() - startTime;
  console.log(`[FED_INDEX] Cross-project search: ${candidates.length} candidates → ${results.length} results in ${elapsed}ms`);

  return results.map(r => ({
    nodeId: r.nodeId,
    projectId: r.projectId,
    similarity: r.similarity,
    metadata: r.metadata,
  }));
}

/**
 * Compute cosine similarity between two vectors
 * @param {Array} a - Vector a
 * @param {Array} b - Vector b
 * @returns {number} Similarity score [-1, 1]
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dotProduct / denom : 0;
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  return {
    totalProjects: federatedCache.projects.size,
    totalNodes: federatedCache.cacheSize,
    maxCacheSize: federatedCache.maxCacheSize,
    globalMortonPrefixes: federatedCache.globalMortonIndex.size,
    projects: Array.from(federatedCache.projects.entries()).map(([id, cache]) => ({
      projectId: id,
      nodeCount: cache.nodeCount,
      mortonPrefixes: cache.mortonIndex.size,
      lastAccess: cache.lastAccess,
    })),
  };
}

/**
 * Clear all cached data
 */
export function clearCache() {
  for (const projectCache of federatedCache.projects.values()) {
    projectCache.clear();
  }
  federatedCache.projects.clear();
  federatedCache.globalMortonIndex.clear();
  federatedCache.cacheSize = 0;
  federatedCache.accessOrder = [];
  console.log('[FED_INDEX] Cache cleared');
}

/**
 * Warm up cache by loading specified projects
 * @param {Array<string>} projectIds - Projects to preload
 * @returns {Promise<number>} Number of nodes loaded
 */
export async function warmupCache(projectIds) {
  let totalLoaded = 0;

  for (const projectId of projectIds) {
    try {
      const nodes = await getAllNodes(projectId);
      if (nodes && nodes.length > 0) {
        await addProject(projectId, nodes);
        totalLoaded += nodes.length;
      }
    } catch (err) {
      console.warn(`[FED_INDEX] Failed to warmup project ${projectId}:`, err.message);
    }
  }

  console.log(`[FED_INDEX] Cache warmed up: ${totalLoaded} nodes from ${projectIds.length} projects`);
  return totalLoaded;
}

// Export cache instance for testing
export const __cache = federatedCache;
