# Data Persistence Issue - Deep Diagnosis

## Problem Statement
When users log back into their account, **none of their data is displayed**:
- Artist bio is not showing
- Uploaded files are missing
- All profile data appears lost

## Root Cause Analysis

### 1. **CRITICAL: No Data Loading on Login** ⚠️

**Location:** [client/src/contexts/AuthContext.tsx](client/src/contexts/AuthContext.tsx)

**Current Flow:**
```typescript
useEffect(() => {
  const token = apiClient.getToken();
  if (token) {
    // ❌ TOKEN EXISTS BUT USER DATA IS NEVER LOADED
    setIsLoading(false);
  } else {
    setIsLoading(false);
  }
}, []);
```

**Problem:**
- When user has a valid token (from previous session), the app sets `isLoading = false`
- However, it **NEVER** calls the backend to fetch user data
- The `user` state remains `null`
- The `isAuthenticated` is `false` even though token exists

**Impact:**
- User appears "logged in" (has token) but the app doesn't know WHO they are
- No user ID available to fetch artist profile
- All data fetching fails silently

---

### 2. **Zustand Store Has NO Persistence** ⚠️

**Location:** [client/src/stores/artistStore.ts](client/src/stores/artistStore.ts)

**Current Implementation:**
```typescript
export const useArtistStore = create<ArtistStore>((set) => ({
  artistData: {
    artistName: '',
    genre: '',
    bio: '',
  },
  mediaFiles: [],
  // ... methods
}));
```

**Problem:**
- Zustand store is **in-memory only**
- Every page refresh = complete data loss
- No localStorage persistence
- No backend sync

**Impact:**
- Even if PersonaForm saves data to Zustand, it's lost on refresh
- Dashboard shows empty state after reload
- User must re-enter data every session

---

### 3. **Dashboard Doesn't Fetch Backend Data** ⚠️

**Location:** [client/src/pages/Dashboard.tsx](client/src/pages/Dashboard.tsx)

**Current Implementation:**
```typescript
const Dashboard = () => {
  const { artistData, mediaFiles } = useArtistStore(); // ❌ Only reads Zustand

  // NO API CALLS TO FETCH BACKEND DATA!
  // NO useEffect to load data on mount

  return (
    <div>
      {artistData.artistName ? (
        // Display data
      ) : (
        <p>Complete your persona form...</p> // ❌ Always shows this!
      )}
    </div>
  );
};
```

**Problem:**
- Dashboard only reads from Zustand store
- Never calls `apiClient.getArtistProfile()`
- Never syncs with backend database
- Shows empty state even when backend has data

**Impact:**
- User creates profile via PersonaForm
- Data saves to backend successfully
- User refreshes page or logs back in
- Dashboard is empty (Zustand store is empty, no fetch happens)

---

### 4. **PersonaForm Only Updates Zustand** ⚠️

**Location:** [client/src/pages/PersonaForm.tsx](client/src/pages/PersonaForm.tsx)

**Current Flow (After Our Fix):**
```typescript
const onSubmit = async (values: ArtistData) => {
  // ✅ Step 1: Create backend artist profile
  await apiClient.createArtistProfile({
    artist_name: values.artistName,
    genre: values.genre,
    bio: values.bio,
  });

  // ✅ Step 2: Create backend persona
  await apiClient.createPersonaFromArtistData({...});

  // ⚠️ Step 3: Update Zustand (in-memory only!)
  updateArtistData(values);
};
```

**Problem:**
- Backend save works correctly ✅
- Zustand update happens ✅
- BUT: Zustand data is lost on page refresh ❌
- No mechanism to reload from backend ❌

**Impact:**
- Submit form → Success
- Refresh page → Data gone (from UI perspective)
- Backend still has data, but UI doesn't know

---

### 5. **File Uploads - No UI Integration** ⚠️

**Backend Status:**
- `POST /api/uploads/persona/questionnaire` ✅ Exists
- `POST /api/uploads/persona/transcript` ✅ Exists
- `GET /api/uploads/persona/files` ✅ Exists

**Frontend Status:**
- NO upload component in UI ❌
- NO API client methods for uploads ❌
- MediaFiles in Zustand are never populated ❌

