import type { PayrollWorkerInput } from "./types";

export function getWorkedDays(
  worker: Pick<PayrollWorkerInput, "scheduledDays" | "absenceDays">,
) {
  return Math.max(worker.scheduledDays - worker.absenceDays, 0);
}

export function calculateWorkerPay(
  worker: Pick<
    PayrollWorkerInput,
    "salaryType" | "salaryAmount" | "scheduledDays" | "absenceDays"
  >,
) {
  const workedDays = getWorkedDays(worker);
  if (worker.scheduledDays <= 0 || worker.salaryAmount <= 0) return 0;
  const value =
    worker.salaryType === "daily"
      ? worker.salaryAmount * workedDays
      : worker.salaryAmount * (workedDays / worker.scheduledDays);
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
