"use client";

import { FormEvent, useMemo, useState } from "react";
import { EquipmentView } from "@/components/equipment/EquipmentView";
import { useEquipment } from "@/components/equipment/useEquipment";
import { InventoryView } from "@/components/inventory/InventoryView";
import { useInventory } from "@/components/inventory/useInventory";
import { PayrollView } from "@/components/payroll/PayrollView";
import { usePayroll } from "@/components/payroll/usePayroll";
import { ProjectsView } from "@/components/projects/ProjectsView";
import { useProjects } from "@/components/projects/useProjects";
import { TasksView } from "@/components/tasks/TasksView";
import { useTasks } from "@/components/tasks/useTasks";
import { TASK_STATUS_LABELS } from "@/domain/tasks/types";
import {
  type DemoTask,
  useWorkspaceDemo,
} from "@/components/workspace/useWorkspaceDemo";
import { useWorkspaceSnapshot } from "@/components/workspace/useWorkspaceSnapshot";
import { demoTools, initialInventory, marbleRecipe } from "@/domain/demo-data";
import type { Project } from "@/domain/projects/types";
import { createWorkspaceRepositories } from "@/infrastructure/workspace/workspace-repositories";
import {
  calculateRequirements,
  getAvailableStock,
  planTask,
  receivePurchase,
  type InventoryItem,
  type RequisitionStatus,
  type Requirement,
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

type PlannedTask = DemoTask;

const navItems: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: "summary", label: "Resumen", icon: "⌂" },
  { id: "projects", label: "Proyectos", icon: "▦" },
  { id: "tasks", label: "Tareas", icon: "✓" },
  { id: "inventory", label: "Inventario", icon: "□" },
  { id: "purchases", label: "Compras", icon: "↗" },
  { id: "equipment", label: "Equipo", icon: "◇" },
  { id: "payroll", label: "Nómina", icon: "$" },
];

const eventCopy: Record<DemoPhase, string> = {
  unplanned: "Abre el panel para definir cantidad, responsable y fechas.",
  blocked: "Se detectó un faltante y se generó una requisición automáticamente.",
  received: "La compra fue recibida. Falta confirmar la reserva transaccional.",
  ready: "Materiales reservados. La tarea puede iniciar sin comprometer el stock de seguridad.",
};

export function OperationsDashboard() {
  const [section, setSection] = useState<SectionId>("summary");
  const [plannerOpen, setPlannerOpen] = useState(false);
  const repositories = useMemo(() => createWorkspaceRepositories(), []);
  const projectsController = useProjects(repositories.projects);
  const inventoryController = useInventory(repositories.inventory);
  const equipmentController = useEquipment(repositories.equipment);
  const payrollController = usePayroll(repositories.payroll);
  const tasksController = useTasks(repositories.tasks);
  const workspaceDemo = useWorkspaceDemo(repositories.storage);
  const workspace = useWorkspaceSnapshot(repositories.storage);
  const {
    activity,
    phase,
    requisitionLines,
    requisitionStatus,
    task,
  } = workspaceDemo;
  const inventory = inventoryController.activeItems;
  const activeProject = projectsController.activeProject;
  const activeProjectName = activeProject?.name ?? "Sin proyecto activo";
  const planningTools = useMemo(
    () =>
      equipmentController.loading
        ? demoTools
        : demoTools.map((requirement) => {
            const equipment = equipmentController.activeItems.find(
              (item) => item.name === requirement.toolType,
            );
            return {
              ...requirement,
              available: equipment?.status === "available",
            };
          }),
    [equipmentController.activeItems, equipmentController.loading],
  );

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
      tools: planningTools,
      workerHasConflict: false,
      idempotencyKey: `plan-${currentTask.id}-v1`,
    };
  }

  function applyPlanning(currentTask: PlannedTask) {
    const result = planTask(planningInput(inventory, currentTask));
    workspaceDemo.applyPlanning(currentTask, result);
    if (result.status === "ready") {
      void inventoryController.updateStockLevels(result.inventory);
    }
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
    void inventoryController.updateStockLevels(reception.inventory);
    workspaceDemo.markReceived(reception.status);
  }

  function handleReserve() {
    const result = planTask(planningInput());
    void inventoryController.updateStockLevels(result.inventory);
    workspaceDemo.markReserved(result);
  }

  function resetDemo() {
    void inventoryController.resetDemoStock(initialInventory);
    workspaceDemo.reset();
  }

  const pageCopy: Record<SectionId, { eyebrow: string; title: string; subtitle: string }> = {
    summary: {
      eyebrow: "OPERACIÓN / RESUMEN",
      title: "Buenos días, Juan Pablo",
      subtitle: `Esto es lo que requiere atención hoy en ${activeProjectName}.`,
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
          <span>INTEGRACIÓN 03</span>
          <strong>Tareas + avance</strong>
          <div className="progress-track"><i /></div>
          <small>
            {workspace.tasks.filter((item) => !item.archived).length} tareas ·{" "}
            {workspace.tasks.filter((item) => item.needsReview).length} por revisar
          </small>
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
            activeProject={activeProject}
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
            activeProjectId={activeProject?.id ?? null}
            controller={tasksController}
            demoResources={
              <DemoTaskResources
                handleReceive={handleReceive}
                handleReserve={handleReserve}
                phase={phase}
                requirements={requirements}
              />
            }
            demoTaskId={task.id}
            employees={workspace.employees}
            projects={workspace.projects}
          />
        )}
        {section === "inventory" && (
          <InventoryView
            controller={inventoryController}
            projects={projectsController.projects}
            requirements={requirements}
          />
        )}
        {section === "purchases" && (
          <PurchasesView
            lines={requisitionLines}
            onReceive={handleReceive}
            phase={phase}
            status={requisitionStatus}
          />
        )}
        {section === "projects" && (
          <ProjectsView
            controller={projectsController}
            employees={workspace.employees}
          />
        )}
        {section === "equipment" && (
          <EquipmentView
            controller={equipmentController}
            projects={projectsController.projects}
          />
        )}
        {section === "payroll" && (
          <PayrollView
            controller={payrollController}
            projects={projectsController.projects}
          />
        )}
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
  activeProject,
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
  activeProject: Project | null;
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
        <MetricCard
          label="Avance del proyecto"
          value={`${activeProject?.progress ?? 0}%`}
          trend={activeProject?.name ?? "Sin proyecto activo"}
          tone="ink"
        />
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
        <SummaryTaskDetail
          handleReceive={handleReceive}
          handleReserve={handleReserve}
          phase={phase}
          requirements={requirements}
          task={task}
        />
        <aside className="right-column">
          <ActiveProjectCard project={activeProject} />
          <RequisitionCard lines={requisitionLines} status={requisitionStatus} />
          <ActivityCard activity={activity} />
        </aside>
      </section>
      <span className="sr-only">{inventory.length} artículos en inventario</span>
    </>
  );
}

