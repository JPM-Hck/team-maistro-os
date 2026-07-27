import {
  assertValidPayrollWorker,
  normalizePayrollWorkerInput,
} from "../../domain/payroll/payroll-validation";
import {
  INITIAL_PAYROLL_WORKERS,
  type PayrollWorker,
  type PayrollWorkerChanges,
  type PayrollWorkerInput,
  toPayrollWorkerInput,
} from "../../domain/payroll/types";
import type { PayrollRepository } from "./payroll-repository";

export const PAYROLL_STORAGE_KEY = "team-maistro-os.payroll-workers.v1";
export type PayrollStorage = Pick<Storage, "getItem" | "setItem"> & {
  subscribe?(listener: () => void): () => void;
};

export interface LocalPayrollRepositoryOptions {
  storage?: PayrollStorage;
  now?: () => Date;
  createId?: () => string;
}

export class LocalStoragePayrollRepository implements PayrollRepository {
  private readonly injectedStorage?: PayrollStorage;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: LocalPayrollRepositoryOptions = {}) {
    this.injectedStorage = options.storage;
    this.now = options.now ?? (() => new Date());
    this.createId =
      options.createId ??
      (() =>
        globalThis.crypto?.randomUUID?.() ??
        `worker-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

  async getAll(): Promise<PayrollWorker[]> {
    const storage = this.storage();
    const raw = storage.getItem(PAYROLL_STORAGE_KEY);
    if (!raw) return this.seed(storage);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "No se pudo leer la nómina guardada. El almacenamiento está dañado.",
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error("El formato de la nómina guardada no es válido.");
    }
    if (parsed.length === 0) return this.seed(storage);
    return (parsed as PayrollWorker[]).map((worker) => ({ ...worker }));
  }

  async getById(id: string): Promise<PayrollWorker | null> {
    return (await this.getAll()).find((worker) => worker.id === id) ?? null;
  }

  async create(input: PayrollWorkerInput): Promise<PayrollWorker> {
    const workers = await this.getAll();
    const normalized = normalizePayrollWorkerInput(input);
    assertValidPayrollWorker(normalized, workers);
    const timestamp = this.now().toISOString();
    const created: PayrollWorker = {
      ...normalized,
      id: this.createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.write([...workers, created]);
    return { ...created };
  }

  async update(
    id: string,
    changes: PayrollWorkerChanges,
  ): Promise<PayrollWorker> {
    const workers = await this.getAll();
    const index = workers.findIndex((worker) => worker.id === id);
    if (index < 0) throw new Error("La persona ya no existe.");

    const current = workers[index];
    const normalized = normalizePayrollWorkerInput({
      ...toPayrollWorkerInput(current),
      ...changes,
    });
    assertValidPayrollWorker(normalized, workers, id);
    const updated: PayrollWorker = {
      ...current,
      ...normalized,
      updatedAt: this.now().toISOString(),
    };
    const next = [...workers];
    next[index] = updated;
    this.write(next);
    return { ...updated };
  }

  async archive(id: string): Promise<PayrollWorker> {
    return this.update(id, { status: "archived" });
  }

  subscribe(listener: () => void) {
    return this.storage().subscribe?.(listener) ?? (() => undefined);
  }

  private storage(): PayrollStorage {
    if (this.injectedStorage) return this.injectedStorage;
    if (typeof window !== "undefined") return window.localStorage;
    throw new Error("localStorage solo está disponible en el navegador.");
  }

  private seed(storage: PayrollStorage): PayrollWorker[] {
    const seeded = INITIAL_PAYROLL_WORKERS.map((worker) => ({ ...worker }));
    storage.setItem(PAYROLL_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  private write(workers: PayrollWorker[]) {
    this.storage().setItem(PAYROLL_STORAGE_KEY, JSON.stringify(workers));
  }
}
