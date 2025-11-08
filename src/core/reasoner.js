/**
 * reasoner.js - Phase 7: Cross-Project Reasoning Engine
 *
 * Infers semantic relations across multiple projects and constructs reasoning chains.
 *
 * Key capabilities:
 * 1. Cross-project relation inference with Morton-range prefiltering
 * 2. Multi-hop reasoning chain discovery (BFS with depth limit)
 * 3. Blended confidence scoring (semantic, AI, lexical, contextual)
 * 4. AI-generated rationales in live mode
 * 5. Reasoning transcript generation for provenance
 *
 * Usage:
 *   const relations = await inferRelations({
 *     startNodeId: 'node-123',
 *     projects: ['proj1', 'proj2', 'proj3'],
 *     depth: 2,
 *     topK: 10
 *   });
 *
 *   const chains = await findChains({
 *     sourceId: 'node-a',
 *     targetId: 'node-z',
 *     maxDepth: 3,
 *     maxChains: 5
 *   });
 */

import { getNode } from '../db/fractamind-indexer.js';
import { searchAcrossProjects, getEmbedding } from './federated_indexer.js';
import { computeLinkConfidence, computeLexicalSimilarity } from './linker.js';
import { queryLinksFiltered } from './linker.js';
import { PHASE7, CONTEXTUALIZATION } from '../config.js';

/////////////////////////
// Utilities          //
/////////////////////////

/**
 * Deterministic hash for mock mode
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Compute blended confidence score using Phase 7 weights
 * @param {Object} signals - { semantic, ai, lexical, contextual }
 * @returns {number} Confidence [0, 1]
 */
function computeBlendedConfidence(signals = {}) {
  const weights = PHASE7.REASONER_CONF_BLEND;

  const score =
    (weights.semantic * (signals.semantic || 0)) +
    (weights.ai * (signals.ai || 0)) +
    (weights.lexical * (signals.lexical || 0)) +
    (weights.contextual * (signals.contextual || 0));

  return Math.max(0, Math.min(1, score));
}

/////////////////////////
// Relation Inference //
/////////////////////////

/**
 * Infer cross-project semantic relations starting from a node
 *
 * Algorithm:
 * 1. Fetch start node embedding
 * 2. Search across specified projects using federated indexer
 * 3. For each candidate:
 *    a. Compute semantic similarity
 *    b. Compute lexical similarity
 *    c. Compute contextual bias (if available)
 *    d. Generate AI relation label (live mode) or deterministic (mock)
 *    e. Blend confidence scores
 * 4. If depth > 1, recursively explore high-confidence candidates
 * 5. Return ranked relations with metadata
 *
 * @param {Object} options - Inference options
 * @param {string} options.startNodeId - Starting node ID
 * @param {Array<string>} options.projects - Project IDs to search
 * @param {number} options.depth - Maximum reasoning depth (default: REASONER_MAX_DEPTH)
 * @param {number} options.topK - Number of top relations to return (default: 10)
 * @param {string} options.mode - 'mock' or 'live' (default: 'mock')
 * @param {number} options.threshold - Minimum confidence threshold (default: 0.7)
 * @param {Object} options.contextHistory - Optional context for bias scoring
 * @returns {Promise<Array>} Relations array: [{candidateNodeId, projectId, relationType, confidence, rationale, chain, ...}]
 */
