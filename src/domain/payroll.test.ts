import { describe, expect, it } from "vitest";
import type { AttendanceRecord, WorkerRate } from "./entities";
import { calculateWorkerPayroll } from "./payroll";

const baseAttendance: AttendanceRecord[] = [
  {
    id: "a-1",
    workerId: "worker-1",
    projectId: "project-1",
    workDate: "2026-07-27",
    checkIn: "08:00",
    checkOut: "16:00",
    status: "present",
    approvalStatus: "approved",
    notes: "",
  },
];

describe("weekly payroll", () => {
  it("calculates a full daily shift", () => {
    const rates: WorkerRate[] = [{
      id: "rate-1",
      workerId: "worker-1",
      rateType: "daily",
      amount: 600,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    }];
    const result = calculateWorkerPayroll({
      workerId: "worker-1",
      attendance: baseAttendance,
      rates,
    });
    expect(result.baseAmount).toBe(600);
    expect(result.netAmount).toBe(600);
  });

  it("uses the effective rate on each work date", () => {
    const rates: WorkerRate[] = [
      {
        id: "rate-1",
        workerId: "worker-1",
        rateType: "daily",
        amount: 600,
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-07-27",
      },
      {
        id: "rate-2",
        workerId: "worker-1",
        rateType: "daily",
        amount: 800,
        effectiveFrom: "2026-07-28",
        effectiveTo: null,
      },
    ];
    const result = calculateWorkerPayroll({
      workerId: "worker-1",
      attendance: [
        ...baseAttendance,
        { ...baseAttendance[0], id: "a-2", workDate: "2026-07-28" },
      ],
      rates,
    });
    expect(result.baseAmount).toBe(1400);
  });

  it("adds overtime at double rate", () => {
    const rates: WorkerRate[] = [{
      id: "rate-1",
      workerId: "worker-1",
      rateType: "hourly",
      amount: 100,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    }];
    const result = calculateWorkerPayroll({
      workerId: "worker-1",
      attendance: [{ ...baseAttendance[0], checkOut: "18:00" }],
      rates,
    });
    expect(result.baseAmount).toBe(800);
    expect(result.overtimeAmount).toBe(400);
    expect(result.netAmount).toBe(1200);
  });

  it("blocks incomplete attendance", () => {
    const rates: WorkerRate[] = [{
      id: "rate-1",
      workerId: "worker-1",
      rateType: "daily",
      amount: 600,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    }];
    expect(() => calculateWorkerPayroll({
      workerId: "worker-1",
      attendance: [{ ...baseAttendance[0], checkOut: null }],
      rates,
    })).toThrow("incompleta");
  });

  it("blocks unapproved attendance", () => {
    const rates: WorkerRate[] = [{
      id: "rate-1",
      workerId: "worker-1",
      rateType: "daily",
      amount: 600,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    }];
    expect(() => calculateWorkerPayroll({
      workerId: "worker-1",
      attendance: [{ ...baseAttendance[0], approvalStatus: "pending" }],
      rates,
    })).toThrow("aprobada");
  });
});
