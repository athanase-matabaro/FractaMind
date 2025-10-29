/**
 * Unit tests for searcher.js - Semantic search pipeline
 */

import { semanticSearch, batchSemanticSearch, getOrCreateQuantParams } from './searcher';
import * as chromeAI from '../ai/chromeAI';
import * as indexer from '../db/fractamind-indexer';

// Mock dependencies
jest.mock('../ai/chromeAI');
jest.mock('../db/fractamind-indexer');

describe('searcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('semanticSearch', () => {
    const mockQueryEmbedding = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    const mockQuantParams = {
      reducedDims: 8,
      bits: 16,
      mins: [0, 0, 0, 0, 0, 0, 0, 0],
      maxs: [1, 1, 1, 1, 1, 1, 1, 1],
      reduction: 'first',
    };

    it('should perform semantic search and return ranked results', async () => {
      // Mock query embedding
      chromeAI.generateEmbedding.mockResolvedValue(mockQueryEmbedding);

      // Mock Morton key computation
      indexer.computeMortonKeyFromEmbedding.mockReturnValue('abcd1234567890ef');

      // Mock range scan - return candidate node IDs
      indexer.rangeScanByMortonHex.mockResolvedValue(['node-1', 'node-2', 'node-3']);

      // Mock node retrieval with embeddings
      indexer.getNode.mockImplementation((nodeId) => {
        const nodes = {
          'node-1': {
            id: 'node-1',
            title: 'Sustainable Cooling',
            text: 'Sustainable cooling techniques for data centers',
            embedding: [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85], // Similar to query
            hilbertKeyHex: 'abcd1234567890f0',
            meta: { projectId: 'test-project', depth: 1 },
          },
          'node-2': {
            id: 'node-2',
            title: 'Renewable Energy',
            text: 'Renewable energy sources for sustainable power',
            embedding: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], // Very similar
            hilbertKeyHex: 'abcd1234567890f1',
            meta: { projectId: 'test-project', depth: 1 },
          },
          'node-3': {
            id: 'node-3',
            title: 'Climate Change',
            text: 'Climate change impacts on global ecosystems',
            embedding: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], // Less similar
            hilbertKeyHex: 'abcd1234567890f2',
            meta: { projectId: 'test-project', depth: 1 },
          },
        };
        return Promise.resolve(nodes[nodeId]);
      });

      const results = await semanticSearch('sustainable cooling', {
        projectId: 'test-project',
        topK: 2,
        quantParams: mockQuantParams,
      });

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Renewable Energy'); // Should rank higher (more similar)
      expect(results[1].title).toBe('Sustainable Cooling');
      expect(results[0].score).toBeGreaterThan(results[1].score);

      // Verify API calls
      expect(chromeAI.generateEmbedding).toHaveBeenCalledWith('sustainable cooling');
      expect(indexer.computeMortonKeyFromEmbedding).toHaveBeenCalled();
      expect(indexer.rangeScanByMortonHex).toHaveBeenCalled();
    });

    it('should widen radius if initial search returns no candidates', async () => {
      chromeAI.generateEmbedding.mockResolvedValue(mockQueryEmbedding);
      indexer.computeMortonKeyFromEmbedding.mockReturnValue('abcd1234567890ef');

      // First two calls return empty, third returns results
      indexer.rangeScanByMortonHex
        .mockResolvedValueOnce([]) // First attempt: empty
        .mockResolvedValueOnce([]) // Second attempt: empty
        .mockResolvedValueOnce(['node-1']); // Third attempt: success

      indexer.getNode.mockResolvedValue({
        id: 'node-1',
        title: 'Test Node',
        text: 'Test content',
        embedding: mockQueryEmbedding,
        hilbertKeyHex: 'abcd1234567890ef',
        meta: { projectId: 'test-project' },
      });

      const results = await semanticSearch('test query', {
        projectId: 'test-project',
        quantParams: mockQuantParams,
        maxRadiusWidenings: 3,
      });

      expect(results).toHaveLength(1);
      expect(indexer.rangeScanByMortonHex).toHaveBeenCalledTimes(3);
    });

    it('should return empty array if no candidates found after max widenings', async () => {
      chromeAI.generateEmbedding.mockResolvedValue(mockQueryEmbedding);
      indexer.computeMortonKeyFromEmbedding.mockReturnValue('abcd1234567890ef');
      indexer.rangeScanByMortonHex.mockResolvedValue([]); // Always empty

      const results = await semanticSearch('test query', {
        projectId: 'test-project',
        quantParams: mockQuantParams,
        maxRadiusWidenings: 2,
      });

      expect(results).toEqual([]);
      expect(indexer.rangeScanByMortonHex).toHaveBeenCalledTimes(3); // Initial + 2 widenings
    });

    it('should filter results by projectId', async () => {
      chromeAI.generateEmbedding.mockResolvedValue(mockQueryEmbedding);
      indexer.computeMortonKeyFromEmbedding.mockReturnValue('abcd1234567890ef');
      indexer.rangeScanByMortonHex.mockResolvedValue(['node-1', 'node-2']);

      indexer.getNode.mockImplementation((nodeId) => {
        const nodes = {
          'node-1': {
            id: 'node-1',
            title: 'Project A Node',
            text: 'Content',
            embedding: mockQueryEmbedding,
            meta: { projectId: 'project-a' },
          },
          'node-2': {
            id: 'node-2',
            title: 'Project B Node',
            text: 'Content',
            embedding: mockQueryEmbedding,
            meta: { projectId: 'project-b' },
          },
        };
        return Promise.resolve(nodes[nodeId]);
      });

      const results = await semanticSearch('test', {
        projectId: 'project-a',
        quantParams: mockQuantParams,
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Project A Node');
    });

    it('should handle embedding generation failure gracefully', async () => {
      chromeAI.generateEmbedding.mockRejectedValue(new Error('API unavailable'));

      const results = await semanticSearch('test query', {
        projectId: 'test-project',
        quantParams: mockQuantParams,
      });

      // Should return empty array as fallback (substring search not yet implemented)
      expect(results).toEqual([]);
    });

    it('should return empty array for empty query', async () => {
      const results = await semanticSearch('', {
        projectId: 'test-project',
        quantParams: mockQuantParams,
      });

      expect(results).toEqual([]);
      expect(chromeAI.generateEmbedding).not.toHaveBeenCalled();
    });
  });

  describe('batchSemanticSearch', () => {
    it('should perform search for multiple queries', async () => {
      chromeAI.generateEmbedding.mockResolvedValue(new Float32Array(8).fill(0.5));
      indexer.computeMortonKeyFromEmbedding.mockReturnValue('abcd1234567890ef');
      indexer.rangeScanByMortonHex.mockResolvedValue(['node-1']);
      indexer.getNode.mockResolvedValue({
        id: 'node-1',
        title: 'Test',
        text: 'Content',
        embedding: new Float32Array(8).fill(0.5),
        meta: {},
      });

      const results = await batchSemanticSearch(['query1', 'query2'], {
        projectId: 'test-project',
        quantParams: {},
      });

      expect(results.size).toBe(2);
      expect(results.has('query1')).toBe(true);
      expect(results.has('query2')).toBe(true);
    });

    it('should handle individual query failures', async () => {
      chromeAI.generateEmbedding
        .mockResolvedValueOnce(new Float32Array(8).fill(0.5)) // First succeeds
        .mockRejectedValueOnce(new Error('Fail')); // Second fails

      indexer.computeMortonKeyFromEmbedding.mockReturnValue('abcd1234567890ef');
      indexer.rangeScanByMortonHex.mockResolvedValue(['node-1']);
      indexer.getNode.mockResolvedValue({
        id: 'node-1',
        title: 'Test',
        text: 'Content',
        embedding: new Float32Array(8).fill(0.5),
        meta: {},
      });

      const results = await batchSemanticSearch(['query1', 'query2'], {
        projectId: 'test-project',
        quantParams: {},
      });

      expect(results.size).toBe(2);
      expect(Array.isArray(results.get('query1'))).toBe(true);
      expect(results.get('query2')).toEqual([]); // Failed query returns empty
    });
  });

  describe('getOrCreateQuantParams', () => {
    it('should fetch quantParams from project node if available', async () => {
      const mockQuantParams = { reducedDims: 8, bits: 16 };
      indexer.getNode.mockResolvedValue({
        id: 'project:test-project',
        meta: { quantParams: mockQuantParams },
      });

      const result = await getOrCreateQuantParams('test-project');

      expect(result).toEqual(mockQuantParams);
      expect(indexer.getNode).toHaveBeenCalledWith('project:test-project');
    });

    it('should compute new quantParams from sample embeddings', async () => {
      indexer.getNode.mockResolvedValue({
        id: 'project:test-project',
        meta: {},
      });

      const sampleEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ];

      const mockComputedParams = { reducedDims: 8, bits: 16 };
      indexer.computeQuantizationParams.mockReturnValue(mockComputedParams);

      const result = await getOrCreateQuantParams('test-project', sampleEmbeddings);

      expect(result).toEqual(mockComputedParams);
      expect(indexer.computeQuantizationParams).toHaveBeenCalledWith(
        sampleEmbeddings,
        expect.objectContaining({ reducedDims: 8, bits: 16 })
      );
    });

    it('should return null if no params and no sample embeddings', async () => {
      indexer.getNode.mockResolvedValue({
        id: 'project:test-project',
        meta: {},
      });

      const result = await getOrCreateQuantParams('test-project');

      expect(result).toBeNull();
    });
  });
});
