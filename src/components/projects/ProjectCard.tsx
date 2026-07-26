import type { Project } from "@/domain/projects/types";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const date = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return value ? date.format(new Date(`${value}T00:00:00Z`)) : "Sin fecha";
}

export function ProjectCard({
  project,
  isActive,
  onArchive,
  onEdit,
  onOpen,
}: {
  project: Project;
  isActive: boolean;
  onArchive: () => void;
  onEdit: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      className={`panel project-tile project-record ${project.status === "archived" ? "project-record-archived" : ""}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="project-tile-cover">
        <span>{project.code}</span>
        <ProjectStatusBadge status={project.status} />
      </div>
      <div className="project-tile-body">
        <div className="project-title-line">
          <div>
            <p className="eyebrow">
              {project.projectType || "TIPO NO DEFINIDO"}
            </p>
            <h2>{project.name}</h2>
          </div>
          {isActive && <b className="active-project-tag">ACTIVO</b>}
        </div>
        <p>
          {project.location} · {project.responsible}
        </p>
        <div className="project-progress">
          <div>
            <span>Avance físico</span>
            <b>{project.progress}%</b>
          </div>
          <div className="progress-track">
            <i style={{ width: `${project.progress}%` }} />
          </div>
        </div>
        <dl>
          <div>
            <dt>Cliente</dt>
            <dd>{project.clientName || "Sin cliente"}</dd>
          </div>
          <div>
            <dt>Tarea actual</dt>
            <dd>{project.currentTask || "Sin tarea actual"}</dd>
          </div>
          <div>
            <dt>Fecha objetivo</dt>
            <dd>{formatDate(project.targetDate)}</dd>
          </div>
          <div>
            <dt>Presupuesto</dt>
            <dd>{currency.format(project.budget)}</dd>
          </div>
        </dl>
        <div className="project-card-actions">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            type="button"
          >
            Ver
          </button>
          {project.status !== "archived" && (
            <>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                type="button"
              >
                Editar
              </button>
              <button
                className="danger-link"
                onClick={(event) => {
                  event.stopPropagation();
                  onArchive();
                }}
                type="button"
              >
                Archivar
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
