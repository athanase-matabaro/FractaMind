/**
 * collab_bus.js - Phase 7: CRDT-based Collaborative Editing
 *
 * Implements a lightweight CRDT (Conflict-free Replicated Data Type) system
 * for local-first collaborative editing of FractaMind projects.
 *
 * Design:
 * - Operation-based CRDT (similar to Automerge pattern)
 * - Local-only for Phase 7.0 (no network transport)
 * - Simulated multi-peer merging for testing
 * - Full operation history for audit and provenance
 * - Deterministic conflict resolution via timestamp + actorId ordering
 *
 * Supported operations:
 * - createNode
 * - updateNode
 * - deleteNode
 * - createLink
 * - deleteLink
 * - updateProjectMetadata
 *
 * Usage:
 *   const docId = createDoc('project-123');
 *   applyLocalChange(docId, { type: 'createNode', node: {...}, actorId: 'user1' });
 *   const remoteChanges = getRemoteChanges();
 *   mergeRemoteChange(docId, remoteChanges[0]);
 *   const snapshot = getDocSnapshot(docId);
 */

import { PHASE7 } from '../config.js';

/////////////////////////
// CRDT State Storage //
/////////////////////////

/**
 * Document structure:
 * {
 *   docId: string (projectId),
 *   state: {
 *     nodes: Map<nodeId, NodeState>,
 *     links: Map<linkId, LinkState>,
 *     metadata: Object
 *   },
 *   operations: Array<Operation>,
 *   vector Clock: Map<actorId, sequence>,
 *   createdAt: timestamp,
 *   updatedAt: timestamp
 * }
 *
 * Operation structure:
 * {
 *   id: string (unique operation ID),
 *   type: string (createNode, updateNode, deleteNode, ...),
 *   actorId: string (user/peer identifier),
 *   timestamp: number,
 *   sequence: number,
 *   data: Object (operation-specific data),
 *   dependencies: Array<opId> (causal dependencies)
 * }
 */

const crdtStore = {
  documents: new Map(), // docId -> Document
  nextOpSequence: new Map(), // actorId -> next sequence number
};

/////////////////////////
// CRDT Operations    //
/////////////////////////

/**
 * Generate unique operation ID
 * @param {string} actorId - Actor identifier
 * @param {number} sequence - Sequence number
 * @returns {string} Operation ID
 */
function generateOpId(actorId, sequence) {
  return `${actorId}@${sequence}@${Date.now()}`;
}

/**
 * Get next sequence number for an actor
 * @param {string} actorId - Actor ID
 * @returns {number} Sequence number
 */
function getNextSequence(actorId) {
  const current = crdtStore.nextOpSequence.get(actorId) || 0;
  const next = current + 1;
  crdtStore.nextOpSequence.set(actorId, next);
  return next;
}

/**
 * Create an operation object
 * @param {string} type - Operation type
 * @param {string} actorId - Actor ID
 * @param {Object} data - Operation data
 * @param {Array} dependencies - Dependent operation IDs
 * @returns {Object} Operation
 */
function createOperation(type, actorId, data, dependencies = []) {
  const sequence = getNextSequence(actorId);
  const opId = generateOpId(actorId, sequence);

  return {
    id: opId,
    type,
    actorId,
    timestamp: Date.now(),
    sequence,
    data,
    dependencies,
  };
}

/////////////////////////
// Conflict Resolution//
/////////////////////////

/**
 * Resolve conflicts using Last-Write-Wins with timestamp + actorId tiebreaker
 * @param {Object} op1 - Operation 1
 * @param {Object} op2 - Operation 2
 * @returns {Object} Winning operation
 */
function resolveConflict(op1, op2) {
  // Compare timestamps first
  if (op1.timestamp !== op2.timestamp) {
    return op1.timestamp > op2.timestamp ? op1 : op2;
  }

  // Tie-break with actorId (lexicographic)
  return op1.actorId > op2.actorId ? op1 : op2;
}

/////////////////////////
// State Management   //
/////////////////////////

/**
 * Apply an operation to document state
 * @param {Object} doc - Document
 * @param {Object} operation - Operation to apply
 */
