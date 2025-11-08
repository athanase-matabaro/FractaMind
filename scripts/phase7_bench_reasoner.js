#!/usr/bin/env node
/**
 * Phase 7 Reasoner Performance Benchmark
 *
 * Validates Phase 7 performance targets:
 * - Prefilter + scoring mean: <250ms
 * - Prefilter + scoring p95: <400ms
 * - Chain search p95: <700ms
 *
 * Usage:
 *   node scripts/phase7_bench_reasoner.js --projects proj1,proj2,proj3 --topk 10 --repeat 5
 *
 * Options:
 *   --projects <ids>  Comma-separated project IDs (required)
 *   --topk <n>        Number of suggestions per node (default: 10)
 *   --repeat <n>      Number of benchmark iterations (default: 5)
 *   --depth <n>       Reasoning depth (default: 2)
 *   --output <file>   Save results to JSON file (optional)
 */

// Setup IndexedDB polyfill for Node.js environment
import 'fake-indexeddb/auto';

import { inferRelations, findChains } from '../src/core/reasoner.js';
import { addProject, warmupCache, getCacheStats } from '../src/core/federated_indexer.js';
import { getAllNodes } from '../src/db/fractamind-indexer.js';
import { PHASE7 } from '../src/config.js';
import { writeFileSync } from 'fs';

/////////////////////////
// CLI Argument Parsing//
/////////////////////////

function parseArgs(argv) {
  const args = {
    projects: [],
    topK: 10,
    repeat: 5,
    depth: 2,
    output: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--projects' && i + 1 < argv.length) {
      args.projects = argv[++i].split(',').map(s => s.trim());
    } else if (arg === '--topk' && i + 1 < argv.length) {
      args.topK = parseInt(argv[++i]);
    } else if (arg === '--repeat' && i + 1 < argv.length) {
      args.repeat = parseInt(argv[++i]);
    } else if (arg === '--depth' && i + 1 < argv.length) {
      args.depth = parseInt(argv[++i]);
    } else if (arg === '--output' && i + 1 < argv.length) {
      args.output = argv[++i];
    }
  }

  return args;
}

/////////////////////////
// Statistics Helpers  //
/////////////////////////

