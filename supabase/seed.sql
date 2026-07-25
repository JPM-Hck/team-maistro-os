insert into public.projects (
  id, name, client_name, public_address, budget, starts_on, target_end_on, status
) values (
  '10000000-0000-0000-0000-000000000001',
  'Casa Lomas',
  'Cliente demostración',
  'Lomas de Chapultepec, CDMX',
  2500000,
  '2026-07-01',
  '2026-09-18',
  'active'
);

insert into public.workers (id, full_name, specialty) values
  ('20000000-0000-0000-0000-000000000001', 'Rubén Hernández', 'Colocador de mármol');

insert into public.inventory_items (
  id, sku, name, unit, physical_stock, reserved_stock, safety_stock, average_cost, location
) values
  ('30000000-0000-0000-0000-000000000001', 'MAR-CRE-001', 'Mármol crema marfil', 'm²', 18, 1, 0.5, 820, 'Almacén A'),
  ('30000000-0000-0000-0000-000000000002', 'ADH-MAR-020', 'Adhesivo para mármol', 'bulto', 9, 1, 2, 410, 'Almacén A'),
  ('30000000-0000-0000-0000-000000000003', 'BOQ-BEI-001', 'Boquilla', 'kg', 3, 0.5, 0.5, 95, 'Almacén A');

insert into public.recipes (id, activity, unit, version, approved) values
  ('40000000-0000-0000-0000-000000000001', 'Colocación de mármol', 'm²', 2, true);

insert into public.recipe_items (
  recipe_id, inventory_item_id, consumption_per_unit, waste_rate
) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 0.08),
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 0.25, 0),
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 0.04, 0);

insert into public.tasks (
  id, project_id, recipe_id, activity, quantity, unit, starts_on, ends_on, assigned_worker_id
) values (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'Colocación de mármol',
  20,
  'm²',
  '2026-07-28',
  '2026-07-30',
  '20000000-0000-0000-0000-000000000001'
);
