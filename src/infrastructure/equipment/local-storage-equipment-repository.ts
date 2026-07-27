import {
  assertValidEquipment,
  normalizeEquipmentInput,
} from "../../domain/equipment/equipment-validation";
import {
  INITIAL_EQUIPMENT_RECORDS,
  type EquipmentChanges,
  type EquipmentInput,
  type EquipmentRecord,
  toEquipmentInput,
} from "../../domain/equipment/types";
import type { EquipmentRepository } from "./equipment-repository";

export const EQUIPMENT_STORAGE_KEY = "team-maistro-os.equipment.v1";
export type EquipmentStorage = Pick<Storage, "getItem" | "setItem"> & {
  subscribe?(listener: () => void): () => void;
};

export interface LocalEquipmentRepositoryOptions {
  storage?: EquipmentStorage;
  now?: () => Date;
  createId?: () => string;
}

export class LocalStorageEquipmentRepository
  implements EquipmentRepository
{
  private readonly injectedStorage?: EquipmentStorage;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: LocalEquipmentRepositoryOptions = {}) {
    this.injectedStorage = options.storage;
    this.now = options.now ?? (() => new Date());
    this.createId =
      options.createId ??
      (() =>
        globalThis.crypto?.randomUUID?.() ??
        `equipment-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

  async getAll(): Promise<EquipmentRecord[]> {
    const storage = this.storage();
    const raw = storage.getItem(EQUIPMENT_STORAGE_KEY);
    if (!raw) return this.seed(storage);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "No se pudo leer el equipo guardado. El almacenamiento está dañado.",
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error("El formato del equipo guardado no es válido.");
    }
    if (parsed.length === 0) return this.seed(storage);
    return (parsed as EquipmentRecord[]).map((record) => ({ ...record }));
  }

  async getById(id: string): Promise<EquipmentRecord | null> {
    return (await this.getAll()).find((record) => record.id === id) ?? null;
  }

  async create(input: EquipmentInput): Promise<EquipmentRecord> {
    const equipment = await this.getAll();
    const normalized = normalizeEquipmentInput(input);
    assertValidEquipment(normalized, equipment);
    const timestamp = this.now().toISOString();
    const created: EquipmentRecord = {
      ...normalized,
      id: this.createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.write([...equipment, created]);
    return { ...created };
  }

  async update(
    id: string,
    changes: EquipmentChanges,
  ): Promise<EquipmentRecord> {
    const equipment = await this.getAll();
    const index = equipment.findIndex((record) => record.id === id);
    if (index < 0) throw new Error("El equipo ya no existe.");

    const current = equipment[index];
    const normalized = normalizeEquipmentInput({
      ...toEquipmentInput(current),
      ...changes,
    });
    assertValidEquipment(normalized, equipment, id);
    const updated: EquipmentRecord = {
      ...current,
      ...normalized,
      updatedAt: this.now().toISOString(),
    };
    const next = [...equipment];
    next[index] = updated;
    this.write(next);
    return { ...updated };
  }

  async archive(id: string): Promise<EquipmentRecord> {
    const current = await this.getById(id);
    if (!current) throw new Error("El equipo ya no existe.");
    if (current.status === "reserved" || current.status === "assigned") {
      throw new Error(
        "No puedes archivar equipo reservado o asignado. Libéralo primero.",
      );
    }
    return this.update(id, { status: "archived" });
  }

  subscribe(listener: () => void) {
    return this.storage().subscribe?.(listener) ?? (() => undefined);
  }

  private storage(): EquipmentStorage {
    if (this.injectedStorage) return this.injectedStorage;
    if (typeof window !== "undefined") return window.localStorage;
    throw new Error("localStorage solo está disponible en el navegador.");
  }

  private seed(storage: EquipmentStorage): EquipmentRecord[] {
    const seeded = INITIAL_EQUIPMENT_RECORDS.map((record) => ({ ...record }));
    storage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  private write(equipment: EquipmentRecord[]) {
    this.storage().setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(equipment));
  }
}
