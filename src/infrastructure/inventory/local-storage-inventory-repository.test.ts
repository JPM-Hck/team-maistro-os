import { describe, expect, it } from "vitest";
import { CASA_LOMAS_PROJECT } from "../../domain/projects/types";
import {
  INITIAL_INVENTORY_RECORDS,
  type InventoryInput,
} from "../../domain/inventory/types";
import {
  INVENTORY_STORAGE_KEY,
  LocalStorageInventoryRepository,
  type InventoryStorage,
} from "./local-storage-inventory-repository";

class MemoryStorage implements InventoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const newItem: InventoryInput = {
  sku: "MAT-CEM-001",
  name: "Cemento gris",
  description: "Bulto de 50 kg",
  unit: "bulto",
  physicalStock: 12,
  reservedStock: 0,
  safetyStock: 2,
  projectId: null,
  status: "active",
};

function repository(storage = new MemoryStorage()) {
  return {
    storage,
    repository: new LocalStorageInventoryRepository({
      storage,
      now: () => new Date("2026-07-26T18:00:00.000Z"),
      createId: () => "inventory-created",
    }),
  };
}

describe("LocalStorageInventoryRepository", () => {
  it("loads the demo inventory and assigns it to Casa Lomas when storage is empty", async () => {
    const { repository: subject } = repository();
    const items = await subject.getAll();
    expect(items).toHaveLength(INITIAL_INVENTORY_RECORDS.length);
    expect(items.every((item) => item.projectId === CASA_LOMAS_PROJECT.id)).toBe(
      true,
    );
  });

  it("creates and recovers an unassigned item", async () => {
    const { repository: subject, storage } = repository();
    const created = await subject.create(newItem);
    expect(created.projectId).toBeNull();

    const recovered = new LocalStorageInventoryRepository({ storage });
    expect((await recovered.getById(created.id))?.name).toBe("Cemento gris");
  });

  it("updates an item and assigns it to a project", async () => {
    const { repository: subject } = repository();
    const created = await subject.create(newItem);
    const updated = await subject.update(created.id, {
      projectId: CASA_LOMAS_PROJECT.id,
      physicalStock: 18,
    });
    expect(updated.projectId).toBe(CASA_LOMAS_PROJECT.id);
    expect(updated.physicalStock).toBe(18);
  });

  it("archives an item without reservations", async () => {
    const { repository: subject } = repository();
    const created = await subject.create(newItem);
    expect((await subject.archive(created.id)).status).toBe("archived");
  });

  it("rejects archiving reserved inventory", async () => {
    const { repository: subject } = repository();
    await expect(subject.archive("marble")).rejects.toThrow("reservado");
  });

  it("keeps operational stock changes in persistent storage", async () => {
    const { repository: subject, storage } = repository();
    await subject.getAll();
    await subject.updateStockLevels([
      {
        id: "marble",
        name: "Mármol crema marfil",
        unit: "m²",
        physicalStock: 30,
        reservedStock: 4,
        safetyStock: 0.5,
      },
    ]);

    const persisted = JSON.parse(
      storage.getItem(INVENTORY_STORAGE_KEY) ?? "[]",
    );
    expect(persisted.find((item: { id: string }) => item.id === "marble")).toMatchObject({
      physicalStock: 30,
      reservedStock: 4,
    });
  });
});
