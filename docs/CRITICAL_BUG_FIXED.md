# CRITICAL BUG FIXED - React State vs SessionStorage Race Condition

## The Bug That Was Killing Mock Mode

### What Was Happening (The Race Condition)

```
Timeline of events (BEFORE FIX):

T=0ms:   User clicks "Use Mock Mode (Fast)" button
T=1ms:   Button onClick executes:
         - setForceMockMode(true)  ← React state update queued (async!)
         - sessionStorage.setItem('FORCE_MOCK_MODE', 'true') ✅ Flag set!
         - setTimeout(() => handleSubmit(), 50ms)

T=51ms:  handleSubmit() executes:
         - Reads forceMockMode state → still FALSE (React hasn't updated yet!)
         - Sees forceMockMode === false
         - Executes: sessionStorage.removeItem('FORCE_MOCK_MODE') ❌ FLAG REMOVED!

T=52ms:  onSeedSubmit() → importDocument() → summarizeDocument()
         - chromeAI.js checks: sessionStorage.getItem('FORCE_MOCK_MODE')
         - Returns null (flag was removed!)
         - Uses LIVE AI mode instead of mock
         - Times out after 28 seconds ❌
```

### Why This Was Hard to Find

1. **Two different timing mechanisms**:
   - React state updates (asynchronous, batched)
   - sessionStorage (synchronous, immediate)

2. **Classic closure bug**:
   - handleSubmit reads `forceMockMode` from the scope where it was defined
   - React state updates don't affect the closure until next render
   - So handleSubmit always saw the OLD value

3. **The flag was set correctly** (by button), but **immediately removed** (by handleSubmit)

4. **No console errors**: Everything "worked" but mock mode never activated

### The Evidence

Your screenshots showed:
- ✅ Timeout error appears
- ✅ Recovery buttons visible
- ✅ Click "Use Mock Mode" triggers new import ("Summarizing..." appears)
- ❌ **BUT NO "Using mock summarization (FORCED by user)" message**
- ❌ Still times out after 28s

This proved chromeAI.js never saw the flag!

---

## The Fix

### Before (BROKEN):

```javascript
// ChoreComponent.jsx - handleSubmit()
const handleSubmit = async (e) => {
  // ...
  const traceId = ...;
  console.log('🔴 [CHORE] Starting import', { traceId, forceMockMode });

  // ❌ BUG: Relies on React state that might be stale
  if (forceMockMode) {
    sessionStorage.setItem('FORCE_MOCK_MODE', 'true');
  } else {
    sessionStorage.removeItem('FORCE_MOCK_MODE');  // ← Removes the flag!
  }

  // ...
};
```

**Problem**: When button calls handleSubmit, `forceMockMode` is still `false`, so it removes the flag!

### After (FIXED):

```javascript
// ChoreComponent.jsx - handleSubmit()
const handleSubmit = async (e) => {
  // ...
  const traceId = ...;

  // ✅ FIX: Check sessionStorage directly (source of truth)
  const isForcedMock = sessionStorage.getItem('FORCE_MOCK_MODE') === 'true';
  console.log('🔴 [CHORE] Starting import', { traceId, forceMockMode, isForcedMock });

  // ✅ Don't set or remove the flag here - let button manage it!
  // handleSubmit is just an observer, not a controller

  // ...
};
```

**Solution**:
- handleSubmit reads sessionStorage (source of truth), doesn't modify it
- Button is the ONLY place that sets the flag
- Success handler is the ONLY place that clears the flag

---

## Architecture Lesson

### The Problem: Two Sources of Truth

**React State** (`forceMockMode`):
- Asynchronous updates
- Batched for performance
- Lives in component closure
- Survives only during component lifetime

**sessionStorage** (`FORCE_MOCK_MODE`):
- Synchronous updates
- Immediate reads/writes
- Global browser storage
- Survives tab refresh (until tab closes)

