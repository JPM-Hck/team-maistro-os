import {
  PROJECT_STATUSES,
  type Project,
  type ProjectInput,
  type ProjectValidationErrors,
} from "./types";

export class ProjectValidationError extends Error {
  constructor(public readonly errors: ProjectValidationErrors) {
    super("El proyecto contiene datos inválidos.");
    this.name = "ProjectValidationError";
  }
}

export function normalizeProjectInput(input: ProjectInput): ProjectInput {
  return {
    ...input,
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    projectType: input.projectType.trim(),
    description: input.description.trim(),
    clientName: input.clientName.trim(),
    location: input.location.trim(),
    responsible: input.responsible.trim(),
    startDate: input.startDate.trim(),
    targetDate: input.targetDate.trim(),
    currentTask: input.currentTask?.trim() || undefined,
  };
}

export function validateProject(
  input: ProjectInput,
  projects: Project[] = [],
  currentProjectId?: string,
): ProjectValidationErrors {
  const normalized = normalizeProjectInput(input);
  const errors: ProjectValidationErrors = {};

  if (!normalized.name) errors.name = "El nombre es obligatorio.";
  if (!normalized.code) errors.code = "El código es obligatorio.";
  if (!normalized.responsible) {
    errors.responsible = "El responsable es obligatorio.";
  }
  if (!normalized.location) errors.location = "La ubicación es obligatoria.";
  if (!normalized.startDate) errors.startDate = "Selecciona la fecha inicial.";
  if (!normalized.targetDate) errors.targetDate = "Selecciona la fecha objetivo.";

  if (
    normalized.startDate &&
    normalized.targetDate &&
    normalized.targetDate < normalized.startDate
  ) {
    errors.targetDate =
      "La fecha objetivo no puede ser anterior a la fecha inicial.";
  }

  if (!Number.isFinite(normalized.budget) || normalized.budget < 0) {
    errors.budget = "El presupuesto no puede ser negativo.";
  }

  if (
    !Number.isFinite(normalized.progress) ||
    normalized.progress < 0 ||
    normalized.progress > 100
  ) {
    errors.progress = "El avance debe estar entre 0 y 100.";
  }

  if (!PROJECT_STATUSES.includes(normalized.status)) {
    errors.status = "Selecciona un estado válido.";
  }

  const duplicate = projects.some(
    (project) =>
      project.id !== currentProjectId &&
      project.code.trim().toUpperCase() === normalized.code,
  );
  if (normalized.code && duplicate) {
    errors.code = "Ya existe un proyecto con este código.";
  }

  return errors;
}

export function assertValidProject(
  input: ProjectInput,
  projects: Project[] = [],
  currentProjectId?: string,
) {
  const errors = validateProject(input, projects, currentProjectId);
  if (Object.keys(errors).length > 0) {
    throw new ProjectValidationError(errors);
  }
}