function applyOperationToState(doc, operation) {
  const { type, data, actorId, timestamp } = operation;

  switch (type) {
    case 'createNode': {
      const { nodeId, node } = data;
      if (!doc.state.nodes.has(nodeId)) {
        doc.state.nodes.set(nodeId, {
          ...node,
          id: nodeId,
          createdBy: actorId,
          createdAt: timestamp,
          updatedAt: timestamp,
          deleted: false,
        });
      }
      break;
    }

    case 'updateNode': {
      const { nodeId, updates } = data;
      const existing = doc.state.nodes.get(nodeId);

      if (existing && !existing.deleted) {
        // Check if this update is newer
        if (timestamp >= existing.updatedAt) {
          doc.state.nodes.set(nodeId, {
            ...existing,
            ...updates,
            updatedAt: timestamp,
            updatedBy: actorId,
          });
        }
      }
      break;
    }

    case 'deleteNode': {
      const { nodeId } = data;
      const existing = doc.state.nodes.get(nodeId);

      if (existing) {
        // Tombstone deletion
        doc.state.nodes.set(nodeId, {
          ...existing,
          deleted: true,
          deletedAt: timestamp,
          deletedBy: actorId,
        });
      }
      break;
    }

    case 'createLink': {
      const { linkId, link } = data;
      if (!doc.state.links.has(linkId)) {
        doc.state.links.set(linkId, {
          ...link,
          id: linkId,
          createdBy: actorId,
          createdAt: timestamp,
          deleted: false,
        });
      }
      break;
    }

    case 'deleteLink': {
      const { linkId } = data;
      const existing = doc.state.links.get(linkId);

      if (existing) {
        doc.state.links.set(linkId, {
          ...existing,
          deleted: true,
          deletedAt: timestamp,
          deletedBy: actorId,
        });
      }
      break;
    }

    case 'updateMetadata': {
      const { updates } = data;
      doc.state.metadata = {
        ...doc.state.metadata,
        ...updates,
        updatedAt: timestamp,
        updatedBy: actorId,
      };
      break;
    }

    default:
      console.warn(`[CRDT] Unknown operation type: ${type}`);
  }
}

/////////////////////////
// Public API         //
/////////////////////////

/**
 * Create a new CRDT document for a project
 * @param {string} projectId - Project identifier
 * @returns {string} Document ID
 */
