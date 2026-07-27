import { describe, expect, it, vi } from "vitest";
import {
  INITIAL_EQUIPMENT_RECORDS,
} from "../../domain/equipment/types";
import {
  INITIAL_INVENTORY_RECORDS,
} from "../../domain/inventory/types";
import {
  INITIAL_PAYROLL_WORKERS,
  type PayrollWorker,
} from "../../domain/payroll/types";
import {
  CASA_LOMAS_PROJECT,
  type ProjectInput,
} from "../../domain/projects/types";
import { LocalStoragePayrollRepository } from "../payroll/local-storage-payroll-repository";
import {
  PAYROLL_STORAGE_KEY,
} from "../payroll/local-storage-payroll-repository";
import {
  ACTIVE_PROJECT_STORAGE_KEY,
  LocalStorageProjectRepository,
  PROJECTS_STORAGE_KEY,
} from "../projects/local-storage-project-repository";
import { EQUIPMENT_STORAGE_KEY } from "../equipment/local-storage-equipment-repository";
import { INVENTORY_STORAGE_KEY } from "../inventory/local-storage-inventory-repository";
import {
  migrateLegacyWorkspace,
  WORKSPACE_BACKUP_KEY,
  WORKSPACE_STORAGE_KEY,
} from "./workspace-migration";
import { WorkspaceBackedStorage } from "./workspace-storage";

const now = () => new Date("2026-07-27T12:00:00.000Z");

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
  storage.setItem(
    PROJECTS_STORAGE_KEY,
    JSON.stringify([CASA_LOMAS_PROJECT]),
  );
  storage.setItem(
    ACTIVE_PROJECT_STORAGE_KEY,
    CASA_LOMAS_PROJECT.id,
  );
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

describe("migración del workspace v2", () => {
  it("centraliza todos los módulos y crea un respaldo antes de guardar", () => {
    const storage = legacyStorage();
    const workspace = migrateLegacyWorkspace(storage, { now });

    expect(workspace).toMatchObject({
      version: 2,
      activeProjectId: CASA_LOMAS_PROJECT.id,
    });
    expect(workspace.projects).toHaveLength(1);
    expect(workspace.inventoryItems).toHaveLength(
      INITIAL_INVENTORY_RECORDS.length,
    );
    expect(workspace.equipmentItems).toHaveLength(
      INITIAL_EQUIPMENT_RECORDS.length,
    );
    expect(workspace.employees).toHaveLength(
      INITIAL_PAYROLL_WORKERS.length,
    );
    expect(workspace.payrollEntries).toHaveLength(
      INITIAL_PAYROLL_WORKERS.length,
    );
    expect(workspace.tasks).toHaveLength(1);
    expect(storage.getItem(WORKSPACE_BACKUP_KEY)).toContain(
      "Casa Lomas",
    );
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toContain(
      '"version":2',
    );
  });

  it("conserva exactamente salarios diarios y semanales", () => {
    const workspace = migrateLegacyWorkspace(legacyStorage(), { now });

    for (const worker of INITIAL_PAYROLL_WORKERS) {
      const employee = workspace.employees.find(
        (candidate) => candidate.id === worker.id,
      );
      const entry = workspace.payrollEntries.find(
        (candidate) => candidate.employeeId === worker.id,
      );
      expect(employee?.salaryType).toBe(worker.salaryType);
      expect(employee?.salaryAmount).toBe(worker.salaryAmount);
      expect(entry?.salaryTypeSnapshot).toBe(worker.salaryType);
      expect(entry?.salaryAmountSnapshot).toBe(worker.salaryAmount);
    }
  });

  it("relaciona nombres normalizados sin guardar el nombre como ID", () => {
    const workspace = migrateLegacyWorkspace(legacyStorage(), { now });
    const project = workspace.projects[0];
    const employee = workspace.employees.find(
      (candidate) =>
        candidate.id === project.responsibleEmployeeId,
    );

    expect(employee?.fullName).toContain("Alejandro");
    expect(project.responsibleEmployeeId).not.toBe(
      project.responsible,
    );
  });

  it("reporta responsables que no tienen coincidencia", () => {
    const storage = legacyStorage();
    storage.setItem(
      PROJECTS_STORAGE_KEY,
      JSON.stringify([
        {
          ...CASA_LOMAS_PROJECT,
          responsible: "Persona desconocida",
        },
      ]),
    );
    const workspace = migrateLegacyWorkspace(storage, { now });

    expect(workspace.projects[0].responsibleEmployeeId).toBeNull();
    expect(workspace.migrationReport.pendingReview[0]).toContain(
      "Persona desconocida",
    );
  });

  it("detecta nombres duplicados sin eliminar registros", () => {
    const storage = legacyStorage();
    const duplicate: PayrollWorker = {
      ...INITIAL_PAYROLL_WORKERS[0],
      id: "worker-ruben-2",
      employeeCode: "EMP-099",
    };
    storage.setItem(
      PAYROLL_STORAGE_KEY,
      JSON.stringify([...INITIAL_PAYROLL_WORKERS, duplicate]),
    );
    const workspace = migrateLegacyWorkspace(storage, { now });

    expect(workspace.employees).toHaveLength(
      INITIAL_PAYROLL_WORKERS.length + 1,
    );
    expect(workspace.migrationReport.duplicatesDetected).toHaveLength(2);
  });

  it("no sobrescribe el respaldo existente", () => {
    const storage = legacyStorage();
    storage.setItem(WORKSPACE_BACKUP_KEY, "respaldo-original");
    migrateLegacyWorkspace(storage, { now });

    expect(storage.getItem(WORKSPACE_BACKUP_KEY)).toBe(
      "respaldo-original",
    );
  });
});

