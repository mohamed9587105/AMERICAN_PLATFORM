alter table public.parent_accounts add column if not exists parent_code text;
create unique index if not exists parent_accounts_parent_code_uq on public.parent_accounts(parent_code) where parent_code is not null;

-- Backfill readable parent codes for existing accounts.
update public.parent_accounts
set parent_code = 'PR-' || upper(substr(replace(id::text,'-',''),1,8))
where parent_code is null;

-- Keep the main course list ready for registration/import.
insert into public.courses(name) values
('SAT'),('EST'),('Beginners 1'),('Beginners 2'),('Math')
on conflict (name) do nothing;
