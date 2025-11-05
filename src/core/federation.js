/**
 * federation.js
 *
 * Federated Index Manager for multi-project workspace.
 * Maintains separate indices for each project while enabling cross-project queries.
 *
 * Architecture:
 * - Each project has its own IndexedDB object store for nodes
 * - Shared quantization parameters computed across all projects
 * - Morton keys enable fast locality-preserving searches per project
 * - Projects can be added, removed, or updated incrementally
 *
 * API:
 * - initFederation() - Initialize federation stores
 * - addProjectIndex(projectId, nodes) - Index nodes for a project
 * - removeProjectIndex(projectId) - Remove project index
 * - updateProjectNodes(projectId, nodesToUpdate) - Incremental update
 * - getProjectNodes(projectId, { limit, offset }) - Retrieve nodes
 * - getAllProjectIds() - List indexed projects
 * - computeGlobalQuantParams(projects) - Compute shared quantization
 * - clearAllIndices() - Reset federation (testing)
 */

import {
  computeQuantizationParams,
  computeMortonKeyFromEmbedding
} from '../db/fractamind-indexer.js';

const DB_NAME = 'fractamind-federation-db';
let DB_VERSION = 2; // Increment to add project stores
const STORE_PREFIX = 'project_';
const STORE_GLOBAL_META = 'federationMeta';

let dbInstance = null;
const projectStores = new Set(); // Track created stores

/**
 * Open federation database
 */
function openFederationDB(projectIds = []) {
  // Increment version if we're adding new stores
  if (projectIds.some(id => !projectStores.has(id))) {
    DB_VERSION++;
  }

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create global metadata store
      if (!db.objectStoreNames.contains(STORE_GLOBAL_META)) {
        const metaStore = db.createObjectStore(STORE_GLOBAL_META, { keyPath: 'key' });
        metaStore.createIndex('byKey', 'key', { unique: true });
      }

      // Create project-specific stores
      for (const projectId of projectIds) {
        const storeName = STORE_PREFIX + projectId;
        if (!db.objectStoreNames.contains(storeName)) {
          const projStore = db.createObjectStore(storeName, { keyPath: 'id' });
          projStore.createIndex('byMorton', 'hilbertKeyHex', { unique: false });
          projStore.createIndex('byTitle', 'title', { unique: false });
          projectStores.add(projectId);
        }
      }
    };

    req.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get or create database instance
 */
async function getDB(projectIds = []) {
  if (!dbInstance || projectIds.some(id => !projectStores.has(id))) {
    // Need to upgrade database to add missing stores
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
    await openFederationDB(projectIds);
  }
  return dbInstance;
}

/**
 * Initialize federation system
 * @returns {Promise<void>}
 */
export async function initFederation() {
  await getDB();
}

/**
 * Store or update global metadata (quantization params, etc.)
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
async function setGlobalMeta(key, value) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_GLOBAL_META], 'readwrite');
    const store = tx.objectStore(STORE_GLOBAL_META);
    const req = store.put({ key, value, updatedAt: new Date().toISOString() });

    req.onsuccess = () => resolve();
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Retrieve global metadata
 * @param {string} key
 * @returns {Promise<*|null>}
 */
async function getGlobalMeta(key) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_GLOBAL_META], 'readonly');
    const store = tx.objectStore(STORE_GLOBAL_META);
    const req = store.get(key);

    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Add or update project index
 * @param {string} projectId
 * @param {Array} nodes - Array of node objects with embeddings
 * @param {Object} options
 * @param {boolean} options.recomputeQuant - Recompute global quantization params
 * @returns {Promise<Object>} - { indexed: number, quantParams: Object }
 */
export async function addProjectIndex(projectId, nodes, { recomputeQuant = true } = {}) {
  if (!projectId || !nodes || nodes.length === 0) {
    throw new Error('projectId and non-empty nodes array required');
  }

  // Ensure database has store for this project
  const db = await getDB([projectId]);

  // Compute or retrieve quantization parameters
  let quantParams;
  if (recomputeQuant) {
    // Extract embeddings from all nodes
    const embeddings = nodes
      .map(n => n.embedding)
      .filter(e => e && e.length > 0);

    if (embeddings.length > 0) {
      quantParams = computeQuantizationParams(embeddings, {
        reducedDims: 8,
        bits: 16,
        reduction: 'first'
      });
      await setGlobalMeta('quantParams', quantParams);
    } else {
      // Try to use existing params
      quantParams = await getGlobalMeta('quantParams');
      if (!quantParams) {
        throw new Error('No embeddings provided and no existing quantization params');
      }
    }
  } else {
    quantParams = await getGlobalMeta('quantParams');
    if (!quantParams) {
      throw new Error('No quantization params available. Set recomputeQuant=true or initialize params first.');
    }
  }

  // Index nodes with Morton keys
  const indexedNodes = nodes.map(node => {
    let hilbertKeyHex = null;
    if (node.embedding && node.embedding.length > 0) {
      hilbertKeyHex = computeMortonKeyFromEmbedding(node.embedding, quantParams);
    }

    return {
      id: node.id,
      title: node.title,
      text: node.text,
      embedding: node.embedding,
      hilbertKeyHex,
      children: node.children || [],
      parent: node.parent || null,
      meta: node.meta || {}
    };
  });

  // Store nodes in project-specific store
  const storeName = STORE_PREFIX + projectId;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);

    let indexed = 0;
    for (const node of indexedNodes) {
      store.put(node);
      indexed++;
    }

    tx.oncomplete = () => resolve({ indexed, quantParams });
    tx.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Remove project index
 * @param {string} projectId
 * @returns {Promise<void>}
 */
