# Complete Bug Analysis & Fix Checklist

## 🚨 CRITICAL ISSUE DISCOVERED

**YOU ARE ON THE WRONG PORT!**

Your screenshots show: `localhost:5174`
Dev server is running on: `localhost:5173`

This means you're loading **OLD CACHED CODE** from a stale server instance!

---

## Complete Execution Flow Analysis

### The Full Call Stack

```
1. User clicks "Generate Fractal" button
   ↓
2. ChoreComponent.handleSubmit(e)
   ├─ Sets sessionStorage.setItem('FORCE_MOCK_MODE', 'true')  ← IF from recovery button
   ├─ Starts 28s Promise.race timeout
   ├─ Starts 30s watchdog timer
   └─ Calls: onSeedSubmit(seedText, onProgress)
      ↓
3. main.jsx: onSeedSubmit(seedText, onProgress)
   └─ Calls: handleSeedSubmit(seedText, projectMeta, onProgress)
      ↓
4. importer.js: handleSeedSubmit(text, projectMeta, onProgress)
   ├─ Calls initDB(), initFederation()
   ├─ Checks AI availability (but doesn't check sessionStorage!)
   └─ Calls: withTimeout(importDocument(text, projectMeta), 30000)
      ↓
5. importer.js: importDocument(text, projectMeta)
   ├─ Awaits: mockSummarize(text, { maxTopics: 5 })  ← Creates fallback
   └─ Calls: withWatchdog(summarizeDocument(text, {...}), 17000, mockFallback)
      ↓
6. chromeAI.js: summarizeDocument(text, options)
   ├─ Checks sessionStorage.getItem('FORCE_MOCK_MODE')  ← SHOULD use mock
   └─ IF mock: return mockHelpers.mockSummarize(...)
   └─ ELSE: Try live AI (times out after 17s watchdog)
```

### The Three Timeout Layers

**Layer 1: ChoreComponent Promise.race (28 seconds)**
- File: `ChoreComponent.jsx` line 117
- Rejects the promise shown to user
- Shows timeout error message
- Does NOT cancel the import (runs in background)

**Layer 2: handleSeedSubmit withTimeout (30 seconds)**
- File: `importer.js` line 102-106
- Wraps importDocument
- Rejects if import takes > 30s
- ERROR: Does not check sessionStorage!

**Layer 3: importDocument withWatchdog (17 seconds)**
- File: `importer.js` line 193-198
- Wraps summarizeDocument
- Returns mock fallback if > 17s
- But live AI is ALREADY called before this timeout fires!

---

## Root Causes Identified

### Bug #1: Wrong Port (CRITICAL)
**Location**: Browser URL bar
**Issue**: Accessing localhost:5174 instead of localhost:5173
**Impact**: Loading old cached code, none of our fixes are active
**Evidence**: Screenshots show 5174, dev server is on 5173

### Bug #2: Missing sessionStorage Check in Multiple Places
**Location**: `importer.js` handleSeedSubmit (line 74-91)
**Issue**: Checks AI availability but IGNORES sessionStorage flag
**Impact**: Even if flag is set, code shows "AI available" message

```javascript
// CURRENT (WRONG):
const availability = checkAIAvailability();
if (!availability.allAvailable) {
  console.warn('Some Chrome Built-in AI APIs are not available...');
  // Uses mock mode
} else {
  console.log('✅ All Chrome Built-in AI APIs available - using live mode');
  // ← BUG: Proceeds with live AI even if FORCE_MOCK_MODE is set!
}
```

### Bug #3: mockSummarize Called Too Early
**Location**: `importer.js` line 190
**Issue**: `await mockSummarize(text, { maxTopics: 5 })` is called BEFORE checking if we need it
**Impact**: If mockSummarize has ANY issue (crash, hang), it blocks the entire import
**Why it's wrong**: We're creating the fallback synchronously instead of lazily

```javascript
// CURRENT (WRONG):
const mockFallback = await mockSummarize(text, { maxTopics: 5 });  // ← Awaiting here!
const summaryResult = await withWatchdog(
  summarizeDocument(text, { maxTopics: 5 }),
  17000,
  mockFallback,
  'importDocument.summarize'
);
```

### Bug #4: summarizeDocument Called Even in Mock Mode
**Location**: `importer.js` line 193-198
**Issue**: Even if FORCE_MOCK_MODE is set, we call `summarizeDocument()` which tries to use live AI first
**Impact**: Live AI is attempted, times out after 17s, then falls back to mock
**Why it's wrong**: We should skip summarizeDocument entirely if mock mode is forced

### Bug #5: No Debug Logging in Critical Paths
**Location**: Multiple files
**Issue**: No logging to trace when sessionStorage flag is checked/used
**Impact**: Can't debug why mock mode isn't being used

---

## The Smoking Gun

Looking at your console logs, I see:

```
✅ [CHORE] Starting import with timeout protection { forceMockMode: false, isForcedMock: true }
```

