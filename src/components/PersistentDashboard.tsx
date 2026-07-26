"use client";

import { FormEvent, ReactNode, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveAttendanceAction,
  archiveInventoryItemAction,
  archiveProjectAction,
  archiveWorkerAction,
  assignWorkerAction,
  calculatePayrollAction,
  changeWorkerRateAction,
  createPayrollAdjustmentAction,
  createPayrollPeriodAction,
  recordInventoryMovementAction,
  saveAttendanceAction,
  saveInventoryItemAction,
  saveProjectAction,
  saveWorkerAction,
  setPayrollStatusAction,
  type ActionResult,
} from "@/app/actions/operations";
import { logout } from "@/app/login/actions";
import { initialInventory, marbleRecipe } from "@/domain/demo-data";
import type {
  AttendanceRecord,
  InventoryCatalogItem,
  OperationsSnapshot,
  Project,
  RateType,
  Worker,
} from "@/domain/entities";
import {
  calculateRequirements,
  planTask,
  receivePurchase,
  type InventoryItem,
  type Requirement,
} from "@/domain/operations";

type Section =
  | "summary"
  | "projects"
  | "people"
  | "tasks"
  | "inventory"
  | "attendance"
  | "payroll";
type ModalName =
  | "project"
  | "worker"
  | "rate"
  | "assignment"
  | "inventory"
  | "movement"
  | "attendance"
  | "period"
  | "adjustment"
  | null;
type DemoPhase = "draft" | "blocked" | "received" | "ready";

const navItems: Array<{ id: Section; label: string; icon: string }> = [
  { id: "summary", label: "Resumen", icon: "⌂" },
  { id: "projects", label: "Proyectos", icon: "▦" },
  { id: "people", label: "Personal", icon: "♙" },
  { id: "tasks", label: "Tareas", icon: "✓" },
  { id: "inventory", label: "Inventario", icon: "□" },
  { id: "attendance", label: "Asistencia", icon: "◷" },
  { id: "payroll", label: "Nómina", icon: "$" },
];

const sectionCopy: Record<Section, [string, string, string]> = {
  summary: ["OPERACIÓN / RESUMEN", "Centro de control", "Datos reales de proyectos, personal e inventario."],
  projects: ["OPERACIÓN / PROYECTOS", "Proyectos", "Alta, edición, estado, presupuesto y responsables."],
  people: ["OPERACIÓN / PERSONAL", "Trabajadores", "Especialidades, tarifas vigentes y asignaciones."],
  tasks: ["OPERACIÓN / TAREAS", "Planeación de tareas", "Validación de recursos antes de iniciar la ejecución."],
  inventory: ["OPERACIÓN / INVENTARIO", "Inventario central", "Movimientos auditables y uso agrupado por proyecto."],
  attendance: ["OPERACIÓN / ASISTENCIA", "Asistencia", "Registro diario único y aprobación de incidencias."],
  payroll: ["ADMINISTRACIÓN / NÓMINA", "Nómina semanal", "Cálculo configurable, revisión, aprobación y cierre."],
};

