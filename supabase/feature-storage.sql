-- Personal work stays private. Program edits and troop achievements are member-only.
create table public.scout_documents (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  key text not null check (key in ('badges','attendance','map','handbook')),
  data jsonb not null check (octet_length(data::text) <= 2000000),
  updated_at timestamptz not null default now(),
  primary key(user_id,key)
);
create table public.program_content (
  key text primary key check (key = 'program'),
  data jsonb not null check (octet_length(data::text) <= 12000000),
  updated_at timestamptz not null default now()
);
alter table public.scout_documents enable row level security;
alter table public.program_content enable row level security;
revoke all on public.scout_documents, public.program_content from anon, authenticated;
grant select, insert, update, delete on public.scout_documents to authenticated;
grant select, insert, update on public.program_content to authenticated;
create policy documents_read on public.scout_documents for select to authenticated using (user_id=(select auth.uid()));
create policy documents_insert on public.scout_documents for insert to authenticated with check (user_id=(select auth.uid()));
create policy documents_update on public.scout_documents for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy documents_delete on public.scout_documents for delete to authenticated using (user_id=(select auth.uid()));
create policy program_read on public.program_content for select to authenticated using (true);
create policy program_insert on public.program_content for insert to authenticated with check ((select public.is_admin()));
create policy program_update on public.program_content for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
