import type {
  PayrollWorker,
  PayrollWorkerChanges,
  PayrollWorkerInput,
} from "../../domain/payroll/types";

export interface PayrollRepository {
  getAll(): Promise<PayrollWorker[]>;
  getById(id: string): Promise<PayrollWorker | null>;
  create(input: PayrollWorkerInput): Promise<PayrollWorker>;
  update(
    id: string,
    changes: PayrollWorkerChanges,
  ): Promise<PayrollWorker>;
  archive(id: string): Promise<PayrollWorker>;
  subscribe?(listener: () => void): () => void;
}
