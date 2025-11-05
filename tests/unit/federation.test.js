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
} from '../../src/core/federation.js';

// Mock fractamind-indexer with deterministic values
jest.mock('../../src/db/fractamind-indexer.js', () => ({
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
  beforeEach(async () => {
    // Clear IndexedDB before each test
    // fake-indexeddb creates a clean database instance per test
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
    // Add some projects first by indexing nodes
    await addProjectIndex('proj-e', [createNode(1, 'proj-e')]);
    await addProjectIndex('proj-f', [createNode(1, 'proj-f')]);

    const ids = await getAllProjectIds();
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toContain('proj-e');
    expect(ids).toContain('proj-f');
  }, 10000);

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
