"use client";

import { FormEvent, useMemo, useState } from "react";
import { validateProject } from "@/domain/projects/project-validation";
import {
  type Project,
  type ProjectInput,
  type ProjectStatus,
  toProjectInput,
} from "@/domain/projects/types";
import { getResponsibleAssignmentError } from "@/domain/workspace/employee-assignment";
import type { Employee } from "@/domain/workspace/types";
import { PROJECT_STATUS_LABELS } from "./ProjectStatusBadge";

const editableStatuses: ProjectStatus[] = [
  "draft",
  "planned",
  "in_progress",
  "paused",
  "completed",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyProject(): ProjectInput {
  const currentDate = today();
  return {
    name: "",
    code: "",
    projectType: "",
    description: "",
    clientName: "",
    location: "",
    responsible: "",
    responsibleEmployeeId: null,
    startDate: currentDate,
    targetDate: currentDate,
    budget: 0,
    progress: 0,
    status: "draft",
    currentTask: "",
  };
}

export function ProjectForm({
  project,
  projects,
  employees,
  saving,
  onCancel,
  onSave,
}: {
  project: Project | null;
  projects: Project[];
  employees: Employee[];
  saving: boolean;
  onCancel: () => void;
  onSave: (input: ProjectInput) => Promise<boolean>;
}) {
  const [input, setInput] = useState<ProjectInput>(() =>
    project ? toProjectInput(project) : emptyProject(),
  );
  const errors = useMemo(() => {
    const validation = validateProject(input, projects, project?.id);
    const responsibleError = getResponsibleAssignmentError(
      input,
      employees,
      project?.responsibleEmployeeId ?? null,
    );
    if (responsibleError) {
      validation.responsibleEmployeeId = responsibleError;
    }
    return validation;
  }, [employees, input, project?.id, project?.responsibleEmployeeId, projects]);
  const invalid = Object.keys(errors).length > 0;

  function set<K extends keyof ProjectInput>(
    field: K,
    value: ProjectInput[K],
  ) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalid || saving) return;
    await onSave(input);
  }

  return (
    <form className="project-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <ProjectField
          error={errors.name}
          label="Nombre"
          wide
        >
          <input
            autoFocus
            onChange={(event) => set("name", event.target.value)}
            value={input.name}
          />
        </ProjectField>
        <ProjectField error={errors.code} label="Código">
          <input
            maxLength={12}
            onChange={(event) => set("code", event.target.value.toUpperCase())}
            value={input.code}
          />
        </ProjectField>
        <ProjectField label="Tipo de proyecto">
          <input
            onChange={(event) => set("projectType", event.target.value)}
            value={input.projectType}
          />
        </ProjectField>
        <ProjectField label="Cliente">
          <input
            onChange={(event) => set("clientName", event.target.value)}
            value={input.clientName}
          />
        </ProjectField>
        <ProjectField error={errors.location} label="Ubicación">
          <input
            onChange={(event) => set("location", event.target.value)}
            value={input.location}
          />
        </ProjectField>
        <ProjectField
          error={errors.responsibleEmployeeId ?? errors.responsible}
          label="Responsable"
        >
          <select
            onChange={(event) => {
              const employee = employees.find(
                (candidate) => candidate.id === event.target.value,
              );
              setInput((current) => ({
                ...current,
                responsibleEmployeeId: employee?.id ?? null,
                responsible: employee?.fullName ?? "",
              }));
            }}
            value={input.responsibleEmployeeId ?? ""}
          >
            <option value="">Selecciona una persona</option>
            {employees
              .filter(
                (employee) =>
                  employee.employmentStatus === "active" ||
                  employee.id === project?.responsibleEmployeeId,
              )
              .map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeCode} · {employee.fullName}
                  {employee.employmentStatus === "archived"
                    ? " (archivada)"
                    : ""}
                </option>
              ))}
          </select>
        </ProjectField>
        <ProjectField error={errors.status} label="Estado">
          <select
            onChange={(event) =>
              set("status", event.target.value as ProjectStatus)
            }
            value={input.status}
          >
            {editableStatuses.map((status) => (
              <option key={status} value={status}>
                {PROJECT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </ProjectField>
        <ProjectField error={errors.startDate} label="Fecha inicial">
          <input
            onChange={(event) => set("startDate", event.target.value)}
            type="date"
            value={input.startDate}
          />
        </ProjectField>
        <ProjectField error={errors.targetDate} label="Fecha objetivo">
          <input
            min={input.startDate}
            onChange={(event) => set("targetDate", event.target.value)}
            type="date"
            value={input.targetDate}
          />
        </ProjectField>
        <ProjectField error={errors.budget} label="Presupuesto">
          <input
            min="0"
            onChange={(event) => set("budget", Number(event.target.value))}
            step="1000"
            type="number"
            value={input.budget}
          />
        </ProjectField>
        <ProjectField error={errors.progress} label="Avance (%)">
          <input
            max="100"
            min="0"
            onChange={(event) => set("progress", Number(event.target.value))}
            type="number"
            value={input.progress}
          />
        </ProjectField>
        <ProjectField label="Tarea actual" wide>
          <input
            onChange={(event) => set("currentTask", event.target.value)}
            value={input.currentTask ?? ""}
          />
        </ProjectField>
        <ProjectField label="Descripción" wide>
          <textarea
            onChange={(event) => set("description", event.target.value)}
            rows={4}
            value={input.description}
          />
        </ProjectField>
      </div>
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
          disabled={invalid || saving}
          type="submit"
        >
          {saving ? "Guardando…" : "Guardar proyecto"}
        </button>
      </div>
    </form>
  );
}

function ProjectField({
  children,
  error,
  label,
  wide = false,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "field-wide" : ""}`}>
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
