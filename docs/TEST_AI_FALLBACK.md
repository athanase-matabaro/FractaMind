# Test AI Fallback System - Verification Guide

## Pre-Test Checklist

- [ ] Dev server running: `npm run dev` → http://localhost:5173
- [ ] Browser console open (F12 → Console tab)
- [ ] Hard refresh done (Ctrl+Shift+R or Cmd+Shift+R)

---

## Test 1: Verify Component Loaded

### Steps:
1. Open http://localhost:5173
2. Check browser console

### Expected Console Logs:
```
🔴 CHORE COMPONENT LOADED - TIMEOUT FIX v2.0
```

### ✅ Pass Criteria:
- Red badge console log appears
- No errors in console
- Page shows "Paste Text or URL to Begin" button

---

## Test 2: Check AI Availability (Chrome Canary/Dev)

**Only if using Chrome Canary/Dev with AI flags enabled**

### Steps:
1. Open console
2. Type: `window.ai`
3. Press Enter

### Expected Result:

**If AI Available:**
```javascript
{
  languageModel: {...},
  summarizer: {...},
  embedding: {...},
  writer: {...}
}
```

**If AI Not Available:**
```
undefined
```

---

## Test 3: Live Mode Test (AI Available)

**Prerequisites**: Chrome Canary with flags enabled

### Steps:
1. Click "Paste Text or URL to Begin"
2. Paste this test text:
```
Artificial intelligence is transforming technology. Machine learning enables computers to learn from data. Neural networks mimic human brain structure. Deep learning uses multiple layers of processing. Natural language processing helps computers understand human language.
```
3. Click "Generate Fractal"
4. Watch console and UI

### Expected Console Logs:
```
🔴 [CHORE] Starting import with timeout protection { traceId: "..." }
✅ All Chrome Built-in AI APIs available - using live mode
[WATCHDOG START] importDocument.summarize { id: "...", timeoutMs: 17000 }
[AI] Prompt API response received, parsing JSON...
[AI] Successfully summarized into 5 topics (live mode)
[WATCHDOG SUCCESS] importDocument.summarize
[WATCHDOG START] attachEmbeddingsAndKeys.batch { id: "...", timeoutMs: 20000 }
[AI] Generated embedding (live mode): 512 dims
[AI] Generated embedding (live mode): 512 dims
...
[WATCHDOG SUCCESS] attachEmbeddingsAndKeys.batch
🔴 [CHORE] Import succeeded { traceId: "..." }
```

### Expected UI:
1. Button shows: "Processing... (1s)", "(2s)", "(3s)"...
2. Green alert appears: "✅ Chrome AI ready - using live mode"
3. After ~5-10 seconds: Success message + "Open Fractal View →" button
4. No errors, no timeouts

### ✅ Pass Criteria:
- Process completes in <15 seconds
- Console shows "live mode" messages
- Green success alert visible
- Topics generated look semantically meaningful (not just text chunks)

---

## Test 4: Mock Mode Test (AI Unavailable)

**Prerequisites**: Regular Chrome (not Canary) OR Chrome without AI flags

### Steps:
1. Use regular Chrome browser
2. Navigate to http://localhost:5173
3. Click "Paste Text or URL to Begin"
4. Paste same test text as Test 3
5. Click "Generate Fractal"
6. Watch console and UI

### Expected Console Logs:
```
🔴 [CHORE] Starting import with timeout protection { traceId: "..." }
⚠️ Some Chrome Built-in AI APIs are not available: ['prompt', 'summarizer', 'embeddings', 'writer']
[WATCHDOG START] importDocument.summarize { id: "...", timeoutMs: 17000 }
[AI] Chrome Built-in AI not available. Using fallback mock.
[AI] Mock fallback generated 5 topics
[WATCHDOG SUCCESS] importDocument.summarize
[WATCHDOG START] attachEmbeddingsAndKeys.batch { id: "...", timeoutMs: 20000 }
[AI] Chrome Embeddings API not available. Using deterministic mock.
[AI] Mock embedding generated: 512 dims
...
[WATCHDOG SUCCESS] attachEmbeddingsAndKeys.batch
🔴 [CHORE] Import succeeded { traceId: "..." }
```

### Expected UI:
1. Button shows: "Processing... (1s)", "(2s)", "(3s)"...
2. **Yellow alert** appears: "⚠️ AI unavailable - using mock mode (missing: prompt, summarizer, embeddings, writer). Results will be deterministic."
3. After ~2-5 seconds: Success message + "Open Fractal View →" button
4. Topics generated are text-based (first sentences of paragraphs)

### ✅ Pass Criteria:
- Process completes quickly (<5 seconds)
- Console shows "mock fallback" messages
- **Yellow warning alert** visible
- Import succeeds with deterministic results

---

## Test 5: Timeout Handling (28s Limit)

### Steps:
1. Click "Paste Text or URL to Begin"
2. Paste a VERY large text (10,000+ words) OR
3. Simulate slow AI (if you can modify Chrome flags to slow down model)
4. Click "Generate Fractal"
5. Wait and observe timer

### Expected Behavior:

**0-27 seconds:**
- Button shows elapsed time: "Processing... (5s)", "(10s)", "(15s)", "(20s)", "(25s)"
- Console shows watchdog timers running

