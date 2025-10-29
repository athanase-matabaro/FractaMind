/**
 * Tests for projectRegistry.js
 *
 * Coverage:
 * - Database initialization
 * - Project CRUD operations
 * - Active/inactive toggling
 * - Weight adjustment
 * - Statistics aggregation
 * - Error handling
 */

import {
  initRegistry,
  registerProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  setProjectActive,
  setProjectWeight,
  touchProject,
  getProjectStats,
  clearAllProjects
} from '../src/core/projectRegistry.js';

// Mock IndexedDB
let mockStore = new Map();
let mockDB = null;

const createMockRequest = (result = null, error = null) => {
  const request = {
    result,
    error,
    onsuccess: null,
    onerror: null
  };

  setTimeout(() => {
    if (error) {
      if (request.onerror) request.onerror({ target: request });
    } else {
      if (request.onsuccess) request.onsuccess({ target: request });
    }
  }, 0);

  return request;
};

global.indexedDB = {
  open: jest.fn((name, version) => {
    const request = {
      result: null,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null
    };

    setTimeout(() => {
      mockDB = {
        objectStoreNames: {
          contains: (storeName) => storeName === 'projectRegistry'
        },
        createObjectStore: jest.fn((storeName, options) => {
          return {
            createIndex: jest.fn()
          };
        }),
        transaction: (storeNames, mode) => ({
          objectStore: (storeName) => ({
            put: (record) => {
              mockStore.set(record.projectId, record);
              return createMockRequest(record.projectId);
            },
            get: (key) => {
              const record = mockStore.get(key);
              return createMockRequest(record || null);
            },
            getAll: () => {
              return createMockRequest(Array.from(mockStore.values()));
            },
            delete: (key) => {
              mockStore.delete(key);
              return createMockRequest();
            },
            clear: () => {
              mockStore.clear();
              return createMockRequest();
            },
            index: (indexName) => ({
              getAll: (value) => {
                const results = Array.from(mockStore.values())
                  .filter(record => {
                    if (indexName === 'byActive') {
                      return record.isActive === value;
                    }
                    return true;
                  });
                return createMockRequest(results);
              }
            })
          }),
          oncomplete: null,
          onerror: null
        })
      };

      // Trigger onupgradeneeded if needed
      if (request.onupgradeneeded) {
        request.onupgradeneeded({ target: { result: mockDB } });
      }

      request.result = mockDB;
      if (request.onsuccess) request.onsuccess({ target: request });
    }, 0);

    return request;
  })
};