This reveals the bug!
- `forceMockMode` (React state) = false
- `isForcedMock` (sessionStorage check) = true

React state is stale, but sessionStorage IS set correctly!

But then NO logs appear from:
- `📝 [IMPORTER] importDocument called` ← Not showing!
- `🔍 [AI] summarizeDocument called` ← Not showing!

**Conclusion**: The updated code with debug logs IS NOT LOADED because you're on the wrong port!

---

## Comprehensive Fix Checklist

### Phase 1: Environment & Port (DO THIS FIRST!)

- [ ] **Close ALL browser tabs for localhost:5174**
- [ ] **Close ALL browser tabs for localhost:5173**
- [ ] **In terminal, kill the dev server** (Ctrl+C)
- [ ] **Check for stale processes**:
  ```bash
  lsof -i :5173
  lsof -i :5174
  # If any processes found, kill them:
  kill -9 <PID>
  ```
- [ ] **Clear npm cache**:
  ```bash
  npm run dev
  ```
- [ ] **In browser, clear EVERYTHING**:
  ```javascript
  // In DevTools console:
  localStorage.clear();
  sessionStorage.clear();
  caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  ```
- [ ] **Hard refresh**: Ctrl+Shift+Delete → Clear "Cached images and files" for "All time"
- [ ] **Navigate to**: `http://localhost:5173` (NOT 5174!)
- [ ] **Verify module loaded**: Check console for blue "🚀 chromeAI.js MODULE LOADED - v2.5"

### Phase 2: Code Fixes

#### Fix #1: Add sessionStorage Check to handleSeedSubmit

**File**: `src/core/importer.js` (around line 74-91)

**Current**:
```javascript
const availability = checkAIAvailability();
if (!availability.allAvailable) {
  console.warn('Some Chrome Built-in AI APIs are not available:', availability.missingAPIs);
  // ... uses mock mode
} else {
  console.log('✅ All Chrome Built-in AI APIs available - using live mode');
  // ... proceeds with live AI
}
```

**Fixed**:
```javascript
// Check if user explicitly requested mock mode (from timeout recovery)
const forcedMock = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('FORCE_MOCK_MODE') === 'true';
console.log('📝 [IMPORTER] handleSeedSubmit called', { forcedMock });

if (forcedMock) {
  console.log('🔴 [IMPORTER] FORCE_MOCK_MODE detected - skipping AI availability check');
  onProgress?.({
    step: 'warning',
    progress: 0.05,
    message: '⚠️ Using mock mode (user requested fast fallback)'
  });
} else {
  const availability = checkAIAvailability();
  if (!availability.allAvailable) {
    console.warn('Some Chrome Built-in AI APIs are not available:', availability.missingAPIs);
    onProgress?.({
      step: 'warning',
      progress: 0.05,
      message: `⚠️ AI unavailable - using mock mode (missing: ${availability.missingAPIs.join(', ')})`
    });
  } else {
    console.log('✅ All Chrome Built-in AI APIs available - using live mode');
    onProgress?.({
      step: 'ai-ready',
      progress: 0.05,
      message: '✅ Chrome AI ready - using live mode'
    });
  }
}
```

#### Fix #2: Skip Live AI When Mock Mode Forced

**File**: `src/core/importer.js` (around line 193-198)

**Current**:
```javascript
const mockFallback = await mockSummarize(text, { maxTopics: 5 });
const summaryResult = await withWatchdog(
  summarizeDocument(text, { maxTopics: 5 }),
  17000,
  mockFallback,
  'importDocument.summarize'
);
```

**Fixed**:
```javascript
// Check if mock mode is forced
const forcedMock = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('FORCE_MOCK_MODE') === 'true';

let summaryResult;
if (forcedMock) {
  console.log('📝 [IMPORTER] Using mock summarization (FORCED by user)');
  summaryResult = await mockSummarize(text, { maxTopics: 5 });
} else {
  // Create fallback in case live AI fails
  const mockFallback = await mockSummarize(text, { maxTopics: 5 });
  console.log('📝 [IMPORTER] Trying live AI with mock fallback...');

  summaryResult = await withWatchdog(
    summarizeDocument(text, { maxTopics: 5 }),
    17000,
    mockFallback,
    'importDocument.summarize'
  );
}
console.log('📝 [IMPORTER] summarizeDocument completed');
```

#### Fix #3: Same for Embeddings

**File**: `src/core/importer.js` (find where generateEmbedding is called)

Apply same pattern:
```javascript
const forcedMock = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('FORCE_MOCK_MODE') === 'true';

if (forcedMock) {
  embedding = mockEmbeddingFromText(nodeText, 512);
} else {
  // Try live AI with watchdog
  embedding = await withWatchdog(
    generateEmbedding(nodeText, { dims: 512 }),
    12000,
    mockEmbeddingFromText(nodeText, 512),
    'importDocument.generateEmbedding'
  );
}
```

### Phase 3: Testing Protocol

