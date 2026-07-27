"use client";

import { useMemo, useState } from "react";
import type {
  Project,
  ProjectInput,
  ProjectStatus,
} from "@/domain/projects/types";
import type { Employee } from "@/domain/workspace/types";
import { ProjectArchiveDialog } from "./ProjectArchiveDialog";
import { ProjectCard } from "./ProjectCard";
import { ProjectDetail } from "./ProjectDetail";
import { ProjectForm } from "./ProjectForm";
import {
  PROJECT_STATUS_LABELS,
} from "./ProjectStatusBadge";
import type { ProjectsController } from "./useProjects";

type ProjectFilter = "all" | ProjectStatus;
type DialogState =
  | { kind: "create" }
  | { kind: "edit" | "detail" | "archive"; project: Project }
  | null;

const filters: ProjectFilter[] = [
  "all",
  "draft",
  "planned",
  "in_progress",
  "paused",
  "completed",
  "archived",
];

function filterLabel(filter: ProjectFilter) {
  return filter === "all" ? "Todos" : PROJECT_STATUS_LABELS[filter];
}

export function ProjectsView({
  controller,
  employees,
}: {
  controller: ProjectsController;
  employees: Employee[];
}) {
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
    return controller.projects.filter((project) => {
      const matchesStatus =
        filter === "all"
          ? project.status !== "archived"
          : project.status === filter;
      if (!matchesStatus) return false;
      if (!normalizedQuery) return true;
      return [
        project.name,
        project.code,
        project.clientName,
        project.responsible,
        project.location,
      ].some((value) =>
        value.toLocaleLowerCase("es-MX").includes(normalizedQuery),
      );
    });
  }, [controller.projects, filter, query]);

  async function saveProject(input: ProjectInput) {
    const saved =
      dialog?.kind === "edit"
        ? await controller.updateProject(dialog.project.id, input)
        : await controller.createProject(input);
    if (saved) setDialog(null);
    return saved;
  }

  if (controller.loading) {
    return (
      <section className="panel project-loading" aria-live="polite">
        <span className="project-spinner" />
        <h2>Cargando proyectos</h2>
        <p>Recuperando los datos guardados en este dispositivo.</p>
      </section>
    );
  }

  return (
    <>
      <section className="projects-workspace">
        <div className="projects-toolbar panel">
          <div>
            <p className="eyebrow">PORTAFOLIO DE OBRA</p>
            <h2>{controller.projects.length} proyectos registrados</h2>
          </div>
          <div className="project-search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Buscar proyectos"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nombre, código, cliente…"
              type="search"
              value={query}
            />
          </div>
          <button
            className="primary-button"
            onClick={() => {
              controller.clearNotice();
              setDialog({ kind: "create" });
            }}
            type="button"
          >
            + Nuevo proyecto
          </button>
        </div>

        <div className="project-filters" aria-label="Filtrar proyectos">
          {filters.map((item) => (
            <button
              aria-pressed={filter === item}
              className={filter === item ? "active" : ""}
              key={item}
              onClick={() => setFilter(item)}
              type="button"
            >
              {filterLabel(item)}
            </button>
          ))}
        </div>

        {controller.notice && (
          <div className="project-feedback success" aria-live="polite">
            <span>✓</span>
            <p>{controller.notice}</p>
            <button
              aria-label="Cerrar confirmación"
              onClick={controller.clearNotice}
              type="button"
            >
              ×
            </button>
          </div>
        )}
        {controller.error && (
          <div className="project-feedback error" role="alert">
            <span>!</span>
            <p>{controller.error}</p>
          </div>
        )}

        {visibleProjects.length > 0 ? (
          <div className="project-board">
            {visibleProjects.map((project) => (
              <ProjectCard
                isActive={controller.activeProject?.id === project.id}
                key={project.id}
                onArchive={() => setDialog({ kind: "archive", project })}
                onEdit={() => setDialog({ kind: "edit", project })}
                onOpen={() => setDialog({ kind: "detail", project })}
                project={project}
              />
            ))}
            {filter !== "archived" && (
              <button
                className="panel add-project-tile"
                onClick={() => setDialog({ kind: "create" })}
                type="button"
              >
                <span>+</span>
                <b>Nuevo proyecto</b>
                <small>Registra una nueva obra</small>
              </button>
            )}
          </div>
        ) : (
          <div className="panel projects-empty">
            <span>⌕</span>
            <h2>No encontramos proyectos</h2>
            <p>
              {query
                ? "Prueba con otra búsqueda o cambia el filtro."
                : filter === "archived"
                  ? "Todavía no hay proyectos archivados."
                  : "Crea el primer proyecto para comenzar."}
            </p>
            {filter !== "archived" && !query && (
              <button
                className="primary-button"
                onClick={() => setDialog({ kind: "create" })}
                type="button"
              >
                Crear proyecto
              </button>
            )}
          </div>
        )}
      </section>

      {dialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !controller.saving) {
              setDialog(null);
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="project-dialog-title"
            aria-modal="true"
            className="planner-modal project-modal"
            role="dialog"
          >
            <div className="planner-head">
              <div>
                <p className="eyebrow">PROYECTOS</p>
                <h2 id="project-dialog-title">
                  {dialog.kind === "create" && "Nuevo proyecto"}
                  {dialog.kind === "edit" && "Editar proyecto"}
                  {dialog.kind === "detail" && "Detalle del proyecto"}
                  {dialog.kind === "archive" && "Confirmar archivado"}
                </h2>
              </div>
              <button
                aria-label="Cerrar panel"
                className="close-button"
                disabled={controller.saving}
                onClick={() => setDialog(null)}
                type="button"
              >
                ×
              </button>
            </div>
            {dialog.kind === "create" && (
              <ProjectForm
                onCancel={() => setDialog(null)}
                onSave={saveProject}
                project={null}
                projects={controller.projects}
                employees={employees}
                saving={controller.saving}
              />
            )}
            {dialog.kind === "edit" && (
              <ProjectForm
                onCancel={() => setDialog(null)}
                onSave={saveProject}
                project={dialog.project}
                projects={controller.projects}
                employees={employees}
                saving={controller.saving}
              />
            )}
            {dialog.kind === "detail" && (
              <ProjectDetail
                isActive={controller.activeProject?.id === dialog.project.id}
                onArchive={() =>
                  setDialog({ kind: "archive", project: dialog.project })
                }
                onEdit={() =>
                  setDialog({ kind: "edit", project: dialog.project })
                }
                onSetActive={async () => {
                  if (await controller.setActiveProject(dialog.project.id)) {
                    setDialog(null);
                  }
                }}
                project={
                  controller.projects.find(
                    (project) => project.id === dialog.project.id,
                  ) ?? dialog.project
                }
                saving={controller.saving}
              />
            )}
            {dialog.kind === "archive" && (
              <ProjectArchiveDialog
                onCancel={() => setDialog(null)}
                onConfirm={async () => {
                  if (await controller.archiveProject(dialog.project.id)) {
                    setDialog(null);
                  }
                }}
                project={dialog.project}
                saving={controller.saving}
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
