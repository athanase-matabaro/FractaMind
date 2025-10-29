/**
 * projectRegistry.js
 *
 * Manages metadata for federated projects in the workspace.
 * Persists project registry in IndexedDB for multi-session support.
 *
 * Project Metadata Schema:
 * {
 *   projectId: string (uuid),
 *   name: string (user-provided or auto-generated),
 *   importDate: ISO8601 timestamp,
 *   rootNodeId: string (entry point for navigation),
 *   nodeCount: number,
 *   embeddingCount: number,
 *   lastAccessed: ISO8601 timestamp,
 *   isActive: boolean (included in workspace searches),
 *   weight: number (0.1-2.0, search ranking multiplier),
 *   meta: {
 *     sourceUrl?: string,
 *     description?: string,
 *     tags?: string[]
 *   }
 * }
 *
 * API:
 * - initRegistry() - Initialize registry store
 * - registerProject(metadata) - Add or update project
 * - getProject(projectId) - Retrieve project metadata
 * - listProjects({ activeOnly = false }) - List all or active projects
 * - updateProject(projectId, updates) - Partial update
 * - deleteProject(projectId) - Remove project from registry
 * - setProjectActive(projectId, isActive) - Toggle search inclusion
 * - setProjectWeight(projectId, weight) - Adjust ranking bias
 * - touchProject(projectId) - Update lastAccessed timestamp
 * - getProjectStats() - Aggregate statistics
 */

const DB_NAME = 'fractamind-federation-db';
const DB_VERSION = 1;
const STORE_REGISTRY = 'projectRegistry';

let dbInstance = null;

/**
 * Open or upgrade federation database
 */
function openRegistryDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_REGISTRY)) {
        const store = db.createObjectStore(STORE_REGISTRY, { keyPath: 'projectId' });
        store.createIndex('byName', 'name', { unique: false });
        store.createIndex('byImportDate', 'importDate', { unique: false });
        store.createIndex('byLastAccessed', 'lastAccessed', { unique: false });
        store.createIndex('byActive', 'isActive', { unique: false });
      }
    };

    req.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get database instance (opens if needed)
 */
async function getDB() {
  if (!dbInstance) {
    await openRegistryDB();
  }
  return dbInstance;
}

/**
 * Initialize registry database
 * @returns {Promise<void>}
 */
export async function initRegistry() {
  await getDB();
}

/**
 * Register a new project or update existing
 * @param {Object} metadata - Project metadata
 * @returns {Promise<Object>} - Saved project metadata
 */
export async function registerProject(metadata) {
  const db = await getDB();

  // Validate required fields
  if (!metadata.projectId) {
    throw new Error('projectId is required');
  }
  if (!metadata.name) {
    throw new Error('Project name is required');
  }

  // Set defaults
  const project = {
    projectId: metadata.projectId,
    name: metadata.name,
    importDate: metadata.importDate || new Date().toISOString(),
    rootNodeId: metadata.rootNodeId || null,
    nodeCount: metadata.nodeCount || 0,
    embeddingCount: metadata.embeddingCount || 0,
    lastAccessed: new Date().toISOString(),
    isActive: metadata.isActive !== undefined ? metadata.isActive : true,
    weight: metadata.weight || 1.0,
    meta: metadata.meta || {}
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_REGISTRY], 'readwrite');
    const store = tx.objectStore(STORE_REGISTRY);
    const req = store.put(project);

    req.onsuccess = () => resolve(project);
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get project metadata by ID
 * @param {string} projectId
 * @returns {Promise<Object|null>}
 */
export async function getProject(projectId) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_REGISTRY], 'readonly');
    const store = tx.objectStore(STORE_REGISTRY);
    const req = store.get(projectId);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * List all projects
 * @param {Object} options
 * @param {boolean} options.activeOnly - Only return active projects
 * @returns {Promise<Array>}
 */
export async function listProjects({ activeOnly = false } = {}) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_REGISTRY], 'readonly');
    const store = tx.objectStore(STORE_REGISTRY);

    let req;
    if (activeOnly) {
      const index = store.index('byActive');
      req = index.getAll(true);
    } else {
      req = store.getAll();
    }

    req.onsuccess = () => {
      const projects = req.result || [];
      // Sort by lastAccessed (most recent first)
      projects.sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed));
      resolve(projects);
    };
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Update project metadata (partial update)
 * @param {string} projectId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateProject(projectId, updates) {
  const project = await getProject(projectId);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const updated = { ...project, ...updates, projectId }; // Preserve ID
  return registerProject(updated);
}

/**
 * Delete project from registry
 * @param {string} projectId
 * @returns {Promise<void>}
 */
export async function deleteProject(projectId) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_REGISTRY], 'readwrite');
    const store = tx.objectStore(STORE_REGISTRY);
    const req = store.delete(projectId);

    req.onsuccess = () => resolve();
    req.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Toggle project active state
 * @param {string} projectId
 * @param {boolean} isActive
 * @returns {Promise<Object>}
 */
export async function setProjectActive(projectId, isActive) {
  return updateProject(projectId, { isActive });
}

/**
 * Set project search weight
 * @param {string} projectId
 * @param {number} weight - 0.1 to 2.0
 * @returns {Promise<Object>}
 */
export async function setProjectWeight(projectId, weight) {
  if (weight < 0.1 || weight > 2.0) {
    throw new Error('Project weight must be between 0.1 and 2.0');
  }
  return updateProject(projectId, { weight });
}

/**
 * Update lastAccessed timestamp
 * @param {string} projectId
 * @returns {Promise<Object>}
 */
export async function touchProject(projectId) {
  return updateProject(projectId, { lastAccessed: new Date().toISOString() });
}

/**
 * Get aggregate statistics for all projects
 * @returns {Promise<Object>}
 */
export async function getProjectStats() {
  const projects = await listProjects();

  return {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.isActive).length,
    totalNodes: projects.reduce((sum, p) => sum + (p.nodeCount || 0), 0),
    totalEmbeddings: projects.reduce((sum, p) => sum + (p.embeddingCount || 0), 0),
    averageWeight: projects.length > 0
      ? projects.reduce((sum, p) => sum + p.weight, 0) / projects.length
      : 1.0,
    oldestImport: projects.length > 0
      ? projects.reduce((oldest, p) =>
          new Date(p.importDate) < new Date(oldest) ? p.importDate : oldest,
          projects[0].importDate
        )
      : null,
    newestImport: projects.length > 0
      ? projects.reduce((newest, p) =>
          new Date(p.importDate) > new Date(newest) ? p.importDate : newest,
          projects[0].importDate
        )
      : null
  };
}

/**
 * Clear all projects (for testing/reset)
 * @returns {Promise<void>}
 */
export async function clearAllProjects() {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_REGISTRY], 'readwrite');
    const store = tx.objectStore(STORE_REGISTRY);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = (event) => reject(event.target.error);
  });
}
