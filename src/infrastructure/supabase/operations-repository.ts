import "server-only";

import type {
  ApprovalStatus,
  AttendanceRecord,
  AttendanceStatus,
  InventoryCatalogItem,
  OperationsSnapshot,
  PayrollEntry,
  PayrollPeriod,
  PayrollStatus,
  Project,
  ProjectAssignment,
  ProjectInventoryUsage,
  ProjectStatus,
  RateType,
  Worker,
  WorkerRate,
} from "@/domain/entities";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

function text(row: Row, key: string) {
  return String(row[key] ?? "");
}

function nullableText(row: Row, key: string) {
  return row[key] == null ? null : String(row[key]);
}

function number(row: Row, key: string) {
  return Number(row[key] ?? 0);
}

function boolean(row: Row, key: string) {
  return Boolean(row[key]);
}

function rows(value: unknown) {
  return (value ?? []) as Row[];
}

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const profileResult = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", data.user.id)
    .single();
  if (profileResult.error || !profileResult.data?.active) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    fullName: String(profileResult.data.full_name),
    role: profileResult.data.role as OperationsSnapshot["role"],
  };
}

export async function getOperationsSnapshot(
  role: OperationsSnapshot["role"],
): Promise<OperationsSnapshot> {
  const supabase = await createClient();
  const [
    projectsResult,
    workersResult,
    ratesResult,
    assignmentsResult,
    inventoryResult,
    usageResult,
    attendanceResult,
    periodsResult,
    payrollEntriesResult,
  ] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("workers").select("*").order("full_name"),
    role === "administrator"
      ? supabase.from("worker_rates").select("*").order("effective_from", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("project_assignments").select("*").order("starts_on", { ascending: false }),
    supabase.from("inventory_items").select("*").order("name"),
    supabase.from("project_inventory_usage").select("*"),
    role === "warehouse"
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("attendance_records").select("*").order("work_date", { ascending: false }),
    role === "administrator"
      ? supabase.from("payroll_periods").select("*").order("week_start", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    role === "administrator"
      ? supabase.from("payroll_entries").select("*")
      : Promise.resolve({ data: [], error: null }),
  ]);

  const error = [
    projectsResult.error,
    workersResult.error,
    ratesResult.error,
    assignmentsResult.error,
    inventoryResult.error,
    usageResult.error,
    attendanceResult.error,
    periodsResult.error,
    payrollEntriesResult.error,
  ].find(Boolean);
  if (error) throw new Error(`No fue posible cargar la operación: ${error.message}`);

  const projects: Project[] = rows(projectsResult.data).map((row) => ({
    id: text(row, "id"),
    name: text(row, "name"),
    clientName: text(row, "client_name"),
    publicAddress: text(row, "public_address"),
    budget: number(row, "budget"),
    startsOn: text(row, "starts_on"),
    targetEndOn: text(row, "target_end_on"),
    ownerId: nullableText(row, "owner_id"),
    status: text(row, "status") as ProjectStatus,
  }));

  const workers: Worker[] = rows(workersResult.data).map((row) => ({
    id: text(row, "id"),
    fullName: text(row, "full_name"),
    specialty: text(row, "specialty"),
    active: boolean(row, "active"),
  }));

  const workerRates: WorkerRate[] = rows(ratesResult.data).map((row) => ({
    id: text(row, "id"),
    workerId: text(row, "worker_id"),
    rateType: text(row, "rate_type") as RateType,
    amount: number(row, "amount"),
    effectiveFrom: text(row, "effective_from"),
    effectiveTo: nullableText(row, "effective_to"),
  }));

  const assignments: ProjectAssignment[] = rows(assignmentsResult.data).map((row) => ({
    id: text(row, "id"),
    workerId: text(row, "worker_id"),
    projectId: text(row, "project_id"),
    role: text(row, "role"),
    startsOn: text(row, "starts_on"),
    endsOn: text(row, "ends_on"),
    schedule: text(row, "schedule"),
    active: boolean(row, "active"),
  }));

  const inventory: InventoryCatalogItem[] = rows(inventoryResult.data).map((row) => ({
    id: text(row, "id"),
    sku: text(row, "sku"),
    name: text(row, "name"),
    unit: text(row, "unit"),
    physicalStock: number(row, "physical_stock"),
    reservedStock: number(row, "reserved_stock"),
    safetyStock: number(row, "safety_stock"),
    averageCost: number(row, "average_cost"),
    location: text(row, "location"),
    active: boolean(row, "active"),
  }));

  const projectUsage: ProjectInventoryUsage[] = rows(usageResult.data).map((row) => ({
    inventoryItemId: text(row, "inventory_item_id"),
    projectId: text(row, "project_id"),
    projectName: text(row, "project_name"),
    reservedQuantity: number(row, "reserved_quantity"),
    consumedQuantity: number(row, "consumed_quantity"),
  }));

  const attendance: AttendanceRecord[] = rows(attendanceResult.data).map((row) => ({
    id: text(row, "id"),
    workerId: text(row, "worker_id"),
    projectId: text(row, "project_id"),
    workDate: text(row, "work_date"),
    checkIn: nullableText(row, "check_in"),
    checkOut: nullableText(row, "check_out"),
    status: text(row, "status") as AttendanceStatus,
    approvalStatus: text(row, "approval_status") as ApprovalStatus,
    notes: text(row, "notes"),
  }));

  const payrollPeriods: PayrollPeriod[] = rows(periodsResult.data).map((row) => ({
    id: text(row, "id"),
    weekStart: text(row, "week_start"),
    weekEnd: text(row, "week_end"),
    status: text(row, "status") as PayrollStatus,
  }));

  const payrollEntries: PayrollEntry[] = rows(payrollEntriesResult.data).map((row) => ({
    payrollPeriodId: text(row, "payroll_period_id"),
    workerId: text(row, "worker_id"),
    rateType: text(row, "rate_type") as RateType,
    baseAmount: number(row, "base_amount"),
    overtimeAmount: number(row, "overtime_amount"),
    bonuses: number(row, "bonuses"),
    absenceDeductions: number(row, "absence_deductions"),
    tardinessDeductions: number(row, "tardiness_deductions"),
    otherAdjustments: number(row, "other_adjustments"),
    netAmount: number(row, "net_amount"),
    breakdown: (row.breakdown ?? {}) as Record<string, number | string>,
  }));

  return {
    role,
    projects,
    workers,
    workerRates,
    assignments,
    inventory,
    projectUsage,
    attendance,
    payrollPeriods,
    payrollEntries,
  };
}
