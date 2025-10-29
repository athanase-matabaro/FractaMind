/**
 * Shared test utilities and mocks
 */

// Mock IDBKeyRange for tests
global.IDBKeyRange = {
  bound: (lower, upper, lowerOpen, upperOpen) => ({
    lower,
    upper,
    lowerOpen: !!lowerOpen,
    upperOpen: !!upperOpen
  }),
  only: (value) => ({ lower: value, upper: value }),
  lowerBound: (lower, open) => ({ lower, lowerOpen: !!open }),
  upperBound: (upper, open) => ({ upper, upperOpen: !!open })
};

/**
 * Create a mock IndexedDB request
 */
export const createMockRequest = (result = null, error = null) => {
  const request = {
    result,
    error,
    onsuccess: null,
    onerror: null
  };

  setTimeout(() => {
    if (error) {
      if (request.onerror) request.onerror({ target: request });
    } else {
      if (request.onsuccess) request.onsuccess({ target: request });
    }
  }, 0);

  return request;
};

/**
 * Create a mock IndexedDB database
 */
export const createMockDB = (stores = {}) => {
  return {
    objectStoreNames: {
      contains: (storeName) => Object.keys(stores).includes(storeName)
    },
    createObjectStore: jest.fn((storeName, options) => ({
      createIndex: jest.fn()
    })),
    transaction: (storeNames, mode) => {
      const tx = {
        objectStore: (storeName) => {
          if (!stores[storeName]) {
            stores[storeName] = new Map();
          }
          const store = stores[storeName];

          return {
            put: (record) => {
              const key = record.id || record.projectId || record.key;
              store.set(key, record);
              return createMockRequest(key);
            },
            get: (key) => {
              return createMockRequest(store.get(key) || null);
            },
            getAll: () => {
              return createMockRequest(Array.from(store.values()));
            },
            delete: (key) => {
              store.delete(key);
              return createMockRequest();
            },
            clear: () => {
              store.clear();
              return createMockRequest();
            },
            index: (indexName) => ({
              getAll: (value, limit) => {
                let results = Array.from(store.values());

                // Filter by index value if provided
                if (value !== undefined && indexName === 'byActive') {
                  results = results.filter(r => r.isActive === value);
                } else if (value !== undefined && indexName === 'byMorton') {
                  // Range filtering for Morton keys
                  if (value.lower !== undefined && value.upper !== undefined) {
                    results = results.filter(r => {
                      if (!r.hilbertKeyHex) return false;
                      return r.hilbertKeyHex >= value.lower && r.hilbertKeyHex <= value.upper;
                    });
                  }
                }

                // Apply limit
                if (limit) {
                  results = results.slice(0, limit);
                }

                return createMockRequest(results);
              }
            })
          };
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
};

/**
 * Setup global IndexedDB mock
 */
export const setupIndexedDBMock = () => {
  const stores = {};

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
        const mockDB = createMockDB(stores);

        if (request.onupgradeneeded) {
          request.onupgradeneeded({ target: { result: mockDB } });
        }

        request.result = mockDB;
        if (request.onsuccess) request.onsuccess({ target: request });
      }, 0);

      return request;
    })
  };

  return stores;
};

/**
 * Create sample embedding vector
 */
export const createEmbedding = (seed = 0, dimensions = 768) => {
  return new Array(dimensions).fill(0).map((_, i) => Math.sin((seed + i) / 100));
};

/**
 * Create sample node
 */
export const createSampleNode = (id, options = {}) => ({
  id,
  title: options.title || `Node ${id}`,
  text: options.text || `Text for node ${id}`,
  embedding: options.embedding || createEmbedding(id.charCodeAt(0)),
  children: options.children || [],
  parent: options.parent || null,
  meta: options.meta || {}
});

/**
 * Create sample project
 */
export const createSampleProject = (projectId, options = {}) => ({
  projectId,
  name: options.name || `Project ${projectId}`,
  importDate: options.importDate || new Date().toISOString(),
  rootNodeId: options.rootNodeId || `${projectId}-root`,
  nodeCount: options.nodeCount || 10,
  embeddingCount: options.embeddingCount || 8,
  lastAccessed: options.lastAccessed || new Date().toISOString(),
  isActive: options.isActive !== undefined ? options.isActive : true,
  weight: options.weight || 1.0,
  meta: options.meta || {}
});

/**
 * Wait for async operations
 */
export const waitFor = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock console methods
 */
export const mockConsole = () => {
  const originalConsole = { ...console };

  beforeEach(() => {
    global.console = {
      ...console,
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  });

  afterEach(() => {
    global.console = originalConsole;
  });
};
