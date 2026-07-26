import type { ProjectStatus } from "@/domain/projects/types";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Borrador",
  planned: "Planeado",
  in_progress: "En ejecución",
  paused: "Pausado",
  completed: "Terminado",
  archived: "Archivado",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`project-status project-status-${status}`}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}
