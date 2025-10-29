/**
 * crossSearcher.js - Cross-project semantic search for federated workspace
 *
 * Implements multi-project search with ranking fusion:
 * 1. Generate query embedding
 * 2. Perform parallel Morton-range search across active projects
 * 3. Normalize similarity scores per project (avoid bias)
 * 4. Apply project weights and freshness boost
 * 5. Merge and rank results globally
 * 6. Return top-K with project context
 *
 * Ranking Formula:
 *   finalScore = cosineSim * projectWeight * freshnessBoost
 *   freshnessBoost = 1.0 + 0.2 * exp(-daysSinceAccess / 30)
 *
 * Progressive Search:
 * - Start with small Morton radius
 * - If results < topK, widen radius (3 iterations max)
 * - Fallback to linear scan if Morton search fails
 */

import { generateEmbedding } from '../ai/chromeAI.js';
import { computeMortonKeyFromEmbedding } from '../db/fractamind-indexer.js';
import {
  getQuantParams,
  searchProjectByMorton,
  getProjectNodes
} from './federation.js';
import { listProjects, touchProject } from './projectRegistry.js';

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Compute freshness boost based on last access time
 * @param {string} lastAccessed - ISO8601 timestamp
 * @returns {number} - Boost multiplier [1.0, 1.2]
 */
function computeFreshnessBoost(lastAccessed) {
  const now = new Date();
  const accessed = new Date(lastAccessed);
  const daysSince = (now - accessed) / (1000 * 60 * 60 * 24);

  // Exponential decay: fresh projects get up to 20% boost
  return 1.0 + 0.2 * Math.exp(-daysSince / 30);
}

/**
 * Normalize scores within a project result set
 * @param {Array} results - Results with raw similarity scores
 * @returns {Array} - Results with normalized scores [0, 1]
 */
function normalizeProjectScores(results) {
  if (results.length === 0) return results;

  const scores = results.map(r => r.rawSimilarity);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore || 1;

  return results.map(r => ({
    ...r,
    normalizedSimilarity: (r.rawSimilarity - minScore) / range
  }));
}

/**
 * Search a single project with Morton key
 * @param {string} projectId
 * @param {string} mortonKeyHex
 * @param {string} radiusHex
 * @param {Array} queryEmbedding
 * @param {Object} options
 * @returns {Promise<Array>}
 */
async function searchSingleProject(projectId, mortonKeyHex, radiusHex, queryEmbedding, { limit = 50 }) {
  try {
    // Morton-based candidate retrieval
    const candidates = await searchProjectByMorton(projectId, mortonKeyHex, radiusHex, { limit });

    // Re-rank by cosine similarity
    const results = candidates
      .filter(node => node.embedding && node.embedding.length > 0)
      .map(node => ({
        projectId,
        nodeId: node.id,
        title: node.title,
        text: node.text,
        snippet: generateSnippet(node.text),
        rawSimilarity: cosineSimilarity(queryEmbedding, node.embedding),
        node: node // Include full node for context
      }))
      .filter(r => r.rawSimilarity > 0.1) // Filter low-relevance results
      .sort((a, b) => b.rawSimilarity - a.rawSimilarity);

    return results;
  } catch (error) {
    console.warn(`Search failed for project ${projectId}:`, error);
    return [];
  }
}

/**
 * Fallback linear scan for a project
 * @param {string} projectId
 * @param {Array} queryEmbedding
 * @param {Object} options
 * @returns {Promise<Array>}
 */
async function linearScanProject(projectId, queryEmbedding, { limit = 50 }) {
  try {
    const allNodes = await getProjectNodes(projectId, { limit: 1000 });

    const results = allNodes
      .filter(node => node.embedding && node.embedding.length > 0)
      .map(node => ({
        projectId,
        nodeId: node.id,
        title: node.title,
        text: node.text,
        snippet: generateSnippet(node.text),
        rawSimilarity: cosineSimilarity(queryEmbedding, node.embedding),
        node: node
      }))
      .filter(r => r.rawSimilarity > 0.1)
      .sort((a, b) => b.rawSimilarity - a.rawSimilarity)
      .slice(0, limit);

    return results;
  } catch (error) {
    console.warn(`Linear scan failed for project ${projectId}:`, error);
    return [];
  }
}

/**
 * Generate text snippet from node text
 */
function generateSnippet(text, maxLength = 140) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Cross-project semantic search
 * @param {string} queryText - User's search query
 * @param {Object} options
 * @param {number} options.topK - Max results to return (default: 20)
 * @param {Array<string>} options.projectIds - Specific projects to search (default: all active)
 * @param {boolean} options.applyWeights - Apply project weights (default: true)
 * @param {boolean} options.applyFreshness - Apply recency boost (default: true)
 * @param {Function} options.onProgress - Progress callback (projectId, current, total)
 * @returns {Promise<Array>} - Ranked results with project context
 */
