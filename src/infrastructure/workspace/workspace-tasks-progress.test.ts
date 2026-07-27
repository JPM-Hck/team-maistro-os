import { describe, expect, it } from "vitest";
import { INITIAL_EQUIPMENT_RECORDS } from "../../domain/equipment/types";
import { INITIAL_INVENTORY_RECORDS } from "../../domain/inventory/types";
import { INITIAL_PAYROLL_WORKERS } from "../../domain/payroll/types";
import type { TaskInput } from "../../domain/tasks/types";
import { getEmployeesByTask } from "../../domain/workspace/selectors";
import type { WorkspaceState } from "../../domain/workspace/types";
import { CASA_LOMAS_PROJECT } from "../../domain/projects/types";
import { EQUIPMENT_STORAGE_KEY } from "../equipment/local-storage-equipment-repository";
import { INVENTORY_STORAGE_KEY } from "../inventory/local-storage-inventory-repository";
import { PAYROLL_STORAGE_KEY } from "../payroll/local-storage-payroll-repository";
import {
  ACTIVE_PROJECT_STORAGE_KEY,
  PROJECTS_STORAGE_KEY,
} from "../projects/local-storage-project-repository";
import {
  WORKSPACE_STORAGE_KEY,
} from "./workspace-migration";
import { WorkspaceBackedStorage } from "./workspace-storage";
import { WorkspacePayrollRepository } from "./workspace-payroll-repository";
import { WorkspaceProjectRepository } from "./workspace-project-repository";
import { WorkspaceTaskRepository } from "./workspace-task-repository";

const now = () => new Date("2026-07-29T12:00:00.000Z");

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

async function scenario() {
  const raw = legacyStorage();
  const workspace = new WorkspaceBackedStorage(raw, { now });
  const responsibleId = workspace.getWorkspace().employees[0].id;
  const projects = new WorkspaceProjectRepository(workspace, {
    now,
    createId: () => "project-cuernavaca",
  });
  const project = await projects.create({
    name: "Remodelación Cuernavaca",
    code: "RC",
    projectType: "Remodelación",
    description: "",
    clientName: "Cliente",
    location: "Cuernavaca",
    responsible: "Nombre derivado",
    responsibleEmployeeId: responsibleId,
    startDate: "2026-08-01",
    targetDate: "2026-10-01",
    budget: 900_000,
    progress: 88,
    status: "planned",
    currentTask: "",
  });
  const tasks = new WorkspaceTaskRepository(workspace, {
    now,
    createId: (() => {
      let index = 0;
      return () => `task-${++index}`;
    })(),
  });
  return { raw, workspace, projects, project, tasks, responsibleId };
}

function taskInput(
  projectId: string,
  assigneeId: string,
  name: string,
  weight = 1,
): TaskInput {
  return {
    projectId,
    name,
    description: "",
    status: "planned",
    progress: 0,
    progressWeight: weight,
    quantity: 1,
    unit: "lote",
    startDate: "2026-08-01",
    targetDate: "2026-08-10",
    assigneeIds: [assigneeId],
    recipeId: null,
    equipmentItemIds: [],
  };
}

