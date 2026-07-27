"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  normalizeTaskInput,
  validateTask,
} from "@/domain/tasks/task-validation";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskInput,
  type TaskRecord,
  toTaskInput,
} from "@/domain/tasks/types";
import type {
  Employee,
  WorkspaceProject,
} from "@/domain/workspace/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyTask(
  activeProjectId: string | null,
  projects: WorkspaceProject[],
): TaskInput {
  const currentDate = today();
  const projectId =
    projects.find(
      (project) =>
        project.id === activeProjectId && project.status !== "archived",
    )?.id ??
    projects.find((project) => project.status !== "archived")?.id ??
    "";
  return {
    projectId,
    name: "",
    description: "",
    status: "draft",
    progress: 0,
    progressWeight: 1,
    quantity: 0,
    unit: "",
    startDate: currentDate,
    targetDate: currentDate,
    assigneeIds: [],
    recipeId: null,
    equipmentItemIds: [],
  };
}

export function TaskForm({
  task,
  projects,
  employees,
  activeProjectId,
  saving,
  onCancel,
  onSave,
}: {
  task: TaskRecord | null;
  projects: WorkspaceProject[];
  employees: Employee[];
  activeProjectId: string | null;
  saving: boolean;
  onCancel(): void;
  onSave(input: TaskInput): Promise<boolean>;
}) {
  const [input, setInput] = useState<TaskInput>(() =>
    task ? toTaskInput(task) : emptyTask(activeProjectId, projects),
  );
  const [submitted, setSubmitted] = useState(false);
  const normalized = useMemo(() => normalizeTaskInput(input), [input]);
  const errors = useMemo(
    () =>
      validateTask(normalized, {
        projects,
        employees,
        currentProjectId: task?.projectId,
        currentAssigneeIds: task?.assigneeIds,
      }),
    [employees, normalized, projects, task?.assigneeIds, task?.projectId],
  );
  const valid = Object.keys(errors).length === 0;

  function change<K extends keyof TaskInput>(
    field: K,
    value: TaskInput[K],
  ) {
    setInput((current) => {
      const next = { ...current, [field]: value };
      if (field === "status" && value === "completed") {
        next.progress = 100;
      }
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!valid || saving) return;
    if (await onSave(normalized)) onCancel();
  }

  const errorFor = (field: keyof TaskInput) =>
    submitted && errors[field] ? (
      <small className="field-error">{errors[field]}</small>
    ) : null;

  const visibleEmployees = employees.filter(
    (employee) =>
      employee.employmentStatus === "active" ||
      task?.assigneeIds.includes(employee.id),
  );

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel();
      }}
    >
      <section
        aria-labelledby="task-form-title"
        aria-modal="true"
        className="planner-modal task-crud-modal"
        role="dialog"
      >
        <div className="planner-head">
          <div>
            <p className="eyebrow">PROGRAMA DE OBRA</p>
            <h2 id="task-form-title">
              {task ? "Editar tarea" : "Nueva tarea"}
            </h2>
            <p>Define responsables, peso y avance dentro del proyecto.</p>
          </div>
          <button
            aria-label="Cerrar formulario"
            className="close-button"
            disabled={saving}
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </div>

        <form className="project-form" noValidate onSubmit={submit}>
          <div className="form-grid">
            <label className="field field-wide">
              <span>Nombre *</span>
              <input
                autoFocus
                onChange={(event) => change("name", event.target.value)}
                value={input.name}
              />
              {errorFor("name")}
            </label>
            <label className="field">
              <span>Proyecto *</span>
              <select
                onChange={(event) =>
                  change("projectId", event.target.value)
                }
                value={input.projectId}
              >
                <option value="">Selecciona un proyecto</option>
                {projects
                  .filter(
                    (project) =>
                      project.status !== "archived" ||
                      project.id === task?.projectId,
                  )
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} · {project.name}
                    </option>
                  ))}
              </select>
              {errorFor("projectId")}
            </label>
            <label className="field">
              <span>Estado</span>
              <select
                onChange={(event) =>
                  change(
                    "status",
                    event.target.value as TaskInput["status"],
                  )
                }
                value={input.status}
              >
                {TASK_STATUSES.filter(
                  (status) =>
                    status !== "cancelled" || task?.status === "cancelled",
                ).map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              {errorFor("status")}
            </label>
            <label className="field">
              <span>Avance de la tarea (%)</span>
              <input
                disabled={input.status === "completed"}
                max="100"
                min="0"
                onChange={(event) =>
                  change("progress", Number(event.target.value))
                }
                type="number"
                value={input.progress}
              />
              {errorFor("progress")}
            </label>
            <label className="field">
              <span>Peso en el proyecto *</span>
              <input
                min="0.01"
                onChange={(event) =>
                  change("progressWeight", Number(event.target.value))
                }
                step="0.01"
                type="number"
                value={input.progressWeight}
              />
              {errorFor("progressWeight")}
            </label>
            <label className="field">
              <span>Cantidad</span>
              <input
                min="0"
                onChange={(event) =>
                  change("quantity", Number(event.target.value))
                }
                step="0.01"
                type="number"
                value={input.quantity}
              />
              {errorFor("quantity")}
            </label>
            <label className="field">
              <span>Unidad</span>
              <input
                onChange={(event) => change("unit", event.target.value)}
                placeholder="m², pza, lote…"
                value={input.unit}
              />
            </label>
            <label className="field">
              <span>Fecha inicial *</span>
              <input
                onChange={(event) =>
                  change("startDate", event.target.value)
                }
                type="date"
                value={input.startDate}
              />
              {errorFor("startDate")}
            </label>
            <label className="field">
              <span>Fecha objetivo *</span>
              <input
                min={input.startDate}
                onChange={(event) =>
                  change("targetDate", event.target.value)
                }
                type="date"
                value={input.targetDate}
              />
              {errorFor("targetDate")}
            </label>
            <fieldset className="field field-wide task-assignees">
              <legend>Responsables *</legend>
              <div>
                {visibleEmployees.map((employee) => (
                  <label key={employee.id}>
                    <input
                      checked={input.assigneeIds.includes(employee.id)}
                      onChange={(event) =>
                        change(
                          "assigneeIds",
                          event.target.checked
                            ? [...input.assigneeIds, employee.id]
                            : input.assigneeIds.filter(
                                (id) => id !== employee.id,
                              ),
                        )
                      }
                      type="checkbox"
                    />
                    <span>
                      <b>{employee.fullName}</b>
                      <small>
                        {employee.role}
                        {employee.employmentStatus === "archived"
                          ? " · archivada"
                          : ""}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              {errorFor("assigneeIds")}
            </fieldset>
            <label className="field field-wide">
              <span>Descripción</span>
              <textarea
                onChange={(event) =>
                  change("description", event.target.value)
                }
                rows={3}
                value={input.description}
              />
            </label>
          </div>
          {submitted && !valid && (
            <p className="form-error">
              Revisa los campos marcados antes de guardar.
            </p>
          )}
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
              className="primary-button"
              disabled={!valid || saving}
              type="submit"
            >
              {saving ? "Guardando…" : "Guardar tarea"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