export async function crossProjectSearch(queryText, {
  topK = 20,
  projectIds = null,
  applyWeights = true,
  applyFreshness = true,
  onProgress = null
} = {}) {
  // 1. Generate query embedding
  let queryEmbedding;
  try {
    queryEmbedding = await generateEmbedding(queryText);
  } catch (error) {
    console.error('Failed to generate query embedding:', error);
    throw new Error('Embedding generation failed. Ensure Chrome Built-in AI is enabled.');
  }

  // 2. Get active projects
  const allProjects = projectIds
    ? await Promise.all(projectIds.map(async id => {
        const { getProject } = await import('./projectRegistry.js');
        return getProject(id);
      }))
    : await listProjects({ activeOnly: true });

  const activeProjects = allProjects.filter(p => p && p.isActive);

  if (activeProjects.length === 0) {
    return [];
  }

  // 3. Get quantization parameters
  const quantParams = await getQuantParams();
  if (!quantParams) {
    console.warn('No quantization params - using linear scan fallback');
    return await linearScanAllProjects(activeProjects, queryEmbedding, { topK, applyWeights, applyFreshness, onProgress });
  }

  // 4. Compute query Morton key
  const mortonKeyHex = computeMortonKeyFromEmbedding(queryEmbedding, quantParams);

  // 5. Progressive radius widening
  const radii = ['1000', '5000', '10000']; // Hex radii for 3 iterations
  let allResults = [];

  for (let iteration = 0; iteration < radii.length; iteration++) {
    const radiusHex = radii[iteration];

    // Search all active projects in parallel
    const searchPromises = activeProjects.map(async (project, idx) => {
      if (onProgress) {
        onProgress(project.projectId, idx + 1, activeProjects.length);
      }

      const results = await searchSingleProject(
        project.projectId,
        mortonKeyHex,
        radiusHex,
        queryEmbedding,
        { limit: topK * 2 }
      );

      // Normalize scores within project
      const normalized = normalizeProjectScores(results);

      // Apply project weight and freshness boost
      return normalized.map(result => {
        let finalScore = result.normalizedSimilarity;

        if (applyWeights) {
          finalScore *= project.weight;
        }

        if (applyFreshness) {
          const boost = computeFreshnessBoost(project.lastAccessed);
          finalScore *= boost;
        }

        return {
          ...result,
          finalScore,
          projectName: project.name,
          projectWeight: project.weight,
          freshnessBoost: applyFreshness ? computeFreshnessBoost(project.lastAccessed) : 1.0
        };
      });
    });

    const projectResults = await Promise.all(searchPromises);
    allResults = projectResults.flat();

    // Check if we have enough results
    if (allResults.length >= topK) {
      break;
    }
  }

  // 6. Global ranking and top-K selection
  const ranked = allResults
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topK);

  // 7. Update lastAccessed for searched projects
  for (const project of activeProjects) {
    await touchProject(project.projectId).catch(err =>
      console.warn(`Failed to update lastAccessed for ${project.projectId}:`, err)
    );
  }

  return ranked;
}

/**
 * Linear scan fallback across all projects
 */
async function linearScanAllProjects(projects, queryEmbedding, {
  topK = 20,
  applyWeights = true,
  applyFreshness = true,
  onProgress = null
}) {
  const searchPromises = projects.map(async (project, idx) => {
    if (onProgress) {
      onProgress(project.projectId, idx + 1, projects.length);
    }

    const results = await linearScanProject(project.projectId, queryEmbedding, { limit: topK * 2 });
    const normalized = normalizeProjectScores(results);

    return normalized.map(result => {
      let finalScore = result.normalizedSimilarity;

      if (applyWeights) {
        finalScore *= project.weight;
      }

      if (applyFreshness) {
        finalScore *= computeFreshnessBoost(project.lastAccessed);
      }

      return {
        ...result,
        finalScore,
        projectName: project.name,
        projectWeight: project.weight,
        freshnessBoost: applyFreshness ? computeFreshnessBoost(project.lastAccessed) : 1.0
      };
    });
  });

  const projectResults = await Promise.all(searchPromises);
  const allResults = projectResults.flat();

  const ranked = allResults
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topK);

  // Update lastAccessed
  for (const project of projects) {
    await touchProject(project.projectId).catch(err =>
      console.warn(`Failed to update lastAccessed for ${project.projectId}:`, err)
    );
  }

  return ranked;
}

/**
 * Search within a specific project (single-project mode)
 * @param {string} projectId
 * @param {string} queryText
 * @param {Object} options
 * @returns {Promise<Array>}
 */
export async function searchWithinProject(projectId, queryText, { topK = 20 } = {}) {
  const queryEmbedding = await generateEmbedding(queryText);
  const quantParams = await getQuantParams();

  if (!quantParams) {
    return linearScanProject(projectId, queryEmbedding, { limit: topK });
  }

  const mortonKeyHex = computeMortonKeyFromEmbedding(queryEmbedding, quantParams);

  // Progressive widening
  const radii = ['1000', '5000', '10000'];
  let results = [];

  for (const radiusHex of radii) {
    results = await searchSingleProject(projectId, mortonKeyHex, radiusHex, queryEmbedding, { limit: topK * 2 });

    if (results.length >= topK) {
      break;
    }
  }

  const normalized = normalizeProjectScores(results);

  return normalized
    .map(r => ({ ...r, finalScore: r.normalizedSimilarity }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topK);
}

/**
 * Get search suggestions based on recent queries (placeholder for future)
 * @returns {Promise<Array<string>>}
 */
export async function getSearchSuggestions() {
  // TODO: Implement based on search history from contextual memory
  return [];
}
