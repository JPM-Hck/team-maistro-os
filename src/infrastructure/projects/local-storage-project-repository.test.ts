import { describe, expect, it } from "vitest";
import type { ProjectInput } from "../../domain/projects/types";
import {
  LocalStorageProjectRepository,
  PROJECTS_STORAGE_KEY,
  type ProjectStorage,
} from "./local-storage-project-repository";

class MemoryStorage implements ProjectStorage {
  private readonly values = new Map<string, string>();

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

const newProject: ProjectInput = {
  name: "Torre Centro",
  code: "tc",
  projectType: "Adecuación",
  description: "Adecuación de oficinas.",
  clientName: "Cliente Centro",
  location: "Monterrey",
  responsible: "María L.",
  startDate: "2026-08-01",
  targetDate: "2026-11-01",
  budget: 900_000,
  progress: 5,
  status: "planned",
  currentTask: "Levantamiento",
};

function repository(storage = new MemoryStorage()) {
  return new LocalStorageProjectRepository({
    storage,
    now: () => new Date("2026-07-26T12:00:00.000Z"),
    createId: () => "project-torre-centro",
  });
}

describe("LocalStorageProjectRepository", () => {
  it("crea un proyecto válido con id y fechas", async () => {
    const created = await repository().create(newProject);
    expect(created).toMatchObject({
      id: "project-torre-centro",
      code: "TC",
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-26T12:00:00.000Z",
    });
  });

  it("edita un proyecto existente", async () => {
    const repo = repository();
    const created = await repo.create(newProject);
    const updated = await repo.update(created.id, {
      name: "Torre Centro Norte",
      progress: 25,
    });
    expect(updated.name).toBe("Torre Centro Norte");
    expect(updated.progress).toBe(25);
  });

  it("archiva un proyecto", async () => {
    const repo = repository();
    const created = await repo.create(newProject);
    expect((await repo.archive(created.id)).status).toBe("archived");
  });

  it("recupera proyectos desde otra instancia", async () => {
    const storage = new MemoryStorage();
    await repository(storage).create(newProject);
    const recovered = await repository(storage).getById(
      "project-torre-centro",
    );
    expect(recovered?.name).toBe("Torre Centro");
  });

  it("carga Casa Lomas cuando no hay datos guardados", async () => {
    const storage = new MemoryStorage();
    const projects = await repository(storage).getAll();
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ name: "Casa Lomas", code: "CL" });
    expect(storage.getItem(PROJECTS_STORAGE_KEY)).toContain("Casa Lomas");
  });
});
