"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  InventoryChanges,
  InventoryInput,
  InventoryRecord,
} from "@/domain/inventory/types";
import type { InventoryItem } from "@/domain/operations";
import type { InventoryRepository } from "@/infrastructure/inventory/inventory-repository";
import { LocalStorageInventoryRepository } from "@/infrastructure/inventory/local-storage-inventory-repository";

export interface InventoryController {
  items: InventoryRecord[];
  activeItems: InventoryRecord[];
  loading: boolean;
  saving: boolean;
  error: string;
  notice: string;
  createItem(input: InventoryInput): Promise<boolean>;
  updateItem(id: string, changes: InventoryChanges): Promise<boolean>;
  archiveItem(id: string): Promise<boolean>;
  updateStockLevels(items: InventoryItem[]): Promise<boolean>;
  resetDemoStock(items: InventoryItem[]): Promise<boolean>;
  clearNotice(): void;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado en inventario.";
}

export function useInventory(
  repositoryOverride?: InventoryRepository,
): InventoryController {
  const repository = useMemo(
    () => repositoryOverride ?? new LocalStorageInventoryRepository(),
    [repositoryOverride],
  );
  const [items, setItems] = useState<InventoryRecord[]>([]);
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
    async (operation: () => Promise<void>, successMessage = "") => {
      setSaving(true);
      setError("");
      if (successMessage) setNotice("");
      try {
        await operation();
        await refresh();
        if (successMessage) setNotice(successMessage);
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
    (input: InventoryInput) =>
      run(async () => {
        await repository.create(input);
      }, "Artículo agregado al inventario."),
    [repository, run],
  );

  const updateItem = useCallback(
    (id: string, changes: InventoryChanges) =>
      run(async () => {
        await repository.update(id, changes);
      }, "Artículo actualizado correctamente."),
    [repository, run],
  );

  const archiveItem = useCallback(
    (id: string) =>
      run(async () => {
        await repository.archive(id);
      }, "Artículo archivado. Puedes consultarlo con el filtro Archivados."),
    [repository, run],
  );

  const updateStockLevels = useCallback(
    (stock: InventoryItem[]) =>
      run(async () => {
        await repository.updateStockLevels(stock);
      }),
    [repository, run],
  );

  const resetDemoStock = useCallback(
    (stock: InventoryItem[]) =>
      run(async () => {
        await repository.resetDemoStock(stock);
      }),
    [repository, run],
  );

  return {
    items,
    activeItems: items.filter((item) => item.status === "active"),
    loading,
    saving,
    error,
    notice,
    createItem,
    updateItem,
    archiveItem,
    updateStockLevels,
    resetDemoStock,
    clearNotice: () => setNotice(""),
  };
}
