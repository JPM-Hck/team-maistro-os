create type public.attendance_status as enum ('present', 'partial', 'absent', 'leave', 'rest');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.payroll_status as enum ('open', 'in_review', 'approved', 'closed');

create table public.payroll_settings (
  id boolean primary key default true check (id),
  standard_hours_per_day numeric(4,2) not null default 8 check (standard_hours_per_day > 0),
  workdays_per_week integer not null default 6 check (workdays_per_week between 1 and 7),
  tolerance_minutes integer not null default 15 check (tolerance_minutes >= 0),
  overtime_multiplier numeric(4,2) not null default 2 check (overtime_multiplier >= 1),
  unusually_high_multiplier numeric(4,2) not null default 2 check (unusually_high_multiplier >= 1),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.payroll_settings(id) values (true);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id),
  project_id uuid not null references public.projects(id),
  work_date date not null,
  check_in time,
  check_out time,
  status public.attendance_status not null,
  approval_status public.approval_status not null default 'pending',
  notes text not null default '',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (worker_id, work_date),
  check (check_out is null or check_in is null or check_out > check_in)
);

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  status public.payroll_status not null default 'open',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (week_end = week_start + 6)
);

create table public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  worker_id uuid not null references public.workers(id),
  rate_type public.rate_type not null,
  base_amount numeric(14,2) not null default 0,
  overtime_amount numeric(14,2) not null default 0,
  bonuses numeric(14,2) not null default 0,
  absence_deductions numeric(14,2) not null default 0,
  tardiness_deductions numeric(14,2) not null default 0,
  other_adjustments numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null check (net_amount >= 0),
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, worker_id)
);

create table public.payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id),
  worker_id uuid not null references public.workers(id),
  source_period_id uuid references public.payroll_periods(id),
  amount numeric(14,2) not null check (amount <> 0),
  reason text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index attendance_worker_date_idx on public.attendance_records(worker_id, work_date);
create index attendance_project_date_idx on public.attendance_records(project_id, work_date);
create index payroll_entries_period_idx on public.payroll_entries(payroll_period_id);

create trigger attendance_set_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();
create trigger payroll_periods_set_updated_at
before update on public.payroll_periods
for each row execute function public.set_updated_at();
create trigger payroll_entries_set_updated_at
before update on public.payroll_entries
for each row execute function public.set_updated_at();
create trigger payroll_settings_set_updated_at
before update on public.payroll_settings
for each row execute function public.set_updated_at();

alter table public.payroll_settings enable row level security;
alter table public.attendance_records enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_entries enable row level security;
alter table public.payroll_adjustments enable row level security;

create policy "authorized users read attendance"
on public.attendance_records for select to authenticated
using (public.current_app_role() in ('administrator', 'supervisor'));
create policy "authorized users manage attendance"
on public.attendance_records for all to authenticated
using (public.current_app_role() in ('administrator', 'supervisor'))
with check (public.current_app_role() in ('administrator', 'supervisor'));

create policy "administrators manage payroll settings"
on public.payroll_settings for all to authenticated
using (public.current_app_role() = 'administrator')
with check (public.current_app_role() = 'administrator');
create policy "administrators manage payroll periods"
on public.payroll_periods for all to authenticated
using (public.current_app_role() = 'administrator')
with check (public.current_app_role() = 'administrator');
create policy "administrators manage payroll entries"
on public.payroll_entries for all to authenticated
using (public.current_app_role() = 'administrator')
with check (public.current_app_role() = 'administrator');
create policy "administrators manage payroll adjustments"
on public.payroll_adjustments for all to authenticated
using (public.current_app_role() = 'administrator')
with check (public.current_app_role() = 'administrator');

create or replace function public.save_payroll_draft(
  p_payroll_period_id uuid,
  p_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.payroll_periods%rowtype;
begin
  if public.current_app_role() <> 'administrator' then
    raise exception 'Solo administración puede calcular nómina.';
  end if;
  select * into v_period from public.payroll_periods
  where id = p_payroll_period_id for update;
  if not found then raise exception 'Periodo inexistente.'; end if;
  if v_period.status = 'closed' then raise exception 'Una nómina cerrada no se edita.'; end if;
  if exists (
    select 1 from public.attendance_records attendance
    where attendance.work_date between v_period.week_start and v_period.week_end
      and attendance.approval_status <> 'approved'
  ) then
    raise exception 'Hay asistencias pendientes de aprobación.';
  end if;

  delete from public.payroll_entries where payroll_period_id = p_payroll_period_id;
  insert into public.payroll_entries (
    payroll_period_id, worker_id, rate_type, base_amount, overtime_amount,
    bonuses, absence_deductions, tardiness_deductions, other_adjustments,
    net_amount, breakdown
  )
  select
    p_payroll_period_id,
    (entry->>'workerId')::uuid,
    (entry->>'rateType')::public.rate_type,
    (entry->>'baseAmount')::numeric,
    (entry->>'overtimeAmount')::numeric,
    (entry->>'bonuses')::numeric,
    (entry->>'absenceDeductions')::numeric,
    (entry->>'tardinessDeductions')::numeric,
    (entry->>'otherAdjustments')::numeric,
    (entry->>'netAmount')::numeric,
    coalesce(entry->'breakdown', '{}'::jsonb)
  from jsonb_array_elements(p_entries) entry;

  update public.payroll_periods
  set status = 'in_review'
  where id = p_payroll_period_id;
end;
$$;

create or replace function public.set_payroll_status(
  p_payroll_period_id uuid,
  p_status public.payroll_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.payroll_periods%rowtype;
begin
  if public.current_app_role() <> 'administrator' then
    raise exception 'Solo administración puede aprobar o cerrar nómina.';
  end if;
  select * into v_period from public.payroll_periods
  where id = p_payroll_period_id for update;
  if not found then raise exception 'Periodo inexistente.'; end if;
  if v_period.status = 'closed' then raise exception 'Una nómina cerrada es inmutable.'; end if;
  if not (
    (v_period.status = 'open' and p_status = 'in_review')
    or (v_period.status = 'in_review' and p_status in ('open', 'approved'))
    or (v_period.status = 'approved' and p_status = 'closed')
  ) then
    raise exception 'Transición de nómina no permitida.';
  end if;

  update public.payroll_periods
  set
    status = p_status,
    approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
    approved_at = case when p_status = 'approved' then now() else approved_at end,
    closed_by = case when p_status = 'closed' then auth.uid() else closed_by end,
    closed_at = case when p_status = 'closed' then now() else closed_at end
  where id = p_payroll_period_id;

  insert into public.audit_log (
    actor_id, entity_type, entity_id, action, before_data, after_data
  ) values (
    auth.uid(), 'payroll_period', p_payroll_period_id, 'status_change',
    jsonb_build_object('status', v_period.status),
    jsonb_build_object('status', p_status)
  );
end;
$$;

revoke all on function public.save_payroll_draft(uuid, jsonb) from public;
grant execute on function public.save_payroll_draft(uuid, jsonb) to authenticated;
revoke all on function public.set_payroll_status(uuid, public.payroll_status) from public;
grant execute on function public.set_payroll_status(uuid, public.payroll_status) to authenticated;

