import type { ProjectInput } from "../projects/types";
import type { Employee } from "./types";

export function getResponsibleAssignmentError(
  input: Pick<ProjectInput, "responsibleEmployeeId">,
  employees: Employee[],
  currentResponsibleEmployeeId: string | null = null,
) {
  const employeeId = input.responsibleEmployeeId ?? null;
  if (!employeeId) return "Selecciona una persona responsable.";

  const employee = employees.find((candidate) => candidate.id === employeeId);
  if (!employee) return "La persona responsable ya no existe.";

  if (
    employee.employmentStatus !== "active" &&
    employee.id !== currentResponsibleEmployeeId
  ) {
    return "Una persona archivada no puede recibir nuevas asignaciones.";
  }

  return "";
}

export function assertResponsibleEmployeeAssignable(
  input: Pick<ProjectInput, "responsibleEmployeeId">,
  employees: Employee[],
  currentResponsibleEmployeeId: string | null = null,
) {
  const error = getResponsibleAssignmentError(
    input,
    employees,
    currentResponsibleEmployeeId,
  );
  if (error) throw new Error(error);

  return employees.find(
    (employee) => employee.id === input.responsibleEmployeeId,
  )!;
}
