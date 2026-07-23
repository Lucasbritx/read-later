create table if not exists public.kindle_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kindle_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindle_settings_email_trim_check check (length(trim(kindle_email)) > 0),
  constraint kindle_settings_email_shape_check check (
    kindle_email ~* '^[^@[:space:]]+@(free\.)?kindle\.com$'
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kindle_settings_set_updated_at on public.kindle_settings;

create trigger kindle_settings_set_updated_at
before update on public.kindle_settings
for each row
execute function public.set_updated_at();

alter table public.kindle_settings enable row level security;

drop policy if exists "Users can select their own kindle settings" on public.kindle_settings;

create policy "Users can select their own kindle settings"
  on public.kindle_settings
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own kindle settings" on public.kindle_settings;

create policy "Users can insert their own kindle settings"
  on public.kindle_settings
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own kindle settings" on public.kindle_settings;

create policy "Users can update their own kindle settings"
  on public.kindle_settings
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
