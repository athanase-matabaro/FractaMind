/**
 * Tests for federation.js
 *
 * Coverage:
 * - Database initialization
 * - Project index management (add, remove, update)
 * - Node retrieval
 * - Morton key search
 * - Quantization parameter management
 * - Federation statistics
 */

import {
  initFederation,
  addProjectIndex,
  removeProjectIndex,
  updateProjectNodes,
  getProjectNodes,
  getProjectNode,
  searchProjectByMorton,
  getAllProjectIds,
  computeGlobalQuantParams,
  getQuantParams,
  clearAllIndices,
  getFederationStats
} from '../src/core/federation.js';

// Mock dependencies
jest.mock('../src/db/fractamind-indexer.js', () => ({
  computeQuantizationParams: jest.fn((embeddings, options) => ({
    reducedDims: options.reducedDims || 8,
    bits: options.bits || 16,
    mins: new Array(options.reducedDims || 8).fill(-1),
    maxs: new Array(options.reducedDims || 8).fill(1),
    reduction: options.reduction || 'first'
  })),
  computeMortonKeyFromEmbedding: jest.fn((embedding, quantParams) => {
    // Simple mock: hash first few values
    const hash = embedding.slice(0, 4).reduce((a, b) => a + b, 0);
    return Math.abs(hash * 1000).toString(16).padStart(8, '0');
  })
}));

// Mock IndexedDB
const mockStores = new Map(); // projectId -> Map<nodeId, node>
let mockMetaStore = new Map();
let mockDB = null;

const createMockRequest = (result = null) => {
  const request = { result, error: null, onsuccess: null, onerror: null };
  setTimeout(() => {
    if (request.onsuccess) request.onsuccess({ target: request });
  }, 0);
  return request;
};

global.indexedDB = {
  open: jest.fn((name, version) => {
    const request = {
      result: null,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null
    };

    setTimeout(() => {
      mockDB = {
        objectStoreNames: {
          contains: (storeName) => {
            return storeName === 'federationMeta' || storeName.startsWith('project_');
          }
        },
        createObjectStore: jest.fn((storeName, options) => ({
          createIndex: jest.fn()
        })),
        transaction: (storeNames, mode) => {
          const tx = {
            objectStore: (storeName) => {
              if (storeName === 'federationMeta') {
                return {
                  put: (record) => {
                    mockMetaStore.set(record.key, record);
                    return createMockRequest(record.key);
                  },
                  get: (key) => {
                    const record = mockMetaStore.get(key);
                    return createMockRequest(record || null);
                  },
                  clear: () => {
                    mockMetaStore.clear();
                    return createMockRequest();
                  }
                };
              } else if (storeName.startsWith('project_')) {
                const projectId = storeName.replace('project_', '');
                if (!mockStores.has(projectId)) {
                  mockStores.set(projectId, new Map());
                }
                const store = mockStores.get(projectId);

                return {
                  put: (record) => {
                    store.set(record.id, record);
                    return createMockRequest(record.id);
                  },
                  get: (id) => {
                    return createMockRequest(store.get(id) || null);
                  },
                  getAll: () => {
                    return createMockRequest(Array.from(store.values()));
                  },
                  clear: () => {
                    store.clear();
                    return createMockRequest();
                  },
                  index: (indexName) => ({
                    getAll: (range, limit) => {
                      const nodes = Array.from(store.values());
                      return createMockRequest(limit ? nodes.slice(0, limit) : nodes);
                    }
                  })
                };
              }
            },
            oncomplete: null,
            onerror: null
          };

          // Auto-complete transaction
          setTimeout(() => {
            if (tx.oncomplete) tx.oncomplete();
          }, 0);

          return tx;
        },
        close: jest.fn()
      };

      if (request.onupgradeneeded) {
        request.onupgradeneeded({ target: { result: mockDB } });
      }

      request.result = mockDB;
      if (request.onsuccess) request.onsuccess({ target: request });
    }, 0);

    return request;
  })
};

