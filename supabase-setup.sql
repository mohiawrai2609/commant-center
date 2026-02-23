-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Creates the signals table for storing daily intelligence signals

create table if not exists signals (
  id uuid default gen_random_uuid() primary key,
  day date not null unique,
  data jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security (keeps data accessible via anon key)
alter table signals enable row level security;

-- Policy: allow all reads
create policy "Allow public read" on signals
  for select using (true);

-- Policy: allow all inserts/updates (you can restrict later with auth)
create policy "Allow public insert" on signals
  for insert with check (true);

create policy "Allow public update" on signals
  for update using (true);

-- Optional: auto-update the updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger signals_updated_at
  before update on signals
  for each row execute function update_updated_at();
