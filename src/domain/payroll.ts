import type {
  AttendanceRecord,
  PayrollEntry,
  RateType,
  WorkerRate,
} from "./entities";
import { round2 } from "./operations";

export interface PayrollRules {
  standardHoursPerDay: number;
  workdaysPerWeek: number;
  toleranceMinutes: number;
  overtimeMultiplier: number;
  unusuallyHighMultiplier: number;
}

export const defaultPayrollRules: PayrollRules = {
  standardHoursPerDay: 8,
  workdaysPerWeek: 6,
  toleranceMinutes: 15,
  overtimeMultiplier: 2,
  unusuallyHighMultiplier: 2,
};

function minutesBetween(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return Math.max((endHour * 60 + endMinute) - (startHour * 60 + startMinute), 0);
}

export function findEffectiveRate(rates: WorkerRate[], workerId: string, workDate: string) {
  return rates.find(
    (rate) =>
      rate.workerId === workerId
      && rate.effectiveFrom <= workDate
      && (!rate.effectiveTo || rate.effectiveTo >= workDate),
  );
}

function expectedDailyValue(rateType: RateType, amount: number, rules: PayrollRules) {
  if (rateType === "weekly") return amount / rules.workdaysPerWeek;
  if (rateType === "daily") return amount;
  return amount * rules.standardHoursPerDay;
}

export function calculateWorkerPayroll({
  workerId,
  attendance,
  rates,
  rules = defaultPayrollRules,
  bonuses = 0,
  otherAdjustments = 0,
}: {
  workerId: string;
  attendance: AttendanceRecord[];
  rates: WorkerRate[];
  rules?: PayrollRules;
  bonuses?: number;
  otherAdjustments?: number;
}): PayrollEntry {
  const records = attendance.filter((record) => record.workerId === workerId);
  const seenDates = new Set<string>();
  let baseAmount = 0;
  let overtimeAmount = 0;
  let absenceDeductions = 0;
  let tardinessDeductions = 0;
  let resolvedRateType: RateType | null = null;

  for (const record of records) {
    if (seenDates.has(record.workDate)) throw new Error("Hay asistencias duplicadas.");
    seenDates.add(record.workDate);
    if (record.approvalStatus !== "approved") {
      throw new Error("Toda asistencia debe estar aprobada antes de calcular.");
    }
    if ((record.status === "present" || record.status === "partial") && (!record.checkIn || !record.checkOut)) {
      throw new Error("La asistencia tiene una entrada o salida incompleta.");
    }

    const rate = findEffectiveRate(rates, workerId, record.workDate);
    if (!rate) throw new Error(`Falta una tarifa vigente para ${record.workDate}.`);
    resolvedRateType = rate.rateType;
    const expectedDay = expectedDailyValue(rate.rateType, rate.amount, rules);

    if (record.status === "absent") {
      absenceDeductions += expectedDay;
      continue;
    }
    if (record.status === "leave" || record.status === "rest") continue;

    const workedMinutes = minutesBetween(record.checkIn!, record.checkOut!);
    const regularMinutes = Math.min(workedMinutes, rules.standardHoursPerDay * 60);
    const overtimeMinutes = Math.max(workedMinutes - rules.standardHoursPerDay * 60, 0);
    const hourlyValue = expectedDay / rules.standardHoursPerDay;
    baseAmount += (regularMinutes / 60) * hourlyValue;
    overtimeAmount += (overtimeMinutes / 60) * hourlyValue * rules.overtimeMultiplier;

    if (record.checkIn! > "08:15") {
      const lateMinutes = Math.max(minutesBetween("08:00", record.checkIn!) - rules.toleranceMinutes, 0);
      tardinessDeductions += (lateMinutes / 60) * hourlyValue;
    }
  }

  if (!resolvedRateType) throw new Error("No hay asistencias para calcular.");
  const netAmount = round2(
    baseAmount + overtimeAmount + bonuses - absenceDeductions - tardinessDeductions + otherAdjustments,
  );
  if (netAmount < 0) throw new Error("La nómina no puede resultar negativa.");

  return {
    workerId,
    rateType: resolvedRateType,
    baseAmount: round2(baseAmount),
    overtimeAmount: round2(overtimeAmount),
    bonuses: round2(bonuses),
    absenceDeductions: round2(absenceDeductions),
    tardinessDeductions: round2(tardinessDeductions),
    otherAdjustments: round2(otherAdjustments),
    netAmount,
    breakdown: {
      approvedRecords: records.length,
      standardHoursPerDay: rules.standardHoursPerDay,
      overtimeMultiplier: rules.overtimeMultiplier,
    },
  };
}