**These two can get out of sync!**

### The Solution: Single Source of Truth

**Make sessionStorage the source of truth**:
- Button sets it directly
- handleSubmit reads it (doesn't modify)
- chromeAI.js reads it (doesn't modify)
- Success handler clears it

**Use React state only for UI**:
- Show/hide buttons
- Display messages
- Doesn't affect business logic

---

## Code Changes

### 1. ChoreComponent.jsx - handleSubmit (Lines 76-80)

**Before**:
```javascript
const traceId = ...;
console.log('🔴 [CHORE] Starting import', { traceId, forceMockMode });

// Set temporary flag to force mock mode if requested
if (forceMockMode) {
  sessionStorage.setItem('FORCE_MOCK_MODE', 'true');
  console.log('🔴 [CHORE] Mock mode FORCED by user request');
} else {
  sessionStorage.removeItem('FORCE_MOCK_MODE');  // ❌ BUG HERE
}
```

**After**:
```javascript
const traceId = ...;

// Check if mock mode is forced (set by recovery button)
const isForcedMock = sessionStorage.getItem('FORCE_MOCK_MODE') === 'true';
console.log('🔴 [CHORE] Starting import', { traceId, forceMockMode, isForcedMock });

// ✅ handleSubmit doesn't modify the flag
```

### 2. ChoreComponent.jsx - Success Handler (Lines 119-124)

**Before**:
```javascript
// Clear force mock mode flag on success
sessionStorage.removeItem('FORCE_MOCK_MODE');
setForceMockMode(false);
```

**After**:
```javascript
// Clear force mock mode flag on success (to avoid affecting next import)
if (sessionStorage.getItem('FORCE_MOCK_MODE') === 'true') {
  console.log('🔴 [CHORE] Clearing mock mode flag after success');
  sessionStorage.removeItem('FORCE_MOCK_MODE');
}
setForceMockMode(false);
```

### 3. ChoreComponent.jsx - Button onClick (Lines 296-317)

**Already correct** - sets flag immediately:
```javascript
onClick={async () => {
  setError(null);
  setForceMockMode(true);

  // ✅ Set sessionStorage flag IMMEDIATELY
  sessionStorage.setItem('FORCE_MOCK_MODE', 'true');
  console.log('🔴 User requested mock mode fallback');
  console.log('🔴 [CHORE] Mock mode FORCED by user request');

  // Trigger handleSubmit directly
  setTimeout(async () => {
    const fakeEvent = { preventDefault: () => {} };
    await handleSubmit(fakeEvent);
  }, 50);
}}
```

---

## Testing Instructions

### Clear Browser State First

**IMPORTANT**: Old sessionStorage values might still be cached!

```javascript
// In browser console, run:
sessionStorage.clear();
localStorage.clear();
location.reload();
```

### Test Flow

1. **Hard refresh**: Ctrl+Shift+R on http://localhost:5173
2. **Clear console** (important to see only new logs)
3. Paste sample text:
   ```
   Welcome to AI After Dark, where all your adult AI needs will be met
   with a wink and a prompt.

   That's right. We've arrived, people. AI porn is on the way. Get ready for
   it. Strap in.
   ```
4. Click **"Generate Fractal"**
5. **Wait for 28s timeout** (grab coffee, this is expected)
6. Error appears with two buttons
7. Click **"Use Mock Mode (Fast)"**

### Expected Console Output (NEW BEHAVIOR):

```
🔴 User requested mock mode fallback
🔴 [CHORE] Mock mode FORCED by user request
🔴 [CHORE] Starting import with timeout protection {
  traceId: "abc123",
  forceMockMode: true,     ← React state (might be false, doesn't matter)
  isForcedMock: true       ← sessionStorage (THIS is what matters!)
}
Using mock summarization (FORCED by user)              ← ✅ KEY LOG!
[AI] Mock fallback generated 5 topics
Using mock embedding (FORCED by user)                  ← ✅ KEY LOG!
[AI] Mock embedding generated: 512 dims
Using mock embedding (FORCED by user)
[AI] Mock embedding generated: 512 dims
... (repeats for each node)
🔴 [CHORE] Import succeeded { traceId: "abc123" }
🔴 [CHORE] Clearing mock mode flag after success
```

**Time to complete**: ~2-5 seconds (fast!)

### What You Should SEE:

- ✅ "Summarizing..." appears immediately
- ✅ "Using mock summarization (FORCED by user)" in console
- ✅ No 28s timeout!
- ✅ Success message appears in ~2-5 seconds
- ✅ "Open Fractal View →" button becomes clickable

### What You Should NOT SEE:

- ❌ "Summarizing..." that runs for 28s
- ❌ Another timeout error
- ❌ "Promise.race timeout at 28s"

---

## Why Mock Mode Should Be FAST

**Mock functions are synchronous text processing**:

1. **mockSummarize**:
   - Split text by sentences: O(n) where n = text length
   - Chunk into topics: O(topics)
   - No AI, no network, no async delays
   - **Time**: ~10-50ms

2. **mockEmbeddingFromText**:
   - Hash text: O(n) where n = text length
   - Fill Float32Array: O(dims) where dims = 512
   - Normalize vector: O(dims)
   - No AI, no network
   - **Time**: ~5-20ms per node

3. **Total import time with mocks**:
   - 5 nodes × 20ms = 100ms for embeddings
   - 50ms for summarization
   - 100ms for database writes
   - **Total: ~250ms - 2 seconds** (depending on text length)

**If you see 28s timeout in mock mode, something is SERIOUSLY wrong!**

---

## Verification Checklist

After applying fix, verify:

- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Clear sessionStorage in console: `sessionStorage.clear()`
- [ ] Paste text, generate fractal, wait for timeout
- [ ] Click "Use Mock Mode (Fast)"
- [ ] See "Using mock summarization (FORCED by user)" in console within 1 second
- [ ] See "Using mock embedding (FORCED by user)" in console
- [ ] Import completes in under 5 seconds
- [ ] Success message appears
- [ ] Can click "Open Fractal View →" button
- [ ] Fractal view opens with nodes visible

---

## What This Teaches Us

### Lesson 1: Async State is Dangerous

When you need **immediate** state changes (like setting a flag before calling a function), **don't use React state**. Use:
- sessionStorage (browser-level)
- localStorage (persistent)
- Global variables (if appropriate)
- Refs (React-level but synchronous)

### Lesson 2: Source of Truth

If two systems need to share state:
1. Pick ONE as the source of truth
2. Have all other systems READ from it
3. Only the source of truth WRITES to it

In our case:
- **Source of truth**: sessionStorage
- **Button**: WRITES flag
- **handleSubmit**: READS flag
- **chromeAI.js**: READS flag
- **Success handler**: CLEARS flag

### Lesson 3: Race Conditions are Silent

This bug had:
- ✅ No console errors
- ✅ No exceptions thrown
- ✅ Code "worked" (no crashes)
- ❌ But behavior was wrong

**Always trace the FULL execution path**, not just "does it crash?"

---

## Summary

**Bug**: handleSubmit removed sessionStorage flag immediately after button set it, due to stale React state in closure

**Fix**: handleSubmit reads sessionStorage directly, doesn't modify it

**Result**: Mock mode flag survives, chromeAI.js sees it, uses mocks, completes in 2s

**Status**: ✅ **FIXED - Ready for Testing**

---

**Date**: 2025-11-02
**Version**: v2.4 (race condition fixed)

**Critical Insight**: Never mix synchronous storage (sessionStorage) with asynchronous state (React) as controllers for the same flag. Pick ONE source of truth.

---

**Next**: Test by clicking "Use Mock Mode (Fast)" after timeout - should complete in ~2 seconds! 🎉
