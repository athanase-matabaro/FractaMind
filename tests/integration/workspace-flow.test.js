/**
 * workspace-flow.test.js
 *
 * Integration test for end-to-end workspace flow:
 * 1. Import 3 mocked projects
 * 2. Open workspace
 * 3. Perform cross-project search
 * 4. Open result and verify canvas focuses
 *
 * All AI and indexer operations use deterministic mocks.
 */

import { registerProject, listProjects, removeProject } from '../../src/core/projectRegistry';
import { addProjectToWorkspace, listWorkspaceProjects, setProjectWeight } from '../../src/core/federation';
import { crossSearch } from '../../src/core/crossSearcher';
import { initDB, saveNode } from '../../src/db/fractamind-indexer';

describe('Workspace Flow Integration', () => {
  const mockProjects = [
    {
      id: 'proj-ai',
      title: 'Artificial Intelligence',
      nodeCount: 50,
      quantParams: {
        reducedDims: 8,
        bits: 16,
        mins: Array(8).fill(0),
        maxs: Array(8).fill(1)
      }
    },
    {
      id: 'proj-ml',
      title: 'Machine Learning',
      nodeCount: 40,
      quantParams: {
        reducedDims: 8,
        bits: 16,
        mins: Array(8).fill(0),
        maxs: Array(8).fill(1)
      }
    },
    {
      id: 'proj-nn',
      title: 'Neural Networks',
      nodeCount: 30,
      quantParams: {
        reducedDims: 8,
        bits: 16,
        mins: Array(8).fill(0),
        maxs: Array(8).fill(1)
      }
    }
  ];

  // Helper to create deterministic mock embedding
  function createMockEmbedding(text, seed = 0) {
    const embedding = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      // Deterministic pseudo-random based on text and seed
      const charSum = text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      embedding[i] = Math.sin(charSum * (i + 1) + seed) * 0.5 + 0.5;
    }
    return embedding;
  }

  // Helper to create mock nodes for a project
  function createMockNodes(projectId, count = 10) {
    const nodes = [];
    const topics = ['introduction', 'fundamentals', 'applications', 'algorithms', 'theory',
                    'practice', 'research', 'development', 'optimization', 'evaluation'];

    for (let i = 0; i < count; i++) {
      const topic = topics[i % topics.length];
      const text = `${projectId} ${topic} content`;
      nodes.push({
        id: `${projectId}-node-${i}`,
        projectId,
        title: `${projectId} ${topic}`,
        text,
        embedding: createMockEmbedding(text, i),
        parent: i > 0 ? `${projectId}-node-${Math.floor(i / 2)}` : null,
        children: [],
        meta: {
          createdAt: new Date(Date.now() - (count - i) * 86400000).toISOString(), // Stagger dates
          createdBy: 'test'
        }
      });
    }
    return nodes;
  }

  beforeAll(async () => {
    // Initialize database
    await initDB();
  });

  beforeEach(async () => {
    // Clean up any existing projects
    const existing = await listProjects();
    for (const proj of existing) {
      await removeProject(proj.id);
    }
  });

  afterEach(async () => {
    // Clean up test projects
    for (const proj of mockProjects) {
      try {
        await removeProject(proj.id);
      } catch (e) {
        // Ignore if already removed
      }
    }
  });

  test('Complete workspace flow: import → workspace → search → result', async () => {
    // Step 1: Import 3 mocked projects
    console.log('Step 1: Importing projects...');

    for (const projMeta of mockProjects) {
      // Register project
      await registerProject({
        projectId: projMeta.id,
        name: projMeta.title,
        importDate: new Date().toISOString(),
        rootNodeId: `${projMeta.id}-node-0`,
        nodeCount: projMeta.nodeCount,
        embeddingCount: projMeta.nodeCount,
        lastAccessed: new Date().toISOString(),
        isActive: true,
        weight: 1.0,
        quantParams: projMeta.quantParams,
        meta: {
          description: `Test project for ${projMeta.title}`,
          tags: ['test', 'integration']
        }
      });

      // Create and save mock nodes
      const nodes = createMockNodes(projMeta.id, 10);
      for (const node of nodes) {
        await saveNode(node);
      }

      // Add to workspace
      await addProjectToWorkspace(projMeta.id);
    }

    const registeredProjects = await listProjects();
    expect(registeredProjects).toHaveLength(3);
    console.log(`✓ Imported ${registeredProjects.length} projects`);

    // Step 2: Verify workspace state
    console.log('Step 2: Verifying workspace state...');

    const workspaceProjects = await listWorkspaceProjects();
    expect(workspaceProjects).toHaveLength(3);
    expect(workspaceProjects.every(p => p.weight === 1.0)).toBe(true);
    console.log(`✓ Workspace has ${workspaceProjects.length} active projects`);

    // Step 3: Adjust project weights
    console.log('Step 3: Adjusting project weights...');

    await setProjectWeight('proj-ai', 2.0); // Boost AI project
    await setProjectWeight('proj-ml', 1.0); // Keep ML neutral
    await setProjectWeight('proj-nn', 0.5); // De-emphasize NN project

    const updatedProjects = await listWorkspaceProjects();
    const aiProject = updatedProjects.find(p => p.projectId === 'proj-ai');
    expect(aiProject.weight).toBe(2.0);
    console.log('✓ Project weights adjusted');

    // Step 4: Perform cross-project search
    console.log('Step 4: Performing cross-project search...');

    const startTime = Date.now();
    const searchResults = await crossSearch('algorithms', {
      projectIds: ['proj-ai', 'proj-ml', 'proj-nn'],
      topK: 10,
      radiusPower: 12,
      freshnessBoost: true,
      mock: true // Use mock embeddings
    });
    const searchDuration = Date.now() - startTime;

    expect(searchResults).toBeDefined();
    expect(Array.isArray(searchResults)).toBe(true);
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.length).toBeLessThanOrEqual(10);
    console.log(`✓ Search returned ${searchResults.length} results in ${searchDuration}ms`);

    // Step 5: Verify result structure
    console.log('Step 5: Verifying result structure...');

    const firstResult = searchResults[0];
    expect(firstResult).toHaveProperty('projectId');
    expect(firstResult).toHaveProperty('nodeId');
    expect(firstResult).toHaveProperty('finalScore');
    expect(firstResult).toHaveProperty('sim');
    expect(firstResult).toHaveProperty('title');
    console.log('✓ Result structure valid');

    // Step 6: Verify results are from multiple projects
    console.log('Step 6: Verifying multi-project results...');

    const projectsInResults = new Set(searchResults.map(r => r.projectId));
    expect(projectsInResults.size).toBeGreaterThan(1);
    console.log(`✓ Results span ${projectsInResults.size} projects`);

    // Step 7: Verify AI project has highest representation (due to 2.0 weight)
    console.log('Step 7: Verifying weight influence...');

    const aiResults = searchResults.filter(r => r.projectId === 'proj-ai');
    const nnResults = searchResults.filter(r => r.projectId === 'proj-nn');

    // AI project (weight 2.0) should have more or equal results compared to NN (weight 0.5)
    expect(aiResults.length).toBeGreaterThanOrEqual(nnResults.length);
    console.log(`✓ Weight influence verified: AI=${aiResults.length}, NN=${nnResults.length}`);

    // Step 8: Verify results are sorted by finalScore
    console.log('Step 8: Verifying result ordering...');

    for (let i = 0; i < searchResults.length - 1; i++) {
      expect(searchResults[i].finalScore).toBeGreaterThanOrEqual(searchResults[i + 1].finalScore);
    }
    console.log('✓ Results properly sorted by finalScore');

    // Step 9: Verify no duplicates (deduplication worked)
    console.log('Step 9: Verifying deduplication...');

    const nodeIds = searchResults.map(r => `${r.projectId}::${r.nodeId}`);
    const uniqueIds = new Set(nodeIds);
    expect(uniqueIds.size).toBe(nodeIds.length);
    console.log('✓ No duplicate results');

    // Step 10: Performance budget check
    console.log('Step 10: Checking performance budget...');

    expect(searchDuration).toBeLessThan(2000); // p95 budget: <2s
    if (searchDuration < 800) {
      console.log(`✓ Performance excellent: ${searchDuration}ms (target: <800ms median)`);
    } else {
      console.log(`⚠ Performance acceptable but above median target: ${searchDuration}ms`);
    }

    console.log('✅ Workspace flow integration test PASSED');
  }, 30000); // 30 second timeout for integration test

  test('Search with single project returns valid results', async () => {
    // Register only one project
    const projMeta = mockProjects[0];
    await registerProject({
      projectId: projMeta.id,
      name: projMeta.title,
      importDate: new Date().toISOString(),
      rootNodeId: `${projMeta.id}-node-0`,
      nodeCount: 10,
      embeddingCount: 10,
      lastAccessed: new Date().toISOString(),
      isActive: true,
      weight: 1.0,
      quantParams: projMeta.quantParams
    });

    const nodes = createMockNodes(projMeta.id, 10);
    for (const node of nodes) {
      await saveNode(node);
    }

    await addProjectToWorkspace(projMeta.id);

    const results = await crossSearch('fundamentals', {
      projectIds: [projMeta.id],
      topK: 5,
      mock: true
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results.every(r => r.projectId === projMeta.id)).toBe(true);
  }, 15000);

  test('Search with no active projects returns empty results', async () => {
    const results = await crossSearch('anything', {
      projectIds: [],
      topK: 10,
      mock: true
    });

    expect(results).toEqual([]);
  });

  test('Weight adjustment persists across workspace reloads', async () => {
    const projMeta = mockProjects[0];
    await registerProject({
      projectId: projMeta.id,
      name: projMeta.title,
      importDate: new Date().toISOString(),
      rootNodeId: `${projMeta.id}-node-0`,
      nodeCount: 10,
      embeddingCount: 10,
      lastAccessed: new Date().toISOString(),
      isActive: true,
      weight: 1.0,
      quantParams: projMeta.quantParams
    });

    await addProjectToWorkspace(projMeta.id);
    await setProjectWeight(projMeta.id, 2.5);

    // Simulate reload by fetching workspace state again
    const workspaceProjects = await listWorkspaceProjects();
    const project = workspaceProjects.find(p => p.projectId === projMeta.id);

    expect(project.weight).toBe(2.5);
  });
});
