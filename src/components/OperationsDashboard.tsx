"use client";

import { FormEvent, useMemo, useState } from "react";
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
type SectionId =
  | "summary"
  | "projects"
  | "tasks"
  | "inventory"
  | "purchases"
  | "equipment"
  | "payroll";

type PlannedTask = {
  id: string;
  name: string;
  project: string;
  quantity: number;
  unit: string;
  responsible: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
};

const navItems: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: "summary", label: "Resumen", icon: "⌂" },
  { id: "projects", label: "Proyectos", icon: "▦" },
  { id: "tasks", label: "Tareas", icon: "✓" },
  { id: "inventory", label: "Inventario", icon: "□" },
  { id: "purchases", label: "Compras", icon: "↗" },
  { id: "equipment", label: "Equipo", icon: "◇" },
  { id: "payroll", label: "Nómina", icon: "$" },
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
  unplanned: "Abre el panel para definir cantidad, responsable y fechas.",
  blocked: "Se detectó un faltante y se generó una requisición automáticamente.",
  received: "La compra fue recibida. Falta confirmar la reserva transaccional.",
  ready: "Materiales reservados. La tarea puede iniciar sin comprometer el stock de seguridad.",
};

const initialTask: PlannedTask = {
  id: "task-marble-floor",
  name: "Colocación de mármol",
  project: "Casa Lomas",
  quantity: 20,
  unit: "m²",
  responsible: "Rubén",
  startDate: "2026-07-28",
  endDate: "2026-07-30",
  status: "draft",
};

