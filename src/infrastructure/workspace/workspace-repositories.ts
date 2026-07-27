import { LocalStorageEquipmentRepository } from "../equipment/local-storage-equipment-repository";
import { LocalStorageInventoryRepository } from "../inventory/local-storage-inventory-repository";
import { LocalStoragePayrollRepository } from "../payroll/local-storage-payroll-repository";
import { LocalStorageProjectRepository } from "../projects/local-storage-project-repository";
import { getBrowserWorkspaceStorage } from "./workspace-storage";

export function createWorkspaceRepositories() {
  const storage = getBrowserWorkspaceStorage();
  return {
    storage,
    projects: new LocalStorageProjectRepository({ storage }),
    inventory: new LocalStorageInventoryRepository({ storage }),
    equipment: new LocalStorageEquipmentRepository({ storage }),
    payroll: new LocalStoragePayrollRepository({ storage }),
  };
}

export type WorkspaceRepositories = ReturnType<
  typeof createWorkspaceRepositories
>;
