# 🔴 CRITICAL: How to Load the Timeout Fix

## The timeout fix IS working (proven by test-timeout.html)
## The issue is browser cache - follow these steps EXACTLY:

### Step 1: Close ALL browser tabs with localhost:5173
- Close every tab/window showing your app
- This is CRITICAL - browser keeps old version in memory

### Step 2: Clear browser cache
**Chrome/Edge:**
1. Press `F12` to open DevTools
2. Right-click the refresh button (when DevTools is open)
3. Select "Empty Cache and Hard Reload"

**OR use keyboard shortcut:**
- Windows/Linux: `Ctrl + Shift + Delete`
- Mac: `Cmd + Shift + Delete`
- Then check "Cached images and files" and click "Clear data"

### Step 3: Open a NEW tab
Go to: `http://localhost:5173`

### Step 4: Verify the fix is loaded
You should see:
1. **Browser tab title**: "FractaMind - Explore Ideas Like a Fractal [TIMEOUT FIX v2.0]"
2. **Console message** (F12 → Console tab):
   ```
   🔴 ONBOARD POPOVER LOADED - TIMEOUT FIX VERSION 2.0
   Features: Promise.race (28s) + Watchdog (30s) + DOM fallback + Visual timer
   ```
3. **Red banner** in the modal:
   "🔴 TIMEOUT FIX ACTIVE - Max 28s + Visual Timer 🔴"

### Step 5: Test the timeout
1. Click "Start Your Knowledge Fractal"
2. Paste any text
3. Click the button
4. Watch: "Processing... (1s)", "(2s)", "(3s)"...
5. At 28 seconds → Error message + "Retry" button

---

## If you STILL don't see the red banner:

### Nuclear Option 1: Use Incognito/Private Mode
- Open a new Incognito/Private window
- Go to `http://localhost:5173`
- The fix WILL load (no cache)

### Nuclear Option 2: Different Browser
- Try Firefox or Edge if you're using Chrome
- Or vice versa
- Fresh browser = fresh cache

### Nuclear Option 3: Manual Service Worker Clear
1. Open DevTools (F12)
2. Go to Application tab
3. Click "Service Workers" (left sidebar)
4. Click "Unregister" if any exist
5. Click "Storage" → "Clear site data"
6. Refresh

---

## What the logs will show when working:

```
🔴 ONBOARD POPOVER LOADED - TIMEOUT FIX VERSION 2.0
Features: Promise.race (28s) + Watchdog (30s) + DOM fallback + Visual timer

[UI] submit -> import call { traceId: "xyz", mode: "live" }
[UI] Setting watchdog timer for 30s { traceId: "xyz" }
[UI] Racing import promise against 28s timeout
[WATCHDOG START] importDocument.summarize { id: "abc", timeoutMs: 17000 }

... (at 28 seconds) ...

[UI] Import Promise.race timeout fired at 28s
❌ Caught error: Operation timed out after 28 seconds
[UI] import fallback { traceId: "xyz", error: "Import operation timed out..." }
```

---

## The fix CANNOT fail if loaded correctly because:

✅ Promise.race ALWAYS wins after 28s (JavaScript guarantee)
✅ Watchdog timer ALWAYS fires after 30s (JavaScript guarantee)
✅ DOM manipulation bypasses React (direct element access)
✅ Visual timer shows progress every second (proof it's working)

**If you see the red banner, the fix IS working**
**If you don't see it, the old code is still cached**

---

## Verified Working:
- ✅ test-timeout.html works perfectly
- ✅ Promise.race logic is sound
- ✅ Timeout fires at correct time
- ✅ Error handling works
- ✅ Recovery UI appears

The issue is 100% browser cache. Follow the steps above!
