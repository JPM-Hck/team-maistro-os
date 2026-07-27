import type { EquipmentRecord } from "../../domain/equipment/types";
import type { InventoryRecord } from "../../domain/inventory/types";
import type { PayrollWorker } from "../../domain/payroll/types";
import type { Project } from "../../domain/projects/types";
import type {
  Employee,
  PayrollEntry,
  WorkspaceEquipmentItem,
  WorkspaceProject,
  WorkspaceState,
} from "../../domain/workspace/types";
import { EQUIPMENT_STORAGE_KEY } from "../equipment/local-storage-equipment-repository";
import { INVENTORY_STORAGE_KEY } from "../inventory/local-storage-inventory-repository";
import { PAYROLL_STORAGE_KEY } from "../payroll/local-storage-payroll-repository";
import {
  ACTIVE_PROJECT_STORAGE_KEY,
  PROJECTS_STORAGE_KEY,
} from "../projects/local-storage-project-repository";
import {
  migrateLegacyWorkspace,
  normalizeWorkspace,
  WORKSPACE_STORAGE_KEY,
  type MigrationOptions,
  type WorkspaceRawStorage,
} from "./workspace-migration";
import type { WorkspaceRepository } from "./workspace-repository";

export type WorkspaceListener = (workspace: WorkspaceState) => void;

export class WorkspaceBackedStorage implements WorkspaceRepository {
  private workspace: WorkspaceState;
  private readonly listeners = new Set<WorkspaceListener>();
  private readonly now: () => Date;
  private readonly storageHandler?: (event: StorageEvent) => void;

  constructor(
    private readonly rawStorage: WorkspaceRawStorage,
    options: MigrationOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.workspace = this.load(options);

    if (
      typeof window !== "undefined" &&
      rawStorage === window.localStorage
    ) {
      this.storageHandler = (event: StorageEvent) => {
        if (event.key !== WORKSPACE_STORAGE_KEY || !event.newValue) return;
        try {
          this.workspace = normalizeWorkspace(
            JSON.parse(event.newValue) as WorkspaceState,
            this.now().toISOString(),
          );
          this.notify();
        } catch {
          // La pestaña actual conserva el último snapshot válido.
        }
      };
      window.addEventListener("storage", this.storageHandler);
    }
  }

  getWorkspace() {
    return clone(this.workspace);
  }

  update(
    updater: (current: WorkspaceState) => WorkspaceState,
  ): WorkspaceState {
    const timestamp = this.now().toISOString();
    const next = normalizeWorkspace(
      updater(clone(this.workspace)),
      timestamp,
    );
    next.revision = this.workspace.revision + 1;
    next.updatedAt = timestamp;
    this.workspace = next;
    this.persist();
    this.notify();
    return clone(next);
  }

  subscribe(listener: WorkspaceListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getItem(key: string): string | null {
    switch (key) {
      case PROJECTS_STORAGE_KEY:
        return JSON.stringify(this.workspace.projects);
      case ACTIVE_PROJECT_STORAGE_KEY:
        return this.workspace.activeProjectId;
      case INVENTORY_STORAGE_KEY:
        return JSON.stringify(this.workspace.inventoryItems);
      case EQUIPMENT_STORAGE_KEY:
        return JSON.stringify(this.workspace.equipmentItems);
      case PAYROLL_STORAGE_KEY:
        return JSON.stringify(toPayrollWorkers(this.workspace));
      case WORKSPACE_STORAGE_KEY:
        return JSON.stringify(this.workspace);
      default:
        return this.rawStorage.getItem(key);
    }
  }

  setItem(key: string, value: string) {
    switch (key) {
      case PROJECTS_STORAGE_KEY:
        this.update((workspace) => ({
          ...workspace,
          projects: mergeProjects(
            workspace.projects,
            parse<Project[]>(value),
          ),
        }));
        return;
      case ACTIVE_PROJECT_STORAGE_KEY:
        this.update((workspace) => ({
          ...workspace,
          activeProjectId: value,
        }));
        return;
      case INVENTORY_STORAGE_KEY:
        this.update((workspace) => ({
          ...workspace,
          inventoryItems: parse<InventoryRecord[]>(value),
        }));
        return;
      case EQUIPMENT_STORAGE_KEY:
        this.update((workspace) => ({
          ...workspace,
          equipmentItems: mergeEquipment(
            workspace.equipmentItems,
            parse<EquipmentRecord[]>(value),
          ),
        }));
        return;
      case PAYROLL_STORAGE_KEY:
        this.update((workspace) =>
          applyPayrollWorkers(
            workspace,
            parse<PayrollWorker[]>(value),
          ),
        );
        return;
      case WORKSPACE_STORAGE_KEY:
        this.workspace = normalizeWorkspace(
          parse<WorkspaceState>(value),
          this.now().toISOString(),
        );
        this.persist();
        this.notify();
        return;
      default:
        this.rawStorage.setItem(key, value);
    }
  }

  removeItem(key: string) {
    if (key === ACTIVE_PROJECT_STORAGE_KEY) {
      this.update((workspace) => ({
        ...workspace,
        activeProjectId: null,
      }));
      return;
    }
    this.rawStorage.removeItem?.(key);
  }

  destroy() {
    if (this.storageHandler && typeof window !== "undefined") {
      window.removeEventListener("storage", this.storageHandler);
    }
    this.listeners.clear();
  }

  private load(options: MigrationOptions) {
    const raw = this.rawStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return migrateLegacyWorkspace(this.rawStorage, options);
    try {
      const parsed = JSON.parse(raw) as WorkspaceState;
      if (parsed.version !== 2) {
        throw new Error("La versión del workspace no es compatible.");
      }
      const normalized = normalizeWorkspace(
        parsed,
        this.now().toISOString(),
      );
      this.rawStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify(normalized),
      );
      return normalized;
    } catch (cause) {
      if (
        cause instanceof Error &&
        cause.message.includes("no es compatible")
      ) {
        throw cause;
      }
      throw new Error(
        "No se pudo leer maistro.workspace.v2. El respaldo anterior permanece intacto.",
      );
    }
  }

