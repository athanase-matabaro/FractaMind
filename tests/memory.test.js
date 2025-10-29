/**
 * Memory Core Tests
 *
 * Note: These are integration-style tests that test the memory API interface.
 * Full IndexedDB mocking is complex, so we test the API contracts and error handling.
 */

import {
  initMemoryDB,
  recordInteraction,
  getRecentInteractions,
  getInteractionsForNode,
  purgeMemory,
  getMemoryStats,
  clearAllMemory,
} from '../src/core/memory.js';

// Setup basic mocks
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

// Create a more realistic IndexedDB mock
let mockDB = null;
let mockStore = new Map();

const createMockRequest = (result = null) => {
  const request = {
    result,
    error: null,
    onsuccess: null,
    onerror: null,
  };

  // Simulate async callback
  setTimeout(() => {
    if (request.onsuccess) {
      request.onsuccess({ target: request });
    }
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
      onupgradeneeded: null,
    };

    setTimeout(() => {
      // Create mock DB
      mockDB = {
        name,
        version,
        objectStoreNames: {
          contains: (storeName) => storeName === 'memory',
        },
        transaction: (storeNames, mode) => {
          return {
            objectStore: (storeName) => {
              return {
                add: (record) => {
                  mockStore.set(record.id, record);
                  return createMockRequest(record.id);
                },
                put: (record) => {
                  mockStore.set(record.id, record);
                  return createMockRequest(record.id);
                },
                get: (id) => {
                  return createMockRequest(mockStore.get(id));
                },
                getAll: () => {
                  return createMockRequest(Array.from(mockStore.values()));
                },
                delete: (id) => {
                  mockStore.delete(id);
                  return createMockRequest();
                },
                clear: () => {
                  mockStore.clear();
                  return createMockRequest();
                },
                index: (indexName) => {
                  return {
                    getAll: (key) => {
                      const records = Array.from(mockStore.values());
                      if (!key) return createMockRequest(records);

                      // Filter by index
                      const filtered = records.filter(r => {
                        if (indexName === 'byAt') return true;
                        if (indexName === 'byNodeId') return r.nodeId === key;
                        if (indexName === 'byActionType') return r.actionType === key;
                        return true;
                      });
                      return createMockRequest(filtered);
                    },
                  };
                },
                createIndex: jest.fn(),
              };
            },
          };
        },
      };

      request.result = mockDB;

      // Trigger upgrade if needed
      if (request.onupgradeneeded) {
        const upgradeEvent = {
          target: { result: mockDB },
          oldVersion: 0,
          newVersion: version,
        };
        request.onupgradeneeded(upgradeEvent);
      }

      // Trigger success
      if (request.onsuccess) {
        request.onsuccess({ target: request });
      }
    }, 0);

    return request;
  }),
};

