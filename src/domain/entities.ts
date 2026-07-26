export type ProjectStatus = "draft" | "active" | "paused" | "completed" | "cancelled";
export type RateType = "hourly" | "daily" | "weekly";
export type AttendanceStatus = "present" | "partial" | "absent" | "leave" | "rest";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PayrollStatus = "open" | "in_review" | "approved" | "closed";

export interface Project {
  id: string;
  name: string;
  clientName: string;
  publicAddress: string;
  budget: number;
  startsOn: string;
  targetEndOn: string;
  ownerId: string | null;
  status: ProjectStatus;
}

export interface Worker {
  id: string;
  fullName: string;
  specialty: string;
  active: boolean;
}

export interface WorkerRate {
  id: string;
  workerId: string;
  rateType: RateType;
  amount: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface ProjectAssignment {
  id: string;
  workerId: string;
  projectId: string;
  role: string;
  startsOn: string;
  endsOn: string;
  schedule: string;
  active: boolean;
}

export interface InventoryCatalogItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  physicalStock: number;
  reservedStock: number;
  safetyStock: number;
  averageCost: number;
  location: string;
  active: boolean;
}

export interface ProjectInventoryUsage {
  inventoryItemId: string;
  projectId: string;
  projectName: string;
  reservedQuantity: number;
  consumedQuantity: number;
}

export interface AttendanceRecord {
  id: string;
  workerId: string;
  projectId: string;
  workDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  approvalStatus: ApprovalStatus;
  notes: string;
}

export interface PayrollPeriod {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: PayrollStatus;
}

export interface PayrollEntry {
  payrollPeriodId?: string;
  workerId: string;
  rateType: RateType;
  baseAmount: number;
  overtimeAmount: number;
  bonuses: number;
  absenceDeductions: number;
  tardinessDeductions: number;
  otherAdjustments: number;
  netAmount: number;
  breakdown: Record<string, number | string>;
}

export interface OperationsSnapshot {
  role: "administrator" | "supervisor" | "warehouse";
  projects: Project[];
  workers: Worker[];
  workerRates: WorkerRate[];
  assignments: ProjectAssignment[];
  inventory: InventoryCatalogItem[];
  projectUsage: ProjectInventoryUsage[];
  attendance: AttendanceRecord[];
  payrollPeriods: PayrollPeriod[];
  payrollEntries: PayrollEntry[];
}
