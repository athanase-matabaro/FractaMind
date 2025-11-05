# Timeout Recovery UI - User Guide

## Problem Solved

**Before**: When AI timed out at 28 seconds, the error appeared but the user was stuck in a loop with no clear path forward. Clicking "Generate Fractal" again would just timeout again.

**After**: When timeout occurs, user gets TWO clear recovery options:
1. **"Use Mock Mode (Fast)"** - Skip AI entirely, use deterministic fallback (completes in ~2 seconds)
2. **"Retry with AI"** - Try live AI again (maybe it will work this time)

---

## What You'll See Now

### When Timeout Occurs (28 seconds)

**Error Message**:
```
Error: Operation timed out after 28 seconds

[Use Mock Mode (Fast)]  [Retry with AI]
```

**Two Recovery Buttons**:

1. **Orange Button: "Use Mock Mode (Fast)"**
   - Automatically re-runs the import using mock mode
   - Bypasses Chrome AI entirely
   - Uses deterministic text-based summaries and hash-based embeddings
   - Completes in ~2-5 seconds
   - Results are functional but not semantically aware
   - **Best for**: Just want to see the app work, don't need AI quality

2. **Purple Button: "Retry with AI"**
   - Clears the error, lets you click "Generate Fractal" again
   - Tries live AI again (maybe it was just slow this time)
   - Uses Chrome Built-in AI if available
   - May timeout again if AI is genuinely unavailable
   - **Best for**: AI is installed but was just slow

---

## How It Works Technically

### Flow Diagram

```
User clicks "Generate Fractal"
   ↓
Processing... (1s), (2s), (3s)... (27s)
   ↓
28s: Promise.race timeout fires
   ↓
Error shown: "Operation timed out after 28 seconds"
   ↓
Two buttons appear:
   ├─ [Use Mock Mode (Fast)] → Force mock mode
   │                             ↓
   │                           sessionStorage.setItem('FORCE_MOCK_MODE', 'true')
   │                             ↓
   │                           Auto-submit form
   │                             ↓
   │                           chromeAI.js checks sessionStorage
   │                             ↓
   │                           All AI functions return mocks
   │                             ↓
   │                           Import completes in ~2s ✅
   │
   └─ [Retry with AI] → Clear error
                          ↓
                        User clicks "Generate Fractal" again
                          ↓
                        Try live AI again
                          ↓
                        May succeed or timeout again
```

### Implementation

**Files Modified**:

1. **ChoreComponent.jsx**
   - Added `forceMockMode` state
   - Added recovery buttons to error display (lines 279-325)
   - Set `sessionStorage` flag when mock mode requested (lines 77-82)
   - Clear flag on success (lines 122-123) and close (line 60)

2. **chromeAI.js**
   - Added `sessionStorage` check in `summarizeDocument` (lines 161-167)
   - Added `sessionStorage` check in `generateEmbedding` (lines 329-335)
   - Added `sessionStorage` check in `expandNode` (lines 396-402)
   - All functions respect the force mock flag

---

## Console Logs

### Timeout → Mock Mode Recovery

```
🔴 [CHORE] Starting import with timeout protection { traceId: "xyz", forceMockMode: false }
✅ All Chrome Built-in AI APIs available - using live mode
[WATCHDOG START] importDocument.summarize { timeoutMs: 17000 }
(28 seconds pass...)
🔴 [CHORE] Promise.race timeout at 28s
🔴 [CHORE] Import failed { error: "Operation timed out after 28 seconds" }

(User clicks "Use Mock Mode (Fast)")

🔴 User requested mock mode fallback
🔴 [CHORE] Starting import with timeout protection { traceId: "abc", forceMockMode: true }
🔴 [CHORE] Mock mode FORCED by user request
⚠️ Some Chrome Built-in AI APIs are not available (but FORCED mock mode)
Using mock summarization (FORCED by user)
[AI] Mock fallback generated 5 topics
Using mock embedding (FORCED by user)
[AI] Mock embedding generated: 512 dims
...
🔴 [CHORE] Import succeeded { traceId: "abc" }
```

### Timeout → Retry with AI

```
(After timeout error appears)

(User clicks "Retry with AI")

🔴 User requested retry with live AI
(User clicks "Generate Fractal" button manually)

🔴 [CHORE] Starting import with timeout protection { traceId: "def", forceMockMode: false }
✅ All Chrome Built-in AI APIs available - using live mode
[AI] Successfully summarized into 5 topics (live mode)
...
🔴 [CHORE] Import succeeded { traceId: "def" }
```

---

## User Testing Scenarios

### Scenario 1: AI Slow But Works

**Steps**:
1. Paste text, click "Generate Fractal"
2. Wait 28 seconds → Timeout error appears
3. Click **"Retry with AI"**
4. Click "Generate Fractal" again
5. This time AI responds faster → Success! ✅

**Why this happens**: AI model was loading or busy, second attempt succeeds

---

### Scenario 2: AI Not Working

**Steps**:
1. Paste text, click "Generate Fractal"
2. Wait 28 seconds → Timeout error appears
3. Click **"Retry with AI"**
4. Click "Generate Fractal" again
5. Wait 28 seconds → Timeout AGAIN
6. Click **"Use Mock Mode (Fast)"**
7. Import completes in 2 seconds → Success! ✅

