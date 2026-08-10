
-- V121 Parent App Control Center database setup
-- Safe to run more than once.

create table if not exists public.parent_app_settings (
  id text primary key default 'main',
  contact_title text not null default 'تواصل معنا',
  contact_subtitle text not null default 'للاستفسار عن الدراسة أو الحسابات أو بيانات الطالب',
  phone text null,
  whatsapp text null,
  email text null,
  address text null,
  reminder_minutes integer not null default 30,
  updated_at timestamptz not null default now()
);

insert into public.parent_app_settings(id)
values('main')
on conflict (id) do nothing;

create table if not exists public.student_schedule_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_type text not null check (event_type in ('class','homework','exam')),
  title text not null,
  event_at timestamptz not null,
  note text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists student_schedule_events_student_time_idx
  on public.student_schedule_events(student_id,event_at);

create index if not exists student_schedule_events_active_time_idx
  on public.student_schedule_events(is_active,event_at);

-- Reload PostgREST schema cache after creating tables.
notify pgrst, 'reload schema';