// Sample nodes for testing
const createSampleNodes = (count, projectId) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${projectId}-node-${i}`,
    title: `Node ${i}`,
    text: `Text for node ${i}`,
    embedding: new Array(768).fill(0).map(() => Math.random()),
    children: [],
    parent: null,
    meta: {}
  }));
};

describe('Federation', () => {
  beforeEach(() => {
    mockStores.clear();
    mockMetaStore.clear();
    jest.clearAllMocks();
  });

  describe('initFederation', () => {
    it('should initialize federation database', async () => {
      await initFederation();
      expect(global.indexedDB.open).toHaveBeenCalledWith('fractamind-federation-db', 2);
    });
  });

  describe('addProjectIndex', () => {
    beforeEach(async () => {
      await initFederation();
    });

    it('should add project index with nodes', async () => {
      const nodes = createSampleNodes(5, 'proj-a');

      const result = await addProjectIndex('proj-a', nodes, { recomputeQuant: true });

      expect(result.indexed).toBe(5);
      expect(result.quantParams).toBeDefined();
      expect(result.quantParams.reducedDims).toBe(8);
      expect(result.quantParams.bits).toBe(16);
    });

    it('should compute Morton keys for nodes with embeddings', async () => {
      const nodes = createSampleNodes(3, 'proj-b');

      await addProjectIndex('proj-b', nodes, { recomputeQuant: true });

      const retrievedNodes = await getProjectNodes('proj-b');
      expect(retrievedNodes).toHaveLength(3);
      retrievedNodes.forEach(node => {
        expect(node.hilbertKeyHex).toBeDefined();
        expect(typeof node.hilbertKeyHex).toBe('string');
      });
    });

    it('should throw error for empty nodes array', async () => {
      await expect(
        addProjectIndex('proj-c', [], { recomputeQuant: true })
      ).rejects.toThrow('projectId and non-empty nodes array required');
    });

    it('should throw error for missing projectId', async () => {
      const nodes = createSampleNodes(2, 'proj-d');
      await expect(
        addProjectIndex(null, nodes, { recomputeQuant: true })
      ).rejects.toThrow('projectId and non-empty nodes array required');
    });

    it('should use existing quantParams when recomputeQuant is false', async () => {
      const nodes1 = createSampleNodes(3, 'proj-e');
      await addProjectIndex('proj-e', nodes1, { recomputeQuant: true });

      const nodes2 = createSampleNodes(2, 'proj-f');
      const result = await addProjectIndex('proj-f', nodes2, { recomputeQuant: false });

      expect(result.quantParams).toBeDefined();
      expect(result.indexed).toBe(2);
    });
  });

  describe('removeProjectIndex', () => {
    beforeEach(async () => {
      await initFederation();
      const nodes = createSampleNodes(5, 'proj-g');
      await addProjectIndex('proj-g', nodes, { recomputeQuant: true });
    });

    it('should remove project index', async () => {
      await removeProjectIndex('proj-g');

      const retrievedNodes = await getProjectNodes('proj-g');
      expect(retrievedNodes).toHaveLength(0);
    });

    it('should not throw error for non-existent project', async () => {
      await expect(removeProjectIndex('non-existent')).resolves.not.toThrow();
    });
  });

  describe('updateProjectNodes', () => {
    beforeEach(async () => {
      await initFederation();
      const nodes = createSampleNodes(5, 'proj-h');
      await addProjectIndex('proj-h', nodes, { recomputeQuant: true });
    });

    it('should update specific nodes', async () => {
      const nodesToUpdate = [
        { id: 'proj-h-node-0', title: 'Updated Node 0', text: 'Updated text', embedding: new Array(768).fill(0.5) },
        { id: 'proj-h-node-2', title: 'Updated Node 2', text: 'Updated text', embedding: new Array(768).fill(0.3) }
      ];

      const updated = await updateProjectNodes('proj-h', nodesToUpdate);
      expect(updated).toBe(2);

      const node = await getProjectNode('proj-h', 'proj-h-node-0');
      expect(node.title).toBe('Updated Node 0');
    });

    it('should recompute Morton keys on update', async () => {
      const nodesToUpdate = [
        { id: 'proj-h-node-1', title: 'Node 1', text: 'Text', embedding: new Array(768).fill(0.9) }
      ];

      await updateProjectNodes('proj-h', nodesToUpdate);

      const node = await getProjectNode('proj-h', 'proj-h-node-1');
      expect(node.hilbertKeyHex).toBeDefined();
    });
  });

  describe('getProjectNodes', () => {
    beforeEach(async () => {
      await initFederation();
      const nodes = createSampleNodes(10, 'proj-i');
      await addProjectIndex('proj-i', nodes, { recomputeQuant: true });
    });

    it('should retrieve all nodes by default', async () => {
      const nodes = await getProjectNodes('proj-i');
      expect(nodes).toHaveLength(10);
    });

    it('should respect limit parameter', async () => {
      const nodes = await getProjectNodes('proj-i', { limit: 5 });
      expect(nodes.length).toBeLessThanOrEqual(5);
    });

    it('should respect offset parameter', async () => {
      const allNodes = await getProjectNodes('proj-i');
      const offsetNodes = await getProjectNodes('proj-i', { offset: 3, limit: 5 });

      expect(offsetNodes.length).toBeLessThanOrEqual(5);
      // First node in offset result should be 4th node overall
      if (offsetNodes.length > 0 && allNodes.length > 3) {
        expect(offsetNodes[0].id).toBe(allNodes[3].id);
      }
    });

    it('should return empty array for non-existent project', async () => {
      const nodes = await getProjectNodes('non-existent');
      expect(nodes).toHaveLength(0);
    });
  });

  describe('getProjectNode', () => {
    beforeEach(async () => {
      await initFederation();
      const nodes = createSampleNodes(5, 'proj-j');
      await addProjectIndex('proj-j', nodes, { recomputeQuant: true });
    });

    it('should retrieve specific node by ID', async () => {
      const node = await getProjectNode('proj-j', 'proj-j-node-2');

      expect(node).toBeDefined();
      expect(node.id).toBe('proj-j-node-2');
      expect(node.title).toBe('Node 2');
    });

    it('should return null for non-existent node', async () => {
      const node = await getProjectNode('proj-j', 'non-existent-node');
      expect(node).toBeNull();
    });
  });

  describe('searchProjectByMorton', () => {
    beforeEach(async () => {
      await initFederation();
      const nodes = createSampleNodes(20, 'proj-k');
      await addProjectIndex('proj-k', nodes, { recomputeQuant: true });
    });

    it('should search project by Morton key', async () => {
      const results = await searchProjectByMorton('proj-k', '0000a000', '00001000');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const results = await searchProjectByMorton('proj-k', '0000a000', '00005000', { limit: 5 });
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getAllProjectIds', () => {
    beforeEach(async () => {
      await initFederation();
    });

    it('should return empty array when no projects indexed', async () => {
      const ids = await getAllProjectIds();
      expect(ids).toEqual([]);
    });

    it('should return all indexed project IDs', async () => {
      const nodes1 = createSampleNodes(3, 'proj-l');
      const nodes2 = createSampleNodes(3, 'proj-m');

      await addProjectIndex('proj-l', nodes1, { recomputeQuant: true });
      await addProjectIndex('proj-m', nodes2, { recomputeQuant: false });

      const ids = await getAllProjectIds();
      expect(ids).toContain('proj-l');
      expect(ids).toContain('proj-m');
      expect(ids).toHaveLength(2);
    });
  });

  describe('computeGlobalQuantParams', () => {
    beforeEach(async () => {
      await initFederation();
    });

    it('should compute quantization parameters from multiple projects', async () => {
      const projects = [
        { projectId: 'proj-n', nodes: createSampleNodes(5, 'proj-n') },
        { projectId: 'proj-o', nodes: createSampleNodes(5, 'proj-o') }
      ];

      const quantParams = await computeGlobalQuantParams(projects);

      expect(quantParams.reducedDims).toBe(8);
      expect(quantParams.bits).toBe(16);
      expect(quantParams.mins).toHaveLength(8);
      expect(quantParams.maxs).toHaveLength(8);
    });

    it('should throw error for projects with no embeddings', async () => {
      const projects = [
        { projectId: 'proj-p', nodes: [{ id: 'n1', title: 'Node 1', text: 'Text' }] }
      ];

      await expect(computeGlobalQuantParams(projects)).rejects.toThrow(
        'No embeddings found in any project'
      );
    });
  });

  describe('getQuantParams', () => {
    beforeEach(async () => {
      await initFederation();
    });

    it('should return null when no params set', async () => {
      const params = await getQuantParams();
      expect(params).toBeNull();
    });

    it('should return params after indexing', async () => {
      const nodes = createSampleNodes(3, 'proj-q');
      await addProjectIndex('proj-q', nodes, { recomputeQuant: true });

      const params = await getQuantParams();
      expect(params).toBeDefined();
      expect(params.reducedDims).toBe(8);
    });
  });

  describe('getFederationStats', () => {
    beforeEach(async () => {
      await initFederation();
    });

    it('should return stats for empty federation', async () => {
      const stats = await getFederationStats();

      expect(stats.projectCount).toBe(0);
      expect(stats.totalNodes).toBe(0);
      expect(stats.hasQuantParams).toBe(false);
      expect(stats.quantParams).toBeNull();
    });

    it('should return correct stats for indexed projects', async () => {
      const nodes1 = createSampleNodes(10, 'proj-r');
      const nodes2 = createSampleNodes(15, 'proj-s');

      await addProjectIndex('proj-r', nodes1, { recomputeQuant: true });
      await addProjectIndex('proj-s', nodes2, { recomputeQuant: false });

      const stats = await getFederationStats();

      expect(stats.projectCount).toBe(2);
      expect(stats.totalNodes).toBe(25);
      expect(stats.hasQuantParams).toBe(true);
      expect(stats.quantParams.reducedDims).toBe(8);
    });
  });

  describe('clearAllIndices', () => {
    beforeEach(async () => {
      await initFederation();
      const nodes1 = createSampleNodes(5, 'proj-t');
      const nodes2 = createSampleNodes(5, 'proj-u');
      await addProjectIndex('proj-t', nodes1, { recomputeQuant: true });
      await addProjectIndex('proj-u', nodes2, { recomputeQuant: false });
    });

    it('should clear all project indices', async () => {
      await clearAllIndices();

      const ids = await getAllProjectIds();
      expect(ids).toHaveLength(0);
    });

    it('should clear quantization params', async () => {
      await clearAllIndices();

      const params = await getQuantParams();
      expect(params).toBeNull();
    });
  });
});