**Why this happens**: AI genuinely not available (regular Chrome, flags not enabled, etc.)

---

### Scenario 3: Immediate Mock Mode

**Steps**:
1. Paste text, click "Generate Fractal"
2. Wait 28 seconds → Timeout error appears
3. Click **"Use Mock Mode (Fast)"** immediately
4. Import completes in 2 seconds → Success! ✅

**Why this works**: Bypasses AI entirely, uses deterministic fallback

---

## Mock Mode Quality

### What Mock Mode Does

**Summarization**:
- Splits text into sentences
- Chunks sentences into N topics
- Uses first 5 words as title
- Uses first 2 sentences as key points
- **Result**: Text-based topics (not semantically aware)

**Embeddings**:
- Uses SHA-256 hash of text
- Generates reproducible Float32Array
- Normalizes to unit length
- **Result**: Deterministic vectors (cosine similarity works, but not semantic)

**Search**:
- Morton key indexing still works
- Range queries still work
- Cosine similarity ranking still works
- **Result**: Functional search, but less accurate than AI

### When to Use Mock Mode

✅ **Use Mock Mode if**:
- Just want to see the app work
- Don't have Chrome Canary
- AI keeps timing out
- Need fast results for testing
- Offline/no network

❌ **Don't Use Mock Mode if**:
- Need semantically meaningful summaries
- Need accurate semantic search
- Want AI-quality topic extraction
- Have Chrome AI working properly

---

## Technical Details

### SessionStorage Flag

**Key**: `FORCE_MOCK_MODE`
**Values**: `'true'` or not set
**Scope**: Current browser tab only
**Lifetime**: Until tab closed OR cleared after successful import

**Why sessionStorage?**
- Simple: No need to modify function signatures
- Temporary: Auto-clears on tab close
- Scoped: Doesn't affect other tabs
- Works: Easy to check in any module

### Cleanup

**Flag is cleared**:
1. After successful import (lines 122-123)
2. When modal is closed (line 60)
3. When user clicks "Retry with AI" (removes flag)

**Why cleanup matters**: Prevents next import from being stuck in mock mode

---

## Visual Design

### Button Styles

**"Use Mock Mode (Fast)"**:
- Background: `#f59e0b` (orange/amber)
- Text: White
- Font weight: 600
- Padding: 0.5rem 1rem
- Implies: "Fallback option, fast but lower quality"

**"Retry with AI"**:
- Background: `#667eea` (purple/indigo) - matches main button
- Text: White
- Font weight: 600
- Padding: 0.5rem 1rem
- Implies: "Try again with AI, preferred option"

### Layout

```
┌─────────────────────────────────────────┐
│ Error: Operation timed out after 28     │
│ seconds                                  │
│                                          │
│ [Use Mock Mode (Fast)] [Retry with AI]  │
└─────────────────────────────────────────┘
```

**Responsive**: Buttons wrap on narrow screens (`flex-wrap: wrap`)

---

## Future Enhancements

### Possible Improvements

1. **Auto-detect AI availability**
   - Show "Use Mock Mode" button earlier if AI is definitely unavailable
   - Skip timeout wait if AI is not detected

2. **Progress feedback for mock mode**
   - Show "Using mock mode (fast)" during processing
   - Differentiate from "Using live AI" in progress messages

3. **Persistent preference**
   - Remember user's choice (localStorage)
   - Auto-use mock mode next time if user chose it before

4. **Partial AI mode**
   - Use AI for summaries (fast)
   - Use mock for embeddings (slow)
   - Mix and match for optimal speed/quality

5. **Quality indicator**
   - Show badge: "AI Quality" vs "Mock Quality"
   - Let user know what mode was used for results

6. **Retry countdown**
   - Show "Retry in 3... 2... 1..." before auto-retry
   - Give user a chance to cancel

---

## Troubleshooting

### Issue: "Use Mock Mode" doesn't work

**Symptoms**: Clicking button does nothing or times out again

**Possible causes**:
1. JavaScript error in mock helpers
2. sessionStorage not available (private browsing?)
3. Form submission blocked

**Debug**:
```javascript
// Check sessionStorage
console.log(sessionStorage.getItem('FORCE_MOCK_MODE')); // Should be 'true'

// Check if mock helpers work
import { mockSummarize } from './ai/mockHelpers.js';
mockSummarize('test', { maxTopics: 3 }).then(console.log);
```

### Issue: "Retry with AI" still times out

**Symptoms**: Second attempt times out at 28s again

**Explanation**: This is expected if AI is genuinely unavailable or slow

**Solution**: Use "Mock Mode" instead OR wait longer and retry again

### Issue: Mock mode results are poor quality

**Explanation**: Mock mode is not semantically aware, just text-based

**Solutions**:
1. Try AI again (maybe it will work)
2. Install Chrome Canary + enable AI flags
3. Use shorter, simpler text (mock mode works better on simple text)

---

## Status

✅ **COMPLETE AND READY FOR TESTING**

**Date**: 2025-11-02
**Version**: v2.1 (with recovery UI)

**Changes**:
- Added `forceMockMode` state to ChoreComponent
- Added recovery buttons to error display
- Modified AI functions to check sessionStorage
- Added cleanup logic for flag

**Testing**: Ready for user testing with real-world scenarios

---

**Next**: Test with the actual timeout scenario you experienced!
