"use client";

import { useMemo, useState } from "react";
import type { InventoryRecord } from "@/domain/inventory/types";
import { getAvailableStock, type Requirement } from "@/domain/operations";
import type { Project } from "@/domain/projects/types";
import { InventoryArchiveDialog } from "./InventoryArchiveDialog";
import { InventoryForm } from "./InventoryForm";
import type { InventoryController } from "./useInventory";

type Dialog =
  | { type: "create" }
  | { type: "edit"; item: InventoryRecord }
  | { type: "archive"; item: InventoryRecord }
  | null;

export function InventoryView({
  controller,
  projects,
  requirements,
}: {
  controller: InventoryController;
  projects: Project[];
  requirements: Requirement[];
}) {
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">(
    "active",
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es-MX");
    return controller.items.filter((item) => {
      const matchesStatus = item.status === statusFilter;
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
        [item.name, item.sku, item.unit, item.description, project].some(
          (value) => value.toLocaleLowerCase("es-MX").includes(term),
        );
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
        <h2>Cargando inventario</h2>
        <p>Recuperando las existencias guardadas.</p>
      </section>
    );
  }

  const projectName = (item: InventoryRecord) =>
    item.projectId
      ? projectById.get(item.projectId)?.name ?? "Proyecto no disponible"
      : "No adjudicado";

  return (
    <section className="inventory-workspace">
      <article className="panel inventory-toolbar">
        <div>
          <p className="eyebrow">ALMACÉN CENTRAL</p>
          <h2>Existencias actuales</h2>
          <small>{controller.activeItems.length} artículos activos</small>
        </div>
        <label className="project-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, SKU, unidad o proyecto"
          />
        </label>
        <button
          className="primary-button"
          onClick={() => setDialog({ type: "create" })}
          type="button"
        >
          + Nuevo artículo
        </button>
        <div className="inventory-filters">
          <select
            aria-label="Filtrar por proyecto"
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
          <button
            className={statusFilter === "active" ? "active" : ""}
            onClick={() => setStatusFilter("active")}
            type="button"
          >
            Activos
          </button>
          <button
            className={statusFilter === "archived" ? "active" : ""}
            onClick={() => setStatusFilter("archived")}
            type="button"
          >
            Archivados
          </button>
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
          <span>□</span>
          <h2>No hay artículos para mostrar</h2>
          <p>
            Ajusta los filtros o agrega el primer artículo de esta sección.
          </p>
          {statusFilter === "active" && (
            <button
              className="primary-button"
              onClick={() => setDialog({ type: "create" })}
              type="button"
            >
              Agregar artículo
            </button>
          )}
        </article>
      ) : (
        <div className="inventory-card-grid">
          {filtered.map((item) => {
            const requirement = requirements.find(
              (line) => line.itemId === item.id,
            );
            return (
              <article
                className={`panel inventory-record ${
                  item.status === "archived" ? "inventory-record-archived" : ""
                }`}
                key={item.id}
              >
                <div className="inventory-record-head">
                  <span className="inventory-record-icon">
                    {item.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <small>{item.sku}</small>
                    <h3>{item.name}</h3>
                  </div>
                  <span
                    className={`inventory-assignment ${
                      item.projectId ? "" : "unassigned"
                    }`}
                  >
                    {projectName(item)}
                  </span>
                </div>
                {item.description && <p>{item.description}</p>}
                <dl className="inventory-stock-grid">
                  <div>
                    <dt>Existencia</dt>
                    <dd>
                      {item.physicalStock.toFixed(2)} {item.unit}
                    </dd>
                  </div>
                  <div>
                    <dt>Reservado</dt>
                    <dd>
                      {item.reservedStock.toFixed(2)} {item.unit}
                    </dd>
                  </div>
                  <div>
                    <dt>Seguridad</dt>
                    <dd>
                      {item.safetyStock.toFixed(2)} {item.unit}
                    </dd>
                  </div>
                  <div>
                    <dt>Disponible</dt>
                    <dd>
                      {getAvailableStock(item).toFixed(2)} {item.unit}
                    </dd>
                  </div>
                </dl>
                {requirement && requirement.shortage > 0 && (
                  <p className="inventory-shortage">
                    Faltan {requirement.shortage.toFixed(2)} {item.unit} para
                    la tarea actual.
                  </p>
                )}
                <div className="project-card-actions">
                  {item.status === "active" ? (
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
                    <span className="muted">Artículo archivado</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {(dialog?.type === "create" || dialog?.type === "edit") && (
        <InventoryForm
          inventory={controller.items}
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
        <InventoryArchiveDialog
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
