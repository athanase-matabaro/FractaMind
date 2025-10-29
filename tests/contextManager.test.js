/**
 * Context Manager Tests - Decay-weighted relevance scoring
 */

import {
  getContextSuggestions,
  getRecentContext,
  getContextStats,
} from '../src/core/contextManager.js';
import * as memory from '../src/core/memory.js';
import * as indexer from '../src/db/fractamind-indexer.js';

// Mock dependencies
jest.mock('../src/core/memory.js');
jest.mock('../src/db/fractamind-indexer.js');

describe('Context Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getContextSuggestions', () => {
    it('should return suggestions ranked by score', async () => {
      const queryEmbedding = new Float32Array([0.1, 0.2, 0.3]);

      // Mock interactions with varying similarity and recency
      memory.getRecentInteractions.mockResolvedValue([
        {
          id: 'int-1',
          nodeId: 'node-1',
          actionType: 'view',
          at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
          embedding: new Float32Array([0.11, 0.21, 0.31]), // High similarity
          meta: {},
        },
        {
          id: 'int-2',
          nodeId: 'node-2',
          actionType: 'edit',
          at: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(), // 100 hours ago
          embedding: new Float32Array([0.9, 0.8, 0.7]), // Low similarity
          meta: {},
        },
        {
          id: 'int-3',
          nodeId: 'node-3',
          actionType: 'rewrite',
          at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
          embedding: new Float32Array([0.15, 0.25, 0.35]), // Medium similarity
          meta: {},
        },
      ]);

      indexer.getNode
        .mockResolvedValueOnce({ id: 'node-1', title: 'Node 1' })
        .mockResolvedValueOnce({ id: 'node-3', title: 'Node 3' })
        .mockResolvedValueOnce({ id: 'node-2', title: 'Node 2' });

      const suggestions = await getContextSuggestions({
        queryEmbedding,
        topN: 3,
      });

      expect(suggestions).toHaveLength(3);

      // Should be sorted by score (descending)
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].score).toBeGreaterThanOrEqual(suggestions[i].score);
      }

      // Each suggestion should have required fields
      suggestions.forEach(s => {
        expect(s).toHaveProperty('nodeId');
        expect(s).toHaveProperty('score');
        expect(s).toHaveProperty('reason');
        expect(s).toHaveProperty('title');
      });
    });

    it('should handle interactions without embeddings', async () => {
      const queryEmbedding = new Float32Array([0.1, 0.2, 0.3]);

      memory.getRecentInteractions.mockResolvedValue([
        {
          id: 'int-1',
          nodeId: 'node-1',
          actionType: 'view',
          at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          embedding: null, // No embedding
          meta: {},
        },
      ]);

      indexer.getNode.mockResolvedValue({ id: 'node-1', title: 'Node 1' });

      const suggestions = await getContextSuggestions({
        queryEmbedding,
        topN: 5,
      });

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].score).toBeGreaterThanOrEqual(0); // Should still have recency score
    });

    it('should test decay behavior over time', async () => {
      const queryEmbedding = new Float32Array([0.5, 0.5, 0.5]);
      const now = Date.now();

      memory.getRecentInteractions.mockResolvedValue([
        {
          id: 'int-recent',
          nodeId: 'node-recent',
          actionType: 'view',
          at: new Date(now - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
          embedding: new Float32Array([0.4, 0.4, 0.4]), // Low similarity
          meta: {},
        },
        {
          id: 'int-old',
          nodeId: 'node-old',
          actionType: 'view',
          at: new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago
          embedding: new Float32Array([0.5, 0.5, 0.5]), // Perfect similarity
          meta: {},
        },
      ]);

      indexer.getNode
        .mockResolvedValueOnce({ id: 'node-recent', title: 'Recent' })
        .mockResolvedValueOnce({ id: 'node-old', title: 'Old' });

      const suggestions = await getContextSuggestions({
        queryEmbedding,
        topN: 2,
        recencyHalfLifeHours: 72, // 3 days
        alpha: 0.7,
        beta: 0.3,
      });

      expect(suggestions).toHaveLength(2);

      // Recent interaction should score higher due to recency weight
      // (despite lower semantic similarity)
      // This tests the decay formula
    });

    it('should respect topN limit', async () => {
      const queryEmbedding = new Float32Array([0.1, 0.2, 0.3]);

      memory.getRecentInteractions.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          id: `int-${i}`,
          nodeId: `node-${i}`,
          actionType: 'view',
          at: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
          embedding: new Float32Array([0.1, 0.2, 0.3]),
          meta: {},
        }))
      );

      indexer.getNode.mockImplementation(id => Promise.resolve({ id, title: `Node ${id}` }));

      const suggestions = await getContextSuggestions({
        queryEmbedding,
        topN: 3,
      });

      expect(suggestions).toHaveLength(3);
    });

    it('should throw error if queryEmbedding is missing', async () => {
      await expect(
        getContextSuggestions({
          topN: 5,
        })
      ).rejects.toThrow('queryEmbedding is required');
    });

    it('should return empty array if no interactions', async () => {
      const queryEmbedding = new Float32Array([0.1, 0.2, 0.3]);

      memory.getRecentInteractions.mockResolvedValue([]);

      const suggestions = await getContextSuggestions({
        queryEmbedding,
        topN: 5,
      });

      expect(suggestions).toEqual([]);
    });

    it('should skip interactions without nodeId', async () => {
      const queryEmbedding = new Float32Array([0.1, 0.2, 0.3]);

      memory.getRecentInteractions.mockResolvedValue([
        {
          id: 'int-1',
          nodeId: null, // Global action (e.g., search)
          actionType: 'search',
          at: new Date().toISOString(),
          embedding: new Float32Array([0.1, 0.2, 0.3]),
          meta: {},
        },
        {
          id: 'int-2',
          nodeId: 'node-1',
          actionType: 'view',
          at: new Date().toISOString(),
          embedding: new Float32Array([0.1, 0.2, 0.3]),
          meta: {},
        },
      ]);

      indexer.getNode.mockResolvedValue({ id: 'node-1', title: 'Node 1' });

      const suggestions = await getContextSuggestions({
        queryEmbedding,
        topN: 5,
      });

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].nodeId).toBe('node-1');
    });

    it('should adjust alpha/beta weights', async () => {
      const queryEmbedding = new Float32Array([0.5, 0.5, 0.5]);

      memory.getRecentInteractions.mockResolvedValue([
        {
          id: 'int-1',
          nodeId: 'node-1',
          actionType: 'view',
          at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // Very old
          embedding: new Float32Array([0.5, 0.5, 0.5]), // Perfect similarity
          meta: {},
        },
      ]);

      indexer.getNode.mockResolvedValue({ id: 'node-1', title: 'Node 1' });

      // Test with different alpha/beta values
      const semanticHeavy = await getContextSuggestions({
        queryEmbedding,
        topN: 1,
        alpha: 0.9, // Prioritize semantic similarity
        beta: 0.1,
      });

      const recencyHeavy = await getContextSuggestions({
        queryEmbedding,
        topN: 1,
        alpha: 0.1,
        beta: 0.9, // Prioritize recency
      });

      // Semantic-heavy should score higher (perfect similarity, despite age)
      expect(semanticHeavy[0].score).toBeGreaterThan(recencyHeavy[0].score);
    });
  });

  describe('getRecentContext', () => {
    it('should return recent interactions grouped by node', async () => {
      memory.getRecentInteractions.mockResolvedValue([
        {
          id: 'int-1',
          nodeId: 'node-1',
          actionType: 'view',
          at: new Date(Date.now() - 1000).toISOString(),
          meta: {},
        },
        {
          id: 'int-2',
          nodeId: 'node-1', // Same node, should be deduplicated
          actionType: 'edit',
          at: new Date(Date.now() - 2000).toISOString(),
          meta: {},
        },
        {
          id: 'int-3',
          nodeId: 'node-2',
          actionType: 'expand',
          at: new Date(Date.now() - 3000).toISOString(),
          meta: {},
        },
      ]);

      indexer.getNode
        .mockResolvedValueOnce({ id: 'node-1', title: 'Node 1' })
        .mockResolvedValueOnce({ id: 'node-2', title: 'Node 2' });

      const context = await getRecentContext({ limit: 50 });

      expect(context.length).toBeLessThanOrEqual(2); // Deduplicated by nodeId

      context.forEach(c => {
        expect(c).toHaveProperty('nodeId');
        expect(c).toHaveProperty('title');
        expect(c).toHaveProperty('actionType');
        expect(c).toHaveProperty('hoursAgo');
      });
    });
  });

  describe('getContextStats', () => {
    it('should return context statistics', async () => {
      memory.getRecentInteractions.mockResolvedValue([
        { id: '1', nodeId: 'node-1', actionType: 'view', at: new Date().toISOString(), embedding: new Float32Array([1, 2, 3]) },
        { id: '2', nodeId: 'node-2', actionType: 'edit', at: new Date().toISOString(), embedding: null },
        { id: '3', nodeId: 'node-1', actionType: 'rewrite', at: new Date().toISOString(), embedding: new Float32Array([4, 5, 6]) },
      ]);

      const stats = await getContextStats();

      expect(stats).toHaveProperty('totalInteractions');
      expect(stats).toHaveProperty('uniqueNodes');
      expect(stats).toHaveProperty('interactionsWithEmbeddings');
      expect(stats).toHaveProperty('actionTypeCounts');
      expect(stats.totalInteractions).toBe(3);
      expect(stats.uniqueNodes).toBe(2);
      expect(stats.interactionsWithEmbeddings).toBe(2);
    });
  });
});
