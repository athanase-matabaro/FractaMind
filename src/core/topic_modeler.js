/**
 * topic_modeler.js - Phase 7: Streaming Topic Modeling
 *
 * Online, incremental topic clustering across projects using:
 * - Lightweight embedding-based clustering (online agglomerative)
 * - TF-IDF keyword extraction for topic labels
 * - Temporal decay for topic aging
 * - Cross-project topic discovery
 *
 * Approach:
 * - Use simplified online clustering instead of full UMAP+HDBSCAN
 * - Cluster embeddings using cosine similarity with threshold-based merging
 * - Extract keywords using TF-IDF over node texts in each topic
 * - Decay topic weights based on time since last contribution
 *
 * Usage:
 *   await updateWithNodes(['node1', 'node2', ...]);
 *   const topics = await getTopics({ projectIds: ['proj1'], timeframe: '7d' });
 *   const topic = await getTopicForNode('node123');
 */

import { getNode } from '../db/fractamind-indexer.js';
import { PHASE7 } from '../config.js';

/////////////////////////
// Topic Storage      //
/////////////////////////

/**
 * Topic data structure:
 * {
 *   topicId: string,
 *   centroidEmbedding: Array,
 *   keywords: Array<{word, score}>,
 *   nodeIds: Set<string>,
 *   projects: Set<string>,
 *   createdAt: timestamp,
 *   lastUpdated: timestamp,
 *   weight: number (decays over time),
 *   activityHistory: Array<{timestamp, action, nodeId}>
 * }
 */

const topicStore = {
  topics: new Map(), // topicId -> Topic
  nodeToTopic: new Map(), // nodeId -> topicId
  nextTopicId: 1,
};

/////////////////////////
// Configuration      //
/////////////////////////

const CONFIG = {
  SIMILARITY_THRESHOLD: 0.75, // Cosine similarity threshold for topic merging
  MAX_KEYWORDS_PER_TOPIC: 10,
  MIN_NODES_PER_TOPIC: 2,
  DECAY_WINDOW_MS: PHASE7.TOPIC_WINDOW_MINUTES * 60 * 1000, // Convert to milliseconds
  MAX_TOPICS: PHASE7.TOPIC_NUM_TOPICS,
};

/////////////////////////
// Clustering Logic   //
/////////////////////////

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

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dotProduct / denom : 0;
}

/**
 * Find the best matching topic for a node embedding
 * @param {Array} embedding - Node embedding
 * @returns {{topicId: string, similarity: number} | null}
 */
function findBestMatchingTopic(embedding) {
  let bestMatch = null;
  let bestSimilarity = -1;

  for (const [topicId, topic] of topicStore.topics) {
    const similarity = cosineSimilarity(embedding, topic.centroidEmbedding);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = topicId;
    }
  }

  // Only return if similarity exceeds threshold
  if (bestSimilarity >= CONFIG.SIMILARITY_THRESHOLD) {
    return { topicId: bestMatch, similarity: bestSimilarity };
  }

  return null;
}

/**
 * Create a new topic
 * @param {Array} centroidEmbedding - Initial centroid
 * @param {string} nodeId - Initial node ID
 * @param {string} projectId - Project ID
 * @returns {string} Topic ID
 */
function createTopic(centroidEmbedding, nodeId, projectId) {
  const topicId = `topic-${topicStore.nextTopicId++}`;

  const topic = {
    topicId,
    centroidEmbedding: [...centroidEmbedding], // Copy
    keywords: [],
    nodeIds: new Set([nodeId]),
    projects: new Set([projectId]),
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    weight: 1.0,
    activityHistory: [{ timestamp: Date.now(), action: 'created', nodeId }],
  };

  topicStore.topics.set(topicId, topic);
  topicStore.nodeToTopic.set(nodeId, topicId);

  console.log(`[TOPIC] Created topic ${topicId} with node ${nodeId}`);

  return topicId;
}

/**
 * Add a node to an existing topic and update centroid
 * @param {string} topicId - Topic ID
 * @param {Array} embedding - Node embedding
 * @param {string} nodeId - Node ID
 * @param {string} projectId - Project ID
 */
function addNodeToTopic(topicId, embedding, nodeId, projectId) {
  const topic = topicStore.topics.get(topicId);
  if (!topic) return;

  // Update centroid (incremental mean)
  const n = topic.nodeIds.size;
  for (let i = 0; i < topic.centroidEmbedding.length; i++) {
    topic.centroidEmbedding[i] = (topic.centroidEmbedding[i] * n + embedding[i]) / (n + 1);
  }

  // Add node
  topic.nodeIds.add(nodeId);
  topic.projects.add(projectId);
  topic.lastUpdated = Date.now();
  topic.weight = Math.min(1.0, topic.weight + 0.1); // Boost weight slightly
  topic.activityHistory.push({ timestamp: Date.now(), action: 'node_added', nodeId });

  topicStore.nodeToTopic.set(nodeId, topicId);

  console.log(`[TOPIC] Added node ${nodeId} to topic ${topicId} (${topic.nodeIds.size} nodes)`);
}

