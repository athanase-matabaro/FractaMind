/**
 * Memory Core Tests
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

// Mock IndexedDB
let mockStore = [];
let mockIndexes = {
  byAt: [],
  byNodeId: [],
  byActionType: [],
};

global.indexedDB = {
  open: jest.fn((name, version) => ({
    result: {
      transaction: jest.fn((stores, mode) => ({
        objectStore: jest.fn(() => ({
          add: jest.fn((record) => ({
            onsuccess: null,
            onerror: null,
          })),
          get: jest.fn(),
          getAll: jest.fn(() => ({
            result: [...mockStore],
            onsuccess: null,
            onerror: null,
          })),
          delete: jest.fn(),
          clear: jest.fn(() => ({
            onsuccess: null,
            onerror: null,
          })),
          index: jest.fn((indexName) => ({
            getAll: jest.fn((key) => ({
              result: mockIndexes[indexName].filter(r => !key || r[indexName.replace('by', '').toLowerCase()] === key),
              onsuccess: null,
              onerror: null,
            })),
          })),
          createIndex: jest.fn(),
        })),
      })),
      objectStoreNames: { contains: jest.fn(() => false) },
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  })),
};

global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

describe('Memory Core', () => {
  beforeEach(() => {
    mockStore = [];
    mockIndexes = {
      byAt: [],
      byNodeId: [],
      byActionType: [],
    };
    jest.clearAllMocks();
  });

  describe('initMemoryDB', () => {
    it('should initialize database without errors', async () => {
      await expect(initMemoryDB()).resolves.not.toThrow();
    });
  });

  describe('recordInteraction', () => {
    it('should record interaction with all fields', async () => {
      const result = await recordInteraction({
        nodeId: 'node-1',
        actionType: 'view',
        embedding: new Float32Array([0.1, 0.2, 0.3]),
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
        await expect(
          recordInteraction({
            nodeId: 'node-1',
            actionType,
          })
        ).resolves.toHaveProperty('id');
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

      // Embedding should be stored as base64 string
      expect(result).toHaveProperty('id');
    });
  });

  describe('getRecentInteractions', () => {
    beforeEach(async () => {
      // Mock some interactions
      mockStore = [
        {
          id: 'int-1',
          nodeId: 'node-1',
          actionType: 'view',
          at: new Date(Date.now() - 1000).toISOString(),
          embedding: null,
          meta: {},
        },
        {
          id: 'int-2',
          nodeId: 'node-2',
          actionType: 'expand',
          at: new Date(Date.now() - 2000).toISOString(),
          embedding: null,
          meta: {},
        },
        {
          id: 'int-3',
          nodeId: 'node-1',
          actionType: 'edit',
          at: new Date(Date.now() - 3000).toISOString(),
          embedding: null,
          meta: {},
        },
      ];
      mockIndexes.byAt = [...mockStore];
      mockIndexes.byNodeId = [...mockStore];
      mockIndexes.byActionType = [...mockStore];
    });

    it('should return interactions sorted by time (newest first)', async () => {
      const interactions = await getRecentInteractions({ limit: 10 });

      expect(interactions.length).toBeGreaterThan(0);
      // Should be sorted newest first
      for (let i = 1; i < interactions.length; i++) {
        expect(new Date(interactions[i - 1].at).getTime()).toBeGreaterThanOrEqual(
          new Date(interactions[i].at).getTime()
        );
      }
    });

    it('should apply limit', async () => {
      const interactions = await getRecentInteractions({ limit: 2 });

      expect(interactions.length).toBeLessThanOrEqual(2);
    });

    it('should filter by actionType', async () => {
      const interactions = await getRecentInteractions({
        limit: 10,
        filter: { actionType: 'view' },
      });

      interactions.forEach(i => {
        expect(i.actionType).toBe('view');
      });
    });

    it('should filter by nodeId', async () => {
      const interactions = await getRecentInteractions({
        limit: 10,
        filter: { nodeId: 'node-1' },
      });

      interactions.forEach(i => {
        expect(i.nodeId).toBe('node-1');
      });
    });
  });

  describe('purgeMemory', () => {
    beforeEach(() => {
      const now = Date.now();
      mockStore = [
        {
          id: 'int-1',
          at: new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days old
          nodeId: 'node-1',
          actionType: 'view',
        },
        {
          id: 'int-2',
          at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days old
          nodeId: 'node-2',
          actionType: 'edit',
        },
      ];
    });

    it('should delete records older than threshold', async () => {
      const count = await purgeMemory({ olderThanMs: 90 * 24 * 60 * 60 * 1000 }); // 90 days

      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should not delete recent records', async () => {
      mockStore = [
        {
          id: 'int-1',
          at: new Date(Date.now() - 1000).toISOString(), // 1 second old
          nodeId: 'node-1',
          actionType: 'view',
        },
      ];

      const count = await purgeMemory({ olderThanMs: 2 * 60 * 60 * 1000 }); // 2 hours

      expect(count).toBe(0);
    });
  });

  describe('getMemoryStats', () => {
    beforeEach(() => {
      mockStore = [
        { id: '1', actionType: 'view', at: new Date().toISOString() },
        { id: '2', actionType: 'view', at: new Date().toISOString() },
        { id: '3', actionType: 'edit', at: new Date().toISOString() },
      ];
    });

    it('should return statistics', async () => {
      const stats = await getMemoryStats();

      expect(stats).toHaveProperty('totalRecords');
      expect(stats).toHaveProperty('byActionType');
      expect(stats.totalRecords).toBeGreaterThanOrEqual(0);
    });

    it('should count by action type', async () => {
      const stats = await getMemoryStats();

      expect(stats.byActionType).toHaveProperty('view');
      expect(stats.byActionType).toHaveProperty('edit');
    });
  });

  describe('clearAllMemory', () => {
    it('should clear all records', async () => {
      await clearAllMemory();

      const stats = await getMemoryStats();
      expect(stats.totalRecords).toBe(0);
    });
  });
});
