import type { InventoryItem as OperationalInventoryItem } from "../operations";
import { CASA_LOMAS_PROJECT } from "../projects/types";

export const INVENTORY_STATUSES = ["active", "archived"] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export interface InventoryRecord extends OperationalInventoryItem {
  sku: string;
  description: string;
  projectId: string | null;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
}

export type InventoryInput = Omit<
  InventoryRecord,
  "id" | "createdAt" | "updatedAt"
>;
export type InventoryChanges = Partial<InventoryInput>;
export type InventoryField = keyof InventoryInput | "form";
export type InventoryValidationErrors = Partial<
  Record<InventoryField, string>
>;

export const INITIAL_INVENTORY_RECORDS: InventoryRecord[] = [
  {
    id: "marble",
    sku: "MAT-MAR-001",
    name: "Mármol crema marfil",
    description: "Placa de mármol para piso de planta baja.",
    unit: "m²",
    physicalStock: 18,
    reservedStock: 1,
    safetyStock: 0.5,
    projectId: CASA_LOMAS_PROJECT.id,
    status: "active",
    createdAt: "2026-07-25T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "adhesive",
    sku: "MAT-ADH-001",
    name: "Adhesivo para mármol",
    description: "Adhesivo especializado en presentación de bulto.",
    unit: "bulto",
    physicalStock: 9,
    reservedStock: 1,
    safetyStock: 2,
    projectId: CASA_LOMAS_PROJECT.id,
    status: "active",
    createdAt: "2026-07-25T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "grout",
    sku: "MAT-BOQ-001",
    name: "Boquilla",
    description: "Boquilla para sellado de juntas.",
    unit: "kg",
    physicalStock: 3,
    reservedStock: 0.5,
    safetyStock: 0.5,
    projectId: CASA_LOMAS_PROJECT.id,
    status: "active",
    createdAt: "2026-07-25T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
];

export function toInventoryInput(record: InventoryRecord): InventoryInput {
  return {
    sku: record.sku,
    name: record.name,
    description: record.description,
    unit: record.unit,
    physicalStock: record.physicalStock,
    reservedStock: record.reservedStock,
    safetyStock: record.safetyStock,
    projectId: record.projectId,
    status: record.status,
  };
}