describe('ProjectRegistry', () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  describe('initRegistry', () => {
    it('should initialize the registry database', async () => {
      await initRegistry();
      expect(global.indexedDB.open).toHaveBeenCalledWith('fractamind-federation-db', 1);
    });
  });

  describe('registerProject', () => {
    beforeEach(async () => {
      await initRegistry();
    });

    it('should register a new project with all fields', async () => {
      const project = await registerProject({
        projectId: 'proj-1',
        name: 'Test Project',
        rootNodeId: 'node-root',
        nodeCount: 10,
        embeddingCount: 8
      });

      expect(project.projectId).toBe('proj-1');
      expect(project.name).toBe('Test Project');
      expect(project.nodeCount).toBe(10);
      expect(project.embeddingCount).toBe(8);
      expect(project.isActive).toBe(true);
      expect(project.weight).toBe(1.0);
      expect(project.importDate).toBeDefined();
      expect(project.lastAccessed).toBeDefined();
    });

    it('should apply default values for optional fields', async () => {
      const project = await registerProject({
        projectId: 'proj-2',
        name: 'Minimal Project'
      });

      expect(project.nodeCount).toBe(0);
      expect(project.embeddingCount).toBe(0);
      expect(project.rootNodeId).toBeNull();
      expect(project.isActive).toBe(true);
      expect(project.weight).toBe(1.0);
      expect(project.meta).toEqual({});
    });

    it('should throw error if projectId is missing', async () => {
      await expect(
        registerProject({ name: 'No ID Project' })
      ).rejects.toThrow('projectId is required');
    });

    it('should throw error if name is missing', async () => {
      await expect(
        registerProject({ projectId: 'proj-3' })
      ).rejects.toThrow('Project name is required');
    });

    it('should update existing project when re-registered', async () => {
      await registerProject({
        projectId: 'proj-4',
        name: 'Original Name',
        nodeCount: 5
      });

      const updated = await registerProject({
        projectId: 'proj-4',
        name: 'Updated Name',
        nodeCount: 10
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.nodeCount).toBe(10);
    });
  });

  describe('getProject', () => {
    beforeEach(async () => {
      await initRegistry();
      await registerProject({
        projectId: 'proj-5',
        name: 'Retrievable Project',
        nodeCount: 15
      });
    });

    it('should retrieve existing project by ID', async () => {
      const project = await getProject('proj-5');

      expect(project).toBeDefined();
      expect(project.projectId).toBe('proj-5');
      expect(project.name).toBe('Retrievable Project');
      expect(project.nodeCount).toBe(15);
    });

    it('should return null for non-existent project', async () => {
      const project = await getProject('non-existent');
      expect(project).toBeNull();
    });
  });

  describe('listProjects', () => {
    beforeEach(async () => {
      await initRegistry();
      await registerProject({
        projectId: 'proj-6',
        name: 'Active Project',
        isActive: true,
        importDate: '2025-10-25T10:00:00.000Z',
        lastAccessed: '2025-10-29T10:00:00.000Z'
      });
      await registerProject({
        projectId: 'proj-7',
        name: 'Inactive Project',
        isActive: false,
        importDate: '2025-10-26T10:00:00.000Z',
        lastAccessed: '2025-10-28T10:00:00.000Z'
      });
      await registerProject({
        projectId: 'proj-8',
        name: 'Another Active Project',
        isActive: true,
        importDate: '2025-10-27T10:00:00.000Z',
        lastAccessed: '2025-10-29T12:00:00.000Z'
      });
    });

    it('should list all projects when activeOnly is false', async () => {
      const projects = await listProjects({ activeOnly: false });

      expect(projects).toHaveLength(3);
      expect(projects.map(p => p.projectId)).toContain('proj-6');
      expect(projects.map(p => p.projectId)).toContain('proj-7');
      expect(projects.map(p => p.projectId)).toContain('proj-8');
    });

    it('should list only active projects when activeOnly is true', async () => {
      const projects = await listProjects({ activeOnly: true });

      expect(projects).toHaveLength(2);
      expect(projects.map(p => p.projectId)).toContain('proj-6');
      expect(projects.map(p => p.projectId)).toContain('proj-8');
      expect(projects.map(p => p.projectId)).not.toContain('proj-7');
    });

    it('should sort projects by lastAccessed (most recent first)', async () => {
      const projects = await listProjects({ activeOnly: false });

      // Verify sorting: most recent should be first
      const dates = projects.map(p => new Date(p.lastAccessed).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }

      // proj-8 should be first (most recent)
      expect(projects[0].projectId).toBe('proj-8');
    });
  });

  describe('updateProject', () => {
    beforeEach(async () => {
      await initRegistry();
      await registerProject({
        projectId: 'proj-9',
        name: 'Original Project',
        nodeCount: 20,
        weight: 1.0
      });
    });

    it('should update project fields', async () => {
      const updated = await updateProject('proj-9', {
        nodeCount: 30,
        weight: 1.5
      });

      expect(updated.nodeCount).toBe(30);
      expect(updated.weight).toBe(1.5);
      expect(updated.name).toBe('Original Project'); // Unchanged
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        updateProject('non-existent', { nodeCount: 10 })
      ).rejects.toThrow('Project non-existent not found');
    });

    it('should preserve projectId even if included in updates', async () => {
      const updated = await updateProject('proj-9', {
        projectId: 'different-id', // Should be ignored
        name: 'New Name'
      });

      expect(updated.projectId).toBe('proj-9');
      expect(updated.name).toBe('New Name');
    });
  });

  describe('deleteProject', () => {
    beforeEach(async () => {
      await initRegistry();
      await registerProject({
        projectId: 'proj-10',
        name: 'To Be Deleted'
      });
    });

    it('should delete project by ID', async () => {
      await deleteProject('proj-10');

      const project = await getProject('proj-10');
      expect(project).toBeNull();
    });

    it('should not throw error for non-existent project', async () => {
      await expect(deleteProject('non-existent')).resolves.not.toThrow();
    });
  });

  describe('setProjectActive', () => {
    beforeEach(async () => {
      await initRegistry();
      await registerProject({
        projectId: 'proj-11',
        name: 'Toggle Project',
        isActive: true
      });
    });

    it('should set project to inactive', async () => {
      const updated = await setProjectActive('proj-11', false);
      expect(updated.isActive).toBe(false);
    });

    it('should set project to active', async () => {
      await setProjectActive('proj-11', false);
      const updated = await setProjectActive('proj-11', true);
      expect(updated.isActive).toBe(true);
    });
  });

  describe('setProjectWeight', () => {
    beforeEach(async () => {
      await initRegistry();
      await registerProject({
        projectId: 'proj-12',
        name: 'Weight Project',
        weight: 1.0
      });
    });

    it('should update project weight', async () => {
      const updated = await setProjectWeight('proj-12', 1.5);
      expect(updated.weight).toBe(1.5);
    });

    it('should accept minimum weight (0.1)', async () => {
      const updated = await setProjectWeight('proj-12', 0.1);
      expect(updated.weight).toBe(0.1);
    });

    it('should accept maximum weight (2.0)', async () => {
      const updated = await setProjectWeight('proj-12', 2.0);
      expect(updated.weight).toBe(2.0);
    });

    it('should throw error for weight below minimum', async () => {
      await expect(
        setProjectWeight('proj-12', 0.05)
      ).rejects.toThrow('Project weight must be between 0.1 and 2.0');
    });

    it('should throw error for weight above maximum', async () => {
      await expect(
        setProjectWeight('proj-12', 2.5)
      ).rejects.toThrow('Project weight must be between 0.1 and 2.0');
    });
  });

  describe('touchProject', () => {
    beforeEach(async () => {
      await initRegistry();
      await registerProject({
        projectId: 'proj-13',
        name: 'Touch Project',
        lastAccessed: '2025-10-20T10:00:00.000Z'
      });
    });

    it('should update lastAccessed timestamp', async () => {
      const before = new Date('2025-10-20T10:00:00.000Z');

      await new Promise(resolve => setTimeout(resolve, 10));
      const updated = await touchProject('proj-13');

      const after = new Date(updated.lastAccessed);
      expect(after.getTime()).toBeGreaterThan(before.getTime());
    });
  });

  describe('getProjectStats', () => {
    beforeEach(async () => {
      await initRegistry();
    });

    it('should return correct stats for multiple projects', async () => {
      await registerProject({
        projectId: 'proj-14',
        name: 'Stats Project 1',
        nodeCount: 50,
        embeddingCount: 45,
        weight: 1.0,
        isActive: true,
        importDate: '2025-10-25T10:00:00.000Z'
      });
      await registerProject({
        projectId: 'proj-15',
        name: 'Stats Project 2',
        nodeCount: 30,
        embeddingCount: 25,
        weight: 1.5,
        isActive: true,
        importDate: '2025-10-27T10:00:00.000Z'
      });
      await registerProject({
        projectId: 'proj-16',
        name: 'Stats Project 3',
        nodeCount: 20,
        embeddingCount: 15,
        weight: 0.5,
        isActive: false,
        importDate: '2025-10-26T10:00:00.000Z'
      });

      const stats = await getProjectStats();

      expect(stats.totalProjects).toBe(3);
      expect(stats.activeProjects).toBe(2);
      expect(stats.totalNodes).toBe(100); // 50 + 30 + 20
      expect(stats.totalEmbeddings).toBe(85); // 45 + 25 + 15
      expect(stats.averageWeight).toBe(1.0); // (1.0 + 1.5 + 0.5) / 3
      expect(stats.oldestImport).toBe('2025-10-25T10:00:00.000Z');
      expect(stats.newestImport).toBe('2025-10-27T10:00:00.000Z');
    });

    it('should return empty stats for no projects', async () => {
      const stats = await getProjectStats();

      expect(stats.totalProjects).toBe(0);
      expect(stats.activeProjects).toBe(0);
      expect(stats.totalNodes).toBe(0);
      expect(stats.totalEmbeddings).toBe(0);
      expect(stats.averageWeight).toBe(1.0);
      expect(stats.oldestImport).toBeNull();
      expect(stats.newestImport).toBeNull();
    });
  });

  describe('clearAllProjects', () => {
    beforeEach(async () => {
      await initRegistry();
      await registerProject({ projectId: 'proj-17', name: 'Clear Test 1' });
      await registerProject({ projectId: 'proj-18', name: 'Clear Test 2' });
    });

    it('should clear all projects', async () => {
      await clearAllProjects();

      const projects = await listProjects();
      expect(projects).toHaveLength(0);
    });
  });
});
