"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  isEquipmentValid,
  validateEquipment,
} from "@/domain/equipment/equipment-validation";
import {
  EQUIPMENT_STATUS_LABELS,
  type EquipmentInput,
  type EquipmentRecord,
  type EquipmentStatus,
  toEquipmentInput,
} from "@/domain/equipment/types";
import type { Project } from "@/domain/projects/types";

const editableStatuses: EquipmentStatus[] = [
  "available",
  "reserved",
  "assigned",
  "maintenance",
  "lost",
  "retired",
];

const emptyInput: EquipmentInput = {
  code: "",
  name: "",
  category: "",
  description: "",
  serialNumber: "",
  location: "Almacén central",
  responsible: "",
  status: "available",
  critical: false,
  projectId: null,
  acquiredDate: "",
  nextMaintenanceDate: "",
};

export function EquipmentForm({
  equipment,
  item,
  projects,
  saving,
  onCancel,
  onSave,
}: {
  equipment: EquipmentRecord[];
  item: EquipmentRecord | null;
  projects: Project[];
  saving: boolean;
  onCancel(): void;
  onSave(input: EquipmentInput): Promise<boolean>;
}) {
  const [input, setInput] = useState<EquipmentInput>(
    item ? toEquipmentInput(item) : emptyInput,
  );
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(
    () => validateEquipment(input, equipment, item?.id),
    [equipment, input, item?.id],
  );
  const valid = isEquipmentValid(errors);

  function change<K extends keyof EquipmentInput>(
    field: K,
    value: EquipmentInput[K],
  ) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!valid || saving) return;
    if (await onSave(input)) onCancel();
  }

  const fieldError = (field: keyof EquipmentInput) =>
    (submitted || input[field] !== emptyInput[field]) && errors[field] ? (
      <small className="field-error">{errors[field]}</small>
    ) : null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel();
      }}
    >
      <section
        className="planner-modal equipment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-form-title"
      >
        <div className="planner-head">
          <div>
            <p className="eyebrow">CONTROL DE ACTIVOS</p>
            <h2 id="equipment-form-title">
              {item ? "Editar equipo" : "Nuevo equipo"}
            </h2>
            <p>
              Registra disponibilidad y asígnalo a una obra o déjalo como No
              adjudicado.
            </p>
          </div>
          <button
            className="close-button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Cerrar formulario"
            type="button"
          >
            ×
          </button>
        </div>

        <form className="project-form" onSubmit={submit} noValidate>
          <div className="form-grid">
            <label className="field">
              <span>Código *</span>
              <input
                value={input.code}
                onChange={(event) => change("code", event.target.value)}
                placeholder="EQ-001"
                aria-invalid={Boolean(errors.code)}
              />
              {fieldError("code")}
            </label>
            <label className="field">
              <span>Nombre *</span>
              <input
                value={input.name}
                onChange={(event) => change("name", event.target.value)}
                placeholder="Taladro inalámbrico"
                aria-invalid={Boolean(errors.name)}
              />
              {fieldError("name")}
            </label>
            <label className="field">
              <span>Categoría *</span>
              <input
                value={input.category}
                onChange={(event) => change("category", event.target.value)}
                placeholder="Corte, medición, perforación…"
                aria-invalid={Boolean(errors.category)}
              />
              {fieldError("category")}
            </label>
            <label className="field">
              <span>Número de serie</span>
              <input
                value={input.serialNumber}
                onChange={(event) =>
                  change("serialNumber", event.target.value)
                }
                placeholder="SERIE-2026"
                aria-invalid={Boolean(errors.serialNumber)}
              />
              {fieldError("serialNumber")}
            </label>
            <label className="field">
              <span>Estado</span>
              <select
                value={input.status}
                onChange={(event) =>
                  change("status", event.target.value as EquipmentStatus)
                }
              >
                {editableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {EQUIPMENT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Proyecto</span>
              <select
                value={input.projectId ?? ""}
                onChange={(event) =>
                  change("projectId", event.target.value || null)
                }
                aria-invalid={Boolean(errors.projectId)}
              >
                <option value="">No adjudicado</option>
                {projects
                  .filter(
                    (project) =>
                      project.status !== "archived" ||
                      project.id === input.projectId,
                  )
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} · {project.name}
                    </option>
                  ))}
              </select>
              {fieldError("projectId")}
            </label>
            <label className="field">
              <span>Ubicación *</span>
              <input
                value={input.location}
                onChange={(event) => change("location", event.target.value)}
                placeholder="Almacén central"
                aria-invalid={Boolean(errors.location)}
              />
              {fieldError("location")}
            </label>
            <label className="field">
              <span>Responsable</span>
              <input
                value={input.responsible}
                onChange={(event) => change("responsible", event.target.value)}
                placeholder="Nombre de responsable"
              />
            </label>
            <label className="field">
              <span>Fecha de adquisición</span>
              <input
                type="date"
                value={input.acquiredDate}
                onChange={(event) =>
                  change("acquiredDate", event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Próximo mantenimiento</span>
              <input
                type="date"
                min={input.acquiredDate || undefined}
                value={input.nextMaintenanceDate}
                onChange={(event) =>
                  change("nextMaintenanceDate", event.target.value)
                }
                aria-invalid={Boolean(errors.nextMaintenanceDate)}
              />
              {fieldError("nextMaintenanceDate")}
            </label>
            <label className="equipment-critical field-wide">
              <input
                type="checkbox"
                checked={input.critical}
                onChange={(event) => change("critical", event.target.checked)}
              />
              <span>
                <b>Herramienta crítica</b>
                <small>
                  Su falta de disponibilidad puede bloquear la planeación.
                </small>
              </span>
            </label>
            <label className="field field-wide">
              <span>Descripción</span>
              <textarea
                value={input.description}
                onChange={(event) =>
                  change("description", event.target.value)
                }
                placeholder="Características, accesorios o notas operativas."
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
              onClick={onCancel}
              disabled={saving}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={!valid || saving}
              type="submit"
            >
              {saving ? "Guardando…" : item ? "Guardar cambios" : "Agregar equipo"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
