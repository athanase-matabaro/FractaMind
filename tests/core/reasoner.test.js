/**
 * reasoner.test.js - Phase 7: Reasoner Unit Tests
 *
 * Tests for cross-project reasoning engine:
 * - Relation inference with depth exploration
 * - Chain finding (BFS graph traversal)
 * - Confidence blending
 * - Mock mode determinism
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { inferRelations, findChains, generateReasoningTranscript } from '../../src/core/reasoner.js';
import { addProject, clearCache } from '../../src/core/federated_indexer.js';
import { initDB, saveNode } from '../../src/db/fractamind-indexer.js';
import { saveLink } from '../../src/core/linker.js';

// Test setup helpers
async function createTestNode(id, title, embedding, projectId = 'test-proj-1') {
  const node = {
    id,
    title,
    text: `Test node: ${title}`,
    embedding,
    hilbertKeyHex: '0000000000000000', // Simplified for testing
    projectId,
    createdAt: new Date().toISOString(),
    meta: {},
  };

  await saveNode(node);
  return node;
}

async function createTestLink(sourceId, targetId, relationType = 'related', confidence = 0.8, projectId = 'test-proj-1') {
  const link = {
    linkId: `link-${sourceId}-${targetId}`,
    projectId,
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    relationType,
    confidence,
    provenance: { method: 'test', timestamp: new Date().toISOString() },
    active: true,
    createdAt: new Date().toISOString(),
  };

  await saveLink(link);
  return link;
}

// Simple embedding generator for testing
function generateEmbedding(seed) {
  const embedding = new Array(512);
  for (let i = 0; i < 512; i++) {
    embedding[i] = Math.sin(seed + i) * 0.5 + 0.5; // Normalize to [0, 1]
  }
  return embedding;
}

describe('Reasoner: inferRelations', () => {
  beforeEach(async () => {
    await initDB();
    clearCache();
  });

  it('should infer relations in mock mode (deterministic)', async () => {
    // Create test nodes
    const node1 = await createTestNode('node-1', 'Node 1', generateEmbedding(1), 'proj-a');
    const node2 = await createTestNode('node-2', 'Node 2', generateEmbedding(1.1), 'proj-a');
    const node3 = await createTestNode('node-3', 'Node 3', generateEmbedding(1.2), 'proj-b');

    // Add to federated cache
    await addProject('proj-a', [node1, node2]);
    await addProject('proj-b', [node3]);

    // Infer relations
    const relations = await inferRelations({
      startNodeId: 'node-1',
      projects: ['proj-a', 'proj-b'],
      depth: 1,
      topK: 10,
      mode: 'mock',
      threshold: 0.1, // Low threshold for testing
    });

    expect(relations).toBeDefined();
    expect(Array.isArray(relations)).toBe(true);
    expect(relations.length).toBeGreaterThan(0);

    // Check relation structure
    const rel = relations[0];
    expect(rel).toHaveProperty('candidateNodeId');
    expect(rel).toHaveProperty('projectId');
    expect(rel).toHaveProperty('relationType');
    expect(rel).toHaveProperty('confidence');
    expect(rel).toHaveProperty('rationale');
    expect(rel).toHaveProperty('signals');

    // Confidence should be in [0, 1]
    expect(rel.confidence).toBeGreaterThanOrEqual(0);
    expect(rel.confidence).toBeLessThanOrEqual(1);
  });

  it('should respect depth parameter (multi-hop exploration)', async () => {
    // Create chain: node-1 -> node-2 -> node-3
    const node1 = await createTestNode('node-1', 'Start', generateEmbedding(1), 'proj-a');
    const node2 = await createTestNode('node-2', 'Middle', generateEmbedding(1.1), 'proj-a');
    const node3 = await createTestNode('node-3', 'End', generateEmbedding(1.2), 'proj-b');

    await addProject('proj-a', [node1, node2]);
    await addProject('proj-b', [node3]);

    // Depth 1: should find node-2
    const relationsDepth1 = await inferRelations({
      startNodeId: 'node-1',
      projects: ['proj-a', 'proj-b'],
      depth: 1,
      topK: 10,
      mode: 'mock',
      threshold: 0.1,
    });

    expect(relationsDepth1.every(r => r.depth === 1)).toBe(true);

    // Depth 2: may find node-3 through node-2
    const relationsDepth2 = await inferRelations({
      startNodeId: 'node-1',
      projects: ['proj-a', 'proj-b'],
      depth: 2,
      topK: 10,
      mode: 'mock',
      threshold: 0.1,
    });

    // Should have relations at depth 1 and possibly depth 2
    const maxDepth = Math.max(...relationsDepth2.map(r => r.depth));
    expect(maxDepth).toBeGreaterThanOrEqual(1);
  });

  it('should filter by threshold', async () => {
    const node1 = await createTestNode('node-1', 'Node 1', generateEmbedding(1), 'proj-a');
    const node2 = await createTestNode('node-2', 'Node 2', generateEmbedding(10), 'proj-a'); // Very different embedding

    await addProject('proj-a', [node1, node2]);

    // High threshold
    const highThreshold = await inferRelations({
      startNodeId: 'node-1',
      projects: ['proj-a'],
      depth: 1,
      topK: 10,
      mode: 'mock',
      threshold: 0.9, // Very high
    });

    // Low threshold
    const lowThreshold = await inferRelations({
      startNodeId: 'node-1',
      projects: ['proj-a'],
      depth: 1,
      topK: 10,
      mode: 'mock',
      threshold: 0.1, // Very low
    });

    expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
  });
});

describe('Reasoner: findChains', () => {
  beforeEach(async () => {
    await initDB();
    clearCache();
  });

  it('should find direct chain between connected nodes', async () => {
    // Create nodes
    await createTestNode('node-a', 'A', generateEmbedding(1), 'proj-1');
    await createTestNode('node-b', 'B', generateEmbedding(2), 'proj-1');

    // Create link: A -> B
    await createTestLink('node-a', 'node-b', 'clarifies', 0.9, 'proj-1');

    const chains = await findChains({
      sourceId: 'node-a',
      targetId: 'node-b',
      maxDepth: 3,
      maxChains: 5,
      projects: ['proj-1'],
    });

    expect(chains).toBeDefined();
    expect(Array.isArray(chains)).toBe(true);

    if (chains.length > 0) {
      const chain = chains[0];
      expect(chain).toHaveProperty('nodes');
      expect(chain).toHaveProperty('relations');
      expect(chain).toHaveProperty('combinedConfidence');
      expect(chain.nodes).toContain('node-a');
      expect(chain.nodes).toContain('node-b');
    }
  });

  it('should find multi-hop chains', async () => {
    // Create chain: A -> B -> C
    await createTestNode('node-a', 'A', generateEmbedding(1), 'proj-1');
    await createTestNode('node-b', 'B', generateEmbedding(2), 'proj-1');
    await createTestNode('node-c', 'C', generateEmbedding(3), 'proj-1');

    await createTestLink('node-a', 'node-b', 'clarifies', 0.9, 'proj-1');
    await createTestLink('node-b', 'node-c', 'elaborates', 0.8, 'proj-1');

    const chains = await findChains({
      sourceId: 'node-a',
      targetId: 'node-c',
      maxDepth: 3,
      maxChains: 5,
      projects: ['proj-1'],
    });

    expect(chains.length).toBeGreaterThan(0);

    const chain = chains[0];
    expect(chain.nodes.length).toBe(3);
    expect(chain.relations.length).toBe(2);
    expect(chain.nodes).toEqual(['node-a', 'node-b', 'node-c']);
  });

  it('should return empty array for disconnected nodes', async () => {
    await createTestNode('node-x', 'X', generateEmbedding(1), 'proj-1');
    await createTestNode('node-y', 'Y', generateEmbedding(2), 'proj-1');

    // No links between them

    const chains = await findChains({
      sourceId: 'node-x',
      targetId: 'node-y',
      maxDepth: 3,
      maxChains: 5,
      projects: ['proj-1'],
    });

    expect(chains).toEqual([]);
  });

  it('should handle cycles gracefully (no infinite loops)', async () => {
    await createTestNode('node-1', '1', generateEmbedding(1), 'proj-1');
    await createTestNode('node-2', '2', generateEmbedding(2), 'proj-1');

    // Create cycle: 1 -> 2 -> 1
    await createTestLink('node-1', 'node-2', 'related', 0.8, 'proj-1');
    await createTestLink('node-2', 'node-1', 'related', 0.8, 'proj-1');

    // Should not hang
    const chains = await findChains({
      sourceId: 'node-1',
      targetId: 'node-2',
      maxDepth: 3,
      maxChains: 5,
      projects: ['proj-1'],
    });

    expect(chains).toBeDefined();
    // Should find direct path 1 -> 2 but not loop infinitely
  });
});

describe('Reasoner: generateReasoningTranscript', () => {
  it('should generate transcript from relations', () => {
    const relations = [
      {
        candidateNodeId: 'node-2',
        projectId: 'proj-a',
        relationType: 'clarifies',
        confidence: 0.85,
        rationale: 'Test rationale',
        depth: 1,
        signals: { semantic: 0.8, ai: 0.9, lexical: 0.7, contextual: 0.5 },
        chain: [],
      },
    ];

    const transcript = generateReasoningTranscript(relations);

    expect(transcript).toHaveProperty('summary');
    expect(transcript).toHaveProperty('timestamp');
    expect(transcript).toHaveProperty('relations');
    expect(transcript.relations).toHaveLength(1);
    expect(transcript.relations[0]).toHaveProperty('candidate');
    expect(transcript.relations[0]).toHaveProperty('confidence');
  });
});
