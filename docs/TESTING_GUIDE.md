# FractaMind Testing & Development Guide

Quick reference for testing different AI modes and running validation.

---

## 🚀 Development Scripts

### Start Development Server

```bash
# Default mode (uses .env or .env.local)
npm start
# OR
npm run dev

# Force MOCK mode (deterministic fallbacks, no AI required)
npm run dev:mock

# Force LIVE mode (uses Chrome Built-in AI)
npm run dev:live

# Debug mode (live AI + detailed console logging)
npm run dev:debug
```

### What Each Mode Does

| Command | AI Mode | Debug Logs | Use Case |
|---------|---------|------------|----------|
| `npm start` | From .env | No | Normal development |
| `npm run dev:mock` | **MOCK** | No | Testing without Chrome AI, demos |
| `npm run dev:live` | **LIVE** | No | Testing with real Chrome AI |
| `npm run dev:debug` | **LIVE** | **Yes** | Debugging AI issues, seeing traces |

---

## 🧪 Testing Scripts

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# AI wrapper tests (29 tests)
npm run test:ai

# UI fallback tests (12 tests)
npm run test:ui

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Validation Scripts
```bash
# Quick validation (AI environment check)
npm run validate

# Full validation (tests + validation + build)
npm run validate:full
```

---

## 🔍 Manual Testing Scenarios

### Scenario 1: Test Mock Mode
**Goal**: Verify app works without Chrome Built-in AI

```bash
# Start in mock mode
npm run dev:mock

# In browser:
# 1. Paste text into OnboardPopover
# 2. Click "Generate Fractal"
# 3. Should complete INSTANTLY (< 1 second)
# 4. Check console for: "Using mock summarization"
```

**Expected Console Output**:
```
Using mock summarization (mode: mock)
Using mock embedding (mode: mock)
[WATCHDOG START] importDocument.summarize
[WATCHDOG SUCCESS] importDocument.summarize
```

---

### Scenario 2: Test Live Mode (Chrome AI Available)
**Goal**: Verify app uses real Chrome Built-in AI

```bash
# Start in live mode
npm run dev:live

# In browser (Chrome Canary with AI enabled):
# 1. Paste text
# 2. Click "Generate Fractal"
# 3. Should complete in 5-15 seconds
# 4. Check console for live AI logs
```

**Expected Console Output**:
```
[WATCHDOG START] importDocument.summarize
// ... AI processing ...
[WATCHDOG SUCCESS] importDocument.summarize
```

---

### Scenario 3: Test Watchdog Timeout
**Goal**: Verify fallback when AI times out

```bash
# Start in debug mode
npm run dev:debug

# In browser console, BEFORE submitting text:
delete window.ai;

# Then submit text
# Expected: Falls back to mock after timeout
```

**Expected Console Output**:
```
[UI] submit -> import call { traceId: '...', mode: 'live' }
[WATCHDOG START] importDocument.summarize { timeoutMs: 17000 }
Chrome Built-in AI not available. Using fallback mock.
[WATCHDOG TIMEOUT] importDocument.summarize - using fallback
Using mock summarization (mode: mock)
[WATCHDOG SUCCESS] importDocument.summarize
[UI] import returned { ok: true }
```

---

### Scenario 4: Test UI Watchdog (Extreme Hang)
**Goal**: Verify UI never hangs longer than 30 seconds

```bash
# 1. Temporarily modify src/core/importer.js
# Add BEFORE line 175 (summarizeDocument call):
await new Promise(resolve => setTimeout(resolve, 35000));

# 2. Start server
npm run dev:debug

# 3. Submit text
# Expected: UI watchdog fires at 30s, shows Retry/Demo buttons
```

**Expected Console Output**:
```
[UI] submit -> import call { traceId: '...', mode: 'live' }
... 30 seconds pass ...
[UI] processing watchdog fired { traceId: '...', maxMs: 30000 }
```

**Expected UI**:
- Error message: "Processing took too long..."
- Two buttons visible: "Retry" and "Continue with demo summary"

---

## 🐛 Debugging Tips

### Enable Debug Logging

**Option 1**: Use debug script
```bash
npm run dev:debug
```

**Option 2**: Set env variable
```bash
# In .env.local:
VITE_DEBUG_AI_TRACE=true
```

### Common Debug Logs

| Log Pattern | Meaning |
|-------------|---------|
| `[WATCHDOG START]` | Operation started with timeout |
| `[WATCHDOG SUCCESS]` | Operation completed successfully |
| `[WATCHDOG TIMEOUT]` | Timeout fired, using fallback |
| `[UI] submit -> import call` | User clicked submit |
| `[UI] import returned` | Import completed |
| `[UI] processing watchdog fired` | UI 30s timeout triggered |

