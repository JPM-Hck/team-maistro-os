"use client";

import { useMemo, useState } from "react";
import { demoTools, initialInventory, marbleRecipe } from "@/domain/demo-data";
import {
  calculateRequirements,
  getAvailableStock,
  planTask,
  receivePurchase,
  type InventoryItem,
  type RequisitionStatus,
  type Requirement,
  type TaskStatus,
} from "@/domain/operations";

type DemoPhase = "unplanned" | "blocked" | "received" | "ready";

const navItems = [
  ["Resumen", "⌂"],
  ["Proyectos", "▦"],
  ["Tareas", "✓"],
  ["Inventario", "□"],
  ["Compras", "↗"],
  ["Equipo", "◇"],
  ["Nómina", "$"],
];

const statusLabels: Record<TaskStatus, string> = {
  draft: "Borrador",
  planned: "Planeada",
  blocked: "Bloqueada",
  ready: "Lista",
  in_progress: "En proceso",
  in_review: "En revisión",
  completed: "Terminada",
  cancelled: "Cancelada",
};

const eventCopy: Record<DemoPhase, string> = {
  unplanned: "La tarea está lista para validar su receta y disponibilidad.",
  blocked: "Se detectó un faltante y se generó una requisición automáticamente.",
  received: "La compra fue recibida. Falta confirmar la reserva transaccional.",
  ready: "Materiales reservados. La tarea puede iniciar sin comprometer el stock de seguridad.",
};

