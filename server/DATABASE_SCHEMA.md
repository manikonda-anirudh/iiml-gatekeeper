# Database Schema Reference

This document contains the complete database schema for the IIML GateKeeper application. All code changes should align with these table definitions.

## Tables

### 1. Users Table

```sql
create table public.users (
  id uuid not null,
  student_id text null,
  full_name text null,
  role text null default 'STUDENT'::text,
  profile_data jsonb null,
  is_active boolean null default true,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  institute_mail text null,
  department text null,
  constraint users_pkey primary key (id),
  constraint users_institute_mail_key unique (institute_mail),
  constraint users_student_id_key unique (student_id),
  constraint users_role_check check (
    (
      role = any (
        array[
          'STUDENT'::text,
          'GATE_STAFF'::text,
          'COUNCIL'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;
```

### 2. Vendors Table

Stores the pre-approved list of vendors.

```sql
create table public.vendors (
  id uuid not null default gen_random_uuid(),
  name text not null,
  company_name text null,
  category text null, -- e.g., 'Canteen', 'Maintenance'
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  constraint vendors_pkey primary key (id)
);

-- Index for searching vendors by name
create index idx_vendors_name on public.vendors(name);
```

### 3. Guest Requests Table

The "folder" for a visit. It snapshots the student's details at the time of request (in case they change hostels later).

```sql
create table public.guest_requests (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  
  -- Request Details
  purpose text not null,
  arrival_date date not null,
  entry_time_start time not null, -- e.g., '10:00'
  exit_time_end time not null,    -- e.g., '18:00'
  vehicle_numbers text null,      -- Comma separated string
  
  -- Snapshot of Student Details (for history accuracy)
  hostel_room text null,
  student_mobile text null,
  -- Approval Workflow
  status text not null default 'PENDING',
  approved_by uuid null, -- Link to admin/council user
  rejection_reason text null,
  
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  constraint guest_requests_pkey primary key (id),
  constraint guest_requests_student_id_fkey foreign key (student_id) references public.users(id),
  constraint guest_requests_approved_by_fkey foreign key (approved_by) references public.users(id),
  
  -- Enforce valid statuses
  constraint guest_requests_status_check check (
    status in ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'COMPLETED')
  )
);

-- Index for filtering requests by student and status
create index idx_requests_student on public.guest_requests(student_id);
create index idx_requests_status on public.guest_requests(status);
```

### 4. Guests Table

Stores individual people inside a request. Contains the critical entry_code.

```sql
create table public.guests (
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  
  -- Personal Info
  name text not null,
  relation text not null, -- e.g., Father, Sister
  mobile text null,
  
  -- Gate Logic
  entry_code text null, -- Generated when Request is APPROVED
  
  created_at timestamp with time zone default timezone('utc'::text, now()),
  constraint guests_pkey primary key (id),
  constraint guests_request_id_fkey foreign key (request_id) references public.guest_requests(id) on delete cascade,
  
  -- Ensure Entry Codes are unique to avoid collision at the gate
  constraint guests_entry_code_key unique (entry_code)
);

-- Critical Index: This makes looking up a guest by code instant at the gate
create index idx_guests_entry_code on public.guests(entry_code);
```

### 5. Movement Logs Table (The Ledger)

This records every single entry and exit.

```sql
create table public.movement_logs (
  id uuid not null default gen_random_uuid(),
  timestamp timestamp with time zone default timezone('utc'::text, now()),
  
  -- Movement Logic
  movement_type text not null, -- 'ENTRY' or 'EXIT'
  entity_type text not null,   -- 'STUDENT', 'GUEST', 'VENDOR'
  
  -- The Security Guard who logged it
  gate_user_id uuid null,
  -- Dynamic Linking (Only one of these should be populated per row)
  student_id uuid null,
  guest_id uuid null,
  vendor_id uuid null,
  
  -- Metadata
  remarks text null, -- e.g., "Carrying heavy bags", "Vehicle UP32..."
  constraint movement_logs_pkey primary key (id),
  constraint movement_logs_gate_user_fkey foreign key (gate_user_id) references public.users(id),
  constraint movement_logs_student_fkey foreign key (student_id) references public.users(id),
  constraint movement_logs_guest_fkey foreign key (guest_id) references public.guests(id),
  constraint movement_logs_vendor_fkey foreign key (vendor_id) references public.vendors(id),
  constraint movement_logs_type_check check (movement_type in ('ENTRY', 'EXIT')),
  constraint movement_logs_entity_check check (entity_type in ('STUDENT', 'GUEST', 'VENDOR'))
);

-- Critical Index: For the "Master Ledger" view (sorting by time)
create index idx_logs_timestamp on public.movement_logs(timestamp desc);
-- Index for calculating "Is Inside?" quickly
create index idx_logs_student_latest on public.movement_logs(student_id, timestamp desc);
```

