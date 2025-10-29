/**
 * Context Manager — Decay-weighted relevance scoring for contextual suggestions
 *
 * Computes relevance scores for nodes based on:
 * - Semantic similarity (cosine similarity with query embedding)
 * - Temporal recency (exponential decay)
 *
 * Formula: Score_i = α * sim_i + β * exp(-ln(2) * Δt / halfLife)
 * Where:
 * - sim_i = cosine similarity between query and interaction embedding
 * - Δt = time difference in hours
 * - halfLife = recency half-life in hours (default 72h)
 * - α = semantic weight (default 0.7)
 * - β = recency weight (default 0.3)
 */

import { getRecentInteractions } from './memory.js';
import { getNode } from '../db/fractamind-indexer.js';

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
 * Compute exponential decay factor based on time difference
 *
 * @param {number} hoursAgo - Time difference in hours
 * @param {number} halfLifeHours - Half-life in hours
 * @returns {number} Decay factor (0-1)
 */
function computeDecay(hoursAgo, halfLifeHours) {
  return Math.exp((-Math.LN2 * hoursAgo) / halfLifeHours);
}

/**
 * Get contextual suggestions based on query embedding and recent interactions
 *
 * @param {Object} options
 * @param {Array<number>|Float32Array} options.queryEmbedding - Query embedding vector
 * @param {number} options.topN - Number of top suggestions to return
 * @param {number} options.recencyHalfLifeHours - Recency half-life (default 72 hours)
 * @param {number} options.alpha - Semantic weight (default 0.7)
 * @param {number} options.beta - Recency weight (default 0.3)
 * @param {number} options.maxInteractions - Maximum interactions to consider (default 1000)
 * @returns {Promise<Array<{nodeId: string, score: number, reason: string}>>}
 */
