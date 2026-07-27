import {
  assertValidProject,
  normalizeProjectInput,
} from "../../domain/projects/project-validation";
import {
  CASA_LOMAS_PROJECT,
  type Project,
  type ProjectChanges,
  type ProjectInput,
  toProjectInput,
} from "../../domain/projects/types";
import type { ProjectRepository } from "./project-repository";

export const PROJECTS_STORAGE_KEY = "team-maistro-os.projects.v1";
export const ACTIVE_PROJECT_STORAGE_KEY =
  "team-maistro-os.active-project-id.v1";

export type ProjectStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
> & {
  subscribe?(listener: () => void): () => void;
};

export interface LocalProjectRepositoryOptions {
  storage?: ProjectStorage;
  now?: () => Date;
  createId?: () => string;
}

export class LocalStorageProjectRepository implements ProjectRepository {
  private readonly injectedStorage?: ProjectStorage;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: LocalProjectRepositoryOptions = {}) {
    this.injectedStorage = options.storage;
    this.now = options.now ?? (() => new Date());
    this.createId =
      options.createId ??
      (() =>
        globalThis.crypto?.randomUUID?.() ??
        `project-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

  async getAll(): Promise<Project[]> {
    const storage = this.storage();
    const raw = storage.getItem(PROJECTS_STORAGE_KEY);

    if (!raw) return this.seedProjects(storage);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "No se pudieron leer los proyectos guardados. El almacenamiento está dañado.",
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error("El formato de proyectos guardados no es válido.");
    }

    if (parsed.length === 0) return this.seedProjects(storage);
    return (parsed as Project[]).map((project) => ({ ...project }));
  }

  async getById(id: string): Promise<Project | null> {
    return (await this.getAll()).find((project) => project.id === id) ?? null;
  }

  async create(input: ProjectInput): Promise<Project> {
    const projects = await this.getAll();
    const normalized = normalizeProjectInput(input);
    assertValidProject(normalized, projects);

    const timestamp = this.now().toISOString();
    const project: Project = {
      ...normalized,
      id: this.createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.write([...projects, project]);
    return { ...project };
  }

  async update(id: string, changes: ProjectChanges): Promise<Project> {
    const projects = await this.getAll();
    const index = projects.findIndex((project) => project.id === id);
    if (index < 0) throw new Error("El proyecto ya no existe.");

    const current = projects[index];
    const normalized = normalizeProjectInput({
      ...toProjectInput(current),
      ...changes,
    });
    assertValidProject(normalized, projects, id);

    const updated: Project = {
      ...current,
      ...normalized,
      updatedAt: this.now().toISOString(),
    };
    const next = [...projects];
    next[index] = updated;
    this.write(next);
    return { ...updated };
  }

  async archive(id: string): Promise<Project> {
    const archived = await this.update(id, { status: "archived" });
    const activeId = await this.getActiveProjectId();

    if (activeId === id) {
      const replacement = (await this.getAll()).find(
        (project) => project.status !== "archived",
      );
      if (replacement) {
        this.storage().setItem(ACTIVE_PROJECT_STORAGE_KEY, replacement.id);
      } else {
        this.storage().removeItem(ACTIVE_PROJECT_STORAGE_KEY);
      }
    }

    return archived;
  }

  async getActiveProjectId(): Promise<string | null> {
    const projects = await this.getAll();
    const savedId = this.storage().getItem(ACTIVE_PROJECT_STORAGE_KEY);
    const saved = projects.find(
      (project) => project.id === savedId && project.status !== "archived",
    );
    if (saved) return saved.id;

    const fallback = projects.find(
      (project) => project.status !== "archived",
    );
    if (!fallback) return null;

    this.storage().setItem(ACTIVE_PROJECT_STORAGE_KEY, fallback.id);
    return fallback.id;
  }

  async setActiveProjectId(id: string): Promise<void> {
    const project = await this.getById(id);
    if (!project) throw new Error("El proyecto ya no existe.");
    if (project.status === "archived") {
      throw new Error("Un proyecto archivado no puede ser el proyecto activo.");
    }
    this.storage().setItem(ACTIVE_PROJECT_STORAGE_KEY, id);
  }

  subscribe(listener: () => void) {
    return this.storage().subscribe?.(listener) ?? (() => undefined);
  }

  private storage(): ProjectStorage {
    if (this.injectedStorage) return this.injectedStorage;
    if (typeof window !== "undefined") return window.localStorage;
    throw new Error("localStorage solo está disponible en el navegador.");
  }

  private seedProjects(storage: ProjectStorage): Project[] {
    const seeded = [{ ...CASA_LOMAS_PROJECT }];
    storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(seeded));
    storage.setItem(ACTIVE_PROJECT_STORAGE_KEY, CASA_LOMAS_PROJECT.id);
    return seeded;
  }

  private write(projects: Project[]) {
    this.storage().setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  }
}
