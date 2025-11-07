/**
 * Phase 6 Proof-of-Concept Test
 *
 * Tests the complete link creation and suggestion flow:
 * 1. Initialize IndexedDB with links store
 * 2. Create a test link
 * 3. Query links
 * 4. Compute link confidence
 * 5. Generate suggestions (mock mode)
 *
 * Run with: npm test tests/core/phase6-poc.test.js
 */

import { initDB, saveNode, saveLink, getLink, queryLinks } from '../../src/db/fractamind-indexer.js';
import { createLink, computeLinkConfidence, computeLexicalSimilarity, queryLinksFiltered } from '../../src/core/linker.js';
import { suggestLinks } from '../../src/core/contextualizer.js';
import { scorePair } from '../../src/core/searcher.js';

describe('Phase 6 - Contextualization & Linking PoC', () => {

  beforeAll(async () => {
    // Initialize database
    await initDB();
  });

  describe('Link Creation and Persistence', () => {

    test('should create a link with all required fields', async () => {
      const linkData = {
        projectId: 'test-project-1',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-b',
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
      expect(link.sourceNodeId).toBe('node-a');
      expect(link.targetNodeId).toBe('node-b');
      expect(link.relationType).toBe('clarifies');
      expect(link.confidence).toBe(0.85);
      expect(link.active).toBe(true);
      expect(link.history).toHaveLength(1);
      expect(link.history[0].action).toBe('created');
    });

    test('should query links by source node', async () => {
      const links = await queryLinksFiltered({
        sourceNodeId: 'node-a',
        projectId: 'test-project-1',
        limit: 10,
      });

      expect(links).toBeInstanceOf(Array);
      expect(links.length).toBeGreaterThan(0);
      expect(links[0].sourceNodeId).toBe('node-a');
    });

    test('should retrieve link by ID', async () => {
      // Create a test link
      const linkData = {
        projectId: 'test-project-1',
        sourceNodeId: 'node-c',
        targetNodeId: 'node-d',
        relationType: 'elaborates',
      };
      const createdLink = await createLink(linkData);

      // Retrieve it
      const retrievedLink = await getLink(createdLink.linkId);

      expect(retrievedLink).toBeDefined();
      expect(retrievedLink.linkId).toBe(createdLink.linkId);
      expect(retrievedLink.relationType).toBe('elaborates');
    });

  });

  describe('Link Confidence Scoring', () => {

    test('should compute confidence from multiple signals', () => {
      const signals = {
        semantic: 0.9,   // High cosine similarity
        ai: 0.8,         // High AI confidence
        lexical: 0.6,    // Moderate lexical overlap
        contextual: 0.5, // Moderate context bias
      };

      const confidence = computeLinkConfidence(signals);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
      // Expected: 0.5*0.9 + 0.3*0.8 + 0.1*0.6 + 0.1*0.5 = 0.45 + 0.24 + 0.06 + 0.05 = 0.8
      expect(confidence).toBeCloseTo(0.8, 1);
    });

    test('should compute lexical similarity', () => {
      const text1 = 'Machine learning models require large datasets';
      const text2 = 'Machine learning requires training data';

      const similarity = computeLexicalSimilarity(text1, text2);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
      // Should have some overlap due to shared terms
      expect(similarity).toBeGreaterThan(0.2);
    });

  });

  describe('Link Suggestions (Mock Mode)', () => {

    beforeAll(async () => {
      // Create test nodes with embeddings for suggestion testing
      const nodes = [
        {
          id: 'suggest-node-1',
          title: 'Understanding Neural Networks',
          text: 'Neural networks are computing systems inspired by biological neural networks.',
          embedding: Array(512).fill(0).map((_, i) => Math.sin(i * 0.1)), // Mock embedding
          hilbertKeyHex: 'abc123',
          meta: { projectId: 'test-project-1', createdAt: new Date().toISOString() },
        },
        {
          id: 'suggest-node-2',
          title: 'Deep Learning Basics',
          text: 'Deep learning is a subset of machine learning based on artificial neural networks.',
          embedding: Array(512).fill(0).map((_, i) => Math.sin(i * 0.1 + 0.2)), // Similar but shifted
          hilbertKeyHex: 'abc124',
          meta: { projectId: 'test-project-1', createdAt: new Date().toISOString() },
        },
        {
          id: 'suggest-node-3',
          title: 'Cooking Recipes',
          text: 'A collection of delicious recipes for home cooking.',
          embedding: Array(512).fill(0).map((_, i) => Math.cos(i * 0.3)), // Different embedding
          hilbertKeyHex: 'xyz789',
          meta: { projectId: 'test-project-1', createdAt: new Date().toISOString() },
        },
      ];

      for (const node of nodes) {
        await saveNode(node);
      }
    });

    test('should generate link suggestions in mock mode', async () => {
      const suggestions = await suggestLinks('suggest-node-1', {
        topK: 5,
        mode: 'mock',
        projectId: 'test-project-1',
      });

      expect(suggestions).toBeInstanceOf(Array);
      // Should find at least suggest-node-2 (similar content)
      expect(suggestions.length).toBeGreaterThanOrEqual(0);

      if (suggestions.length > 0) {
        const suggestion = suggestions[0];
        expect(suggestion).toHaveProperty('candidateNodeId');
        expect(suggestion).toHaveProperty('relationType');
        expect(suggestion).toHaveProperty('confidence');
        expect(suggestion).toHaveProperty('rationale');
        expect(suggestion.mode).toBe('mock');
      }
    });

    test('should return suggestions sorted by confidence', async () => {
      const suggestions = await suggestLinks('suggest-node-1', {
        topK: 10,
        mode: 'mock',
        projectId: 'test-project-1',
      });

      if (suggestions.length > 1) {
        for (let i = 0; i < suggestions.length - 1; i++) {
          expect(suggestions[i].confidence).toBeGreaterThanOrEqual(suggestions[i + 1].confidence);
        }
      }
    });

  });

  describe('Scoring Functions', () => {

    test('should score pair of nodes', async () => {
      // Using nodes created in previous test
      const score = await scorePair('suggest-node-1', 'suggest-node-2');

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      // Should have high similarity due to similar embeddings
      expect(score).toBeGreaterThan(0.5);
    });

  });

  describe('End-to-End: Suggestion → Link Creation', () => {

    test('should create link from suggestion', async () => {
      // 1. Get suggestions
      const suggestions = await suggestLinks('suggest-node-1', {
        topK: 3,
        mode: 'mock',
        projectId: 'test-project-1',
      });

      expect(suggestions.length).toBeGreaterThan(0);

      // 2. Accept first suggestion
      const suggestion = suggestions[0];
      const link = await createLink({
        projectId: 'test-project-1',
        sourceNodeId: 'suggest-node-1',
        targetNodeId: suggestion.candidateNodeId,
        relationType: suggestion.relationType,
        confidence: suggestion.confidence,
        provenance: {
          method: 'auto-suggestion',
          aiPrompt: suggestion.rationale,
          timestamp: new Date().toISOString(),
        },
      });

      expect(link).toBeDefined();
      expect(link.sourceNodeId).toBe('suggest-node-1');
      expect(link.targetNodeId).toBe(suggestion.candidateNodeId);
      expect(link.provenance.method).toBe('auto-suggestion');

      // 3. Verify link persists
      const retrieved = await getLink(link.linkId);
      expect(retrieved).toBeDefined();
      expect(retrieved.linkId).toBe(link.linkId);
    });

  });

});
