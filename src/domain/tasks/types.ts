import type { TaskStatus } from "../operations";
import type { WorkspaceTask } from "../workspace/types";

export const TASK_STATUSES: TaskStatus[] = [
  "draft",
  "planned",
  "blocked",
  "ready",
  "in_progress",
  "in_review",
  "completed",
  "cancelled",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: "Borrador",
  planned: "Planeada",
  blocked: "Bloqueada",
  ready: "Lista",
  in_progress: "En proceso",
  in_review: "En revisión",
  completed: "Terminada",
  cancelled: "Cancelada",
};

export type TaskRecord = WorkspaceTask;
export type TaskInput = Omit<
  TaskRecord,
  "id" | "archived" | "needsReview" | "createdAt" | "updatedAt"
>;
export type TaskChanges = Partial<TaskInput>;
export type TaskField = keyof TaskInput | "form";
export type TaskValidationErrors = Partial<Record<TaskField, string>>;

export function toTaskInput(task: TaskRecord): TaskInput {
  return {
    projectId: task.projectId,
    name: task.name,
    description: task.description,
    status: task.status,
    progress: task.progress,
    progressWeight: task.progressWeight,
    quantity: task.quantity,
    unit: task.unit,
    startDate: task.startDate,
    targetDate: task.targetDate,
    assigneeIds: [...task.assigneeIds],
    recipeId: task.recipeId,
    equipmentItemIds: [...task.equipmentItemIds],
  };
}
