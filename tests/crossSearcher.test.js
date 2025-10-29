/**
 * Tests for crossSearcher.js - FIXED VERSION
 */

import {
  crossProjectSearch,
  searchWithinProject
} from '../src/core/crossSearcher.js';

// Mock all dependencies
jest.mock('../src/ai/chromeAI.js', () => ({
  generateEmbedding: jest.fn(async () => new Array(768).fill(0.5))
}));

jest.mock('../src/db/fractamind-indexer.js', () => ({
  computeMortonKeyFromEmbedding: jest.fn(() => '0000a000')
}));

jest.mock('../src/core/federation.js', () => ({
  getQuantParams: jest.fn(async () => ({
    reducedDims: 8,
    bits: 16,
    mins: [-1, -1, -1, -1, -1, -1, -1, -1],
    maxs: [1, 1, 1, 1, 1, 1, 1, 1],
    reduction: 'first'
  })),
  searchProjectByMorton: jest.fn(async () => [
    {
      id: 'node-1',
      title: 'Test Node 1',
      text: 'Test text 1',
      embedding: new Array(768).fill(0.8)
    },
    {
      id: 'node-2',
      title: 'Test Node 2',
      text: 'Test text 2',
      embedding: new Array(768).fill(0.7)
    }
  ]),
  getProjectNodes: jest.fn(async () => [
    {
      id: 'node-1',
      title: 'Node 1',
      text: 'Text 1',
      embedding: new Array(768).fill(0.6)
    }
  ])
}));

jest.mock('../src/core/projectRegistry.js', () => ({
  listProjects: jest.fn(async () => [
    {
      projectId: 'proj-1',
      name: 'Project 1',
      isActive: true,
      weight: 1.0,
      lastAccessed: new Date().toISOString()
    },
    {
      projectId: 'proj-2',
      name: 'Project 2',
      isActive: true,
      weight: 1.5,
      lastAccessed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]),
  getProject: jest.fn(async (id) => ({
    projectId: id,
    name: `Project ${id}`,
    isActive: true,
    weight: 1.0,
    lastAccessed: new Date().toISOString()
  })),
  touchProject: jest.fn(async () => {})
}));

describe('CrossSearcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('crossProjectSearch should return results', async () => {
    const results = await crossProjectSearch('test query', { topK: 10 });
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  test('results should have required fields', async () => {
    const results = await crossProjectSearch('test', { topK: 5 });
    
    if (results.length > 0) {
      const result = results[0];
      expect(result).toHaveProperty('projectId');
      expect(result).toHaveProperty('nodeId');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('finalScore');
    }
  });

  test('should respect topK parameter', async () => {
    const results = await crossProjectSearch('test', { topK: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test('should sort by finalScore', async () => {
    const results = await crossProjectSearch('test', { topK: 10 });
    
    for (let i = 1; i < results.length; i++) {
      expect(results[i-1].finalScore).toBeGreaterThanOrEqual(results[i].finalScore);
    }
  });

  test('should apply project weights', async () => {
    const results = await crossProjectSearch('test', {
      topK: 10,
      applyWeights: true
    });
    
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r.projectWeight).toBeDefined();
    });
  });

  test('should apply freshness boost', async () => {
    const results = await crossProjectSearch('test', {
      topK: 10,
      applyFreshness: true
    });
    
    results.forEach(r => {
      expect(r.freshnessBoost).toBeDefined();
      expect(r.freshnessBoost).toBeGreaterThanOrEqual(1.0);
      expect(r.freshnessBoost).toBeLessThanOrEqual(1.2);
    });
  });

  test('should filter by similarity threshold', async () => {
    const results = await crossProjectSearch('test', { topK: 20 });
    
    results.forEach(r => {
      expect(r.rawSimilarity).toBeGreaterThan(0.1);
    });
  });

  test('should generate snippets', async () => {
    const results = await crossProjectSearch('test', { topK: 5 });
    
    results.forEach(r => {
      expect(r.snippet).toBeDefined();
      expect(typeof r.snippet).toBe('string');
    });
  });

  test('should call progress callback', async () => {
    const onProgress = jest.fn();
    
    await crossProjectSearch('test', {
      topK: 5,
      onProgress
    });
    
    expect(onProgress).toHaveBeenCalled();
  });

  test('searchWithinProject should work', async () => {
    const results = await searchWithinProject('proj-1', 'test', { topK: 5 });
    
    expect(Array.isArray(results)).toBe(true);
    results.forEach(r => {
      expect(r.projectId).toBe('proj-1');
    });
  });
});
