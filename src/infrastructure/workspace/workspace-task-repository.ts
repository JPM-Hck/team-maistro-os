import { calculateProjectProgress } from "../../domain/tasks/project-progress";
import {
  assertValidTask,
  normalizeTaskInput,
} from "../../domain/tasks/task-validation";
import {
  type TaskChanges,
  type TaskInput,
  type TaskRecord,
  toTaskInput,
} from "../../domain/tasks/types";
import type { TaskRepository } from "../tasks/task-repository";
import type { WorkspaceBackedStorage } from "./workspace-storage";

export interface WorkspaceTaskRepositoryOptions {
  now?: () => Date;
  createId?: () => string;
}

export class WorkspaceTaskRepository implements TaskRepository {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly workspace: WorkspaceBackedStorage,
    options: WorkspaceTaskRepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId =
      options.createId ??
      (() =>
        globalThis.crypto?.randomUUID?.() ??
        `task-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

  async getAll(): Promise<TaskRecord[]> {
    return this.workspace
      .getWorkspace()
      .tasks.map((task) => clone(task));
  }

  async getById(id: string): Promise<TaskRecord | null> {
    return (await this.getAll()).find((task) => task.id === id) ?? null;
  }

  async create(input: TaskInput): Promise<TaskRecord> {
    const workspace = this.workspace.getWorkspace();
    const normalized = normalizeTaskInput(input);
    assertValidTask(normalized, {
      projects: workspace.projects,
      employees: workspace.employees,
    });
    const timestamp = this.now().toISOString();
    const created: TaskRecord = {
      ...normalized,
      id: this.createId(),
      archived: false,
      needsReview: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.workspace.update((current) =>
      withCalculatedProgress(
        {
          ...current,
          tasks: [...current.tasks, created],
        },
        [created.projectId],
      ),
    );
    return clone(created);
  }

  async update(id: string, changes: TaskChanges): Promise<TaskRecord> {
    const workspace = this.workspace.getWorkspace();
    const current = workspace.tasks.find((task) => task.id === id);
    if (!current) throw new Error("La tarea ya no existe.");

    const normalized = normalizeTaskInput({
      ...toTaskInput(current),
      ...changes,
    });
    assertValidTask(normalized, {
      projects: workspace.projects,
      employees: workspace.employees,
      currentProjectId: current.projectId,
      currentAssigneeIds: current.assigneeIds,
    });
    const updated: TaskRecord = {
      ...current,
      ...normalized,
      progress: normalized.status === "completed" ? 100 : normalized.progress,
      updatedAt: this.now().toISOString(),
    };

    this.workspace.update((state) =>
      withCalculatedProgress(
        {
          ...state,
          tasks: state.tasks.map((task) =>
            task.id === id ? updated : task,
          ),
        },
        [current.projectId, updated.projectId],
      ),
    );
    return clone(updated);
  }

  async complete(id: string): Promise<TaskRecord> {
    return this.update(id, { status: "completed", progress: 100 });
  }

  async cancel(id: string): Promise<TaskRecord> {
    return this.update(id, { status: "cancelled" });
  }

  async archive(id: string): Promise<TaskRecord> {
    const workspace = this.workspace.getWorkspace();
    const current = workspace.tasks.find((task) => task.id === id);
    if (!current) throw new Error("La tarea ya no existe.");
    const archived = {
      ...current,
      archived: true,
      updatedAt: this.now().toISOString(),
    };

    this.workspace.update((state) => {
      const tasks = state.tasks.map((task) =>
        task.id === id ? archived : task,
      );
      const nextDemoTask =
        state.demo.activeTaskId === id
          ? tasks.find((task) => !task.archived)?.id ?? null
          : state.demo.activeTaskId;
      return withCalculatedProgress(
        {
          ...state,
          tasks,
          demo: {
            ...state.demo,
            activeTaskId: nextDemoTask,
          },
        },
        [current.projectId],
      );
    });
    return clone(archived);
  }

  subscribe(listener: () => void) {
    return this.workspace.subscribe(listener);
  }
}

function withCalculatedProgress<T extends {
  projects: ReturnType<WorkspaceBackedStorage["getWorkspace"]>["projects"];
  tasks: TaskRecord[];
}>(workspace: T, projectIds: string[]): T {
  const ids = new Set(projectIds);
  return {
    ...workspace,
    projects: workspace.projects.map((project) =>
      ids.has(project.id)
        ? {
            ...project,
            progress: calculateProjectProgress(
              workspace.tasks,
              project.id,
            ),
          }
        : project,
    ),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
