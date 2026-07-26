import {
  INVENTORY_STATUSES,
  type InventoryInput,
  type InventoryRecord,
  type InventoryValidationErrors,
} from "./types";

export function normalizeInventoryInput(input: InventoryInput): InventoryInput {
  return {
    sku: input.sku.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description.trim(),
    unit: input.unit.trim(),
    physicalStock: Number(input.physicalStock),
    reservedStock: Number(input.reservedStock),
    safetyStock: Number(input.safetyStock),
    projectId: input.projectId?.trim() || null,
    status: input.status,
  };
}

export function validateInventory(
  input: InventoryInput,
  inventory: InventoryRecord[] = [],
  currentId?: string,
): InventoryValidationErrors {
  const value = normalizeInventoryInput(input);
  const errors: InventoryValidationErrors = {};

  if (!value.name) errors.name = "El nombre del artículo es obligatorio.";
  if (!value.sku) errors.sku = "El SKU es obligatorio.";
  if (!value.unit) errors.unit = "La unidad es obligatoria.";

  if (
    value.sku &&
    inventory.some(
      (record) =>
        record.id !== currentId &&
        record.sku.trim().toUpperCase() === value.sku,
    )
  ) {
    errors.sku = "Ya existe un artículo con este SKU.";
  }

  for (const field of [
    "physicalStock",
    "reservedStock",
    "safetyStock",
  ] as const) {
    if (!Number.isFinite(value[field]) || value[field] < 0) {
      errors[field] = "La cantidad debe ser igual o mayor que cero.";
    }
  }

  if (
    Number.isFinite(value.reservedStock) &&
    Number.isFinite(value.physicalStock) &&
    value.reservedStock > value.physicalStock
  ) {
    errors.reservedStock =
      "La reserva no puede superar la existencia física.";
  }

  if (!INVENTORY_STATUSES.includes(value.status)) {
    errors.status = "Selecciona un estado válido.";
  }

  return errors;
}

export function assertValidInventory(
  input: InventoryInput,
  inventory: InventoryRecord[] = [],
  currentId?: string,
) {
  const errors = validateInventory(input, inventory, currentId);
  const message = Object.values(errors)[0];
  if (message) throw new Error(message);
}

export function isInventoryValid(errors: InventoryValidationErrors) {
  return Object.keys(errors).length === 0;
}
