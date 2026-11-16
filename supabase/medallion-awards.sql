-- Apply after requests-and-accounts.sql. Awards are issued manually by administrators.
create table public.medallion_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(id) on delete cascade,
  kind text not null check (kind in ('attendance','streak','habit','season')),
  context text not null check (context=btrim(context) and char_length(context) between 1 and 100),
  citation text not null check (citation=btrim(citation) and char_length(citation) between 1 and 500),
  awarded_at timestamptz not null default now(),
  awarded_by uuid default auth.uid() references public.accounts(id) on delete set null
);
create unique index medallion_awards_recipient_kind_context on public.medallion_awards(user_id,kind,lower(context));
create index medallion_awards_awarded_by_idx on public.medallion_awards(awarded_by);
alter table public.medallion_awards enable row level security;
revoke all on public.medallion_awards from public,anon,authenticated;
grant select,delete on public.medallion_awards to authenticated;
grant insert(user_id,kind,context,citation) on public.medallion_awards to authenticated;
create policy medallion_awards_read on public.medallion_awards for select to authenticated
  using (user_id=(select auth.uid()) or (select public.is_admin()));
create policy medallion_awards_issue on public.medallion_awards for insert to authenticated
  with check ((select public.is_admin()) and awarded_by=(select auth.uid()));
create policy medallion_awards_revoke on public.medallion_awards for delete to authenticated
  using ((select public.is_admin()));
comment on table public.medallion_awards is 'Earned medallions. Scouts read their own; administrators issue and revoke. Award dates and issuers are server generated.';
