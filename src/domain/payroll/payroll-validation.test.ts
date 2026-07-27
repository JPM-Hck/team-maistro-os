import { describe, expect, it } from "vitest";
import {
  isPayrollWorkerValid,
  validatePayrollWorker,
} from "./payroll-validation";
import type { PayrollWorker, PayrollWorkerInput } from "./types";

const validInput: PayrollWorkerInput = {
  employeeCode: "EMP-100",
  name: "José Pérez",
  position: "Oficial albañil",
  projectId: null,
  salaryType: "daily",
  salaryAmount: 800,
  scheduledDays: 6,
  absenceDays: 1,
  notes: "",
  status: "active",
};

describe("payroll validation", () => {
  it("accepts a valid worker", () => {
    expect(isPayrollWorkerValid(validatePayrollWorker(validInput))).toBe(true);
  });

  it("rejects required fields and zero salary", () => {
    const errors = validatePayrollWorker({
      ...validInput,
      employeeCode: "",
      name: "",
      position: "",
      salaryAmount: 0,
    });
    expect(errors.employeeCode).toBeTruthy();
    expect(errors.name).toBeTruthy();
    expect(errors.position).toBeTruthy();
    expect(errors.salaryAmount).toBeTruthy();
  });

  it("rejects more absences than scheduled days", () => {
    expect(
      validatePayrollWorker({
        ...validInput,
        scheduledDays: 6,
        absenceDays: 7,
      }).absenceDays,
    ).toBeTruthy();
  });

  it("rejects scheduled days outside one to seven", () => {
    expect(
      validatePayrollWorker({ ...validInput, scheduledDays: 8 }).scheduledDays,
    ).toBeTruthy();
  });

  it("rejects duplicated employee codes", () => {
    const existing = {
      ...validInput,
      id: "existing",
      employeeCode: "emp-100",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies PayrollWorker;
    expect(validatePayrollWorker(validInput, [existing]).employeeCode).toBeTruthy();
  });
});
