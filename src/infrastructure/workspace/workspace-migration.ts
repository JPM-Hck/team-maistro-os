import {
  INITIAL_EQUIPMENT_RECORDS,
} from "../../domain/equipment/types";
import {
  INITIAL_INVENTORY_RECORDS,
} from "../../domain/inventory/types";
import {
  INITIAL_PAYROLL_WORKERS,
  type PayrollWorker,
} from "../../domain/payroll/types";
import {
  CASA_LOMAS_PROJECT,
} from "../../domain/projects/types";
import {
  WORKSPACE_VERSION,
  type Employee,
  type MigrationReport,
  type PayrollEntry,
  type WorkspaceEquipmentItem,
  type WorkspaceProject,
  type WorkspaceState,
  type WorkspaceTask,
} from "../../domain/workspace/types";
import { EQUIPMENT_STORAGE_KEY } from "../equipment/local-storage-equipment-repository";
import { INVENTORY_STORAGE_KEY } from "../inventory/local-storage-inventory-repository";
import { PAYROLL_STORAGE_KEY } from "../payroll/local-storage-payroll-repository";
import {
  ACTIVE_PROJECT_STORAGE_KEY,
  PROJECTS_STORAGE_KEY,
} from "../projects/local-storage-project-repository";

export const WORKSPACE_STORAGE_KEY = "maistro.workspace.v2";
export const WORKSPACE_BACKUP_KEY = "maistro.workspace.v1.backup";

export interface WorkspaceRawStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface MigrationOptions {
  now?: () => Date;
  createId?: () => string;
}

