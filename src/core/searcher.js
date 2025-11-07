/**
 * searcher.js - Semantic search pipeline for FractaMind
 *
 * Implements Morton-range → cosine re-rank search:
 * 1. Compute query embedding
 * 2. Reduce & quantize using project quantParams
 * 3. Compute Morton key
 * 4. Range scan to get candidates
 * 5. Re-rank by cosine similarity on full embeddings
 * 6. Return top-K results with scores and snippets
 *
 * Fallbacks:
 * - If embedding API fails → substring search on titles/text
 * - If no quantParams → linear scan all nodes
 * - If candidates < topK → progressively widen radius
 */

import { generateEmbedding } from '../ai/chromeAI.js';
import {
  computeQuantizationParams,
  computeMortonKeyFromEmbedding,
  rangeScanByMortonHex,
  getNode,
} from '../db/fractamind-indexer.js';

/**
 * Compute cosine similarity between two vectors
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} - Cosine similarity [-1, 1]
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
 * Generate text snippet from node text
 * @param {string} text - Full node text
 * @param {number} maxLength - Maximum snippet length (default: 140)
 * @returns {string} - Truncated snippet with ellipsis if needed
 */
function generateSnippet(text, maxLength = 140) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Fallback substring search when embedding API fails
 * @param {string} queryText - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Array of matching nodes
 */
// eslint-disable-next-line no-unused-vars
async function substringSearch(queryText, { projectId: _projectId, topK: _topK = 10, subtreeRootId: _subtreeRootId = null }) {
  console.warn('Falling back to substring search (embedding API unavailable)');

  // TODO: Implement getAllNodes function in indexer
  // For now, return empty array
  console.error('Substring search not yet implemented - need getAllNodes() in indexer');
  return [];
}

/**
 * Linear scan fallback when no quantParams available
 * @param {ArrayLike} queryEmbedding - Query embedding vector
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Array of matching nodes with scores
 */
// eslint-disable-next-line no-unused-vars
async function linearScanSearch(queryEmbedding, { projectId: _projectId, topK: _topK = 10, subtreeRootId: _subtreeRootId = null }) {
  console.warn('Falling back to linear scan (no quantParams available)');

  // TODO: Implement getAllNodes function in indexer
  // For now, return empty array
  console.error('Linear scan not yet implemented - need getAllNodes() in indexer');
  return [];
}

/**
 * Semantic search using Morton-range → cosine re-rank
 *
 * @param {string} queryText - Search query text
 * @param {Object} options - Search options
 * @param {string} options.projectId - Project ID to search within
 * @param {number} options.topK - Number of results to return (default: 10)
 * @param {string} options.subtreeRootId - Optional subtree root to limit search (default: null)
 * @param {number} options.radiusPower - Morton radius as power of 2 (default: 12 → 2^12 = 4096)
 * @param {Object} options.quantParams - Quantization params (optional, will fetch from IndexedDB if not provided)
 * @param {number} options.maxRadiusWidenings - Max times to widen radius if results < topK (default: 3)
 * @returns {Promise<Array>} - Array of results: [{ nodeId, score, title, snippet, hilbertKeyHex }]
 */
