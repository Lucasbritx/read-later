create extension if not exists "pgcrypto";

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text not null,
  description text not null default '',
  site_name text not null default '',
  status text not null default 'unread',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint articles_status_check check (status in ('unread', 'read')),
  constraint articles_url_trim_check check (length(trim(url)) > 0),
  constraint articles_title_trim_check check (length(trim(title)) > 0)
);

create unique index articles_user_url_key
  on public.articles (user_id, lower(url));

create index articles_user_status_created_at_idx
  on public.articles (user_id, status, created_at desc);

create index articles_user_created_at_idx
  on public.articles (user_id, created_at desc);

alter table public.articles enable row level security;

create policy "Users can select their own articles"
  on public.articles
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own articles"
  on public.articles
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own articles"
  on public.articles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own articles"
  on public.articles
  for delete
  using (auth.uid() = user_id);
