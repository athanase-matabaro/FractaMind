/**
 * Phase 5 AI Environment Validation Script
 * Tests timeout handling, mock fallbacks, and deterministic behavior
 */

import {
  summarizeDocument,
  generateEmbedding,
  expandNode,
  rewriteText
} from '../../src/ai/chromeAI.js';
import { isMockMode, getAITimeout } from '../../src/ai/mockHelpers.js';

async function validateAIEnvironment() {
  const results = [];

  const start = performance.now();
  const timeoutMs = getAITimeout();

  console.log('🔍 Phase-5 Validation: Checking AI Environment...');
  console.log(`  → Timeout configured: ${timeoutMs} ms`);
  console.log(`  → Mock mode: ${isMockMode()}`);

  // 1. Sanity check: environment and function integrity
  results.push(typeof summarizeDocument === 'function');
  results.push(typeof generateEmbedding === 'function');
  results.push(typeof expandNode === 'function');
  results.push(typeof rewriteText === 'function');

  // 2. Determinism test: embeddings identical for same input
  const e1 = await generateEmbedding('FractaMind', { mock: true });
  const e2 = await generateEmbedding('FractaMind', { mock: true });
  const deterministic =
    JSON.stringify(Array.from(e1).slice(0, 16)) ===
    JSON.stringify(Array.from(e2).slice(0, 16));
  results.push(deterministic);

  // 3. Timeout behavior simulation
  const simulatedTimeout = 100; // Very short timeout to trigger fallback
  // This should timeout and fallback to mock (never throw)
  const timeoutResult = await summarizeDocument('Test document for timeout', {
    timeoutMs: simulatedTimeout
  });
  // If we got a result (even mock), the wrapper handled timeout correctly
  const timeoutHandled = !!timeoutResult && !!timeoutResult.summary;
  results.push(timeoutHandled);

  // 4. Mock mode fallback check
  const mockSummary = await summarizeDocument('Short test', { mock: true });
  results.push(!!mockSummary && !!mockSummary.summary);

  // 5. Roundtrip summary sanity
  const summary = await summarizeDocument(
    'Knowledge fractals emerge from self-similar structures in thought.',
    { mock: true }
  );
  results.push(!!summary && !!summary.summary);

  const elapsed = performance.now() - start;
  const passed = results.every(Boolean);

  console.log(
    passed
      ? `✅ Phase-5 Validation passed in ${elapsed.toFixed(1)} ms`
      : `❌ Phase-5 Validation failed (${elapsed.toFixed(1)} ms)`
  );

  console.log('\n📊 Test Results:');
  console.log(`  1. Functions exported: ${results[0] ? '✅' : '❌'}`);
  console.log(`  2. Embeddings deterministic: ${results[1] ? '✅' : '❌'}`);
  console.log(`  3. Timeout/fallback works: ${results[2] ? '✅' : '❌'}`);
  console.log(`  4. Mock mode works: ${results[3] ? '✅' : '❌'}`);
  console.log(`  5. Summary roundtrip: ${results[4] ? '✅' : '❌'}`);

  if (!passed) {
    throw new Error('Phase-5 validation incomplete — check AI wrappers.');
  }
  return true;
}

// Run validation
validateAIEnvironment()
  .then(() => {
    console.log('\n✅ AI Environment validation complete!');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai:ready', { detail: { ok: true } }));
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ AI validation failed:', err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ai:ready', { detail: { ok: false, error: err.message } })
      );
    }
    process.exit(1);
  });
