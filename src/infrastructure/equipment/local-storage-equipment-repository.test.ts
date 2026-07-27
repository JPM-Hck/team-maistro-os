import { describe, expect, it } from "vitest";
import {
  INITIAL_EQUIPMENT_RECORDS,
  type EquipmentInput,
} from "../../domain/equipment/types";
import { CASA_LOMAS_PROJECT } from "../../domain/projects/types";
import {
  LocalStorageEquipmentRepository,
  type EquipmentStorage,
} from "./local-storage-equipment-repository";

class MemoryStorage implements EquipmentStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const newEquipment: EquipmentInput = {
  code: "TL-100",
  name: "Taladro inalámbrico",
  category: "Perforación",
  description: "Equipo de prueba",
  serialNumber: "SERIE-100",
  location: "Almacén central",
  responsible: "",
  status: "available",
  critical: false,
  projectId: null,
  acquiredDate: "2026-01-01",
  nextMaintenanceDate: "2026-08-01",
};

function repository(storage = new MemoryStorage()) {
  return {
    storage,
    repository: new LocalStorageEquipmentRepository({
      storage,
      now: () => new Date("2026-07-26T20:00:00.000Z"),
      createId: () => "equipment-created",
    }),
  };
}

describe("LocalStorageEquipmentRepository", () => {
  it("loads the initial equipment when storage is empty", async () => {
    const { repository: subject } = repository();
    const items = await subject.getAll();
    expect(items).toHaveLength(INITIAL_EQUIPMENT_RECORDS.length);
    expect(items.find((item) => item.code === "CT-014")?.critical).toBe(true);
  });

  it("creates and recovers unassigned equipment", async () => {
    const { repository: subject, storage } = repository();
    const created = await subject.create(newEquipment);
    expect(created.projectId).toBeNull();

    const recovered = new LocalStorageEquipmentRepository({ storage });
    expect((await recovered.getById(created.id))?.name).toBe(
      "Taladro inalámbrico",
    );
  });

  it("updates status and project assignment", async () => {
    const { repository: subject } = repository();
    const created = await subject.create(newEquipment);
    const updated = await subject.update(created.id, {
      status: "assigned",
      projectId: CASA_LOMAS_PROJECT.id,
      responsible: "Rubén",
    });
    expect(updated.status).toBe("assigned");
    expect(updated.projectId).toBe(CASA_LOMAS_PROJECT.id);
  });

  it("archives available equipment", async () => {
    const { repository: subject } = repository();
    const created = await subject.create(newEquipment);
    expect((await subject.archive(created.id)).status).toBe("archived");
  });

  it("rejects archiving assigned equipment", async () => {
    const { repository: subject } = repository();
    const created = await subject.create({
      ...newEquipment,
      status: "assigned",
      projectId: CASA_LOMAS_PROJECT.id,
    });
    await expect(subject.archive(created.id)).rejects.toThrow("asignado");
  });
});
