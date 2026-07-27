import {
  SALARY_TYPES,
  type PayrollValidationErrors,
  type PayrollWorker,
  type PayrollWorkerInput,
} from "./types";

export function normalizePayrollWorkerInput(
  input: PayrollWorkerInput,
): PayrollWorkerInput {
  return {
    employeeCode: input.employeeCode.trim().toUpperCase(),
    name: input.name.trim(),
    position: input.position.trim(),
    projectId: input.projectId?.trim() || null,
    salaryType: input.salaryType,
    salaryAmount: Number(input.salaryAmount),
    scheduledDays: Number(input.scheduledDays),
    absenceDays: Number(input.absenceDays),
    notes: input.notes.trim(),
    status: input.status,
  };
}

export function validatePayrollWorker(
  input: PayrollWorkerInput,
  workers: PayrollWorker[] = [],
  currentId?: string,
): PayrollValidationErrors {
  const value = normalizePayrollWorkerInput(input);
  const errors: PayrollValidationErrors = {};

  if (!value.employeeCode) {
    errors.employeeCode = "El número de empleado es obligatorio.";
  }
  if (!value.name) errors.name = "El nombre es obligatorio.";
  if (!value.position) errors.position = "El puesto es obligatorio.";
  if (!SALARY_TYPES.includes(value.salaryType)) {
    errors.salaryType = "Selecciona un tipo de sueldo válido.";
  }
  if (!Number.isFinite(value.salaryAmount) || value.salaryAmount <= 0) {
    errors.salaryAmount = "El sueldo debe ser mayor que cero.";
  }
  if (
    !Number.isInteger(value.scheduledDays) ||
    value.scheduledDays < 1 ||
    value.scheduledDays > 7
  ) {
    errors.scheduledDays = "Los días programados deben estar entre 1 y 7.";
  }
  if (
    !Number.isInteger(value.absenceDays) ||
    value.absenceDays < 0 ||
    value.absenceDays > value.scheduledDays
  ) {
    errors.absenceDays =
      "Las faltas deben estar entre 0 y los días programados.";
  }
  if (
    value.employeeCode &&
    workers.some(
      (worker) =>
        worker.id !== currentId &&
        worker.employeeCode.trim().toUpperCase() === value.employeeCode,
    )
  ) {
    errors.employeeCode = "Este número de empleado ya está registrado.";
  }

  return errors;
}

export function assertValidPayrollWorker(
  input: PayrollWorkerInput,
  workers: PayrollWorker[] = [],
  currentId?: string,
) {
  const errors = validatePayrollWorker(input, workers, currentId);
  const message = Object.values(errors)[0];
  if (message) throw new Error(message);
}

export function isPayrollWorkerValid(errors: PayrollValidationErrors) {
  return Object.keys(errors).length === 0;
}
