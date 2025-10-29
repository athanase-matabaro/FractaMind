/**
 * Memory Core — Contextual Memory Layer for FractaMind
 *
 * Records user interactions (search, expand, rewrite, edit, etc.) with timestamps,
 * embeddings, and metadata. Provides temporal context for semantic suggestions.
 *
 * Storage: IndexedDB object store 'memory'
 * Privacy: All data stored locally, never sent to servers
 */

import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'fractamind';
const MEMORY_STORE = 'memory';
const DB_VERSION = 2; // Incremented from existing version

let db = null;

/**
 * Initialize memory database
 * Creates 'memory' object store with indexes if not exists
 */
export async function initMemoryDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create memory store if it doesn't exist
      if (!database.objectStoreNames.contains(MEMORY_STORE)) {
        const memoryStore = database.createObjectStore(MEMORY_STORE, { keyPath: 'id' });

        // Create indexes for efficient querying
        memoryStore.createIndex('byAt', 'at', { unique: false });
        memoryStore.createIndex('byNodeId', 'nodeId', { unique: false });
        memoryStore.createIndex('byActionType', 'actionType', { unique: false });
      }
    };
  });
}

/**
 * Encode Float32Array to base64 string for storage
 */
function encodeEmbedding(embedding) {
  if (!embedding) return null;

  const arr = embedding instanceof Float32Array ? embedding : new Float32Array(embedding);
  const uint8 = new Uint8Array(arr.buffer);

  // Convert to base64
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

/**
 * Decode base64 string back to Float32Array
 */
function decodeEmbedding(base64) {
  if (!base64) return null;

  const binary = atob(base64);
  const uint8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    uint8[i] = binary.charCodeAt(i);
  }

  return new Float32Array(uint8.buffer);
}

/**
 * Record a user interaction
 *
 * @param {Object} options
 * @param {string} options.nodeId - Node ID (null for global actions like search)
 * @param {string} options.actionType - One of: 'view', 'search', 'expand', 'rewrite', 'edit', 'export', 'import'
 * @param {Array<number>|Float32Array} options.embedding - Optional embedding vector
 * @param {Object} options.meta - Free-form metadata (queryText, rewriteOptions, source, etc.)
 * @returns {Promise<{id: string, at: string}>} Record ID and timestamp
 */
export async function recordInteraction({ nodeId = null, actionType, embedding = null, meta = {} }) {
  if (!db) {
    await initMemoryDB();
  }

  const validActionTypes = ['view', 'search', 'expand', 'rewrite', 'edit', 'export', 'import'];
  if (!validActionTypes.includes(actionType)) {
    throw new Error(`Invalid actionType: ${actionType}. Must be one of: ${validActionTypes.join(', ')}`);
  }

  const id = uuidv4();
  const at = new Date().toISOString();

  const record = {
    id,
    nodeId,
    actionType,
    at,
    embedding: encodeEmbedding(embedding),
    meta: meta || {},
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MEMORY_STORE], 'readwrite');
    const store = transaction.objectStore(MEMORY_STORE);
    const request = store.add(record);

    request.onsuccess = () => resolve({ id, at });
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get recent interactions
 *
 * @param {Object} options
 * @param {number} options.limit - Maximum number of records to return
 * @param {Object} options.filter - Filter criteria { actionType, nodeId }
 * @returns {Promise<Array<Object>>} Array of interaction records (newest first)
 */
export async function getRecentInteractions({ limit = 100, filter = {} } = {}) {
  if (!db) {
    await initMemoryDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MEMORY_STORE], 'readonly');
    const store = transaction.objectStore(MEMORY_STORE);

    let request;

    // Use appropriate index if filter is provided
    if (filter.actionType) {
      const index = store.index('byActionType');
      request = index.getAll(filter.actionType);
    } else if (filter.nodeId) {
      const index = store.index('byNodeId');
      request = index.getAll(filter.nodeId);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      let results = request.result;

      // Apply additional filters
      if (filter.actionType && filter.nodeId) {
        results = results.filter(r => r.nodeId === filter.nodeId);
      }

      // Sort by timestamp (newest first)
      results.sort((a, b) => new Date(b.at) - new Date(a.at));

      // Decode embeddings
      results = results.map(r => ({
        ...r,
        embedding: decodeEmbedding(r.embedding),
      }));

      // Apply limit
      if (limit) {
        results = results.slice(0, limit);
      }

      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get interactions for a specific node
 *
 * @param {string} nodeId - Node ID
 * @param {Object} options
 * @param {number} options.limit - Maximum number of records
 * @returns {Promise<Array<Object>>} Array of interaction records for the node
 */
export async function getInteractionsForNode(nodeId, { limit = 50 } = {}) {
  return getRecentInteractions({ limit, filter: { nodeId } });
}

/**
 * Purge old memory records
 *
 * @param {Object} options
 * @param {number} options.olderThanMs - Delete records older than this many milliseconds
 * @returns {Promise<number>} Number of records deleted
 */
export async function purgeMemory({ olderThanMs }) {
  if (!db) {
    await initMemoryDB();
  }

  const cutoffDate = new Date(Date.now() - olderThanMs);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MEMORY_STORE], 'readwrite');
    const store = transaction.objectStore(MEMORY_STORE);

    // Get all records
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
      const records = getAllRequest.result;
      let deleteCount = 0;
      let pending = 0;

      records.forEach(record => {
        if (new Date(record.at) < cutoffDate) {
          pending++;
          const deleteRequest = store.delete(record.id);

          deleteRequest.onsuccess = () => {
            deleteCount++;
            pending--;
            if (pending === 0) {
              resolve(deleteCount);
            }
          };

          deleteRequest.onerror = () => {
            pending--;
            if (pending === 0) {
              resolve(deleteCount);
            }
          };
        }
      });

      // If no records to delete
      if (pending === 0) {
        resolve(0);
      }
    };

    getAllRequest.onerror = () => reject(getAllRequest.error);
  });
}

/**
 * Get memory statistics
 *
 * @returns {Promise<Object>} Statistics about stored memory
 */
export async function getMemoryStats() {
  if (!db) {
    await initMemoryDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MEMORY_STORE], 'readonly');
    const store = transaction.objectStore(MEMORY_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result;

      const stats = {
        totalRecords: records.length,
        oldestRecord: records.length > 0 ? Math.min(...records.map(r => new Date(r.at).getTime())) : null,
        newestRecord: records.length > 0 ? Math.max(...records.map(r => new Date(r.at).getTime())) : null,
        byActionType: {},
      };

      // Count by action type
      records.forEach(r => {
        stats.byActionType[r.actionType] = (stats.byActionType[r.actionType] || 0) + 1;
      });

      resolve(stats);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all memory records (dangerous - use for testing only)
 *
 * @returns {Promise<void>}
 */
export async function clearAllMemory() {
  if (!db) {
    await initMemoryDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MEMORY_STORE], 'readwrite');
    const store = transaction.objectStore(MEMORY_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
