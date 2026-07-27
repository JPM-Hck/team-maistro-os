import type {
  TaskChanges,
  TaskInput,
  TaskRecord,
} from "../../domain/tasks/types";

export interface TaskRepository {
  getAll(): Promise<TaskRecord[]>;
  getById(id: string): Promise<TaskRecord | null>;
  create(input: TaskInput): Promise<TaskRecord>;
  update(id: string, changes: TaskChanges): Promise<TaskRecord>;
  complete(id: string): Promise<TaskRecord>;
  cancel(id: string): Promise<TaskRecord>;
  archive(id: string): Promise<TaskRecord>;
  subscribe?(listener: () => void): () => void;
}
