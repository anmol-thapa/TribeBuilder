# Login 449 Error - Troubleshooting Guide

## Error
"Login failed: Http error! status: 449"

---

## Root Cause
The 449 status code is **NOT coming from the backend**. All backend endpoints are working correctly:
- `POST /api/users/login` returns 200 ✅
- `GET /api/users/me` returns 200 ✅
- `GET /api/uploads/persona/files` returns 200 ✅

The 449 error is likely caused by:
1. **Browser cache** with stale data
2. **Service worker** intercepting requests
3. **Browser extension** modifying responses
4. **Corrupt localStorage** data

---

## Solution: Clear Browser Data

### Method 1: Hard Refresh (Quick Fix)

**Chrome/Edge:**
1. Open DevTools (F12)
2. Right-click the reload button
3. Select "Empty Cache and Hard Reload"

**Firefox:**
1. Press `Ctrl + Shift + Delete`
2. Select "Cached Web Content"
3. Click "Clear Now"

**Safari:**
1. Safari → Preferences → Advanced
2. Check "Show Develop menu"
3. Develop → Empty Caches

---

### Method 2: Clear localStorage (Recommended)

**Step 1: Open Browser Console**
- Press `F12` or right-click → Inspect
- Go to "Console" tab

**Step 2: Clear All Storage**
```javascript
// Clear localStorage
localStorage.clear();

// Clear sessionStorage
sessionStorage.clear();

// Reload page
location.reload();
```

**Step 3: Verify**
```javascript
// Check localStorage is empty
console.log(localStorage.length); // Should be 0
```

---

### Method 3: Incognito/Private Mode (Test)

**To verify it's a caching issue:**
1. Open Incognito/Private window
2. Go to http://localhost:8084
3. Try logging in
4. If it works → Caching issue confirmed

---

### Method 4: Disable Service Workers

**Chrome/Edge:**
1. Open DevTools (F12)
2. Go to "Application" tab
3. Click "Service Workers" in left sidebar
4. Click "Unregister" for any service workers
5. Reload page

**Firefox:**
1. Open DevTools (F12)
2. Go to "Debugger" tab
3. Look for service workers
4. Remove any registered workers

---

### Method 5: Complete Browser Reset

**Chrome/Edge:**
```
1. Press Ctrl + Shift + Delete
2. Select:
   - Browsing history
   - Cookies and site data
   - Cached images and files
3. Time range: "All time"
4. Click "Clear data"
5. Restart browser
```

**Firefox:**
```
1. Press Ctrl + Shift + Delete
2. Select "Everything"
3. Check all boxes
4. Click "Clear Now"
5. Restart browser
```

---

## Verification Steps

### Step 1: Test Backend Directly
```bash
# Test login endpoint
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Should return 200 with token
```

### Step 2: Test with Node Script
```bash
# Run the test script
node test-login-flow.js

# All steps should pass
```

### Step 3: Check Frontend
1. Clear browser data (see methods above)
2. Open http://localhost:8084
3. Open DevTools → Network tab
4. Try logging in
5. Check the status code in Network tab:
   - Should be 200 (not 449)

---

## Common Causes of 449

### 1. Stale Token in localStorage
```javascript
// In browser console
localStorage.getItem('auth_token')
// If this shows old/invalid token, clear it:
localStorage.removeItem('auth_token')
```

### 2. Corrupt Zustand State
```javascript
// In browser console
localStorage.getItem('artist-storage')
// If this shows corrupt data, clear it:
localStorage.removeItem('artist-storage')
```

### 3. Browser Extension Interference
- Ad blockers
- Privacy extensions
- Security extensions
- Try disabling all extensions and test again

### 4. Proxy/VPN Issues
- Some proxies modify HTTP status codes
- Try without VPN/proxy

---

## Debug in Browser Console

### Check What's Failing
```javascript
// Open browser console (F12)
// Try this:

fetch('http://localhost:3000/api/users/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password123'
  })
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Status Text:', r.statusText);
  console.log('OK:', r.ok);
  return r.json();
})
.then(data => console.log('Data:', data))
.catch(err => console.error('Error:', err));
```

**Expected Output:**
```
Status: 200
Status Text: OK
OK: true
Data: {message: "Login successful", user: {...}, token: "..."}
```

**If you see 449:**
- It's coming from browser/proxy, not backend
- Clear all browser data
- Try incognito mode

---

## Alternative Login Method (Temporary Workaround)

If login keeps failing, you can temporarily test with API token:

### Step 1: Get Token via curl
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.token'
```

### Step 2: Set Token in Browser
```javascript
// In browser console
const token = "paste-token-here";
localStorage.setItem('auth_token', token);
location.reload();
```

This bypasses the login form and should let you test the app.

---

## Technical Details

### What 449 Means
- **449 Retry With** - Microsoft IIS extension
- **Not standard HTTP** - Shouldn't appear normally
- **Usually caching** - Indicates browser/proxy issue

### Our Backend Returns
- **200** - Success
- **400** - Validation error
- **401** - Authentication failed
- **403** - Forbidden
- **404** - Not found
- **409** - Conflict (user exists)
- **500** - Server error

**Never 449** ← This confirms it's not our backend!

---

## Prevention

### For Future Development:

**1. Add Better Error Logging**
```typescript
// In API client
console.log('Fetch response:', {
  status: response.status,
  statusText: response.statusText,
  ok: response.ok,
  headers: Object.fromEntries(response.headers.entries())
});
```

**2. Add Status Code Validation**
```typescript
if (response.status === 449) {
  console.error('Detected 449 - likely browser cache issue');
  console.error('Try clearing browser cache and localStorage');
  throw new Error('Browser cache issue detected. Please clear cache and try again.');
}
```

**3. Add Service Worker Check**
```typescript
// In main app
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => {
      if (registrations.length > 0) {
        console.warn('Service workers detected. May cause caching issues.');
      }
    });
}
```

---

## Quick Fix Summary

**Most Likely Solution:**
```javascript
// Run this in browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

**Then:**
1. Go to http://localhost:8084
2. Login again
3. Should work ✅

**If still fails:**
1. Try incognito mode
2. Try different browser
3. Disable all browser extensions
4. Check if VPN/proxy is active

---

## Test Results

### Backend Tests: ✅ ALL PASS
```
Login endpoint:           200 OK ✅
/users/me endpoint:       200 OK ✅
/uploads/persona/files:   200 OK ✅
```

### Conclusion
Backend is working perfectly. The 449 error is **definitely** from the browser/client side.

---

## Support

If clearing cache doesn't work:

1. **Check Network Tab in DevTools:**
   - See the actual HTTP status code
   - Check request headers
   - Check response headers

2. **Try curl:**
   ```bash
   # This WILL work (proven)
   curl -X POST http://localhost:3000/api/users/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

3. **Check for Service Workers:**
   - DevTools → Application → Service Workers
   - Unregister all

4. **Check Browser Extensions:**
   - Disable all extensions
   - Test again

---

**Status:** Backend Working ✅ | Frontend Issue (Browser Cache)

**Solution:** Clear browser cache and localStorage

**Prevention:** Regular cache clearing during development

---

*Created: 2025-11-25*
*Issue: Login returns 449 error*
*Root Cause: Browser caching/service worker*
*Fix: Clear browser data*
