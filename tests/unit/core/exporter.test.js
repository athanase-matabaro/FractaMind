/**
 * Unit tests for exporter.js - Project export and import functionality
 */

import {
  exportProjectJSON,
  importProjectJSON,
  exportMarkdownSummary,
  exportCanvasSVG,
  getExportStats,
} from '../../../src/core/exporter';
import * as indexer from '../../../src/db/fractamind-indexer';
import * as uuid from '../../../src/utils/uuid';

// Mock dependencies
jest.mock('../../../src/db/fractamind-indexer');
jest.mock('../../../src/utils/uuid');

// Mock DOM APIs
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('exporter', () => {
  const mockProjectData = {
    id: 'project-1',
    name: 'Test Project',
    rootNodeId: 'root-1',
    createdAt: '2025-01-01T00:00:00.000Z',
    meta: {
      sourceUrl: 'https://example.com',
      quantParams: { reducedDims: 8, bits: 16 },
    },
  };

  const mockNodes = [
    {
      id: 'root-1',
      title: 'Root Node',
      text: 'Root content',
      children: ['child-1', 'child-2'],
      parent: null,
      embedding: [0.1, 0.2],
      hilbertKeyHex: 'abc123',
      meta: { projectId: 'project-1', depth: 0 },
    },
    {
      id: 'child-1',
      title: 'Child 1',
      text: 'Child 1 content',
      children: [],
      parent: 'root-1',
      embedding: [0.3, 0.4],
      hilbertKeyHex: 'def456',
      meta: { projectId: 'project-1', depth: 1 },
    },
    {
      id: 'child-2',
      title: 'Child 2',
      text: 'Child 2 content',
      children: [],
      parent: 'root-1',
      embedding: [0.5, 0.6],
      hilbertKeyHex: 'ghi789',
      meta: { projectId: 'project-1', depth: 1 },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock document.createElement and appendChild
    document.createElement = jest.fn((tag) => {
      const element = {
        tagName: tag.toUpperCase(),
        href: '',
        download: '',
        click: jest.fn(),
      };
      return element;
    });

    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();
  });

  describe('exportProjectJSON', () => {
    beforeEach(() => {
      indexer.getNode.mockImplementation((nodeId) => {
        if (nodeId === 'project:project-1') {
          return Promise.resolve({
            id: nodeId,
            text: JSON.stringify(mockProjectData),
            meta: mockProjectData.meta,
          });
        }
        return Promise.resolve(mockNodes.find((n) => n.id === nodeId));
      });
    });

    it('should export project with all nodes', async () => {
      global.Blob = jest.fn((content, options) => ({
        content,
        type: options.type,
      }));

      await exportProjectJSON('project-1');

      expect(indexer.getNode).toHaveBeenCalledWith('project:project-1');
      expect(global.Blob).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');

      const blobContent = JSON.parse(global.Blob.mock.calls[0][0][0]);
      expect(blobContent.project.id).toBe('project-1');
      expect(blobContent.nodes).toHaveLength(3);
      expect(blobContent.version).toBeDefined();
    });

    it('should strip embeddings if includeEmbeddings is false', async () => {
      global.Blob = jest.fn((content) => ({ content }));

      await exportProjectJSON('project-1', { includeEmbeddings: false });

      const blobContent = JSON.parse(global.Blob.mock.calls[0][0][0]);
      blobContent.nodes.forEach((node) => {
        expect(node.embedding).toBeUndefined();
      });
    });

    it('should trigger browser download', async () => {
      global.Blob = jest.fn(() => ({}));
      const mockLink = { click: jest.fn(), href: '', download: '' };
      document.createElement.mockReturnValue(mockLink);

      await exportProjectJSON('project-1');

      expect(mockLink.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalled();
    });

    it('should throw error if project not found', async () => {
      indexer.getNode.mockResolvedValue(null);

      await expect(exportProjectJSON('non-existent')).rejects.toThrow(
        'Project non-existent not found'
      );
    });
  });

  describe('importProjectJSON', () => {
    const mockFile = {
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          version: '1.0.0',
          project: mockProjectData,
          nodes: mockNodes,
        })
      ),
    };

    beforeEach(() => {
      indexer.initDB.mockResolvedValue(undefined);
      indexer.saveNode.mockImplementation((node) => Promise.resolve(node));
    });

    it('should import project and save all nodes', async () => {
      const onProgress = jest.fn();

      const projectId = await importProjectJSON(mockFile, { onProgress });

      expect(projectId).toBe('project-1');
      expect(indexer.saveNode).toHaveBeenCalledTimes(4); // 3 nodes + 1 project
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'complete' })
      );
    });

    it.skip('should regenerate IDs if requested', async () => {
      uuid.generateUUID
        .mockReturnValueOnce('new-project-id')
        .mockReturnValueOnce('new-root-id')
        .mockReturnValueOnce('new-child-1-id')
        .mockReturnValueOnce('new-child-2-id');

      const projectId = await importProjectJSON(mockFile, { regenerateIds: true });

      expect(projectId).toBe('new-project-id');

      // Verify IDs were remapped
      const savedNodes = indexer.saveNode.mock.calls.map((call) => call[0]);
      const rootNode = savedNodes.find((n) => n.id === 'new-root-id');

      // Root node should exist with remapped children IDs
      expect(rootNode).toBeDefined();
      if (rootNode) {
        expect(rootNode.children).toEqual(['new-child-1-id', 'new-child-2-id']);
      }
    });

    it('should validate schema and reject invalid data', async () => {
      const invalidFile = {
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            version: '1.0.0',
            // Missing project and nodes
          })
        ),
      };

      await expect(importProjectJSON(invalidFile)).rejects.toThrow('Invalid import file');
    });

    it('should handle version mismatch with warning', async () => {
      const oldVersionFile = {
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            version: '0.5.0',
            project: mockProjectData,
            nodes: mockNodes,
          })
        ),
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await importProjectJSON(oldVersionFile);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('version mismatch'));

      consoleSpy.mockRestore();
    });

    it('should call progress callback at multiple stages', async () => {
      const onProgress = jest.fn();

      await importProjectJSON(mockFile, { onProgress });

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'reading' })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'validating' })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'importing' })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'complete' })
      );
    });
  });

  describe('exportMarkdownSummary', () => {
    beforeEach(() => {
      indexer.getNode.mockImplementation((nodeId) => {
        if (nodeId === 'project:project-1') {
          return Promise.resolve({
            id: nodeId,
            text: JSON.stringify(mockProjectData),
          });
        }
        return Promise.resolve(mockNodes.find((n) => n.id === nodeId));
      });

      global.Blob = jest.fn(() => ({}));
    });

    it('should generate markdown with hierarchical structure', async () => {
      await exportMarkdownSummary('project-1', { depth: 2 });

      expect(global.Blob).toHaveBeenCalled();
      const markdown = global.Blob.mock.calls[0][0][0];

      expect(markdown).toContain('# Test Project');
      expect(markdown).toContain('# Root Node');
      expect(markdown).toContain('## Child 1');
      expect(markdown).toContain('## Child 2');
    });

    it('should include snippets if enabled', async () => {
      await exportMarkdownSummary('project-1', { includeSnippets: true });

      const markdown = global.Blob.mock.calls[0][0][0];

      expect(markdown).toContain('Root content');
      expect(markdown).toContain('Child 1 content');
    });

    it('should respect depth limit', async () => {
      await exportMarkdownSummary('project-1', { depth: 1 });

      const markdown = global.Blob.mock.calls[0][0][0];

      expect(markdown).toContain('# Root Node');
      expect(markdown).toContain('## Child 1'); // Depth 1 includes children
    });
  });

  describe('exportCanvasSVG', () => {
    it('should export canvas as SVG', async () => {
      const mockCanvas = {
        tagName: 'CANVAS',
        width: 800,
        height: 600,
        toDataURL: jest.fn(() => 'data:image/png;base64,mockdata'),
      };

      global.Blob = jest.fn(() => ({}));

      await exportCanvasSVG(mockCanvas);

      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png');
      expect(global.Blob).toHaveBeenCalledWith(
        [expect.stringContaining('<svg')],
        { type: 'image/svg+xml' }
      );
    });

    it('should throw error if element is not a canvas', async () => {
      const notCanvas = { tagName: 'DIV' };

      await expect(exportCanvasSVG(notCanvas)).rejects.toThrow('Invalid canvas element');
    });

    it('should accept canvas selector string', async () => {
      const mockCanvas = {
        tagName: 'CANVAS',
        width: 800,
        height: 600,
        toDataURL: jest.fn(() => 'data:image/png;base64,mockdata'),
      };

      document.querySelector = jest.fn(() => mockCanvas);
      global.Blob = jest.fn(() => ({}));

      await exportCanvasSVG('#my-canvas');

      expect(document.querySelector).toHaveBeenCalledWith('#my-canvas');
      expect(mockCanvas.toDataURL).toHaveBeenCalled();
    });
  });

  describe('getExportStats', () => {
    beforeEach(() => {
      indexer.getNode.mockImplementation((nodeId) => {
        if (nodeId === 'project:project-1') {
          return Promise.resolve({
            id: nodeId,
            text: JSON.stringify(mockProjectData),
          });
        }
        return Promise.resolve(mockNodes.find((n) => n.id === nodeId));
      });
    });

    it('should return export statistics', async () => {
      const stats = await getExportStats('project-1');

      expect(stats.projectName).toBe('Test Project');
      expect(stats.nodeCount).toBe(3);
      expect(stats.totalWords).toBeGreaterThan(0);
      expect(stats.maxDepth).toBe(1);
      expect(stats.estimatedJSONSize).toBeGreaterThan(0);
    });

    it('should return null on error', async () => {
      indexer.getNode.mockRejectedValue(new Error('DB error'));

      const stats = await getExportStats('project-1');

      expect(stats).toBeNull();
    });
  });

  describe('round-trip import/export', () => {
    it('should preserve data through export and import', async () => {
      // Setup mocks for export
      indexer.getNode.mockImplementation((nodeId) => {
        if (nodeId === 'project:project-1') {
          return Promise.resolve({
            id: nodeId,
            text: JSON.stringify(mockProjectData),
            meta: mockProjectData.meta,
          });
        }
        return Promise.resolve(mockNodes.find((n) => n.id === nodeId));
      });

      let exportedData;
      global.Blob = jest.fn((content) => {
        exportedData = content[0];
        return {};
      });

      // Export
      await exportProjectJSON('project-1');

      // Setup mocks for import
      const mockImportFile = {
        text: jest.fn().mockResolvedValue(exportedData),
      };

      indexer.initDB.mockResolvedValue(undefined);
      indexer.saveNode.mockImplementation((node) => Promise.resolve(node));

      // Import
      const importedProjectId = await importProjectJSON(mockImportFile);

      expect(importedProjectId).toBe('project-1');

      // Verify all nodes were saved
      expect(indexer.saveNode).toHaveBeenCalledTimes(4); // 3 nodes + 1 project

      // Verify node data preserved
      const savedNodes = indexer.saveNode.mock.calls.map((call) => call[0]);
      expect(savedNodes).toHaveLength(4);
    });
  });
});