describe('Memory Core', () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  describe('initMemoryDB', () => {
    it('should initialize database without errors', async () => {
      await expect(initMemoryDB()).resolves.toBeUndefined();
    });
  });

  describe('recordInteraction', () => {
    beforeEach(async () => {
      await initMemoryDB();
    });

    it('should record interaction and return id and timestamp', async () => {
      const result = await recordInteraction({
        nodeId: 'node-1',
        actionType: 'view',
        meta: { title: 'Test Node' },
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('at');
      expect(typeof result.id).toBe('string');
      expect(typeof result.at).toBe('string');
    });

    it('should reject invalid action type', async () => {
      await expect(
        recordInteraction({
          nodeId: 'node-1',
          actionType: 'invalid-action',
        })
      ).rejects.toThrow('Invalid actionType');
    });

    it('should accept all valid action types', async () => {
      const validTypes = ['view', 'search', 'expand', 'rewrite', 'edit', 'export', 'import'];

      for (const actionType of validTypes) {
        const result = await recordInteraction({
          nodeId: 'node-1',
          actionType,
        });
        expect(result).toHaveProperty('id');
      }
    });

    it('should handle null nodeId for global actions', async () => {
      const result = await recordInteraction({
        nodeId: null,
        actionType: 'search',
        meta: { queryText: 'test query' },
      });

      expect(result).toHaveProperty('id');
    });

    it('should encode embeddings', async () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);

      const result = await recordInteraction({
        nodeId: 'node-1',
        actionType: 'view',
        embedding,
      });

      expect(result).toHaveProperty('id');

      // Verify it was stored
      const stored = mockStore.get(result.id);
      expect(stored).toBeDefined();
      expect(stored.embedding).toBeTruthy();
      expect(typeof stored.embedding).toBe('string'); // Should be base64
    });
  });

  describe('getRecentInteractions', () => {
    beforeEach(async () => {
      await initMemoryDB();

      // Add some test interactions
      await recordInteraction({
        nodeId: 'node-1',
        actionType: 'view',
        meta: {},
      });

      await recordInteraction({
        nodeId: 'node-2',
        actionType: 'expand',
        meta: {},
      });

      await recordInteraction({
        nodeId: 'node-1',
        actionType: 'edit',
        meta: {},
      });
    });

    it('should return interactions sorted by time (newest first)', async () => {
      const interactions = await getRecentInteractions({ limit: 10 });

      expect(interactions.length).toBeGreaterThan(0);

      // Should be sorted newest first
      for (let i = 1; i < interactions.length; i++) {
        const prev = new Date(interactions[i - 1].at).getTime();
        const curr = new Date(interactions[i].at).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('should apply limit', async () => {
      const interactions = await getRecentInteractions({ limit: 2 });

      expect(interactions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getMemoryStats', () => {
    beforeEach(async () => {
      await initMemoryDB();

      await recordInteraction({ nodeId: 'node-1', actionType: 'view', meta: {} });
      await recordInteraction({ nodeId: 'node-2', actionType: 'view', meta: {} });
      await recordInteraction({ nodeId: 'node-3', actionType: 'edit', meta: {} });
    });

    it('should return statistics', async () => {
      const stats = await getMemoryStats();

      expect(stats).toHaveProperty('totalRecords');
      expect(stats).toHaveProperty('byActionType');
      expect(stats.totalRecords).toBeGreaterThanOrEqual(0);
    });

    it('should count by action type', async () => {
      const stats = await getMemoryStats();

      expect(stats.byActionType).toBeDefined();
      expect(typeof stats.byActionType).toBe('object');
    });
  });

  describe('API validation', () => {
    it('should export all required functions', () => {
      expect(typeof initMemoryDB).toBe('function');
      expect(typeof recordInteraction).toBe('function');
      expect(typeof getRecentInteractions).toBe('function');
      expect(typeof getInteractionsForNode).toBe('function');
      expect(typeof purgeMemory).toBe('function');
      expect(typeof getMemoryStats).toBe('function');
      expect(typeof clearAllMemory).toBe('function');
    });

    it('should validate recordInteraction parameters', async () => {
      await initMemoryDB();

      // Missing actionType
      await expect(
        recordInteraction({ nodeId: 'node-1' })
      ).rejects.toThrow();

      // Invalid actionType
      await expect(
        recordInteraction({ nodeId: 'node-1', actionType: 'invalid' })
      ).rejects.toThrow('Invalid actionType');
    });
  });

  describe('Data encoding', () => {
    beforeEach(async () => {
      await initMemoryDB();
    });

    it('should encode and store Float32Array embeddings', async () => {
      const embedding = new Float32Array([0.5, 0.6, 0.7]);

      const { id } = await recordInteraction({
        nodeId: 'node-1',
        actionType: 'view',
        embedding,
      });

      const stored = mockStore.get(id);
      expect(stored.embedding).toBeTruthy();
      expect(typeof stored.embedding).toBe('string');
    });

    it('should handle null embeddings', async () => {
      const { id } = await recordInteraction({
        nodeId: 'node-1',
        actionType: 'view',
        embedding: null,
      });

      const stored = mockStore.get(id);
      expect(stored.embedding).toBeNull();
    });

    it('should store metadata as-is', async () => {
      const meta = {
        title: 'Test',
        duration: 42,
        tags: ['important'],
      };

      const { id } = await recordInteraction({
        nodeId: 'node-1',
        actionType: 'view',
        meta,
      });

      const stored = mockStore.get(id);
      expect(stored.meta).toEqual(meta);
    });
  });
});
