/**
 * Unit tests for rewriter.js - Node rewriting and history management
 */

import {
  rewriteNode,
  acceptRewrite,
  rejectRewrite,
  getRewriteHistory,
  restoreFromHistory,
  batchRewriteNodes,
  getRewriteStats,
} from '../../src/core/rewriter';
import * as chromeAI from '../../src/ai/chromeAI';
import * as indexer from '../../src/db/fractamind-indexer';

// Mock dependencies
jest.mock('../../src/ai/chromeAI');
jest.mock('../../src/db/fractamind-indexer');

// Mock crypto.subtle for SHA-256
global.crypto = {
  subtle: {
    digest: jest.fn((algorithm, data) => {
      // Simple deterministic hash for testing
      const str = new TextDecoder().decode(data);
      const hash = str.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
      const buffer = new ArrayBuffer(32);
      const view = new Uint8Array(buffer);
      view[0] = hash & 0xff;
      return Promise.resolve(buffer);
    }),
  },
};

describe('rewriter', () => {
  const mockNode = {
    id: 'node-1',
    title: 'Original Title',
    text: 'Original content here',
    embedding: [0.1, 0.2, 0.3],
    hilbertKeyHex: 'abcd1234',
    children: [],
    parent: null,
    history: [],
    meta: { createdAt: '2025-01-01T00:00:00.000Z', projectId: 'test-project' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rewriteNode', () => {
    it('should generate rewrite suggestion without auto-accepting', async () => {
      indexer.getNode.mockResolvedValue(mockNode);
      chromeAI.rewriteText.mockResolvedValue('Rewritten content here');

      const result = await rewriteNode('node-1', {
        tone: 'concise',
        length: 'short',
        autoAccept: false,
      });

      expect(result.original).toBe('Original content here');
      expect(result.suggestion).toBe('Rewritten content here');
      expect(result.node).toEqual(mockNode);
      expect(indexer.saveNode).not.toHaveBeenCalled(); // Not auto-accepted
    });

    it('should auto-accept rewrite if autoAccept is true', async () => {
      indexer.getNode.mockResolvedValue(mockNode);
      chromeAI.rewriteText.mockResolvedValue('Rewritten content');
      chromeAI.generateEmbedding.mockResolvedValue(new Float32Array([0.2, 0.3, 0.4]));
      indexer.computeMortonKeyFromEmbedding.mockReturnValue('new-morton-key');

      const result = await rewriteNode('node-1', {
        tone: 'technical',
        length: 'medium',
        autoAccept: true,
        quantParams: { reducedDims: 3, bits: 16 },
      });

      expect(result.text).toBe('Rewritten content');
      expect(result.history).toHaveLength(1);
      expect(result.history[0].type).toBe('rewrite-original');
      expect(indexer.saveNode).toHaveBeenCalled();
    });

    it('should call progress callback', async () => {
      indexer.getNode.mockResolvedValue(mockNode);
      chromeAI.rewriteText.mockResolvedValue('Rewritten');

      const onProgress = jest.fn();

      await rewriteNode('node-1', { autoAccept: false, onProgress });

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'loading', message: 'Loading node...' })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'rewriting' })
      );
    });

    it('should throw error if node not found', async () => {
      indexer.getNode.mockResolvedValue(null);

      await expect(rewriteNode('non-existent')).rejects.toThrow('Node non-existent not found');
    });
  });

  describe('acceptRewrite', () => {
    it('should save rewritten node with history', async () => {
      indexer.getNode.mockResolvedValue(mockNode);
      chromeAI.generateEmbedding.mockResolvedValue(new Float32Array([0.5, 0.6, 0.7]));
      indexer.computeMortonKeyFromEmbedding.mockReturnValue('new-key');

      const newText = 'New rewritten text';
      const result = await acceptRewrite('node-1', newText, {
        tone: 'creative',
        length: 'long',
        quantParams: { reducedDims: 3 },
      });

      expect(result.text).toBe(newText);
      expect(result.history).toHaveLength(1);
      expect(result.history[0].text).toBe('Original content here');
      expect(result.history[0].type).toBe('rewrite-original');
      expect(result.history[0].meta.tone).toBe('creative');
      expect(indexer.saveNode).toHaveBeenCalledWith(
        expect.objectContaining({ text: newText })
      );
    });

    it('should skip history entry if content unchanged', async () => {
      indexer.getNode.mockResolvedValue(mockNode);

      // Same text as original
      const result = await acceptRewrite('node-1', 'Original content here', {});

      expect(result).toEqual(mockNode);
      expect(indexer.saveNode).not.toHaveBeenCalled();
    });

    it('should keep only last 10 history entries', async () => {
      const nodeWithHistory = {
        ...mockNode,
        history: Array.from({ length: 10 }, (_, i) => ({
          at: new Date().toISOString(),
          text: `History ${i}`,
          type: 'rewrite-original',
        })),
      };

      indexer.getNode.mockResolvedValue(nodeWithHistory);
      chromeAI.generateEmbedding.mockResolvedValue(new Float32Array([0.1, 0.2, 0.3]));

      const result = await acceptRewrite('node-1', 'New text', {});

      expect(result.history).toHaveLength(10); // Still 10 (oldest removed)
      expect(result.history[9].text).toBe('Original content here'); // Latest entry
    });

    it('should regenerate embedding and Morton key', async () => {
      indexer.getNode.mockResolvedValue(mockNode);
      chromeAI.generateEmbedding.mockResolvedValue(new Float32Array([1, 2, 3]));
      indexer.computeMortonKeyFromEmbedding.mockReturnValue('new-morton-123');

      const result = await acceptRewrite('node-1', 'New content', {
        quantParams: { reducedDims: 3 },
      });

      expect(chromeAI.generateEmbedding).toHaveBeenCalledWith('Original Title. New content');
      expect(indexer.computeMortonKeyFromEmbedding).toHaveBeenCalled();
      expect(result.hilbertKeyHex).toBe('new-morton-123');
    });
  });

  describe('rejectRewrite', () => {
    it('should log rejection without modifying node', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await rejectRewrite('node-1', 'Rejected suggestion');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rewrite suggestion rejected')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getRewriteHistory', () => {
    it('should return node history', async () => {
      const history = [
        { at: '2025-01-01', text: 'Old text 1', type: 'rewrite-original' },
        { at: '2025-01-02', text: 'Old text 2', type: 'rewrite-original' },
      ];

      indexer.getNode.mockResolvedValue({ ...mockNode, history });

      const result = await getRewriteHistory('node-1');

      expect(result).toEqual(history);
    });

    it('should return empty array if no history', async () => {
      indexer.getNode.mockResolvedValue(mockNode);

      const result = await getRewriteHistory('node-1');

      expect(result).toEqual([]);
    });
  });

  describe('restoreFromHistory', () => {
    it('should restore node to previous version', async () => {
      const nodeWithHistory = {
        ...mockNode,
        text: 'Current text',
        history: [
          { at: '2025-01-01', text: 'Old text version', type: 'rewrite-original' },
        ],
      };

      indexer.getNode.mockResolvedValue(nodeWithHistory);
      chromeAI.generateEmbedding.mockResolvedValue(new Float32Array([1, 2, 3]));

      const result = await restoreFromHistory('node-1', 0, {
        quantParams: { reducedDims: 3 },
      });

      expect(result.text).toBe('Old text version');
      expect(indexer.saveNode).toHaveBeenCalled();
    });

    it('should throw error for invalid history index', async () => {
      indexer.getNode.mockResolvedValue(mockNode);

      await expect(restoreFromHistory('node-1', 5)).rejects.toThrow('Invalid history index');
    });
  });

  describe('batchRewriteNodes', () => {
    it('should rewrite multiple nodes', async () => {
      indexer.getNode.mockImplementation((nodeId) =>
        Promise.resolve({ ...mockNode, id: nodeId })
      );
      chromeAI.rewriteText.mockResolvedValue('Rewritten');

      const results = await batchRewriteNodes(['node-1', 'node-2'], {
        tone: 'concise',
      });

      expect(results.size).toBe(2);
      expect(results.get('node-1').suggestion).toBe('Rewritten');
      expect(results.get('node-2').suggestion).toBe('Rewritten');
    });

    it('should handle individual node failures', async () => {
      indexer.getNode
        .mockResolvedValueOnce(mockNode) // First succeeds
        .mockRejectedValueOnce(new Error('Not found')); // Second fails

      chromeAI.rewriteText.mockResolvedValue('Rewritten');

      const results = await batchRewriteNodes(['node-1', 'node-2'], {});

      expect(results.size).toBe(2);
      expect(results.get('node-1').suggestion).toBe('Rewritten');
      expect(results.get('node-2').error).toBeDefined();
    });
  });

  describe('getRewriteStats', () => {
    it('should return rewrite statistics', async () => {
      const nodeWithStats = {
        ...mockNode,
        text: 'Current text with multiple words here',
        history: [
          { at: '2025-01-01', text: 'Old 1', type: 'rewrite-original' },
          { at: '2025-01-02', text: 'Old 2', type: 'rewrite-original' },
          { at: '2025-01-03', text: 'Manual edit', type: 'manual-edit' },
        ],
        meta: {
          ...mockNode.meta,
          lastRewrite: '2025-01-02T00:00:00.000Z',
        },
      };

      indexer.getNode.mockResolvedValue(nodeWithStats);

      const stats = await getRewriteStats('node-1');

      expect(stats.totalRewrites).toBe(2); // Only rewrite-original type
      expect(stats.historySize).toBe(3);
      expect(stats.currentWordCount).toBe(6);
      expect(stats.hasHistory).toBe(true);
      expect(stats.lastRewrite).toBe('2025-01-02T00:00:00.000Z');
    });

    it('should handle node with no history', async () => {
      indexer.getNode.mockResolvedValue(mockNode);

      const stats = await getRewriteStats('node-1');

      expect(stats.totalRewrites).toBe(0);
      expect(stats.historySize).toBe(0);
      expect(stats.hasHistory).toBe(false);
    });
  });
});
