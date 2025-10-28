/**
 * Import Pipeline for FractaMind
 *
 * Handles document import, summarization, node creation, embedding generation,
 * and persistence to IndexedDB.
 *
 * Pipeline:
 * 1. User submits text (handleSeedSubmit)
 * 2. Summarize into 3-7 topics (summarizeDocument)
 * 3. Parse summary to FractalNode objects (parseSummaryToNodes)
 * 4. Generate embeddings and Morton keys (attachEmbeddingsAndKeys)
 * 5. Persist to IndexedDB (persistProject)
 */

import { summarizeDocument, generateEmbedding, batchGenerateEmbeddings } from '../ai/chromeAI.js';
import {
  initDB,
  saveNode,
  getNode,
  computeQuantizationParams,
  computeMortonKeyFromEmbedding,
} from '../db/fractamind-indexer.js';
import { generateUUID } from '../utils/uuid.js';

/**
 * Main entry point called by ChoreComponent.onSeedSubmit
 *
 * @param {string} text - User-submitted document text
 * @param {Object} projectMeta - Project metadata (optional)
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<{project: Object, rootNode: Object, nodes: Array}>}
 */
export async function handleSeedSubmit(text, projectMeta = {}, onProgress = null) {
  try {
    // Ensure IndexedDB is initialized
    await initDB();

    // Step 1: Report progress
    onProgress?.({ step: 'summarizing', progress: 0.1, message: 'Analyzing document...' });

    // Step 2: Import and summarize document
    const { project, rootNode, nodes } = await importDocument(text, projectMeta);

    onProgress?.({ step: 'embedding', progress: 0.5, message: 'Generating embeddings...' });

    // Step 3: Attach embeddings and Morton keys
    const nodesWithEmbeddings = await attachEmbeddingsAndKeys(nodes);

    onProgress?.({ step: 'persisting', progress: 0.8, message: 'Saving to database...' });

    // Step 4: Persist to IndexedDB
    await persistProject({ ...project, nodes: nodesWithEmbeddings, rootNode });

    onProgress?.({ step: 'complete', progress: 1.0, message: 'Import complete!' });

    return {
      project,
      rootNode,
      nodes: nodesWithEmbeddings,
    };
  } catch (error) {
    console.error('Import failed:', error);
    throw new Error(`Import failed: ${error.message}`);
  }
}

/**
 * Import a document and create initial fractal structure
 *
 * @param {string} text - Document text
 * @param {Object} projectMeta - Project metadata
 * @returns {Promise<{project: Object, rootNode: Object, nodes: Array}>}
 */
export async function importDocument(text, projectMeta = {}) {
  // Summarize document into 3-7 top-level topics
  const summaryResult = await summarizeDocument(text, { maxTopics: 5 });

  // Create project and root node
  const projectId = generateUUID();
  const rootNodeId = generateUUID();

  const project = {
    id: projectId,
    name: projectMeta.name || 'Untitled Project',
    rootNodeId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta: {
      sourceUrl: projectMeta.sourceUrl || null,
      wordCount: text.split(/\s+/).length,
      charCount: text.length,
      ...projectMeta,
    },
  };

  // Create root node
  const rootNode = {
    id: rootNodeId,
    title: projectMeta.name || 'Document Root',
    text: text.slice(0, 1000), // Store first 1000 chars
    summary: `Document with ${summaryResult.length} main topics`,
    children: [],
    parent: null,
    embedding: null, // Will be set in attachEmbeddingsAndKeys
    hilbertKeyHex: null,
    meta: {
      projectId,
      createdAt: new Date().toISOString(),
      createdBy: 'import',
      depth: 0,
    },
  };

  // Parse summary into child nodes
  const childNodes = parseSummaryToNodes(summaryResult, {
    projectId,
    parentId: rootNodeId,
    depth: 1,
  });

  // Update root node with child IDs
  rootNode.children = childNodes.map((n) => n.id);

  // Return all nodes (root + children)
  const nodes = [rootNode, ...childNodes];

  return {
    project,
    rootNode,
    nodes,
  };
}

/**
 * Parse Summarizer API output into FractalNode objects
 *
 * @param {Array<{title: string, summary: string, keyPoints: string[]}>} summaryResult
 * @param {Object} options - Parsing options
 * @param {string} options.projectId - Project ID
 * @param {string} options.parentId - Parent node ID
 * @param {number} options.depth - Node depth (default: 1)
 * @returns {Array<Object>} - Array of FractalNode objects
 */
