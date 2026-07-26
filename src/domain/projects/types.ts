export const PROJECT_STATUSES = [
  "draft",
  "planned",
  "in_progress",
  "paused",
  "completed",
  "archived",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface Project {
  id: string;
  name: string;
  code: string;
  projectType: string;
  description: string;
  clientName: string;
  location: string;
  responsible: string;
  startDate: string;
  targetDate: string;
  budget: number;
  progress: number;
  status: ProjectStatus;
  currentTask?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectInput = Omit<Project, "id" | "createdAt" | "updatedAt">;
export type ProjectChanges = Partial<ProjectInput>;
export type ProjectField = keyof ProjectInput | "form";
export type ProjectValidationErrors = Partial<Record<ProjectField, string>>;

export const CASA_LOMAS_PROJECT: Project = {
  id: "project-casa-lomas",
  name: "Casa Lomas",
  code: "CL",
  projectType: "Remodelación integral",
  description: "Remodelación integral de residencia.",
  clientName: "Casa Lomas",
  location: "CDMX",
  responsible: "Alejandro S.",
  startDate: "2026-07-01",
  targetDate: "2026-09-18",
  budget: 2_500_000,
  progress: 38,
  status: "in_progress",
  currentTask: "Colocación de mármol",
  createdAt: "2026-07-25T12:00:00.000Z",
  updatedAt: "2026-07-25T12:00:00.000Z",
};

export function toProjectInput(project: Project): ProjectInput {
  return {
    name: project.name,
    code: project.code,
    projectType: project.projectType,
    description: project.description,
    clientName: project.clientName,
    location: project.location,
    responsible: project.responsible,
    startDate: project.startDate,
    targetDate: project.targetDate,
    budget: project.budget,
    progress: project.progress,
    status: project.status,
    currentTask: project.currentTask,
  };
}
