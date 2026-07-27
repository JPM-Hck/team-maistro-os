"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  EquipmentChanges,
  EquipmentInput,
  EquipmentRecord,
} from "@/domain/equipment/types";
import type { EquipmentRepository } from "@/infrastructure/equipment/equipment-repository";
import { LocalStorageEquipmentRepository } from "@/infrastructure/equipment/local-storage-equipment-repository";

export interface EquipmentController {
  items: EquipmentRecord[];
  activeItems: EquipmentRecord[];
  loading: boolean;
  saving: boolean;
  error: string;
  notice: string;
  createItem(input: EquipmentInput): Promise<boolean>;
  updateItem(id: string, changes: EquipmentChanges): Promise<boolean>;
  archiveItem(id: string): Promise<boolean>;
  clearNotice(): void;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado en equipo.";
}

export function useEquipment(
  repositoryOverride?: EquipmentRepository,
): EquipmentController {
  const repository = useMemo(
    () => repositoryOverride ?? new LocalStorageEquipmentRepository(),
    [repositoryOverride],
  );
  const [items, setItems] = useState<EquipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setItems(await repository.getAll());
  }, [repository]);

  useEffect(() => {
    let active = true;
    function load() {
      repository
        .getAll()
        .then((saved) => {
          if (active) setItems(saved);
        })
        .catch((caught) => {
          if (active) setError(errorMessage(caught));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    load();
    const unsubscribe = repository.subscribe?.(load);
    return () => {
      active = false;
      unsubscribe?.();
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

  const createItem = useCallback(
    (input: EquipmentInput) =>
      run(async () => {
        await repository.create(input);
      }, "Equipo agregado correctamente."),
    [repository, run],
  );

  const updateItem = useCallback(
    (id: string, changes: EquipmentChanges) =>
      run(async () => {
        await repository.update(id, changes);
      }, "Equipo actualizado correctamente."),
    [repository, run],
  );

  const archiveItem = useCallback(
    (id: string) =>
      run(async () => {
        await repository.archive(id);
      }, "Equipo archivado. Puedes consultarlo con el filtro Archivados."),
    [repository, run],
  );

  return {
    items,
    activeItems: items.filter((item) => item.status !== "archived"),
    loading,
    saving,
    error,
    notice,
    createItem,
    updateItem,
    archiveItem,
    clearNotice: () => setNotice(""),
  };
}
