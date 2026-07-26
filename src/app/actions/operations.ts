"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PayrollEntry } from "@/domain/entities";
import { calculateWorkerPayroll } from "@/domain/payroll";
import { validateProjectDates } from "@/domain/workforce";
import {
  getAuthenticatedUser,
  getOperationsSnapshot,
} from "@/infrastructure/supabase/operations-repository";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const uuid = z.uuid("Identificador inválido.");
const requiredText = z.string().trim().min(1, "Este campo es obligatorio.");
const dateText = z.iso.date("Fecha inválida.");

const projectSchema = z.object({
  id: uuid.optional(),
  name: requiredText,
  clientName: requiredText,
  publicAddress: z.string().trim(),
  budget: z.number().nonnegative(),
  startsOn: dateText,
  targetEndOn: dateText,
  status: z.enum(["draft", "active", "paused", "completed", "cancelled"]),
});

const workerSchema = z.object({
  id: uuid.optional(),
  fullName: requiredText,
  specialty: requiredText,
  rateType: z.enum(["hourly", "daily", "weekly"]).optional(),
  amount: z.number().positive().optional(),
  effectiveFrom: dateText.optional(),
});

async function requireRole(roles: Array<"administrator" | "supervisor" | "warehouse">) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
  if (!roles.includes(user.role)) throw new Error("No tienes permiso para realizar esta acción.");
  return user;
}

function errorResult(error: unknown): ActionResult {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "No fue posible completar la operación.",
  };
}

function refresh(message: string): ActionResult {
  revalidatePath("/");
  return { ok: true, message };
}

