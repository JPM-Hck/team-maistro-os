"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  calculateWorkerPay,
  getWorkedDays,
} from "@/domain/payroll/payroll-calculation";
import {
  isPayrollWorkerValid,
  validatePayrollWorker,
} from "@/domain/payroll/payroll-validation";
import {
  SALARY_TYPE_LABELS,
  SALARY_TYPES,
  type PayrollWorker,
  type PayrollWorkerInput,
  type SalaryType,
  toPayrollWorkerInput,
} from "@/domain/payroll/types";
import type { Project } from "@/domain/projects/types";

const emptyInput: PayrollWorkerInput = {
  employeeCode: "",
  name: "",
  position: "",
  projectId: null,
  salaryType: "daily",
  salaryAmount: 0,
  scheduledDays: 6,
  absenceDays: 0,
  notes: "",
  status: "active",
};

export function PayrollWorkerForm({
  worker,
  workers,
  projects,
  saving,
  onCancel,
  onSave,
}: {
  worker: PayrollWorker | null;
  workers: PayrollWorker[];
  projects: Project[];
  saving: boolean;
  onCancel(): void;
  onSave(input: PayrollWorkerInput): Promise<boolean>;
}) {
  const [input, setInput] = useState<PayrollWorkerInput>(
    worker ? toPayrollWorkerInput(worker) : emptyInput,
  );
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(
    () => validatePayrollWorker(input, workers, worker?.id),
    [input, worker?.id, workers],
  );
  const valid = isPayrollWorkerValid(errors);
  const workedDays = getWorkedDays(input);
  const payment = calculateWorkerPay(input);

  function change<K extends keyof PayrollWorkerInput>(
    field: K,
    value: PayrollWorkerInput[K],
  ) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!valid || saving) return;
    if (await onSave(input)) onCancel();
  }

  const fieldError = (field: keyof PayrollWorkerInput) =>
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
        className="planner-modal payroll-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-form-title"
      >
        <div className="planner-head">
          <div>
            <p className="eyebrow">NÓMINA SEMANAL</p>
            <h2 id="payroll-form-title">
              {worker ? "Editar persona" : "Agregar persona"}
            </h2>
            <p>
              El pago se calcula automáticamente según sueldo y asistencia.
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
              <span>Número de empleado *</span>
              <input
                value={input.employeeCode}
                onChange={(event) =>
                  change("employeeCode", event.target.value)
                }
                placeholder="EMP-001"
                aria-invalid={Boolean(errors.employeeCode)}
              />
              {fieldError("employeeCode")}
            </label>
            <label className="field">
              <span>Nombre completo *</span>
              <input
                value={input.name}
                onChange={(event) => change("name", event.target.value)}
                placeholder="Nombre del trabajador"
                aria-invalid={Boolean(errors.name)}
              />
              {fieldError("name")}
            </label>
            <label className="field">
              <span>Puesto *</span>
              <input
                value={input.position}
                onChange={(event) => change("position", event.target.value)}
                placeholder="Ayudante, oficial, supervisor…"
                aria-invalid={Boolean(errors.position)}
              />
              {fieldError("position")}
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
              <span>Tipo de sueldo</span>
              <select
                value={input.salaryType}
                onChange={(event) =>
                  change("salaryType", event.target.value as SalaryType)
                }
              >
                {SALARY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {SALARY_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                {input.salaryType === "daily"
                  ? "Sueldo por día *"
                  : "Sueldo semanal *"}
              </span>
              <div className="input-with-unit">
                <b>$</b>
                <input
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={input.salaryAmount}
                  onChange={(event) =>
                    change("salaryAmount", Number(event.target.value))
                  }
                  aria-invalid={Boolean(errors.salaryAmount)}
                />
              </div>
              {fieldError("salaryAmount")}
            </label>
            <label className="field">
              <span>Días programados *</span>
              <input
                min="1"
                max="7"
                step="1"
                type="number"
                value={input.scheduledDays}
                onChange={(event) =>
                  change("scheduledDays", Number(event.target.value))
                }
                aria-invalid={Boolean(errors.scheduledDays)}
              />
              {fieldError("scheduledDays")}
            </label>
            <label className="field">
              <span>Días faltados *</span>
              <input
                min="0"
                max={input.scheduledDays}
                step="1"
                type="number"
                value={input.absenceDays}
                onChange={(event) =>
                  change("absenceDays", Number(event.target.value))
                }
                aria-invalid={Boolean(errors.absenceDays)}
              />
              {fieldError("absenceDays")}
            </label>
            <label className="field field-wide">
              <span>Notas</span>
              <textarea
                value={input.notes}
                onChange={(event) => change("notes", event.target.value)}
                placeholder="Observaciones de asistencia o pago."
              />
            </label>
          </div>

          <section className="payroll-preview" aria-live="polite">
            <div>
              <span>Días trabajados</span>
              <strong>{workedDays} de {input.scheduledDays || 0}</strong>
            </div>
            <div>
              <span>Faltas</span>
              <strong>{input.absenceDays || 0}</strong>
            </div>
            <div className="payroll-preview-total">
              <span>Pago calculado</span>
              <strong>{formatMoney(payment)}</strong>
            </div>
          </section>

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
              {saving ? "Guardando…" : worker ? "Guardar cambios" : "Agregar persona"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}