export async function removeProjectIndex(projectId) {
  const db = await getDB([projectId]);
  const storeName = STORE_PREFIX + projectId;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();

    req.onsuccess = () => {
      projectStores.delete(projectId);
      resolve();
    };
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Update specific nodes in project index
 * @param {string} projectId
 * @param {Array} nodesToUpdate
 * @returns {Promise<number>} - Number of nodes updated
 */
export async function updateProjectNodes(projectId, nodesToUpdate) {
  const db = await getDB([projectId]);
  const storeName = STORE_PREFIX + projectId;
  const quantParams = await getGlobalMeta('quantParams');

  if (!quantParams) {
    throw new Error('No quantization params available');
  }

  // Recompute Morton keys for nodes with embeddings
  const updatedNodes = nodesToUpdate.map(node => {
    let hilbertKeyHex = node.hilbertKeyHex;
    if (node.embedding && node.embedding.length > 0) {
      hilbertKeyHex = computeMortonKeyFromEmbedding(node.embedding, quantParams);
    }
    return { ...node, hilbertKeyHex };
  });

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);

    let updated = 0;
    for (const node of updatedNodes) {
      store.put(node);
      updated++;
    }

    tx.oncomplete = () => resolve(updated);
    tx.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get nodes from a specific project
 * @param {string} projectId
 * @param {Object} options
 * @param {number} options.limit - Max nodes to return
 * @param {number} options.offset - Skip first N nodes
 * @returns {Promise<Array>}
 */
export async function getProjectNodes(projectId, { limit = 100, offset = 0 } = {}) {
  const db = await getDB([projectId]);
  const storeName = STORE_PREFIX + projectId;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();

    req.onsuccess = () => {
      const nodes = req.result || [];
      const sliced = nodes.slice(offset, offset + limit);
      resolve(sliced);
    };
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get a specific node by ID from a project
 * @param {string} projectId
 * @param {string} nodeId
 * @returns {Promise<Object|null>}
 */
export async function getProjectNode(projectId, nodeId) {
  const db = await getDB([projectId]);
  const storeName = STORE_PREFIX + projectId;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(nodeId);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Search nodes within a project by Morton key range
 * @param {string} projectId
 * @param {string} mortonKeyHex - Center of search
 * @param {string} radiusHex - Search radius
 * @param {Object} options
 * @param {number} options.limit - Max results
 * @returns {Promise<Array>}
 */
export async function searchProjectByMorton(projectId, mortonKeyHex, radiusHex, { limit = 50 } = {}) {
  const db = await getDB([projectId]);
  const storeName = STORE_PREFIX + projectId;

  // Convert hex to BigInt for range computation
  const center = BigInt('0x' + mortonKeyHex);
  const radius = BigInt('0x' + radiusHex);
  const lowerBound = (center - radius).toString(16);
  const upperBound = (center + radius).toString(16);

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index('byMorton');

    const range = IDBKeyRange.bound(lowerBound, upperBound, false, false);
    const req = index.getAll(range, limit);

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get all project IDs that have been indexed
 * @returns {Promise<Array<string>>}
 */
export async function getAllProjectIds() {
  return Array.from(projectStores);
}

/**
 * Compute global quantization parameters across multiple projects
 * @param {Array<Object>} projects - Array of { projectId, nodes }
 * @returns {Promise<Object>} - Quantization params
 */
export async function computeGlobalQuantParams(projects) {
  const allEmbeddings = [];

  for (const { nodes } of projects) {
    for (const node of nodes) {
      if (node.embedding && node.embedding.length > 0) {
        allEmbeddings.push(node.embedding);
      }
    }
  }

  if (allEmbeddings.length === 0) {
    throw new Error('No embeddings found in any project');
  }

  const quantParams = computeQuantizationParams(allEmbeddings, {
    reducedDims: 8,
    bits: 16,
    reduction: 'first'
  });

  await setGlobalMeta('quantParams', quantParams);
  return quantParams;
}

/**
 * Get current quantization parameters
 * @returns {Promise<Object|null>}
 */
export async function getQuantParams() {
  return getGlobalMeta('quantParams');
}

/**
 * Clear all project indices (for testing/reset)
 * @returns {Promise<void>}
 */
export async function clearAllIndices() {
  const projectIds = await getAllProjectIds();

  for (const projectId of projectIds) {
    await removeProjectIndex(projectId);
  }

  // Clear global metadata
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_GLOBAL_META], 'readwrite');
    const store = tx.objectStore(STORE_GLOBAL_META);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get federation statistics
 * @returns {Promise<Object>}
 */
export async function getFederationStats() {
  const projectIds = await getAllProjectIds();
  const quantParams = await getQuantParams();

  let totalNodes = 0;
  for (const projectId of projectIds) {
    const nodes = await getProjectNodes(projectId, { limit: Infinity });
    totalNodes += nodes.length;
  }

  return {
    projectCount: projectIds.length,
    totalNodes,
    hasQuantParams: !!quantParams,
    quantParams: quantParams ? {
      reducedDims: quantParams.reducedDims,
      bits: quantParams.bits,
      reduction: quantParams.reduction
    } : null
  };
}