describe("almacenamiento compartido", () => {
  it("recupera el mismo workspace después de crear otra instancia", () => {
    const raw = legacyStorage();
    const first = new WorkspaceBackedStorage(raw, { now });
    first.update((workspace) => {
      workspace.demo.activity.unshift("Cambio persistido");
      return workspace;
    });
    const second = new WorkspaceBackedStorage(raw, { now });

    expect(second.getWorkspace().demo.activity[0]).toBe(
      "Cambio persistido",
    );
  });

  it("notifica cambios reactivos dentro de la misma pestaña", () => {
    const storage = new WorkspaceBackedStorage(legacyStorage(), { now });
    const listener = vi.fn();
    storage.subscribe(listener);
    storage.update((workspace) => ({
      ...workspace,
      activeProjectId: CASA_LOMAS_PROJECT.id,
    }));

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].revision).toBe(2);
  });

  it("los repositorios existentes escriben en v2 y no en las claves anteriores", async () => {
    const raw = legacyStorage();
    const originalProjects = raw.getItem(PROJECTS_STORAGE_KEY);
    const storage = new WorkspaceBackedStorage(raw, { now });
    const repository = new LocalStorageProjectRepository({
      storage,
      now,
      createId: () => "project-new",
    });
    const input: ProjectInput = {
      name: "Proyecto nuevo",
      code: "PN",
      projectType: "Remodelación",
      description: "",
      clientName: "Cliente",
      location: "CDMX",
      responsible: "Rubén",
      startDate: "2026-08-01",
      targetDate: "2026-09-01",
      budget: 100,
      progress: 0,
      status: "planned",
      currentTask: "",
    };
    await repository.create(input);

    expect(storage.getWorkspace().projects).toHaveLength(2);
    expect(raw.getItem(PROJECTS_STORAGE_KEY)).toBe(originalProjects);
    expect(raw.getItem(WORKSPACE_STORAGE_KEY)).toContain(
      "Proyecto nuevo",
    );
  });

  it("el adaptador de nómina conserva el tipo y monto al editar", async () => {
    const storage = new WorkspaceBackedStorage(legacyStorage(), { now });
    const repository = new LocalStoragePayrollRepository({
      storage,
      now,
    });
    const weekly = INITIAL_PAYROLL_WORKERS.find(
      (worker) => worker.salaryType === "weekly",
    );
    expect(weekly).toBeDefined();

    await repository.update(weekly!.id, { name: "Nombre actualizado" });
    const employee = storage
      .getWorkspace()
      .employees.find((candidate) => candidate.id === weekly!.id);

    expect(employee).toMatchObject({
      fullName: "Nombre actualizado",
      salaryType: "weekly",
      salaryAmount: weekly!.salaryAmount,
    });
  });

  it("cargar v2 no vuelve a ejecutar la migración aunque cambien las claves antiguas", () => {
    const raw = legacyStorage();
    const first = new WorkspaceBackedStorage(raw, { now });
    raw.setItem(
      PROJECTS_STORAGE_KEY,
      JSON.stringify([
        { ...CASA_LOMAS_PROJECT, name: "Dato posterior" },
      ]),
    );
    const second = new WorkspaceBackedStorage(raw, { now });

    expect(second.getWorkspace().projects[0].name).toBe(
      first.getWorkspace().projects[0].name,
    );
  });
});
