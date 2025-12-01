# Backend Server

This is the backend server for the IIML Gatekeeper application.

## Setup

1. Install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Create a `.env` file in the `server` directory with the following variables:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   PORT=3001
   FRONTEND_URL=http://localhost:3000
   ```

3. **IMPORTANT: Run the database migration**
   
   Go to your Supabase dashboard → SQL Editor and run the SQL script from `supabase_migration.sql`. This will:
   - Create the function `handle_new_user()` (used by your trigger)
   - Create functions to sync users from `auth.users` to `public.users`
   
   **Note:** The trigger should be created separately in Supabase Dashboard. The migration script only creates the helper functions.

4. Make sure your Supabase `public.users` table has the following structure:
   - `id` (uuid, primary key) - matches `auth.users.id`
   - `student_id` (text, nullable)
   - `full_name` (text)
   - `institute_mail` (text, unique)
   - `role` (text) - values: 'STUDENT', 'GATE_STAFF', 'COUNCIL'
   - `profile_data` (jsonb) - JSON object containing:
     - `mobile_number` (string)
     - `hostel_number` (string)
     - `emergency_contact` (string)
     - `gender` (string)
     - `department` (string)

## Running the Server

Development mode (with hot reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

The server will run on `http://localhost:3001` by default.

## Database Setup

### Step 1: Run the Migration

1. Open your Supabase dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `supabase_migration.sql`
4. Run the script

This creates:
- The function `handle_new_user()` (used by your trigger)
- Functions to sync existing users from `auth.users` to `public.users`

**Note:** The trigger should be created separately in Supabase Dashboard. If you've already created the trigger manually, you can skip creating it again.

### Step 2: Sync Existing Users (if any)

If you already have users in `auth.users` but not in `public.users`, run this in the SQL Editor:

```sql
SELECT public.sync_existing_users();
```

## API Endpoints

### GET `/api/users/:id`
Get user by ID. If user doesn't exist in `public.users`, it will attempt to sync from `auth.users`.

### GET `/api/users/email/:email`
Get user by email (institute_mail). If user doesn't exist in `public.users`, it will attempt to sync from `auth.users`.

### PATCH `/api/users/:id/profile`
Update user profile data (mobileNumber, hostelRoomNo, emergencyContact).

Request body:
```json
{
  "mobileNumber": "9123456789",
  "hostelRoomNo": "Hostel 1, Room 105",
  "emergencyContact": "9876500001"
}
```

### GET `/api/health`
Health check endpoint.

## Troubleshooting

### Backend Connection Issues

1. **Check if server is running:**
   ```bash
   cd server
   npm run dev
   ```

2. **Check environment variables:**
   Make sure `.env` file exists in the `server` directory with correct Supabase credentials.

3. **Check CORS:**
   Make sure `FRONTEND_URL` in `.env` matches your frontend URL (default: `http://localhost:3000`).

### User Not Found Issues

1. **Run the database migration** (see Database Setup above)
2. **Sync existing users:**
   ```sql
   SELECT public.sync_existing_users();
   ```
3. **Check if trigger is working:**
   - Sign up a new user via Google OAuth
   - Check if a record appears in `public.users` automatically

### Fields Not Reflecting

1. **Check backend response:**
   - Open browser DevTools → Network tab
   - Check the API response for user data
   - Verify `profile_data` JSON structure

2. **Check frontend environment variable:**
   Make sure `VITE_API_URL=http://localhost:3001/api` is set in your frontend `.env.local`