**Problem:**
- Backend upload routes exist and work
- Frontend has no way to use them
- Dashboard expects `mediaFiles` array but it's always empty
- No upload UI anywhere in the application

**Impact:**
- User can't upload files through UI
- Even if they somehow upload via API directly, UI won't display them

---

## Data Flow Diagram

### Current Flow (BROKEN):
```
User Logs In
    ↓
Token saved to localStorage ✅
    ↓
AuthContext checks token exists ✅
    ↓
❌ NO USER DATA FETCHED
    ↓
user = null, isAuthenticated = false
    ↓
Dashboard mounts
    ↓
Reads Zustand store (empty)
    ↓
❌ NO BACKEND FETCH
    ↓
Shows "Complete your persona form..."
```

### Expected Flow (SHOULD BE):
```
User Logs In
    ↓
Token saved to localStorage ✅
    ↓
AuthContext checks token exists ✅
    ↓
✅ FETCH USER DATA (/api/users/me)
    ↓
✅ FETCH ARTIST PROFILE (/api/artists/profile)
    ↓
✅ UPDATE ZUSTAND WITH BACKEND DATA
    ↓
user = {...}, isAuthenticated = true
    ↓
Dashboard mounts
    ↓
✅ DATA ALREADY LOADED IN ZUSTAND
    ↓
Shows user's profile, bio, files
```

---

## Missing Backend Endpoint

### `/api/users/me` - GET Current User

**Status:** ❌ DOES NOT EXIST

**Needed For:**
- Validating JWT token on app load
- Getting current user ID and email
- Restoring auth state after page refresh

**Expected Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2025-10-21T..."
  }
}
```

---

## Specific Issues

### Issue 1: Artist Bio Not Showing After Re-Login

**Why:**
1. User creates artist profile (saves to backend) ✅
2. User logs out
3. User logs back in
4. Token is restored ✅
5. **AuthContext doesn't fetch user data** ❌
6. **Dashboard doesn't fetch artist profile** ❌
7. Zustand store is empty ❌
8. Bio doesn't show ❌

**Fix Required:**
- Add `/api/users/me` endpoint
- Fetch user + artist data in AuthContext on token restore
- Update Zustand with fetched data

---

### Issue 2: Uploaded Files Not Showing

**Why:**
1. **No upload UI exists** ❌
2. `mediaFiles` in Zustand is always empty array
3. Even if backend has uploads, no code fetches them
4. Dashboard displays `mediaFiles.length` which is always 0

**Fix Required:**
- Create upload component/page
- Add API client methods for file uploads
- Fetch uploaded files on Dashboard mount
- Populate Zustand `mediaFiles` array

---

### Issue 3: Data Lost on Page Refresh

**Why:**
1. Zustand store has no persistence middleware
2. All state is in-memory only
3. Page refresh = new JavaScript context = empty state

**Fix Required:**
- Add Zustand persist middleware
- Store critical data in localStorage
- Sync with backend as source of truth

---

## Backend Data Storage (WORKING)

### Database Tables:
1. **users** - User accounts ✅
2. **artists** - Artist profiles ✅
3. **artist_personas** - Personas ✅
4. **persona_questionnaires** - Questionnaire responses ✅
5. **persona_transcripts** - Uploaded files ✅
6. **generated_content** - AI content ✅

### API Endpoints (WORKING):
- `POST /api/artists/profile` - Create artist ✅
- `GET /api/artists/profile` - Get artist ✅
- `PUT /api/artists/profile` - Update artist ✅
- `POST /api/personas/questionnaire` - Create persona ✅
- `GET /api/personas/persona` - Get persona ✅
- `POST /api/uploads/persona/questionnaire` - Upload file ✅
- `GET /api/uploads/persona/files` - List uploads ✅

**Backend is fully functional - data IS being saved!**

---

## Frontend Data Loading (BROKEN)

### Current State:
- ❌ No data fetch on login
- ❌ No data fetch on app mount with existing token
- ❌ No Zustand persistence
- ❌ No file upload UI
- ❌ No file list display
- ❌ Dashboard doesn't sync with backend

### What Needs to Happen:
1. **AuthContext** - Fetch user + artist data on mount
2. **Dashboard** - Fetch and display backend data
3. **Zustand Store** - Add persistence middleware
4. **File Uploads** - Create UI component
5. **Data Sync** - Periodic or on-mount sync with backend

---

## Code Locations

### Files That Need Changes:

1. **server/src/routes/users.ts**
   - Add `GET /api/users/me` endpoint

2. **client/src/contexts/AuthContext.tsx** (lines 31-42)
   - Fetch user data when token exists
   - Fetch artist profile on successful login
   - Update Zustand store with data

3. **client/src/stores/artistStore.ts** (entire file)
   - Add Zustand persist middleware
   - Add method to sync with backend
   - Add method to load from backend

4. **client/src/pages/Dashboard.tsx** (lines 7-9)
   - Add useEffect to fetch data on mount
   - Call `apiClient.getArtistProfile()`
   - Call upload files API
   - Update Zustand store

5. **client/src/lib/api.ts**
   - Add `getCurrentUser()` method
   - Add file upload methods
   - Add get uploaded files method

6. **NEW FILE: client/src/pages/MediaUpload.tsx**
   - Create file upload UI
   - Integrate with backend upload endpoints

---

## Test Cases

### Test 1: Bio Persistence
```
1. Login as user
2. Create artist profile with bio
3. Verify bio shows in Dashboard
4. Refresh page
5. ❌ FAILS: Bio disappears