**At 28 seconds:**
- Error appears: "Operation timed out after 28 seconds"
- Button changes to "Generate Fractal" (enabled for retry)
- Console shows:
```
🔴 [CHORE] Promise.race timeout at 28s { traceId: "..." }
🔴 [CHORE] Import failed { traceId: "...", error: "Operation timed out after 28 seconds" }
```

**At 30 seconds (emergency watchdog):**
- If Promise.race somehow failed to fire at 28s, watchdog fires:
```
🔴 [CHORE] EMERGENCY WATCHDOG FIRED at 30s { traceId: "..." }
```

### ✅ Pass Criteria:
- Timeout fires at exactly 28 seconds
- Error message shown
- Button re-enabled for retry
- **No infinite hang!**

---

## Test 6: Mixed Mode (Some AI Works, Some Falls Back)

**Scenario**: AI is available but times out on some operations

This happens naturally when AI is slow or overloaded.

### Expected Console (Example):
```
✅ All Chrome Built-in AI APIs available - using live mode
[AI] Successfully summarized into 5 topics (live mode)
[AI] Embedding generation failed, using mock fallback: Timeout
[AI] Mock embedding generated: 512 dims
[AI] Generated embedding (live mode): 512 dims
[AI] Mock embedding generated: 512 dims
...
```

### ✅ Pass Criteria:
- Some operations use live AI
- Some operations fall back to mock
- Import still completes successfully
- Mix of live and mock logs in console

---

## Test 7: Format Validation (Critical Bug Fix)

This test verifies the format mismatch bug is fixed.

### Setup:
Add temporary debug logging to `src/core/importer.js` after line 183:

```javascript
const topics = Array.isArray(summaryResult) ? summaryResult : (summaryResult.topics || []);
console.log('[TEST] summaryResult type:', Array.isArray(summaryResult) ? 'array' : 'object');
console.log('[TEST] topics extracted:', topics.length, 'items');
console.log('[TEST] topics[0]:', topics[0]);
```

### Steps:
1. Run import with either live or mock mode
2. Check console for `[TEST]` logs

### Expected Console:
```
[TEST] summaryResult type: object
[TEST] topics extracted: 5 items
[TEST] topics[0]: {id: "...", title: "...", summary: "...", text: "...", keyPoints: [...]}
```

### ✅ Pass Criteria:
- `topics` is always an array (never undefined)
- `topics.length` is a number
- `topics[0]` has expected structure
- No errors like "Cannot read property 'length' of undefined"

---

## Test 8: Visual Feedback

### Steps:
1. Start import
2. Observe UI alerts during processing

### Expected UI Sequence:

**Step 1: AI Check (0-1s)**
- Green alert: "✅ Chrome AI ready - using live mode"
- OR Yellow alert: "⚠️ AI unavailable - using mock mode ..."

**Step 2: Progress (1-10s)**
- Progress bar animating
- Message: "Analyzing document..."
- Then: "Generating embeddings..."
- Then: "Saving to database..."

**Step 3: Success**
- Green alert: "Success! Your fractal is ready to explore."
- Button: "Open Fractal View →"

**OR Error:**
- Red alert: "Error: Operation timed out after 28 seconds"
- Button: "Generate Fractal" (retry enabled)

### ✅ Pass Criteria:
- User always knows what's happening
- Alerts are color-coded correctly (green=success, yellow=warning, red=error)
- Progress messages update
- Timer shows elapsed seconds

---

## Debugging Failed Tests

### Issue: Component not loaded
**Symptoms**: No "🔴 CHORE COMPONENT LOADED" log
**Fix**: Hard refresh (Ctrl+Shift+R), clear cache, or try Incognito mode

### Issue: Infinite "Processing..."
**Symptoms**: Button stuck, no timeout after 28s
**Check**:
1. Console errors?
2. Browser tab crashed? (Check task manager)
3. Dev server still running?
**Fix**: Refresh page, restart dev server

### Issue: "AI ready" shows but uses mock mode
**Symptoms**: Green alert but console shows mock logs
**Explanation**: This is normal! AI availability is checked, but individual operations can still timeout and fall back to mock. This is the **mixed mode** scenario (Test 6).

### Issue: Timeout fires too early/late
**Check**: Multiple timeout layers
- AI timeout: 15s (chromeAI.js:41)
- Watchdog: 17s (importer.js:177)
- UI timeout: 28s (ChoreComponent.jsx:101)
- Emergency: 30s (ChoreComponent.jsx:81)

**Expected**: UI timeout at 28s, emergency at 30s

---

## Success Criteria Summary

✅ **All tests pass if:**
1. Component loads (console log appears)
2. Live mode works when AI available
3. Mock mode works when AI unavailable
4. Timeout fires at 28s (never infinite hang)
5. Mixed mode gracefully handles partial failures
6. Format bug fixed (topics array extracted correctly)
7. User sees clear status alerts (green/yellow/red)

---

## Quick Smoke Test (30 seconds)

**Fastest way to verify everything works:**

1. Open http://localhost:5173
2. Check console: "🔴 CHORE COMPONENT LOADED" ✅
3. Paste short text (1 paragraph)
4. Click "Generate Fractal"
5. Check alert color:
   - Green = Live mode ✅
   - Yellow = Mock mode ✅
6. Wait for success (5-10s) ✅
7. Click "Open Fractal View →" ✅

**If all 7 steps succeed → System is working!**

---

**Status**: Ready for testing
**Date**: 2025-11-02
