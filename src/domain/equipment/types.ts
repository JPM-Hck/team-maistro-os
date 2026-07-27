import type { ToolStatus } from "../operations";
import { CASA_LOMAS_PROJECT } from "../projects/types";

export type EquipmentStatus = ToolStatus | "archived";

export const EQUIPMENT_STATUSES: EquipmentStatus[] = [
  "available",
  "reserved",
  "assigned",
  "maintenance",
  "lost",
  "retired",
  "archived",
];

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  available: "Disponible",
  reserved: "Reservado",
  assigned: "Asignado",
  maintenance: "Mantenimiento",
  lost: "Extraviado",
  retired: "Retirado",
  archived: "Archivado",
};

export interface EquipmentRecord {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  serialNumber: string;
  location: string;
  responsible: string;
  status: EquipmentStatus;
  critical: boolean;
  projectId: string | null;
  acquiredDate: string;
  nextMaintenanceDate: string;
  createdAt: string;
  updatedAt: string;
}

export type EquipmentInput = Omit<
  EquipmentRecord,
  "id" | "createdAt" | "updatedAt"
>;
export type EquipmentChanges = Partial<EquipmentInput>;
export type EquipmentField = keyof EquipmentInput | "form";
export type EquipmentValidationErrors = Partial<
  Record<EquipmentField, string>
>;

export const INITIAL_EQUIPMENT_RECORDS: EquipmentRecord[] = [
  {
    id: "equipment-floor-cutter",
    code: "CT-014",
    name: "Cortadora de piso",
    category: "Corte",
    description: "Cortadora eléctrica para loseta, piedra y mármol.",
    serialNumber: "CT014-2024",
    location: "Almacén central",
    responsible: "Rubén",
    status: "available",
    critical: true,
    projectId: CASA_LOMAS_PROJECT.id,
    acquiredDate: "2024-03-12",
    nextMaintenanceDate: "2026-08-15",
    createdAt: "2026-07-25T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "equipment-laser-level",
    code: "NL-008",
    name: "Nivel láser",
    category: "Medición",
    description: "Nivel láser autonivelante para interiores.",
    serialNumber: "NL008-2025",
    location: "Almacén central",
    responsible: "Alejandro S.",
    status: "available",
    critical: true,
    projectId: CASA_LOMAS_PROJECT.id,
    acquiredDate: "2025-01-20",
    nextMaintenanceDate: "2026-10-01",
    createdAt: "2026-07-25T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "equipment-rotary-hammer",
    code: "RT-021",
    name: "Rotomartillo",
    category: "Perforación",
    description: "Rotomartillo industrial con estuche.",
    serialNumber: "RT021-2023",
    location: "Taller de mantenimiento",
    responsible: "",
    status: "maintenance",
    critical: false,
    projectId: null,
    acquiredDate: "2023-09-08",
    nextMaintenanceDate: "2026-07-30",
    createdAt: "2026-07-25T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
];

export function toEquipmentInput(record: EquipmentRecord): EquipmentInput {
  return {
    code: record.code,
    name: record.name,
    category: record.category,
    description: record.description,
    serialNumber: record.serialNumber,
    location: record.location,
    responsible: record.responsible,
    status: record.status,
    critical: record.critical,
    projectId: record.projectId,
    acquiredDate: record.acquiredDate,
    nextMaintenanceDate: record.nextMaintenanceDate,
  };
}
