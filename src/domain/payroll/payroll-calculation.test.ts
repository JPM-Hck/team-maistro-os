import { describe, expect, it } from "vitest";
import { calculateWorkerPay, getWorkedDays } from "./payroll-calculation";

describe("weekly payroll calculation", () => {
  it("calculates worked days after absences", () => {
    expect(getWorkedDays({ scheduledDays: 6, absenceDays: 2 })).toBe(4);
  });

  it("calculates daily salary by worked days", () => {
    expect(
      calculateWorkerPay({
        salaryType: "daily",
        salaryAmount: 800,
        scheduledDays: 6,
        absenceDays: 1,
      }),
    ).toBe(4_000);
  });

  it("pays a complete weekly salary without absences", () => {
    expect(
      calculateWorkerPay({
        salaryType: "weekly",
        salaryAmount: 6_000,
        scheduledDays: 6,
        absenceDays: 0,
      }),
    ).toBe(6_000);
  });

  it("prorates weekly salary when there are absences", () => {
    expect(
      calculateWorkerPay({
        salaryType: "weekly",
        salaryAmount: 6_000,
        scheduledDays: 6,
        absenceDays: 2,
      }),
    ).toBe(4_000);
  });
});
