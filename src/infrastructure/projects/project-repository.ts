import type {
  Project,
  ProjectChanges,
  ProjectInput,
} from "@/domain/projects/types";

export interface ProjectRepository {
  getAll(): Promise<Project[]>;
  getById(id: string): Promise<Project | null>;
  create(input: ProjectInput): Promise<Project>;
  update(id: string, changes: ProjectChanges): Promise<Project>;
  archive(id: string): Promise<Project>;
  getActiveProjectId(): Promise<string | null>;
  setActiveProjectId(id: string): Promise<void>;
  subscribe?(listener: () => void): () => void;
}
