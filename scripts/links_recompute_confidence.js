#!/usr/bin/env node
/**
 * Recompute Link Confidence Scores
 *
 * Recomputes confidence scores for existing semantic links using updated
 * similarity metrics, lexical overlap, and contextual signals.
 *
 * Useful when:
 * - Confidence formula has changed
 * - Node embeddings have been updated
 * - You want to recalibrate confidence across all links
 *
 * Usage:
 *   node scripts/links_recompute_confidence.js --project <projectId> [options]
 *
 * Options:
 *   --project <id>       Project ID to recompute (required)
 *   --batch-size <n>     Process links in batches of N (default: 100)
 *   --min-delta <n>      Only update if confidence changes by >= N (default: 0.01)
 *   --dry-run            Preview changes without updating
 *   --limit <n>          Limit to first N links (default: all)
 *   --verbose            Verbose logging
 *
 * Examples:
 *   # Dry run to preview changes
 *   node scripts/links_recompute_confidence.js --project my-proj --dry-run
 *
 *   # Recompute with minimum delta filter
 *   node scripts/links_recompute_confidence.js --project my-proj --min-delta 0.05
 *
 *   # Process first 500 links only
 *   node scripts/links_recompute_confidence.js --project my-proj --limit 500
 */

import { initDB, getNode } from '../src/db/fractamind-indexer.js';
import { queryLinksFiltered, computeLinkConfidence, computeLexicalSimilarity, batchUpdateConfidences } from '../src/core/linker.js';
import { scorePair } from '../src/core/searcher.js';

