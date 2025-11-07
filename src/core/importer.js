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

import { summarizeDocument, batchGenerateEmbeddings, checkAIAvailability } from '../ai/chromeAI.js';
import { mockSummarize, mockEmbeddingFromText } from '../ai/mockHelpers.js';
import {
  initDB,
  saveNode,
  getNode,
  computeQuantizationParams,
  computeMortonKeyFromEmbedding,
} from '../db/fractamind-indexer.js';
import { generateUUID } from '../utils/uuid.js';
import { registerProject } from './projectRegistry.js';
import { addProjectIndex, initFederation } from './federation.js';

// MODULE LOAD VERIFICATION - Force browser to recognize changes
console.log('%c📦 importer.js MODULE LOADED - v3.5 with non-blocking workspace registration', 'background: green; color: white; padding: 4px; font-weight: bold');

// Read timeout from environment (default: 10 minutes for debugging)
const AI_TIMEOUT_MS = Number(import.meta.env.VITE_AI_TIMEOUT_MS || 600000);
console.log(`[IMPORTER] Using AI timeout: ${AI_TIMEOUT_MS}ms (${AI_TIMEOUT_MS/1000}s)`);

/**
 * Watchdog wrapper - ensures promise resolves within timeout or falls back
 * @param {Promise} promise - The promise to watch
 * @param {number} timeoutMs - Max time to wait
 * @param {*} fallbackValue - Value to return on timeout
 * @param {string} operationName - Name for logging
 * @returns {Promise} Resolves with result or fallback
 */
async function withWatchdog(promise, timeoutMs, fallbackValue, operationName) {
  const traceId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  console.info(`[WATCHDOG START] ${operationName}`, { id: traceId, timeoutMs });

  return Promise.race([
    promise.then(result => {
      console.info(`[WATCHDOG SUCCESS] ${operationName}`, { id: traceId });
      return result;
    }),
    new Promise((resolve) => {
      setTimeout(() => {
        console.warn(`[WATCHDOG TIMEOUT] ${operationName} - using fallback`, {
          id: traceId,
          timeoutMs
        });
        resolve(fallbackValue);
      }, timeoutMs);
    })
  ]).catch(error => {
    console.error(`[WATCHDOG ERROR] ${operationName}`, { id: traceId, error: error.message });
    return fallbackValue;
  });
}

/**
 * Main entry point called by ChoreComponent.onSeedSubmit
 *
 * @param {string} text - User-submitted document text
 * @param {Object} projectMeta - Project metadata (optional)
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<{project: Object, rootNode: Object, nodes: Array}>}
 */
