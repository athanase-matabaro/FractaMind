# Chrome Built-in AI Integration Guide

**Last Updated**: 2025-11-03
**Version**: 2.0 (Post-API-Fix)

## Overview

FractaMind uses Chrome's Built-in AI (Gemini Nano) to run AI operations **locally** in your browser. This ensures complete privacy - your data never leaves your device.

This document explains:
- How the integration works
- Required Chrome setup
- Troubleshooting steps
- API patterns and best practices

---

## Architecture

### API Integration Pattern

FractaMind follows the **official Chrome Built-in AI API pattern** verified against Google's `web-ai-demos` repository:

```javascript
// 1. Check if API exists
if ('LanguageModel' in self) {
  // 2. Check availability
  const availability = await LanguageModel.availability();

  // 3. Create session if available
  if (availability !== 'unavailable') {
    const session = await LanguageModel.create({
      initialPrompts: [{
        role: 'system',
        content: 'System prompt here'
      }]
    });

    // 4. Use the session
    const response = await session.prompt('User prompt');
  }
}
```

**Key Points**:
- Use **global constructors** (`LanguageModel`, `Writer`, `Summarizer`), NOT `window.ai.*`
- Always call `.availability()` before `.create()`
- Handle three states: `'available'`, `'downloadable'`, `'unavailable'`

---

## Chrome Built-in AI APIs Used

FractaMind integrates with these Chrome AI APIs:

| API | Purpose | Status | Wrapper Location |
|-----|---------|--------|------------------|
| **LanguageModel** (Prompt API) | Document summarization, node expansion, rewriting | ✅ Integrated | `src/ai/chromeAI.js` |
| **Writer** | Text generation (fallback) | ✅ Integrated | `src/ai/chromeAI.js` |
| **Summarizer** | Document summarization (fallback) | ✅ Integrated | `src/ai/chromeAI.js` |
| **Embeddings** | Semantic vectors | ❌ Not available | Always uses mock |

### Why Mock Embeddings?

Chrome's Built-in AI does not currently provide an Embeddings API. FractaMind uses **deterministic mock embeddings** that work reliably for semantic search while maintaining privacy.

---

## Setting Up Chrome for AI

### Prerequisites

1. **Chrome Canary** (version 127 or higher)
   - Download: https://www.google.com/chrome/canary/
   - Regular Chrome Stable does not yet support these APIs

2. **Enable Chrome Flags**

   Open `chrome://flags` and enable these flags:

   ```
   #optimization-guide-on-device-model → Enabled
   #prompt-api-for-gemini-nano → Enabled
   ```

3. **Restart Chrome** after enabling flags

4. **Verify Installation**

   Open DevTools Console and check:
   ```javascript
   console.log('LanguageModel' in self); // Should be true
   ```

### Model Download

On first use, Chrome will download the Gemini Nano model (~1.5GB). This happens automatically but can take 5-10 minutes depending on your connection.

**Progress Indication**:
- FractaMind shows "Analyzing document..." while model downloads
- Check Chrome's download progress in DevTools: `chrome://on-device-model-internals/`

---

## Configuration

### Environment Variables

Create `.env` file (copy from `.env.example`):

```bash
# AI Mode: 'live' or 'mock'
VITE_AI_MODE=live

# Timeout for AI operations (120s for debugging, 30s for production)
VITE_AI_TIMEOUT_MS=120000

# Polling timeout for availability checks
VITE_AI_POLL_MAX_MS=120000

# Enable debug logs
VITE_ENABLE_DEBUG_LOGS=true
```

### Mode Explanation

**Live Mode** (`VITE_AI_MODE=live`):
- Uses Chrome Built-in AI
- Requires Chrome Canary with flags enabled
- Slower first run (model download)
- Complete privacy (no network requests)

**Mock Mode** (`VITE_AI_MODE=mock`):
- Uses deterministic fallback algorithms
- Always works (no Chrome dependencies)
- Instant responses
- Good for development/testing

### Timeout Configuration

**Default: 120 seconds** (for debugging)

This extended timeout allows:
- Model download on first use
- Model warm-up time
- Debugging live AI operations

**For Production**: Reduce to `30000` (30s) after initial setup is verified.

---

## How It Works

### Document Import Flow

