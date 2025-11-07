/**
 * Linker Module Unit Tests
 *
 * Comprehensive test suite for semantic link management:
 * - Link creation with validation
 * - Link update/upsert operations
 * - Link querying and filtering
 * - Confidence scoring algorithms
 * - Lexical similarity computation
 * - Cycle detection
 * - Batch operations
 * - Link statistics
 */

import {
  createLink,
  upsertLink,
  queryLinksFiltered,
  removeLink,
  computeLinkConfidence,
  computeLexicalSimilarity,
  getNodeLinks,
  wouldCreateCycle,
  batchUpdateConfidences,
  getLinkStatistics,
} from '../../src/core/linker.js';
import { initDB, saveLink, getLink } from '../../src/db/fractamind-indexer.js';

describe('Linker Module', () => {

  beforeAll(async () => {
    await initDB();
  });

  describe('Link Creation', () => {

    test('should create a valid link with all required fields', async () => {
      const linkData = {
        projectId: 'test-proj-1',
        sourceNodeId: 'node-src-1',
        targetNodeId: 'node-tgt-1',
        relationType: 'clarifies',
        confidence: 0.85,
        provenance: {
          method: 'manual',
          note: 'User created link',
          timestamp: new Date().toISOString(),
        },
      };

      const link = await createLink(linkData);

      expect(link).toBeDefined();
      expect(link.linkId).toBeDefined();
      expect(link.linkId).toContain('link_test-proj-1');
      expect(link.sourceNodeId).toBe('node-src-1');
      expect(link.targetNodeId).toBe('node-tgt-1');
      expect(link.relationType).toBe('clarifies');
      expect(link.confidence).toBe(0.85);
      expect(link.active).toBe(true);
      expect(link.weight).toBe(1.0);
      expect(link.createdAt).toBeDefined();
      expect(link.updatedAt).toBeDefined();
      expect(link.history).toHaveLength(1);
      expect(link.history[0].action).toBe('created');
      expect(link.provenance.method).toBe('manual');
    });

    test('should create link with default values', async () => {
      const minimalData = {
        projectId: 'test-proj-1',
        sourceNodeId: 'node-src-2',
        targetNodeId: 'node-tgt-2',
        relationType: 'related',
      };

      const link = await createLink(minimalData);

      expect(link.confidence).toBe(0.5); // default
      expect(link.weight).toBe(1.0); // default
      expect(link.active).toBe(true); // default
      expect(link.provenance.method).toBe('manual'); // default
    });

    test('should throw error for missing required fields', async () => {
      const invalidData = {
        projectId: 'test-proj-1',
        sourceNodeId: 'node-src-3',
        // missing targetNodeId
        relationType: 'clarifies',
      };

      await expect(createLink(invalidData)).rejects.toThrow('targetNodeId is required');
    });

    test('should throw error for self-link', async () => {
      const selfLinkData = {
        projectId: 'test-proj-1',
        sourceNodeId: 'node-same',
        targetNodeId: 'node-same',
        relationType: 'related',
      };

      await expect(createLink(selfLinkData)).rejects.toThrow('Cannot link node to itself');
    });

    test('should throw error for invalid confidence', async () => {
      const invalidConfidence = {
        projectId: 'test-proj-1',
        sourceNodeId: 'node-src-4',
        targetNodeId: 'node-tgt-4',
        relationType: 'clarifies',
        confidence: 1.5, // out of range
      };

      await expect(createLink(invalidConfidence)).rejects.toThrow('confidence must be a number between 0 and 1');
    });

  });

  describe('Link Update/Upsert', () => {

    test('should update existing link', async () => {
      // Create initial link
      const linkData = {
        projectId: 'test-proj-2',
        sourceNodeId: 'node-src-5',
        targetNodeId: 'node-tgt-5',
        relationType: 'clarifies',
        confidence: 0.7,
      };
      const created = await createLink(linkData);

      // Update it
      const updates = {
        confidence: 0.9,
        note: 'Confidence updated',
      };
      const updated = await upsertLink({ linkId: created.linkId }, updates);

      expect(updated.linkId).toBe(created.linkId);
      expect(updated.confidence).toBe(0.9);
      expect(updated.history.length).toBe(2);
      expect(updated.history[1].action).toBe('updated');
      expect(updated.history[1].changes).toContain('confidence');
      expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    test('should create new link if not found', async () => {
      const linkData = {
        projectId: 'test-proj-2',
        sourceNodeId: 'node-src-6',
        targetNodeId: 'node-tgt-6',
        relationType: 'elaborates',
        confidence: 0.8,
      };

      const link = await upsertLink(linkData, {});

      expect(link).toBeDefined();
      expect(link.linkId).toBeDefined();
      expect(link.sourceNodeId).toBe('node-src-6');
      expect(link.confidence).toBe(0.8);
      expect(link.history).toHaveLength(1);
      expect(link.history[0].action).toBe('created');
    });

    test('should find and update existing link by source/target/type', async () => {
      // Create link
      const linkData = {
        projectId: 'test-proj-2',
        sourceNodeId: 'node-src-7',
        targetNodeId: 'node-tgt-7',
        relationType: 'contradicts',
        confidence: 0.6,
      };
      const created = await createLink(linkData);

      // Upsert with same source/target/type (should update)
      const updated = await upsertLink(
        {
          projectId: 'test-proj-2',
          sourceNodeId: 'node-src-7',
          targetNodeId: 'node-tgt-7',
          relationType: 'contradicts',
        },
        { confidence: 0.95 }
      );

      expect(updated.linkId).toBe(created.linkId);
      expect(updated.confidence).toBe(0.95);
      expect(updated.history.length).toBe(2);
    });

  });

  describe('Link Querying', () => {

    beforeAll(async () => {
      // Create test links
      const testLinks = [
        { projectId: 'query-proj', sourceNodeId: 'node-a', targetNodeId: 'node-b', relationType: 'clarifies', confidence: 0.9 },
        { projectId: 'query-proj', sourceNodeId: 'node-a', targetNodeId: 'node-c', relationType: 'elaborates', confidence: 0.8 },
        { projectId: 'query-proj', sourceNodeId: 'node-b', targetNodeId: 'node-d', relationType: 'related', confidence: 0.7 },
        { projectId: 'query-proj', sourceNodeId: 'node-c', targetNodeId: 'node-d', relationType: 'clarifies', confidence: 0.6 },
        { projectId: 'other-proj', sourceNodeId: 'node-x', targetNodeId: 'node-y', relationType: 'related', confidence: 0.5 },
      ];

      for (const data of testLinks) {
        await createLink(data);
      }
    });

    test('should query by source node', async () => {
      const results = await queryLinksFiltered({
        sourceNodeId: 'node-a',
        projectId: 'query-proj',
      });

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(2);
      expect(results.every(link => link.sourceNodeId === 'node-a')).toBe(true);
    });

    test('should query by target node', async () => {
      const results = await queryLinksFiltered({
        targetNodeId: 'node-d',
        projectId: 'query-proj',
      });

      expect(results.length).toBe(2);
      expect(results.every(link => link.targetNodeId === 'node-d')).toBe(true);
    });

    test('should query by relation type', async () => {
      const results = await queryLinksFiltered({
        relationType: 'clarifies',
        projectId: 'query-proj',
      });

      expect(results.length).toBe(2);
      expect(results.every(link => link.relationType === 'clarifies')).toBe(true);
    });

    test('should query by project', async () => {
      const results = await queryLinksFiltered({
        projectId: 'query-proj',
        limit: 100,
      });

      expect(results.length).toBeGreaterThanOrEqual(4);
      expect(results.every(link => link.projectId === 'query-proj')).toBe(true);
    });

    test('should respect limit', async () => {
      const results = await queryLinksFiltered({
        projectId: 'query-proj',
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should combine filters', async () => {
      const results = await queryLinksFiltered({
        sourceNodeId: 'node-a',
        relationType: 'clarifies',
        projectId: 'query-proj',
      });

      expect(results.length).toBe(1);
      expect(results[0].sourceNodeId).toBe('node-a');
      expect(results[0].relationType).toBe('clarifies');
    });

  });

  describe('Confidence Scoring', () => {

    test('should compute confidence from multiple signals', () => {
      const signals = {
        semantic: 0.9,
        ai: 0.8,
        lexical: 0.6,
        contextual: 0.5,
      };

      const confidence = computeLinkConfidence(signals);

      // Formula: 0.5*0.9 + 0.3*0.8 + 0.1*0.6 + 0.1*0.5
      // = 0.45 + 0.24 + 0.06 + 0.05 = 0.8
      expect(confidence).toBeCloseTo(0.8, 2);
    });

    test('should handle missing signals', () => {
      const partialSignals = {
        semantic: 0.9,
        // ai, lexical, contextual missing
      };

      const confidence = computeLinkConfidence(partialSignals);

      // Only semantic: 0.5 * 0.9 = 0.45
      expect(confidence).toBeCloseTo(0.45, 2);
    });

    test('should clamp confidence to [0, 1]', () => {
      const highSignals = {
        semantic: 1.0,
        ai: 1.0,
        lexical: 1.0,
        contextual: 1.0,
      };

      const confidence = computeLinkConfidence(highSignals);
      expect(confidence).toBeLessThanOrEqual(1.0);
      expect(confidence).toBeGreaterThanOrEqual(0);
    });

    test('should accept custom weights', () => {
      const signals = { semantic: 1.0, ai: 0, lexical: 0, contextual: 0 };
      const customWeights = { semantic: 1.0, ai: 0, lexical: 0, contextual: 0 };

      const confidence = computeLinkConfidence(signals, customWeights);
      expect(confidence).toBe(1.0);
    });

  });

  describe('Lexical Similarity', () => {

    test('should compute similarity for identical text', () => {
      const text = 'Machine learning models require large datasets';
      const similarity = computeLexicalSimilarity(text, text);

      expect(similarity).toBe(1.0);
    });

    test('should compute similarity for similar text', () => {
      const text1 = 'Machine learning models require large datasets';
      const text2 = 'Machine learning requires training data';

      const similarity = computeLexicalSimilarity(text1, text2);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
      expect(similarity).toBeGreaterThan(0.2); // Should have some overlap
    });

    test('should return 0 for completely different text', () => {
      const text1 = 'aaaaa';
      const text2 = 'zzzzz';

      const similarity = computeLexicalSimilarity(text1, text2);

      expect(similarity).toBeCloseTo(0, 1);
    });

    test('should handle empty strings', () => {
      expect(computeLexicalSimilarity('', 'test')).toBe(0);
      expect(computeLexicalSimilarity('test', '')).toBe(0);
      expect(computeLexicalSimilarity('', '')).toBe(0);
    });

    test('should be case-insensitive', () => {
      const text1 = 'MACHINE LEARNING';
      const text2 = 'machine learning';

      const similarity = computeLexicalSimilarity(text1, text2);
      expect(similarity).toBe(1.0);
    });

  });

  describe('Node Links', () => {

    beforeAll(async () => {
      // Create test network
      await createLink({ projectId: 'net-proj', sourceNodeId: 'hub', targetNodeId: 'spoke1', relationType: 'related' });
      await createLink({ projectId: 'net-proj', sourceNodeId: 'hub', targetNodeId: 'spoke2', relationType: 'clarifies' });
      await createLink({ projectId: 'net-proj', sourceNodeId: 'spoke1', targetNodeId: 'hub', relationType: 'elaborates' });
    });

    test('should get all links for a node', async () => {
      const { outgoing, incoming } = await getNodeLinks('hub', { projectId: 'net-proj' });

      expect(outgoing.length).toBe(2);
      expect(incoming.length).toBe(1);
      expect(outgoing.every(link => link.sourceNodeId === 'hub')).toBe(true);
      expect(incoming.every(link => link.targetNodeId === 'hub')).toBe(true);
    });

  });

  describe('Cycle Detection', () => {

    beforeAll(async () => {
      // Create chain: A -> B -> C
      await createLink({ projectId: 'cycle-proj', sourceNodeId: 'cycle-a', targetNodeId: 'cycle-b', relationType: 'related' });
      await createLink({ projectId: 'cycle-proj', sourceNodeId: 'cycle-b', targetNodeId: 'cycle-c', relationType: 'related' });
    });

    test('should detect cycle when adding C -> A', async () => {
      const hasCycle = await wouldCreateCycle('cycle-c', 'cycle-a', 'cycle-proj');
      expect(hasCycle).toBe(true);
    });

    test('should not detect cycle for non-cyclic link', async () => {
      const hasCycle = await wouldCreateCycle('cycle-a', 'cycle-new', 'cycle-proj');
      expect(hasCycle).toBe(false);
    });

    test('should not detect cycle for disconnected nodes', async () => {
      const hasCycle = await wouldCreateCycle('isolated-x', 'isolated-y', 'cycle-proj');
      expect(hasCycle).toBe(false);
    });

  });

  describe('Link Removal', () => {

    test('should remove a link', async () => {
      const link = await createLink({
        projectId: 'delete-proj',
        sourceNodeId: 'del-src',
        targetNodeId: 'del-tgt',
        relationType: 'related',
      });

      const removed = await removeLink(link.linkId);
      expect(removed).toBe(true);

      const retrieved = await getLink(link.linkId);
      expect(retrieved).toBeNull();
    });

  });

  describe('Batch Operations', () => {

    test('should batch update confidences', async () => {
      // Create test links
      const link1 = await createLink({ projectId: 'batch-proj', sourceNodeId: 'b1', targetNodeId: 'b2', relationType: 'related', confidence: 0.5 });
      const link2 = await createLink({ projectId: 'batch-proj', sourceNodeId: 'b3', targetNodeId: 'b4', relationType: 'related', confidence: 0.6 });

      const updates = [
        { linkId: link1.linkId, confidence: 0.95 },
        { linkId: link2.linkId, confidence: 0.85 },
      ];

      const count = await batchUpdateConfidences(updates);
      expect(count).toBe(2);

      const updated1 = await getLink(link1.linkId);
      const updated2 = await getLink(link2.linkId);

      expect(updated1.confidence).toBe(0.95);
      expect(updated2.confidence).toBe(0.85);
    });

  });

  describe('Link Statistics', () => {

    beforeAll(async () => {
      // Create diverse links
      await createLink({ projectId: 'stats-proj', sourceNodeId: 's1', targetNodeId: 's2', relationType: 'clarifies', confidence: 0.9 });
      await createLink({ projectId: 'stats-proj', sourceNodeId: 's2', targetNodeId: 's3', relationType: 'clarifies', confidence: 0.8 });
      await createLink({ projectId: 'stats-proj', sourceNodeId: 's3', targetNodeId: 's4', relationType: 'elaborates', confidence: 0.7 });
      await createLink({ projectId: 'stats-proj', sourceNodeId: 's4', targetNodeId: 's5', relationType: 'related', confidence: 0.6 });
    });

    test('should compute link statistics', async () => {
      const stats = await getLinkStatistics('stats-proj');

      expect(stats.totalLinks).toBeGreaterThanOrEqual(4);
      expect(stats.byRelationType).toBeDefined();
      expect(stats.byRelationType['clarifies']).toBeGreaterThanOrEqual(2);
      expect(stats.byRelationType['elaborates']).toBeGreaterThanOrEqual(1);
      expect(stats.avgConfidence).toBeGreaterThan(0);
      expect(stats.avgConfidence).toBeLessThanOrEqual(1);
    });

  });

});