export async function handleSeedSubmit(text, projectMeta = {}, onProgress = null) {
  // Validate inputs
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text input: must be a non-empty string');
  }

  if (onProgress !== null && typeof onProgress !== 'function') {
    console.error('[IMPORTER] Invalid onProgress callback:', typeof onProgress, onProgress);
    throw new Error(`Invalid onProgress callback: expected function, got ${typeof onProgress}`);
  }

  try {
    // Ensure IndexedDB is initialized
    console.log('🔵 [IMPORTER] handleSeedSubmit START - initializing DB...');
    await initDB();
    console.log('🔵 [IMPORTER] initDB complete, initializing federation...');

    // CRITICAL FIX: initFederation() can hang indefinitely
    // Make it non-blocking with a 5-second timeout since it's not critical for import
    try {
      await Promise.race([
        initFederation(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Federation init timeout')), 5000))
      ]);
      console.log('🔵 [IMPORTER] initFederation complete');
    } catch (federationError) {
      console.warn('⚠️ [IMPORTER] initFederation failed or timed out (non-critical):', federationError.message);
      console.log('🔵 [IMPORTER] Continuing without federation...');
    }

    // Check if user explicitly requested mock mode (from timeout recovery)
    const forcedMock = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('FORCE_MOCK_MODE') === 'true';
    console.log('📝 [IMPORTER] handleSeedSubmit called', {
      forcedMock,
      sessionStorageValue: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('FORCE_MOCK_MODE') : 'N/A'
    });

    if (forcedMock) {
      console.log('🔴 [IMPORTER] FORCE_MOCK_MODE detected - skipping AI availability check');
      onProgress?.({
        step: 'warning',
        progress: 0.05,
        message: '⚠️ Using mock mode (user requested fast fallback)'
      });
    } else {
      // Check AI availability and warn user if not available
      const availability = checkAIAvailability();
      if (!availability.allAvailable) {
        console.warn('Some Chrome Built-in AI APIs are not available:', availability.missingAPIs);
        console.warn('Falling back to mock mode. For full AI functionality, enable chrome://flags/#optimization-guide-on-device-model');
        onProgress?.({
          step: 'warning',
          progress: 0.05,
          message: `⚠️ AI unavailable - using mock mode (missing: ${availability.missingAPIs.join(', ')}). Results will be deterministic.`
        });
      } else {
        console.log('✅ All Chrome Built-in AI APIs available - using live mode');
        onProgress?.({
          step: 'ai-ready',
          progress: 0.05,
          message: '✅ Chrome AI ready - using live mode'
        });
      }
    }

    // Step 1: Report progress
    onProgress?.({ step: 'summarizing', progress: 0.1, message: 'Analyzing document...' });

    // Step 2: Import and summarize document with timeout
    // UPDATED: Now reads from VITE_AI_TIMEOUT_MS environment variable
    let importResult;
    try {
      importResult = await withTimeout(
        importDocument(text, projectMeta),
        AI_TIMEOUT_MS, // Configurable timeout (default: 600s / 10 minutes)
        `Document summarization timed out after ${AI_TIMEOUT_MS/1000} seconds`
      );
    } catch (error) {
      console.error('Import document failed:', error);
      throw new Error(`Failed to analyze document: ${error.message}`);
    }

    const { project, rootNode, nodes } = importResult;

    onProgress?.({ step: 'embedding', progress: 0.5, message: 'Generating embeddings...' });

    // Step 3: Attach embeddings and Morton keys with timeout
    // UPDATED: Now reads from VITE_AI_TIMEOUT_MS environment variable
    let nodesWithEmbeddings;
    try {
      nodesWithEmbeddings = await withTimeout(
        attachEmbeddingsAndKeys(nodes),
        AI_TIMEOUT_MS, // Configurable timeout (default: 600s / 10 minutes)
        `Embedding generation timed out after ${AI_TIMEOUT_MS/1000} seconds`
      );
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }

    onProgress?.({ step: 'persisting', progress: 0.8, message: 'Saving to database...' });

    // Step 4: Persist to IndexedDB
    await persistProject({ ...project, nodes: nodesWithEmbeddings, rootNode });

    onProgress?.({ step: 'federating', progress: 0.9, message: 'Registering in workspace...' });

    // Step 5: Register project in federation workspace (non-blocking, errors are warnings)
    // CRITICAL FIX: Add 5-second timeout since this can hang indefinitely
    try {
      await Promise.race([
        registerProjectInWorkspace(project, nodesWithEmbeddings, rootNode),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Workspace registration timeout')), 5000))
      ]);
      console.log('✅ [IMPORTER] Workspace registration complete');
    } catch (error) {
      console.warn('⚠️ [IMPORTER] Failed to register in workspace (non-critical):', error.message);
      // Continue - federation failure is non-critical
    }

    onProgress?.({ step: 'complete', progress: 1.0, message: 'Import complete!' });

    return {
      project,
      rootNode,
      nodes: nodesWithEmbeddings,
    };
  } catch (error) {
    console.error('Import failed:', error);
    onProgress?.({ step: 'error', progress: 0, message: error.message });
    throw new Error(`Import failed: ${error.message}`);
  }
}

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMessage - Error message if timeout occurs
 * @returns {Promise} - Promise that rejects if timeout occurs
 */
function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * Import a document and create initial fractal structure
 *
 * @param {string} text - Document text
 * @param {Object} projectMeta - Project metadata
 * @returns {Promise<{project: Object, rootNode: Object, nodes: Array}>}
 */
