import type { WorkspaceState } from "../../domain/workspace/types";

export interface WorkspaceRepository {
  getWorkspace(): WorkspaceState;
  update(
    updater: (current: WorkspaceState) => WorkspaceState,
  ): WorkspaceState;
  subscribe(
    listener: (workspace: WorkspaceState) => void,
  ): () => void;
}
