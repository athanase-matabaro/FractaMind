#!/usr/bin/env node
/**
 * crossSearchPerf.js
 *
 * Performance smoke test for cross-project search
 * Tests search performance with mocked datasets
 *
 * Usage:
 *   node tests/perf/crossSearchPerf.js --projects 3 --nodes 2000 --timeout 30000
 */

import crypto from 'crypto';

// Parse command-line arguments
const args = process.argv.slice(2);
const config = {
  projects: 3,
  nodes: 2000,
  concurrency: 3,
  timeout: 30000,
};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace('--', '');
  const value = parseInt(args[i + 1], 10);
  if (config.hasOwnProperty(key)) {
    config[key] = value;
  }
}

console.log('Performance Smoke Test Configuration:');
console.log(`  Projects: ${config.projects}`);
console.log(`  Nodes per project: ${config.nodes}`);
console.log(`  Concurrency: ${config.concurrency}`);
console.log(`  Timeout: ${config.timeout}ms`);
console.log('');

// Mock data generation
function generateMockEmbedding(text, seed = 0) {
  const hash = crypto.createHash('sha256').update(text + seed).digest();
  const embedding = new Float32Array(512);

  for (let i = 0; i < 512; i++) {
    // Use hash bytes to generate deterministic values
    const byteIndex = i % hash.length;
    embedding[i] = (hash[byteIndex] / 255) * 2 - 1; // Normalize to [-1, 1]
  }

  return embedding;
}

function generateMockProject(projectId, nodeCount) {
  const nodes = [];
  const topics = [
    'introduction', 'fundamentals', 'theory', 'practice', 'applications',
    'algorithms', 'optimization', 'evaluation', 'research', 'development',
    'architecture', 'implementation', 'testing', 'deployment', 'monitoring'
  ];

  for (let i = 0; i < nodeCount; i++) {
    const topic = topics[i % topics.length];
    const text = `${projectId} ${topic} content with additional details about the subject matter`;

    nodes.push({
      id: `${projectId}-node-${i}`,
      projectId,
      title: `${projectId} ${topic}`,
      text,
      embedding: generateMockEmbedding(text, i),
      parent: i > 0 ? `${projectId}-node-${Math.floor((i - 1) / 3)}` : null,
      children: [],
      meta: {
        createdAt: new Date(Date.now() - (nodeCount - i) * 3600000).toISOString(),
        modifiedAt: new Date(Date.now() - (nodeCount - i) * 1800000).toISOString(),
      }
    });
  }

  return {
    id: projectId,
    title: `Project ${projectId}`,
    nodes,
    nodeCount,
    quantParams: {
      reducedDims: 8,
      bits: 16,
      mins: Array(8).fill(-1),
      maxs: Array(8).fill(1)
    }
  };
}

// Cosine similarity
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Z-score normalization
function normalizeScores(results) {
  const scores = results.map(r => r.sim);
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance) || 1;

  return results.map(r => ({
    ...r,
    normalizedScore: (r.sim - mean) / stdDev
  }));
}

// Mock cross-project search
async function mockCrossSearch(queryText, projects, opts = {}) {
  const { topK = 20, concurrency = 3 } = opts;

  const queryEmbedding = generateMockEmbedding(queryText);
  const allResults = [];

  // Process projects in batches based on concurrency
  for (let i = 0; i < projects.length; i += concurrency) {
    const batch = projects.slice(i, i + concurrency);

    const batchResults = await Promise.all(batch.map(async (project) => {
      // Simulate range scan by taking top candidates per project
      const candidates = project.nodes.slice(0, Math.min(100, project.nodes.length));

      // Compute similarities
      const withScores = candidates.map(node => ({
        ...node,
        sim: cosineSimilarity(queryEmbedding, node.embedding)
      }));

      // Normalize per project
      const normalized = normalizeScores(withScores);

      // Apply project weight and freshness
      normalized.forEach(n => {
        const ageHours = (Date.now() - new Date(n.meta.modifiedAt)) / (1000 * 60 * 60);
        const freshnessBoost = 1 + Math.min(0.5, (24 - ageHours) / 24 * 0.5);
        n.finalScore = n.normalizedScore * 1.0 * freshnessBoost;
      });

      return normalized;
    }));

    allResults.push(...batchResults.flat());
  }

  // Sort by final score and take topK
  allResults.sort((a, b) => b.finalScore - a.finalScore);
  return allResults.slice(0, topK);
}