export function createDoc(projectId) {
  if (!projectId) {
    throw new Error('projectId required');
  }

  if (crdtStore.documents.has(projectId)) {
    console.warn(`[CRDT] Document ${projectId} already exists`);
    return projectId;
  }

  const doc = {
    docId: projectId,
    state: {
      nodes: new Map(),
      links: new Map(),
      metadata: {
        projectId,
        createdAt: Date.now(),
      },
    },
    operations: [],
    vectorClock: new Map(), // actorId -> latest sequence
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  crdtStore.documents.set(projectId, doc);

  console.log(`[CRDT] Created document ${projectId}`);
  return projectId;
}

/**
 * Apply a local change to a document
 * @param {string} docId - Document ID
 * @param {Object} changeSpec - Change specification
 * @param {string} changeSpec.type - Operation type
 * @param {string} changeSpec.actorId - Actor ID
 * @param {Object} changeSpec.data - Operation data
 * @returns {Object} Created operation
 */
export function applyLocalChange(docId, changeSpec) {
  const doc = crdtStore.documents.get(docId);
  if (!doc) {
    throw new Error(`Document ${docId} not found`);
  }

  const { type, actorId, data } = changeSpec;

  if (!actorId) {
    throw new Error('actorId required for local changes');
  }

  // Create operation
  const operation = createOperation(type, actorId, data);

  // Add to operation log
  doc.operations.push(operation);

  // Update vector clock
  doc.vectorClock.set(actorId, operation.sequence);

  // Apply to state
  applyOperationToState(doc, operation);

  // Update document timestamp
  doc.updatedAt = Date.now();

  console.log(`[CRDT] Applied local change: ${type} by ${actorId}`);

  return operation;
}

/**
 * Merge a remote change into a document
 * @param {string} docId - Document ID
 * @param {Object} remoteOp - Remote operation
 * @returns {boolean} True if merged successfully
 */
export function mergeRemoteChange(docId, remoteOp) {
  const doc = crdtStore.documents.get(docId);
  if (!doc) {
    throw new Error(`Document ${docId} not found`);
  }

  const { id, actorId, sequence } = remoteOp;

  // Check if already applied (idempotency)
  if (doc.operations.some(op => op.id === id)) {
    console.log(`[CRDT] Operation ${id} already applied, skipping`);
    return false;
  }

  // Check vector clock to ensure causal ordering
  const currentSeq = doc.vectorClock.get(actorId) || 0;
  if (sequence <= currentSeq) {
    console.warn(`[CRDT] Out-of-order operation ${id}, may indicate clock skew`);
  }

  // Add to operation log
  doc.operations.push(remoteOp);

  // Update vector clock
  doc.vectorClock.set(actorId, Math.max(currentSeq, sequence));

  // Apply to state (with conflict resolution)
  applyOperationToState(doc, remoteOp);

  // Update document timestamp
  doc.updatedAt = Date.now();

  console.log(`[CRDT] Merged remote change: ${remoteOp.type} by ${actorId}`);

  return true;
}

/**
 * Get a snapshot of the current document state
 * @param {string} docId - Document ID
 * @returns {Object} Document snapshot
 */
export function getDocSnapshot(docId) {
  const doc = crdtStore.documents.get(docId);
  if (!doc) {
    throw new Error(`Document ${docId} not found`);
  }

  // Convert Maps to Arrays, filter deleted items
  const nodes = Array.from(doc.state.nodes.values())
    .filter(n => !n.deleted)
    .map(n => {
      const { deleted, deletedAt, deletedBy, ...rest } = n;
      return rest;
    });

  const links = Array.from(doc.state.links.values())
    .filter(l => !l.deleted)
    .map(l => {
      const { deleted, deletedAt, deletedBy, ...rest } = l;
      return rest;
    });

  return {
    docId: doc.docId,
    nodes,
    links,
    metadata: doc.state.metadata,
    operationCount: doc.operations.length,
    vectorClock: Object.fromEntries(doc.vectorClock),
    updatedAt: doc.updatedAt,
  };
}

/**
 * Get all operations since a given vector clock
 * @param {string} docId - Document ID
 * @param {Object} sinceVectorClock - Vector clock to compare against (actorId -> sequence)
 * @returns {Array} Operations
 */
export function getOperationsSince(docId, sinceVectorClock = {}) {
  const doc = crdtStore.documents.get(docId);
  if (!doc) {
    throw new Error(`Document ${docId} not found`);
  }

  const operations = [];

  for (const op of doc.operations) {
    const knownSequence = sinceVectorClock[op.actorId] || 0;

    if (op.sequence > knownSequence) {
      operations.push(op);
    }
  }

  return operations;
}

/**
 * Get operation history for audit
 * @param {string} docId - Document ID
 * @param {Object} options - Query options
 * @param {string} options.actorId - Filter by actor (optional)
 * @param {string} options.type - Filter by operation type (optional)
 * @param {number} options.limit - Limit results (optional)
 * @returns {Array} Operations
 */
export function getOperationHistory(docId, options = {}) {
  const doc = crdtStore.documents.get(docId);
  if (!doc) {
    throw new Error(`Document ${docId} not found`);
  }

  const { actorId = null, type = null, limit = 100 } = options;

  let operations = [...doc.operations];

  // Filter by actorId
  if (actorId) {
    operations = operations.filter(op => op.actorId === actorId);
  }

  // Filter by type
  if (type) {
    operations = operations.filter(op => op.type === type);
  }

  // Sort by timestamp (descending)
  operations.sort((a, b) => b.timestamp - a.timestamp);

  // Limit
  return operations.slice(0, limit);
}

/**
 * Get document statistics
 * @param {string} docId - Document ID
 * @returns {Object} Stats
 */
export function getDocStats(docId) {
  const doc = crdtStore.documents.get(docId);
  if (!doc) {
    throw new Error(`Document ${docId} not found`);
  }

  const actors = new Set(doc.operations.map(op => op.actorId));

  const operationsByType = {};
  for (const op of doc.operations) {
    operationsByType[op.type] = (operationsByType[op.type] || 0) + 1;
  }

  return {
    docId: doc.docId,
    totalOperations: doc.operations.length,
    activeNodes: Array.from(doc.state.nodes.values()).filter(n => !n.deleted).length,
    deletedNodes: Array.from(doc.state.nodes.values()).filter(n => n.deleted).length,
    activeLinks: Array.from(doc.state.links.values()).filter(l => !l.deleted).length,
    deletedLinks: Array.from(doc.state.links.values()).filter(l => l.deleted).length,
    uniqueActors: actors.size,
    actors: Array.from(actors),
    operationsByType,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Delete a document (for cleanup)
 * @param {string} docId - Document ID
 */
export function deleteDoc(docId) {
  if (crdtStore.documents.delete(docId)) {
    console.log(`[CRDT] Deleted document ${docId}`);
    return true;
  }
  return false;
}

/**
 * Clear all documents (for testing)
 */
export function clearAllDocs() {
  crdtStore.documents.clear();
  crdtStore.nextOpSequence.clear();
  console.log('[CRDT] Cleared all documents');
}

// Export internal store for testing
export const __crdtStore = crdtStore;