#### Test 1: Verify Module Loading
- [ ] Navigate to http://localhost:5173
- [ ] Open DevTools Console
- [ ] Verify you see: `🚀 chromeAI.js MODULE LOADED - v2.5 with sessionStorage debug` (BLUE)
- [ ] Verify you see: `🔴 CHORE COMPONENT LOADED - TIMEOUT FIX v2.0` (RED)

#### Test 2: Normal Import (No Timeout)
- [ ] Clear console
- [ ] Paste short text (2-3 sentences)
- [ ] Click "Generate Fractal"
- [ ] Should complete in < 5 seconds
- [ ] Should NOT see timeout error

#### Test 3: Timeout → Mock Mode Recovery
- [ ] Clear console
- [ ] Run: `sessionStorage.clear()`
- [ ] Paste longer text
- [ ] Click "Generate Fractal"
- [ ] Wait for 28s timeout
- [ ] Click **"Use Mock Mode (Fast)"**
- [ ] **Expected logs**:
  ```
  🔴 User requested mock mode fallback
  🔴 [CHORE] Mock mode FORCED by user request
  🔴 [CHORE] Starting import { forceMockMode: true, isForcedMock: true }
  📝 [IMPORTER] importDocument called { forcedMock: true, sessionStorageValue: "true" }
  📝 [IMPORTER] Using mock summarization (FORCED by user)
  [AI] Mock fallback generated 5 topics
  🔍 [AI] generateEmbedding called { forceMockMode: true }
  Using mock embedding (FORCED by user)
  📝 [IMPORTER] Import completed
  🔴 [CHORE] Import succeeded
  ```
- [ ] **Time**: Should complete in ~2-5 seconds (NOT 28s!)
- [ ] **Result**: Success message appears

#### Test 4: Verify Flag Cleanup
- [ ] After successful mock import
- [ ] Check: `sessionStorage.getItem('FORCE_MOCK_MODE')`
- [ ] Should be `null` (flag cleared)
- [ ] Click "Generate Fractal" again (new import)
- [ ] Should try live AI again (not forced mock)

---

## Expected vs Actual Behavior

### Current Behavior (BROKEN)
```
User clicks "Use Mock Mode (Fast)"
  ↓
sessionStorage.setItem('FORCE_MOCK_MODE', 'true') ✅
  ↓
handleSubmit() called
  ↓
onSeedSubmit() → handleSeedSubmit() → importDocument()
  ↓
importDocument() calls summarizeDocument()  ← Still tries live AI!
  ↓
Live AI times out after 17s
  ↓
withWatchdog returns mock fallback
  ↓
But ChoreComponent Promise.race already timed out at 28s ❌
  ↓
User sees timeout error again
```

### Expected Behavior (AFTER FIXES)
```
User clicks "Use Mock Mode (Fast)"
  ↓
sessionStorage.setItem('FORCE_MOCK_MODE', 'true') ✅
  ↓
handleSubmit() called
  ↓
onSeedSubmit() → handleSeedSubmit()
  ↓
handleSeedSubmit() checks sessionStorage → sees 'true'
  ↓
Skips AI availability check
  ↓
importDocument() checks sessionStorage → sees 'true'
  ↓
Skips summarizeDocument() entirely, uses mockSummarize() directly
  ↓
Completes in ~2 seconds ✅
  ↓
User sees success message
```

---

## Debugging Commands

### Check sessionStorage
```javascript
console.log('FORCE_MOCK_MODE:', sessionStorage.getItem('FORCE_MOCK_MODE'));
```

### Check what port you're on
```javascript
console.log('Current URL:', window.location.href);
// Should be: http://localhost:5173/
```

### Check if modules are loaded
```javascript
// Should see these logs in console on page load:
// 🚀 chromeAI.js MODULE LOADED - v2.5 with sessionStorage debug
// 🔴 CHORE COMPONENT LOADED - TIMEOUT FIX v2.0
```

### Manually test mock functions
```javascript
import { mockSummarize, mockEmbeddingFromText } from './ai/mockHelpers.js';

// Test summarize
mockSummarize('Test text here', { maxTopics: 3 }).then(console.log);
// Should return {summary: '...', topics: [{}, {}, {}]}

// Test embedding
const emb = mockEmbeddingFromText('Test text', 512);
console.log('Embedding dims:', emb.length); // Should be 512
```

---

## Summary

**Primary Issue**: Wrong port (5174 instead of 5173) loading old code

**Secondary Issues**:
1. handleSeedSubmit doesn't check sessionStorage
2. importDocument always calls live AI first, even if mock forced
3. No short-circuit path for forced mock mode

**Fix Priority**:
1. ✅ **FIRST**: Fix port issue (navigate to :5173)
2. ✅ **SECOND**: Add sessionStorage checks to handleSeedSubmit
3. ✅ **THIRD**: Add early return in importDocument for forced mock
4. ✅ **FOURTH**: Test with timeout → recovery flow

**Expected Result**: Mock mode completes in 2-5 seconds instead of timing out

---

**Next Step**: Fix the port issue FIRST, then I'll apply the code fixes!
