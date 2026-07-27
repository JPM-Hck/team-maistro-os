import {
  EQUIPMENT_STATUSES,
  type EquipmentInput,
  type EquipmentRecord,
  type EquipmentValidationErrors,
} from "./types";

export function normalizeEquipmentInput(
  input: EquipmentInput,
): EquipmentInput {
  return {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    category: input.category.trim(),
    description: input.description.trim(),
    serialNumber: input.serialNumber.trim().toUpperCase(),
    location: input.location.trim(),
    responsible: input.responsible.trim(),
    status: input.status,
    critical: Boolean(input.critical),
    projectId: input.projectId?.trim() || null,
    acquiredDate: input.acquiredDate,
    nextMaintenanceDate: input.nextMaintenanceDate,
  };
}

export function validateEquipment(
  input: EquipmentInput,
  equipment: EquipmentRecord[] = [],
  currentId?: string,
): EquipmentValidationErrors {
  const value = normalizeEquipmentInput(input);
  const errors: EquipmentValidationErrors = {};

  if (!value.code) errors.code = "El código es obligatorio.";
  if (!value.name) errors.name = "El nombre es obligatorio.";
  if (!value.category) errors.category = "La categoría es obligatoria.";
  if (!value.location) errors.location = "La ubicación es obligatoria.";
  if (!EQUIPMENT_STATUSES.includes(value.status)) {
    errors.status = "Selecciona un estado válido.";
  }
  if (
    (value.status === "reserved" || value.status === "assigned") &&
    !value.projectId
  ) {
    errors.projectId =
      "El equipo reservado o asignado debe indicar un proyecto.";
  }

  if (
    value.code &&
    equipment.some(
      (record) =>
        record.id !== currentId &&
        record.code.trim().toUpperCase() === value.code,
    )
  ) {
    errors.code = "Ya existe un equipo con este código.";
  }

  if (
    value.serialNumber &&
    equipment.some(
      (record) =>
        record.id !== currentId &&
        record.serialNumber.trim().toUpperCase() === value.serialNumber,
    )
  ) {
    errors.serialNumber = "Este número de serie ya está registrado.";
  }

  if (
    value.acquiredDate &&
    value.nextMaintenanceDate &&
    value.nextMaintenanceDate < value.acquiredDate
  ) {
    errors.nextMaintenanceDate =
      "El mantenimiento no puede ser anterior a la adquisición.";
  }

  return errors;
}

export function assertValidEquipment(
  input: EquipmentInput,
  equipment: EquipmentRecord[] = [],
  currentId?: string,
) {
  const errors = validateEquipment(input, equipment, currentId);
  const message = Object.values(errors)[0];
  if (message) throw new Error(message);
}

export function isEquipmentValid(errors: EquipmentValidationErrors) {
  return Object.keys(errors).length === 0;
}
