import type {
  InventoryChanges,
  InventoryInput,
  InventoryRecord,
} from "../../domain/inventory/types";
import type { InventoryItem } from "../../domain/operations";

export interface InventoryRepository {
  getAll(): Promise<InventoryRecord[]>;
  getById(id: string): Promise<InventoryRecord | null>;
  create(input: InventoryInput): Promise<InventoryRecord>;
  update(id: string, changes: InventoryChanges): Promise<InventoryRecord>;
  archive(id: string): Promise<InventoryRecord>;
  updateStockLevels(items: InventoryItem[]): Promise<void>;
  resetDemoStock(items: InventoryItem[]): Promise<void>;
}