export function migrateLegacyWorkspace(
  storage: WorkspaceRawStorage,
  options: MigrationOptions = {},
): WorkspaceState {
  const now = options.now ?? (() => new Date());
  const createId =
    options.createId ??
    (() =>
      globalThis.crypto?.randomUUID?.() ??
      `workspace-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const timestamp = now().toISOString();
  const legacy = {
    projects: storage.getItem(PROJECTS_STORAGE_KEY),
    activeProjectId: storage.getItem(ACTIVE_PROJECT_STORAGE_KEY),
    inventory: storage.getItem(INVENTORY_STORAGE_KEY),
    equipment: storage.getItem(EQUIPMENT_STORAGE_KEY),
    payroll: storage.getItem(PAYROLL_STORAGE_KEY),
  };

  if (!storage.getItem(WORKSPACE_BACKUP_KEY)) {
    storage.setItem(
      WORKSPACE_BACKUP_KEY,
      JSON.stringify({ backedUpAt: timestamp, keys: legacy }),
    );
  }

  const legacyProjects = parseArray(
    legacy.projects,
    [CASA_LOMAS_PROJECT],
  ).map((project) => ({
    ...project,
    id: project.id || createId(),
  }));
  const inventoryItems = parseArray(
    legacy.inventory,
    INITIAL_INVENTORY_RECORDS,
  ).map((item) => ({ ...item, id: item.id || createId() }));
  const legacyEquipment = parseArray(
    legacy.equipment,
    INITIAL_EQUIPMENT_RECORDS,
  ).map((item) => ({ ...item, id: item.id || createId() }));
  const legacyPayroll = parseArray(
    legacy.payroll,
    INITIAL_PAYROLL_WORKERS,
  ).map((worker) => ({ ...worker, id: worker.id || createId() }));

  const pendingReview: string[] = [];
  const duplicatesDetected = duplicateEmployeeNames(legacyPayroll);
  const employees = legacyPayroll.map((worker) =>
    employeeFromPayroll(worker, timestamp),
  );
  const payrollEntries = legacyPayroll.map((worker) =>
    payrollEntryFromWorker(worker, timestamp),
  );
  let employeesLinked = 0;

  function resolveEmployee(name: string, context: string) {
    if (!name.trim()) return null;
    const employee = matchEmployeeByName(employees, name);
    if (employee) {
      employeesLinked += 1;
      return employee.id;
    }
    pendingReview.push(`${context}: "${name}"`);
    return null;
  }

  const projects: WorkspaceProject[] = legacyProjects.map((project) => ({
    ...project,
    responsibleEmployeeId: resolveEmployee(
      project.responsible,
      `Responsable del proyecto ${project.code}`,
    ),
  }));

  const tasks: WorkspaceTask[] = projects
    .filter((project) => Boolean(project.currentTask?.trim()))
    .map((project) => {
      const isMarble = normalizeName(project.currentTask ?? "").includes(
        "marmol",
      );
      const assignee = isMarble
        ? matchEmployeeByName(employees, "Rubén")
        : null;
      if (isMarble && !assignee) {
        pendingReview.push(
          `Responsable de la tarea ${project.currentTask}: "Rubén"`,
        );
      }
      return {
        id: `task-migrated-${project.id}`,
        projectId: project.id,
        name: project.currentTask ?? "Avance migrado",
        description: "Tarea creada para conservar el avance anterior.",
        status: "draft",
        progress: project.progress,
        progressWeight: 1,
        quantity: isMarble ? 20 : 0,
        unit: isMarble ? "m²" : "",
        startDate: project.startDate,
        targetDate: project.targetDate,
        assigneeIds: assignee ? [assignee.id] : [],
        recipeId: isMarble ? "recipe-marble-v2" : null,
        equipmentItemIds: [],
        archived: false,
        needsReview: true,
        createdAt: project.createdAt || timestamp,
        updatedAt: project.updatedAt || timestamp,
      };
    });

  const equipmentItems: WorkspaceEquipmentItem[] = legacyEquipment.map(
    (item) => ({
      ...item,
      responsibleEmployeeId: resolveEmployee(
        item.responsible,
        `Responsable del equipo ${item.code}`,
      ),
      assignedProjectId: item.projectId,
      assignedTaskId: null,
    }),
  );
  const activeProjectId = selectActiveProjectId(
    projects,
    legacy.activeProjectId,
  );
  const migrationReport: MigrationReport = {
    migratedAt: timestamp,
    projectsMigrated: projects.length,
    inventoryItemsMigrated: inventoryItems.length,
    equipmentItemsMigrated: equipmentItems.length,
    payrollRecordsMigrated: payrollEntries.length,
    tasksMigrated: tasks.length,
    employeesLinked,
    pendingReview,
    duplicatesDetected,
  };
  const workspace: WorkspaceState = {
    version: WORKSPACE_VERSION,
    revision: 1,
    activeProjectId,
    projects,
    employees,
    tasks,
    inventoryItems,
    requisitions: [],
    equipmentItems,
    attendanceRecords: [],
    payrollEntries,
    demo: {
      phase: "unplanned",
      activeTaskId: tasks[0]?.id ?? null,
      activity: [
        `Proyecto ${projects.find((project) => project.id === activeProjectId)?.name ?? "sin asignar"} cargado desde el workspace.`,
      ],
    },
    migrationReport,
    updatedAt: timestamp,
  };
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  return clone(workspace);
}

export function normalizeWorkspace(
  input: WorkspaceState,
  timestamp = new Date().toISOString(),
): WorkspaceState {
  const employees = (input.employees ?? []).map((employee) => {
    const legacy = employee as Employee & {
      dailySalary?: number;
      fullName?: string;
    };
    return {
      ...employee,
      fullName: legacy.fullName ?? "",
      salaryType: employee.salaryType ?? "daily",
      salaryAmount:
        employee.salaryAmount ?? legacy.dailySalary ?? 0,
      overtimeRate: employee.overtimeRate ?? 0,
      needsReview: employee.needsReview ?? false,
    };
  });
  const projects = (input.projects ?? []).map((project) => {
    const legacyProject = project as WorkspaceProject & {
      legacyProgress?: number;
    };
    const responsibleEmployeeId =
      project.responsibleEmployeeId ?? null;
    return {
      ...project,
      responsible:
        employees.find(
          (employee) => employee.id === responsibleEmployeeId,
        )?.fullName ??
        project.responsible ??
        "",
      responsibleEmployeeId,
      progress: project.progress ?? legacyProject.legacyProgress ?? 0,
    };
  });
  const equipmentItems = (input.equipmentItems ?? []).map((item) => ({
    ...item,
    responsible:
      item.responsible ??
      employees.find(
        (employee) => employee.id === item.responsibleEmployeeId,
      )?.fullName ??
      "",
    responsibleEmployeeId: item.responsibleEmployeeId ?? null,
    projectId: item.projectId ?? item.assignedProjectId ?? null,
    assignedProjectId: item.assignedProjectId ?? item.projectId ?? null,
    assignedTaskId: item.assignedTaskId ?? null,
  }));
  const tasks = (input.tasks ?? []).map((task) => ({
    ...task,
    needsReview: task.needsReview ?? false,
  }));
  return {
    ...input,
    version: WORKSPACE_VERSION,
    revision: input.revision ?? 1,
    activeProjectId: selectActiveProjectId(
      projects,
      input.activeProjectId,
    ),
    projects,
    employees,
    tasks,
    inventoryItems: input.inventoryItems ?? [],
    requisitions: input.requisitions ?? [],
    equipmentItems,
    attendanceRecords: input.attendanceRecords ?? [],
    payrollEntries: (input.payrollEntries ?? []).map((entry) => {
      const legacy = entry as PayrollEntry & {
        dailySalarySnapshot?: number;
      };
      return {
        ...entry,
        salaryTypeSnapshot: entry.salaryTypeSnapshot ?? "daily",
        salaryAmountSnapshot:
          entry.salaryAmountSnapshot ??
          legacy.dailySalarySnapshot ??
          0,
        overtimeRateSnapshot: entry.overtimeRateSnapshot ?? 0,
      };
    }),
    demo: input.demo ?? {
      phase: "unplanned",
      activeTaskId: tasks[0]?.id ?? null,
      activity: ["Workspace recuperado."],
    },
    migrationReport: input.migrationReport ?? {
      migratedAt: timestamp,
      projectsMigrated: projects.length,
      inventoryItemsMigrated: input.inventoryItems?.length ?? 0,
      equipmentItemsMigrated: equipmentItems.length,
      payrollRecordsMigrated: input.payrollEntries?.length ?? 0,
      tasksMigrated: tasks.length,
      employeesLinked: 0,
      pendingReview: ["Workspace v2 anterior normalizado."],
      duplicatesDetected: [],
    },
    updatedAt: input.updatedAt ?? timestamp,
  };
}

export function matchEmployeeByName(
  employees: Employee[],
  visibleName: string,
) {
  const normalized = normalizeName(visibleName);
  const exact = employees.filter(
    (employee) => normalizeName(employee.fullName) === normalized,
  );
  if (exact.length === 1) return exact[0];

  const requested = normalized.split(" ").filter(Boolean);
  const candidates = employees.filter((employee) => {
    const candidate = normalizeName(employee.fullName)
      .split(" ")
      .filter(Boolean);
    if (requested.length === 1) return candidate[0] === requested[0];
    return (
      candidate[0] === requested[0] &&
      candidate[1]?.startsWith(requested[1]?.slice(0, 1) ?? "")
    );
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function employeeFromPayroll(
  worker: PayrollWorker,
  timestamp: string,
): Employee {
  return {
    id: worker.id,
    employeeCode: worker.employeeCode,
    fullName: worker.name,
    role: worker.position,
    specialty: worker.position,
    employmentStatus:
      worker.status === "archived" ? "archived" : "active",
    salaryType: worker.salaryType,
    salaryAmount: worker.salaryAmount,
    overtimeRate: 0,
    needsReview: false,
    createdAt: worker.createdAt || timestamp,
    updatedAt: worker.updatedAt || timestamp,
  };
}

function payrollEntryFromWorker(
  worker: PayrollWorker,
  timestamp: string,
): PayrollEntry {
  return {
    id: `payroll-current-${worker.id}`,
    employeeId: worker.id,
    projectId: worker.projectId,
    periodStart: "2026-07-20",
    periodEnd: "2026-07-25",
    scheduledDays: worker.scheduledDays,
    absenceDays: worker.absenceDays,
    overtimeHours: 0,
    salaryTypeSnapshot: worker.salaryType,
    salaryAmountSnapshot: worker.salaryAmount,
    overtimeRateSnapshot: 0,
    notes: worker.notes,
    createdAt: worker.createdAt || timestamp,
    updatedAt: worker.updatedAt || timestamp,
  };
}

function duplicateEmployeeNames(workers: PayrollWorker[]) {
  const counts = new Map<string, number>();
  workers.forEach((worker) => {
    const key = normalizeName(worker.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return workers
    .filter((worker) => (counts.get(normalizeName(worker.name)) ?? 0) > 1)
    .map(
      (worker) =>
        `Empleado duplicado: ${worker.name} (${worker.employeeCode})`,
    );
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .trim()
    .toLocaleLowerCase("es-MX")
    .replace(/\s+/g, " ");
}

function selectActiveProjectId(
  projects: WorkspaceProject[],
  savedId: string | null,
) {
  return (
    projects.find(
      (project) =>
        project.id === savedId && project.status !== "archived",
    )?.id ??
    projects.find((project) => project.status !== "archived")?.id ??
    null
  );
}

function parseArray<T>(raw: string | null, fallback: readonly T[]): T[] {
  if (!raw) return fallback.map((item) => clone(item));
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback.map((item) => clone(item));
    return parsed.map((item) => clone(item as T));
  } catch {
    return fallback.map((item) => clone(item));
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
