import type { WorkspaceTask } from "../workspace/types";

export function calculateProjectProgress(
  tasks: WorkspaceTask[],
  projectId: string,
) {
  const included = tasks.filter(
    (task) =>
      task.projectId === projectId &&
      !task.archived &&
      task.status !== "cancelled" &&
      Number.isFinite(task.progressWeight) &&
      task.progressWeight > 0,
  );
  const totalWeight = included.reduce(
    (total, task) => total + task.progressWeight,
    0,
  );
  if (totalWeight === 0) return 0;

  const weighted = included.reduce(
    (total, task) =>
      total +
      (task.status === "completed" ? 100 : task.progress) *
        task.progressWeight,
    0,
  );
  return Math.round((weighted / totalWeight) * 100) / 100;
}
