# Update API URLs to Use Centralized Config

## Current Status

The API URL `http://127.0.0.1:8000` is currently hardcoded in **87 files** throughout the frontend.

## What Was Set Up

✅ **Centralized Configuration**
- Created `src/config.js` with API_BASE_URL
- Created `.env.development` for local development
- Created `.env.production` for production (Railway backend)

## Railway Backend URL

```
https://school-management-system-production-a3f2.up.railway.app
```

## How to Update (Two Options)

### Option A: Quick Find & Replace (Recommended)

Use your code editor's find and replace across all files in `src/`:

**Find:**
```
'http://127.0.0.1:8000
```

**Replace with:**
```javascript
import API_BASE_URL from './config';

// Then use:
`${API_BASE_URL}
```

**OR simpler, just replace:**
```
http://127.0.0.1:8000
```

**With:**
```
${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}
```

### Option B: Import config.js in Each File

**Step 1:** Add import at top of file:
```javascript
import API_BASE_URL from '../config'; // or './config' or '../../config' depending on file location
```

**Step 2:** Replace hardcoded URLs:
```javascript
// Before:
const response = await fetch('http://127.0.0.1:8000/api/users/login/', {

// After:
const response = await fetch(`${API_BASE_URL}/api/users/login/`, {
```

## Files That Need Updating

Here are the main files (87 total):

- `src/pages/HomePage.jsx` - Line 24
- `src/pages/AdminLogin.jsx` - Line 20
- `src/authUtils.js` - Line 28
- `src/pages/TeacherDashboard.jsx` - Lines 60, 96
- All components in `src/components/` (83 files)

## Testing After Update

**Local Development:**
```bash
npm run dev
# Should use http://127.0.0.1:8000
```

**Production Build:**
```bash
npm run build
# Should use https://school-management-system-production-a3f2.up.railway.app
```

## For Cloudflare Pages

When deploying to Cloudflare Pages, set environment variable:

**Environment Variable:**
```
VITE_API_URL=https://school-management-system-production-a3f2.up.railway.app
```

**Or** just use the `.env.production` file (already configured).

## Quick Shell Script to Update All Files

```bash
#!/bin/bash
# Run this from the frontend directory

cd src

# Replace all hardcoded URLs
find . -type f \( -name "*.jsx" -o -name "*.js" \) -exec sed -i.bak "s|'http://127.0.0.1:8000|\${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}|g" {} \;
find . -type f \( -name "*.jsx" -o -name "*.js" \) -exec sed -i.bak 's|"http://127.0.0.1:8000|${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}|g' {} \;

# Remove backup files
find . -name "*.bak" -delete

echo "✅ All URLs updated!"
```

## Summary

✅ Railway backend: `https://school-management-system-production-a3f2.up.railway.app`
✅ Config file created: `src/config.js`
✅ Environment files created: `.env.development`, `.env.production`
✅ Ready for Cloudflare Pages deployment

**Next Step:** Update all hardcoded URLs using one of the options above.