### Check AI Availability

```javascript
// In browser console:
console.log('window.ai:', typeof window.ai);
console.log('Available APIs:', window.ai ? Object.keys(window.ai) : 'none');

// Expected in Chrome Canary with AI enabled:
// window.ai: 'object'
// Available APIs: ['languageModel', 'summarizer', 'writer', 'embedding', ...]
```

### Simulate Slow AI

```javascript
// In browser console BEFORE submitting:
window.ai = {
  languageModel: {
    create: () => new Promise(resolve =>
      setTimeout(() => resolve({
        prompt: () => Promise.resolve('{"topics": []}')
      }), 20000) // 20 second delay
    )
  }
};

// Then submit text
// Expected: Watchdog should timeout after 17s and use fallback
```

---

## 📊 Expected Test Results

### All Tests Passing
```bash
npm test

# Expected output:
# Test Suites: 3 passed, 3 total
# Tests:       41 passed, 41 total
# Time:        ~12s
```

### Validation Passing
```bash
npm run validate

# Expected output:
# ✅ Phase-5 Validation passed in 6.0 ms
# 📊 Test Results:
#   1. Functions exported: ✅
#   2. Embeddings deterministic: ✅
#   3. Timeout/fallback works: ✅
#   4. Mock mode works: ✅
#   5. Summary roundtrip: ✅
```

### Build Passing
```bash
npm run build

# Expected output:
# ✓ built in 1.6s
# dist/index.html                   0.61 kB
# dist/assets/index-[hash].css     38.71 kB
# dist/assets/index-[hash].js     241.62 kB
```

---

## 🔧 Configuration Files

### .env.example (Template)
```env
# AI Configuration
VITE_AI_MODE=live                    # Options: 'live' | 'mock'
VITE_AI_TIMEOUT_MS=15000             # Timeout in milliseconds
VITE_DEBUG_AI_TRACE=false            # Enable detailed logging

# Feature Flags
VITE_FEATURE_WORKSPACE=true
VITE_ENABLE_DEBUG_LOGS=false
VITE_ENABLE_PERFORMANCE_MONITORING=false
```

### .env.local (Your Local Settings)
Create this file to override defaults:

```env
# For mock-only development:
VITE_AI_MODE=mock

# For live AI with debug logs:
VITE_AI_MODE=live
VITE_DEBUG_AI_TRACE=true

# For faster timeout during testing:
VITE_AI_TIMEOUT_MS=5000
```

---

## 🎯 Quick Troubleshooting

### Problem: UI hangs in "Processing..."
**Solution**:
1. Check console for watchdog logs
2. Verify `[WATCHDOG TIMEOUT]` appears after 17-20s
3. Verify `[UI] processing watchdog fired` appears at 30s
4. If neither appears, the hotfix isn't active

### Problem: Tests failing
**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests again
npm test
```

### Problem: Build fails
**Solution**:
```bash
# Check for syntax errors
npm run lint

# Clear build cache
rm -rf dist

# Try build again
npm run build
```

### Problem: Chrome AI not working
**Solution**:
1. Use Chrome Canary (not stable Chrome)
2. Enable AI flags: `chrome://flags/#optimization-guide-on-device-model`
3. Restart Chrome Canary
4. Verify: `console.log(window.ai)` should return object
5. Or just use mock mode: `npm run dev:mock`

---

## 📝 Notes

- **Mock mode** is ALWAYS safe and works offline
- **Live mode** requires Chrome Canary with AI flags enabled
- **Debug mode** shows detailed watchdog and AI wrapper logs
- **Watchdogs** ensure UI never hangs (17s/20s at importer, 30s at UI)
- **All tests** should pass regardless of AI availability

---

## 🚦 CI/CD Integration

For continuous integration:

```bash
# Run this in your CI pipeline:
npm run validate:full

# This runs:
# 1. npm test (all 41 tests)
# 2. npm run validate (environment check)
# 3. npm run build (production build)
```

---

**For more details**, see:
- [HOTFIX_SUMMARY.md](HOTFIX_SUMMARY.md) - Complete hotfix documentation
- [docs/README_BRIEF.md](docs/README_BRIEF.md) - AI configuration guide
- [docs/AI_ROBUSTNESS_VALIDATION.md](docs/AI_ROBUSTNESS_VALIDATION.md) - Validation report
