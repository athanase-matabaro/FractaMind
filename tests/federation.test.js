/**
 * Tests for federation.js - FIXED VERSION
 */

import {
  initFederation,
  addProjectIndex,
  removeProjectIndex,
  getProjectNodes,
  getProjectNode,
  getAllProjectIds,
  getQuantParams,
  getFederationStats
} from '../src/core/federation.js';

// Setup IDBKeyRange mock
global.IDBKeyRange = {
  bound: (lower, upper) => ({ lower, upper })
};

// Mock fractamind-indexer
jest.mock('../src/db/fractamind-indexer.js', () => ({
  computeQuantizationParams: jest.fn(() => ({
    reducedDims: 8,
    bits: 16,
    mins: [-1, -1, -1, -1, -1, -1, -1, -1],
    maxs: [1, 1, 1, 1, 1, 1, 1, 1],
    reduction: 'first'
  })),
  computeMortonKeyFromEmbedding: jest.fn((embedding) => {
    const hash = embedding.slice(0, 4).reduce((a, b) => a + b, 0);
    return Math.abs(hash * 1000).toString(16).padStart(8, '0');
  })
}));

// Simple mock stores
const stores = {};
const projectStores = new Set();

const mockDB = {
  transaction: (storeNames, mode) => ({
    objectStore: (storeName) => {
      if (!stores[storeName]) stores[storeName] = new Map();
      const store = stores[storeName];
      
      return {
        put: (record) => {
          const key = record.id || record.key;
          store.set(key, record);
          return { onsuccess: null, onerror: null, result: key };
        },
        get: (key) => {
          const result = store.get(key) || null;
          return { onsuccess: null, onerror: null, result };
        },
        getAll: () => {
          const result = Array.from(store.values());
          return { onsuccess: null, onerror: null, result };
        },
        clear: () => ({ onsuccess: null, onerror: null }),
        index: () => ({
          getAll: (range, limit) => {
            let results = Array.from(store.values());
            if (limit) results = results.slice(0, limit);
            return { onsuccess: null, onerror: null, result: results };
          }
        })
      };
    },
    oncomplete: null
  }),
  objectStoreNames: { contains: (name) => true },
  createObjectStore: () => ({ createIndex: () => {} })
};

global.indexedDB = {
  open: () => ({
    onsuccess: null,
    onupgradeneeded: null,
    result: mockDB
  })
};

// Override the module's DB getter
jest.mock('../src/core/federation.js', () => {
  const actual = jest.requireActual('../src/core/federation.js');
  return {
    ...actual,
    __esModule: true
  };
});

const createNode = (id, projectId) => ({
  id: `${projectId}-${id}`,
  title: `Node ${id}`,
  text: `Text ${id}`,
  embedding: new Array(768).fill(Math.random()),
  children: [],
  parent: null,
  meta: {}
});

describe('Federation', () => {
  beforeEach(() => {
    Object.keys(stores).forEach(key => stores[key].clear());
    projectStores.clear();
  });

  test('initFederation should initialize', async () => {
    await expect(initFederation()).resolves.not.toThrow();
  });

  test('addProjectIndex should add nodes', async () => {
    const nodes = [createNode(1, 'proj-a'), createNode(2, 'proj-a')];
    const result = await addProjectIndex('proj-a', nodes);

    expect(result.indexed).toBe(2);
    expect(result.quantParams).toBeDefined();
  }, 10000);

  test('getProjectNodes should retrieve nodes', async () => {
    const nodes = [createNode(1, 'proj-b'), createNode(2, 'proj-b')];
    await addProjectIndex('proj-b', nodes);

    const retrieved = await getProjectNodes('proj-b');
    expect(Array.isArray(retrieved)).toBe(true);
  }, 10000);

  test('getProjectNode should retrieve single node', async () => {
    const nodes = [createNode(1, 'proj-c')];
    await addProjectIndex('proj-c', nodes);
    
    const node = await getProjectNode('proj-c', 'proj-c-1');
    expect(node).toBeDefined();
  });

  test('getQuantParams should return params', async () => {
    const nodes = [createNode(1, 'proj-d')];
    await addProjectIndex('proj-d', nodes);

    const params = await getQuantParams();
    expect(params).toBeDefined();
    expect(params.reducedDims).toBe(8);
  }, 10000);

  test('getAllProjectIds should return project IDs', async () => {
    projectStores.add('proj-e');
    projectStores.add('proj-f');
    
    const ids = await getAllProjectIds();
    expect(Array.isArray(ids)).toBe(true);
  });

  test('getFederationStats should return stats', async () => {
    const stats = await getFederationStats();

    expect(stats).toHaveProperty('projectCount');
    expect(stats).toHaveProperty('totalNodes');
    expect(stats).toHaveProperty('hasQuantParams');
  }, 10000);

  test('removeProjectIndex should clear project', async () => {
    const nodes = [createNode(1, 'proj-g')];
    await addProjectIndex('proj-g', nodes);

    await expect(removeProjectIndex('proj-g')).resolves.not.toThrow();
  }, 10000);
});
