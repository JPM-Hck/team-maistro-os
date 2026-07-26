import type { InventoryCatalogItem } from "./entities";
import { round2 } from "./operations";

export type InventoryMovementKind = "receipt" | "issue" | "consume" | "adjustment";

export interface InventoryAdjustmentInput {
  item: InventoryCatalogItem;
  kind: InventoryMovementKind;
  quantity: number;
  projectId?: string | null;
  reason: string;
}

export function applyInventoryAdjustment(input: InventoryAdjustmentInput) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("La cantidad debe ser mayor que cero.");
  }
  if (!input.reason.trim()) throw new Error("El motivo es obligatorio.");
  if ((input.kind === "issue" || input.kind === "consume") && !input.projectId) {
    throw new Error("Selecciona el proyecto que utilizará el material.");
  }

  const outgoing = input.kind === "issue" || input.kind === "consume";
  const nextPhysical = round2(
    input.item.physicalStock + (outgoing ? -input.quantity : input.quantity),
  );
  if (nextPhysical < input.item.reservedStock + input.item.safetyStock) {
    throw new Error("El movimiento compromete reservas o stock de seguridad.");
  }

  return { ...input.item, physicalStock: nextPhysical };
}

export function canArchiveInventoryItem(item: InventoryCatalogItem) {
  return item.physicalStock === 0 && item.reservedStock === 0;
}
