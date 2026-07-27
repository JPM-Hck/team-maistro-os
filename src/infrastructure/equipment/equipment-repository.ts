import type {
  EquipmentChanges,
  EquipmentInput,
  EquipmentRecord,
} from "../../domain/equipment/types";

export interface EquipmentRepository {
  getAll(): Promise<EquipmentRecord[]>;
  getById(id: string): Promise<EquipmentRecord | null>;
  create(input: EquipmentInput): Promise<EquipmentRecord>;
  update(id: string, changes: EquipmentChanges): Promise<EquipmentRecord>;
  archive(id: string): Promise<EquipmentRecord>;
  subscribe?(listener: () => void): () => void;
}
