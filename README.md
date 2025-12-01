<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# IIML Gatekeeper

A gate management system for IIM Lucknow with role-based access for students, gate staff, and council members.

## Architecture

This application consists of:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)

## Prerequisites

- Node.js (v18 or higher)
- Supabase account and project
- Gemini API key (for AI assistant feature)

## Setup

### 1. Frontend Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file in the root directory:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_API_URL=http://localhost:3001/api
   ```

3. Run the frontend:
   ```bash
   npm run dev
   ```

### 2. Backend Setup

1. Navigate to the server directory:
   ```bash
   cd server
   npm install
   ```

2. Create a `.env` file in the `server` directory:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   PORT=3001
   FRONTEND_URL=http://localhost:3000
   ```

3. Run the backend server:
   ```bash
   npm run dev
   ```

See [server/README.md](server/README.md) for detailed backend setup instructions.

### 3. Database Setup

Ensure your Supabase `public.users` table has the following structure:
- `id` (uuid, primary key)
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

## Running the Application

1. Start the backend server (from `server` directory):
   ```bash
   npm run dev
   ```

2. Start the frontend (from root directory):
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:3000`

## Features

- **Student Dashboard**: Request exits/entries, manage guest passes, view profile
- **Gate Staff Dashboard**: Approve/reject movement requests, manage vendors
- **Council Dashboard**: Approve/reject guest requests
- **Profile Management**: Students can update their contact and hostel information
- **AI Assistant**: Powered by Gemini for help and guidance
