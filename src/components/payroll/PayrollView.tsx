"use client";

import { useMemo, useState } from "react";
import {
  calculateWorkerPay,
  getWorkedDays,
} from "@/domain/payroll/payroll-calculation";
import {
  SALARY_TYPE_LABELS,
  type PayrollWorker,
} from "@/domain/payroll/types";
import type { Project } from "@/domain/projects/types";
import { PayrollArchiveDialog } from "./PayrollArchiveDialog";
import { PayrollWorkerForm } from "./PayrollWorkerForm";
import type { PayrollController } from "./usePayroll";

type Dialog =
  | { type: "create" }
  | { type: "edit"; worker: PayrollWorker }
  | { type: "archive"; worker: PayrollWorker }
  | null;

export function PayrollView({
  controller,
  projects,
}: {
  controller: PayrollController;
  projects: Project[];
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

  const activeMetrics = useMemo(() => {
    const scheduledDays = controller.activeWorkers.reduce(
      (total, worker) => total + worker.scheduledDays,
      0,
    );
    const workedDays = controller.activeWorkers.reduce(
      (total, worker) => total + getWorkedDays(worker),
      0,
    );
    return {
      scheduledDays,
      workedDays,
      absenceDays: scheduledDays - workedDays,
      attendance:
        scheduledDays > 0 ? Math.round((workedDays / scheduledDays) * 100) : 0,
      totalPay: controller.activeWorkers.reduce(
        (total, worker) => total + calculateWorkerPay(worker),
        0,
      ),
    };
  }, [controller.activeWorkers]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es-MX");
    return controller.workers.filter((worker) => {
      const project = worker.projectId
        ? projectById.get(worker.projectId)?.name ?? ""
        : "no adjudicado";
      const matchesStatus = worker.status === statusFilter;
      const matchesProject =
        projectFilter === "all" ||
        (projectFilter === "unassigned"
          ? worker.projectId === null
          : worker.projectId === projectFilter);
      const matchesQuery =
        !term ||
        [
          worker.name,
          worker.employeeCode,
          worker.position,
          project,
        ].some((value) => value.toLocaleLowerCase("es-MX").includes(term));
      return matchesStatus && matchesProject && matchesQuery;
    });
  }, [
    controller.workers,
    projectById,
    projectFilter,
    query,
    statusFilter,
  ]);

  if (controller.loading) {
    return (
      <section className="panel project-loading">
        <span className="project-spinner" />
        <h2>Cargando nómina</h2>
        <p>Recuperando personal, asistencia y sueldos.</p>
      </section>
    );
  }

  const projectName = (worker: PayrollWorker) =>
    worker.projectId
      ? projectById.get(worker.projectId)?.name ?? "Proyecto no disponible"
      : "No adjudicado";

  return (
    <section className="payroll-workspace">
      <section className="metrics payroll-summary">
        <PayrollMetric
          label="Personal activo"
          value={String(controller.activeWorkers.length)}
          detail="Personas en nómina"
          tone="ink"
        />
        <PayrollMetric
          label="Asistencia semanal"
          value={`${activeMetrics.attendance}%`}
          detail={`${activeMetrics.workedDays} de ${activeMetrics.scheduledDays} días`}
          tone="green"
        />
        <PayrollMetric
          label="Faltas registradas"
          value={String(activeMetrics.absenceDays)}
          detail="Días no trabajados"
          tone={activeMetrics.absenceDays > 0 ? "orange" : "green"}
        />
        <PayrollMetric
          label="Nómina calculada"
          value={formatMoney(activeMetrics.totalPay)}
          detail="Pago semanal estimado"
          tone="blue"
        />
      </section>

      <article className="panel payroll-toolbar">
        <div>
          <p className="eyebrow">SEMANA ACTUAL</p>
          <h2>Personal y pagos</h2>
          <small>Pago proporcional según sueldo y días trabajados</small>
        </div>
        <label className="project-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, número, puesto o proyecto"
          />
        </label>
        <button
          className="primary-button"
          onClick={() => setDialog({ type: "create" })}
          type="button"
        >
          + Agregar persona
        </button>
        <div className="payroll-filters">
          <select
            aria-label="Filtrar nómina por proyecto"
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
          <span>$</span>
          <h2>No hay personas para mostrar</h2>
          <p>Ajusta los filtros o agrega la primera persona a la nómina.</p>
          {statusFilter === "active" && (
            <button
              className="primary-button"
              onClick={() => setDialog({ type: "create" })}
              type="button"
            >
              Agregar persona
            </button>
          )}
        </article>
      ) : (
        <div className="payroll-card-grid">
          {filtered.map((worker) => {
            const workedDays = getWorkedDays(worker);
            const payment = calculateWorkerPay(worker);
            return (
              <article
                className={`panel payroll-record ${
                  worker.status === "archived" ? "payroll-record-archived" : ""
                }`}
                key={worker.id}
              >
                <div className="payroll-record-head">
                  <span className="payroll-avatar">
                    {initials(worker.name)}
                  </span>
                  <div>
                    <small>{worker.employeeCode}</small>
                    <h3>{worker.name}</h3>
                    <p>{worker.position}</p>
                  </div>
                  <span
                    className={`payroll-project ${
                      worker.projectId ? "" : "unassigned"
                    }`}
                  >
                    {projectName(worker)}
                  </span>
                </div>
                <div className="payroll-payment">
                  <span>Pago de la semana</span>
                  <strong>{formatMoney(payment)}</strong>
                  <small>
                    {SALARY_TYPE_LABELS[worker.salaryType]}:{" "}
                    {formatMoney(worker.salaryAmount)}
                  </small>
                </div>
                <dl className="payroll-days">
                  <div>
                    <dt>Programados</dt>
                    <dd>{worker.scheduledDays}</dd>
                  </div>
                  <div>
                    <dt>Faltas</dt>
                    <dd className={worker.absenceDays > 0 ? "has-absence" : ""}>
                      {worker.absenceDays}
                    </dd>
                  </div>
                  <div>
                    <dt>Trabajados</dt>
                    <dd>{workedDays}</dd>
                  </div>
                </dl>
                {worker.notes && <p className="payroll-notes">{worker.notes}</p>}
                <div className="project-card-actions">
                  {worker.status === "active" ? (
                    <>
                      <button
                        onClick={() => setDialog({ type: "edit", worker })}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="danger-link"
                        onClick={() => setDialog({ type: "archive", worker })}
                        type="button"
                      >
                        Quitar
                      </button>
                    </>
                  ) : (
                    <span className="muted">Persona archivada</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {(dialog?.type === "create" || dialog?.type === "edit") && (
        <PayrollWorkerForm
          worker={dialog.type === "edit" ? dialog.worker : null}
          workers={controller.workers}
          projects={projects}
          saving={controller.saving}
          onCancel={() => setDialog(null)}
          onSave={(input) =>
            dialog.type === "edit"
              ? controller.updateWorker(dialog.worker.id, input)
              : controller.createWorker(input)
          }
        />
      )}
      {dialog?.type === "archive" && (
        <PayrollArchiveDialog
          worker={dialog.worker}
          saving={controller.saving}
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            if (await controller.archiveWorker(dialog.worker.id)) {
              setDialog(null);
            }
          }}
        />
      )}
    </section>
  );
}

function PayrollMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "ink" | "green" | "orange" | "blue";
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
      <span>{detail}</span>
    </article>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("")
    .toUpperCase();
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}
