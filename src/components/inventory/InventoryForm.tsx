"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  isInventoryValid,
  validateInventory,
} from "@/domain/inventory/inventory-validation";
import {
  type InventoryInput,
  type InventoryRecord,
  toInventoryInput,
} from "@/domain/inventory/types";
import type { Project } from "@/domain/projects/types";

const emptyInput: InventoryInput = {
  sku: "",
  name: "",
  description: "",
  unit: "",
  physicalStock: 0,
  reservedStock: 0,
  safetyStock: 0,
  projectId: null,
  status: "active",
};

export function InventoryForm({
  inventory,
  item,
  projects,
  saving,
  onCancel,
  onSave,
}: {
  inventory: InventoryRecord[];
  item: InventoryRecord | null;
  projects: Project[];
  saving: boolean;
  onCancel(): void;
  onSave(input: InventoryInput): Promise<boolean>;
}) {
  const [input, setInput] = useState<InventoryInput>(
    item ? toInventoryInput(item) : emptyInput,
  );
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(
    () => validateInventory(input, inventory, item?.id),
    [input, inventory, item?.id],
  );
  const valid = isInventoryValid(errors);

  function change<K extends keyof InventoryInput>(
    field: K,
    value: InventoryInput[K],
  ) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!valid || saving) return;
    if (await onSave(input)) onCancel();
  }

  const fieldError = (field: keyof InventoryInput) =>
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
        className="planner-modal inventory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-form-title"
      >
        <div className="planner-head">
          <div>
            <p className="eyebrow">ALMACÉN CENTRAL</p>
            <h2 id="inventory-form-title">
              {item ? "Editar artículo" : "Nuevo artículo"}
            </h2>
            <p>
              Asígnalo a un proyecto o déjalo como No adjudicado.
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
              <span>SKU *</span>
              <input
                value={input.sku}
                onChange={(event) => change("sku", event.target.value)}
                placeholder="MAT-001"
                aria-invalid={Boolean(errors.sku)}
              />
              {fieldError("sku")}
            </label>
            <label className="field">
              <span>Nombre *</span>
              <input
                value={input.name}
                onChange={(event) => change("name", event.target.value)}
                placeholder="Cemento gris"
                aria-invalid={Boolean(errors.name)}
              />
              {fieldError("name")}
            </label>
            <label className="field">
              <span>Unidad *</span>
              <input
                value={input.unit}
                onChange={(event) => change("unit", event.target.value)}
                placeholder="bulto, kg, m², pieza…"
                aria-invalid={Boolean(errors.unit)}
              />
              {fieldError("unit")}
            </label>
            <label className="field">
              <span>Proyecto</span>
              <select
                value={input.projectId ?? ""}
                onChange={(event) =>
                  change("projectId", event.target.value || null)
                }
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
            </label>
            <label className="field">
              <span>Existencia física</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={input.physicalStock}
                onChange={(event) =>
                  change("physicalStock", Number(event.target.value))
                }
                aria-invalid={Boolean(errors.physicalStock)}
              />
              {fieldError("physicalStock")}
            </label>
            <label className="field">
              <span>Reservado</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={input.reservedStock}
                onChange={(event) =>
                  change("reservedStock", Number(event.target.value))
                }
                aria-invalid={Boolean(errors.reservedStock)}
              />
              {fieldError("reservedStock")}
            </label>
            <label className="field">
              <span>Stock de seguridad</span>
              <input
                min="0"
                step="0.01"
                type="number"
                value={input.safetyStock}
                onChange={(event) =>
                  change("safetyStock", Number(event.target.value))
                }
                aria-invalid={Boolean(errors.safetyStock)}
              />
              {fieldError("safetyStock")}
            </label>
            <label className="field field-wide">
              <span>Descripción</span>
              <textarea
                value={input.description}
                onChange={(event) =>
                  change("description", event.target.value)
                }
                placeholder="Información útil para almacén y obra."
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
              {saving ? "Guardando…" : item ? "Guardar cambios" : "Agregar artículo"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
