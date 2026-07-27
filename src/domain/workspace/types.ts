import type { EquipmentRecord } from "../equipment/types";
import type { InventoryRecord } from "../inventory/types";
import type { RequisitionStatus, TaskStatus } from "../operations";
import type { SalaryType } from "../payroll/types";
import type { Project } from "../projects/types";

export const WORKSPACE_VERSION = 2 as const;

export interface WorkspaceProject extends Project {
  responsibleEmployeeId: string | null;
}

export type EmploymentStatus = "active" | "archived";

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  specialty: string;
  employmentStatus: EmploymentStatus;
  salaryType: SalaryType;
  salaryAmount: number;
  overtimeRate: number;
  needsReview: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceTask {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: TaskStatus;
  progress: number;
  progressWeight: number;
  quantity: number;
  unit: string;
  startDate: string;
  targetDate: string;
  assigneeIds: string[];
  recipeId: string | null;
  equipmentItemIds: string[];
  archived: boolean;
  needsReview: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceInventoryItem = InventoryRecord;

export interface RequisitionItem {
  inventoryItemId: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  receivedQuantity: number;
}

export interface PurchaseRequisition {
  id: string;
  folio: string;
  projectId: string;
  taskId: string;
  status: RequisitionStatus;
  items: RequisitionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceEquipmentItem extends EquipmentRecord {
  responsibleEmployeeId: string | null;
  assignedProjectId: string | null;
  assignedTaskId: string | null;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  projectId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: "present" | "absent" | "late" | "incomplete" | "excused";
  overtimeHours: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  projectId: string | null;
  periodStart: string;
  periodEnd: string;
  scheduledDays: number;
  absenceDays: number;
  overtimeHours: number;
  salaryTypeSnapshot: SalaryType;
  salaryAmountSnapshot: number;
  overtimeRateSnapshot: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MigrationReport {
  migratedAt: string;
  projectsMigrated: number;
  inventoryItemsMigrated: number;
  equipmentItemsMigrated: number;
  payrollRecordsMigrated: number;
  tasksMigrated: number;
  employeesLinked: number;
  pendingReview: string[];
  duplicatesDetected: string[];
}

export type WorkspaceDemoPhase =
  | "unplanned"
  | "blocked"
  | "received"
  | "ready";

export interface WorkspaceDemoState {
  phase: WorkspaceDemoPhase;
  activeTaskId: string | null;
  activity: string[];
}

export interface WorkspaceState {
  version: typeof WORKSPACE_VERSION;
  revision: number;
  activeProjectId: string | null;
  projects: WorkspaceProject[];
  employees: Employee[];
  tasks: WorkspaceTask[];
  inventoryItems: WorkspaceInventoryItem[];
  requisitions: PurchaseRequisition[];
  equipmentItems: WorkspaceEquipmentItem[];
  attendanceRecords: AttendanceRecord[];
  payrollEntries: PayrollEntry[];
  demo: WorkspaceDemoState;
  migrationReport: MigrationReport;
  updatedAt: string;
}