Expected: Bio should still show
Actual: Dashboard empty
```

### Test 2: Re-login Data
```
1. Login as user
2. Create artist profile
3. Logout
4. Login again
5. ❌ FAILS: No data shows

Expected: Artist data should load
Actual: Empty state, must re-enter
```

### Test 3: File Upload
```
1. Login as user
2. Try to upload file
3. ❌ FAILS: No upload button exists

Expected: Upload UI should exist
Actual: No UI for uploads
```

---

## Priority Fixes

### P0 - Critical (Breaks user experience):
1. ✅ Add `GET /api/users/me` endpoint
2. ✅ Fetch user data in AuthContext on token restore
3. ✅ Fetch artist profile on app mount
4. ✅ Update Zustand with backend data

### P1 - High (Data loss):
5. ✅ Add Zustand persistence middleware
6. ✅ Sync Dashboard with backend on mount

### P2 - Medium (Missing features):
7. ⚠️ Create file upload UI
8. ⚠️ Fetch and display uploaded files
9. ⚠️ Add file management (delete, view)

---

## Implementation Plan

### Phase 1: Immediate Fixes (30 minutes)
1. Create `GET /api/users/me` endpoint
2. Update AuthContext to fetch user on token restore
3. Update Dashboard to fetch data on mount
4. Add basic Zustand persistence

### Phase 2: Data Sync (20 minutes)
5. Create data sync utility
6. Load artist profile into Zustand on login
7. Load persona data into Zustand
8. Test complete flow

### Phase 3: File Uploads (40 minutes)
9. Create MediaUpload component
10. Add API client upload methods
11. Integrate upload UI in app
12. Fetch and display files in Dashboard

---

## Summary

### The Core Problem:
**Frontend never fetches backend data after login.**

### Why It Happens:
1. AuthContext has token but doesn't fetch user
2. Zustand store has no persistence
3. Dashboard doesn't call backend APIs
4. No sync mechanism between backend (has data) and frontend (shows empty)

### What Users Experience:
- Create profile → Success ✅
- Refresh page → Data gone ❌
- Log out/in → Data gone ❌
- Upload files → No UI ❌
- View files → Empty list ❌

### Backend Status:
**✅ FULLY WORKING** - Data is being saved correctly

### Frontend Status:
**❌ NOT LOADING DATA** - Just needs to fetch from backend

---

## Next Steps

1. Read diagnosis (you are here)
2. Implement Phase 1 fixes
3. Test with real user flow
4. Implement Phase 2 if needed
5. Add Phase 3 for complete feature

---

*Diagnosis Date: 2025-10-21*
*Issue: Data not persisting across sessions*
*Root Cause: Frontend doesn't fetch backend data*
*Status: Diagnosed - Ready for fixes*
