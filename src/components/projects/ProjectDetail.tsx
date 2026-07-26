import type { Project } from "@/domain/projects/types";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const date = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return date.format(new Date(`${value}T00:00:00Z`));
}

export function ProjectDetail({
  project,
  isActive,
  saving,
  onArchive,
  onEdit,
  onSetActive,
}: {
  project: Project;
  isActive: boolean;
  saving: boolean;
  onArchive: () => void;
  onEdit: () => void;
  onSetActive: () => void;
}) {
  return (
    <div className="project-detail">
      <div className="project-detail-hero">
        <span className="project-detail-code">{project.code}</span>
        <div>
          <p className="eyebrow">
            {project.projectType || "TIPO NO DEFINIDO"}
          </p>
          <h2>{project.name}</h2>
          <p>{project.location} · {project.responsible}</p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <div className="project-detail-progress">
        <div>
          <span>Avance físico</span>
          <b>{project.progress}%</b>
        </div>
        <div className="progress-track">
          <i style={{ width: `${project.progress}%` }} />
        </div>
      </div>
      <dl className="project-detail-grid">
        <div><dt>Cliente</dt><dd>{project.clientName || "Sin cliente"}</dd></div>
        <div><dt>Presupuesto</dt><dd>{currency.format(project.budget)}</dd></div>
        <div><dt>Fecha inicial</dt><dd>{formatDate(project.startDate)}</dd></div>
        <div><dt>Fecha objetivo</dt><dd>{formatDate(project.targetDate)}</dd></div>
        <div><dt>Tarea actual</dt><dd>{project.currentTask || "Sin tarea actual"}</dd></div>
        <div><dt>Última actualización</dt><dd>{new Date(project.updatedAt).toLocaleString("es-MX")}</dd></div>
      </dl>
      <div className="project-description">
        <span>DESCRIPCIÓN</span>
        <p>{project.description || "Sin descripción registrada."}</p>
      </div>
      <div className="planner-actions project-detail-actions">
        {!isActive && project.status !== "archived" && (
          <button
            className="secondary-button"
            disabled={saving}
            onClick={onSetActive}
            type="button"
          >
            Convertir en proyecto activo
          </button>
        )}
        {isActive && <span className="success-message">✓ Proyecto activo</span>}
        {project.status !== "archived" && (
          <>
            <button
              className="secondary-button"
              disabled={saving}
              onClick={onEdit}
              type="button"
            >
              Editar
            </button>
            <button
              className="danger-button"
              disabled={saving}
              onClick={onArchive}
              type="button"
            >
              Archivar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
