import type { Project } from "@/domain/projects/types";

export function ProjectArchiveDialog({
  project,
  saving,
  onCancel,
  onConfirm,
}: {
  project: Project;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="archive-confirmation">
      <span className="archive-warning">!</span>
      <h2>Archivar {project.name}</h2>
      <p>
        El proyecto desaparecerá de la vista activa, pero conservará toda su
        información y podrás consultarlo con el filtro “Archivados”.
      </p>
      <div className="planner-actions">
        <button
          className="secondary-button"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="danger-button"
          disabled={saving}
          onClick={onConfirm}
          type="button"
        >
          {saving ? "Archivando…" : "Sí, archivar proyecto"}
        </button>
      </div>
    </div>
  );
}