export async function inferRelations(options = {}) {
  const {
    startNodeId,
    projects = [],
    depth = PHASE7.REASONER_MAX_DEPTH,
    topK = 10,
    mode = 'mock',
    threshold = 0.7,
    contextHistory = null,
  } = options;

  if (!startNodeId) {
    throw new Error('startNodeId required for relation inference');
  }

  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error('At least one project ID required');
  }

  const startTime = Date.now();
  console.log(`[REASONER] Inferring relations: startNode=${startNodeId}, projects=${projects.join(',')}, depth=${depth}`);

  // Fetch start node
  const startNode = await getNode(startNodeId);
  if (!startNode || !startNode.embedding) {
    throw new Error(`Start node ${startNodeId} not found or missing embedding`);
  }

  const explored = new Set(); // Track explored nodes to prevent cycles
  const relations = [];

  // BFS queue: { nodeId, embedding, currentDepth, chain }
  const queue = [{
    nodeId: startNodeId,
    embedding: startNode.embedding,
    mortonKey: startNode.hilbertKeyHex,
    currentDepth: 0,
    chain: [],
  }];

  explored.add(startNodeId);

  let iterationCount = 0;
  const maxIterations = PHASE7.REASONER_MAX_BATCH; // Prevent runaway exploration

  while (queue.length > 0 && iterationCount < maxIterations) {
    const current = queue.shift();
    iterationCount++;

    // Stop if exceeded depth
    if (current.currentDepth >= depth) {
      continue;
    }

    // Search across projects for candidates
    const candidates = await searchAcrossProjects(current.embedding, {
      projects,
      topK: topK * 2, // Get more candidates for filtering
      queryMortonKey: current.mortonKey,
    });

    // Process each candidate
    for (const candidate of candidates) {
      // Skip self and already explored
      if (candidate.nodeId === current.nodeId || explored.has(candidate.nodeId)) {
        continue;
      }

      // Fetch full candidate node for text analysis
      const candidateNode = await getNode(candidate.nodeId);
      if (!candidateNode) continue;

      // Compute signals for confidence blending
      const semantic = candidate.similarity; // From searchAcrossProjects
      const lexical = computeLexicalSimilarity(
        startNode.text || startNode.title || '',
        candidateNode.text || candidateNode.title || ''
      );

      let contextual = 0;
      if (contextHistory && contextHistory.recentNodes) {
        // Simple recency bias
        const candidateIndex = contextHistory.recentNodes.indexOf(candidate.nodeId);
        if (candidateIndex >= 0) {
          const halfLife = CONTEXTUALIZATION.CONTEXT_HALF_LIFE_HOURS;
          contextual = Math.pow(0.5, candidateIndex / halfLife);
        }
      }

      // Generate relation type and AI confidence
      const { relationType, rationale, aiConfidence } = await generateRelationLabel(
        startNode,
        candidateNode,
        semantic,
        mode
      );

      // Blend confidence
      const confidence = computeBlendedConfidence({
        semantic,
        ai: aiConfidence,
        lexical,
        contextual,
      });

      // Filter by threshold
      if (confidence < threshold) {
        continue;
      }

      // Create relation object
      const relation = {
        candidateNodeId: candidate.nodeId,
        candidateTitle: candidateNode.title,
        projectId: candidate.projectId,
        relationType,
        confidence,
        rationale,
        signals: { semantic, ai: aiConfidence, lexical, contextual },
        chain: [...current.chain, { from: current.nodeId, to: candidate.nodeId, relationType, confidence }],
        depth: current.currentDepth + 1,
        timestamp: new Date().toISOString(),
      };

      relations.push(relation);

      // Add to queue for deeper exploration if not at max depth
      if (current.currentDepth + 1 < depth && !explored.has(candidate.nodeId)) {
        explored.add(candidate.nodeId);
        queue.push({
          nodeId: candidate.nodeId,
          embedding: candidate.embedding,
          mortonKey: candidateNode.hilbertKeyHex,
          currentDepth: current.currentDepth + 1,
          chain: relation.chain,
        });
      }
    }
  }

  // Sort by confidence and limit to topK
  relations.sort((a, b) => b.confidence - a.confidence);
  const topRelations = relations.slice(0, topK);

  const elapsed = Date.now() - startTime;
  console.log(`[REASONER] Found ${relations.length} relations (returning top ${topRelations.length}) in ${elapsed}ms`);

  return topRelations;
}

/**
 * Generate relation type label and rationale
 * @param {Object} sourceNode - Source node
 * @param {Object} candidateNode - Candidate node
 * @param {number} similarity - Semantic similarity
 * @param {string} mode - 'mock' or 'live'
 * @returns {Promise<{relationType: string, rationale: string, aiConfidence: number}>}
 */
async function generateRelationLabel(sourceNode, candidateNode, similarity, mode = 'mock') {
  if (mode === 'mock') {
    // Deterministic mock mode
    const hash = hashString(sourceNode.id + candidateNode.id);
    const relationTypes = CONTEXTUALIZATION.RELATION_TYPES;
    const relationIndex = hash % relationTypes.length;
    const relation = relationTypes[relationIndex];

    const rationale = `${relation.label}: ${relation.description} (sim=${similarity.toFixed(3)})`;

    return {
      relationType: relation.id,
      rationale,
      aiConfidence: similarity, // Use similarity as proxy in mock mode
    };
  } else {
    // Live AI mode - placeholder for Writer API integration
    // TODO Phase 7.1: Implement batched Writer API calls for relation extraction
    console.warn('[REASONER] Live AI mode not yet implemented, falling back to mock');

    const hash = hashString(sourceNode.id + candidateNode.id);
    const relationTypes = CONTEXTUALIZATION.RELATION_TYPES;
    const relationIndex = hash % relationTypes.length;
    const relation = relationTypes[relationIndex];

    return {
      relationType: relation.id,
      rationale: `${relation.label} (AI extraction pending)`,
      aiConfidence: similarity * 0.9, // Slightly lower confidence for pending AI
    };
  }
}

/////////////////////////
// Chain Finding      //
/////////////////////////

