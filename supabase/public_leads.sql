-- Create a simple table for Vercel-safe public lead capture.
-- Run this once in Supabase SQL Editor.

create table if not exists public.public_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_name text not null,
  website_url text not null,
  contact_email text not null,
  status text not null default 'new',
  screenshot_url text,
  prestige_score integer,
  meta jsonb
);

-- Helpful index for follow-ups
create index if not exists public_leads_created_at_idx on public.public_leads (created_at desc);
create index if not exists public_leads_status_idx on public.public_leads (status);