export function parseSummaryToNodes(summaryResult, options = {}) {
  const { projectId, parentId, depth = 1 } = options;

  return summaryResult.map((topic) => {
    const nodeId = generateUUID();

    // Combine summary and keyPoints into full text
    const keyPointsText = topic.keyPoints?.length
      ? `\n\nKey Points:\n${topic.keyPoints.map((p) => `- ${p}`).join('\n')}`
      : '';

    return {
      id: nodeId,
      title: topic.title || 'Untitled Topic',
      text: `${topic.summary || ''}${keyPointsText}`.trim(),
      summary: topic.summary || '',
      children: [],
      parent: parentId,
      embedding: null, // Will be set in attachEmbeddingsAndKeys
      hilbertKeyHex: null,
      meta: {
        projectId,
        createdAt: new Date().toISOString(),
        createdBy: 'summarizer',
        depth,
        keyPoints: topic.keyPoints || [],
      },
    };
  });
}

/**
 * Attach embeddings and Morton keys to nodes
 *
 * @param {Array<Object>} nodes - Array of FractalNode objects
 * @returns {Promise<Array<Object>>} - Nodes with embeddings and Morton keys
 */
export async function attachEmbeddingsAndKeys(nodes) {
  // Step 1: Generate embeddings for all nodes
  const texts = nodes.map((node) => `${node.title}. ${node.text}`.slice(0, 2000));
  const embeddings = await batchGenerateEmbeddings(texts);

  // Step 2: Compute quantization parameters from all embeddings
  const quantParams = computeQuantizationParams(
    embeddings.map((e) => Array.from(e)),
    {
      reducedDims: 8,
      bits: 16,
      reduction: 'first',
    }
  );

  // Step 3: Attach embeddings and compute Morton keys
  const nodesWithKeys = nodes.map((node, idx) => {
    const embedding = embeddings[idx];
    const embeddingArray = Array.from(embedding);

    // Compute Morton key
    const mortonKeyHex = computeMortonKeyFromEmbedding(embeddingArray, quantParams);

    return {
      ...node,
      embedding: embeddingArray,
      hilbertKeyHex: mortonKeyHex,
    };
  });

  return nodesWithKeys;
}

/**
 * Persist project and nodes to IndexedDB
 *
 * @param {Object} data - Project data
 * @param {Object} data.project - Project metadata
 * @param {Object} data.rootNode - Root node
 * @param {Array<Object>} data.nodes - All nodes (including root)
 * @returns {Promise<void>}
 */
export async function persistProject(data) {
  const { nodes, rootNode, ...project } = data;

  // Save project metadata as a special node
  const projectNode = {
    id: `project:${project.id}`,
    title: `[PROJECT] ${project.name}`,
    text: JSON.stringify(project),
    summary: `Project: ${project.name}`,
    children: [project.rootNodeId],
    parent: null,
    embedding: null,
    hilbertKeyHex: null,
    meta: {
      type: 'project',
      ...project.meta,
    },
  };

  await saveNode(projectNode);

  // Save all nodes (including rootNode if provided)
  const allNodes = rootNode ? [rootNode, ...nodes] : nodes;
  for (const node of allNodes) {
    await saveNode(node);
  }

  console.log(`Persisted project ${project.id} with ${allNodes.length} nodes`);
}

/**
 * Retrieve a project and its nodes from IndexedDB
 *
 * @param {string} projectId - Project ID
 * @returns {Promise<{project: Object, nodes: Array}>}
 */
export async function loadProject(projectId) {
  const projectNode = await getNode(`project:${projectId}`);

  if (!projectNode) {
    throw new Error(`Project ${projectId} not found`);
  }

  const project = JSON.parse(projectNode.text);
  const rootNode = await getNode(project.rootNodeId);

  if (!rootNode) {
    throw new Error(`Root node ${project.rootNodeId} not found`);
  }

  // Recursively load all child nodes
  const nodes = [];
  const queue = [rootNode];

  while (queue.length > 0) {
    const node = queue.shift();
    nodes.push(node);

    if (node.children && node.children.length > 0) {
      for (const childId of node.children) {
        const child = await getNode(childId);
        if (child) {
          queue.push(child);
        }
      }
    }
  }

  return {
    project,
    rootNode,
    nodes,
  };
}
