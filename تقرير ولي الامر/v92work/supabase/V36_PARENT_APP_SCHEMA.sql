create extension if not exists pgcrypto;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.courses(name) values
('SAT'),('EST'),('Beginners 1'),('Beginners 2'),('Math')
on conflict (name) do nothing;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  phone text,
  course_name text not null,
  report_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parent_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.student_parents (
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id uuid not null references public.parent_accounts(id) on delete cascade,
  relation_order int not null check (relation_order in (1,2)),
  primary key(student_id,parent_id)
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  week_label text not null,
  week_start date not null,
  week_end date not null,
  teacher_note text,
  followup_note text,
  next_week_plan text,
  status text not null default 'draft' check(status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(student_id,week_start,week_end)
);

create table if not exists public.attendance_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.weekly_reports(id) on delete cascade,
  date date not null,
  status text not null check(status in ('present','absent','late')),
  note text
);

create table if not exists public.homework_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.weekly_reports(id) on delete cascade,
  title text not null,
  due_date date,
  status text not null check(status in ('completed','missing','late')),
  score numeric,
  max_score numeric,
  check(score is null or max_score is null or (score >= 0 and max_score > 0 and score <= max_score))
);

create table if not exists public.exam_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.weekly_reports(id) on delete cascade,
  title text not null,
  date date,
  score numeric not null,
  max_score numeric not null,
  check(score >= 0 and max_score > 0 and score <= max_score)
);

create table if not exists public.exam_sections (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exam_entries(id) on delete cascade,
  name text not null,
  score numeric not null,
  max_score numeric not null,
  check(score >= 0 and max_score > 0 and score <= max_score)
);

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.weekly_reports(id) on delete cascade unique,
  paid numeric not null default 0,
  due numeric not null default 0,
  due_date date,
  note text
);

create table if not exists public.staff_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check(role in ('owner','manager','data_entry','viewer')),
  phone text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;
alter table public.students enable row level security;
alter table public.parent_accounts enable row level security;
alter table public.student_parents enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.attendance_entries enable row level security;
alter table public.homework_entries enable row level security;
alter table public.exam_entries enable row level security;
alter table public.exam_sections enable row level security;
alter table public.finance_entries enable row level security;
alter table public.staff_users enable row level security;

-- This app accesses data through server-side API routes using the service role key.
-- Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