/////////////////////////
// Keyword Extraction //
/////////////////////////

/**
 * Extract keywords from node texts using simple TF-IDF
 * @param {Array<string>} texts - Array of node texts
 * @returns {Array<{word, score}>} Top keywords
 */
function extractKeywords(texts) {
  if (!texts || texts.length === 0) return [];

  // Tokenize and count term frequencies
  const termFrequencies = new Map(); // term -> count in this topic
  const documentFrequencies = new Map(); // term -> number of documents containing term
  const totalDocuments = texts.length;

  // Build term frequencies and document frequencies
  for (const text of texts) {
    if (!text) continue;

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(w => w.length > 3); // Filter short words

    const docTerms = new Set(words);

    for (const word of words) {
      termFrequencies.set(word, (termFrequencies.get(word) || 0) + 1);
    }

    for (const word of docTerms) {
      documentFrequencies.set(word, (documentFrequencies.get(word) || 0) + 1);
    }
  }

  // Compute TF-IDF scores
  const tfidfScores = [];

  for (const [term, tf] of termFrequencies) {
    const df = documentFrequencies.get(term) || 1;
    const idf = Math.log(totalDocuments / df);
    const tfidf = tf * idf;

    tfidfScores.push({ word: term, score: tfidf });
  }

  // Sort by score and return top keywords
  tfidfScores.sort((a, b) => b.score - a.score);

  return tfidfScores.slice(0, CONFIG.MAX_KEYWORDS_PER_TOPIC);
}

/**
 * Update keywords for a topic
 * @param {string} topicId - Topic ID
 */
async function updateTopicKeywords(topicId) {
  const topic = topicStore.topics.get(topicId);
  if (!topic) return;

  // Fetch texts for all nodes in topic
  const texts = [];
  for (const nodeId of topic.nodeIds) {
    try {
      const node = await getNode(nodeId);
      if (node && node.text) {
        texts.push(node.text);
      } else if (node && node.title) {
        texts.push(node.title);
      }
    } catch (err) {
      console.warn(`[TOPIC] Failed to fetch node ${nodeId} for keyword extraction:`, err.message);
    }
  }

  // Extract keywords
  topic.keywords = extractKeywords(texts);

  console.log(`[TOPIC] Updated keywords for ${topicId}:`, topic.keywords.slice(0, 5).map(k => k.word));
}

/////////////////////////
// Topic Decay        //
/////////////////////////

/**
 * Decay topic weights based on time since last update
 */
function decayTopicWeights() {
  const now = Date.now();

  for (const topic of topicStore.topics.values()) {
    const timeSinceUpdate = now - topic.lastUpdated;
    const windowsPassed = timeSinceUpdate / CONFIG.DECAY_WINDOW_MS;

    // Exponential decay: weight *= 0.5^windowsPassed
    const decayFactor = Math.pow(0.5, windowsPassed);
    topic.weight = Math.max(0.01, topic.weight * decayFactor); // Min weight 0.01
  }
}

/**
 * Prune topics with very low weight or too few nodes
 */
function pruneTopics() {
  const toDelete = [];

  for (const [topicId, topic] of topicStore.topics) {
    if (topic.weight < 0.05 || topic.nodeIds.size < CONFIG.MIN_NODES_PER_TOPIC) {
      toDelete.push(topicId);

      // Remove node mappings
      for (const nodeId of topic.nodeIds) {
        topicStore.nodeToTopic.delete(nodeId);
      }
    }
  }

  for (const topicId of toDelete) {
    topicStore.topics.delete(topicId);
  }

  if (toDelete.length > 0) {
    console.log(`[TOPIC] Pruned ${toDelete.length} topics`);
  }
}

/////////////////////////
// Public API         //
/////////////////////////

/**
 * Update topics incrementally with new nodes
 * @param {Array<string>} nodeIds - Node IDs to add/update
 * @returns {Promise<number>} Number of topics updated/created
 */
