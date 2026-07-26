import {
  assertValidInventory,
  normalizeInventoryInput,
} from "../../domain/inventory/inventory-validation";
import {
  INITIAL_INVENTORY_RECORDS,
  type InventoryChanges,
  type InventoryInput,
  type InventoryRecord,
  toInventoryInput,
} from "../../domain/inventory/types";
import type { InventoryItem } from "../../domain/operations";
import type { InventoryRepository } from "./inventory-repository";

export const INVENTORY_STORAGE_KEY = "team-maistro-os.inventory.v1";

export type InventoryStorage = Pick<Storage, "getItem" | "setItem">;

export interface LocalInventoryRepositoryOptions {
  storage?: InventoryStorage;
  now?: () => Date;
  createId?: () => string;
}

export class LocalStorageInventoryRepository
  implements InventoryRepository
{
  private readonly injectedStorage?: InventoryStorage;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: LocalInventoryRepositoryOptions = {}) {
    this.injectedStorage = options.storage;
    this.now = options.now ?? (() => new Date());
    this.createId =
      options.createId ??
      (() =>
        globalThis.crypto?.randomUUID?.() ??
        `inventory-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

  async getAll(): Promise<InventoryRecord[]> {
    const storage = this.storage();
    const raw = storage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return this.seed(storage);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "No se pudo leer el inventario guardado. El almacenamiento está dañado.",
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error("El formato del inventario guardado no es válido.");
    }

    if (parsed.length === 0) return this.seed(storage);
    return (parsed as InventoryRecord[]).map((record) => ({ ...record }));
  }

  async getById(id: string): Promise<InventoryRecord | null> {
    return (await this.getAll()).find((record) => record.id === id) ?? null;
  }

  async create(input: InventoryInput): Promise<InventoryRecord> {
    const inventory = await this.getAll();
    const normalized = normalizeInventoryInput(input);
    assertValidInventory(normalized, inventory);
    const timestamp = this.now().toISOString();
    const created: InventoryRecord = {
      ...normalized,
      id: this.createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.write([...inventory, created]);
    return { ...created };
  }

  async update(
    id: string,
    changes: InventoryChanges,
  ): Promise<InventoryRecord> {
    const inventory = await this.getAll();
    const index = inventory.findIndex((record) => record.id === id);
    if (index < 0) throw new Error("El artículo ya no existe.");

    const current = inventory[index];
    const normalized = normalizeInventoryInput({
      ...toInventoryInput(current),
      ...changes,
    });
    assertValidInventory(normalized, inventory, id);

    const updated: InventoryRecord = {
      ...current,
      ...normalized,
      updatedAt: this.now().toISOString(),
    };
    const next = [...inventory];
    next[index] = updated;
    this.write(next);
    return { ...updated };
  }

  async archive(id: string): Promise<InventoryRecord> {
    const current = await this.getById(id);
    if (!current) throw new Error("El artículo ya no existe.");
    if (current.reservedStock > 0) {
      throw new Error(
        "No puedes archivar un artículo con material reservado.",
      );
    }
    return this.update(id, { status: "archived" });
  }

  async updateStockLevels(items: InventoryItem[]): Promise<void> {
    const inventory = await this.getAll();
    const byId = new Map(items.map((item) => [item.id, item]));
    const timestamp = this.now().toISOString();
    this.write(
      inventory.map((record) => {
        const stock = byId.get(record.id);
        if (!stock) return record;
        return {
          ...record,
          physicalStock: stock.physicalStock,
          reservedStock: stock.reservedStock,
          safetyStock: stock.safetyStock,
          updatedAt: timestamp,
        };
      }),
    );
  }

  async resetDemoStock(items: InventoryItem[]): Promise<void> {
    await this.updateStockLevels(items);
  }

  private storage(): InventoryStorage {
    if (this.injectedStorage) return this.injectedStorage;
    if (typeof window !== "undefined") return window.localStorage;
    throw new Error("localStorage solo está disponible en el navegador.");
  }

  private seed(storage: InventoryStorage): InventoryRecord[] {
    const seeded = INITIAL_INVENTORY_RECORDS.map((record) => ({ ...record }));
    storage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  private write(inventory: InventoryRecord[]) {
    this.storage().setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
  }
}