export async function getContextSuggestions({
  queryEmbedding,
  topN = 5,
  recencyHalfLifeHours = 72,
  alpha = 0.7,
  beta = 0.3,
  maxInteractions = 1000,
} = {}) {
  if (!queryEmbedding) {
    throw new Error('queryEmbedding is required');
  }

  // Fetch recent interactions
  const interactions = await getRecentInteractions({ limit: maxInteractions });

  if (interactions.length === 0) {
    return [];
  }

  const now = Date.now();
  const nodeScores = new Map(); // nodeId -> { score, interactions, reasons }

  // Compute scores for each interaction
  for (const interaction of interactions) {
    // Skip interactions without nodeId
    if (!interaction.nodeId) continue;

    // Compute time difference in hours
    const interactionTime = new Date(interaction.at).getTime();
    const hoursAgo = (now - interactionTime) / (1000 * 60 * 60);

    // Compute semantic similarity (if embedding exists)
    let semanticScore = 0;
    if (interaction.embedding && interaction.embedding.length > 0) {
      semanticScore = cosineSimilarity(queryEmbedding, interaction.embedding);
    }

    // Compute recency score (exponential decay)
    const recencyScore = computeDecay(hoursAgo, recencyHalfLifeHours);

    // Combined score
    const combinedScore = alpha * semanticScore + beta * recencyScore;

    // Aggregate scores by nodeId (use max score)
    if (!nodeScores.has(interaction.nodeId)) {
      nodeScores.set(interaction.nodeId, {
        score: combinedScore,
        interactions: [],
        semanticScores: [],
        recencyScores: [],
        timestamps: [],
      });
    }

    const nodeData = nodeScores.get(interaction.nodeId);

    // Update with max score
    if (combinedScore > nodeData.score) {
      nodeData.score = combinedScore;
    }

    // Track interaction data for reason generation
    nodeData.interactions.push(interaction);
    nodeData.semanticScores.push(semanticScore);
    nodeData.recencyScores.push(recencyScore);
    nodeData.timestamps.push(hoursAgo);
  }

  // Convert to array and sort by score
  const suggestions = Array.from(nodeScores.entries())
    .map(([nodeId, data]) => ({
      nodeId,
      score: data.score,
      data,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  // Generate reasons and fetch node data
  const results = await Promise.all(
    suggestions.map(async ({ nodeId, score, data }) => {
      // Generate reason
      const avgSemanticScore = data.semanticScores.reduce((a, b) => a + b, 0) / data.semanticScores.length;
      const minHoursAgo = Math.min(...data.timestamps);
      const actionCount = data.interactions.length;
      const recentAction = data.interactions[0].actionType;

      let reason = '';
      if (minHoursAgo < 1) {
        reason = `Recent ${recentAction} (<1h ago)`;
      } else if (minHoursAgo < 24) {
        reason = `${recentAction} ${Math.round(minHoursAgo)}h ago`;
      } else {
        const daysAgo = Math.round(minHoursAgo / 24);
        reason = `${recentAction} ${daysAgo}d ago`;
      }

      if (avgSemanticScore > 0.5) {
        reason += ` • sim ${avgSemanticScore.toFixed(2)}`;
      }

      if (actionCount > 1) {
        reason += ` • ${actionCount} interactions`;
      }

      // Fetch node data for title
      let nodeTitle = null;
      try {
        const node = await getNode(nodeId);
        nodeTitle = node?.title || 'Unknown';
      } catch (err) {
        nodeTitle = 'Unknown';
      }

      return {
        nodeId,
        score,
        reason,
        title: nodeTitle,
        interactionCount: actionCount,
        avgSemanticScore,
        recentAction,
      };
    })
  );

  return results;
}

/**
 * Get recent context (simplified version without query embedding)
 * Returns most recently interacted nodes
 *
 * @param {Object} options
 * @param {number} options.limit - Number of recent interactions to return
 * @returns {Promise<Array<Object>>} Recent interactions with node data
 */
export async function getRecentContext({ limit = 50 } = {}) {
  const interactions = await getRecentInteractions({ limit });

  // Group by nodeId and get most recent interaction per node
  const nodeMap = new Map();

  for (const interaction of interactions) {
    if (!interaction.nodeId) continue;

    if (!nodeMap.has(interaction.nodeId)) {
      nodeMap.set(interaction.nodeId, interaction);
    }
  }

  // Fetch node data
  const results = await Promise.all(
    Array.from(nodeMap.entries()).map(async ([nodeId, interaction]) => {
      let nodeTitle = null;
      try {
        const node = await getNode(nodeId);
        nodeTitle = node?.title || 'Unknown';
      } catch (err) {
        nodeTitle = 'Unknown';
      }

      const hoursAgo = (Date.now() - new Date(interaction.at).getTime()) / (1000 * 60 * 60);

      return {
        nodeId,
        title: nodeTitle,
        actionType: interaction.actionType,
        at: interaction.at,
        hoursAgo,
        meta: interaction.meta,
      };
    })
  );

  return results;
}

/**
 * Get context statistics for debugging/monitoring
 *
 * @returns {Promise<Object>} Context statistics
 */
export async function getContextStats() {
  const interactions = await getRecentInteractions({ limit: 1000 });

  const stats = {
    totalInteractions: interactions.length,
    uniqueNodes: new Set(interactions.map(i => i.nodeId).filter(Boolean)).size,
    interactionsWithEmbeddings: interactions.filter(i => i.embedding).length,
    actionTypeCounts: {},
    timeSpan: null,
  };

  // Count by action type
  interactions.forEach(i => {
    stats.actionTypeCounts[i.actionType] = (stats.actionTypeCounts[i.actionType] || 0) + 1;
  });

  // Time span
  if (interactions.length > 0) {
    const timestamps = interactions.map(i => new Date(i.at).getTime());
    const oldest = Math.min(...timestamps);
    const newest = Math.max(...timestamps);
    stats.timeSpan = {
      oldest: new Date(oldest).toISOString(),
      newest: new Date(newest).toISOString(),
      spanHours: (newest - oldest) / (1000 * 60 * 60),
    };
  }

  return stats;
}
