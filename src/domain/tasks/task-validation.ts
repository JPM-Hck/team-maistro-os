import type {
  Employee,
  WorkspaceProject,
} from "../workspace/types";
import {
  TASK_STATUSES,
  type TaskInput,
  type TaskValidationErrors,
} from "./types";

export interface TaskValidationContext {
  projects: WorkspaceProject[];
  employees: Employee[];
  currentProjectId?: string | null;
  currentAssigneeIds?: string[];
}

export function normalizeTaskInput(input: TaskInput): TaskInput {
  return {
    ...input,
    name: input.name.trim(),
    description: input.description.trim(),
    projectId: input.projectId.trim(),
    progress: input.status === "completed" ? 100 : Number(input.progress),
    progressWeight: Number(input.progressWeight),
    quantity: Number(input.quantity),
    unit: input.unit.trim(),
    startDate: input.startDate.trim(),
    targetDate: input.targetDate.trim(),
    assigneeIds: [...new Set(input.assigneeIds.filter(Boolean))],
    equipmentItemIds: [
      ...new Set(input.equipmentItemIds.filter(Boolean)),
    ],
    recipeId: input.recipeId?.trim() || null,
  };
}

export function validateTask(
  input: TaskInput,
  context: TaskValidationContext,
): TaskValidationErrors {
  const value = normalizeTaskInput(input);
  const errors: TaskValidationErrors = {};
  const project = context.projects.find(
    (candidate) => candidate.id === value.projectId,
  );

  if (!value.name) errors.name = "El nombre es obligatorio.";
  if (!project) {
    errors.projectId = "Selecciona un proyecto válido.";
  } else if (
    project.status === "archived" &&
    project.id !== context.currentProjectId
  ) {
    errors.projectId = "Un proyecto archivado no admite nuevas tareas.";
  }

  if (value.assigneeIds.length === 0) {
    errors.assigneeIds = "Selecciona al menos una persona responsable.";
  } else {
    const historicalIds = new Set(context.currentAssigneeIds ?? []);
    const invalidEmployee = value.assigneeIds.find((employeeId) => {
      const employee = context.employees.find(
        (candidate) => candidate.id === employeeId,
      );
      return (
        !employee ||
        (employee.employmentStatus !== "active" &&
          !historicalIds.has(employeeId))
      );
    });
    if (invalidEmployee) {
      errors.assigneeIds =
        "Las personas archivadas no pueden recibir nuevas tareas.";
    }
  }

  if (
    !Number.isFinite(value.progress) ||
    value.progress < 0 ||
    value.progress > 100
  ) {
    errors.progress = "El avance debe estar entre 0 y 100.";
  }
  if (
    !Number.isFinite(value.progressWeight) ||
    value.progressWeight <= 0
  ) {
    errors.progressWeight = "El peso debe ser mayor que cero.";
  }
  if (!Number.isFinite(value.quantity) || value.quantity < 0) {
    errors.quantity = "La cantidad no puede ser negativa.";
  }
  if (!value.startDate) errors.startDate = "Selecciona la fecha inicial.";
  if (!value.targetDate) errors.targetDate = "Selecciona la fecha objetivo.";
  if (
    value.startDate &&
    value.targetDate &&
    value.targetDate < value.startDate
  ) {
    errors.targetDate =
      "La fecha objetivo no puede ser anterior a la fecha inicial.";
  }
  if (!TASK_STATUSES.includes(value.status)) {
    errors.status = "Selecciona un estado válido.";
  }

  return errors;
}

export function assertValidTask(
  input: TaskInput,
  context: TaskValidationContext,
) {
  const errors = validateTask(input, context);
  const message = Object.values(errors)[0];
  if (message) throw new Error(message);
}
