"use client";

import { useEffect, useState } from "react";
import type { WorkspaceState } from "@/domain/workspace/types";
import type { WorkspaceBackedStorage } from "@/infrastructure/workspace/workspace-storage";

export function useWorkspaceSnapshot(storage: WorkspaceBackedStorage) {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() =>
    storage.getWorkspace(),
  );

  useEffect(
    () => storage.subscribe((snapshot) => setWorkspace(snapshot)),
    [storage],
  );

  return workspace;
}
