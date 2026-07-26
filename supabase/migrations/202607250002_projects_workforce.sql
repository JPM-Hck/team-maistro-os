create extension if not exists btree_gist;

create type public.rate_type as enum ('hourly', 'daily', 'weekly');

alter table public.projects
  add column updated_at timestamptz not null default now(),
  add column archived_at timestamptz;

alter table public.workers
  add column updated_at timestamptz not null default now(),
  add column archived_at timestamptz;

create table public.worker_rates (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id),
  rate_type public.rate_type not null,
  amount numeric(14,2) not null check (amount > 0),
  effective_from date not null,
  effective_to date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  exclude using gist (
    worker_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  )
);

create table public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id),
  project_id uuid not null references public.projects(id),
  role text not null,
  starts_on date not null,
  ends_on date not null,
  schedule text not null default '08:00-17:00',
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  exclude using gist (
    worker_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  ) where (active)
);

create index worker_rates_worker_date_idx
  on public.worker_rates(worker_id, effective_from desc);
create index project_assignments_project_active_idx
  on public.project_assignments(project_id, active);
create index project_assignments_worker_active_idx
  on public.project_assignments(worker_id, active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger workers_set_updated_at
before update on public.workers
for each row execute function public.set_updated_at();

create trigger project_assignments_set_updated_at
before update on public.project_assignments
for each row execute function public.set_updated_at();

create or replace function public.change_worker_rate(
  p_worker_id uuid,
  p_rate_type public.rate_type,
  p_amount numeric,
  p_effective_from date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate_id uuid;
begin
  if public.current_app_role() <> 'administrator' then
    raise exception 'Solo administración puede cambiar salarios.';
  end if;
  if p_amount <= 0 then raise exception 'La tarifa debe ser mayor que cero.'; end if;

  perform 1 from public.workers where id = p_worker_id and active = true for update;
  if not found then raise exception 'Trabajador inexistente o inactivo.'; end if;

  update public.worker_rates
  set effective_to = p_effective_from - 1
  where worker_id = p_worker_id
    and effective_from < p_effective_from
    and (effective_to is null or effective_to >= p_effective_from);

  insert into public.worker_rates (
    worker_id, rate_type, amount, effective_from, created_by
  ) values (
    p_worker_id, p_rate_type, p_amount, p_effective_from, auth.uid()
  )
  returning id into v_rate_id;

  insert into public.audit_log (
    actor_id, entity_type, entity_id, action, reason, after_data
  ) values (
    auth.uid(), 'worker', p_worker_id, 'rate_change', 'Nueva tarifa con vigencia',
    jsonb_build_object(
      'rate_id', v_rate_id, 'rate_type', p_rate_type,
      'amount', p_amount, 'effective_from', p_effective_from
    )
  );
  return v_rate_id;
end;
$$;

create or replace function public.archive_worker(p_worker_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.workers%rowtype;
begin
  if public.current_app_role() <> 'administrator' then
    raise exception 'Solo administración puede dar de baja trabajadores.';
  end if;
  select * into v_worker from public.workers where id = p_worker_id for update;
  if not found then raise exception 'Trabajador inexistente.'; end if;

  update public.project_assignments
  set active = false
  where worker_id = p_worker_id and active = true;
  update public.workers
  set active = false, archived_at = now()
  where id = p_worker_id;

  insert into public.audit_log (
    actor_id, entity_type, entity_id, action, reason, before_data, after_data
  ) values (
    auth.uid(), 'worker', p_worker_id, 'archive', trim(p_reason),
    to_jsonb(v_worker), jsonb_build_object('active', false)
  );
end;
$$;

create or replace function public.archive_project(p_project_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
begin
  if public.current_app_role() not in ('administrator', 'supervisor') then
    raise exception 'No tienes permiso para archivar proyectos.';
  end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Proyecto inexistente.'; end if;
  if exists (
    select 1 from public.tasks
    where project_id = p_project_id and status in ('ready', 'in_progress', 'in_review')
  ) then
    raise exception 'El proyecto tiene tareas activas; ciérralas o cancélalas primero.';
  end if;

  update public.projects
  set status = 'cancelled', archived_at = now()
  where id = p_project_id;

  insert into public.audit_log (
    actor_id, entity_type, entity_id, action, reason, before_data, after_data
  ) values (
    auth.uid(), 'project', p_project_id, 'archive', trim(p_reason),
    to_jsonb(v_project), jsonb_build_object('status', 'cancelled')
  );
end;
$$;

alter table public.worker_rates enable row level security;
alter table public.project_assignments enable row level security;

create policy "users read own profile"
on public.profiles for select to authenticated
using (id = auth.uid() or public.current_app_role() = 'administrator');

create policy "administrators manage workers"
on public.workers for all to authenticated
using (public.current_app_role() = 'administrator')
with check (public.current_app_role() = 'administrator');

create policy "administrators read rates"
on public.worker_rates for select to authenticated
using (public.current_app_role() = 'administrator');

create policy "administrators manage rates"
on public.worker_rates for all to authenticated
using (public.current_app_role() = 'administrator')
with check (public.current_app_role() = 'administrator');

create policy "authorized users read assignments"
on public.project_assignments for select to authenticated
using (public.current_app_role() in ('administrator', 'supervisor'));

create policy "authorized users manage assignments"
on public.project_assignments for all to authenticated
using (public.current_app_role() in ('administrator', 'supervisor'))
with check (public.current_app_role() in ('administrator', 'supervisor'));

revoke all on function public.change_worker_rate(uuid, public.rate_type, numeric, date) from public;
grant execute on function public.change_worker_rate(uuid, public.rate_type, numeric, date) to authenticated;
revoke all on function public.archive_worker(uuid, text) from public;
grant execute on function public.archive_worker(uuid, text) to authenticated;
revoke all on function public.archive_project(uuid, text) from public;
grant execute on function public.archive_project(uuid, text) to authenticated;