1. **User submits text** → ChoreComponent
2. **Check availability** → `checkAIAvailability()`
3. **Ensure model ready** → `ensureModelReady('LanguageModel')`
4. **Summarize** → `summarizeDocument()` (with 120s timeout)
5. **Generate embeddings** → `generateEmbedding()` (uses mocks)
6. **Create nodes** → Parse summary into FractalNode objects
7. **Persist** → Save to IndexedDB

### Fallback Strategy

FractaMind has **multiple fallback layers**:

1. **Primary**: Try live Chrome AI
2. **Timeout Fallback**: If operation exceeds 120s, switch to mock
3. **Error Fallback**: If API throws error, switch to mock
4. **Unavailable Fallback**: If model unavailable, use mock immediately
5. **User-Forced Mock**: User can manually switch to mock mode via sessionStorage

### Watchdog Safety Net

Every AI operation has a watchdog timer that:
- Prevents UI from hanging indefinitely
- Logs timeout events for debugging
- Automatically falls back to deterministic mocks
- Ensures user always gets a result (even if mock)

---

## Troubleshooting

### Issue: "Processing..." hangs forever

**Cause**: API not properly initialized or model not ready

**Solutions**:
1. Check Chrome flags are enabled (`chrome://flags`)
2. Restart Chrome Canary
3. Check console for errors: Open DevTools (F12)
4. Verify API availability:
   ```javascript
   console.log('LanguageModel' in self); // Should be true
   await LanguageModel.availability(); // Should be 'available' or 'downloadable'
   ```
5. Try mock mode: Set `VITE_AI_MODE=mock` in `.env`

### Issue: "Model unavailable on this device"

**Cause**: Device/OS not supported or model failed to download

**Solutions**:
1. Check `chrome://on-device-model-internals/` for model status
2. Try downloading model manually from Chrome settings
3. Use mock mode as fallback

### Issue: Operations timeout after 120s

**Cause**: Model still downloading or device too slow

**Solutions**:
1. Wait for model download to complete (check `chrome://on-device-model-internals/`)
2. Increase timeout in `.env`: `VITE_AI_TIMEOUT_MS=180000` (3 minutes)
3. Use mock mode during model download

### Issue: "LanguageModel is not defined"

**Cause**: Running in browser without AI support

**Solutions**:
1. Use Chrome Canary (not regular Chrome)
2. Enable required flags
3. Check if running on supported OS (Windows, Mac, Linux, ChromeOS)

### Issue: Results are deterministic/repetitive

**Cause**: Accidentally using mock mode

**Check**:
```javascript
// In console
console.log(import.meta.env.VITE_AI_MODE); // Should be 'live'
```

**Fix**: Set `VITE_AI_MODE=live` in `.env`

---

## API Reference

### Core Functions

#### `checkAIAvailability()`

Checks if AI API constructors are present (NOT if models are ready).

```javascript
const { available, allAvailable, missingAPIs } = checkAIAvailability();

console.log(available.prompt); // true if LanguageModel exists
console.log(available.writer); // true if Writer exists
console.log(available.summarizer); // true if Summarizer exists
```

#### `ensureModelReady(apiName, options)`

**NEW in v2.0**: Checks if model is actually ready to use.

```javascript
// Check if LanguageModel is ready
try {
  const availability = await ensureModelReady('LanguageModel');
  // 'available', 'downloadable', or throws if 'unavailable'
} catch (error) {
  console.error('Model not ready:', error);
  // Fall back to mock
}
```

**Parameters**:
- `apiName`: `'LanguageModel'`, `'Writer'`, or `'Summarizer'`
- `options.onDownloadProgress`: Callback for download progress (optional)

**Reference**: Based on `web-ai-demos/news-app/script.js:42-49`

#### `summarizeDocument(text, options)`

Summarizes document into 3-7 top-level topics.

```javascript
const result = await summarizeDocument(text, {
  maxTopics: 5,
  mock: false, // Set true to force mock mode
  timeoutMs: 120000 // Override default timeout
});

// Result: { summary: string, topics: Array<{id, title, text, summary, keyPoints}> }
```

**Timeout**: 120s (configurable)
**Fallback**: Automatically uses mock on error/timeout

#### `expandNode(nodeText, options)`

Expands a node into 2-4 child nodes.

