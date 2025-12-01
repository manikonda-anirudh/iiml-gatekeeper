# Setup Guide - Backend Integration

## Issues Fixed

1. **Backend Connection**: Fixed `VITE_API_URL` environment variable usage
2. **Auto-population**: Created database trigger to auto-populate `public.users` from `auth.users`
3. **User Sync**: Added functions to sync existing users

## Step-by-Step Setup

### 1. Backend Server Setup

1. Navigate to server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file in `server/` directory:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   PORT=3001
   FRONTEND_URL=http://localhost:3000
   ```

4. Start the backend server:
   ```bash
   npm run dev
   ```

   You should see: `🚀 Backend server running on http://localhost:3001`

### 2. Database Migration (CRITICAL)

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Open the file `server/supabase_migration.sql`
4. Copy the entire SQL script
5. Paste it into the SQL Editor
6. Click **Run**

This creates:
- The function `handle_new_user()` (used by your trigger)
- Functions to sync existing users

**Note:** The trigger should be created separately in Supabase Dashboard. If you've already created the trigger manually, you can skip creating it again.

### 3. Sync Existing Users (if you have any)

If you already have users in `auth.users` but not in `public.users`:

1. In Supabase SQL Editor, run:
   ```sql
   SELECT public.sync_existing_users();
   ```

### 4. Frontend Environment Variables

Make sure your frontend `.env.local` (in root directory) has:
```
GEMINI_API_KEY=your_gemini_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3001/api
```

### 5. Verify Setup

1. **Backend is running**: Check `http://localhost:3001/api/health` in browser
2. **Database trigger**: Sign up a new user via Google OAuth and check if they appear in `public.users`
3. **Frontend connection**: Check browser console for any connection errors

## Troubleshooting

### Backend Connection Refused

**Error**: `ERR_CONNECTION_REFUSED` or `ERR_EMPTY_RESPONSE`

**Solution**:
1. Make sure backend server is running (`cd server && npm run dev`)
2. Check if port 3001 is available
3. Verify `.env` file exists in `server/` directory

### User Not Found

**Error**: "User not found in backend, using fallback data"

**Solution**:
1. Run the database migration (Step 2 above)
2. If user already exists in `auth.users`, run: `SELECT public.sync_existing_users();`
3. Check Supabase dashboard → Table Editor → `users` table to see if user exists

### Fields Not Showing

**Issue**: Profile fields are empty even after updating

**Solution**:
1. Check browser DevTools → Network tab → Look for API calls to `/api/users/:id/profile`
2. Verify the response contains the updated `profile_data`
3. Check Supabase → `users` table → `profile_data` column to see if data is saved
4. Make sure `profile_data` is JSONB type in Supabase

### Database Trigger Not Working

**Issue**: New users don't appear in `public.users` after signup

**Solution**:
1. Verify trigger exists: In Supabase SQL Editor, run:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```
2. If trigger doesn't exist, create it in Supabase Dashboard → Database → Triggers
3. Make sure the function `handle_new_user()` exists (run the migration script)
4. Manually sync: `SELECT public.sync_existing_users();`

## Database Schema

Your `public.users` table should have:

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  student_id TEXT,
  full_name TEXT NOT NULL,
  institute_mail TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'STUDENT',
  profile_data JSONB DEFAULT '{}'::jsonb
);
```

The `profile_data` JSONB should contain:
```json
{
  "mobile_number": "9123456789",
  "hostel_number": "Hostel 1, Room 105",
  "emergency_contact": "9876500001",
  "gender": "Male",
  "department": "PGP"
}
```

