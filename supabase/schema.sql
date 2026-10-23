create table if not exists public.projects (
  id text primary key,
  status text not null check (status in ('draft', 'published')),
  created_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);

alter table public.projects enable row level security;

grant select, insert, update, delete on public.projects to anon;

drop policy if exists "Public can read projects" on public.projects;
create policy "Public can read projects"
  on public.projects for select
  to anon
  using (true);

drop policy if exists "Public can add projects" on public.projects;
create policy "Public can add projects"
  on public.projects for insert
  to anon
  with check (true);

drop policy if exists "Public can update projects" on public.projects;
create policy "Public can update projects"
  on public.projects for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Public can delete projects" on public.projects;
create policy "Public can delete projects"
  on public.projects for delete
  to anon
  using (true);