function computeStats(values) {
  if (values.length === 0) return {};

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    mean: sum / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/////////////////////////
// Benchmark Functions //
/////////////////////////

async function benchmarkInferRelations(startNodeId, projects, topK, depth) {
  const startTime = Date.now();

  const relations = await inferRelations({
    startNodeId,
    projects,
    depth,
    topK,
    mode: 'mock',
    threshold: 0.7,
  });

  const elapsed = Date.now() - startTime;

  return {
    elapsed,
    relationCount: relations.length,
  };
}

async function benchmarkFindChains(sourceId, targetId, maxDepth, projects) {
  const startTime = Date.now();

  const chains = await findChains({
    sourceId,
    targetId,
    maxDepth,
    maxChains: 5,
    projects,
  });

  const elapsed = Date.now() - startTime;

  return {
    elapsed,
    chainCount: chains.length,
  };
}

/////////////////////////
// Main Benchmark      //
/////////////////////////

async function runBenchmark(args) {
  const { projects, topK, repeat, depth, output } = args;

  console.log('=== Phase 7 Reasoner Performance Benchmark ===\n');
  console.log('Configuration:');
  console.log(`  Projects: ${projects.join(', ')}`);
  console.log(`  Top-K: ${topK}`);
  console.log(`  Depth: ${depth}`);
  console.log(`  Iterations: ${repeat}`);
  console.log(`  Performance Targets:`);
  console.log(`    - Prefilter+Scoring Mean: ${PHASE7.PERFORMANCE_TARGETS.PREFILTER_SCORING_MEAN_MS}ms`);
  console.log(`    - Prefilter+Scoring P95: ${PHASE7.PERFORMANCE_TARGETS.PREFILTER_SCORING_P95_MS}ms`);
  console.log(`    - Chain Search P95: ${PHASE7.PERFORMANCE_TARGETS.CHAIN_SEARCH_P95_MS}ms`);
  console.log('');

  // [1/5] Warmup cache
  console.log('[1/5] Warming up federated cache...');
  let totalNodes = 0;
  for (const projectId of projects) {
    try {
      const nodes = await getAllNodes(projectId);
      if (nodes && nodes.length > 0) {
        await addProject(projectId, nodes);
        totalNodes += nodes.length;
      }
    } catch (err) {
      console.warn(`  Warning: Could not load project ${projectId}:`, err.message);
    }
  }

  const cacheStats = getCacheStats();
  console.log(`  Loaded ${totalNodes} nodes from ${cacheStats.totalProjects} projects`);
  console.log('');

  // [2/5] Select sample nodes
  console.log('[2/5] Selecting sample nodes for benchmark...');
  const sampleNodes = [];
  for (const projectId of projects) {
    const nodes = await getAllNodes(projectId);
    if (nodes && nodes.length > 0) {
      // Take first 3 nodes from each project
      sampleNodes.push(...nodes.slice(0, Math.min(3, nodes.length)));
    }
  }

  console.log(`  Selected ${sampleNodes.length} sample nodes`);
  console.log('');

  // [3/5] Benchmark relation inference
  console.log('[3/5] Benchmarking relation inference...');
  const inferLatencies = [];
  const inferRelationCounts = [];

  for (let i = 0; i < repeat && i < sampleNodes.length; i++) {
    const node = sampleNodes[i];
    const result = await benchmarkInferRelations(node.id, projects, topK, depth);

    inferLatencies.push(result.elapsed);
    inferRelationCounts.push(result.relationCount);

    console.log(`  Iteration ${i + 1}/${repeat}: ${result.elapsed}ms (${result.relationCount} relations)`);
  }

  const inferStats = computeStats(inferLatencies);
  console.log('  Results:');
  console.log(`    Mean: ${inferStats.mean.toFixed(2)}ms`);
  console.log(`    P50: ${inferStats.p50.toFixed(2)}ms`);
  console.log(`    P95: ${inferStats.p95.toFixed(2)}ms`);
  console.log(`    Max: ${inferStats.max.toFixed(2)}ms`);

  const inferPass = inferStats.mean <= PHASE7.PERFORMANCE_TARGETS.PREFILTER_SCORING_MEAN_MS &&
                     inferStats.p95 <= PHASE7.PERFORMANCE_TARGETS.PREFILTER_SCORING_P95_MS;
  console.log(`    Status: ${inferPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');

  // [4/5] Benchmark chain finding
  console.log('[4/5] Benchmarking chain finding...');
  const chainLatencies = [];
  const chainCounts = [];

  // Use pairs of sample nodes
  for (let i = 0; i < Math.min(repeat, Math.floor(sampleNodes.length / 2)); i++) {
    const sourceNode = sampleNodes[i * 2];
    const targetNode = sampleNodes[i * 2 + 1];

    if (!sourceNode || !targetNode) break;

    const result = await benchmarkFindChains(sourceNode.id, targetNode.id, depth, projects);

    chainLatencies.push(result.elapsed);
    chainCounts.push(result.chainCount);

    console.log(`  Iteration ${i + 1}: ${result.elapsed}ms (${result.chainCount} chains)`);
  }

  const chainStats = chainLatencies.length > 0 ? computeStats(chainLatencies) : null;
  if (chainStats) {
    console.log('  Results:');
    console.log(`    Mean: ${chainStats.mean.toFixed(2)}ms`);
    console.log(`    P95: ${chainStats.p95.toFixed(2)}ms`);
    console.log(`    Max: ${chainStats.max.toFixed(2)}ms`);

    const chainPass = chainStats.p95 <= PHASE7.PERFORMANCE_TARGETS.CHAIN_SEARCH_P95_MS;
    console.log(`    Status: ${chainPass ? '✅ PASS' : '❌ FAIL'}`);
  } else {
    console.log('  Skipped (insufficient nodes)');
  }
  console.log('');

  // [5/5] Summary
  console.log('[5/5] Benchmark Summary\n');
  console.log('Performance:');
  console.log(`  Relation Inference: ${inferStats.mean.toFixed(2)}ms mean, ${inferStats.p95.toFixed(2)}ms p95`);
  if (chainStats) {
    console.log(`  Chain Finding: ${chainStats.mean.toFixed(2)}ms mean, ${chainStats.p95.toFixed(2)}ms p95`);
  }
  console.log('');

  console.log('Throughput:');
  const avgRelations = inferRelationCounts.reduce((a, b) => a + b, 0) / inferRelationCounts.length;
  console.log(`  Average relations per inference: ${avgRelations.toFixed(1)}`);
  console.log('');

  const overallPass = inferPass && (!chainStats || chainStats.p95 <= PHASE7.PERFORMANCE_TARGETS.CHAIN_SEARCH_P95_MS);
  console.log(`Overall: ${overallPass ? '✅ ALL TARGETS MET' : '⚠️ SOME TARGETS MISSED'}`);

  // Save to file if requested
  if (output) {
    const results = {
      timestamp: new Date().toISOString(),
      configuration: { projects, topK, depth, repeat },
      targets: PHASE7.PERFORMANCE_TARGETS,
      results: {
        relationInference: {
          latencies: inferLatencies,
          stats: inferStats,
          relationCounts: inferRelationCounts,
          pass: inferPass,
        },
        chainFinding: chainStats ? {
          latencies: chainLatencies,
          stats: chainStats,
          chainCounts,
          pass: chainStats.p95 <= PHASE7.PERFORMANCE_TARGETS.CHAIN_SEARCH_P95_MS,
        } : null,
      },
      overallPass,
    };

    writeFileSync(output, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to ${output}`);
  }

  process.exit(overallPass ? 0 : 1);
}

/////////////////////////
// Entry Point        //
/////////////////////////

const args = parseArgs(process.argv);

if (args.projects.length === 0) {
  console.error('Error: --projects required');
  console.log('\nUsage: node scripts/phase7_bench_reasoner.js --projects proj1,proj2 [options]');
  process.exit(1);
}

runBenchmark(args).catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
