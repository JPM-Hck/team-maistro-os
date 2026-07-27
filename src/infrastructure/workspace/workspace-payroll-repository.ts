import {
  assertValidPayrollWorker,
  normalizePayrollWorkerInput,
} from "../../domain/payroll/payroll-validation";
import {
  type PayrollWorker,
  type PayrollWorkerChanges,
  type PayrollWorkerInput,
  toPayrollWorkerInput,
} from "../../domain/payroll/types";
import type {
  Employee,
  PayrollEntry,
  WorkspaceState,
} from "../../domain/workspace/types";
import type { PayrollRepository } from "../payroll/payroll-repository";
import type { WorkspaceBackedStorage } from "./workspace-storage";

export interface WorkspacePayrollRepositoryOptions {
  now?: () => Date;
  createId?: () => string;
}

export class WorkspacePayrollRepository implements PayrollRepository {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly workspace: WorkspaceBackedStorage,
    options: WorkspacePayrollRepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId =
      options.createId ??
      (() =>
        globalThis.crypto?.randomUUID?.() ??
        `worker-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

  async getAll(): Promise<PayrollWorker[]> {
    return payrollWorkers(this.workspace.getWorkspace());
  }

  async getById(id: string): Promise<PayrollWorker | null> {
    return (await this.getAll()).find((worker) => worker.id === id) ?? null;
  }

  async create(input: PayrollWorkerInput): Promise<PayrollWorker> {
    const workers = await this.getAll();
    const normalized = normalizePayrollWorkerInput(input);
    assertValidPayrollWorker(normalized, workers);

    const timestamp = this.now().toISOString();
    const employeeId = this.createId();
    const employee: Employee = {
      id: employeeId,
      employeeCode: normalized.employeeCode,
      fullName: normalized.name,
      role: normalized.position,
      specialty: normalized.position,
      employmentStatus: normalized.status,
      salaryType: normalized.salaryType,
      salaryAmount: normalized.salaryAmount,
      overtimeRate: 0,
      needsReview: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const entry = createPayrollEntry(employee, normalized, timestamp);

    this.workspace.update((workspace) => ({
      ...workspace,
      employees: [...workspace.employees, employee],
      payrollEntries: [...workspace.payrollEntries, entry],
    }));
    return workerFrom(employee, entry);
  }

  async update(
    id: string,
    changes: PayrollWorkerChanges,
  ): Promise<PayrollWorker> {
    const workspace = this.workspace.getWorkspace();
    const employee = workspace.employees.find((candidate) => candidate.id === id);
    if (!employee) throw new Error("La persona ya no existe.");

    const current = workerFrom(
      employee,
      currentPayrollEntry(workspace.payrollEntries, employee.id),
    );
    const normalized = normalizePayrollWorkerInput({
      ...toPayrollWorkerInput(current),
      ...changes,
    });
    assertValidPayrollWorker(normalized, await this.getAll(), id);

    const timestamp = this.now().toISOString();
    const updatedEmployee: Employee = {
      ...employee,
      employeeCode: normalized.employeeCode,
      fullName: normalized.name,
      role: normalized.position,
      specialty: employee.specialty || normalized.position,
      employmentStatus: normalized.status,
      salaryType: normalized.salaryType,
      salaryAmount: normalized.salaryAmount,
      updatedAt: timestamp,
    };
    const existingEntry = currentPayrollEntry(
      workspace.payrollEntries,
      employee.id,
    );
    const updatedEntry: PayrollEntry = existingEntry
      ? {
          ...existingEntry,
          projectId: normalized.projectId,
          scheduledDays: normalized.scheduledDays,
          absenceDays: normalized.absenceDays,
          notes: normalized.notes,
          updatedAt: timestamp,
        }
      : createPayrollEntry(updatedEmployee, normalized, timestamp);

    this.workspace.update((currentWorkspace) => ({
      ...currentWorkspace,
      employees: currentWorkspace.employees.map((candidate) =>
        candidate.id === id ? updatedEmployee : candidate,
      ),
      payrollEntries: existingEntry
        ? currentWorkspace.payrollEntries.map((entry) =>
            entry.id === existingEntry.id ? updatedEntry : entry,
          )
        : [...currentWorkspace.payrollEntries, updatedEntry],
    }));
    return workerFrom(updatedEmployee, updatedEntry);
  }

  async archive(id: string): Promise<PayrollWorker> {
    return this.update(id, { status: "archived" });
  }

  subscribe(listener: () => void) {
    return this.workspace.subscribe(listener);
  }
}

function payrollWorkers(workspace: WorkspaceState): PayrollWorker[] {
  return workspace.employees.map((employee) =>
    workerFrom(
      employee,
      currentPayrollEntry(workspace.payrollEntries, employee.id),
    ),
  );
}

function currentPayrollEntry(
  entries: PayrollEntry[],
  employeeId: string,
): PayrollEntry | undefined {
  return entries
    .filter((entry) => entry.employeeId === employeeId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function workerFrom(
  employee: Employee,
  entry?: PayrollEntry,
): PayrollWorker {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    name: employee.fullName,
    position: employee.role,
    projectId: entry?.projectId ?? null,
    salaryType: employee.salaryType,
    salaryAmount: employee.salaryAmount,
    scheduledDays: entry?.scheduledDays ?? 6,
    absenceDays: entry?.absenceDays ?? 0,
    notes: entry?.notes ?? "",
    status: employee.employmentStatus,
    createdAt: employee.createdAt,
    updatedAt:
      entry && entry.updatedAt > employee.updatedAt
        ? entry.updatedAt
        : employee.updatedAt,
  };
}

function createPayrollEntry(
  employee: Employee,
  input: PayrollWorkerInput,
  timestamp: string,
): PayrollEntry {
  return {
    id: `payroll-current-${employee.id}`,
    employeeId: employee.id,
    projectId: input.projectId,
    periodStart: "2026-07-20",
    periodEnd: "2026-07-25",
    scheduledDays: input.scheduledDays,
    absenceDays: input.absenceDays,
    overtimeHours: 0,
    salaryTypeSnapshot: employee.salaryType,
    salaryAmountSnapshot: employee.salaryAmount,
    overtimeRateSnapshot: employee.overtimeRate,
    notes: input.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
