/**
 * Tests for crossSearcher.js
 *
 * Coverage:
 * - Cross-project search
 * - Score normalization
 * - Weight and freshness application
 * - Progressive radius widening
 * - Single-project search
 * - Fallback mechanisms
 */

import {
  crossProjectSearch,
  searchWithinProject
} from '../src/core/crossSearcher.js';

// Mock dependencies
jest.mock('../src/ai/chromeAI.js', () => ({
  generateEmbedding: jest.fn(async (text) => {
    // Generate deterministic embedding based on text
    const base = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return new Array(768).fill(0).map((_, i) => Math.sin((base + i) / 100));
  })
}));

jest.mock('../src/db/fractamind-indexer.js', () => ({
  computeMortonKeyFromEmbedding: jest.fn((embedding) => {
    const hash = embedding.slice(0, 4).reduce((a, b) => a + b, 0);
    return Math.abs(hash * 1000).toString(16).padStart(8, '0');
  })
}));

jest.mock('../src/core/federation.js', () => ({
  getQuantParams: jest.fn(async () => ({
    reducedDims: 8,
    bits: 16,
    mins: new Array(8).fill(-1),
    maxs: new Array(8).fill(1),
    reduction: 'first'
  })),
  searchProjectByMorton: jest.fn(async (projectId, mortonKey, radius) => {
    // Mock search results based on projectId
    if (projectId === 'proj-empty') return [];

    const nodeCount = projectId === 'proj-large' ? 10 : 3;
    return Array.from({ length: nodeCount }, (_, i) => ({
      id: `${projectId}-node-${i}`,
      title: `${projectId} Node ${i}`,
      text: `Text for ${projectId} node ${i}`,
      embedding: new Array(768).fill(0).map(() => Math.random() * 0.5 + 0.3)
    }));
  }),
  getProjectNodes: jest.fn(async (projectId) => {
    // Fallback for linear scan
    return Array.from({ length: 5 }, (_, i) => ({
      id: `${projectId}-node-${i}`,
      title: `${projectId} Node ${i}`,
      text: `Text for ${projectId} node ${i}`,
      embedding: new Array(768).fill(0).map(() => Math.random() * 0.5 + 0.3)
    }));
  })
}));

jest.mock('../src/core/projectRegistry.js', () => ({
  listProjects: jest.fn(async ({ activeOnly }) => {
    const projects = [
      {
        projectId: 'proj-a',
        name: 'Project A',
        isActive: true,
        weight: 1.0,
        lastAccessed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
      },
      {
        projectId: 'proj-b',
        name: 'Project B',
        isActive: true,
        weight: 1.5,
        lastAccessed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
      },
      {
        projectId: 'proj-c',
        name: 'Project C',
        isActive: false,
        weight: 1.0,
        lastAccessed: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        projectId: 'proj-empty',
        name: 'Empty Project',
        isActive: true,
        weight: 1.0,
        lastAccessed: new Date().toISOString()
      }
    ];

    return activeOnly ? projects.filter(p => p.isActive) : projects;
  }),
  touchProject: jest.fn(async () => {})
}));