```javascript
const children = await expandNode(nodeText, {
  title: 'Parent Node',
  numChildren: 3,
  mock: false,
  timeoutMs: 120000
});

// Result: Array<{title: string, text: string}>
```

#### `generateEmbedding(text, options)`

Generates semantic embedding vector (always uses mock - Chrome doesn't provide this API).

```javascript
const embedding = await generateEmbedding(text, {
  dims: 512,
  mock: false // Ignored - always uses mock
});

// Result: Float32Array(512)
```

---

## Development Tips

### Debugging

Enable debug logs:
```bash
VITE_ENABLE_DEBUG_LOGS=true
VITE_DEBUG_AI_TRACE=true
```

Watch console for:
- `[AI]` prefixed messages
- `[WATCHDOG]` timeout tracking
- API availability checks

### Testing

Run tests with mock mode (always works):
```bash
VITE_AI_MODE=mock npm test
```

Run tests with live AI (requires Chrome Canary):
```bash
VITE_AI_MODE=live npm test
```

### Performance Monitoring

Check operation timings:
```javascript
// AI operations log elapsed time
// Look for "[AI] Generated embedding (live mode): 512 dims"
```

---

## Best Practices

### For Developers

1. **Always check availability before create()**
   ```javascript
   const avail = await ensureModelReady('LanguageModel');
   if (avail !== 'unavailable') {
     const session = await LanguageModel.create(...);
   }
   ```

2. **Use timeout wrappers**
   ```javascript
   const result = await timeout(
     aiOperation(),
     120000,
     'Operation timed out'
   );
   ```

3. **Provide fallbacks**
   ```javascript
   try {
     return await liveAIFunction();
   } catch (error) {
     console.warn('Falling back to mock');
     return await mockFunction();
   }
   ```

4. **Handle download state**
   ```javascript
   const avail = await LanguageModel.availability();
   if (avail === 'downloadable') {
     // Show download progress UI
     const session = await LanguageModel.create({
       monitor(m) {
         m.addEventListener('downloadprogress', (e) => {
           updateProgress(e.loaded, e.total);
         });
       }
     });
   }
   ```

### For Users

1. Use **mock mode** during development for fast iteration
2. Test with **live mode** before deploying
3. Keep **timeout at 120s** until model fully downloaded
4. Check **Chrome DevTools console** if issues occur
5. Report bugs with console logs attached

---

## Security & Privacy

### Data Privacy

**✅ Complete Privacy**: All AI operations run **locally** in your browser. No data is sent to external servers.

**How it Works**:
- Gemini Nano model is downloaded to your device
- All inference happens on-device
- No network requests during AI operations
- IndexedDB storage is local to your browser

### Model Updates

Chrome automatically updates the Gemini Nano model. Updates are:
- Downloaded in background
- Applied on next Chrome restart
- Do not affect existing sessions

---

## References

### Official Documentation
- Chrome AI APIs: https://developer.chrome.com/docs/ai
- Origin Trial: https://goo.gle/chrome-ai-dev-preview-join

### Code References
- **FractaMind**: `src/ai/chromeAI.js` - AI wrapper implementation
- **web-ai-demos**: Google's official demo repository (reference implementation)
  - news-app: https://github.com/GoogleChromeLabs/web-ai-demos/tree/main/news-app
  - prompt-api-playground: Shows LanguageModel usage
  - summarization-api-playground: Shows Summarizer API patterns

### Related Files
- `src/ai/chromeAI.js` - Main AI integration
- `src/ai/mockHelpers.js` - Mock fallback implementations
- `src/core/importer.js` - Document import pipeline
- `reports/ai_integration_diagnostics.json` - Integration analysis
- `CHANGELOG_AI_FIX.md` - Recent fixes applied

---

## Changelog

### v2.0 (2025-11-03)
- ✅ Fixed API namespace (window.ai.* → global constructors)
- ✅ Added `ensureModelReady()` for availability checks
- ✅ Extended timeouts to 120s for debugging
- ✅ Verified against web-ai-demos patterns
- ✅ Comprehensive documentation

### v1.0 (Initial)
- Basic Chrome AI integration
- Mock mode support
- Timeout handling

---

**Questions or Issues?**
Check console logs first, then see `diagnostic-report.log` for detailed analysis.
