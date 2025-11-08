#!/usr/bin/env node
/**
 * Backfill Links From Summaries
 *
 * Generates semantic link suggestions for all nodes in a project and optionally
 * auto-accepts high-confidence suggestions.
 *
 * Usage:
 *   node scripts/backfill_links_from_summaries.js --project <projectId> [options]
 *
 * Options:
 *   --project <id>         Project ID to backfill (required)
 *   --auto-accept <conf>   Auto-accept suggestions with confidence >= threshold (default: none)
 *   --batch-size <n>       Process nodes in batches of N (default: 50)
 *   --mode <mode>          Suggestion mode: 'mock' or 'live' (default: mock)
 *   --dry-run              Preview without creating links
 *   --topK <n>             Number of suggestions per node (default: 8)
 *   --limit <n>            Limit to first N nodes (default: all)
 *   --verbose              Verbose logging
 *
 * Examples:
 *   # Dry run to preview suggestions
 *   node scripts/backfill_links_from_summaries.js --project my-proj --dry-run
 *
 *   # Backfill with auto-accept for high confidence
 *   node scripts/backfill_links_from_summaries.js --project my-proj --auto-accept 0.85
 *
 *   # Process first 100 nodes only
 *   node scripts/backfill_links_from_summaries.js --project my-proj --limit 100
 */

// Setup IndexedDB polyfill for Node.js environment
import 'fake-indexeddb/auto';

import { initDB, getAllNodes } from '../src/db/fractamind-indexer.js';
import { suggestLinks } from '../src/core/contextualizer.js';
import { createLink } from '../src/core/linker.js';

