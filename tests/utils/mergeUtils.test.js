/**
 * Tests for mergeUtils.js - Deduplication and merging utilities
 */

import {
  computeContentHash,
  dedupeCandidates,
  mergeProjectResults,
  normalizeScores,
  applyFreshnessBoost,
  namespaceNodeId,
  parseNamespacedId,
  groupByProject
} from '../../src/utils/mergeUtils.js';

describe('mergeUtils', () => {
  describe('computeContentHash', () => {
    it('should compute consistent hash for same content', () => {
      const text = 'Hello world';
      const hash1 = computeContentHash(text);
      const hash2 = computeContentHash(text);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(8);
    });

    it('should compute different hashes for different content', () => {
      const hash1 = computeContentHash('Hello world');
      const hash2 = computeContentHash('Goodbye world');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = computeContentHash('');
      expect(hash).toBe('00000000');
    });

    it('should handle null/undefined', () => {
      expect(computeContentHash(null)).toBe('00000000');
      expect(computeContentHash(undefined)).toBe('00000000');
    });
  });

  describe('dedupeCandidates', () => {
    it('should deduplicate by content hash', () => {
      const candidates = [
        {
          projectId: 'proj-a',
          nodeId: 'node-1',
          text: 'Hello world',
          finalScore: 0.9
        },
        {
          projectId: 'proj-b',
          nodeId: 'node-2',
          text: 'Hello world',
          finalScore: 0.8
        }
      ];

      const result = dedupeCandidates(candidates);

      expect(result).toHaveLength(1);
      expect(result[0].finalScore).toBe(0.9); // Keeps higher score
      expect(result[0].duplicateCount).toBe(2);
      expect(result[0].otherProjectIds).toContain('proj-b');
    });

    it('should keep all results when content is different', () => {
      const candidates = [
        {
          projectId: 'proj-a',
          nodeId: 'node-1',
          text: 'Hello world',
          finalScore: 0.9
        },
        {
          projectId: 'proj-b',
          nodeId: 'node-2',
          text: 'Goodbye world',
          finalScore: 0.8
        }
      ];

      const result = dedupeCandidates(candidates);

      expect(result).toHaveLength(2);
      expect(result[0].duplicateCount).toBe(1);
      expect(result[1].duplicateCount).toBe(1);
    });

    it('should handle empty array', () => {
      const result = dedupeCandidates([]);
      expect(result).toEqual([]);
    });

    it('should handle non-array input', () => {
      expect(dedupeCandidates(null)).toEqual([]);
      expect(dedupeCandidates(undefined)).toEqual([]);
    });
  });

  describe('mergeProjectResults', () => {
    it('should flatten and sort results by finalScore', () => {
      const projectResults = [
        [
          { nodeId: 'n1', finalScore: 0.8 },
          { nodeId: 'n2', finalScore: 0.6 }
        ],
        [
          { nodeId: 'n3', finalScore: 0.9 },
          { nodeId: 'n4', finalScore: 0.7 }
        ]
      ];

      const result = mergeProjectResults(projectResults, { topK: 10, dedupe: false });

      expect(result).toHaveLength(4);
      expect(result[0].finalScore).toBe(0.9);
      expect(result[1].finalScore).toBe(0.8);
      expect(result[2].finalScore).toBe(0.7);
      expect(result[3].finalScore).toBe(0.6);
    });

    it('should limit results to topK', () => {
      const projectResults = [
        [
          { nodeId: 'n1', finalScore: 0.8 },
          { nodeId: 'n2', finalScore: 0.7 },
          { nodeId: 'n3', finalScore: 0.6 }
        ]
      ];

      const result = mergeProjectResults(projectResults, { topK: 2, dedupe: false });

      expect(result).toHaveLength(2);
      expect(result[0].finalScore).toBe(0.8);
      expect(result[1].finalScore).toBe(0.7);
    });

    it('should deduplicate when dedupe=true', () => {
      const projectResults = [
        [
          { nodeId: 'n1', text: 'Same content', finalScore: 0.8 },
          { nodeId: 'n2', text: 'Different content', finalScore: 0.7 }
        ],
        [
          { nodeId: 'n3', text: 'Same content', finalScore: 0.6 }
        ]
      ];

      const result = mergeProjectResults(projectResults, { topK: 10, dedupe: true });

      expect(result).toHaveLength(2);
      expect(result[0].finalScore).toBe(0.8);
      expect(result[0].duplicateCount).toBe(2);
    });

    it('should handle empty input', () => {
      expect(mergeProjectResults([])).toEqual([]);
      expect(mergeProjectResults(null)).toEqual([]);
    });
  });

  describe('normalizeScores', () => {
    it('should normalize scores to 0-1 range using z-score', () => {
      const results = [
        { nodeId: 'n1', sim: 0.8 },
        { nodeId: 'n2', sim: 0.6 },
        { nodeId: 'n3', sim: 0.4 }
      ];

      const normalized = normalizeScores(results, 'sim');

      expect(normalized).toHaveLength(3);
      normalized.forEach(r => {
        expect(r.normalizedScore).toBeGreaterThanOrEqual(0);
        expect(r.normalizedScore).toBeLessThanOrEqual(1);
      });
    });

    it('should handle identical scores', () => {
      const results = [
        { nodeId: 'n1', sim: 0.5 },
        { nodeId: 'n2', sim: 0.5 },
        { nodeId: 'n3', sim: 0.5 }
      ];

      const normalized = normalizeScores(results, 'sim');

      expect(normalized).toHaveLength(3);
      normalized.forEach(r => {
        expect(r.normalizedScore).toBe(0.5);
      });
    });

    it('should handle empty array', () => {
      const result = normalizeScores([]);
      expect(result).toEqual([]);
    });
  });

  describe('applyFreshnessBoost', () => {
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    it('should apply higher boost to recent content', () => {
      const results = [
        { nodeId: 'n1', createdAt: oneDayAgo },
        { nodeId: 'n2', createdAt: thirtyDaysAgo }
      ];

      const boosted = applyFreshnessBoost(results, { maxBoost: 1.5, decayHalfLife: 30 });

      expect(boosted[0].freshnessBoost).toBeGreaterThan(boosted[1].freshnessBoost);
      expect(boosted[0].freshnessBoost).toBeCloseTo(1.5, 1);
      expect(boosted[1].freshnessBoost).toBeCloseTo(1.25, 1);
    });

    it('should default to 1.0 boost for missing timestamps', () => {
      const results = [
        { nodeId: 'n1' }
      ];

      const boosted = applyFreshnessBoost(results);

      expect(boosted[0].freshnessBoost).toBe(1.0);
    });

    it('should handle empty array', () => {
      const result = applyFreshnessBoost([]);
      expect(result).toEqual([]);
    });

    it('should respect maxBoost parameter', () => {
      const results = [
        { nodeId: 'n1', createdAt: new Date(now).toISOString() }
      ];

      const boosted = applyFreshnessBoost(results, { maxBoost: 2.0, decayHalfLife: 30 });

      expect(boosted[0].freshnessBoost).toBeCloseTo(2.0, 1);
    });
  });

  describe('namespaceNodeId', () => {
    it('should create namespaced ID with :: separator', () => {
      const result = namespaceNodeId('proj-123', 'node-456');
      expect(result).toBe('proj-123::node-456');
    });

    it('should handle empty strings', () => {
      const result = namespaceNodeId('', 'node-1');
      expect(result).toBe('::node-1');
    });
  });

  describe('parseNamespacedId', () => {
    it('should parse namespaced ID correctly', () => {
      const result = parseNamespacedId('proj-123::node-456');

      expect(result.projectId).toBe('proj-123');
      expect(result.nodeId).toBe('node-456');
    });

    it('should handle non-namespaced ID', () => {
      const result = parseNamespacedId('node-123');

      expect(result.projectId).toBe(null);
      expect(result.nodeId).toBe('node-123');
    });

    it('should handle invalid input', () => {
      expect(parseNamespacedId(null)).toEqual({ projectId: null, nodeId: null });
      expect(parseNamespacedId('')).toEqual({ projectId: null, nodeId: null });
      expect(parseNamespacedId('a::b::c')).toEqual({ projectId: null, nodeId: 'a::b::c' });
    });
  });

  describe('groupByProject', () => {
    it('should group results by projectId', () => {
      const results = [
        { projectId: 'proj-a', nodeId: 'n1' },
        { projectId: 'proj-b', nodeId: 'n2' },
        { projectId: 'proj-a', nodeId: 'n3' }
      ];

      const grouped = groupByProject(results);

      expect(grouped.size).toBe(2);
      expect(grouped.get('proj-a')).toHaveLength(2);
      expect(grouped.get('proj-b')).toHaveLength(1);
    });

    it('should handle missing projectId', () => {
      const results = [
        { nodeId: 'n1' },
        { projectId: 'proj-a', nodeId: 'n2' }
      ];

      const grouped = groupByProject(results);

      expect(grouped.size).toBe(2);
      expect(grouped.get('unknown')).toHaveLength(1);
      expect(grouped.get('proj-a')).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = groupByProject([]);
      expect(grouped.size).toBe(0);
    });
  });
});
