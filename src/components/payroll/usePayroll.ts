"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PayrollWorker,
  PayrollWorkerChanges,
  PayrollWorkerInput,
} from "@/domain/payroll/types";
import type { PayrollRepository } from "@/infrastructure/payroll/payroll-repository";
import { LocalStoragePayrollRepository } from "@/infrastructure/payroll/local-storage-payroll-repository";

export interface PayrollController {
  workers: PayrollWorker[];
  activeWorkers: PayrollWorker[];
  loading: boolean;
  saving: boolean;
  error: string;
  notice: string;
  createWorker(input: PayrollWorkerInput): Promise<boolean>;
  updateWorker(
    id: string,
    changes: PayrollWorkerChanges,
  ): Promise<boolean>;
  archiveWorker(id: string): Promise<boolean>;
  clearNotice(): void;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado en nómina.";
}

export function usePayroll(
  repositoryOverride?: PayrollRepository,
): PayrollController {
  const repository = useMemo(
    () => repositoryOverride ?? new LocalStoragePayrollRepository(),
    [repositoryOverride],
  );
  const [workers, setWorkers] = useState<PayrollWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setWorkers(await repository.getAll());
  }, [repository]);

  useEffect(() => {
    let active = true;
    repository
      .getAll()
      .then((saved) => {
        if (active) setWorkers(saved);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repository]);

  const run = useCallback(
    async (operation: () => Promise<void>, successMessage: string) => {
      setSaving(true);
      setError("");
      setNotice("");
      try {
        await operation();
        await refresh();
        setNotice(successMessage);
        return true;
      } catch (caught) {
        setError(errorMessage(caught));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const createWorker = useCallback(
    (input: PayrollWorkerInput) =>
      run(async () => {
        await repository.create(input);
      }, "Persona agregada a la nómina."),
    [repository, run],
  );

  const updateWorker = useCallback(
    (id: string, changes: PayrollWorkerChanges) =>
      run(async () => {
        await repository.update(id, changes);
      }, "Registro de nómina actualizado."),
    [repository, run],
  );

  const archiveWorker = useCallback(
    (id: string) =>
      run(async () => {
        await repository.archive(id);
      }, "Persona archivada. Puedes consultarla desde Archivados."),
    [repository, run],
  );

  return {
    workers,
    activeWorkers: workers.filter((worker) => worker.status === "active"),
    loading,
    saving,
    error,
    notice,
    createWorker,
    updateWorker,
    archiveWorker,
    clearNotice: () => setNotice(""),
  };
}
