import { describe, expect, it } from "vitest";
import {
  INITIAL_EQUIPMENT_RECORDS,
} from "../../domain/equipment/types";
import {
  INITIAL_INVENTORY_RECORDS,
} from "../../domain/inventory/types";
import {
  INITIAL_PAYROLL_WORKERS,
  type PayrollWorkerInput,
} from "../../domain/payroll/types";
import {
  CASA_LOMAS_PROJECT,
  type ProjectInput,
} from "../../domain/projects/types";
import { EQUIPMENT_STORAGE_KEY } from "../equipment/local-storage-equipment-repository";
import { INVENTORY_STORAGE_KEY } from "../inventory/local-storage-inventory-repository";
import { PAYROLL_STORAGE_KEY } from "../payroll/local-storage-payroll-repository";
import {
  ACTIVE_PROJECT_STORAGE_KEY,
  PROJECTS_STORAGE_KEY,
} from "../projects/local-storage-project-repository";
import { WorkspaceBackedStorage } from "./workspace-storage";
import { WorkspacePayrollRepository } from "./workspace-payroll-repository";
import { WorkspaceProjectRepository } from "./workspace-project-repository";

const now = () => new Date("2026-07-28T12:00:00.000Z");

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function legacyStorage() {
  const storage = new MemoryStorage();
  storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify([CASA_LOMAS_PROJECT]));
  storage.setItem(ACTIVE_PROJECT_STORAGE_KEY, CASA_LOMAS_PROJECT.id);
  storage.setItem(
    INVENTORY_STORAGE_KEY,
    JSON.stringify(INITIAL_INVENTORY_RECORDS),
  );
  storage.setItem(
    EQUIPMENT_STORAGE_KEY,
    JSON.stringify(INITIAL_EQUIPMENT_RECORDS),
  );
  storage.setItem(
    PAYROLL_STORAGE_KEY,
    JSON.stringify(INITIAL_PAYROLL_WORKERS),
  );
  return storage;
}

function projectInput(
  responsibleEmployeeId: string,
  code = "RC",
): ProjectInput {
  return {
    name: "Remodelación Cuernavaca",
    code,
    projectType: "Remodelación",
    description: "",
    clientName: "Cliente Cuernavaca",
    location: "Cuernavaca",
    responsible: "Nombre derivado",
    responsibleEmployeeId,
    startDate: "2026-08-01",
    targetDate: "2026-10-01",
    budget: 900_000,
    progress: 0,
    status: "planned",
    currentTask: "",
  };
}

function workerInput(
  employeeCode = "EMP-004",
  name = "Lucía Torres",
): PayrollWorkerInput {
  return {
    employeeCode,
    name,
    position: "Residente de obra",
    projectId: null,
    salaryType: "weekly",
    salaryAmount: 6_500,
    scheduledDays: 6,
    absenceDays: 0,
    notes: "",
    status: "active",
  };
}

describe("integración de personas, proyectos y proyecto activo", () => {
  it("crea una persona, la asigna por ID y refleja su renombrado", async () => {
    const workspace = new WorkspaceBackedStorage(legacyStorage(), { now });
    const payroll = new WorkspacePayrollRepository(workspace, {
      now,
      createId: () => "worker-lucia",
    });
    const projects = new WorkspaceProjectRepository(workspace, {
      now,
      createId: () => "project-cuernavaca",
    });

    const employee = await payroll.create(workerInput());
    const project = await projects.create(projectInput(employee.id));
    expect(project).toMatchObject({
      responsibleEmployeeId: employee.id,
      responsible: "Lucía Torres",
    });

    await payroll.update(employee.id, { name: "Lucía Torres Vega" });
    expect(await projects.getById(project.id)).toMatchObject({
      responsibleEmployeeId: employee.id,
      responsible: "Lucía Torres Vega",
    });
  });

  it("rechaza nuevas asignaciones a empleados archivados", async () => {
    const workspace = new WorkspaceBackedStorage(legacyStorage(), { now });
    const payroll = new WorkspacePayrollRepository(workspace, { now });
    const projects = new WorkspaceProjectRepository(workspace, { now });
    const archivedId = INITIAL_PAYROLL_WORKERS[1].id;

    await payroll.archive(archivedId);

    await expect(
      projects.create(projectInput(archivedId)),
    ).rejects.toThrow("archivada");
  });

  it("conserva relaciones históricas al archivar al responsable", async () => {
    const workspace = new WorkspaceBackedStorage(legacyStorage(), { now });
    const payroll = new WorkspacePayrollRepository(workspace, { now });
    const projects = new WorkspaceProjectRepository(workspace, { now });
    const project = (await projects.getAll())[0];
    const responsibleId = project.responsibleEmployeeId!;

    await payroll.archive(responsibleId);
    const updated = await projects.update(project.id, { budget: 2_600_000 });

    expect(updated.responsibleEmployeeId).toBe(responsibleId);
    expect(updated.budget).toBe(2_600_000);
  });

  it("preserva snapshots salariales cuando cambia el sueldo actual", async () => {
    const workspace = new WorkspaceBackedStorage(legacyStorage(), { now });
    const payroll = new WorkspacePayrollRepository(workspace, { now });
    const weekly = INITIAL_PAYROLL_WORKERS.find(
      (worker) => worker.salaryType === "weekly",
    )!;
    const before = workspace
      .getWorkspace()
      .payrollEntries.find((entry) => entry.employeeId === weekly.id)!;

    await payroll.update(weekly.id, {
      salaryType: "daily",
      salaryAmount: 1_400,
    });

    const current = await payroll.getById(weekly.id);
    const snapshot = workspace
      .getWorkspace()
      .payrollEntries.find((entry) => entry.id === before.id)!;
    expect(current).toMatchObject({
      salaryType: "daily",
      salaryAmount: 1_400,
    });
    expect(snapshot).toMatchObject({
      salaryTypeSnapshot: "weekly",
      salaryAmountSnapshot: weekly.salaryAmount,
    });
  });

  it("persiste el proyecto activo y selecciona otro al archivarlo", async () => {
    const raw = legacyStorage();
    const workspace = new WorkspaceBackedStorage(raw, { now });
    const projects = new WorkspaceProjectRepository(workspace, {
      now,
      createId: () => "project-cuernavaca",
    });
    const responsibleId = workspace.getWorkspace().employees[0].id;
    const created = await projects.create(projectInput(responsibleId));

    await projects.setActiveProjectId(created.id);
    const reloadedWorkspace = new WorkspaceBackedStorage(raw, { now });
    const reloadedProjects = new WorkspaceProjectRepository(
      reloadedWorkspace,
      { now },
    );
    expect(await reloadedProjects.getActiveProjectId()).toBe(created.id);

    await reloadedProjects.archive(created.id);
    expect(await reloadedProjects.getActiveProjectId()).toBe(
      CASA_LOMAS_PROJECT.id,
    );
  });
});
