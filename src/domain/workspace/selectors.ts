import type {
  Employee,
  PayrollEntry,
  WorkspaceEquipmentItem,
  WorkspaceProject,
  WorkspaceState,
  WorkspaceTask,
} from "./types";

export function getProjectById(
  workspace: WorkspaceState,
  projectId: string | null,
) {
  return (
    workspace.projects.find((project) => project.id === projectId) ?? null
  );
}

export function getEmployeeById(
  workspace: WorkspaceState,
  employeeId: string | null,
) {
  return (
    workspace.employees.find((employee) => employee.id === employeeId) ?? null
  );
}

export function getTasksByProject(
  tasks: WorkspaceTask[],
  projectId: string,
) {
  return tasks.filter((task) => task.projectId === projectId);
}

export function getEmployeesByTask(
  employees: Employee[],
  task: WorkspaceTask,
) {
  const ids = new Set(task.assigneeIds);
  return employees.filter((employee) => ids.has(employee.id));
}

export function getOpenRequisitionsByProject(
  workspace: WorkspaceState,
  projectId: string,
) {
  return workspace.requisitions.filter(
    (requisition) =>
      requisition.projectId === projectId &&
      !["received", "cancelled"].includes(requisition.status),
  );
}

export function getEquipmentAssignmentsByProject(
  equipment: WorkspaceEquipmentItem[],
  projectId: string,
) {
  return equipment.filter(
    (item) =>
      item.status !== "archived" &&
      item.assignedProjectId === projectId,
  );
}

export function getPayrollEmployeesByProject(
  employees: Employee[],
  payrollEntries: PayrollEntry[],
  projectId: string,
) {
  const ids = new Set(
    payrollEntries
      .filter((entry) => entry.projectId === projectId)
      .map((entry) => entry.employeeId),
  );
  return employees.filter((employee) => ids.has(employee.id));
}

export function getActiveProject(workspace: WorkspaceState) {
  return getProjectById(workspace, workspace.activeProjectId);
}

export function projectName(
  projects: WorkspaceProject[],
  projectId: string,
) {
  return projects.find((project) => project.id === projectId)?.name ?? "—";
}

export function employeeName(
  employees: Employee[],
  employeeId: string,
) {
  return employees.find((employee) => employee.id === employeeId)?.fullName ?? "—";
}
