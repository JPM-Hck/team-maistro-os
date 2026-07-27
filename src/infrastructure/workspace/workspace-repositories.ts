import { LocalStorageEquipmentRepository } from "../equipment/local-storage-equipment-repository";
import { LocalStorageInventoryRepository } from "../inventory/local-storage-inventory-repository";
import { getBrowserWorkspaceStorage } from "./workspace-storage";
import { WorkspacePayrollRepository } from "./workspace-payroll-repository";
import { WorkspaceProjectRepository } from "./workspace-project-repository";
import { WorkspaceTaskRepository } from "./workspace-task-repository";

export function createWorkspaceRepositories() {
  const storage = getBrowserWorkspaceStorage();
  return {
    storage,
    projects: new WorkspaceProjectRepository(storage),
    inventory: new LocalStorageInventoryRepository({ storage }),
    equipment: new LocalStorageEquipmentRepository({ storage }),
    payroll: new WorkspacePayrollRepository(storage),
    tasks: new WorkspaceTaskRepository(storage),
  };
}

export type WorkspaceRepositories = ReturnType<
  typeof createWorkspaceRepositories
>;
