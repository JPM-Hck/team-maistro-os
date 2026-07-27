"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskInput,
  type TaskRecord,
} from "@/domain/tasks/types";
import type {
  Employee,
  WorkspaceProject,
} from "@/domain/workspace/types";
import { TaskForm } from "./TaskForm";
import type { TasksController } from "./useTasks";

type Dialog =
  | { kind: "create" }
  | { kind: "edit" | "archive"; task: TaskRecord }
  | null;

export function TasksView({
  controller,
  projects,
  employees,
  activeProjectId,
  demoTaskId,
  demoResources,
}: {
  controller: TasksController;
  projects: WorkspaceProject[];
  employees: Employee[];
  activeProjectId: string | null;
  demoTaskId: string | null;
  demoResources?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState(
    activeProjectId ?? "all",
  );
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedId, setSelectedId] = useState<string | null>(demoTaskId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const visibleTasks = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es-MX");
    return controller.tasks.filter((task) => {
      const project = projectById.get(task.projectId);
      const assigneeNames = task.assigneeIds
        .map((id) => employeeById.get(id)?.fullName ?? "")
        .join(" ");
      const matchesProject =
        projectFilter === "all" || task.projectId === projectFilter;
      const matchesEmployee =
        employeeFilter === "all" ||
        task.assigneeIds.includes(employeeFilter);
      const matchesStatus =
        statusFilter === "all"
          ? !task.archived
          : statusFilter === "archived"
            ? task.archived
            : statusFilter === "active"
              ? !task.archived && task.status !== "cancelled"
              : !task.archived && task.status === statusFilter;
      const matchesQuery =
        !term ||
        [task.name, task.description, project?.name ?? "", assigneeNames].some(
          (value) => value.toLocaleLowerCase("es-MX").includes(term),
        );
      return (
        matchesProject &&
        matchesEmployee &&
        matchesStatus &&
        matchesQuery
      );
    });
  }, [
    controller.tasks,
    employeeById,
    employeeFilter,
    projectById,
    projectFilter,
    query,
    statusFilter,
  ]);

  const selected =
    controller.tasks.find((task) => task.id === selectedId) ??
    visibleTasks[0] ??
    null;

  async function saveTask(input: TaskInput) {
    const saved =
      dialog?.kind === "edit"
        ? await controller.updateTask(dialog.task.id, input)
        : await controller.createTask(input);
    if (saved) {
      setDialog(null);
      const next = controller.tasks.find(
        (task) => task.id === selectedId,
      );
      if (!next && dialog?.kind === "create") setSelectedId(null);
    }
    return saved;
  }

  if (controller.loading) {
    return (
      <section className="panel project-loading">
        <span className="project-spinner" />
        <h2>Cargando tareas</h2>
        <p>Recuperando el programa de obra del workspace.</p>
      </section>
    );
  }

  return (
    <>
      <section className="tasks-workspace">
        <article className="panel tasks-toolbar">
          <div>
            <p className="eyebrow">PROGRAMA DE OBRA</p>
            <h2>{controller.tasks.length} tareas registradas</h2>
          </div>
          <label className="project-search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Buscar tareas"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar tarea, proyecto o responsable"
              type="search"
              value={query}
            />
          </label>
          <button
            className="primary-button"
            onClick={() => {
              controller.clearNotice();
              setDialog({ kind: "create" });
            }}
            type="button"
          >
            + Nueva tarea
          </button>
          <div className="tasks-filters">
            <select
              aria-label="Filtrar tareas por proyecto"
              onChange={(event) => setProjectFilter(event.target.value)}
              value={projectFilter}
            >
              <option value="all">Todos los proyectos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} · {project.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar tareas por responsable"
              onChange={(event) => setEmployeeFilter(event.target.value)}
              value={employeeFilter}
            >
              <option value="all">Todos los responsables</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar tareas por estado"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="active">Activas</option>
              <option value="all">Todos los estados</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
              <option value="archived">Archivadas</option>
            </select>
          </div>
        </article>

        {controller.notice && (
          <div className="project-feedback success" role="status">
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

        <section className="section-grid">
          <article className="panel section-card task-list-card">
            <div className="section-card-head">
              <div>
                <p className="eyebrow">RESULTADOS</p>
                <h2>{visibleTasks.length} tareas visibles</h2>
              </div>
            </div>
            {visibleTasks.length === 0 ? (
              <div className="tasks-empty">
                <b>Sin tareas para mostrar</b>
                <small>Ajusta los filtros o crea una tarea.</small>
              </div>
            ) : (
              visibleTasks.map((task) => (
                <button
                  className={`task-list-item ${
                    selected?.id === task.id ? "selected" : ""
                  }`}
                  key={task.id}
                  onClick={() => setSelectedId(task.id)}
                  type="button"
                >
                  <span className={`task-dot status-${task.status}`} />
                  <span>
                    <b>{task.name}</b>
                    <small>
                      {projectById.get(task.projectId)?.name ??
                        "Proyecto no disponible"}{" "}
                      · {task.progress}% · peso {task.progressWeight}
                    </small>
                  </span>
                  <span className={`status status-${task.status}`}>
                    {task.archived
                      ? "Archivada"
                      : TASK_STATUS_LABELS[task.status]}
                  </span>
                </button>
              ))
            )}
          </article>

          {selected ? (
            <TaskDetail
              employees={employees}
              isDemo={selected.id === demoTaskId}
              onArchive={() => setDialog({ kind: "archive", task: selected })}
              onCancel={() => void controller.cancelTask(selected.id)}
              onComplete={() => void controller.completeTask(selected.id)}
              onEdit={() => setDialog({ kind: "edit", task: selected })}
              project={projectById.get(selected.projectId) ?? null}
              resources={demoResources}
              saving={controller.saving}
              task={selected}
            />
          ) : (
            <article className="panel tasks-detail-empty">
              <h2>Selecciona una tarea</h2>
              <p>El detalle y sus acciones aparecerán aquí.</p>
            </article>
          )}
        </section>
      </section>

      {(dialog?.kind === "create" || dialog?.kind === "edit") && (
        <TaskForm
          activeProjectId={activeProjectId}
          employees={employees}
          onCancel={() => setDialog(null)}
          onSave={saveTask}
          projects={projects}
          saving={controller.saving}
          task={dialog.kind === "edit" ? dialog.task : null}
        />
      )}
      {dialog?.kind === "archive" && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="archive-task-title"
            aria-modal="true"
            className="planner-modal confirm-modal"
            role="dialog"
          >
            <div className="planner-head">
              <div>
                <p className="eyebrow">TAREAS</p>
                <h2 id="archive-task-title">Archivar tarea</h2>
              </div>
            </div>
            <div className="archive-copy">
              <p>
                <b>{dialog.task.name}</b> dejará de participar en el avance
                del proyecto. Su historial permanecerá guardado.
              </p>
            </div>
            <div className="planner-actions">
              <button
                className="secondary-button"
                disabled={controller.saving}
                onClick={() => setDialog(null)}
                type="button"
              >
                Volver
              </button>
              <button
                className="danger-button"
                disabled={controller.saving}
                onClick={async () => {
                  if (await controller.archiveTask(dialog.task.id)) {
                    setDialog(null);
                  }
                }}
                type="button"
              >
                {controller.saving ? "Archivando…" : "Archivar tarea"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function TaskDetail({
  task,
  project,
  employees,
  saving,
  isDemo,
  resources,
  onEdit,
  onComplete,
  onCancel,
  onArchive,
}: {
  task: TaskRecord;
  project: WorkspaceProject | null;
  employees: Employee[];
  saving: boolean;
  isDemo: boolean;
  resources?: ReactNode;
  onEdit(): void;
  onComplete(): void;
  onCancel(): void;
  onArchive(): void;
}) {
  const names = task.assigneeIds
    .map(
      (id) =>
        employees.find((employee) => employee.id === id)?.fullName ??
        "Persona no disponible",
    )
    .join(", ");
  return (
    <article className="panel task-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{project?.name ?? "SIN PROYECTO"}</p>
          <h2>{task.name}</h2>
        </div>
        <span className={`status status-${task.status}`}>
          {task.archived ? "Archivada" : TASK_STATUS_LABELS[task.status]}
        </span>
      </div>
      {task.needsReview && (
        <p className="task-review-note">
          Revisión pendiente · tarea creada para conservar el avance anterior.
        </p>
      )}
      <div className="task-progress-summary">
        <div>
          <span>Avance de la tarea</span>
          <b>{task.status === "completed" ? 100 : task.progress}%</b>
        </div>
        <div className="progress-track">
          <i
            style={{
              width: `${task.status === "completed" ? 100 : task.progress}%`,
            }}
          />
        </div>
      </div>
      <div className="task-meta">
        <span>
          <b>{task.progressWeight}</b> peso
        </span>
        <span>
          <b>{names || "Sin responsables"}</b>
        </span>
        <span>
          <b>{task.quantity}</b> {task.unit || "unidades"}
        </span>
        <span>
          <b>{formatDateRange(task.startDate, task.targetDate)}</b>
        </span>
      </div>
      <p className="task-description">
        {task.description || "Sin descripción registrada."}
      </p>
      <div className="project-card-actions task-actions">
        {!task.archived && (
          <>
            <button disabled={saving} onClick={onEdit} type="button">
              Editar
            </button>
            {task.status !== "completed" && task.status !== "cancelled" && (
              <button disabled={saving} onClick={onComplete} type="button">
                Terminar
              </button>
            )}
            {task.status !== "cancelled" && task.status !== "completed" && (
              <button
                className="danger-link"
                disabled={saving}
                onClick={onCancel}
                type="button"
              >
                Cancelar
              </button>
            )}
            <button
              className="danger-link"
              disabled={saving}
              onClick={onArchive}
              type="button"
            >
              Archivar
            </button>
          </>
        )}
      </div>
      {isDemo && resources}
    </article>
  );
}

function formatDateRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${start}T00:00:00Z`))}–${formatter.format(
    new Date(`${end}T00:00:00Z`),
  )}`;
}
