"use client";

import { useMemo, useState } from "react";
import {
  EQUIPMENT_STATUS_LABELS,
  type EquipmentRecord,
  type EquipmentStatus,
} from "@/domain/equipment/types";
import type { Project } from "@/domain/projects/types";
import { EquipmentArchiveDialog } from "./EquipmentArchiveDialog";
import { EquipmentForm } from "./EquipmentForm";
import { EquipmentStatusBadge } from "./EquipmentStatusBadge";
import type { EquipmentController } from "./useEquipment";

type Dialog =
  | { type: "create" }
  | { type: "edit"; item: EquipmentRecord }
  | { type: "archive"; item: EquipmentRecord }
  | null;

export function EquipmentView({
  controller,
  projects,
}: {
  controller: EquipmentController;
  projects: Project[];
}) {
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | EquipmentStatus>(
    "all",
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es-MX");
    return controller.items.filter((item) => {
      const matchesStatus =
        statusFilter === "all"
          ? item.status !== "archived"
          : item.status === statusFilter;
      const matchesProject =
        projectFilter === "all" ||
        (projectFilter === "unassigned"
          ? item.projectId === null
          : item.projectId === projectFilter);
      const project = item.projectId
        ? projectById.get(item.projectId)?.name ?? ""
        : "no adjudicado";
      const matchesQuery =
        !term ||
        [
          item.name,
          item.code,
          item.category,
          item.serialNumber,
          item.location,
          item.responsible,
          project,
        ].some((value) => value.toLocaleLowerCase("es-MX").includes(term));
      return matchesStatus && matchesProject && matchesQuery;
    });
  }, [
    controller.items,
    projectById,
    projectFilter,
    query,
    statusFilter,
  ]);

  if (controller.loading) {
    return (
      <section className="panel project-loading">
        <span className="project-spinner" />
        <h2>Cargando equipo</h2>
        <p>Recuperando herramientas y disponibilidad.</p>
      </section>
    );
  }

  const projectName = (item: EquipmentRecord) =>
    item.projectId
      ? projectById.get(item.projectId)?.name ?? "Proyecto no disponible"
      : "No adjudicado";

  return (
    <section className="equipment-workspace">
      <article className="panel equipment-toolbar">
        <div>
          <p className="eyebrow">CONTROL DE ACTIVOS</p>
          <h2>Equipo y herramientas</h2>
          <small>
            {
              controller.activeItems.filter(
                (item) => item.status === "available",
              ).length
            }{" "}
            disponibles de {controller.activeItems.length} activos
          </small>
        </div>
        <label className="project-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, código, serie o responsable"
          />
        </label>
        <button
          className="primary-button"
          onClick={() => setDialog({ type: "create" })}
          type="button"
        >
          + Nuevo equipo
        </button>
        <div className="equipment-filters">
          <select
            aria-label="Filtrar equipo por proyecto"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value="all">Todos los proyectos</option>
            <option value="unassigned">No adjudicado</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} · {project.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar equipo por estado"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | EquipmentStatus)
            }
          >
            <option value="all">Todos los activos</option>
            {Object.entries(EQUIPMENT_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </article>

      {controller.notice && (
        <div className="project-feedback" role="status">
          <span>✓</span>
          <p>{controller.notice}</p>
          <button
            onClick={controller.clearNotice}
            aria-label="Cerrar mensaje"
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

      {filtered.length === 0 ? (
        <article className="panel projects-empty">
          <span>◇</span>
          <h2>No hay equipo para mostrar</h2>
          <p>Ajusta los filtros o registra una nueva herramienta.</p>
          {statusFilter !== "archived" && (
            <button
              className="primary-button"
              onClick={() => setDialog({ type: "create" })}
              type="button"
            >
              Agregar equipo
            </button>
          )}
        </article>
      ) : (
        <div className="equipment-card-grid">
          {filtered.map((item) => (
            <article
              className={`panel equipment-record ${
                item.status === "archived" ? "equipment-record-archived" : ""
              }`}
              key={item.id}
            >
              <div className="equipment-record-head">
                <span className="equipment-record-icon">◇</span>
                <div>
                  <small>
                    {item.code} · {item.category}
                  </small>
                  <h3>{item.name}</h3>
                </div>
                <EquipmentStatusBadge status={item.status} />
              </div>
              {item.description && <p>{item.description}</p>}
              <div
                className={`equipment-project ${
                  item.projectId ? "" : "unassigned"
                }`}
              >
                <span>Proyecto</span>
                <b>{projectName(item)}</b>
              </div>
              <dl className="equipment-detail-grid">
                <div>
                  <dt>Ubicación</dt>
                  <dd>{item.location}</dd>
                </div>
                <div>
                  <dt>Responsable</dt>
                  <dd>{item.responsible || "Sin responsable"}</dd>
                </div>
                <div>
                  <dt>Número de serie</dt>
                  <dd>{item.serialNumber || "Sin registrar"}</dd>
                </div>
                <div>
                  <dt>Próximo mantenimiento</dt>
                  <dd>{formatDate(item.nextMaintenanceDate)}</dd>
                </div>
              </dl>
              {item.critical && (
                <span className="equipment-critical-tag">
                  Herramienta crítica para planeación
                </span>
              )}
              <div className="project-card-actions">
                {item.status !== "archived" ? (
                  <>
                    <button
                      onClick={() => setDialog({ type: "edit", item })}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="danger-link"
                      onClick={() => setDialog({ type: "archive", item })}
                      type="button"
                    >
                      Archivar
                    </button>
                  </>
                ) : (
                  <span className="muted">Equipo archivado</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {(dialog?.type === "create" || dialog?.type === "edit") && (
        <EquipmentForm
          equipment={controller.items}
          item={dialog.type === "edit" ? dialog.item : null}
          projects={projects}
          saving={controller.saving}
          onCancel={() => setDialog(null)}
          onSave={(input) =>
            dialog.type === "edit"
              ? controller.updateItem(dialog.item.id, input)
              : controller.createItem(input)
          }
        />
      )}
      {dialog?.type === "archive" && (
        <EquipmentArchiveDialog
          item={dialog.item}
          saving={controller.saving}
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            if (await controller.archiveItem(dialog.item.id)) setDialog(null);
          }}
        />
      )}
    </section>
  );
}

function formatDate(value: string) {
  if (!value) return "Sin programar";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
