/**
 * Unit and integration tests for importer.js
 */

import { parseSummaryToNodes, attachEmbeddingsAndKeys, handleSeedSubmit } from '../../src/core/importer';
import * as chromeAI from '../../src/ai/chromeAI';
import * as indexer from '../../src/db/fractamind-indexer';

// Mock dependencies
jest.mock('../../src/ai/chromeAI');
jest.mock('../../src/db/fractamind-indexer');

// Mock UUID with counter for predictable IDs
let mockUuidCounter = 0;
jest.mock('../../src/utils/uuid', () => ({
  generateUUID: jest.fn(() => {
    return `test-uuid-${mockUuidCounter++}`;
  }),
}));

describe('importer', () => {
  beforeEach(() => {
    // Reset UUID counter before each test
    mockUuidCounter = 0;
  });

  describe('parseSummaryToNodes', () => {
    it('should parse summary result into FractalNode objects', () => {
      const summaryResult = [
        {
          title: 'Climate Change Impacts',
          summary: 'Rising temperatures affect ecosystems globally',
          keyPoints: ['Increased extreme weather events', 'Ocean acidification'],
        },
        {
          title: 'Renewable Energy Solutions',
          summary: 'Solar and wind power reduce carbon emissions',
          keyPoints: ['Cost-effective energy generation', 'Grid modernization needed'],
        },
        {
          title: 'Policy and Regulation',
          summary: 'Government policies drive climate action',
          keyPoints: ['Carbon pricing mechanisms', 'International agreements'],
        },
      ];

      const nodes = parseSummaryToNodes(summaryResult, {
        projectId: 'test-project-123',
        parentId: 'test-root-456',
        depth: 1,
      });

      expect(nodes).toHaveLength(3);

      // Check first node
      expect(nodes[0]).toMatchObject({
        title: 'Climate Change Impacts',
        text: expect.stringContaining('Rising temperatures'),
        text: expect.stringContaining('Increased extreme weather'),
        parent: 'test-root-456',
        children: [],
        embedding: null,
        hilbertKeyHex: null,
      });

      expect(nodes[0].meta).toMatchObject({
        projectId: 'test-project-123',
        depth: 1,
        createdBy: 'summarizer',
        keyPoints: ['Increased extreme weather events', 'Ocean acidification'],
      });

      expect(nodes[0].id).toBeDefined();
      expect(nodes[0].meta.createdAt).toBeDefined();

      // Check second node
      expect(nodes[1].title).toBe('Renewable Energy Solutions');
      expect(nodes[1].text).toContain('Solar and wind power');

      // Check third node
      expect(nodes[2].title).toBe('Policy and Regulation');
    });

    it('should handle summary with missing keyPoints', () => {
      const summaryResult = [
        {
          title: 'Topic Without Key Points',
          summary: 'This is a summary',
        },
      ];

      const nodes = parseSummaryToNodes(summaryResult, {
        projectId: 'test-project',
        parentId: 'test-parent',
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].text).toBe('This is a summary');
      expect(nodes[0].meta.keyPoints).toEqual([]);
    });

    it('should handle empty summary result', () => {
      const summaryResult = [];
      const nodes = parseSummaryToNodes(summaryResult, {
        projectId: 'test-project',
        parentId: 'test-parent',
      });

      expect(nodes).toEqual([]);
    });

    it('should use default depth of 1 when not provided', () => {
      const summaryResult = [
        {
          title: 'Test Topic',
          summary: 'Test summary',
          keyPoints: [],
        },
      ];

      const nodes = parseSummaryToNodes(summaryResult, {
        projectId: 'test-project',
        parentId: 'test-parent',
      });

      expect(nodes[0].meta.depth).toBe(1);
    });
  });

  describe('attachEmbeddingsAndKeys', () => {
    beforeEach(() => {
      // Mock batchGenerateEmbeddings
      chromeAI.batchGenerateEmbeddings.mockResolvedValue([
        new Float32Array([0.1, 0.2, 0.3, 0.4]),
        new Float32Array([0.5, 0.6, 0.7, 0.8]),
      ]);

      // Mock computeQuantizationParams
      indexer.computeQuantizationParams.mockReturnValue({
        reducedDims: 4,
        bits: 16,
        mins: [0, 0, 0, 0],
        maxs: [1, 1, 1, 1],
        reduction: 'first',
      });

      // Mock computeMortonKeyFromEmbedding
      indexer.computeMortonKeyFromEmbedding.mockImplementation((embedding) => {
        const hash = embedding.reduce((a, b) => a + b, 0);
        return hash.toString(16).padStart(16, '0');
      });
    });

    it('should attach embeddings and Morton keys to nodes', async () => {
      const nodes = [
        {
          id: 'node-1',
          title: 'First Node',
          text: 'First node text',
          embedding: null,
          hilbertKeyHex: null,
        },
        {
          id: 'node-2',
          title: 'Second Node',
          text: 'Second node text',
          embedding: null,
          hilbertKeyHex: null,
        },
      ];

      const result = await attachEmbeddingsAndKeys(nodes);

      expect(result).toHaveLength(2);

      // Check embeddings are attached (Float32Array precision)
      expect(Array.from(result[0].embedding)).toHaveLength(4);
      expect(Array.from(result[1].embedding)).toHaveLength(4);
      expect(result[0].embedding[0]).toBeCloseTo(0.1);
      expect(result[1].embedding[0]).toBeCloseTo(0.5);

      // Check Morton keys are computed
      expect(result[0].hilbertKeyHex).toBeDefined();
      expect(result[1].hilbertKeyHex).toBeDefined();
      expect(typeof result[0].hilbertKeyHex).toBe('string');

      // Verify batchGenerateEmbeddings was called with combined text
      expect(chromeAI.batchGenerateEmbeddings).toHaveBeenCalledWith([
        'First Node. First node text',
        'Second Node. Second node text',
      ]);

      // Verify quantization params were computed
      expect(indexer.computeQuantizationParams).toHaveBeenCalled();

      // Verify Morton keys were computed for each node
      expect(indexer.computeMortonKeyFromEmbedding).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleSeedSubmit (integration)', () => {
    beforeEach(() => {
      // Mock initDB
      indexer.initDB.mockResolvedValue(undefined);

      // Mock summarizeDocument
      chromeAI.summarizeDocument.mockResolvedValue([
        {
          title: 'Topic One',
          summary: 'Summary one',
          keyPoints: ['Point 1A', 'Point 1B'],
        },
        {
          title: 'Topic Two',
          summary: 'Summary two',
          keyPoints: ['Point 2A', 'Point 2B'],
        },
        {
          title: 'Topic Three',
          summary: 'Summary three',
          keyPoints: ['Point 3A', 'Point 3B'],
        },
      ]);

      // Mock batchGenerateEmbeddings
      chromeAI.batchGenerateEmbeddings.mockResolvedValue([
        new Float32Array(512).fill(0.1),
        new Float32Array(512).fill(0.2),
        new Float32Array(512).fill(0.3),
        new Float32Array(512).fill(0.4),
      ]);

      // Mock computeQuantizationParams
      indexer.computeQuantizationParams.mockReturnValue({
        reducedDims: 8,
        bits: 16,
        mins: Array(8).fill(0),
        maxs: Array(8).fill(1),
        reduction: 'first',
      });

      // Mock computeMortonKeyFromEmbedding
      indexer.computeMortonKeyFromEmbedding.mockReturnValue('abcd1234567890ef');

      // Mock saveNode
      indexer.saveNode.mockImplementation((node) => Promise.resolve(node));
    });

    it('should complete full import pipeline', async () => {
      const text = 'This is a sample document with multiple paragraphs.\n\nIt discusses various topics.';
      const projectMeta = {
        name: 'Test Project',
        sourceUrl: 'https://example.com',
      };

      const progressCallback = jest.fn();

      const result = await handleSeedSubmit(text, projectMeta, progressCallback);

      // Verify progress callbacks were called
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'summarizing',
          progress: 0.1,
        })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'embedding',
          progress: 0.5,
        })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'persisting',
          progress: 0.8,
        })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'complete',
          progress: 1.0,
        })
      );

      // Verify result structure
      expect(result.project).toBeDefined();
      expect(result.project.name).toBe('Test Project');
      expect(result.rootNode).toBeDefined();
      expect(result.nodes).toHaveLength(4); // 1 root + 3 children

      // Verify embeddings and keys were attached
      result.nodes.forEach((node) => {
        expect(node.embedding).toBeDefined();
        expect(node.hilbertKeyHex).toBeDefined();
        expect(Array.isArray(node.embedding)).toBe(true);
        expect(typeof node.hilbertKeyHex).toBe('string');
      });

      // Verify saveNode was called for all nodes (including project node)
      // 1 project node + 1 root (separate) + 4 nodes (root + 3 children) = 6 total
      expect(indexer.saveNode).toHaveBeenCalledTimes(6);
    });

    it('should handle errors gracefully', async () => {
      chromeAI.summarizeDocument.mockRejectedValue(new Error('AI API error'));

      const text = 'Test text';
      const progressCallback = jest.fn();

      await expect(handleSeedSubmit(text, {}, progressCallback)).rejects.toThrow(
        'Import failed: AI API error'
      );
    });
  });
});
