grant select on table public.stories to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'stories'
      and policyname = 'Public can read stories'
  ) then
    create policy "Public can read stories"
      on public.stories
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;
