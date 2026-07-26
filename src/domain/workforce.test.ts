import { describe, expect, it } from "vitest";
import type { ProjectAssignment, WorkerRate } from "./entities";
import {
  dateRangesOverlap,
  validateAssignment,
  validateProjectDates,
  validateRateChange,
} from "./workforce";

describe("workforce rules", () => {
  it("rejects invalid project dates", () => {
    expect(() => validateProjectDates("2026-08-10", "2026-08-01")).toThrow(
      "fecha objetivo",
    );
  });

  it("treats touching inclusive ranges as overlap", () => {
    expect(dateRangesOverlap(
      { startsOn: "2026-08-01", endsOn: "2026-08-10" },
      { startsOn: "2026-08-10", endsOn: "2026-08-20" },
    )).toBe(true);
  });

  it("rejects a conflicting worker assignment", () => {
    const existing: ProjectAssignment[] = [{
      id: "assignment-1",
      workerId: "worker-1",
      projectId: "project-1",
      role: "Oficial",
      startsOn: "2026-08-01",
      endsOn: "2026-08-10",
      schedule: "08:00-17:00",
      active: true,
    }];

    expect(() => validateAssignment({
      workerId: "worker-1",
      projectId: "project-2",
      role: "Oficial",
      startsOn: "2026-08-05",
      endsOn: "2026-08-12",
      schedule: "08:00-17:00",
      active: true,
    }, existing)).toThrow("ya tiene una asignación");
  });

  it("rejects overlapping rates", () => {
    const existing: WorkerRate[] = [{
      id: "rate-1",
      workerId: "worker-1",
      rateType: "daily",
      amount: 600,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-07-31",
    }];

    expect(() => validateRateChange({
      workerId: "worker-1",
      rateType: "daily",
      amount: 650,
      effectiveFrom: "2026-07-15",
      effectiveTo: null,
    }, existing)).toThrow("traslapa");
  });
});
