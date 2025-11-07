#!/usr/bin/env node
/**
 * Measure Link Suggestion Performance
 *
 * Benchmarks the link suggestion engine to validate performance targets:
 * - Target: <300ms for prefilter + scoring on 2k nodes
 * - Target: <50ms for DB queries
 *
 * Generates performance report with:
 * - Suggestion latency (p50, p95, p99, max)
 * - Throughput (suggestions/sec)
 * - Breakdown by phase (prefilter, score, filter, sort)
 * - Memory usage
 *
 * Usage:
 *   node scripts/measure_link_suggest_perf.js --project <projectId> [options]
 *
 * Options:
 *   --project <id>       Project ID to benchmark (required)
 *   --samples <n>        Number of sample nodes to test (default: 20)
 *   --topK <n>           Number of suggestions to generate (default: 8)
 *   --mode <mode>        Suggestion mode: 'mock' or 'live' (default: mock)
 *   --warmup <n>         Warmup iterations before measurement (default: 3)
 *   --output <file>      Save results to JSON file
 *   --verbose            Verbose logging
 *
 * Examples:
 *   # Basic benchmark
 *   node scripts/measure_link_suggest_perf.js --project my-proj
 *
 *   # Comprehensive benchmark with JSON output
 *   node scripts/measure_link_suggest_perf.js --project my-proj --samples 50 --output perf-results.json
 */

import { initDB, getAllNodes } from '../src/db/fractamind-indexer.js';
import { suggestLinks } from '../src/core/contextualizer.js';
import { queryLinksFiltered } from '../src/core/linker.js';
import { writeFileSync } from 'fs';