// Performance test runner
async function runPerformanceTest() {
  console.log('Generating mock data...');
  const startGeneration = Date.now();

  const projects = [];
  for (let i = 0; i < config.projects; i++) {
    projects.push(generateMockProject(`proj-${i}`, config.nodes));
  }

  const generationTime = Date.now() - startGeneration;
  console.log(`✓ Generated ${config.projects} projects with ${config.nodes} nodes each (${generationTime}ms)`);
  console.log('');

  // Run multiple search queries to get performance statistics
  const queries = [
    'algorithms and optimization',
    'research and development',
    'architecture implementation',
    'testing deployment',
    'fundamentals theory'
  ];

  const searchTimes = [];
  const resultCounts = [];

  console.log('Running search queries...');
  for (const query of queries) {
    const startSearch = Date.now();

    const results = await mockCrossSearch(query, projects, {
      topK: 20,
      concurrency: config.concurrency
    });

    const searchTime = Date.now() - startSearch;
    searchTimes.push(searchTime);
    resultCounts.push(results.length);

    console.log(`  Query: "${query}"`);
    console.log(`    Time: ${searchTime}ms`);
    console.log(`    Results: ${results.length}`);
    console.log(`    Top result score: ${results[0]?.finalScore.toFixed(4) || 'N/A'}`);
  }

  console.log('');
  console.log('Performance Statistics:');

  // Calculate statistics
  const mean = searchTimes.reduce((sum, t) => sum + t, 0) / searchTimes.length;
  const sorted = searchTimes.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const max = Math.max(...searchTimes);
  const min = Math.min(...searchTimes);

  console.log(`  Mean:   ${mean.toFixed(2)}ms`);
  console.log(`  Median: ${median}ms`);
  console.log(`  P95:    ${p95}ms`);
  console.log(`  Min:    ${min}ms`);
  console.log(`  Max:    ${max}ms`);
  console.log('');

  // Performance budget checks
  const MEDIAN_BUDGET = 800; // <800ms median
  const P95_BUDGET = 2000;   // <2s p95

  console.log('Performance Budget Checks:');

  if (median <= MEDIAN_BUDGET) {
    console.log(`  ✓ Median: ${median}ms <= ${MEDIAN_BUDGET}ms budget`);
  } else {
    console.log(`  ✗ Median: ${median}ms EXCEEDS ${MEDIAN_BUDGET}ms budget`);
  }

  if (p95 <= P95_BUDGET) {
    console.log(`  ✓ P95: ${p95}ms <= ${P95_BUDGET}ms budget`);
  } else {
    console.log(`  ✗ P95: ${p95}ms EXCEEDS ${P95_BUDGET}ms budget`);
  }

  console.log('');

  // Check timeout
  if (max > config.timeout) {
    console.error(`FAIL: Maximum search time ${max}ms exceeded timeout ${config.timeout}ms`);
    process.exit(1);
  }

  // Check budgets
  if (median > MEDIAN_BUDGET || p95 > P95_BUDGET) {
    console.error('FAIL: Performance budgets not met');
    process.exit(1);
  }

  console.log('✓ Performance smoke test PASSED');
  console.log('');

  // Memory usage (rough estimate)
  const memoryUsage = process.memoryUsage();
  console.log('Memory Usage:');
  console.log(`  Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  External: ${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`);

  const MEMORY_BUDGET = 200; // 200MB cap
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

  if (heapUsedMB > MEMORY_BUDGET) {
    console.error(`WARN: Heap usage ${heapUsedMB.toFixed(2)}MB exceeds ${MEMORY_BUDGET}MB budget`);
  } else {
    console.log(`  ✓ Within ${MEMORY_BUDGET}MB budget`);
  }

  return 0;
}

// Run test
runPerformanceTest()
  .then(code => process.exit(code))
  .catch(error => {
    console.error('Performance test failed with error:', error);
    process.exit(1);
  });