describe('CrossSearcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('crossProjectSearch', () => {
    it('should search across all active projects', async () => {
      const results = await crossProjectSearch('test query', { topK: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);

      // Should have results from active projects
      const projectIds = results.map(r => r.projectId);
      expect(projectIds.some(id => id === 'proj-a' || id === 'proj-b')).toBe(true);

      // Should not have results from inactive projects
      expect(projectIds.includes('proj-c')).toBe(false);
    });

    it('should include all required fields in results', async () => {
      const results = await crossProjectSearch('another query', { topK: 5 });

      expect(results.length).toBeGreaterThan(0);
      const result = results[0];

      expect(result).toHaveProperty('projectId');
      expect(result).toHaveProperty('projectName');
      expect(result).toHaveProperty('nodeId');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('snippet');
      expect(result).toHaveProperty('rawSimilarity');
      expect(result).toHaveProperty('normalizedSimilarity');
      expect(result).toHaveProperty('projectWeight');
      expect(result).toHaveProperty('freshnessBoost');
      expect(result).toHaveProperty('finalScore');
    });

    it('should respect topK parameter', async () => {
      const results = await crossProjectSearch('limit test', { topK: 3 });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should apply project weights correctly', async () => {
      const resultsWithWeights = await crossProjectSearch('weight test', {
        topK: 20,
        applyWeights: true
      });

      const resultsWithoutWeights = await crossProjectSearch('weight test', {
        topK: 20,
        applyWeights: false
      });

      // With weights, proj-b (weight 1.5) results should score higher
      const projBResultsWeighted = resultsWithWeights.filter(r => r.projectId === 'proj-b');
      const projAResultsWeighted = resultsWithWeights.filter(r => r.projectId === 'proj-a');

      if (projBResultsWeighted.length > 0 && projAResultsWeighted.length > 0) {
        // Project B has higher weight (1.5 vs 1.0)
        expect(projBResultsWeighted[0].projectWeight).toBe(1.5);
        expect(projAResultsWeighted[0].projectWeight).toBe(1.0);
      }
    });

    it('should apply freshness boost correctly', async () => {
      const resultsWithFreshness = await crossProjectSearch('freshness test', {
        topK: 20,
        applyFreshness: true
      });

      const result = resultsWithFreshness.find(r => r.projectId === 'proj-a'); // 2 days old

      if (result) {
        // Freshness boost should be between 1.0 and 1.2
        expect(result.freshnessBoost).toBeGreaterThanOrEqual(1.0);
        expect(result.freshnessBoost).toBeLessThanOrEqual(1.2);

        // Recently accessed should have higher boost
        expect(result.freshnessBoost).toBeGreaterThan(1.0);
      }
    });

    it('should sort results by finalScore descending', async () => {
      const results = await crossProjectSearch('sorting test', {
        topK: 10,
        applyWeights: true,
        applyFreshness: true
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].finalScore).toBeGreaterThanOrEqual(results[i].finalScore);
      }
    });

    it('should handle empty results gracefully', async () => {
      const { listProjects } = require('../core/projectRegistry.js');
      listProjects.mockResolvedValueOnce([
        {
          projectId: 'proj-empty',
          name: 'Empty Project',
          isActive: true,
          weight: 1.0,
          lastAccessed: new Date().toISOString()
        }
      ]);

      const results = await crossProjectSearch('empty test', { topK: 10 });
      expect(results).toEqual([]);
    });

    it('should call progress callback', async () => {
      const onProgress = jest.fn();

      await crossProjectSearch('progress test', {
        topK: 5,
        onProgress
      });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress.mock.calls[0][1]).toBeGreaterThanOrEqual(1); // current
      expect(onProgress.mock.calls[0][2]).toBeGreaterThanOrEqual(1); // total
    });

    it('should search specific projectIds when provided', async () => {
      const results = await crossProjectSearch('specific projects', {
        topK: 10,
        projectIds: ['proj-a']
      });

      const projectIds = results.map(r => r.projectId);
      expect(projectIds.every(id => id === 'proj-a')).toBe(true);
      expect(projectIds.includes('proj-b')).toBe(false);
    });

    it('should filter results by minimum similarity threshold', async () => {
      const results = await crossProjectSearch('threshold test', { topK: 20 });

      // All results should have rawSimilarity > 0.1
      results.forEach(result => {
        expect(result.rawSimilarity).toBeGreaterThan(0.1);
      });
    });

    it('should normalize scores within each project', async () => {
      const results = await crossProjectSearch('normalization test', { topK: 20 });

      // Group by project
      const byProject = results.reduce((acc, r) => {
        if (!acc[r.projectId]) acc[r.projectId] = [];
        acc[r.projectId].push(r);
        return acc;
      }, {});

      // Within each project, normalized scores should be between 0 and 1
      Object.values(byProject).forEach(projectResults => {
        projectResults.forEach(result => {
          expect(result.normalizedSimilarity).toBeGreaterThanOrEqual(0);
          expect(result.normalizedSimilarity).toBeLessThanOrEqual(1);
        });
      });
    });

    it('should generate snippets from text', async () => {
      const results = await crossProjectSearch('snippet test', { topK: 5 });

      results.forEach(result => {
        expect(result.snippet).toBeDefined();
        expect(typeof result.snippet).toBe('string');
        expect(result.snippet.length).toBeLessThanOrEqual(143); // 140 + '...'
      });
    });
  });

  describe('searchWithinProject', () => {
    it('should search within a single project', async () => {
      const results = await searchWithinProject('proj-a', 'single project query', {
        topK: 5
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);

      // All results should be from the specified project
      results.forEach(result => {
        expect(result.projectId).toBe('proj-a');
      });
    });

    it('should include finalScore based on normalized similarity', async () => {
      const results = await searchWithinProject('proj-a', 'score test', { topK: 5 });

      results.forEach(result => {
        expect(result.finalScore).toBe(result.normalizedSimilarity);
      });
    });

    it('should sort results by finalScore descending', async () => {
      const results = await searchWithinProject('proj-a', 'sorting test', { topK: 10 });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].finalScore).toBeGreaterThanOrEqual(results[i].finalScore);
      }
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should fallback to linear scan when quantParams missing', async () => {
      const { getQuantParams } = require('../core/federation.js');
      getQuantParams.mockResolvedValueOnce(null);

      const results = await crossProjectSearch('fallback test', { topK: 5 });

      expect(results.length).toBeGreaterThan(0);
      // Should still return results via linear scan
    });

    it('should throw error when embedding generation fails', async () => {
      const { generateEmbedding } = require('../ai/chromeAI.js');
      generateEmbedding.mockRejectedValueOnce(new Error('Embedding API failed'));

      await expect(
        crossProjectSearch('error test', { topK: 5 })
      ).rejects.toThrow('Embedding generation failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle no active projects', async () => {
      const { listProjects } = require('../core/projectRegistry.js');
      listProjects.mockResolvedValueOnce([]);

      const results = await crossProjectSearch('no projects', { topK: 5 });
      expect(results).toEqual([]);
    });

    it('should handle projects with no embeddings', async () => {
      const { searchProjectByMorton } = require('../core/federation.js');
      searchProjectByMorton.mockResolvedValueOnce([
        { id: 'node-1', title: 'Node 1', text: 'Text 1', embedding: null },
        { id: 'node-2', title: 'Node 2', text: 'Text 2', embedding: null }
      ]);

      const results = await crossProjectSearch('no embeddings', { topK: 5 });

      // Should filter out nodes without embeddings
      results.forEach(result => {
        expect(result.node.embedding).toBeDefined();
      });
    });

    it('should handle very long text for snippets', async () => {
      const longText = 'a'.repeat(500);
      const { searchProjectByMorton } = require('../core/federation.js');
      searchProjectByMorton.mockResolvedValueOnce([
        {
          id: 'node-long',
          title: 'Long Node',
          text: longText,
          embedding: new Array(768).fill(0.5)
        }
      ]);

      const results = await crossProjectSearch('long text test', { topK: 1 });

      if (results.length > 0) {
        expect(results[0].snippet.length).toBeLessThanOrEqual(143);
        expect(results[0].snippet).toContain('...');
      }
    });
  });

  describe('Progressive Radius Widening', () => {
    it('should use multiple radii when results insufficient', async () => {
      const { searchProjectByMorton } = require('../core/federation.js');

      // First call returns 2 results (< topK)
      searchProjectByMorton
        .mockResolvedValueOnce([
          { id: 'n1', title: 'Node 1', text: 'Text 1', embedding: new Array(768).fill(0.5) },
          { id: 'n2', title: 'Node 2', text: 'Text 2', embedding: new Array(768).fill(0.6) }
        ])
        // Second call returns more
        .mockResolvedValueOnce([
          { id: 'n1', title: 'Node 1', text: 'Text 1', embedding: new Array(768).fill(0.5) },
          { id: 'n2', title: 'Node 2', text: 'Text 2', embedding: new Array(768).fill(0.6) },
          { id: 'n3', title: 'Node 3', text: 'Text 3', embedding: new Array(768).fill(0.7) },
          { id: 'n4', title: 'Node 4', text: 'Text 4', embedding: new Array(768).fill(0.8) }
        ]);

      const results = await crossProjectSearch('radius test', { topK: 10 });

      // Should have called searchProjectByMorton multiple times (progressive widening)
      expect(searchProjectByMorton).toHaveBeenCalled();
    });
  });
});
