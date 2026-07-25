create extension if not exists pgcrypto;

create type public.app_role as enum ('administrator', 'supervisor', 'warehouse');
create type public.task_status as enum (
  'draft', 'planned', 'blocked', 'ready', 'in_progress', 'in_review', 'completed', 'cancelled'
);
create type public.requisition_status as enum (
  'draft', 'pending', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'supervisor',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text not null,
  public_address text,
  budget numeric(14,2) not null check (budget >= 0),
  starts_on date not null,
  target_end_on date not null,
  owner_id uuid references public.profiles(id),
  status text not null check (status in ('draft', 'active', 'paused', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (target_end_on >= starts_on)
);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  specialty text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  activity text not null,
  unit text not null,
  version integer not null check (version > 0),
  approved boolean not null default false,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  unique (activity, unit, version)
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  unit text not null,
  physical_stock numeric(14,3) not null default 0 check (physical_stock >= 0),
  reserved_stock numeric(14,3) not null default 0 check (reserved_stock >= 0),
  safety_stock numeric(14,3) not null default 0 check (safety_stock >= 0),
  average_cost numeric(14,2) not null default 0 check (average_cost >= 0),
  location text,
  created_at timestamptz not null default now(),
  check (reserved_stock <= physical_stock)
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  consumption_per_unit numeric(14,4) not null check (consumption_per_unit > 0),
  waste_rate numeric(8,5) not null default 0 check (waste_rate >= 0 and waste_rate <= 1),
  unique (recipe_id, inventory_item_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  recipe_id uuid references public.recipes(id),
  activity text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null,
  starts_on date not null,
  ends_on date not null,
  status public.task_status not null default 'draft',
  assigned_worker_id uuid references public.workers(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.task_dependencies (
  predecessor_id uuid not null references public.tasks(id) on delete cascade,
  successor_id uuid not null references public.tasks(id) on delete cascade,
  primary key (predecessor_id, successor_id),
  check (predecessor_id <> successor_id)
);

create table public.requisitions (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  project_id uuid not null references public.projects(id),
  task_id uuid not null references public.tasks(id),
  status public.requisition_status not null default 'pending',
  requested_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.requisition_items (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.requisitions(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  requested_quantity numeric(14,3) not null check (requested_quantity > 0),
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0),
  unique (requisition_id, inventory_item_id),
  check (received_quantity <= requested_quantity)
);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  quantity numeric(14,3) not null check (quantity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  unique (task_id, inventory_item_id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id),
  movement_type text not null check (
    movement_type in ('receipt', 'reserve', 'release', 'consume', 'adjustment')
  ),
  quantity numeric(14,3) not null check (quantity > 0),
  task_id uuid references public.tasks(id),
  requisition_id uuid references public.requisitions(id),
  reason text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.idempotency_keys (
  key text primary key,
  operation text not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index tasks_project_status_idx on public.tasks(project_id, status);
create index inventory_reservations_item_active_idx
  on public.inventory_reservations(inventory_item_id, active);
create index inventory_movements_item_date_idx
  on public.inventory_movements(inventory_item_id, created_at desc);
create index requisitions_project_status_idx on public.requisitions(project_id, status);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true
$$;

create or replace function public.reserve_task_materials(
  p_task_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks%rowtype;
  v_existing jsonb;
  v_shortage_count integer;
  v_requisition_id uuid;
  v_result jsonb;
begin
  select response into v_existing
  from public.idempotency_keys
  where key = p_idempotency_key and operation = 'reserve_task_materials';

  if found then
    return v_existing;
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  if v_task.quantity <= 0 then
    raise exception 'INVALID_TASK_QUANTITY';
  end if;

  if v_task.recipe_id is null or not exists (
    select 1 from public.recipes where id = v_task.recipe_id and approved = true
  ) then
    update public.tasks set status = 'blocked' where id = p_task_id;
    v_result := jsonb_build_object('status', 'blocked', 'reason', 'RECIPE_NOT_APPROVED');
  elsif exists (
    select 1
    from public.task_dependencies d
    join public.tasks predecessor on predecessor.id = d.predecessor_id
    where d.successor_id = p_task_id and predecessor.status <> 'completed'
  ) then
    update public.tasks set status = 'blocked' where id = p_task_id;
    v_result := jsonb_build_object('status', 'blocked', 'reason', 'PREDECESSOR_NOT_COMPLETE');
  else
    perform 1
    from public.inventory_items inventory
    join public.recipe_items recipe_item
      on recipe_item.inventory_item_id = inventory.id
    where recipe_item.recipe_id = v_task.recipe_id
    order by inventory.id
    for update of inventory;

    select count(*) into v_shortage_count
    from public.recipe_items recipe_item
    join public.inventory_items inventory
      on inventory.id = recipe_item.inventory_item_id
    where recipe_item.recipe_id = v_task.recipe_id
      and round(
        (v_task.quantity * recipe_item.consumption_per_unit * (1 + recipe_item.waste_rate))::numeric,
        3
      ) > greatest(inventory.physical_stock - inventory.reserved_stock - inventory.safety_stock, 0);

    if v_shortage_count > 0 then
      insert into public.requisitions (folio, project_id, task_id, status, requested_by)
      values (
        'RQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
        v_task.project_id,
        p_task_id,
        'pending',
        auth.uid()
      )
      returning id into v_requisition_id;

      insert into public.requisition_items (
        requisition_id, inventory_item_id, requested_quantity
      )
      select
        v_requisition_id,
        inventory.id,
        round(
          greatest(
            v_task.quantity * recipe_item.consumption_per_unit * (1 + recipe_item.waste_rate)
              - (inventory.physical_stock - inventory.reserved_stock - inventory.safety_stock),
            0
          )::numeric,
          3
        )
      from public.recipe_items recipe_item
      join public.inventory_items inventory
        on inventory.id = recipe_item.inventory_item_id
      where recipe_item.recipe_id = v_task.recipe_id
        and v_task.quantity * recipe_item.consumption_per_unit * (1 + recipe_item.waste_rate)
          > greatest(inventory.physical_stock - inventory.reserved_stock - inventory.safety_stock, 0);

      update public.tasks set status = 'blocked' where id = p_task_id;
      v_result := jsonb_build_object(
        'status', 'blocked',
        'reason', 'MATERIAL_SHORTAGE',
        'requisition_id', v_requisition_id
      );
    else
      insert into public.inventory_reservations (
        task_id, inventory_item_id, quantity
      )
      select
        p_task_id,
        recipe_item.inventory_item_id,
        round(
          (v_task.quantity * recipe_item.consumption_per_unit * (1 + recipe_item.waste_rate))::numeric,
          3
        )
      from public.recipe_items recipe_item
      where recipe_item.recipe_id = v_task.recipe_id
      on conflict (task_id, inventory_item_id) do nothing;

      update public.inventory_items inventory
      set reserved_stock = inventory.reserved_stock + requirement.quantity
      from (
        select
          recipe_item.inventory_item_id,
          round(
            (v_task.quantity * recipe_item.consumption_per_unit * (1 + recipe_item.waste_rate))::numeric,
            3
          ) as quantity
        from public.recipe_items recipe_item
        where recipe_item.recipe_id = v_task.recipe_id
      ) requirement
      where inventory.id = requirement.inventory_item_id;

      insert into public.inventory_movements (
        inventory_item_id, movement_type, quantity, task_id, reason, created_by
      )
      select
        recipe_item.inventory_item_id,
        'reserve',
        round(
          (v_task.quantity * recipe_item.consumption_per_unit * (1 + recipe_item.waste_rate))::numeric,
          3
        ),
        p_task_id,
        'Reserva automática al planear tarea',
        auth.uid()
      from public.recipe_items recipe_item
      where recipe_item.recipe_id = v_task.recipe_id;

      update public.tasks set status = 'ready' where id = p_task_id;
      v_result := jsonb_build_object('status', 'ready', 'reservation_created', true);
    end if;
  end if;

  insert into public.idempotency_keys (key, operation, response)
  values (p_idempotency_key, 'reserve_task_materials', v_result);

  insert into public.audit_log (
    actor_id, entity_type, entity_id, action, reason, after_data
  )
  values (
    auth.uid(), 'task', p_task_id, 'plan_resources',
    'Planeación y reserva transaccional', v_result
  );

  return v_result;
end;
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.workers enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.inventory_items enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.requisitions enable row level security;
alter table public.requisition_items enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_log enable row level security;

create policy "authenticated users read operational data"
on public.projects for select to authenticated using (public.current_app_role() is not null);
create policy "authenticated users read tasks"
on public.tasks for select to authenticated using (public.current_app_role() is not null);
create policy "authenticated users read inventory"
on public.inventory_items for select to authenticated using (public.current_app_role() is not null);
create policy "authenticated users read requisitions"
on public.requisitions for select to authenticated using (public.current_app_role() is not null);
create policy "authenticated users read workers"
on public.workers for select to authenticated using (public.current_app_role() is not null);
create policy "authenticated users read recipes"
on public.recipes for select to authenticated using (public.current_app_role() is not null);
create policy "authenticated users read recipe items"
on public.recipe_items for select to authenticated using (public.current_app_role() is not null);
create policy "authenticated users read dependencies"
on public.task_dependencies for select to authenticated using (public.current_app_role() is not null);
create policy "authenticated users read requisition items"
on public.requisition_items for select to authenticated using (public.current_app_role() is not null);
create policy "authenticated users read reservations"
on public.inventory_reservations for select to authenticated using (public.current_app_role() is not null);
create policy "authenticated users read movements"
on public.inventory_movements for select to authenticated using (public.current_app_role() is not null);
create policy "authorized roles manage projects"
on public.projects for all to authenticated
using (public.current_app_role() in ('administrator', 'supervisor'))
with check (public.current_app_role() in ('administrator', 'supervisor'));
create policy "authorized roles manage tasks"
on public.tasks for all to authenticated
using (public.current_app_role() in ('administrator', 'supervisor'))
with check (public.current_app_role() in ('administrator', 'supervisor'));
create policy "warehouse roles manage inventory"
on public.inventory_items for all to authenticated
using (public.current_app_role() in ('administrator', 'warehouse'))
with check (public.current_app_role() in ('administrator', 'warehouse'));
create policy "warehouse roles manage requisitions"
on public.requisitions for all to authenticated
using (public.current_app_role() in ('administrator', 'warehouse'))
with check (public.current_app_role() in ('administrator', 'warehouse'));
create policy "administrators read audit log"
on public.audit_log for select to authenticated
using (public.current_app_role() = 'administrator');

revoke all on function public.reserve_task_materials(uuid, text) from public;
grant execute on function public.reserve_task_materials(uuid, text) to authenticated;