export async function updateWithNodes(nodeIds) {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
    return 0;
  }

  const startTime = Date.now();
  let updatedCount = 0;

  // Decay existing topics first
  decayTopicWeights();

  // Process each node
  for (const nodeId of nodeIds) {
    try {
      const node = await getNode(nodeId);
      if (!node || !node.embedding) {
        console.warn(`[TOPIC] Skipping node ${nodeId}: no embedding`);
        continue;
      }

      const projectId = node.projectId || 'unknown';

      // Find best matching topic
      const match = findBestMatchingTopic(node.embedding);

      if (match) {
        // Add to existing topic
        addNodeToTopic(match.topicId, node.embedding, nodeId, projectId);
      } else {
        // Create new topic if under limit
        if (topicStore.topics.size < CONFIG.MAX_TOPICS) {
          createTopic(node.embedding, nodeId, projectId);
        } else {
          // Force add to closest topic even if below threshold
          let closestTopicId = null;
          let closestSim = -1;

          for (const [topicId, topic] of topicStore.topics) {
            const sim = cosineSimilarity(node.embedding, topic.centroidEmbedding);
            if (sim > closestSim) {
              closestSim = sim;
              closestTopicId = topicId;
            }
          }

          if (closestTopicId) {
            addNodeToTopic(closestTopicId, node.embedding, nodeId, projectId);
          }
        }
      }

      updatedCount++;
    } catch (err) {
      console.error(`[TOPIC] Error processing node ${nodeId}:`, err);
    }
  }

  // Update keywords for affected topics (async)
  setTimeout(async () => {
    for (const nodeId of nodeIds) {
      const topicId = topicStore.nodeToTopic.get(nodeId);
      if (topicId) {
        await updateTopicKeywords(topicId);
      }
    }
  }, 100); // Defer to not block

  // Prune low-weight topics
  pruneTopics();

  const elapsed = Date.now() - startTime;
  console.log(`[TOPIC] Updated ${updatedCount} nodes in ${elapsed}ms (${topicStore.topics.size} topics)`);

  return updatedCount;
}

/**
 * Get topics filtered by projects and/or timeframe
 * @param {Object} options - Query options
 * @param {Array<string>} options.projectIds - Filter by project IDs (optional)
 * @param {string} options.timeframe - Time window ('1d', '7d', '30d', 'all') (optional)
 * @returns {Promise<Array>} Topics array
 */
export async function getTopics(options = {}) {
  const { projectIds = null, timeframe = 'all' } = options;

  // Compute timeframe cutoff
  let cutoffTime = 0;
  if (timeframe !== 'all') {
    const days = parseInt(timeframe) || 7;
    cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  }

  const results = [];

  for (const topic of topicStore.topics.values()) {
    // Filter by timeframe
    if (timeframe !== 'all' && topic.lastUpdated < cutoffTime) {
      continue;
    }

    // Filter by projects
    if (projectIds && projectIds.length > 0) {
      const hasOverlap = projectIds.some(pid => topic.projects.has(pid));
      if (!hasOverlap) {
        continue;
      }
    }

    // Add to results
    results.push({
      topicId: topic.topicId,
      keywords: topic.keywords.slice(0, 5), // Top 5 keywords
      nodeCount: topic.nodeIds.size,
      projects: Array.from(topic.projects),
      weight: topic.weight,
      createdAt: topic.createdAt,
      lastUpdated: topic.lastUpdated,
    });
  }

  // Sort by weight (descending)
  results.sort((a, b) => b.weight - a.weight);

  return results;
}

/**
 * Get the topic for a specific node
 * @param {string} nodeId - Node ID
 * @returns {Promise<Object|null>} Topic object or null
 */
export async function getTopicForNode(nodeId) {
  const topicId = topicStore.nodeToTopic.get(nodeId);
  if (!topicId) return null;

  const topic = topicStore.topics.get(topicId);
  if (!topic) return null;

  return {
    topicId: topic.topicId,
    keywords: topic.keywords.slice(0, 5),
    nodeCount: topic.nodeIds.size,
    projects: Array.from(topic.projects),
    weight: topic.weight,
    createdAt: topic.createdAt,
    lastUpdated: topic.lastUpdated,
  };
}

/**
 * Get all nodes in a topic
 * @param {string} topicId - Topic ID
 * @returns {Promise<Array<string>>} Node IDs
 */
export async function getNodesInTopic(topicId) {
  const topic = topicStore.topics.get(topicId);
  if (!topic) return [];

  return Array.from(topic.nodeIds);
}

/**
 * Clear all topics (for testing)
 */
export function clearTopics() {
  topicStore.topics.clear();
  topicStore.nodeToTopic.clear();
  topicStore.nextTopicId = 1;
  console.log('[TOPIC] All topics cleared');
}

/**
 * Get topic modeling statistics
 * @returns {Object} Stats
 */
export function getTopicStats() {
  const topics = Array.from(topicStore.topics.values());

  return {
    totalTopics: topics.length,
    totalNodeAssignments: topicStore.nodeToTopic.size,
    averageNodesPerTopic: topics.length > 0
      ? topics.reduce((sum, t) => sum + t.nodeIds.size, 0) / topics.length
      : 0,
    averageWeight: topics.length > 0
      ? topics.reduce((sum, t) => sum + t.weight, 0) / topics.length
      : 0,
    topicsByProject: (() => {
      const byProject = new Map();
      for (const topic of topics) {
        for (const projectId of topic.projects) {
          byProject.set(projectId, (byProject.get(projectId) || 0) + 1);
        }
      }
      return Object.fromEntries(byProject);
    })(),
  };
}

// Export internal store for testing
export const __topicStore = topicStore;
