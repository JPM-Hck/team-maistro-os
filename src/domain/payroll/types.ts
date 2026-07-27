import { CASA_LOMAS_PROJECT } from "../projects/types";

export const SALARY_TYPES = ["daily", "weekly"] as const;
export type SalaryType = (typeof SALARY_TYPES)[number];

export const SALARY_TYPE_LABELS: Record<SalaryType, string> = {
  daily: "Sueldo diario",
  weekly: "Sueldo semanal",
};

export type PayrollWorkerStatus = "active" | "archived";

export interface PayrollWorker {
  id: string;
  employeeCode: string;
  name: string;
  position: string;
  projectId: string | null;
  salaryType: SalaryType;
  salaryAmount: number;
  scheduledDays: number;
  absenceDays: number;
  notes: string;
  status: PayrollWorkerStatus;
  createdAt: string;
  updatedAt: string;
}

export type PayrollWorkerInput = Omit<
  PayrollWorker,
  "id" | "createdAt" | "updatedAt"
>;
export type PayrollWorkerChanges = Partial<PayrollWorkerInput>;
export type PayrollField = keyof PayrollWorkerInput | "form";
export type PayrollValidationErrors = Partial<
  Record<PayrollField, string>
>;

export const INITIAL_PAYROLL_WORKERS: PayrollWorker[] = [
  {
    id: "worker-ruben",
    employeeCode: "EMP-001",
    name: "Rubén Martínez",
    position: "Instalador de acabados",
    projectId: CASA_LOMAS_PROJECT.id,
    salaryType: "daily",
    salaryAmount: 850,
    scheduledDays: 6,
    absenceDays: 0,
    notes: "",
    status: "active",
    createdAt: "2026-07-25T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "worker-maria",
    employeeCode: "EMP-002",
    name: "María Hernández",
    position: "Ayudante general",
    projectId: CASA_LOMAS_PROJECT.id,
    salaryType: "daily",
    salaryAmount: 650,
    scheduledDays: 6,
    absenceDays: 1,
    notes: "Una falta durante la semana.",
    status: "active",
    createdAt: "2026-07-25T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "worker-alejandro",
    employeeCode: "EMP-003",
    name: "Alejandro Sánchez",
    position: "Supervisor de obra",
    projectId: CASA_LOMAS_PROJECT.id,
    salaryType: "weekly",
    salaryAmount: 7_200,
    scheduledDays: 6,
    absenceDays: 0,
    notes: "",
    status: "active",
    createdAt: "2026-07-25T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
];

export function toPayrollWorkerInput(
  worker: PayrollWorker,
): PayrollWorkerInput {
  return {
    employeeCode: worker.employeeCode,
    name: worker.name,
    position: worker.position,
    projectId: worker.projectId,
    salaryType: worker.salaryType,
    salaryAmount: worker.salaryAmount,
    scheduledDays: worker.scheduledDays,
    absenceDays: worker.absenceDays,
    notes: worker.notes,
    status: worker.status,
  };
}
