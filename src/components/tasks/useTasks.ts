"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  TaskChanges,
  TaskInput,
  TaskRecord,
} from "@/domain/tasks/types";
import type { TaskRepository } from "@/infrastructure/tasks/task-repository";

export interface TasksController {
  tasks: TaskRecord[];
  loading: boolean;
  saving: boolean;
  error: string;
  notice: string;
  createTask(input: TaskInput): Promise<boolean>;
  updateTask(id: string, changes: TaskChanges): Promise<boolean>;
  completeTask(id: string): Promise<boolean>;
  cancelTask(id: string): Promise<boolean>;
  archiveTask(id: string): Promise<boolean>;
  clearNotice(): void;
}

export function useTasks(repository: TaskRepository): TasksController {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setTasks(await repository.getAll());
  }, [repository]);

  useEffect(() => {
    let active = true;
    function load() {
      repository
        .getAll()
        .then((records) => {
          if (active) setTasks(records);
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
    async (operation: () => Promise<void>, success: string) => {
      setSaving(true);
      setError("");
      setNotice("");
      try {
        await operation();
        await refresh();
        setNotice(success);
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

  return {
    tasks,
    loading,
    saving,
    error,
    notice,
    createTask: (input) =>
      run(async () => {
        await repository.create(input);
      }, "Tarea creada correctamente."),
    updateTask: (id, changes) =>
      run(async () => {
        await repository.update(id, changes);
      }, "Tarea actualizada correctamente."),
    completeTask: (id) =>
      run(async () => {
        await repository.complete(id);
      }, "Tarea terminada. El avance del proyecto fue recalculado."),
    cancelTask: (id) =>
      run(async () => {
        await repository.cancel(id);
      }, "Tarea cancelada y excluida del avance."),
    archiveTask: (id) =>
      run(async () => {
        await repository.archive(id);
      }, "Tarea archivada y excluida del avance."),
    clearNotice: () => setNotice(""),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado en tareas.";
}