describe("tareas persistentes y avance derivado", () => {
  it("inicia un proyecto sin tareas en 0 aunque el formulario envíe otro avance", async () => {
    const { project } = await scenario();
    expect(project.progress).toBe(0);
  });

  it("calcula 40% al terminar dos de cinco tareas del mismo peso", async () => {
    const { workspace, project, tasks, responsibleId } = await scenario();
    const created = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        tasks.create(
          taskInput(project.id, responsibleId, `Tarea ${index + 1}`),
        ),
      ),
    );
    await tasks.complete(created[0].id);
    await tasks.complete(created[1].id);

    expect(
      workspace.getWorkspace().projects.find((item) => item.id === project.id)
        ?.progress,
    ).toBe(40);
  });

  it("calcula 50% y fuerza una tarea terminada a 100%", async () => {
    const { workspace, project, tasks, responsibleId } = await scenario();
    const first = await tasks.create(
      taskInput(project.id, responsibleId, "Primera"),
    );
    await tasks.create(taskInput(project.id, responsibleId, "Segunda"));

    const completed = await tasks.complete(first.id);
    expect(completed.progress).toBe(100);
    expect(
      workspace.getWorkspace().projects.find((item) => item.id === project.id)
        ?.progress,
    ).toBe(50);
  });

  it("respeta pesos distintos", async () => {
    const { workspace, project, tasks, responsibleId } = await scenario();
    const heavy = await tasks.create(
      taskInput(project.id, responsibleId, "Pesada", 3),
    );
    await tasks.create(taskInput(project.id, responsibleId, "Ligera", 1));
    await tasks.complete(heavy.id);

    expect(
      workspace.getWorkspace().projects.find((item) => item.id === project.id)
        ?.progress,
    ).toBe(75);
  });

  it("excluye tareas canceladas y archivadas", async () => {
    const { workspace, project, tasks, responsibleId } = await scenario();
    const completed = await tasks.create(
      taskInput(project.id, responsibleId, "Terminada"),
    );
    const cancelled = await tasks.create(
      taskInput(project.id, responsibleId, "Cancelada"),
    );
    const archived = await tasks.create(
      taskInput(project.id, responsibleId, "Archivada"),
    );
    await tasks.complete(completed.id);
    await tasks.cancel(cancelled.id);
    await tasks.archive(archived.id);

    expect(
      workspace.getWorkspace().projects.find((item) => item.id === project.id)
        ?.progress,
    ).toBe(100);
  });

  it("rechaza proyecto inexistente, empleado archivado, peso y progreso inválidos", async () => {
    const { tasks, project, responsibleId, workspace } = await scenario();
    await expect(
      tasks.create(taskInput("missing", responsibleId, "Huérfana")),
    ).rejects.toThrow("proyecto válido");

    const payroll = new WorkspacePayrollRepository(workspace, { now });
    await payroll.archive(responsibleId);
    await expect(
      tasks.create(taskInput(project.id, responsibleId, "Archivado")),
    ).rejects.toThrow("archivadas");
    await expect(
      tasks.create(taskInput(project.id, workspace.getWorkspace().employees[1].id, "Peso", 0)),
    ).rejects.toThrow("peso");
    await expect(
      tasks.create({
        ...taskInput(
          project.id,
          workspace.getWorkspace().employees[1].id,
          "Progreso",
        ),
        progress: 101,
      }),
    ).rejects.toThrow("avance");
  });

  it("mantiene relaciones por ID después de renombrar una persona", async () => {
    const { workspace, project, tasks, responsibleId } = await scenario();
    const task = await tasks.create(
      taskInput(project.id, responsibleId, "Trazo"),
    );
    const payroll = new WorkspacePayrollRepository(workspace, { now });
    await payroll.update(responsibleId, { name: "Nombre actualizado" });

    const state = workspace.getWorkspace();
    const stored = state.tasks.find((item) => item.id === task.id)!;
    expect(stored.assigneeIds).toEqual([responsibleId]);
    expect(getEmployeesByTask(state.employees, stored)[0].fullName).toBe(
      "Nombre actualizado",
    );
  });

  it("persiste tareas y avance después de recargar", async () => {
    const { raw, project, tasks, responsibleId } = await scenario();
    const task = await tasks.create(
      taskInput(project.id, responsibleId, "Persistente"),
    );
    await tasks.update(task.id, { progress: 60 });

    const reloaded = new WorkspaceBackedStorage(raw, { now });
    expect(reloaded.getWorkspace().tasks.find((item) => item.id === task.id))
      .toMatchObject({ name: "Persistente", progress: 60 });
    expect(
      reloaded.getWorkspace().projects.find((item) => item.id === project.id)
        ?.progress,
    ).toBe(60);
  });

  it("convierte una sola vez el avance antiguo en tarea por revisar", () => {
    const raw = legacyStorage();
    const first = new WorkspaceBackedStorage(raw, { now });
    const legacy = first.getWorkspace() as Partial<WorkspaceState>;
    delete legacy.taskProgressModelVersion;
    legacy.tasks = [];
    legacy.projects![0].progress = 57;
    legacy.projects![0].currentTask = undefined;
    raw.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(legacy));

    const migrated = new WorkspaceBackedStorage(raw, { now }).getWorkspace();
    expect(migrated.tasks).toHaveLength(1);
    expect(migrated.tasks[0]).toMatchObject({
      id: `task-progress-migrated-${CASA_LOMAS_PROJECT.id}`,
      progress: 57,
      needsReview: true,
    });
    expect(migrated.projects[0].progress).toBe(57);

    const reloaded = new WorkspaceBackedStorage(raw, { now }).getWorkspace();
    expect(reloaded.tasks).toHaveLength(1);
  });
});