// Parse CLI arguments
function parseArgs(argv) {
  const args = {
    projectId: null,
    batchSize: 100,
    minDelta: 0.01,
    dryRun: false,
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
      case '--batch-size':
        args.batchSize = parseInt(next, 10);
        i++;
        break;
      case '--min-delta':
        args.minDelta = parseFloat(next);
        i++;
        break;
      case '--dry-run':
        args.dryRun = true;
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
Recompute Link Confidence Scores

Usage:
  node scripts/links_recompute_confidence.js --project <projectId> [options]

Options:
  --project <id>       Project ID to recompute (required)
  --batch-size <n>     Process links in batches of N (default: 100)
  --min-delta <n>      Only update if confidence changes by >= N (default: 0.01)
  --dry-run            Preview changes without updating
  --limit <n>          Limit to first N links (default: all)
  --verbose            Verbose logging
  --help               Show this help

Examples:
  node scripts/links_recompute_confidence.js --project my-proj --dry-run
  node scripts/links_recompute_confidence.js --project my-proj --min-delta 0.05
  `);
}

function log(message, verbose = false, args) {
  if (!verbose || args.verbose) {
    console.log(message);
  }
}

async function recomputeConfidence(args) {
  console.log('\n=== Recompute Link Confidence Scores ===\n');
  console.log('Configuration:');
  console.log(`  Project ID: ${args.projectId}`);
  console.log(`  Batch Size: ${args.batchSize}`);
  console.log(`  Min Delta: ${args.minDelta}`);
  console.log(`  Dry Run: ${args.dryRun}`);
  console.log(`  Limit: ${args.limit || 'All links'}`);
  console.log('');

  // Initialize DB
  console.log('[1/5] Initializing database...');
  await initDB();

  // Get all links for project
  console.log('[2/5] Loading links...');
  const allLinks = await queryLinksFiltered({
    projectId: args.projectId,
    active: true,
    limit: 10000,
  });

  if (allLinks.length === 0) {
    console.error(`Error: No active links found for project "${args.projectId}"`);
    process.exit(1);
  }

  const linksToProcess = args.limit ? allLinks.slice(0, args.limit) : allLinks;
  console.log(`Loaded ${allLinks.length} links (processing ${linksToProcess.length})\n`);

  // Statistics
  let stats = {
    linksProcessed: 0,
    confidenceUpdated: 0,
    confidenceUnchanged: 0,
    deltaSum: 0,
    maxDeltaIncrease: 0,
    maxDeltaDecrease: 0,
    errors: 0,
  };

  const updates = [];

  // Process in batches
  console.log('[3/5] Recomputing confidence scores...\n');
  for (let i = 0; i < linksToProcess.length; i += args.batchSize) {
    const batch = linksToProcess.slice(i, i + args.batchSize);
    const batchNum = Math.floor(i / args.batchSize) + 1;
    const totalBatches = Math.ceil(linksToProcess.length / args.batchSize);

    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} links)...`);

    for (const link of batch) {
      try {
        const oldConfidence = link.confidence || 0;

        // Get source and target nodes
        const [sourceNode, targetNode] = await Promise.all([
          getNode(link.sourceNodeId),
          getNode(link.targetNodeId),
        ]);

        if (!sourceNode || !targetNode) {
          console.error(`  ✗ Missing node for link ${link.linkId}`);
          stats.errors++;
          continue;
        }

        // Compute signals
        const semantic = await scorePair(link.sourceNodeId, link.targetNodeId);
        const lexical = computeLexicalSimilarity(
          sourceNode.text || sourceNode.title || '',
          targetNode.text || targetNode.title || ''
        );

        // Use existing AI confidence from provenance, or default to semantic
        const ai = semantic; // In real system, would use AI extraction confidence

        // No contextual bias for recompute (historical data not available)
        const contextual = 0;

        // Compute new confidence
        const newConfidence = computeLinkConfidence({
          semantic,
          ai,
          lexical,
          contextual,
        });

        const delta = newConfidence - oldConfidence;
        const absDelta = Math.abs(delta);

        log(`  Link: ${link.sourceNodeId} --[${link.relationType}]--> ${link.targetNodeId}`, true, args);
        log(`    Old: ${oldConfidence.toFixed(3)}, New: ${newConfidence.toFixed(3)}, Delta: ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`, true, args);

        stats.linksProcessed++;
        stats.deltaSum += absDelta;

        if (delta > stats.maxDeltaIncrease) {
          stats.maxDeltaIncrease = delta;
        }
        if (delta < stats.maxDeltaDecrease) {
          stats.maxDeltaDecrease = delta;
        }

        // Only update if delta exceeds threshold
        if (absDelta >= args.minDelta) {
          stats.confidenceUpdated++;
          updates.push({
            linkId: link.linkId,
            confidence: newConfidence,
          });

          if (args.verbose) {
            const changeSymbol = delta > 0 ? '↑' : '↓';
            console.log(`    ${changeSymbol} Will update (delta: ${absDelta.toFixed(3)})`);
          }
        } else {
          stats.confidenceUnchanged++;
          log(`    - No change (below threshold)`, true, args);
        }

      } catch (err) {
        console.error(`  ✗ Error processing link ${link.linkId}: ${err.message}`);
        stats.errors++;
      }
    }

    console.log('');
  }

  // Apply updates
  console.log('[4/5] Applying updates...\n');
  if (updates.length > 0) {
    if (args.dryRun) {
      console.log(`[DRY RUN] Would update ${updates.length} links`);
    } else {
      console.log(`Updating ${updates.length} links...`);
      const updated = await batchUpdateConfidences(updates);
      console.log(`✓ Successfully updated ${updated}/${updates.length} links\n`);
    }
  } else {
    console.log('No links require updating\n');
  }

  // Summary
  console.log('[5/5] Recomputation complete!\n');
  console.log('=== Summary ===');
  console.log(`Links Processed: ${stats.linksProcessed}`);
  console.log(`Confidence Updated: ${stats.confidenceUpdated}`);
  console.log(`Confidence Unchanged: ${stats.confidenceUnchanged}`);
  console.log(`Average Absolute Delta: ${(stats.deltaSum / stats.linksProcessed).toFixed(4)}`);
  console.log(`Max Increase: +${stats.maxDeltaIncrease.toFixed(4)}`);
  console.log(`Max Decrease: ${stats.maxDeltaDecrease.toFixed(4)}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('');

  // Recommendations
  if (args.dryRun) {
    console.log('Recommendations:');
    console.log('  - Run without --dry-run to apply updates');
    console.log('');
  }

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
    await recomputeConfidence(args);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
