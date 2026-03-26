create extension if not exists pgcrypto;

create table if not exists public.humor_flavors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.humor_flavor_steps (
  id uuid primary key default gen_random_uuid(),
  flavor_id uuid not null references public.humor_flavors(id) on delete cascade,
  title text not null,
  instruction text not null,
  step_order integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (flavor_id, step_order)
);

create table if not exists public.humor_flavor_runs (
  id uuid primary key default gen_random_uuid(),
  flavor_id uuid not null references public.humor_flavors(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  image_id text,
  source_image_name text,
  source_image_url text,
  captions jsonb not null default '[]'::jsonb,
  trace jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_humor_flavors_updated_at on public.humor_flavors;
create trigger set_humor_flavors_updated_at
before update on public.humor_flavors
for each row execute procedure public.set_updated_at();

drop trigger if exists set_humor_flavor_steps_updated_at on public.humor_flavor_steps;
create trigger set_humor_flavor_steps_updated_at
before update on public.humor_flavor_steps
for each row execute procedure public.set_updated_at();

alter table public.humor_flavors enable row level security;
alter table public.humor_flavor_steps enable row level security;
alter table public.humor_flavor_runs enable row level security;

create policy "admins manage humor flavors"
on public.humor_flavors
for all
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (profiles.is_superadmin = true or profiles.is_matrix_admin = true)
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (profiles.is_superadmin = true or profiles.is_matrix_admin = true)
  )
);

create policy "admins manage humor flavor steps"
on public.humor_flavor_steps
for all
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (profiles.is_superadmin = true or profiles.is_matrix_admin = true)
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (profiles.is_superadmin = true or profiles.is_matrix_admin = true)
  )
);

create policy "admins manage humor flavor runs"
on public.humor_flavor_runs
for all
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (profiles.is_superadmin = true or profiles.is_matrix_admin = true)
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (profiles.is_superadmin = true or profiles.is_matrix_admin = true)
  )
);
