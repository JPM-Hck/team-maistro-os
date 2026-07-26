alter table public.inventory_items
  add column active boolean not null default true,
  add column updated_at timestamptz not null default now(),
  add column archived_at timestamptz;

alter table public.inventory_movements
  add column project_id uuid references public.projects(id),
  add column direction text not null default 'neutral'
    check (direction in ('in', 'out', 'neutral'));

alter table public.inventory_movements
  drop constraint inventory_movements_movement_type_check;

alter table public.inventory_movements
  add constraint inventory_movements_movement_type_check check (
    movement_type in ('receipt', 'reserve', 'release', 'consume', 'issue', 'adjustment')
  );

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

create index inventory_movements_project_date_idx
  on public.inventory_movements(project_id, created_at desc);

create or replace view public.project_inventory_usage
with (security_invoker = true)
as
select
  item.id as inventory_item_id,
  project.id as project_id,
  project.name as project_name,
  coalesce(reservations.reserved_quantity, 0)::numeric(14,3) as reserved_quantity,
  coalesce(consumption.consumed_quantity, 0)::numeric(14,3) as consumed_quantity
from public.inventory_items item
cross join public.projects project
left join (
  select
    reservation.inventory_item_id,
    task.project_id,
    sum(reservation.quantity) filter (where reservation.active) as reserved_quantity
  from public.inventory_reservations reservation
  join public.tasks task on task.id = reservation.task_id
  group by reservation.inventory_item_id, task.project_id
) reservations
  on reservations.inventory_item_id = item.id
 and reservations.project_id = project.id
left join (
  select
    movement.inventory_item_id,
    movement.project_id,
    sum(movement.quantity) as consumed_quantity
  from public.inventory_movements movement
  where movement.movement_type in ('consume', 'issue')
    and movement.direction = 'out'
    and movement.project_id is not null
  group by movement.inventory_item_id, movement.project_id
) consumption
  on consumption.inventory_item_id = item.id
 and consumption.project_id = project.id
where coalesce(reservations.reserved_quantity, 0) > 0
   or coalesce(consumption.consumed_quantity, 0) > 0;

create or replace function public.record_inventory_movement(
  p_inventory_item_id uuid,
  p_movement_type text,
  p_direction text,
  p_quantity numeric,
  p_reason text,
  p_project_id uuid default null,
  p_task_id uuid default null,
  p_requisition_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items%rowtype;
  v_next_stock numeric;
  v_result jsonb;
begin
  if public.current_app_role() not in ('administrator', 'warehouse') then
    raise exception 'No tienes permiso para modificar inventario.';
  end if;
  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'El motivo es obligatorio.';
  end if;
  if p_movement_type not in ('receipt', 'issue', 'consume', 'adjustment') then
    raise exception 'Tipo de movimiento no permitido.';
  end if;
  if p_direction not in ('in', 'out') then
    raise exception 'Dirección de movimiento no permitida.';
  end if;
  if p_movement_type in ('issue', 'consume') and p_project_id is null then
    raise exception 'Selecciona el proyecto que utilizará el material.';
  end if;

  if p_idempotency_key is not null then
    select response into v_result
    from public.idempotency_keys
    where key = p_idempotency_key;
    if found then return v_result; end if;
  end if;

  select * into v_item
  from public.inventory_items
  where id = p_inventory_item_id and active = true
  for update;
  if not found then raise exception 'Artículo inexistente o inactivo.'; end if;

  v_next_stock := v_item.physical_stock
    + case when p_direction = 'in' then p_quantity else -p_quantity end;
  if v_next_stock < v_item.reserved_stock + v_item.safety_stock then
    raise exception 'El movimiento compromete reservas o stock de seguridad.';
  end if;

  update public.inventory_items
  set physical_stock = v_next_stock
  where id = p_inventory_item_id;

  insert into public.inventory_movements (
    inventory_item_id, movement_type, direction, quantity, project_id,
    task_id, requisition_id, reason, created_by
  ) values (
    p_inventory_item_id, p_movement_type, p_direction, p_quantity, p_project_id,
    p_task_id, p_requisition_id, trim(p_reason), auth.uid()
  );

  v_result := jsonb_build_object(
    'inventory_item_id', p_inventory_item_id,
    'physical_stock', v_next_stock
  );
  if p_idempotency_key is not null then
    insert into public.idempotency_keys(key, operation, response)
    values (p_idempotency_key, 'record_inventory_movement', v_result);
  end if;

  insert into public.audit_log (
    actor_id, entity_type, entity_id, action, reason, before_data, after_data
  ) values (
    auth.uid(), 'inventory_item', p_inventory_item_id, p_movement_type, trim(p_reason),
    jsonb_build_object('physical_stock', v_item.physical_stock),
    jsonb_build_object('physical_stock', v_next_stock)
  );
  return v_result;
end;
$$;

create or replace function public.archive_inventory_item(
  p_inventory_item_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items%rowtype;
begin
  if public.current_app_role() not in ('administrator', 'warehouse') then
    raise exception 'No tienes permiso para archivar inventario.';
  end if;
  select * into v_item from public.inventory_items
  where id = p_inventory_item_id for update;
  if not found then raise exception 'Artículo inexistente.'; end if;
  if v_item.physical_stock <> 0 or v_item.reserved_stock <> 0 then
    raise exception 'Solo se puede archivar un artículo sin existencia ni reservas.';
  end if;
  update public.inventory_items
  set active = false, archived_at = now()
  where id = p_inventory_item_id;
  insert into public.audit_log (
    actor_id, entity_type, entity_id, action, reason, before_data, after_data
  ) values (
    auth.uid(), 'inventory_item', p_inventory_item_id, 'archive', trim(p_reason),
    to_jsonb(v_item), jsonb_build_object('active', false)
  );
end;
$$;

create policy "warehouse roles manage movements"
on public.inventory_movements for all to authenticated
using (public.current_app_role() in ('administrator', 'warehouse'))
with check (public.current_app_role() in ('administrator', 'warehouse'));

revoke all on function public.record_inventory_movement(
  uuid, text, text, numeric, text, uuid, uuid, uuid, text
) from public;
grant execute on function public.record_inventory_movement(
  uuid, text, text, numeric, text, uuid, uuid, uuid, text
) to authenticated;
revoke all on function public.archive_inventory_item(uuid, text) from public;
grant execute on function public.archive_inventory_item(uuid, text) to authenticated;