export function OperationsDashboard() {
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [phase, setPhase] = useState<DemoPhase>("unplanned");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("draft");
  const [requisitionStatus, setRequisitionStatus] = useState<RequisitionStatus | null>(null);
  const [requisitionLines, setRequisitionLines] = useState<
    Array<Pick<Requirement, "itemId" | "itemName" | "unit" | "shortage">>
  >([]);
  const [activity, setActivity] = useState<string[]>([
    "Proyecto Casa Lomas cargado con receta aprobada.",
  ]);

  const requirements = useMemo(
    () => calculateRequirements(20, marbleRecipe, inventory),
    [inventory],
  );
  const shortageCount = requirements.filter((item) => item.shortage > 0).length;
  const totalAvailable = inventory.reduce((sum, item) => sum + getAvailableStock(item), 0);

  function planningInput(currentInventory = inventory) {
    return {
      taskId: "task-marble-floor",
      quantity: 20,
      unit: "m²",
      recipeApproved: true,
      recipeLines: marbleRecipe,
      inventory: currentInventory,
      predecessorsComplete: true,
      tools: demoTools,
      workerHasConflict: false,
      idempotencyKey: "plan-task-marble-floor-v1",
    };
  }

  function handlePlan() {
    const result = planTask(planningInput());
    setTaskStatus(result.status);
    setRequisitionStatus(result.requisition?.status ?? null);
    setRequisitionLines(result.requisition?.lines ?? []);
    setPhase(result.status === "blocked" ? "blocked" : "ready");
    setActivity((items) => [
      result.status === "blocked"
        ? `Requisición RQ-024 creada por ${result.requisition?.lines.length ?? 0} faltante.`
        : "Todos los recursos están disponibles.",
      ...items,
    ]);
  }

  function handleReceive() {
    const reception = receivePurchase(
      inventory,
      requisitionLines.map((line) => ({ itemId: line.itemId, quantity: line.shortage })),
      requisitionLines,
    );
    setInventory(reception.inventory);
    setRequisitionStatus(reception.status);
    setPhase("received");
    setActivity((items) => [
      "Compra RQ-024 recibida y movimiento de entrada registrado.",
      ...items,
    ]);
  }

  function handleReserve() {
    const result = planTask(planningInput());
    setTaskStatus(result.status);
    setInventory(result.inventory);
    setPhase(result.status === "ready" ? "ready" : "blocked");
    setActivity((items) => [
      result.status === "ready"
        ? "Reserva confirmada. Tarea actualizada a Lista."
        : "La verificación encontró un bloqueo pendiente.",
      ...items,
    ]);
  }

  function resetDemo() {
    setInventory(initialInventory);
    setPhase("unplanned");
    setTaskStatus("draft");
    setRequisitionStatus(null);
    setRequisitionLines([]);
    setActivity(["Proyecto Casa Lomas cargado con receta aprobada."]);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div>
            <strong>MAISTRO</strong>
            <small>OPERATIONS SYSTEM</small>
          </div>
        </div>

        <nav aria-label="Navegación principal">
          <p className="nav-label">OPERACIÓN</p>
          {navItems.map(([label, icon], index) => (
            <button className={`nav-item ${index === 0 ? "active" : ""}`} key={label}>
              <span aria-hidden="true">{icon}</span>
              {label}
              {label === "Compras" && <b className="nav-count">1</b>}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span>CHECKPOINT 01</span>
          <strong>Tareas + inventario</strong>
          <div className="progress-track"><i /></div>
          <small>Flujo demostrable activo</small>
        </div>

        <div className="user-card">
          <span className="avatar">JP</span>
          <div>
            <strong>Juan Pablo</strong>
            <small>Administrador</small>
          </div>
          <button aria-label="Abrir opciones del usuario">•••</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="breadcrumb">OPERACIÓN / RESUMEN</p>
            <h1>Buenos días, Juan Pablo</h1>
            <p>Esto es lo que requiere atención hoy en Casa Lomas.</p>
          </div>
          <div className="topbar-actions">
            <span className="date-pill">25 JUL 2026</span>
            <button className="icon-button" aria-label="Notificaciones">◉<i /></button>
            <button className="primary-button" onClick={handlePlan} disabled={phase !== "unplanned"}>
              + Planear tarea
            </button>
          </div>
        </header>

        <section className="notice" aria-live="polite">
          <span className={`notice-icon phase-${phase}`}>{phase === "ready" ? "✓" : "!"}</span>
          <div>
            <strong>{phase === "ready" ? "Tarea lista para iniciar" : "Flujo de planeación controlado"}</strong>
            <p>{eventCopy[phase]}</p>
          </div>
          {phase !== "unplanned" && (
            <button className="text-button" onClick={resetDemo}>Reiniciar demo</button>
          )}
        </section>

        <section className="metrics" aria-label="Indicadores principales">
          <MetricCard label="Avance del proyecto" value="38%" trend="+6% esta semana" tone="ink" />
          <MetricCard
            label="Tareas bloqueadas"
            value={taskStatus === "blocked" ? "1" : "0"}
            trend={taskStatus === "blocked" ? "Requiere compra" : "Sin bloqueos"}
            tone={taskStatus === "blocked" ? "orange" : "green"}
          />
          <MetricCard
            label="Stock disponible"
            value={totalAvailable.toFixed(1)}
            trend={shortageCount ? `${shortageCount} faltante detectado` : "Recursos suficientes"}
            tone={shortageCount ? "orange" : "green"}
          />
          <MetricCard label="Presupuesto usado" value="42%" trend="$1.05 M de $2.5 M" tone="blue" />
        </section>

        <section className="workspace-grid">
          <article className="panel task-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">CASA LOMAS · PISO PLANTA BAJA</p>
                <h2>Colocación de mármol</h2>
              </div>
              <span className={`status status-${taskStatus}`}>{statusLabels[taskStatus]}</span>
            </div>

            <div className="task-meta">
              <span><b>20</b> m² planeados</span>
              <span><b>Rubén</b> responsable</span>
              <span><b>2</b> herramientas listas</span>
              <span><b>28–30 jul</b> ejecución</span>
            </div>

            <div className="resource-head">
              <div>
                <h3>Requerimientos calculados</h3>
                <p>Receta v2 · merma y stock de seguridad incluidos</p>
              </div>
              <span className="formula">cantidad × consumo × (1 + merma)</span>
            </div>

            <div className="resource-table" role="table" aria-label="Requerimientos de materiales">
              <div className="table-row table-header" role="row">
                <span>Material</span><span>Requerido</span><span>Disponible</span><span>Resultado</span>
              </div>
              {requirements.map((item) => (
                <div className="table-row" role="row" key={item.itemId}>
                  <span className="material-name">
                    <i>{item.itemName.slice(0, 1)}</i>
                    <span><b>{item.itemName}</b><small>{item.unit}</small></span>
                  </span>
                  <span>{item.required.toFixed(2)} {item.unit}</span>
                  <span>{item.available.toFixed(2)} {item.unit}</span>
                  <span>
                    <b className={`availability ${item.shortage > 0 ? "missing" : "enough"}`}>
                      {item.shortage > 0 ? `Faltan ${item.shortage.toFixed(2)}` : "Suficiente"}
                    </b>
                  </span>
                </div>
              ))}
            </div>

            <div className="flow-actions">
              <FlowStep number="1" label="Verificar" detail="Receta y stock" state={phase !== "unplanned" ? "done" : "current"} />
              <i />
              <FlowStep
                number="2"
                label="Comprar"
                detail="Resolver faltante"
                state={phase === "blocked" ? "current" : phase === "received" || phase === "ready" ? "done" : ""}
              />
              <i />
              <FlowStep
                number="3"
                label="Reservar"
                detail="Transacción segura"
                state={phase === "received" ? "current" : phase === "ready" ? "done" : ""}
              />
            </div>

            <div className="button-row">
              {phase === "unplanned" && <button className="primary-button" onClick={handlePlan}>Ejecutar planeación</button>}
              {phase === "blocked" && <button className="warning-button" onClick={handleReceive}>Recibir compra RQ-024</button>}
              {phase === "received" && <button className="primary-button" onClick={handleReserve}>Reservar materiales</button>}
              {phase === "ready" && <span className="success-message">✓ Reserva auditada y tarea lista</span>}
            </div>
          </article>

          <aside className="right-column">
            <article className="panel project-card">
              <div className="panel-head compact">
                <div><p className="eyebrow">PROYECTO ACTIVO</p><h2>Casa Lomas</h2></div>
                <button aria-label="Opciones del proyecto">•••</button>
              </div>
              <p className="muted">Remodelación integral · CDMX</p>
              <div className="project-progress">
                <div><span>Avance físico</span><b>38%</b></div>
                <div className="progress-track"><i style={{ width: "38%" }} /></div>
              </div>
              <dl>
                <div><dt>Presupuesto</dt><dd>$2,500,000</dd></div>
                <div><dt>Responsable</dt><dd>Alejandro S.</dd></div>
                <div><dt>Fecha objetivo</dt><dd>18 sep 2026</dd></div>
              </dl>
            </article>

            <article className={`panel requisition-card ${requisitionStatus ? "visible" : ""}`}>
              <div className="requisition-title">
                <span>↗</span>
                <div><small>REQUISICIÓN AUTOMÁTICA</small><h3>RQ-024</h3></div>
                <b>{requisitionStatus ? requisitionStatus.replace("_", " ") : "esperando"}</b>
              </div>
              {requisitionLines.length > 0 ? requisitionLines.map((line) => (
                <div className="requisition-line" key={line.itemId}>
                  <span>{line.itemName}</span>
                  <b>{line.shortage.toFixed(2)} {line.unit}</b>
                </div>
              )) : <p className="muted">Se creará cuando un material no alcance.</p>}
            </article>

            <article className="panel activity-card">
              <div className="panel-head compact"><h2>Actividad reciente</h2><span className="live-dot">EN VIVO</span></div>
              <ol>
                {activity.slice(0, 4).map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <i className={index === 0 ? "latest" : ""} />
                    <div><p>{item}</p><small>{index === 0 ? "Ahora" : "Hace 12 min"}</small></div>
                  </li>
                ))}
              </ol>
            </article>
          </aside>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  label, value, trend, tone,
}: {
  label: string;
  value: string;
  trend: string;
  tone: "ink" | "green" | "orange" | "blue";
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div><p>{label}</p><strong>{value}</strong></div>
      <span>{trend}</span>
    </article>
  );
}

function FlowStep({
  number, label, detail, state,
}: {
  number: string;
  label: string;
  detail: string;
  state: "" | "current" | "done";
}) {
  return (
    <div className={`flow-step ${state}`}>
      <span>{number}</span>
      <p><b>{label}</b><small>{detail}</small></p>
    </div>
  );
}