function SummaryTaskDetail({
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
          <p className="eyebrow">
            {task.project.toUpperCase()} · PISO PLANTA BAJA
          </p>
          <h2>{task.name}</h2>
        </div>
        <span className={`status status-${task.status}`}>
          {TASK_STATUS_LABELS[task.status]}
        </span>
      </div>
      <div className="task-meta">
        <span>
          <b>{task.quantity}</b> {task.unit} planeados
        </span>
        <span>
          <b>{task.responsible}</b> responsable
        </span>
        <span>
          <b>2</b> herramientas listas
        </span>
        <span>
          <b>{task.startDate}–{task.endDate}</b> ejecución
        </span>
      </div>
      <DemoTaskResources
        handleReceive={handleReceive}
        handleReserve={handleReserve}
        phase={phase}
        requirements={requirements}
      />
    </article>
  );
}

function DemoTaskResources({
  handleReceive,
  handleReserve,
  phase,
  requirements,
}: {
  handleReceive: () => void;
  handleReserve: () => void;
  phase: DemoPhase;
  requirements: Requirement[];
}) {
  return (
    <>
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
    </>
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

function ActiveProjectCard({ project }: { project: Project | null }) {
  if (!project) {
    return (
      <article className="panel project-card">
        <div className="panel-head compact">
          <div>
            <p className="eyebrow">PROYECTO ACTIVO</p>
            <h2>Sin proyecto activo</h2>
          </div>
        </div>
        <p className="muted">
          Crea o activa un proyecto para mostrar su información aquí.
        </p>
      </article>
    );
  }

  const name = project.name;
  const projectType = project.projectType;
  const location = project.location;
  const progress = project.progress;
  const budget = project.budget;
  const responsible = project.responsible;
  const targetDate = project.targetDate
    ? new Intl.DateTimeFormat("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${project.targetDate}T00:00:00Z`))
    : "Sin fecha";

  return (
    <article className="panel project-card">
      <div className="panel-head compact">
        <div><p className="eyebrow">PROYECTO ACTIVO</p><h2>{name}</h2></div>
        <button aria-label="Opciones del proyecto" type="button">•••</button>
      </div>
      <p className="muted">{projectType} · {location}</p>
      <div className="project-progress">
        <div><span>Avance físico</span><b>{progress}%</b></div>
        <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
      </div>
      <dl>
        <div><dt>Presupuesto</dt><dd>{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(budget)}</dd></div>
        <div><dt>Responsable</dt><dd>{responsible}</dd></div>
        <div><dt>Fecha objetivo</dt><dd>{targetDate}</dd></div>
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
