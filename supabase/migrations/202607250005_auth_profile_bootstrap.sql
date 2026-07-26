create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role public.app_role;
begin
  perform pg_advisory_xact_lock(7642026);

  if exists (select 1 from public.profiles) then
    assigned_role := 'supervisor';
  else
    assigned_role := 'administrator';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    ),
    assigned_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- If the first Auth user already exists when this migration is applied,
-- bootstrap that account as the initial administrator.
insert into public.profiles (id, full_name, role)
select
  users.id,
  coalesce(
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Administrador'
  ),
  'administrator'::public.app_role
from auth.users as users
where not exists (select 1 from public.profiles)
order by users.created_at
limit 1
on conflict (id) do nothing;

create policy "users read own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

create policy "administrators manage profiles"
on public.profiles for all to authenticated
using (public.current_app_role() = 'administrator')
with check (public.current_app_role() = 'administrator');

revoke all on function public.handle_new_user() from public;