/**
 * Find reasoning chains connecting source and target nodes
 *
 * Uses BFS to discover paths through the knowledge graph, considering:
 * - Existing semantic links
 * - Inferred cross-project relations
 * - Confidence-weighted path scoring
 *
 * @param {Object} options - Chain finding options
 * @param {string} options.sourceId - Source node ID
 * @param {string} options.targetId - Target node ID
 * @param {number} options.maxDepth - Maximum chain length (default: 3)
 * @param {number} options.maxChains - Maximum number of chains to return (default: 5)
 * @param {Array<string>} options.projects - Optional project filter
 * @returns {Promise<Array>} Chains: [{nodes: [ids], relations: [{from, to, type, confidence}], combinedConfidence}]
 */
export async function findChains(options = {}) {
  const {
    sourceId,
    targetId,
    maxDepth = 3,
    maxChains = 5,
    projects = null,
  } = options;

  if (!sourceId || !targetId) {
    throw new Error('sourceId and targetId required for chain finding');
  }

  if (sourceId === targetId) {
    return []; // No self-chains
  }

  const startTime = Date.now();
  console.log(`[REASONER] Finding chains: ${sourceId} → ${targetId}, maxDepth=${maxDepth}`);

  const chains = [];
  const visited = new Set();

  // BFS queue: { currentNodeId, path: [nodeIds], relations: [{from, to, type, conf}], combinedConf }
  const queue = [{
    currentNodeId: sourceId,
    path: [sourceId],
    relations: [],
    combinedConfidence: 1.0,
  }];

  while (queue.length > 0) {
    const state = queue.shift();
    const { currentNodeId, path, relations, combinedConfidence } = state;

    // Check if reached target
    if (currentNodeId === targetId) {
      chains.push({
        nodes: path,
        relations,
        combinedConfidence,
        length: relations.length,
      });

      if (chains.length >= maxChains) {
        break; // Found enough chains
      }
      continue;
    }

    // Stop if exceeded depth
    if (path.length > maxDepth) {
      continue;
    }

    // Mark as visited
    const stateKey = `${currentNodeId}:${path.length}`;
    if (visited.has(stateKey)) {
      continue;
    }
    visited.add(stateKey);

    // Find outgoing links from current node
    const outgoingLinks = await queryLinksFiltered({
      sourceNodeId: currentNodeId,
      active: true,
      limit: 50,
    });

    for (const link of outgoingLinks) {
      // Skip if already in path (prevent cycles)
      if (path.includes(link.targetNodeId)) {
        continue;
      }

      // Filter by projects if specified
      if (projects && link.projectId && !projects.includes(link.projectId)) {
        continue;
      }

      // Add to queue
      queue.push({
        currentNodeId: link.targetNodeId,
        path: [...path, link.targetNodeId],
        relations: [...relations, {
          from: link.sourceNodeId,
          to: link.targetNodeId,
          type: link.relationType,
          confidence: link.confidence || 0.5,
        }],
        combinedConfidence: combinedConfidence * (link.confidence || 0.5), // Multiplicative decay
      });
    }
  }

  // Sort chains by combined confidence
  chains.sort((a, b) => b.combinedConfidence - a.combinedConfidence);

  const elapsed = Date.now() - startTime;
  console.log(`[REASONER] Found ${chains.length} chains in ${elapsed}ms`);

  return chains.slice(0, maxChains);
}

/////////////////////////
// Reasoning Transcript//
/////////////////////////

/**
 * Generate a human-readable reasoning transcript
 * @param {Array} relations - Relations from inferRelations
 * @returns {Object} Transcript with summary and detailed steps
 */
export function generateReasoningTranscript(relations) {
  const transcript = {
    summary: `Found ${relations.length} cross-project relations`,
    timestamp: new Date().toISOString(),
    relations: relations.map(r => ({
      candidate: r.candidateNodeId,
      project: r.projectId,
      type: r.relationType,
      confidence: r.confidence.toFixed(3),
      rationale: r.rationale,
      depth: r.depth,
      signals: {
        semantic: r.signals.semantic.toFixed(3),
        ai: r.signals.ai.toFixed(3),
        lexical: r.signals.lexical.toFixed(3),
        contextual: r.signals.contextual.toFixed(3),
      },
      chain: r.chain.map(step => `${step.from} --[${step.type}]--> ${step.to}`),
    })),
  };

  return transcript;
}

/**
 * Generate chain transcript
 * @param {Array} chains - Chains from findChains
 * @returns {Object} Transcript
 */
export function generateChainTranscript(chains) {
  return {
    summary: `Found ${chains.length} reasoning chains`,
    timestamp: new Date().toISOString(),
    chains: chains.map((chain, idx) => ({
      chainId: idx + 1,
      length: chain.length,
      confidence: chain.combinedConfidence.toFixed(3),
      path: chain.nodes.join(' → '),
      steps: chain.relations.map(r =>
        `${r.from} --[${r.type} (${r.confidence.toFixed(2)})]-> ${r.to}`
      ),
    })),
  };
}

/////////////////////////
// Exports            //
/////////////////////////

export default {
  inferRelations,
  findChains,
  generateReasoningTranscript,
  generateChainTranscript,
};