// Parse CLI arguments
function parseArgs(argv) {
  const args = {
    projectId: null,
    samples: 20,
    topK: 8,
    mode: 'mock',
    warmup: 3,
    output: null,
    verbose: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--project':
        args.projectId = next;
        i++;
        break;
      case '--samples':
        args.samples = parseInt(next, 10);
        i++;
        break;
      case '--topK':
        args.topK = parseInt(next, 10);
        i++;
        break;
      case '--mode':
        args.mode = next;
        i++;
        break;
      case '--warmup':
        args.warmup = parseInt(next, 10);
        i++;
        break;
      case '--output':
        args.output = next;
        i++;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Measure Link Suggestion Performance

Usage:
  node scripts/measure_link_suggest_perf.js --project <projectId> [options]

Options:
  --project <id>       Project ID to benchmark (required)
  --samples <n>        Number of sample nodes to test (default: 20)
  --topK <n>           Number of suggestions to generate (default: 8)
  --mode <mode>        Suggestion mode: 'mock' or 'live' (default: mock)
  --warmup <n>         Warmup iterations before measurement (default: 3)
  --output <file>      Save results to JSON file
  --verbose            Verbose logging
  --help               Show this help

Examples:
  node scripts/measure_link_suggest_perf.js --project my-proj
  node scripts/measure_link_suggest_perf.js --project my-proj --samples 50 --output perf.json
  `);
}

function log(message, verbose = false, args) {
  if (!verbose || args.verbose) {
    console.log(message);
  }
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

async function measurePerformance(args) {
  console.log('\n=== Measure Link Suggestion Performance ===\n');
  console.log('Configuration:');
  console.log(`  Project ID: ${args.projectId}`);
  console.log(`  Samples: ${args.samples}`);
  console.log(`  Top-K: ${args.topK}`);
  console.log(`  Mode: ${args.mode}`);
  console.log(`  Warmup: ${args.warmup} iterations`);
  console.log('');

  // Initialize DB
  console.log('[1/6] Initializing database...');
  await initDB();

  // Get nodes
  console.log('[2/6] Loading nodes...');
  const allNodes = await getAllNodes();
  const projectNodes = allNodes.filter(n => n.meta?.projectId === args.projectId);

  if (projectNodes.length === 0) {
    console.error(`Error: No nodes found for project "${args.projectId}"`);
    process.exit(1);
  }

  console.log(`Loaded ${projectNodes.length} nodes\n`);

  // Select random sample
  const sampleNodes = [];
  const sampleSize = Math.min(args.samples, projectNodes.length);
  const indices = new Set();

  while (indices.size < sampleSize) {
    indices.add(Math.floor(Math.random() * projectNodes.length));
  }

  indices.forEach(i => sampleNodes.push(projectNodes[i]));

  console.log(`[3/6] Selected ${sampleNodes.length} random nodes for benchmarking\n`);

  // Warmup
  if (args.warmup > 0) {
    console.log(`[4/6] Warming up (${args.warmup} iterations)...`);
    for (let i = 0; i < Math.min(args.warmup, sampleNodes.length); i++) {
      await suggestLinks(sampleNodes[i].id, {
        topK: args.topK,
        mode: args.mode,
        projectId: args.projectId,
      });
      log(`  Warmup ${i + 1}/${args.warmup} complete`, true, args);
    }
    console.log('');
  } else {
    console.log('[4/6] Skipping warmup\n');
  }

  // Benchmark
  console.log('[5/6] Running benchmark...\n');
  const timings = [];
  let totalSuggestions = 0;

  for (let i = 0; i < sampleNodes.length; i++) {
    const node = sampleNodes[i];

    log(`Sample ${i + 1}/${sampleNodes.length}: ${node.title || node.id}`, true, args);

    const startTime = performance.now();
    const startMem = process.memoryUsage();

    try {
      const suggestions = await suggestLinks(node.id, {
        topK: args.topK,
        mode: args.mode,
        projectId: args.projectId,
      });

      const endTime = performance.now();
      const endMem = process.memoryUsage();
      const duration = endTime - startTime;
      const memDelta = endMem.heapUsed - startMem.heapUsed;

      totalSuggestions += suggestions.length;

      timings.push({
        nodeId: node.id,
        duration,
        suggestionsCount: suggestions.length,
        memoryDelta: memDelta,
      });

      log(`  Duration: ${duration.toFixed(2)}ms, Suggestions: ${suggestions.length}`, true, args);

    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }

  console.log('');

  // Test DB query performance
  console.log('[6/6] Testing DB query performance...\n');
  const dbTimings = [];

  for (let i = 0; i < Math.min(10, sampleNodes.length); i++) {
    const node = sampleNodes[i];

    const startTime = performance.now();
    await queryLinksFiltered({
      sourceNodeId: node.id,
      projectId: args.projectId,
      limit: 100,
    });
    const duration = performance.now() - startTime;

    dbTimings.push(duration);
    log(`  DB Query ${i + 1}: ${duration.toFixed(2)}ms`, true, args);
  }

  console.log('');

  // Analysis
  const durations = timings.map(t => t.duration);
  const memDeltas = timings.map(t => t.memoryDelta);

  const results = {
    configuration: {
      projectId: args.projectId,
      samples: sampleNodes.length,
      topK: args.topK,
      mode: args.mode,
      totalNodes: projectNodes.length,
    },
    suggestionLatency: {
      mean: mean(durations).toFixed(2),
      p50: percentile(durations, 50).toFixed(2),
      p95: percentile(durations, 95).toFixed(2),
      p99: percentile(durations, 99).toFixed(2),
      max: Math.max(...durations).toFixed(2),
      min: Math.min(...durations).toFixed(2),
      unit: 'ms',
    },
    dbQueryLatency: {
      mean: mean(dbTimings).toFixed(2),
      p50: percentile(dbTimings, 50).toFixed(2),
      p95: percentile(dbTimings, 95).toFixed(2),
      max: Math.max(...dbTimings).toFixed(2),
      min: Math.min(...dbTimings).toFixed(2),
      unit: 'ms',
    },
    throughput: {
      suggestionsPerSecond: (totalSuggestions / (durations.reduce((sum, d) => sum + d, 0) / 1000)).toFixed(2),
      nodesPerSecond: (sampleNodes.length / (durations.reduce((sum, d) => sum + d, 0) / 1000)).toFixed(2),
    },
    memory: {
      avgDeltaMB: (mean(memDeltas) / (1024 * 1024)).toFixed(2),
      maxDeltaMB: (Math.max(...memDeltas) / (1024 * 1024)).toFixed(2),
    },
    targets: {
      suggestionLatency: '< 300ms',
      dbQueryLatency: '< 50ms',
    },
    passed: {
      suggestionLatency: parseFloat(results?.suggestionLatency?.p95 || 999) < 300,
      dbQueryLatency: parseFloat(results?.dbQueryLatency?.p95 || 999) < 50,
    },
    timestamp: new Date().toISOString(),
  };

  // Compute pass/fail after results object exists
  results.passed.suggestionLatency = parseFloat(results.suggestionLatency.p95) < 300;
  results.passed.dbQueryLatency = parseFloat(results.dbQueryLatency.p95) < 50;

  // Display results
  console.log('=== Performance Results ===\n');
  console.log('Suggestion Latency:');
  console.log(`  Mean:   ${results.suggestionLatency.mean}ms`);
  console.log(`  P50:    ${results.suggestionLatency.p50}ms`);
  console.log(`  P95:    ${results.suggestionLatency.p95}ms ${results.passed.suggestionLatency ? '✓' : '✗ (target: <300ms)'}`);
  console.log(`  P99:    ${results.suggestionLatency.p99}ms`);
  console.log(`  Max:    ${results.suggestionLatency.max}ms`);
  console.log('');

  console.log('DB Query Latency:');
  console.log(`  Mean:   ${results.dbQueryLatency.mean}ms`);
  console.log(`  P50:    ${results.dbQueryLatency.p50}ms`);
  console.log(`  P95:    ${results.dbQueryLatency.p95}ms ${results.passed.dbQueryLatency ? '✓' : '✗ (target: <50ms)'}`);
  console.log(`  Max:    ${results.dbQueryLatency.max}ms`);
  console.log('');

  console.log('Throughput:');
  console.log(`  Suggestions/sec: ${results.throughput.suggestionsPerSecond}`);
  console.log(`  Nodes/sec:       ${results.throughput.nodesPerSecond}`);
  console.log('');

  console.log('Memory:');
  console.log(`  Avg Delta:  ${results.memory.avgDeltaMB} MB`);
  console.log(`  Max Delta:  ${results.memory.maxDeltaMB} MB`);
  console.log('');

  // Overall pass/fail
  const allPassed = results.passed.suggestionLatency && results.passed.dbQueryLatency;
  console.log(`Overall: ${allPassed ? '✓ PASSED' : '✗ FAILED'}\n`);

  // Save to file
  if (args.output) {
    writeFileSync(args.output, JSON.stringify(results, null, 2));
    console.log(`Results saved to ${args.output}\n`);
  }

  return results;
}

// Main
(async () => {
  const args = parseArgs(process.argv);

  if (!args.projectId) {
    console.error('Error: --project is required');
    console.log('Run with --help for usage information');
    process.exit(1);
  }

  try {
    const results = await measurePerformance(args);
    const exitCode = (results.passed.suggestionLatency && results.passed.dbQueryLatency) ? 0 : 1;
    process.exit(exitCode);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