export async function semanticSearch(queryText, options = {}) {
  const {
    projectId,
    topK = 10,
    subtreeRootId = null,
    radiusPower = 12,
    quantParams = null,
    maxRadiusWidenings = 3,
  } = options;

  if (!queryText || queryText.trim() === '') {
    return [];
  }

  try {
    // Step 1: Generate query embedding
    const queryEmbedding = await generateEmbedding(queryText);

    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    // Step 2: Get or use quantization params
    let qParams = quantParams;
    if (!qParams) {
      // Try to fetch from IndexedDB (stored with project metadata)
      // For now, return linear scan if not provided
      console.warn('No quantParams provided, attempting linear scan');
      return await linearScanSearch(queryEmbedding, options);
    }

    // Step 3: Compute Morton key for query
    const queryEmbeddingArray = Array.isArray(queryEmbedding)
      ? queryEmbedding
      : Array.from(queryEmbedding);

    const queryMortonKey = computeMortonKeyFromEmbedding(queryEmbeddingArray, qParams);

    // Step 4: Range scan with progressive radius widening
    let candidates = [];
    let currentRadius = Math.pow(2, radiusPower);
    let widenings = 0;

    while (candidates.length < topK && widenings <= maxRadiusWidenings) {
      const radiusHex = currentRadius.toString(16).padStart(16, '0');

      // Range scan to get candidate node IDs
      const candidateIds = await rangeScanByMortonHex(queryMortonKey, radiusHex, {
        limit: topK * 5, // Fetch more candidates for better re-ranking
      });

      if (candidateIds && candidateIds.length > 0) {
        candidates = candidateIds;
        break;
      }

      // Widen radius if no candidates found
      if (widenings < maxRadiusWidenings) {
        currentRadius *= 4; // Quadruple radius each time
        widenings++;
        console.log(`Widening search radius to ${currentRadius} (attempt ${widenings}/${maxRadiusWidenings})`);
      } else {
        break;
      }
    }

    if (candidates.length === 0) {
      console.log('No candidates found within maximum radius');
      return [];
    }

    // Step 5: Fetch candidate nodes and compute cosine similarity
    const results = [];

    for (const nodeId of candidates) {
      try {
        const node = await getNode(nodeId);

        if (!node || !node.embedding) {
          continue;
        }

        // Filter by projectId if specified
        if (projectId && node.meta?.projectId !== projectId) {
          continue;
        }

        // Filter by subtree if specified
        if (subtreeRootId) {
          // TODO: Implement subtree filtering (check if node is descendant of subtreeRootId)
          // For now, skip this filter
        }

        // Compute cosine similarity
        const nodeEmbeddingArray = Array.isArray(node.embedding)
          ? node.embedding
          : Array.from(node.embedding);

        const score = cosineSimilarity(queryEmbeddingArray, nodeEmbeddingArray);

        results.push({
          nodeId: node.id,
          score,
          title: node.title || 'Untitled',
          snippet: generateSnippet(node.text),
          hilbertKeyHex: node.hilbertKeyHex,
          text: node.text, // Include full text for context
          meta: node.meta,
        });
      } catch (error) {
        console.error(`Error fetching node ${nodeId}:`, error);
        continue;
      }
    }

    // Step 6: Sort by score (descending) and return top-K
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, topK);

    console.log(`Search complete: ${topResults.length} results from ${candidates.length} candidates`);

    return topResults;

  } catch (error) {
    console.error('Semantic search failed:', error);

    // Fallback to substring search
    return await substringSearch(queryText, options);
  }
}

/**
 * Batch semantic search for multiple queries
 * @param {Array<string>} queries - Array of query strings
 * @param {Object} options - Search options (same as semanticSearch)
 * @returns {Promise<Map>} - Map of query → results array
 */
export async function batchSemanticSearch(queries, options = {}) {
  const results = new Map();

  for (const query of queries) {
    try {
      const queryResults = await semanticSearch(query, options);
      results.set(query, queryResults);
    } catch (error) {
      console.error(`Batch search failed for query "${query}":`, error);
      results.set(query, []);
    }
  }

  return results;
}

/**
 * Get or create quantization params for a project
 * Helper to ensure quantParams exist before searching
 *
 * @param {string} projectId - Project ID
 * @param {Array<Array<number>>} sampleEmbeddings - Sample embeddings to compute params (optional)
 * @returns {Promise<Object>} - Quantization parameters
 */
export async function getOrCreateQuantParams(projectId, sampleEmbeddings = null) {
  // Try to fetch from IndexedDB
  const projectNode = await getNode(`project:${projectId}`);

  if (projectNode && projectNode.meta?.quantParams) {
    return projectNode.meta.quantParams;
  }

  // If not found and sample embeddings provided, compute new params
  if (sampleEmbeddings && sampleEmbeddings.length > 0) {
    const quantParams = computeQuantizationParams(sampleEmbeddings, {
      reducedDims: 8,
      bits: 16,
      reduction: 'first',
    });

    // TODO: Save quantParams to project metadata
    console.log('Computed new quantParams for project:', projectId);
    return quantParams;
  }

  console.error('No quantParams found and no sample embeddings provided');
  return null;
}