  private persist() {
    this.rawStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(this.workspace),
    );
  }

  private notify() {
    const snapshot = this.getWorkspace();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

let browserWorkspace: WorkspaceBackedStorage | null = null;

export function getBrowserWorkspaceStorage() {
  if (typeof window === "undefined") {
    throw new Error("El workspace local solo está disponible en el navegador.");
  }
  browserWorkspace ??= new WorkspaceBackedStorage(window.localStorage);
  return browserWorkspace;
}

function mergeProjects(
  current: WorkspaceProject[],
  next: Project[],
): WorkspaceProject[] {
  const currentById = new Map(current.map((project) => [project.id, project]));
  return next.map((project) => ({
    ...project,
    responsibleEmployeeId:
      currentById.get(project.id)?.responsibleEmployeeId ?? null,
  }));
}

function mergeEquipment(
  current: WorkspaceEquipmentItem[],
  next: EquipmentRecord[],
): WorkspaceEquipmentItem[] {
  const currentById = new Map(current.map((item) => [item.id, item]));
  return next.map((item) => {
    const previous = currentById.get(item.id);
    return {
      ...item,
      responsibleEmployeeId: previous?.responsibleEmployeeId ?? null,
      assignedProjectId: item.projectId,
      assignedTaskId: previous?.assignedTaskId ?? null,
    };
  });
}

function toPayrollWorkers(workspace: WorkspaceState): PayrollWorker[] {
  return workspace.payrollEntries
    .map((entry) => {
      const employee = workspace.employees.find(
        (candidate) => candidate.id === entry.employeeId,
      );
      if (!employee) return null;
      return {
        id: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.fullName,
        position: employee.role,
        projectId: entry.projectId,
        salaryType: employee.salaryType,
        salaryAmount: employee.salaryAmount,
        scheduledDays: entry.scheduledDays,
        absenceDays: entry.absenceDays,
        notes: entry.notes,
        status: employee.employmentStatus,
        createdAt: employee.createdAt,
        updatedAt:
          employee.updatedAt > entry.updatedAt
            ? employee.updatedAt
            : entry.updatedAt,
      } satisfies PayrollWorker;
    })
    .filter((worker): worker is PayrollWorker => Boolean(worker));
}

function applyPayrollWorkers(
  workspace: WorkspaceState,
  workers: PayrollWorker[],
): WorkspaceState {
  const employeeById = new Map(
    workspace.employees.map((employee) => [employee.id, employee]),
  );
  const entryByEmployeeId = new Map(
    workspace.payrollEntries.map((entry) => [entry.employeeId, entry]),
  );
  const workerIds = new Set(workers.map((worker) => worker.id));
  const employees: Employee[] = [
    ...workers.map((worker) => {
      const current = employeeById.get(worker.id);
      return {
        id: worker.id,
        employeeCode: worker.employeeCode,
        fullName: worker.name,
        role: worker.position,
        specialty: current?.specialty ?? worker.position,
        employmentStatus: worker.status,
        salaryType: worker.salaryType,
        salaryAmount: worker.salaryAmount,
        overtimeRate: current?.overtimeRate ?? 0,
        needsReview: current?.needsReview ?? false,
        createdAt: worker.createdAt,
        updatedAt: worker.updatedAt,
      };
    }),
    ...workspace.employees.filter(
      (employee) => !workerIds.has(employee.id),
    ),
  ];
  const payrollEntries: PayrollEntry[] = [
    ...workers.map((worker) => {
      const current = entryByEmployeeId.get(worker.id);
      return {
        id: current?.id ?? `payroll-current-${worker.id}`,
        employeeId: worker.id,
        projectId: worker.projectId,
        periodStart: current?.periodStart ?? "2026-07-20",
        periodEnd: current?.periodEnd ?? "2026-07-25",
        scheduledDays: worker.scheduledDays,
        absenceDays: worker.absenceDays,
        overtimeHours: current?.overtimeHours ?? 0,
        salaryTypeSnapshot: worker.salaryType,
        salaryAmountSnapshot: worker.salaryAmount,
        overtimeRateSnapshot: current?.overtimeRateSnapshot ?? 0,
        notes: worker.notes,
        createdAt: current?.createdAt ?? worker.createdAt,
        updatedAt: worker.updatedAt,
      };
    }),
    ...workspace.payrollEntries.filter(
      (entry) => !workerIds.has(entry.employeeId),
    ),
  ];
  return { ...workspace, employees, payrollEntries };
}

function parse<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error("El adaptador recibió datos con formato inválido.");
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