// Parse CLI arguments
function parseArgs(argv) {
  const args = {
    projectId: null,
    autoAcceptThreshold: null,
    batchSize: 50,
    mode: 'mock',
    dryRun: false,
    topK: 8,
    limit: null,
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
      case '--auto-accept':
        args.autoAcceptThreshold = parseFloat(next);
        i++;
        break;
      case '--batch-size':
        args.batchSize = parseInt(next, 10);
        i++;
        break;
      case '--mode':
        args.mode = next;
        i++;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--topK':
        args.topK = parseInt(next, 10);
        i++;
        break;
      case '--limit':
        args.limit = parseInt(next, 10);
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
Backfill Links From Summaries

Usage:
  node scripts/backfill_links_from_summaries.js --project <projectId> [options]

Options:
  --project <id>         Project ID to backfill (required)
  --auto-accept <conf>   Auto-accept suggestions with confidence >= threshold
  --batch-size <n>       Process nodes in batches of N (default: 50)
  --mode <mode>          Suggestion mode: 'mock' or 'live' (default: mock)
  --dry-run              Preview without creating links
  --topK <n>             Number of suggestions per node (default: 8)
  --limit <n>            Limit to first N nodes (default: all)
  --verbose              Verbose logging
  --help                 Show this help

Examples:
  node scripts/backfill_links_from_summaries.js --project my-proj --dry-run
  node scripts/backfill_links_from_summaries.js --project my-proj --auto-accept 0.85
  `);
}

function log(message, verbose = false, args) {
  if (!verbose || args.verbose) {
    console.log(message);
  }
}

async function backfillLinks(args) {
  console.log('\n=== Backfill Links From Summaries ===\n');
  console.log('Configuration:');
  console.log(`  Project ID: ${args.projectId}`);
  console.log(`  Mode: ${args.mode}`);
  console.log(`  Top-K: ${args.topK}`);
  console.log(`  Batch Size: ${args.batchSize}`);
  console.log(`  Auto-Accept Threshold: ${args.autoAcceptThreshold || 'None'}`);
  console.log(`  Dry Run: ${args.dryRun}`);
  console.log(`  Limit: ${args.limit || 'All nodes'}`);
  console.log('');

  // Initialize DB
  console.log('[1/5] Initializing database...');
  await initDB();

  // Get all nodes for project
  console.log('[2/5] Loading nodes...');
  const allNodes = await getAllNodes();
  const projectNodes = allNodes.filter(n => n.meta?.projectId === args.projectId);

  if (projectNodes.length === 0) {
    console.error(`Error: No nodes found for project "${args.projectId}"`);
    process.exit(1);
  }

  const nodesToProcess = args.limit ? projectNodes.slice(0, args.limit) : projectNodes;
  console.log(`Loaded ${projectNodes.length} nodes (processing ${nodesToProcess.length})\n`);

  // Statistics
  let stats = {
    nodesProcessed: 0,
    suggestionsGenerated: 0,
    linksCreated: 0,
    linksSkipped: 0,
    errors: 0,
  };

  // Process in batches
  console.log('[3/5] Generating suggestions...\n');
  for (let i = 0; i < nodesToProcess.length; i += args.batchSize) {
    const batch = nodesToProcess.slice(i, i + args.batchSize);
    const batchNum = Math.floor(i / args.batchSize) + 1;
    const totalBatches = Math.ceil(nodesToProcess.length / args.batchSize);

    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} nodes)...`);

    for (const node of batch) {
      try {
        log(`  Node: ${node.title || node.id}`, true, args);

        // Generate suggestions
        const suggestions = await suggestLinks(node.id, {
          topK: args.topK,
          mode: args.mode,
          projectId: args.projectId,
        });

        stats.nodesProcessed++;
        stats.suggestionsGenerated += suggestions.length;

        log(`    Found ${suggestions.length} suggestions`, true, args);

        // Auto-accept high-confidence suggestions
        if (args.autoAcceptThreshold && suggestions.length > 0) {
          const toAccept = suggestions.filter(s => s.confidence >= args.autoAcceptThreshold);

          for (const suggestion of toAccept) {
            if (args.dryRun) {
              console.log(`    [DRY RUN] Would create link: ${node.id} --[${suggestion.relationType}]--> ${suggestion.candidateNodeId} (conf: ${suggestion.confidence.toFixed(2)})`);
              stats.linksSkipped++;
            } else {
              try {
                await createLink({
                  projectId: args.projectId,
                  sourceNodeId: node.id,
                  targetNodeId: suggestion.candidateNodeId,
                  relationType: suggestion.relationType,
                  confidence: suggestion.confidence,
                  provenance: {
                    method: 'auto-backfill',
                    note: 'Backfill script auto-accepted',
                    aiPrompt: suggestion.rationale,
                    timestamp: new Date().toISOString(),
                  },
                });
                stats.linksCreated++;
                log(`    ✓ Created link: ${suggestion.relationType} (conf: ${suggestion.confidence.toFixed(2)})`, true, args);
              } catch (err) {
                console.error(`    ✗ Error creating link: ${err.message}`);
                stats.errors++;
              }
            }
          }

          if (toAccept.length > 0) {
            log(`    Accepted ${toAccept.length}/${suggestions.length} suggestions`, true, args);
          }
        }

      } catch (err) {
        console.error(`  ✗ Error processing node ${node.id}: ${err.message}`);
        stats.errors++;
      }
    }

    console.log('');
  }

  // Summary
  console.log('[4/5] Backfill complete!\n');
  console.log('=== Summary ===');
  console.log(`Nodes Processed: ${stats.nodesProcessed}`);
  console.log(`Suggestions Generated: ${stats.suggestionsGenerated}`);
  console.log(`Links Created: ${stats.linksCreated}`);
  if (args.dryRun) {
    console.log(`Links Skipped (dry run): ${stats.linksSkipped}`);
  }
  console.log(`Errors: ${stats.errors}`);
  console.log('');

  // Recommendations
  console.log('[5/5] Recommendations:');
  if (args.dryRun) {
    console.log('  - Run without --dry-run to create links');
  }
  if (!args.autoAcceptThreshold) {
    console.log('  - Use --auto-accept 0.85 to auto-create high-confidence links');
  }
  if (stats.errors > 0) {
    console.log(`  - ${stats.errors} errors occurred. Check logs above.`);
  }
  if (args.limit) {
    console.log(`  - Remove --limit to process all ${projectNodes.length} nodes`);
  }
  console.log('');

  return stats;
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
    await backfillLinks(args);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
