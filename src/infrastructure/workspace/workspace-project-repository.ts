import {
  assertValidProject,
  normalizeProjectInput,
} from "../../domain/projects/project-validation";
import {
  type Project,
  type ProjectChanges,
  type ProjectInput,
  toProjectInput,
} from "../../domain/projects/types";
import { assertResponsibleEmployeeAssignable } from "../../domain/workspace/employee-assignment";
import type {
  Employee,
  WorkspaceProject,
} from "../../domain/workspace/types";
import type { ProjectRepository } from "../projects/project-repository";
import type { WorkspaceBackedStorage } from "./workspace-storage";

export interface WorkspaceProjectRepositoryOptions {
  now?: () => Date;
  createId?: () => string;
}

export class WorkspaceProjectRepository implements ProjectRepository {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly workspace: WorkspaceBackedStorage,
    options: WorkspaceProjectRepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId =
      options.createId ??
      (() =>
        globalThis.crypto?.randomUUID?.() ??
        `project-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

  async getAll(): Promise<Project[]> {
    const workspace = this.workspace.getWorkspace();
    return workspace.projects.map((project) =>
      presentProject(project, workspace.employees),
    );
  }

  async getById(id: string): Promise<Project | null> {
    return (await this.getAll()).find((project) => project.id === id) ?? null;
  }

  async create(input: ProjectInput): Promise<Project> {
    const workspace = this.workspace.getWorkspace();
    const employee = assertResponsibleEmployeeAssignable(
      input,
      workspace.employees,
    );
    const normalized = normalizeProjectInput({
      ...input,
      progress: 0,
      responsible: employee.fullName,
      responsibleEmployeeId: employee.id,
    });
    assertValidProject(
      normalized,
      workspace.projects.map((project) =>
        presentProject(project, workspace.employees),
      ),
    );

    const timestamp = this.now().toISOString();
    const created: WorkspaceProject = {
      ...normalized,
      responsibleEmployeeId: employee.id,
      id: this.createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.workspace.update((current) => ({
      ...current,
      projects: [...current.projects, created],
      activeProjectId: current.activeProjectId ?? created.id,
    }));
    return presentProject(created, workspace.employees);
  }

  async update(
    id: string,
    changes: ProjectChanges,
  ): Promise<Project> {
    const workspace = this.workspace.getWorkspace();
    const index = workspace.projects.findIndex((project) => project.id === id);
    if (index < 0) throw new Error("El proyecto ya no existe.");

    const current = workspace.projects[index];
    const input = {
      ...toProjectInput(presentProject(current, workspace.employees)),
      ...changes,
      progress: current.progress,
    };
    const employee = assertResponsibleEmployeeAssignable(
      input,
      workspace.employees,
      current.responsibleEmployeeId,
    );
    const normalized = normalizeProjectInput({
      ...input,
      responsible: employee.fullName,
      responsibleEmployeeId: employee.id,
    });
    assertValidProject(
      normalized,
      workspace.projects.map((project) =>
        presentProject(project, workspace.employees),
      ),
      id,
    );

    const updated: WorkspaceProject = {
      ...current,
      ...normalized,
      responsibleEmployeeId: employee.id,
      updatedAt: this.now().toISOString(),
    };
    this.workspace.update((state) => ({
      ...state,
      projects: state.projects.map((project) =>
        project.id === id ? updated : project,
      ),
    }));
    return presentProject(updated, workspace.employees);
  }

  async archive(id: string): Promise<Project> {
    const archived = await this.update(id, { status: "archived" });
    this.workspace.update((workspace) => {
      if (workspace.activeProjectId !== id) return workspace;
      return {
        ...workspace,
        activeProjectId:
          workspace.projects.find(
            (project) =>
              project.id !== id && project.status !== "archived",
          )?.id ?? null,
      };
    });
    return archived;
  }

  async getActiveProjectId(): Promise<string | null> {
    return this.workspace.getWorkspace().activeProjectId;
  }

  async setActiveProjectId(id: string): Promise<void> {
    const workspace = this.workspace.getWorkspace();
    const project = workspace.projects.find((candidate) => candidate.id === id);
    if (!project) throw new Error("El proyecto ya no existe.");
    if (project.status === "archived") {
      throw new Error("Un proyecto archivado no puede ser el proyecto activo.");
    }
    this.workspace.update((current) => ({
      ...current,
      activeProjectId: id,
    }));
  }

  subscribe(listener: () => void) {
    return this.workspace.subscribe(listener);
  }
}

function presentProject(
  project: WorkspaceProject,
  employees: Employee[],
): Project {
  return {
    ...project,
    responsible:
      employees.find(
        (employee) => employee.id === project.responsibleEmployeeId,
      )?.fullName ??
      project.responsible ??
      "Responsable no disponible",
  };
}
