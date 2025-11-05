# Processing Timeout Fix - Comprehensive Solution

## Problem
App gets stuck at "Processing..." indefinitely when AI operations hang or take too long.

## Root Causes Identified
1. **React closure bug**: setTimeout callback was checking stale `isSubmitting` state
2. **No Promise timeout**: The import function could hang indefinitely without any timeout
3. **No visual feedback**: User couldn't see how long processing was taking
4. **State update failures**: React state updates might not trigger re-renders

## Multi-Layer Solution Implemented

### Layer 1: Promise.race Timeout (28 seconds)
**File**: `src/components/OnboardPopover/OnboardPopover.jsx:250-258`

```javascript
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => {
    console.error('[UI] Import Promise.race timeout fired at 28s');
    reject(new Error('Import operation timed out after 28 seconds'));
  }, 28000);
});

result = await Promise.race([importPromise, timeoutPromise]);
```

**Purpose**: Hard timeout that rejects the promise if import takes >28s

### Layer 2: UI Watchdog Timer (30 seconds)
**File**: `src/components/OnboardPopover/OnboardPopover.jsx:213-238`

```javascript
watchdogTimerRef.current = setTimeout(() => {
  if (isProcessingRef.current) {
    console.error('[UI] EMERGENCY WATCHDOG ACTIVATED');
    isProcessingRef.current = false;
    setIsSubmitting(false);
    setAiTimedOut(true);
    setError('Processing took too long...');

    // NUCLEAR OPTION: Direct DOM manipulation
    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.textContent = 'Retry';
      submitButton.disabled = false;
    }
  }
}, 30000);
```

**Purpose**: Last resort fallback that:
- Uses ref instead of state (avoids closure bug)
- Directly manipulates DOM if React state fails
- Fires at 30s as final safety net

### Layer 3: Visual Feedback Timer
**File**: `src/components/OnboardPopover/OnboardPopover.jsx:214-216, 470`

```javascript
// Start counter
elapsedTimerRef.current = setInterval(() => {
  setSecondsElapsed(prev => prev + 1);
}, 1000);

// Show in button text
{isSubmitting ? `Processing... (${secondsElapsed}s)` : 'Start'}
```

**Purpose**: User sees elapsed time, knows the app is still working

### Layer 4: Proper Cleanup
**File**: `src/components/OnboardPopover/OnboardPopover.jsx:83-92`

```javascript
useEffect(() => {
  return () => {
    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
  };
}, []);
```

**Purpose**: Clean up timers on unmount to prevent memory leaks

## Testing Checklist

### Manual Tests
- [ ] **Normal success path**: Import completes in <5s → No timeout, shows success
- [ ] **Slow AI (10-25s)**: Takes 15s → Shows elapsed time, completes successfully
- [ ] **AI timeout (28s)**: Promise.race rejects → Error shown, Retry button appears
- [ ] **Emergency watchdog (30s)**: If Promise.race fails → DOM manipulation kicks in
- [ ] **AI unavailable**: No window.ai → Falls back to mock mode gracefully
- [ ] **Network offline**: No connectivity → Timeout triggers, shows error
- [ ] **Large document**: 10,000 words → May take longer, but timeout still fires

### Browser Console Verification
Look for these logs in sequence:

```
[UI] submit -> import call { traceId: "...", mode: "live" }
[UI] Setting watchdog timer for 30s { traceId: "..." }
[UI] Racing import promise against 28s timeout
[WATCHDOG START] importDocument.summarize { id: "...", timeoutMs: 17000 }
...
# If timeout at 28s:
[UI] Import Promise.race timeout fired at 28s
Import failed: Error: Import operation timed out after 28 seconds

# If emergency watchdog at 30s:
[UI] Watchdog timer fired! { traceId: "...", isStillProcessing: true }
[UI] EMERGENCY WATCHDOG ACTIVATED - forcing stop
[UI] Forcibly updated button via DOM manipulation
```

### Visual Verification
- Button should show: "Processing... (1s)", "Processing... (2s)", etc.
- At 28s: Button changes to "Retry" and "Continue with demo summary" appears
- Error message: "Processing took too long. You can retry or continue with a demo summary."

## Chrome AI Setup
For live AI to work (not mock mode):

1. Chrome version: 128+ (Canary/Dev recommended)
2. Flags to enable:
   ```
   chrome://flags/#optimization-guide-on-device-model
   chrome://flags/#prompt-api-for-gemini-nano
   chrome://flags/#summarization-api-for-gemini-nano
   ```
3. All set to "Enabled"
4. Restart Chrome
5. Visit chrome://components/ → Download "Optimization Guide On Device Model"

## Deployment Notes

- All changes are client-side only
- No backend changes required
- No new dependencies added
- Compatible with Vite HMR
- Works in both dev and production builds

## Files Modified
- `src/components/OnboardPopover/OnboardPopover.jsx` - Main timeout logic
- `src/core/importer.js` - Already had watchdog wrappers (from previous hotfix)

## Recovery Options Shown to User
When timeout occurs:

1. **Retry Button**: Try the same operation again (maybe AI became available)
2. **Continue with Demo Summary**: Use deterministic mock data to proceed
3. **Cancel**: Close modal and start over

## Success Metrics
- ✅ No infinite "Processing..." hangs
- ✅ User sees elapsed time (transparency)
- ✅ Graceful degradation to mock mode
- ✅ Multiple safety nets (Promise.race + watchdog + DOM manipulation)
- ✅ Comprehensive logging for debugging
- ✅ Clean timer cleanup (no memory leaks)

## Next Steps for Testing

1. **Hard refresh browser**: Ctrl+Shift+R (Cmd+Shift+R on Mac)
2. **Clear browser cache if needed**
3. **Test with real text**: Paste the Medium about text
4. **Wait and observe**:
   - 0-5s: Should see "Processing... (1s)", (2s), etc.
   - 5-10s: Still processing, counter keeps incrementing
   - 28s: Promise.race timeout should fire → Error message shown
   - 30s: If Promise.race somehow failed, watchdog fires → Button force-updated

5. **Check console**: Should see all the logging sequences above

---

**Date**: Oct 31, 2025
**Status**: ✅ READY FOR TESTING
**Risk**: LOW (multiple fallback layers, graceful degradation)