export function OperationsDashboard() {
  const [section, setSection] = useState<SectionId>("summary");
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [phase, setPhase] = useState<DemoPhase>("unplanned");
  const [task, setTask] = useState<PlannedTask>(initialTask);
  const [requisitionStatus, setRequisitionStatus] = useState<RequisitionStatus | null>(null);
  const [requisitionLines, setRequisitionLines] = useState<
    Array<Pick<Requirement, "itemId" | "itemName" | "unit" | "shortage">>
  >([]);
  const [activity, setActivity] = useState<string[]>([
    "Proyecto Casa Lomas cargado con receta aprobada.",
  ]);

  const calculatedRequirements = useMemo(
    () => calculateRequirements(task.quantity, marbleRecipe, inventory),
    [inventory, task.quantity],
  );
  const requirements = useMemo(
    () => phase === "ready"
      ? calculatedRequirements.map((item) => ({
          ...item,
          available: item.required,
          shortage: 0,
        }))
      : calculatedRequirements,
    [calculatedRequirements, phase],
  );
  const shortageCount = requirements.filter((item) => item.shortage > 0).length;
  const totalAvailable = inventory.reduce((sum, item) => sum + getAvailableStock(item), 0);
  const hasOpenRequisition = requisitionStatus !== null
    && ["pending", "approved", "ordered", "partially_received"].includes(requisitionStatus);

  function planningInput(currentInventory = inventory, currentTask = task) {
    return {
      taskId: currentTask.id,
      quantity: currentTask.quantity,
      unit: currentTask.unit,
      recipeApproved: true,
      recipeLines: marbleRecipe,
      inventory: currentInventory,
      predecessorsComplete: true,
      tools: demoTools,
      workerHasConflict: false,
      idempotencyKey: `plan-${currentTask.id}-v1`,
    };
  }

  function applyPlanning(currentTask: PlannedTask) {
    const result = planTask(planningInput(inventory, currentTask));
    const nextPhase = result.status === "blocked" ? "blocked" : "ready";
    setTask({ ...currentTask, status: result.status });
    setRequisitionStatus(result.requisition?.status ?? null);
    setRequisitionLines(result.requisition?.lines ?? []);
    setPhase(nextPhase);
    if (result.status === "ready") setInventory(result.inventory);
    setActivity((items) => [
      result.status === "blocked"
        ? `Requisición RQ-024 creada por ${result.requisition?.lines.length ?? 0} faltante.`
        : `Tarea “${currentTask.name}” planeada y reservada.`,
      ...items,
    ]);
  }

  function handlePlannerSubmit(nextTask: PlannedTask) {
    setPlannerOpen(false);
    applyPlanning(nextTask);
    setSection("tasks");
  }

  function handleReceive() {
    if (requisitionLines.length === 0) return;
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
    setTask((current) => ({ ...current, status: result.status }));
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
    setTask(initialTask);
    setRequisitionStatus(null);
    setRequisitionLines([]);
    setActivity(["Proyecto Casa Lomas cargado con receta aprobada."]);
  }

  const pageCopy: Record<SectionId, { eyebrow: string; title: string; subtitle: string }> = {
    summary: {
      eyebrow: "OPERACIÓN / RESUMEN",
      title: "Buenos días, Juan Pablo",
      subtitle: "Esto es lo que requiere atención hoy en Casa Lomas.",
    },
    projects: {
      eyebrow: "OPERACIÓN / PROYECTOS",
      title: "Proyectos",
      subtitle: "Consulta el avance, presupuesto y responsables de cada obra.",
    },
    tasks: {
      eyebrow: "OPERACIÓN / TAREAS",
      title: "Planeación de tareas",
      subtitle: "Valida cantidades, recursos y fechas antes de liberar la ejecución.",
    },
    inventory: {
      eyebrow: "OPERACIÓN / INVENTARIO",
      title: "Inventario",
      subtitle: "Existencias, reservas y stock de seguridad en una sola vista.",
    },
    purchases: {
      eyebrow: "OPERACIÓN / COMPRAS",
      title: "Compras y requisiciones",
      subtitle: "Atiende faltantes y registra recepciones parciales o completas.",
    },
    equipment: {
      eyebrow: "OPERACIÓN / EQUIPO",
      title: "Herramientas y equipo",
      subtitle: "Disponibilidad operativa para la planeación de obra.",
    },
    payroll: {
      eyebrow: "ADMINISTRACIÓN / NÓMINA",
      title: "Nómina semanal",
      subtitle: "Vista preparada para asistencia, incidencias y pagos.",
    },
  };

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
          {navItems.map((item) => (
            <button
              className={`nav-item ${section === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.id === "purchases" && hasOpenRequisition && <b className="nav-count">1</b>}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span>CHECKPOINT 01</span>
          <strong>Tareas + inventario</strong>
          <div className="progress-track"><i /></div>
          <small>Navegación y planeación activas</small>
        </div>

        <div className="user-card">
          <span className="avatar">JP</span>
          <div>
            <strong>Juan Pablo</strong>
            <small>Administrador</small>
          </div>
          <button aria-label="Abrir opciones del usuario" type="button">•••</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="breadcrumb">{pageCopy[section].eyebrow}</p>
            <h1>{pageCopy[section].title}</h1>
            <p>{pageCopy[section].subtitle}</p>
          </div>
          <div className="topbar-actions">
            <span className="date-pill">25 JUL 2026</span>
            <button className="icon-button" aria-label="Notificaciones" type="button">◉<i /></button>
            <button className="primary-button" onClick={() => setPlannerOpen(true)} type="button">
              + Planear tarea
            </button>
          </div>
        </header>

        {section === "summary" && (
          <SummaryView
            activity={activity}
            handleReceive={handleReceive}
            handleReserve={handleReserve}
            inventory={inventory}
            phase={phase}
            requisitionLines={requisitionLines}
            requisitionStatus={requisitionStatus}
            requirements={requirements}
            resetDemo={resetDemo}
            shortageCount={shortageCount}
            task={task}
            totalAvailable={totalAvailable}
          />
        )}
        {section === "tasks" && (
          <TasksView
            onOpenPlanner={() => setPlannerOpen(true)}
            onReceive={handleReceive}
            onReserve={handleReserve}
            phase={phase}
            requirements={requirements}
            task={task}
          />
        )}
        {section === "inventory" && <InventoryView inventory={inventory} requirements={requirements} />}
        {section === "purchases" && (
          <PurchasesView
            lines={requisitionLines}
            onReceive={handleReceive}
            phase={phase}
            status={requisitionStatus}
          />
        )}
        {section === "projects" && <ProjectsView task={task} />}
        {section === "equipment" && <EquipmentView />}
        {section === "payroll" && <PayrollView />}
      </main>

      {plannerOpen && (
        <TaskPlanner
          inventory={inventory}
          initialTask={task}
          onClose={() => setPlannerOpen(false)}
          onSubmit={handlePlannerSubmit}
        />
      )}
    </div>
  );
}

function SummaryView({
  activity,
  handleReceive,
  handleReserve,
  inventory,
  phase,
  requisitionLines,
  requisitionStatus,
  requirements,
  resetDemo,
  shortageCount,
  task,
  totalAvailable,
}: {
  activity: string[];
  handleReceive: () => void;
  handleReserve: () => void;
  inventory: InventoryItem[];
  phase: DemoPhase;
  requisitionLines: Array<Pick<Requirement, "itemId" | "itemName" | "unit" | "shortage">>;
  requisitionStatus: RequisitionStatus | null;
  requirements: Requirement[];
  resetDemo: () => void;
  shortageCount: number;
  task: PlannedTask;
  totalAvailable: number;
}) {
  return (
    <>
      <section className="notice" aria-live="polite">
        <span className={`notice-icon phase-${phase}`}>{phase === "ready" ? "✓" : "!"}</span>
        <div>
          <strong>{phase === "ready" ? "Tarea lista para iniciar" : "Flujo de planeación controlado"}</strong>
          <p>{eventCopy[phase]}</p>
        </div>
        {phase !== "unplanned" && (
          <button className="text-button" onClick={resetDemo} type="button">Reiniciar demo</button>
        )}
      </section>

      <section className="metrics" aria-label="Indicadores principales">
        <MetricCard label="Avance del proyecto" value="38%" trend="+6% esta semana" tone="ink" />
        <MetricCard
          label="Tareas bloqueadas"
          value={task.status === "blocked" ? "1" : "0"}
          trend={task.status === "blocked" ? "Requiere compra" : "Sin bloqueos"}
          tone={task.status === "blocked" ? "orange" : "green"}
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
        <TaskDetail
          handleReceive={handleReceive}
          handleReserve={handleReserve}
          phase={phase}
          requirements={requirements}
          task={task}
        />
        <aside className="right-column">
          <ProjectCard />
          <RequisitionCard lines={requisitionLines} status={requisitionStatus} />
          <ActivityCard activity={activity} />
        </aside>
      </section>
      <span className="sr-only">{inventory.length} artículos en inventario</span>
    </>
  );
}

function TasksView({
  onOpenPlanner,
  onReceive,
  onReserve,
  phase,
  requirements,
  task,
}: {
  onOpenPlanner: () => void;
  onReceive: () => void;
  onReserve: () => void;
  phase: DemoPhase;
  requirements: Requirement[];
  task: PlannedTask;
}) {
  return (
    <section className="section-grid">
      <article className="panel section-card task-list-card">
        <div className="section-card-head">
          <div>
            <p className="eyebrow">PROGRAMA DE OBRA</p>
            <h2>Tareas activas</h2>
          </div>
          <button className="primary-button" onClick={onOpenPlanner} type="button">Nueva tarea</button>
        </div>
        <button className="task-list-item selected" type="button">
          <span className={`task-dot status-${task.status}`} />
          <span>
            <b>{task.name}</b>
            <small>{task.project} · {task.quantity} {task.unit}</small>
          </span>
          <span className={`status status-${task.status}`}>{statusLabels[task.status]}</span>
        </button>
        <button className="task-list-item" type="button">
          <span className="task-dot status-planned" />
          <span>
            <b>Sellado de juntas</b>
            <small>Casa Lomas · 20 m²</small>
          </span>
          <span className="status">Borrador</span>
        </button>
      </article>

      <TaskDetail
        handleReceive={onReceive}
        handleReserve={onReserve}
        phase={phase}
        requirements={requirements}
        task={task}
      />
    </section>
  );
}

function TaskDetail({
  handleReceive,
  handleReserve,
  phase,
  requirements,
  task,
}: {
  handleReceive: () => void;
  handleReserve: () => void;
  phase: DemoPhase;
  requirements: Requirement[];
  task: PlannedTask;
}) {
  return (
    <article className="panel task-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{task.project.toUpperCase()} · PISO PLANTA BAJA</p>
          <h2>{task.name}</h2>
        </div>
        <span className={`status status-${task.status}`}>{statusLabels[task.status]}</span>
      </div>

      <div className="task-meta">
        <span><b>{task.quantity}</b> {task.unit} planeados</span>
        <span><b>{task.responsible}</b> responsable</span>
        <span><b>2</b> herramientas listas</span>
        <span><b>{formatDateRange(task.startDate, task.endDate)}</b> ejecución</span>
      </div>

      <div className="resource-head">
        <div>
          <h3>Requerimientos calculados</h3>
          <p>Receta v2 · merma y stock de seguridad incluidos</p>
        </div>
        <span className="formula">cantidad × consumo × (1 + merma)</span>
      </div>

      <RequirementsTable requirements={requirements} />

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
        {phase === "unplanned" && <span className="muted">Usa “+ Planear tarea” para validar este borrador.</span>}
        {phase === "blocked" && <button className="warning-button" onClick={handleReceive} type="button">Recibir compra RQ-024</button>}
        {phase === "received" && <button className="primary-button" onClick={handleReserve} type="button">Reservar materiales</button>}
        {phase === "ready" && <span className="success-message">✓ Reserva auditada y tarea lista</span>}
      </div>
    </article>
  );
}

function TaskPlanner({
  initialTask,
  inventory,
  onClose,
  onSubmit,
}: {
  initialTask: PlannedTask;
  inventory: InventoryItem[];
  onClose: () => void;
  onSubmit: (task: PlannedTask) => void;
}) {
  const [name, setName] = useState(initialTask.name);
  const [quantity, setQuantity] = useState(initialTask.quantity);
  const [responsible, setResponsible] = useState(initialTask.responsible);
  const [startDate, setStartDate] = useState(initialTask.startDate);
  const [endDate, setEndDate] = useState(initialTask.endDate);
  const validQuantity = Number.isFinite(quantity) && quantity > 0;
  const preview = useMemo(
    () => (validQuantity ? calculateRequirements(quantity, marbleRecipe, inventory) : []),
    [inventory, quantity, validQuantity],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validQuantity || !name.trim() || !responsible.trim()) return;
    onSubmit({
      ...initialTask,
      id: initialTask.id,
      name: name.trim(),
      quantity,
      responsible: responsible.trim(),
      startDate,
      endDate,
      status: "planned",
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="planner-modal" role="dialog" aria-modal="true" aria-labelledby="planner-title">
        <div className="planner-head">
          <div>
            <p className="eyebrow">NUEVA PLANEACIÓN</p>
            <h2 id="planner-title">Planear tarea</h2>
            <p>Los materiales se calculan antes de guardar.</p>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Cerrar panel" type="button">×</button>
        </div>

        <form className="planner-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field field-wide">
              <span>Nombre de la tarea</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="field">
              <span>Proyecto</span>
              <select defaultValue="Casa Lomas">
                <option>Casa Lomas</option>
              </select>
            </label>
            <label className="field">
              <span>Receta</span>
              <select defaultValue="marble">
                <option value="marble">Colocación de mármol · v2</option>
              </select>
            </label>
            <label className="field">
              <span>Cantidad</span>
              <div className="input-with-unit">
                <input
                  min="0.01"
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  required
                  step="0.01"
                  type="number"
                  value={quantity}
                />
                <b>m²</b>
              </div>
            </label>
            <label className="field">
              <span>Responsable</span>
              <select value={responsible} onChange={(event) => setResponsible(event.target.value)}>
                <option>Rubén</option>
                <option>María</option>
                <option>Alejandro</option>
              </select>
            </label>
            <label className="field">
              <span>Inicio</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
            </label>
            <label className="field">
              <span>Fin</span>
              <input min={startDate} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
            </label>
          </div>

          <div className="planner-preview">
            <div className="resource-head">
              <div>
                <h3>Vista previa de materiales</h3>
                <p>Disponible = existencia − reservas − stock de seguridad</p>
              </div>
              <span className={`preview-badge ${preview.some((line) => line.shortage > 0) ? "has-shortage" : ""}`}>
                {preview.some((line) => line.shortage > 0) ? "Generará requisición" : "Stock suficiente"}
              </span>
            </div>
            {validQuantity ? (
              <RequirementsTable requirements={preview} compact />
            ) : (
              <p className="form-error">La cantidad debe ser mayor que cero.</p>
            )}
          </div>

          <div className="planner-actions">
            <button className="secondary-button" onClick={onClose} type="button">Cancelar</button>
            <button className="primary-button" disabled={!validQuantity} type="submit">Guardar y planear</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function InventoryView({ inventory, requirements }: { inventory: InventoryItem[]; requirements: Requirement[] }) {
  return (
    <section className="panel section-card">
      <div className="section-card-head">
        <div><p className="eyebrow">ALMACÉN CENTRAL</p><h2>Existencias actuales</h2></div>
        <span className="data-chip">{inventory.length} artículos</span>
      </div>
      <div className="inventory-table">
        <div className="inventory-row inventory-header">
          <span>Artículo</span><span>Existencia</span><span>Reservado</span><span>Seguridad</span><span>Disponible</span>
        </div>
        {inventory.map((item) => {
          const requirement = requirements.find((line) => line.itemId === item.id);
          return (
            <div className="inventory-row" key={item.id}>
              <span><b>{item.name}</b><small>{item.unit}</small></span>
              <span>{item.physicalStock.toFixed(2)}</span>
              <span>{item.reservedStock.toFixed(2)}</span>
              <span>{item.safetyStock.toFixed(2)}</span>
              <span>
                <b>{getAvailableStock(item).toFixed(2)} {item.unit}</b>
                {requirement && requirement.shortage > 0 && <small className="shortage-text">Faltan {requirement.shortage.toFixed(2)}</small>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PurchasesView({
  lines,
  onReceive,
  phase,
  status,
}: {
  lines: Array<Pick<Requirement, "itemId" | "itemName" | "unit" | "shortage">>;
  onReceive: () => void;
  phase: DemoPhase;
  status: RequisitionStatus | null;
}) {
  return (
    <section className="panel section-card">
      <div className="section-card-head">
        <div><p className="eyebrow">REQUISICIONES</p><h2>Compras pendientes</h2></div>
        <span className="data-chip">{status ? "1 requisición" : "Sin pendientes"}</span>
      </div>
      {status ? (
        <div className="purchase-card">
          <div>
            <span className="requisition-icon">↗</span>
            <div>
              <b>RQ-024 · Casa Lomas</b>
              <small>Generada automáticamente por faltante de materiales</small>
            </div>
          </div>
          <span className="status status-blocked">{status.replace("_", " ")}</span>
          <ul>
            {lines.map((line) => <li key={line.itemId}><span>{line.itemName}</span><b>{line.shortage.toFixed(2)} {line.unit}</b></li>)}
          </ul>
          {phase === "blocked" && <button className="warning-button" onClick={onReceive} type="button">Registrar recepción completa</button>}
          {phase !== "blocked" && <span className="success-message">✓ Recepción registrada</span>}
        </div>
      ) : (
        <EmptyState title="No hay requisiciones abiertas" detail="Al planear una tarea con faltantes aparecerá aquí automáticamente." />
      )}
    </section>
  );
}

function ProjectsView({ task }: { task: PlannedTask }) {
  return (
    <section className="project-board">
      <article className="panel project-tile">
        <div className="project-tile-cover"><span>CL</span><b>En ejecución</b></div>
        <div className="project-tile-body">
          <p className="eyebrow">REMODELACIÓN INTEGRAL</p>
          <h2>Casa Lomas</h2>
          <p>CDMX · Alejandro S.</p>
          <div className="project-progress">
            <div><span>Avance físico</span><b>38%</b></div>
            <div className="progress-track"><i style={{ width: "38%" }} /></div>
          </div>
          <dl>
            <div><dt>Tarea actual</dt><dd>{task.name}</dd></div>
            <div><dt>Fecha objetivo</dt><dd>18 sep 2026</dd></div>
            <div><dt>Presupuesto</dt><dd>$2,500,000</dd></div>
          </dl>
        </div>
      </article>
      <button className="panel add-project-tile" type="button">
        <span>+</span><b>Nuevo proyecto</b><small>Preparado para el siguiente checkpoint</small>
      </button>
    </section>
  );
}

function EquipmentView() {
  const equipment = [
    ["Cortadora de piso", "CT-014", "Disponible", "green"],
    ["Nivel láser", "NL-008", "Disponible", "green"],
    ["Rotomartillo", "RT-021", "Mantenimiento", "orange"],
  ];
  return (
    <section className="panel section-card">
      <div className="section-card-head">
        <div><p className="eyebrow">CONTROL DE ACTIVOS</p><h2>Equipo registrado</h2></div>
        <span className="data-chip">2 disponibles</span>
      </div>
      <div className="equipment-grid">
        {equipment.map(([name, code, status, tone]) => (
          <article className="equipment-item" key={code}>
            <span className="equipment-icon">◇</span>
            <div><b>{name}</b><small>{code}</small></div>
            <span className={`availability ${tone === "green" ? "enough" : "missing"}`}>{status}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function PayrollView() {
  return (
    <section className="metrics payroll-metrics">
      <MetricCard label="Personal activo" value="12" trend="Casa Lomas" tone="ink" />
      <MetricCard label="Asistencia semanal" value="94%" trend="2 incidencias pendientes" tone="green" />
      <MetricCard label="Horas registradas" value="428" trend="Semana 30" tone="blue" />
      <MetricCard label="Nómina estimada" value="$86.4k" trend="Cierre pendiente" tone="orange" />
      <article className="panel section-card payroll-placeholder">
        <EmptyState
          title="Nómina preparada para el checkpoint 02"
          detail="La siguiente etapa conectará asistencia, incidencias aprobadas y cálculo semanal configurable."
        />
      </article>
    </section>
  );
}

function RequirementsTable({ requirements, compact = false }: { requirements: Requirement[]; compact?: boolean }) {
  return (
    <div className={`resource-table ${compact ? "compact-table" : ""}`} role="table" aria-label="Requerimientos de materiales">
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
  );
}

function ProjectCard() {
  return (
    <article className="panel project-card">
      <div className="panel-head compact">
        <div><p className="eyebrow">PROYECTO ACTIVO</p><h2>Casa Lomas</h2></div>
        <button aria-label="Opciones del proyecto" type="button">•••</button>
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
  );
}

function RequisitionCard({
  lines,
  status,
}: {
  lines: Array<Pick<Requirement, "itemId" | "itemName" | "unit" | "shortage">>;
  status: RequisitionStatus | null;
}) {
  return (
    <article className={`panel requisition-card ${status ? "visible" : ""}`}>
      <div className="requisition-title">
        <span>↗</span>
        <div><small>REQUISICIÓN AUTOMÁTICA</small><h3>RQ-024</h3></div>
        <b>{status ? status.replace("_", " ") : "esperando"}</b>
      </div>
      {lines.length > 0 ? lines.map((line) => (
        <div className="requisition-line" key={line.itemId}>
          <span>{line.itemName}</span>
          <b>{line.shortage.toFixed(2)} {line.unit}</b>
        </div>
      )) : <p className="muted">Se creará cuando un material no alcance.</p>}
    </article>
  );
}

function ActivityCard({ activity }: { activity: string[] }) {
  return (
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
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span>✓</span>
      <h3>{title}</h3>
      <p>{detail}</p>
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

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const month = new Intl.DateTimeFormat("es-MX", { month: "short" }).format(end);
  return `${start.getDate()}–${end.getDate()} ${month}`;
}
