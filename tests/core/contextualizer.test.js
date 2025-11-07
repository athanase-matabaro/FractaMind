/**
 * Contextualizer Module Unit Tests
 *
 * Test suite for semantic link suggestion engine:
 * - Suggestion generation with Morton-range prefiltering
 * - Mock mode relation labeling
 * - Confidence scoring integration
 * - Filtering and ranking
 * - Context bias computation
 * - Performance characteristics
 */

import { suggestLinks } from '../../src/core/contextualizer.js';
import { initDB, saveNode } from '../../src/db/fractamind-indexer.js';
import { CONTEXTUALIZATION } from '../../src/config.js';

describe('Contextualizer Module', () => {

  beforeAll(async () => {
    await initDB();

    // Create test nodes with embeddings
    const testNodes = [
      {
        id: 'ctx-node-1',
        title: 'Neural Networks Fundamentals',
        text: 'Neural networks are computational models inspired by biological neural networks in the human brain. They consist of interconnected nodes that process information.',
        embedding: Array(512).fill(0).map((_, i) => Math.sin(i * 0.1)),
        hilbertKeyHex: 'aaa0000000000001',
        meta: {
          projectId: 'ctx-test-proj',
          createdAt: new Date().toISOString(),
        },
      },
      {
        id: 'ctx-node-2',
        title: 'Deep Learning Applications',
        text: 'Deep learning is a subset of machine learning based on artificial neural networks. It is used for image recognition, natural language processing, and more.',
        embedding: Array(512).fill(0).map((_, i) => Math.sin(i * 0.1 + 0.1)),
        hilbertKeyHex: 'aaa0000000000002',
        meta: {
          projectId: 'ctx-test-proj',
          createdAt: new Date().toISOString(),
        },
      },
      {
        id: 'ctx-node-3',
        title: 'Convolutional Neural Networks',
        text: 'CNNs are specialized neural networks for processing grid-like data such as images. They use convolutional layers to automatically learn spatial hierarchies.',
        embedding: Array(512).fill(0).map((_, i) => Math.sin(i * 0.1 + 0.15)),
        hilbertKeyHex: 'aaa0000000000003',
        meta: {
          projectId: 'ctx-test-proj',
          createdAt: new Date().toISOString(),
        },
      },
      {
        id: 'ctx-node-4',
        title: 'Recurrent Neural Networks',
        text: 'RNNs are neural networks designed for sequential data. They maintain internal state and are used for time series prediction and language modeling.',
        embedding: Array(512).fill(0).map((_, i) => Math.sin(i * 0.1 + 0.2)),
        hilbertKeyHex: 'aaa0000000000004',
        meta: {
          projectId: 'ctx-test-proj',
          createdAt: new Date().toISOString(),
        },
      },
      {
        id: 'ctx-node-5',
        title: 'Cooking Recipes Collection',
        text: 'A comprehensive guide to home cooking with recipes for appetizers, main courses, and desserts. Includes tips for meal planning.',
        embedding: Array(512).fill(0).map((_, i) => Math.cos(i * 0.3)), // Dissimilar embedding
        hilbertKeyHex: 'zzz0000000000001',
        meta: {
          projectId: 'ctx-test-proj',
          createdAt: new Date().toISOString(),
        },
      },
      {
        id: 'ctx-node-6',
        title: 'Machine Learning Basics',
        text: 'Machine learning is a field of artificial intelligence that uses statistical techniques to give computer systems the ability to learn from data.',
        embedding: Array(512).fill(0).map((_, i) => Math.sin(i * 0.1 + 0.05)),
        hilbertKeyHex: 'aaa0000000000005',
        meta: {
          projectId: 'ctx-test-proj',
          createdAt: new Date().toISOString(),
        },
      },
    ];

    for (const node of testNodes) {
      await saveNode(node);
    }
  });

  describe('Suggestion Generation', () => {

    test('should generate suggestions in mock mode', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 5,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(5);

      // Verify suggestion structure
      const suggestion = suggestions[0];
      expect(suggestion).toHaveProperty('candidateNodeId');
      expect(suggestion).toHaveProperty('title');
      expect(suggestion).toHaveProperty('snippet');
      expect(suggestion).toHaveProperty('relationType');
      expect(suggestion).toHaveProperty('rationale');
      expect(suggestion).toHaveProperty('confidence');
      expect(suggestion).toHaveProperty('score');
      expect(suggestion).toHaveProperty('similarity');
      expect(suggestion).toHaveProperty('mode');
      expect(suggestion).toHaveProperty('timestamp');

      expect(suggestion.mode).toBe('mock');
    });

    test('should not suggest self-links', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 10,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      const selfLink = suggestions.find(s => s.candidateNodeId === 'ctx-node-1');
      expect(selfLink).toBeUndefined();
    });

    test('should respect topK limit', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 3,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    test('should return suggestions sorted by score', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 5,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      if (suggestions.length > 1) {
        for (let i = 0; i < suggestions.length - 1; i++) {
          expect(suggestions[i].score).toBeGreaterThanOrEqual(suggestions[i + 1].score);
        }
      }
    });

    test('should prefer semantically similar nodes', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 10,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      // Neural network related nodes should rank higher than cooking
      const cookingNode = suggestions.find(s => s.candidateNodeId === 'ctx-node-5');
      const neuralNode = suggestions.find(s => ['ctx-node-2', 'ctx-node-3', 'ctx-node-6'].includes(s.candidateNodeId));

      if (cookingNode && neuralNode) {
        expect(neuralNode.score).toBeGreaterThan(cookingNode.score);
      }
    });

  });

  describe('Relation Type Assignment', () => {

    test('should assign valid relation types from taxonomy', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 5,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      const validTypes = CONTEXTUALIZATION.RELATION_TYPES.map(r => r.id);

      suggestions.forEach(suggestion => {
        expect(validTypes).toContain(suggestion.relationType);
      });
    });

    test('should provide rationale for relation type', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 3,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      suggestions.forEach(suggestion => {
        expect(suggestion.rationale).toBeDefined();
        expect(suggestion.rationale.length).toBeGreaterThan(0);
      });
    });

    test('should use deterministic relation assignment in mock mode', async () => {
      // Same inputs should produce same relations
      const suggestions1 = await suggestLinks('ctx-node-1', {
        topK: 3,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      const suggestions2 = await suggestLinks('ctx-node-1', {
        topK: 3,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      expect(suggestions1.length).toBe(suggestions2.length);

      for (let i = 0; i < suggestions1.length; i++) {
        if (suggestions1[i].candidateNodeId === suggestions2[i].candidateNodeId) {
          expect(suggestions1[i].relationType).toBe(suggestions2[i].relationType);
        }
      }
    });

  });

  describe('Confidence Scoring', () => {

    test('should compute multi-signal confidence', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 5,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      suggestions.forEach(suggestion => {
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
        expect(typeof suggestion.confidence).toBe('number');
      });
    });

    test('should include similarity score', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 5,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      suggestions.forEach(suggestion => {
        expect(suggestion.similarity).toBeDefined();
        expect(suggestion.similarity).toBeGreaterThanOrEqual(0);
        expect(suggestion.similarity).toBeLessThanOrEqual(1);
      });
    });

    test('should have higher confidence for semantically similar nodes', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 10,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      const similarNode = suggestions.find(s => ['ctx-node-2', 'ctx-node-6'].includes(s.candidateNodeId));
      const dissimilarNode = suggestions.find(s => s.candidateNodeId === 'ctx-node-5');

      if (similarNode && dissimilarNode) {
        expect(similarNode.confidence).toBeGreaterThan(dissimilarNode.confidence);
      }
    });

  });

  describe('Filtering and Threshold', () => {

    test('should filter by similarity threshold', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 10,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      const threshold = CONTEXTUALIZATION.LINK_SIM_THRESHOLD;

      // At least some suggestions should meet threshold
      // (may not be all if dissimilar nodes exist)
      const aboveThreshold = suggestions.filter(s => s.similarity >= threshold);
      expect(aboveThreshold.length).toBeGreaterThan(0);
    });

    test('should handle case with no candidates above threshold', async () => {
      // Node with very different embedding should find fewer suggestions
      const suggestions = await suggestLinks('ctx-node-5', {
        topK: 10,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      // Should still return some suggestions (algorithm is lenient)
      expect(suggestions).toBeInstanceOf(Array);
      // May be fewer than topK if threshold filters many out
    });

  });

  describe('Context Bias', () => {

    test('should compute contextual bias when enabled', async () => {
      const contextHistory = {
        recentNodes: ['ctx-node-2', 'ctx-node-3'],
        recencyWindow: 3600000, // 1 hour
      };

      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 5,
        mode: 'mock',
        projectId: 'ctx-test-proj',
        includeContextBias: true,
        contextHistory,
      });

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);

      // Suggestions should still be valid
      suggestions.forEach(suggestion => {
        expect(suggestion.confidence).toBeDefined();
        expect(suggestion.score).toBeDefined();
      });
    });

    test('should work without context bias', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 5,
        mode: 'mock',
        projectId: 'ctx-test-proj',
        includeContextBias: false,
      });

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
    });

  });

  describe('Snippet Generation', () => {

    test('should generate snippet for each suggestion', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 3,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      suggestions.forEach(suggestion => {
        expect(suggestion.snippet).toBeDefined();
        expect(typeof suggestion.snippet).toBe('string');
        if (suggestion.snippet.length > 0) {
          expect(suggestion.snippet.length).toBeLessThanOrEqual(200); // Should be truncated
        }
      });
    });

  });

  describe('Error Handling', () => {

    test('should handle missing node gracefully', async () => {
      await expect(
        suggestLinks('nonexistent-node', {
          topK: 5,
          mode: 'mock',
          projectId: 'ctx-test-proj',
        })
      ).rejects.toThrow();
    });

    test('should handle node without embedding', async () => {
      // Create node without embedding
      await saveNode({
        id: 'no-embed-node',
        title: 'No Embedding',
        text: 'This node has no embedding',
        // no embedding field
        meta: { projectId: 'ctx-test-proj', createdAt: new Date().toISOString() },
      });

      await expect(
        suggestLinks('no-embed-node', {
          topK: 5,
          mode: 'mock',
          projectId: 'ctx-test-proj',
        })
      ).rejects.toThrow();
    });

  });

  describe('Project Filtering', () => {

    test('should filter suggestions by project', async () => {
      // Create node in different project
      await saveNode({
        id: 'other-proj-node',
        title: 'Other Project Node',
        text: 'Neural networks in other project',
        embedding: Array(512).fill(0).map((_, i) => Math.sin(i * 0.1 + 0.05)),
        hilbertKeyHex: 'aaa0000000000099',
        meta: {
          projectId: 'other-project',
          createdAt: new Date().toISOString(),
        },
      });

      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 10,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      // Should not include node from other project
      const otherProjNode = suggestions.find(s => s.candidateNodeId === 'other-proj-node');
      expect(otherProjNode).toBeUndefined();
    });

  });

  describe('Performance Characteristics', () => {

    test('should complete within reasonable time', async () => {
      const startTime = Date.now();

      await suggestLinks('ctx-node-1', {
        topK: 8,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      const duration = Date.now() - startTime;

      // Should complete in under 1 second for small dataset
      expect(duration).toBeLessThan(1000);
    }, 10000);

    test('should scale with topK parameter', async () => {
      const small = await suggestLinks('ctx-node-1', {
        topK: 2,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      const large = await suggestLinks('ctx-node-1', {
        topK: 10,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      expect(small.length).toBeLessThanOrEqual(2);
      expect(large.length).toBeGreaterThanOrEqual(small.length);
    });

  });

  describe('Edge Cases', () => {

    test('should handle node with no similar candidates', async () => {
      // Node 5 (cooking) is very different from others
      const suggestions = await suggestLinks('ctx-node-5', {
        topK: 5,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      // Should still attempt to return suggestions
      expect(suggestions).toBeInstanceOf(Array);
    });

    test('should handle topK = 0', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 0,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBe(0);
    });

    test('should handle topK = 1', async () => {
      const suggestions = await suggestLinks('ctx-node-1', {
        topK: 1,
        mode: 'mock',
        projectId: 'ctx-test-proj',
      });

      expect(suggestions.length).toBeLessThanOrEqual(1);
    });

  });

});
