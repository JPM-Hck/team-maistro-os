import { describe, expect, it } from "vitest";
import { CASA_LOMAS_PROJECT } from "../../domain/projects/types";
import {
  INITIAL_PAYROLL_WORKERS,
  type PayrollWorkerInput,
} from "../../domain/payroll/types";
import {
  LocalStoragePayrollRepository,
  type PayrollStorage,
} from "./local-storage-payroll-repository";

class MemoryStorage implements PayrollStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const newWorker: PayrollWorkerInput = {
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

function repository(storage = new MemoryStorage()) {
  return {
    storage,
    repository: new LocalStoragePayrollRepository({
      storage,
      now: () => new Date("2026-07-26T21:00:00.000Z"),
      createId: () => "worker-created",
    }),
  };
}

describe("LocalStoragePayrollRepository", () => {
  it("loads initial workers when storage is empty", async () => {
    const { repository: subject } = repository();
    expect(await subject.getAll()).toHaveLength(
      INITIAL_PAYROLL_WORKERS.length,
    );
  });

  it("creates and recovers an unassigned worker", async () => {
    const { repository: subject, storage } = repository();
    const created = await subject.create(newWorker);
    expect(created.projectId).toBeNull();

    const recovered = new LocalStoragePayrollRepository({ storage });
    expect((await recovered.getById(created.id))?.name).toBe("José Pérez");
  });

  it("updates salary, absences and project", async () => {
    const { repository: subject } = repository();
    const created = await subject.create(newWorker);
    const updated = await subject.update(created.id, {
      salaryAmount: 900,
      absenceDays: 2,
      projectId: CASA_LOMAS_PROJECT.id,
    });
    expect(updated.salaryAmount).toBe(900);
    expect(updated.absenceDays).toBe(2);
    expect(updated.projectId).toBe(CASA_LOMAS_PROJECT.id);
  });

  it("archives a worker without deleting the record", async () => {
    const { repository: subject } = repository();
    const created = await subject.create(newWorker);
    expect((await subject.archive(created.id)).status).toBe("archived");
    expect(await subject.getById(created.id)).not.toBeNull();
  });
});