export async function importDocument(text, projectMeta = {}) {
  // Check if force mock mode is set
  const forcedMock = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('FORCE_MOCK_MODE') === 'true';
  console.log('📝 [IMPORTER] importDocument called', {
    forcedMock,
    sessionStorageValue: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('FORCE_MOCK_MODE') : 'N/A',
    textLength: text.length
  });

  // Summarize document into 3-7 top-level topics
  let summaryResult;

  if (forcedMock) {
    // User explicitly requested mock mode - skip AI entirely
    console.log('📝 [IMPORTER] FORCE_MOCK_MODE detected - using mock summarization directly');
    summaryResult = await mockSummarize(text, { maxTopics: 5 });
    console.log('📝 [IMPORTER] Mock summarization completed (FORCED)');
  } else {
    // Normal flow: try live AI with mock fallback
    console.log('📝 [IMPORTER] Creating mockFallback...');
    const mockFallback = await mockSummarize(text, { maxTopics: 5 });
    console.log('📝 [IMPORTER] mockFallback created, calling summarizeDocument...');

    summaryResult = await withWatchdog(
      summarizeDocument(text, { maxTopics: 5 }),
      17000,
      mockFallback,
      'importDocument.summarize'
    );
    console.log('📝 [IMPORTER] summarizeDocument completed');
  }

  // Extract topics array from result (handles both {summary, topics} and direct array formats)
  const topics = Array.isArray(summaryResult) ? summaryResult : (summaryResult.topics || []);
  const documentSummary = summaryResult.summary || topics[0]?.summary || 'Document summary';

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
      documentSummary, // Store overall summary
      ...projectMeta,
    },
  };

  // Create root node
  const rootNode = {
    id: rootNodeId,
    title: projectMeta.name || 'Document Root',
    text: text.slice(0, 1000), // Store first 1000 chars
    summary: `Document with ${topics.length} main topics`,
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
  const childNodes = parseSummaryToNodes(topics, {
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
  // Check if force mock mode is set
  const forcedMock = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('FORCE_MOCK_MODE') === 'true';

  // Step 1: Generate embeddings for all nodes
  const texts = nodes.map((node) => `${node.title}. ${node.text}`.slice(0, 2000));

  let embeddings;
  if (forcedMock) {
    // User explicitly requested mock mode - skip AI entirely
    console.log('📝 [IMPORTER] FORCE_MOCK_MODE detected - using mock embeddings directly');
    embeddings = await Promise.all(
      texts.map(text => mockEmbeddingFromText(text, 512, 'mock'))
    );
    console.log('📝 [IMPORTER] Mock embeddings generated (FORCED):', embeddings.length);
  } else {
    // Normal flow: try live AI with mock fallback
    const mockEmbeddings = await Promise.all(
      texts.map(text => mockEmbeddingFromText(text, 512, 'mock'))
    );
    embeddings = await withWatchdog(
      batchGenerateEmbeddings(texts),
      20000,
      mockEmbeddings,
      'attachEmbeddingsAndKeys.batch'
    );
  }

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

/**
 * Register project in federation workspace
 * @param {Object} project - Project metadata
 * @param {Array} nodes - Project nodes with embeddings
 * @param {Object} rootNode - Root node
 * @returns {Promise<void>}
 */
async function registerProjectInWorkspace(project, nodes, rootNode) {
  try {
    // Register in project registry
    await registerProject({
      projectId: project.id,
      name: project.name,
      importDate: project.createdAt || new Date().toISOString(),
      rootNodeId: project.rootNodeId || rootNode?.id,
      nodeCount: nodes.length + 1, // +1 for root node
      embeddingCount: nodes.filter(n => n.embedding).length,
      isActive: true,
      weight: 1.0,
      meta: {
        sourceUrl: project.meta?.sourceUrl,
        description: project.description,
        tags: project.meta?.tags || []
      }
    });

    // Add to federated index
    const allNodes = rootNode ? [rootNode, ...nodes] : nodes;
    await addProjectIndex(project.id, allNodes, { recomputeQuant: true });

    console.log(`Registered project ${project.id} in federation workspace`);
  } catch (error) {
    console.warn(`Failed to register project in workspace: ${error.message}`);
    // Don't fail the entire import if federation fails
  }
}
