/**
 * Unit tests for expander.js
 */

import {
  expandNode,
  batchExpandNodes,
  getExpansionHistory,
  clearContentHashCache,
} from './expander';
import * as chromeAI from '../ai/chromeAI';
import * as indexer from '../db/fractamind-indexer';
import * as uuid from '../utils/uuid';

// Mock dependencies
jest.mock('../ai/chromeAI');
jest.mock('../db/fractamind-indexer');
jest.mock('../utils/uuid');

describe('expander', () => {
  let mockNodeId;
  let mockParentNode;
  let mockChildrenResponse;

  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    clearContentHashCache();

    // Setup test data
    mockNodeId = 'parent-node-123';
    mockParentNode = {
      id: mockNodeId,
      title: 'Parent Node',
      text: 'This is the parent node text to be expanded.',
      children: [],
      parent: 'root-node',
      embedding: Array(512).fill(0.1),
      hilbertKeyHex: 'abc123',
      meta: {
        projectId: 'test-project',
        depth: 1,
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    mockChildrenResponse = [
      {
        title: 'Child Node 1',
        text: 'First child node explaining part of the parent concept.',
      },
      {
        title: 'Child Node 2',
        text: 'Second child node with different aspects.',
      },
      {
        title: 'Child Node 3',
        text: 'Third child node providing additional details.',
      },
    ];

    // Mock indexer.getNode
    indexer.getNode.mockImplementation((id) => {
      if (id === mockNodeId) {
        return Promise.resolve(mockParentNode);
      }
      return Promise.resolve(null);
    });

    // Mock chromeAI.expandNode
    chromeAI.expandNode.mockResolvedValue(mockChildrenResponse);

    // Mock chromeAI.generateEmbedding
    chromeAI.generateEmbedding.mockImplementation((text) => {
      const hash = text.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      return Promise.resolve(new Float32Array(512).fill(hash / 10000));
    });

    // Mock indexer.computeQuantizationParams
    indexer.computeQuantizationParams.mockReturnValue({
      reducedDims: 8,
      bits: 16,
      mins: Array(8).fill(0),
      maxs: Array(8).fill(1),
      reduction: 'first',
    });

    // Mock indexer.computeMortonKeyFromEmbedding
    indexer.computeMortonKeyFromEmbedding.mockImplementation((embedding) => {
      const sum = embedding.reduce((a, b) => a + b, 0);
      return sum.toString(16).padStart(16, '0');
    });

    // Mock indexer.saveNode
    indexer.saveNode.mockImplementation((node) => Promise.resolve(node));

    // Mock uuid.generateUUID
    let uuidCounter = 0;
    uuid.generateUUID.mockImplementation(() => `child-uuid-${uuidCounter++}`);
  });

  describe('expandNode', () => {
    it('should expand a node and create child nodes', async () => {
      const result = await expandNode(mockNodeId);

      // Verify AI was called
      expect(chromeAI.expandNode).toHaveBeenCalledWith(mockParentNode.text, {
        title: mockParentNode.title,
        numChildren: 3,
        style: 'concise',
      });

      // Verify embeddings were generated for each child
      expect(chromeAI.generateEmbedding).toHaveBeenCalledTimes(3);

      // Verify quantization params were computed
      expect(indexer.computeQuantizationParams).toHaveBeenCalled();

      // Verify Morton keys were computed for each child
      expect(indexer.computeMortonKeyFromEmbedding).toHaveBeenCalledTimes(3);

      // Verify all nodes were saved (3 children + 1 parent update)
      expect(indexer.saveNode).toHaveBeenCalledTimes(4);

      // Verify result structure
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        id: expect.any(String),
        title: 'Child Node 1',
        text: expect.stringContaining('First child'),
        parent: mockNodeId,
        embedding: expect.any(Array),
        hilbertKeyHex: expect.any(String),
        meta: expect.objectContaining({
          projectId: 'test-project',
          createdBy: 'expander',
          depth: 2,
          expandStyle: 'concise',
        }),
      });
    });

    it('should call progress callback with status updates', async () => {
      const onProgress = jest.fn();

      await expandNode(mockNodeId, { onProgress });

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'loading',
          progress: 0.1,
        })
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'expanding',
          progress: 0.2,
        })
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'embedding',
          progress: 0.5,
        })
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'complete',
          progress: 1.0,
        })
      );
    });

    it('should deduplicate child nodes based on content hash', async () => {
      // Setup: Parent already has one child
      const existingChildId = 'existing-child-id';
      const existingChild = {
        id: existingChildId,
        title: 'Child Node 1',
        text: 'First child node explaining part of the parent concept.', // Exact match
        parent: mockNodeId,
      };

      mockParentNode.children = [existingChildId];

      indexer.getNode.mockImplementation((id) => {
        if (id === mockNodeId) return Promise.resolve(mockParentNode);
        if (id === existingChildId) return Promise.resolve(existingChild);
        return Promise.resolve(null);
      });

      const result = await expandNode(mockNodeId);

      // Should only create 2 new children (first one is duplicate)
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Child Node 2');
      expect(result[1].title).toBe('Child Node 3');

      // Verify saveNode called for 2 children + 1 parent update
      expect(indexer.saveNode).toHaveBeenCalledTimes(3);
    });

    it('should throw error when node not found', async () => {
      indexer.getNode.mockResolvedValue(null);

      await expect(expandNode('non-existent-id')).rejects.toThrow(
        'Node non-existent-id not found'
      );
    });

    it('should throw error when AI returns no children', async () => {
      chromeAI.expandNode.mockResolvedValue([]);

      await expect(expandNode(mockNodeId)).rejects.toThrow('No child nodes generated by AI');
    });

    it('should handle custom maxChildren parameter', async () => {
      await expandNode(mockNodeId, { maxChildren: 5 });

      expect(chromeAI.expandNode).toHaveBeenCalledWith(mockParentNode.text, {
        title: mockParentNode.title,
        numChildren: 5,
        style: 'concise',
      });
    });

    it('should handle custom style parameter', async () => {
      await expandNode(mockNodeId, { style: 'detailed' });

      expect(chromeAI.expandNode).toHaveBeenCalledWith(mockParentNode.text, {
        title: mockParentNode.title,
        numChildren: 3,
        style: 'detailed',
      });
    });

    it('should update parent node with new child IDs', async () => {
      const result = await expandNode(mockNodeId);

      // Find the parent update call (last call to saveNode)
      const saveNodeCalls = indexer.saveNode.mock.calls;
      const parentUpdateCall = saveNodeCalls[saveNodeCalls.length - 1][0];

      expect(parentUpdateCall.id).toBe(mockNodeId);
      expect(parentUpdateCall.children).toHaveLength(3);
      expect(parentUpdateCall.children).toEqual(result.map((n) => n.id));
      expect(parentUpdateCall.meta.expandCount).toBe(1);
      expect(parentUpdateCall.meta.updatedAt).toBeDefined();
    });

    it('should retry on rate limit errors with exponential backoff', async () => {
      let attemptCount = 0;

      chromeAI.expandNode.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('rate limit exceeded'));
        }
        return Promise.resolve(mockChildrenResponse);
      });

      const result = await expandNode(mockNodeId);

      expect(result).toHaveLength(3);
      expect(chromeAI.expandNode).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retry attempts', async () => {
      chromeAI.expandNode.mockRejectedValue(new Error('rate limit exceeded'));

      await expect(expandNode(mockNodeId)).rejects.toThrow('Expansion failed: rate limit');
    }, 10000); // 10 second timeout for retry test
  });

  describe('batchExpandNodes', () => {
    it('should expand multiple nodes', async () => {
      const nodeIds = ['node-1', 'node-2', 'node-3'];

      indexer.getNode.mockImplementation((id) => {
        if (nodeIds.includes(id)) {
          return Promise.resolve({ ...mockParentNode, id });
        }
        return Promise.resolve(null);
      });

      const result = await batchExpandNodes(nodeIds);

      expect(result.size).toBe(3);
      expect(result.get('node-1')).toHaveLength(3);
      expect(result.get('node-2')).toHaveLength(3);
      expect(result.get('node-3')).toHaveLength(3);
    });

    it('should handle individual node failures gracefully', async () => {
      const nodeIds = ['node-1', 'node-2', 'node-3'];

      indexer.getNode.mockImplementation((id) => {
        if (id === 'node-2') {
          return Promise.reject(new Error('Node not found'));
        }
        if (nodeIds.includes(id)) {
          return Promise.resolve({ ...mockParentNode, id });
        }
        return Promise.resolve(null);
      });

      const result = await batchExpandNodes(nodeIds);

      expect(result.size).toBe(3);
      expect(result.get('node-1')).toHaveLength(3);
      expect(result.get('node-2')).toEqual([]); // Failed node returns empty array
      expect(result.get('node-3')).toHaveLength(3);
    });
  });

  describe('getExpansionHistory', () => {
    it('should return expansion history for a node', async () => {
      const childNodes = [
        {
          id: 'child-1',
          title: 'Child 1',
          meta: { createdAt: '2025-01-02T00:00:00Z', createdBy: 'expander' },
        },
        {
          id: 'child-2',
          title: 'Child 2',
          meta: { createdAt: '2025-01-03T00:00:00Z', createdBy: 'expander' },
        },
      ];

      mockParentNode.children = ['child-1', 'child-2'];
      mockParentNode.meta.expandCount = 1;
      mockParentNode.meta.updatedAt = '2025-01-04T00:00:00Z';

      indexer.getNode.mockImplementation((id) => {
        if (id === mockNodeId) return Promise.resolve(mockParentNode);
        if (id === 'child-1') return Promise.resolve(childNodes[0]);
        if (id === 'child-2') return Promise.resolve(childNodes[1]);
        return Promise.resolve(null);
      });

      const history = await getExpansionHistory(mockNodeId);

      expect(history).toMatchObject({
        nodeId: mockNodeId,
        title: 'Parent Node',
        childCount: 2,
        expandCount: 1,
        lastExpanded: '2025-01-04T00:00:00Z',
        children: [
          {
            id: 'child-1',
            title: 'Child 1',
            createdAt: '2025-01-02T00:00:00Z',
            createdBy: 'expander',
          },
          {
            id: 'child-2',
            title: 'Child 2',
            createdAt: '2025-01-03T00:00:00Z',
            createdBy: 'expander',
          },
        ],
      });
    });

    it('should throw error when node not found', async () => {
      indexer.getNode.mockResolvedValue(null);

      await expect(getExpansionHistory('non-existent-id')).rejects.toThrow(
        'Node non-existent-id not found'
      );
    });
  });
});