export async function saveProjectAction(input: z.input<typeof projectSchema>): Promise<ActionResult> {
  try {
    const user = await requireRole(["administrator", "supervisor"]);
    const project = projectSchema.parse(input);
    validateProjectDates(project.startsOn, project.targetEndOn);
    const supabase = await createClient();
    const payload = {
      name: project.name,
      client_name: project.clientName,
      public_address: project.publicAddress || null,
      budget: project.budget,
      starts_on: project.startsOn,
      target_end_on: project.targetEndOn,
      status: project.status,
      owner_id: user.id,
    };
    const result = project.id
      ? await supabase.from("projects").update(payload).eq("id", project.id)
      : await supabase.from("projects").insert(payload);
    if (result.error) throw new Error(result.error.message);
    return refresh(project.id ? "Proyecto actualizado." : "Proyecto creado.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function archiveProjectAction(id: string, reason: string): Promise<ActionResult> {
  try {
    await requireRole(["administrator", "supervisor"]);
    const supabase = await createClient();
    const result = await supabase.rpc("archive_project", {
      p_project_id: uuid.parse(id),
      p_reason: requiredText.parse(reason),
    });
    if (result.error) throw new Error(result.error.message);
    return refresh("Proyecto archivado sin borrar su historial.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function saveWorkerAction(input: z.input<typeof workerSchema>): Promise<ActionResult> {
  try {
    await requireRole(["administrator"]);
    const worker = workerSchema.parse(input);
    const supabase = await createClient();

    if (worker.id) {
      const result = await supabase
        .from("workers")
        .update({ full_name: worker.fullName, specialty: worker.specialty })
        .eq("id", worker.id);
      if (result.error) throw new Error(result.error.message);
      return refresh("Trabajador actualizado.");
    }

    if (!worker.rateType || !worker.amount || !worker.effectiveFrom) {
      throw new Error("La tarifa inicial y su vigencia son obligatorias.");
    }
    const created = await supabase
      .from("workers")
      .insert({ full_name: worker.fullName, specialty: worker.specialty })
      .select("id")
      .single();
    if (created.error) throw new Error(created.error.message);

    const rate = await supabase.rpc("change_worker_rate", {
      p_worker_id: created.data.id,
      p_rate_type: worker.rateType,
      p_amount: worker.amount,
      p_effective_from: worker.effectiveFrom,
    });
    if (rate.error) {
      await supabase.from("workers").delete().eq("id", created.data.id);
      throw new Error(rate.error.message);
    }
    return refresh("Trabajador y tarifa inicial creados.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function changeWorkerRateAction(input: {
  workerId: string;
  rateType: "hourly" | "daily" | "weekly";
  amount: number;
  effectiveFrom: string;
}): Promise<ActionResult> {
  try {
    await requireRole(["administrator"]);
    const parsed = z.object({
      workerId: uuid,
      rateType: z.enum(["hourly", "daily", "weekly"]),
      amount: z.number().positive(),
      effectiveFrom: dateText,
    }).parse(input);
    const supabase = await createClient();
    const result = await supabase.rpc("change_worker_rate", {
      p_worker_id: parsed.workerId,
      p_rate_type: parsed.rateType,
      p_amount: parsed.amount,
      p_effective_from: parsed.effectiveFrom,
    });
    if (result.error) throw new Error(result.error.message);
    return refresh("Nueva tarifa vigente registrada.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function archiveWorkerAction(id: string, reason: string): Promise<ActionResult> {
  try {
    await requireRole(["administrator"]);
    const supabase = await createClient();
    const result = await supabase.rpc("archive_worker", {
      p_worker_id: uuid.parse(id),
      p_reason: requiredText.parse(reason),
    });
    if (result.error) throw new Error(result.error.message);
    return refresh("Trabajador dado de baja; su historial permanece disponible.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function assignWorkerAction(input: {
  workerId: string;
  projectId: string;
  role: string;
  startsOn: string;
  endsOn: string;
  schedule: string;
}): Promise<ActionResult> {
  try {
    const user = await requireRole(["administrator", "supervisor"]);
    const parsed = z.object({
      workerId: uuid,
      projectId: uuid,
      role: requiredText,
      startsOn: dateText,
      endsOn: dateText,
      schedule: requiredText,
    }).parse(input);
    validateProjectDates(parsed.startsOn, parsed.endsOn);
    const supabase = await createClient();
    const result = await supabase.from("project_assignments").insert({
      worker_id: parsed.workerId,
      project_id: parsed.projectId,
      role: parsed.role,
      starts_on: parsed.startsOn,
      ends_on: parsed.endsOn,
      schedule: parsed.schedule,
      created_by: user.id,
    });
    if (result.error) throw new Error(
      result.error.code === "23P01"
        ? "El trabajador ya tiene una asignación en esas fechas."
        : result.error.message,
    );
    return refresh("Trabajador asignado al proyecto.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function saveInventoryItemAction(input: {
  id?: string;
  sku: string;
  name: string;
  unit: string;
  safetyStock: number;
  averageCost: number;
  location: string;
}): Promise<ActionResult> {
  try {
    await requireRole(["administrator", "warehouse"]);
    const parsed = z.object({
      id: uuid.optional(),
      sku: requiredText,
      name: requiredText,
      unit: requiredText,
      safetyStock: z.number().nonnegative(),
      averageCost: z.number().nonnegative(),
      location: z.string().trim(),
    }).parse(input);
    const supabase = await createClient();
    const payload = {
      sku: parsed.sku,
      name: parsed.name,
      unit: parsed.unit,
      safety_stock: parsed.safetyStock,
      average_cost: parsed.averageCost,
      location: parsed.location || null,
    };
    const result = parsed.id
      ? await supabase.from("inventory_items").update(payload).eq("id", parsed.id)
      : await supabase.from("inventory_items").insert(payload);
    if (result.error) throw new Error(result.error.message);
    return refresh(parsed.id ? "Artículo actualizado." : "Artículo creado.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function recordInventoryMovementAction(input: {
  inventoryItemId: string;
  movementType: "receipt" | "issue" | "consume" | "adjustment";
  direction: "in" | "out";
  quantity: number;
  reason: string;
  projectId?: string | null;
}): Promise<ActionResult> {
  try {
    await requireRole(["administrator", "warehouse"]);
    const parsed = z.object({
      inventoryItemId: uuid,
      movementType: z.enum(["receipt", "issue", "consume", "adjustment"]),
      direction: z.enum(["in", "out"]),
      quantity: z.number().positive(),
      reason: requiredText,
      projectId: uuid.nullish(),
    }).parse(input);
    const supabase = await createClient();
    const result = await supabase.rpc("record_inventory_movement", {
      p_inventory_item_id: parsed.inventoryItemId,
      p_movement_type: parsed.movementType,
      p_direction: parsed.direction,
      p_quantity: parsed.quantity,
      p_reason: parsed.reason,
      p_project_id: parsed.projectId ?? null,
      p_task_id: null,
      p_requisition_id: null,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (result.error) throw new Error(result.error.message);
    return refresh("Movimiento de inventario registrado.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function archiveInventoryItemAction(id: string, reason: string): Promise<ActionResult> {
  try {
    await requireRole(["administrator", "warehouse"]);
    const supabase = await createClient();
    const result = await supabase.rpc("archive_inventory_item", {
      p_inventory_item_id: uuid.parse(id),
      p_reason: requiredText.parse(reason),
    });
    if (result.error) throw new Error(result.error.message);
    return refresh("Artículo archivado.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function saveAttendanceAction(input: {
  workerId: string;
  projectId: string;
  workDate: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: "present" | "partial" | "absent" | "leave" | "rest";
  notes: string;
}): Promise<ActionResult> {
  try {
    const user = await requireRole(["administrator", "supervisor"]);
    const parsed = z.object({
      workerId: uuid,
      projectId: uuid,
      workDate: dateText,
      checkIn: z.string().nullable().optional(),
      checkOut: z.string().nullable().optional(),
      status: z.enum(["present", "partial", "absent", "leave", "rest"]),
      notes: z.string().trim(),
    }).parse(input);
    const needsTime = parsed.status === "present" || parsed.status === "partial";
    if (needsTime && (!parsed.checkIn || !parsed.checkOut)) {
      throw new Error("Entrada y salida son obligatorias para asistencia presente o parcial.");
    }
    const supabase = await createClient();
    const result = await supabase.from("attendance_records").insert({
      worker_id: parsed.workerId,
      project_id: parsed.projectId,
      work_date: parsed.workDate,
      check_in: parsed.checkIn || null,
      check_out: parsed.checkOut || null,
      status: parsed.status,
      notes: parsed.notes,
      created_by: user.id,
    });
    if (result.error) throw new Error(
      result.error.code === "23505"
        ? "Ya existe una asistencia para ese trabajador y fecha."
        : result.error.message,
    );
    return refresh("Asistencia registrada para revisión.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function approveAttendanceAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireRole(["administrator", "supervisor"]);
    const supabase = await createClient();
    const result = await supabase.from("attendance_records").update({
      approval_status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    }).eq("id", uuid.parse(id));
    if (result.error) throw new Error(result.error.message);
    return refresh("Asistencia aprobada.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function createPayrollPeriodAction(weekStart: string): Promise<ActionResult> {
  try {
    const user = await requireRole(["administrator"]);
    const start = dateText.parse(weekStart);
    const end = new Date(`${start}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    const supabase = await createClient();
    const result = await supabase.from("payroll_periods").insert({
      week_start: start,
      week_end: end.toISOString().slice(0, 10),
      created_by: user.id,
    });
    if (result.error) throw new Error(
      result.error.code === "23505" ? "Ya existe una nómina para esa semana." : result.error.message,
    );
    return refresh("Periodo semanal creado.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function calculatePayrollAction(periodId: string): Promise<ActionResult> {
  try {
    await requireRole(["administrator"]);
    const snapshot = await getOperationsSnapshot("administrator");
    const period = snapshot.payrollPeriods.find((item) => item.id === uuid.parse(periodId));
    if (!period) throw new Error("Periodo inexistente.");
    if (period.status === "closed") throw new Error("Una nómina cerrada no se recalcula.");

    const supabase = await createClient();
    const settingsResult = await supabase.from("payroll_settings").select("*").single();
    if (settingsResult.error) throw new Error(settingsResult.error.message);
    const settings = settingsResult.data;
    const periodAttendance = snapshot.attendance.filter(
      (record) => record.workDate >= period.weekStart && record.workDate <= period.weekEnd,
    );
    const workerIds = [...new Set(periodAttendance.map((record) => record.workerId))];
    if (workerIds.length === 0) throw new Error("No hay asistencias en este periodo.");

    const adjustmentsResult = await supabase
      .from("payroll_adjustments")
      .select("worker_id, amount")
      .eq("payroll_period_id", period.id);
    if (adjustmentsResult.error) throw new Error(adjustmentsResult.error.message);
    const adjustments = (adjustmentsResult.data ?? []) as Array<{ worker_id: string; amount: number }>;

    const entries: PayrollEntry[] = workerIds.map((workerId) =>
      calculateWorkerPayroll({
        workerId,
        attendance: periodAttendance,
        rates: snapshot.workerRates,
        rules: {
          standardHoursPerDay: Number(settings.standard_hours_per_day),
          workdaysPerWeek: Number(settings.workdays_per_week),
          toleranceMinutes: Number(settings.tolerance_minutes),
          overtimeMultiplier: Number(settings.overtime_multiplier),
          unusuallyHighMultiplier: Number(settings.unusually_high_multiplier),
        },
        otherAdjustments: adjustments
          .filter((adjustment) => adjustment.worker_id === workerId)
          .reduce((sum, adjustment) => sum + Number(adjustment.amount), 0),
      }),
    );

    const save = await supabase.rpc("save_payroll_draft", {
      p_payroll_period_id: period.id,
      p_entries: entries,
    });
    if (save.error) throw new Error(save.error.message);
    return refresh("Nómina calculada y enviada a revisión.");
  } catch (error) {
    return errorResult(error);
  }
}

export async function setPayrollStatusAction(
  periodId: string,
  status: "open" | "in_review" | "approved" | "closed",
): Promise<ActionResult> {
  try {
    await requireRole(["administrator"]);
    const supabase = await createClient();
    const result = await supabase.rpc("set_payroll_status", {
      p_payroll_period_id: uuid.parse(periodId),
      p_status: status,
    });
    if (result.error) throw new Error(result.error.message);
    return refresh(`Nómina actualizada a ${status}.`);
  } catch (error) {
    return errorResult(error);
  }
}

export async function createPayrollAdjustmentAction(input: {
  periodId: string;
  workerId: string;
  amount: number;
  reason: string;
  sourcePeriodId?: string | null;
}): Promise<ActionResult> {
  try {
    const user = await requireRole(["administrator"]);
    const parsed = z.object({
      periodId: uuid,
      workerId: uuid,
      amount: z.number().refine((value) => value !== 0, "El ajuste no puede ser cero."),
      reason: requiredText,
      sourcePeriodId: uuid.nullish(),
    }).parse(input);
    const supabase = await createClient();
    const result = await supabase.from("payroll_adjustments").insert({
      payroll_period_id: parsed.periodId,
      worker_id: parsed.workerId,
      amount: parsed.amount,
      reason: parsed.reason,
      source_period_id: parsed.sourcePeriodId ?? null,
      created_by: user.id,
    });
    if (result.error) throw new Error(result.error.message);
    return refresh("Ajuste de nómina registrado.");
  } catch (error) {
    return errorResult(error);
  }
}