export function PersistentDashboard({
  user,
  snapshot,
}: {
  user: { id: string; email: string; fullName: string; role: OperationsSnapshot["role"] };
  snapshot: OperationsSnapshot;
}) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("summary");
  const [modal, setModal] = useState<ModalName>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryCatalogItem | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const canManageProjects = user.role === "administrator" || user.role === "supervisor";
  const canManagePeople = user.role === "administrator";
  const canManageInventory = user.role === "administrator" || user.role === "warehouse";

  function execute(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result);
      if (result.ok) {
        setModal(null);
        setSelectedProject(null);
        setSelectedWorker(null);
        setSelectedItem(null);
        router.refresh();
      }
    });
  }

  function archiveProject(project: Project) {
    const reason = window.prompt(`Motivo para archivar “${project.name}”:`);
    if (reason?.trim()) execute(() => archiveProjectAction(project.id, reason));
  }

  function archiveWorker(worker: Worker) {
    const reason = window.prompt(`Motivo de baja de ${worker.fullName}:`);
    if (reason?.trim()) execute(() => archiveWorkerAction(worker.id, reason));
  }

  function archiveItem(item: InventoryCatalogItem) {
    const reason = window.prompt(`Motivo para archivar “${item.name}”:`);
    if (reason?.trim()) execute(() => archiveInventoryItemAction(item.id, reason));
  }

  const copy = sectionCopy[section];
  return (
    <div className="app-shell persistent-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div><strong>MAISTRO</strong><small>OPERATIONS SYSTEM</small></div>
        </div>
        <nav aria-label="Navegación principal">
          <p className="nav-label">OPERACIÓN</p>
          {navItems
            .filter((item) => item.id !== "payroll" || user.role === "administrator")
            .filter((item) => item.id !== "attendance" || user.role !== "warehouse")
            .map((item) => (
              <button
                className={`nav-item ${section === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => {
                  setSection(item.id);
                  setMessage(null);
                }}
                type="button"
              >
                <span aria-hidden="true">{item.icon}</span>{item.label}
              </button>
            ))}
        </nav>
        <div className="sidebar-card">
          <span>DATOS PERSISTENTES</span>
          <strong>Supabase conectado</strong>
          <div className="progress-track"><i style={{ width: "100%" }} /></div>
          <small>RLS y auditoría activas</small>
        </div>
        <div className="user-card">
          <span className="avatar">{initials(user.fullName)}</span>
          <div><strong>{user.fullName}</strong><small>{roleLabel(user.role)}</small></div>
          <form action={logout}><button aria-label="Cerrar sesión" title="Cerrar sesión">↪</button></form>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="breadcrumb">{copy[0]}</p>
            <h1>{copy[1]}</h1>
            <p>{copy[2]}</p>
          </div>
          <span className="live-source">● EN LÍNEA</span>
        </header>

        {message && (
          <div className={`action-message ${message.ok ? "success" : "error"}`} role="status">
            <b>{message.ok ? "Listo" : "No se guardó"}</b>
            <span>{message.message}</span>
            <button onClick={() => setMessage(null)} type="button">×</button>
          </div>
        )}

        {section === "summary" && <Summary snapshot={snapshot} />}
        {section === "projects" && (
          <Projects
            canManage={canManageProjects}
            onArchive={archiveProject}
            onCreate={() => setModal("project")}
            onEdit={(project) => {
              setSelectedProject(project);
              setModal("project");
            }}
            projects={snapshot.projects}
          />
        )}
        {section === "people" && (
          <People
            assignments={snapshot.assignments}
            canManage={canManagePeople}
            onArchive={archiveWorker}
            onAssign={(worker) => {
              setSelectedWorker(worker);
              setModal("assignment");
            }}
            onCreate={() => setModal("worker")}
            onEdit={(worker) => {
              setSelectedWorker(worker);
              setModal("worker");
            }}
            onRate={(worker) => {
              setSelectedWorker(worker);
              setModal("rate");
            }}
            projects={snapshot.projects}
            rates={snapshot.workerRates}
            workers={snapshot.workers}
          />
        )}
        {section === "tasks" && <TaskDemo />}
        {section === "inventory" && (
          <Inventory
            canManage={canManageInventory}
            items={snapshot.inventory}
            onArchive={archiveItem}
            onCreate={() => setModal("inventory")}
            onEdit={(item) => {
              setSelectedItem(item);
              setModal("inventory");
            }}
            onMove={(item) => {
              setSelectedItem(item);
              setModal("movement");
            }}
            usage={snapshot.projectUsage}
          />
        )}
        {section === "attendance" && (
          <Attendance
            records={snapshot.attendance}
            onApprove={(id) => execute(() => approveAttendanceAction(id))}
            onCreate={() => setModal("attendance")}
            projects={snapshot.projects}
            workers={snapshot.workers}
          />
        )}
        {section === "payroll" && (
          <Payroll
            entries={snapshot.payrollEntries}
            onAction={(periodId, status) => execute(() => setPayrollStatusAction(periodId, status))}
            onAdjustment={(periodId) => {
              setSelectedPeriodId(periodId);
              setModal("adjustment");
            }}
            onCalculate={(periodId) => execute(() => calculatePayrollAction(periodId))}
            onCreate={() => setModal("period")}
            periods={snapshot.payrollPeriods}
            workers={snapshot.workers}
          />
        )}
      </main>

      {modal === "project" && (
        <Modal title={selectedProject ? "Editar proyecto" : "Nuevo proyecto"} onClose={() => setModal(null)}>
          <ProjectForm
            pending={pending}
            project={selectedProject}
            onSave={(input) => execute(() => saveProjectAction(input))}
          />
        </Modal>
      )}
      {modal === "worker" && (
        <Modal title={selectedWorker ? "Editar trabajador" : "Nuevo trabajador"} onClose={() => setModal(null)}>
          <WorkerForm
            pending={pending}
            worker={selectedWorker}
            onSave={(input) => execute(() => saveWorkerAction(input))}
          />
        </Modal>
      )}
      {modal === "rate" && selectedWorker && (
        <Modal title={`Cambiar tarifa · ${selectedWorker.fullName}`} onClose={() => setModal(null)}>
          <RateForm
            pending={pending}
            workerId={selectedWorker.id}
            onSave={(input) => execute(() => changeWorkerRateAction(input))}
          />
        </Modal>
      )}
      {modal === "assignment" && selectedWorker && (
        <Modal title={`Asignar a proyecto · ${selectedWorker.fullName}`} onClose={() => setModal(null)}>
          <AssignmentForm
            pending={pending}
            projects={snapshot.projects.filter((project) => project.status === "active")}
            workerId={selectedWorker.id}
            onSave={(input) => execute(() => assignWorkerAction(input))}
          />
        </Modal>
      )}
      {modal === "inventory" && (
        <Modal title={selectedItem ? "Editar artículo" : "Nuevo artículo"} onClose={() => setModal(null)}>
          <InventoryForm
            item={selectedItem}
            pending={pending}
            onSave={(input) => execute(() => saveInventoryItemAction(input))}
          />
        </Modal>
      )}
      {modal === "movement" && selectedItem && (
        <Modal title={`Movimiento · ${selectedItem.name}`} onClose={() => setModal(null)}>
          <MovementForm
            item={selectedItem}
            pending={pending}
            projects={snapshot.projects.filter((project) => project.status === "active")}
            onSave={(input) => execute(() => recordInventoryMovementAction(input))}
          />
        </Modal>
      )}
      {modal === "attendance" && (
        <Modal title="Registrar asistencia" onClose={() => setModal(null)}>
          <AttendanceForm
            pending={pending}
            projects={snapshot.projects.filter((project) => project.status === "active")}
            workers={snapshot.workers.filter((worker) => worker.active)}
            onSave={(input) => execute(() => saveAttendanceAction(input))}
          />
        </Modal>
      )}
      {modal === "period" && (
        <Modal title="Abrir periodo semanal" onClose={() => setModal(null)}>
          <PeriodForm
            pending={pending}
            onSave={(weekStart) => execute(() => createPayrollPeriodAction(weekStart))}
          />
        </Modal>
      )}
      {modal === "adjustment" && selectedPeriodId && (
        <Modal title="Ajuste de nómina" onClose={() => setModal(null)}>
          <AdjustmentForm
            pending={pending}
            periodId={selectedPeriodId}
            workers={snapshot.workers.filter((worker) => worker.active)}
            onSave={(input) => execute(() => createPayrollAdjustmentAction(input))}
          />
        </Modal>
      )}
    </div>
  );
}

function Summary({ snapshot }: { snapshot: OperationsSnapshot }) {
  const activeProjects = snapshot.projects.filter((project) => project.status === "active").length;
  const activeWorkers = snapshot.workers.filter((worker) => worker.active).length;
  const availableStock = snapshot.inventory.reduce(
    (sum, item) => sum + Math.max(item.physicalStock - item.reservedStock - item.safetyStock, 0),
    0,
  );
  const pendingAttendance = snapshot.attendance.filter((record) => record.approvalStatus === "pending").length;
  return (
    <>
      <section className="metrics">
        <Metric label="Proyectos activos" value={String(activeProjects)} detail={`${snapshot.projects.length} registrados`} tone="ink" />
        <Metric label="Personal activo" value={String(activeWorkers)} detail={`${snapshot.assignments.filter((item) => item.active).length} asignaciones`} tone="green" />
        <Metric label="Stock disponible" value={availableStock.toFixed(1)} detail={`${snapshot.inventory.length} artículos`} tone="blue" />
        <Metric label="Asistencias por revisar" value={String(pendingAttendance)} detail="Incidencias pendientes" tone="orange" />
      </section>
      <section className="dashboard-columns">
        <article className="panel section-card">
          <div className="section-card-head"><div><p className="eyebrow">PROYECTOS</p><h2>Operación activa</h2></div></div>
          <div className="compact-list">
            {snapshot.projects.filter((project) => project.status !== "cancelled").slice(0, 5).map((project) => (
              <div key={project.id}><span><b>{project.name}</b><small>{project.clientName}</small></span><Status value={project.status} /></div>
            ))}
            {snapshot.projects.length === 0 && <Empty text="Crea el primer proyecto para comenzar." />}
          </div>
        </article>
        <article className="panel section-card">
          <div className="section-card-head"><div><p className="eyebrow">ALERTAS</p><h2>Requiere atención</h2></div></div>
          <div className="alert-list">
            <p><b>{pendingAttendance}</b><span>asistencias pendientes de aprobación</span></p>
            <p><b>{snapshot.inventory.filter((item) => item.physicalStock - item.reservedStock <= item.safetyStock).length}</b><span>artículos en mínimo de seguridad</span></p>
            <p><b>{snapshot.payrollPeriods.filter((period) => period.status !== "closed").length}</b><span>periodos de nómina abiertos</span></p>
          </div>
        </article>
      </section>
    </>
  );
}

function Projects({
  projects, canManage, onCreate, onEdit, onArchive,
}: {
  projects: Project[];
  canManage: boolean;
  onCreate: () => void;
  onEdit: (project: Project) => void;
  onArchive: (project: Project) => void;
}) {
  return (
    <section className="panel section-card">
      <div className="section-card-head">
        <div><p className="eyebrow">PORTAFOLIO</p><h2>{projects.length} proyectos</h2></div>
        {canManage && <button className="primary-button" onClick={onCreate}>+ Nuevo proyecto</button>}
      </div>
      <div className="record-grid">
        {projects.map((project) => (
          <article className={`record-card ${project.status === "cancelled" ? "archived" : ""}`} key={project.id}>
            <div className="record-head"><span className="record-icon">{initials(project.name)}</span><Status value={project.status} /></div>
            <h3>{project.name}</h3>
            <p>{project.clientName}</p>
            <dl>
              <div><dt>Presupuesto</dt><dd>{currency(project.budget)}</dd></div>
              <div><dt>Periodo</dt><dd>{shortDate(project.startsOn)} – {shortDate(project.targetEndOn)}</dd></div>
              <div><dt>Ubicación</dt><dd>{project.publicAddress || "Sin dirección"}</dd></div>
            </dl>
            {canManage && project.status !== "cancelled" && (
              <div className="record-actions">
                <button onClick={() => onEdit(project)}>Editar</button>
                <button className="danger-link" onClick={() => onArchive(project)}>Archivar</button>
              </div>
            )}
          </article>
        ))}
        {projects.length === 0 && <Empty text="Todavía no hay proyectos. Crea el primero." />}
      </div>
    </section>
  );
}

function People({
  workers, rates, assignments, projects, canManage, onCreate, onEdit, onRate, onAssign, onArchive,
}: {
  workers: Worker[];
  rates: OperationsSnapshot["workerRates"];
  assignments: OperationsSnapshot["assignments"];
  projects: Project[];
  canManage: boolean;
  onCreate: () => void;
  onEdit: (worker: Worker) => void;
  onRate: (worker: Worker) => void;
  onAssign: (worker: Worker) => void;
  onArchive: (worker: Worker) => void;
}) {
  return (
    <section className="panel section-card">
      <div className="section-card-head">
        <div><p className="eyebrow">DIRECTORIO</p><h2>{workers.filter((worker) => worker.active).length} trabajadores activos</h2></div>
        {canManage && <button className="primary-button" onClick={onCreate}>+ Agregar trabajador</button>}
      </div>
      <div className="people-table">
        <div className="people-row people-header"><span>Trabajador</span><span>Proyecto</span><span>Tarifa vigente</span><span>Estado</span><span /></div>
        {workers.map((worker) => {
          const assignment = assignments.find((item) => item.workerId === worker.id && item.active);
          const project = projects.find((item) => item.id === assignment?.projectId);
          const rate = rates.find((item) =>
            item.workerId === worker.id
            && item.effectiveFrom <= today()
            && (!item.effectiveTo || item.effectiveTo >= today()));
          return (
            <div className={`people-row ${!worker.active ? "archived" : ""}`} key={worker.id}>
              <span className="person-name"><i>{initials(worker.fullName)}</i><span><b>{worker.fullName}</b><small>{worker.specialty}</small></span></span>
              <span>{project?.name ?? "Sin asignación"}<small>{assignment?.role ?? ""}</small></span>
              <span>{rate ? currency(rate.amount) : canManage ? "Sin tarifa" : "Restringido"}<small>{rate ? rateLabel(rate.rateType) : ""}</small></span>
              <span><Status value={worker.active ? "active" : "inactive"} /></span>
              <span className="row-actions">
                {canManage && worker.active && <>
                  <button onClick={() => onEdit(worker)}>Editar</button>
                  <button onClick={() => onRate(worker)}>Salario</button>
                  <button onClick={() => onAssign(worker)}>Asignar</button>
                  <button className="danger-link" onClick={() => onArchive(worker)}>Baja</button>
                </>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Inventory({
  items, usage, canManage, onCreate, onEdit, onMove, onArchive,
}: {
  items: InventoryCatalogItem[];
  usage: OperationsSnapshot["projectUsage"];
  canManage: boolean;
  onCreate: () => void;
  onEdit: (item: InventoryCatalogItem) => void;
  onMove: (item: InventoryCatalogItem) => void;
  onArchive: (item: InventoryCatalogItem) => void;
}) {
  return (
    <section className="panel section-card">
      <div className="section-card-head">
        <div><p className="eyebrow">ALMACÉN CENTRAL</p><h2>Catálogo y existencias</h2></div>
        {canManage && <button className="primary-button" onClick={onCreate}>+ Nuevo artículo</button>}
      </div>
      <div className="inventory-real-table">
        <div className="inventory-real-row inventory-real-header">
          <span>Artículo</span><span>Físico</span><span>Reservado</span><span>Seguridad</span><span>Disponible</span><span>Uso por proyecto</span><span />
        </div>
        {items.map((item) => {
          const itemUsage = usage.filter((entry) => entry.inventoryItemId === item.id);
          const available = Math.max(item.physicalStock - item.reservedStock - item.safetyStock, 0);
          return (
            <div className={`inventory-real-row ${!item.active ? "archived" : ""}`} key={item.id}>
              <span><b>{item.name}</b><small>{item.sku} · {item.location || "Sin ubicación"}</small></span>
              <span>{item.physicalStock.toFixed(2)} {item.unit}</span>
              <span>{item.reservedStock.toFixed(2)}</span>
              <span>{item.safetyStock.toFixed(2)}</span>
              <span><b>{available.toFixed(2)}</b></span>
              <span className="usage-list">
                {itemUsage.length ? itemUsage.map((entry) => (
                  <small key={entry.projectId}>{entry.projectName}: R {entry.reservedQuantity} / C {entry.consumedQuantity}</small>
                )) : <small>Sin uso registrado</small>}
              </span>
              <span className="row-actions">
                {canManage && item.active && <>
                  <button onClick={() => onMove(item)}>Movimiento</button>
                  <button onClick={() => onEdit(item)}>Editar</button>
                  <button className="danger-link" onClick={() => onArchive(item)}>Archivar</button>
                </>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Attendance({
  records, workers, projects, onCreate, onApprove,
}: {
  records: AttendanceRecord[];
  workers: Worker[];
  projects: Project[];
  onCreate: () => void;
  onApprove: (id: string) => void;
}) {
  return (
    <section className="panel section-card">
      <div className="section-card-head">
        <div><p className="eyebrow">REGISTRO DIARIO</p><h2>Asistencias</h2></div>
        <button className="primary-button" onClick={onCreate}>+ Registrar asistencia</button>
      </div>
      <div className="people-table">
        <div className="attendance-row people-header"><span>Fecha</span><span>Trabajador</span><span>Proyecto</span><span>Horario</span><span>Estado</span><span /></div>
        {records.map((record) => (
          <div className="attendance-row" key={record.id}>
            <span>{shortDate(record.workDate)}</span>
            <span>{workers.find((worker) => worker.id === record.workerId)?.fullName ?? "Trabajador"}</span>
            <span>{projects.find((project) => project.id === record.projectId)?.name ?? "Proyecto"}</span>
            <span>{record.checkIn && record.checkOut ? `${record.checkIn.slice(0, 5)}–${record.checkOut.slice(0, 5)}` : "Sin horario"}</span>
            <span><Status value={record.approvalStatus} /></span>
            <span>{record.approvalStatus === "pending" && <button className="small-primary" onClick={() => onApprove(record.id)}>Aprobar</button>}</span>
          </div>
        ))}
        {records.length === 0 && <Empty text="No hay asistencias registradas." />}
      </div>
    </section>
  );
}

function Payroll({
  periods, entries, workers, onCreate, onCalculate, onAction, onAdjustment,
}: {
  periods: OperationsSnapshot["payrollPeriods"];
  entries: OperationsSnapshot["payrollEntries"];
  workers: Worker[];
  onCreate: () => void;
  onCalculate: (id: string) => void;
  onAction: (id: string, status: "approved" | "closed") => void;
  onAdjustment: (id: string) => void;
}) {
  return (
    <section className="panel section-card">
      <div className="section-card-head">
        <div><p className="eyebrow">PERIODOS SEMANALES</p><h2>Nómina</h2></div>
        <button className="primary-button" onClick={onCreate}>+ Abrir semana</button>
      </div>
      <div className="payroll-periods">
        {periods.map((period) => {
          const periodEntries = entries.filter((entry) => entry.payrollPeriodId === period.id);
          const total = periodEntries.reduce((sum, entry) => sum + entry.netAmount, 0);
          return (
            <article className="payroll-period" key={period.id}>
              <div className="record-head">
                <div><b>{shortDate(period.weekStart)} – {shortDate(period.weekEnd)}</b><small>{periodEntries.length} trabajadores</small></div>
                <Status value={period.status} />
              </div>
              <strong className="payroll-total">{currency(total)}</strong>
              <div className="payroll-lines">
                {periodEntries.map((entry) => (
                  <div key={entry.workerId}>
                    <span>{workers.find((worker) => worker.id === entry.workerId)?.fullName ?? "Trabajador"}</span>
                    <b>{currency(entry.netAmount)}</b>
                  </div>
                ))}
              </div>
              {period.status !== "closed" && (
                <div className="record-actions">
                  <button onClick={() => onAdjustment(period.id)}>Ajuste</button>
                  {(period.status === "open" || period.status === "in_review") && <button onClick={() => onCalculate(period.id)}>Calcular</button>}
                  {period.status === "in_review" && <button onClick={() => onAction(period.id, "approved")}>Aprobar</button>}
                  {period.status === "approved" && <button className="primary-mini" onClick={() => onAction(period.id, "closed")}>Cerrar</button>}
                </div>
              )}
            </article>
          );
        })}
        {periods.length === 0 && <Empty text="Abre la primera semana para calcular nómina." />}
      </div>
    </section>
  );
}

function TaskDemo() {
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [phase, setPhase] = useState<DemoPhase>("draft");
  const [lines, setLines] = useState<Array<Pick<Requirement, "itemId" | "shortage">>>([]);
  const calculated = useMemo(() => calculateRequirements(20, marbleRecipe, inventory), [inventory]);
  const requirements = phase === "ready"
    ? calculated.map((item) => ({ ...item, available: item.required, shortage: 0 }))
    : calculated;

  function plan() {
    const result = planTask({
      taskId: "task-marble-floor",
      quantity: 20,
      unit: "m²",
      recipeApproved: true,
      recipeLines: marbleRecipe,
      inventory,
      predecessorsComplete: true,
      tools: [{ toolType: "Cortadora", critical: true, available: true }],
      workerHasConflict: false,
      idempotencyKey: "persistent-demo-v1",
    });
    setLines(result.requisition?.lines ?? []);
    setPhase(result.status === "blocked" ? "blocked" : "ready");
  }
  function receive() {
    const result = receivePurchase(
      inventory,
      lines.map((line) => ({ itemId: line.itemId, quantity: line.shortage })),
      lines,
    );
    setInventory(result.inventory);
    setPhase("received");
  }
  function reserve() {
    const result = planTask({
      taskId: "task-marble-floor",
      quantity: 20,
      unit: "m²",
      recipeApproved: true,
      recipeLines: marbleRecipe,
      inventory,
      predecessorsComplete: true,
      tools: [{ toolType: "Cortadora", critical: true, available: true }],
      workerHasConflict: false,
      idempotencyKey: "persistent-demo-v2",
    });
    setInventory(result.inventory);
    setPhase("ready");
  }
  return (
    <article className="panel section-card task-real-card">
      <div className="section-card-head"><div><p className="eyebrow">CASA LOMAS · EJEMPLO VERIFICABLE</p><h2>Colocación de mármol · 20 m²</h2></div><Status value={phase} /></div>
      <div className="resource-table">
        <div className="table-row table-header"><span>Material</span><span>Requerido</span><span>Disponible</span><span>Resultado</span></div>
        {requirements.map((item) => (
          <div className="table-row" key={item.itemId}>
            <span><b>{item.itemName}</b></span><span>{item.required.toFixed(2)} {item.unit}</span>
            <span>{item.available.toFixed(2)} {item.unit}</span>
            <span><b className={`availability ${item.shortage ? "missing" : "enough"}`}>{item.shortage ? `Faltan ${item.shortage.toFixed(2)}` : "Suficiente"}</b></span>
          </div>
        ))}
      </div>
      <div className="button-row">
        {phase === "draft" && <button className="primary-button" onClick={plan}>Planear tarea</button>}
        {phase === "blocked" && <button className="warning-button" onClick={receive}>Recibir compra</button>}
        {phase === "received" && <button className="primary-button" onClick={reserve}>Reservar materiales</button>}
        {phase === "ready" && <span className="success-message">✓ Reserva auditada y tarea Lista</span>}
      </div>
    </article>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="crud-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header><div><p className="eyebrow">TEAM MAISTRO OS</p><h2>{title}</h2></div><button onClick={onClose} aria-label="Cerrar">×</button></header>
        {children}
      </section>
    </div>
  );
}

function ProjectForm({ project, pending, onSave }: { project: Project | null; pending: boolean; onSave: (input: Parameters<typeof saveProjectAction>[0]) => void }) {
  const [name, setName] = useState(project?.name ?? "");
  const [clientName, setClientName] = useState(project?.clientName ?? "");
  const [address, setAddress] = useState(project?.publicAddress ?? "");
  const [budget, setBudget] = useState(project?.budget ?? 0);
  const [startsOn, setStartsOn] = useState(project?.startsOn ?? today());
  const [targetEndOn, setTargetEndOn] = useState(project?.targetEndOn ?? today());
  const [status, setStatus] = useState<Project["status"]>(project?.status ?? "draft");
  return <CrudForm pending={pending} onSubmit={() => onSave({ id: project?.id, name, clientName, publicAddress: address, budget, startsOn, targetEndOn, status })}>
    <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
    <Field label="Cliente"><input value={clientName} onChange={(e) => setClientName(e.target.value)} required /></Field>
    <Field label="Dirección" wide><input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
    <Field label="Presupuesto"><input type="number" min="0" value={budget} onChange={(e) => setBudget(Number(e.target.value))} required /></Field>
    <Field label="Estado"><select value={status} onChange={(e) => setStatus(e.target.value as Project["status"])}><option value="draft">Borrador</option><option value="active">Activo</option><option value="paused">Pausado</option><option value="completed">Terminado</option></select></Field>
    <Field label="Inicio"><input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required /></Field>
    <Field label="Fin objetivo"><input type="date" min={startsOn} value={targetEndOn} onChange={(e) => setTargetEndOn(e.target.value)} required /></Field>
  </CrudForm>;
}

function WorkerForm({ worker, pending, onSave }: { worker: Worker | null; pending: boolean; onSave: (input: Parameters<typeof saveWorkerAction>[0]) => void }) {
  const [fullName, setFullName] = useState(worker?.fullName ?? "");
  const [specialty, setSpecialty] = useState(worker?.specialty ?? "");
  const [rateType, setRateType] = useState<RateType>("daily");
  const [amount, setAmount] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  return <CrudForm pending={pending} onSubmit={() => onSave({ id: worker?.id, fullName, specialty, rateType: worker ? undefined : rateType, amount: worker ? undefined : amount, effectiveFrom: worker ? undefined : effectiveFrom })}>
    <Field label="Nombre completo" wide><input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></Field>
    <Field label="Especialidad" wide><input value={specialty} onChange={(e) => setSpecialty(e.target.value)} required /></Field>
    {!worker && <>
      <Field label="Tipo de tarifa"><select value={rateType} onChange={(e) => setRateType(e.target.value as RateType)}><option value="hourly">Por hora</option><option value="daily">Por día</option><option value="weekly">Por semana</option></select></Field>
      <Field label="Importe"><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required /></Field>
      <Field label="Vigente desde"><input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required /></Field>
    </>}
  </CrudForm>;
}

function RateForm({ workerId, pending, onSave }: { workerId: string; pending: boolean; onSave: (input: Parameters<typeof changeWorkerRateAction>[0]) => void }) {
  const [rateType, setRateType] = useState<RateType>("daily");
  const [amount, setAmount] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  return <CrudForm pending={pending} onSubmit={() => onSave({ workerId, rateType, amount, effectiveFrom })}>
    <Field label="Tipo"><select value={rateType} onChange={(e) => setRateType(e.target.value as RateType)}><option value="hourly">Hora</option><option value="daily">Día</option><option value="weekly">Semana</option></select></Field>
    <Field label="Importe"><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required /></Field>
    <Field label="Vigente desde" wide><input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required /></Field>
    <p className="form-note">La tarifa anterior terminará un día antes. El historial no se sobrescribe.</p>
  </CrudForm>;
}

function AssignmentForm({ workerId, projects, pending, onSave }: { workerId: string; projects: Project[]; pending: boolean; onSave: (input: Parameters<typeof assignWorkerAction>[0]) => void }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [role, setRole] = useState("Oficial");
  const [startsOn, setStartsOn] = useState(today());
  const [endsOn, setEndsOn] = useState(projects[0]?.targetEndOn ?? today());
  const [schedule, setSchedule] = useState("08:00-17:00");
  return <CrudForm pending={pending} onSubmit={() => onSave({ workerId, projectId, role, startsOn, endsOn, schedule })}>
    <Field label="Proyecto" wide><select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></Field>
    <Field label="Función"><input value={role} onChange={(e) => setRole(e.target.value)} required /></Field>
    <Field label="Horario"><input value={schedule} onChange={(e) => setSchedule(e.target.value)} required /></Field>
    <Field label="Inicio"><input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required /></Field>
    <Field label="Fin"><input type="date" min={startsOn} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required /></Field>
  </CrudForm>;
}

function InventoryForm({ item, pending, onSave }: { item: InventoryCatalogItem | null; pending: boolean; onSave: (input: Parameters<typeof saveInventoryItemAction>[0]) => void }) {
  const [sku, setSku] = useState(item?.sku ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "pieza");
  const [safetyStock, setSafetyStock] = useState(item?.safetyStock ?? 0);
  const [averageCost, setAverageCost] = useState(item?.averageCost ?? 0);
  const [location, setLocation] = useState(item?.location ?? "");
  return <CrudForm pending={pending} onSubmit={() => onSave({ id: item?.id, sku, name, unit, safetyStock, averageCost, location })}>
    <Field label="SKU"><input value={sku} onChange={(e) => setSku(e.target.value)} required /></Field>
    <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
    <Field label="Unidad"><input value={unit} onChange={(e) => setUnit(e.target.value)} required /></Field>
    <Field label="Stock de seguridad"><input type="number" min="0" step="0.001" value={safetyStock} onChange={(e) => setSafetyStock(Number(e.target.value))} required /></Field>
    <Field label="Costo promedio"><input type="number" min="0" step="0.01" value={averageCost} onChange={(e) => setAverageCost(Number(e.target.value))} required /></Field>
    <Field label="Ubicación"><input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
    <p className="form-note">La existencia se modifica únicamente mediante movimientos auditables.</p>
  </CrudForm>;
}

function MovementForm({ item, projects, pending, onSave }: { item: InventoryCatalogItem; projects: Project[]; pending: boolean; onSave: (input: Parameters<typeof recordInventoryMovementAction>[0]) => void }) {
  const [movementType, setMovementType] = useState<"receipt" | "issue" | "consume" | "adjustment">("receipt");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState(0);
  const [projectId, setProjectId] = useState("");
  const [reason, setReason] = useState("");
  const needsProject = movementType === "issue" || movementType === "consume";
  return <CrudForm pending={pending} onSubmit={() => onSave({ inventoryItemId: item.id, movementType, direction, quantity, reason, projectId: projectId || null })}>
    <Field label="Tipo"><select value={movementType} onChange={(e) => { const value = e.target.value as typeof movementType; setMovementType(value); setDirection(value === "receipt" ? "in" : "out"); }}><option value="receipt">Recepción</option><option value="issue">Salida a obra</option><option value="consume">Consumo</option><option value="adjustment">Ajuste</option></select></Field>
    <Field label="Dirección"><select value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")} disabled={movementType !== "adjustment"}><option value="in">Entrada</option><option value="out">Salida</option></select></Field>
    <Field label={`Cantidad (${item.unit})`}><input type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required /></Field>
    <Field label="Proyecto"><select value={projectId} onChange={(e) => setProjectId(e.target.value)} required={needsProject}><option value="">Sin proyecto</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></Field>
    <Field label="Motivo" wide><textarea value={reason} onChange={(e) => setReason(e.target.value)} required /></Field>
  </CrudForm>;
}

function AttendanceForm({ workers, projects, pending, onSave }: { workers: Worker[]; projects: Project[]; pending: boolean; onSave: (input: Parameters<typeof saveAttendanceAction>[0]) => void }) {
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [workDate, setWorkDate] = useState(today());
  const [checkIn, setCheckIn] = useState("08:00");
  const [checkOut, setCheckOut] = useState("16:00");
  const [status, setStatus] = useState<AttendanceRecord["status"]>("present");
  const [notes, setNotes] = useState("");
  const usesTime = status === "present" || status === "partial";
  return <CrudForm pending={pending} onSubmit={() => onSave({ workerId, projectId, workDate, checkIn: usesTime ? checkIn : null, checkOut: usesTime ? checkOut : null, status, notes })}>
    <Field label="Trabajador"><select value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>{workers.map((worker) => <option value={worker.id} key={worker.id}>{worker.fullName}</option>)}</select></Field>
    <Field label="Proyecto"><select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></Field>
    <Field label="Fecha"><input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} required /></Field>
    <Field label="Estado"><select value={status} onChange={(e) => setStatus(e.target.value as AttendanceRecord["status"])}><option value="present">Presente</option><option value="partial">Parcial</option><option value="absent">Falta</option><option value="leave">Permiso</option><option value="rest">Descanso</option></select></Field>
    {usesTime && <><Field label="Entrada"><input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required /></Field><Field label="Salida"><input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required /></Field></>}
    <Field label="Notas" wide><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
  </CrudForm>;
}

function PeriodForm({ pending, onSave }: { pending: boolean; onSave: (weekStart: string) => void }) {
  const [weekStart, setWeekStart] = useState(today());
  return <CrudForm pending={pending} onSubmit={() => onSave(weekStart)}><Field label="Inicio de semana" wide><input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} required /></Field><p className="form-note">El periodo cubrirá siete días; la jornada configurada es lunes a sábado.</p></CrudForm>;
}

function AdjustmentForm({ periodId, workers, pending, onSave }: { periodId: string; workers: Worker[]; pending: boolean; onSave: (input: Parameters<typeof createPayrollAdjustmentAction>[0]) => void }) {
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  return <CrudForm pending={pending} onSubmit={() => onSave({ periodId, workerId, amount, reason })}>
    <Field label="Trabajador" wide><select value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>{workers.map((worker) => <option value={worker.id} key={worker.id}>{worker.fullName}</option>)}</select></Field>
    <Field label="Importe"><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required /></Field>
    <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} required /></Field>
    <p className="form-note">Usa importe positivo para bono y negativo para descuento o corrección.</p>
  </CrudForm>;
}

function CrudForm({ pending, onSubmit, children }: { pending: boolean; onSubmit: () => void; children: ReactNode }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }
  return <form className="crud-form" onSubmit={submit}><div className="crud-grid">{children}</div><footer><button className="primary-button" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button></footer></form>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={`field ${wide ? "field-wide" : ""}`}><span>{label}</span>{children}</label>;
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "ink" | "green" | "orange" | "blue" }) {
  return <article className={`metric-card tone-${tone}`}><div><p>{label}</p><strong>{value}</strong></div><span>{detail}</span></article>;
}

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    draft: "Borrador", active: "Activo", paused: "Pausado", completed: "Terminado",
    cancelled: "Archivado", inactive: "Baja", pending: "Pendiente", approved: "Aprobado",
    rejected: "Rechazado", open: "Abierta", in_review: "En revisión", closed: "Cerrada",
    blocked: "Bloqueada", received: "Recibido", ready: "Lista",
  };
  return <span className={`status status-${value}`}>{labels[value] ?? value}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty-inline"><span>+</span><p>{text}</p></div>;
}

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function roleLabel(role: OperationsSnapshot["role"]) {
  return { administrator: "Administrador", supervisor: "Supervisor", warehouse: "Almacén" }[role];
}

function rateLabel(type: RateType) {
  return { hourly: "por hora", daily: "por día", weekly: "por semana" }[type];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "2-digit" })
    .format(new Date(`${value}T12:00:00`));
}

function currency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(value);
}
