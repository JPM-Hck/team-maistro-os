"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Project,
  ProjectChanges,
  ProjectInput,
} from "@/domain/projects/types";
import { LocalStorageProjectRepository } from "@/infrastructure/projects/local-storage-project-repository";
import type { ProjectRepository } from "@/infrastructure/projects/project-repository";

export interface ProjectsController {
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;
  saving: boolean;
  error: string;
  notice: string;
  createProject(input: ProjectInput): Promise<boolean>;
  updateProject(id: string, changes: ProjectChanges): Promise<boolean>;
  archiveProject(id: string): Promise<boolean>;
  setActiveProject(id: string): Promise<boolean>;
  clearNotice(): void;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado en proyectos.";
}

export function useProjects(
  repositoryOverride?: ProjectRepository,
): ProjectsController {
  const repository = useMemo(
    () => repositoryOverride ?? new LocalStorageProjectRepository(),
    [repositoryOverride],
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const [savedProjects, savedActiveProjectId] = await Promise.all([
      repository.getAll(),
      repository.getActiveProjectId(),
    ]);
    setProjects(savedProjects);
    setActiveProjectId(savedActiveProjectId);
  }, [repository]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [savedProjects, savedActiveProjectId] = await Promise.all([
          repository.getAll(),
          repository.getActiveProjectId(),
        ]);
        if (!active) return;
        setProjects(savedProjects);
        setActiveProjectId(savedActiveProjectId);
      } catch (caught) {
        if (active) setError(errorMessage(caught));
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    const unsubscribe = repository.subscribe?.(() => {
      void load();
    });
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

  const createProject = useCallback(
    (input: ProjectInput) =>
      run(async () => {
        await repository.create(input);
      }, "Proyecto creado correctamente."),
    [repository, run],
  );

  const updateProject = useCallback(
    (id: string, changes: ProjectChanges) =>
      run(async () => {
        await repository.update(id, changes);
      }, "Proyecto actualizado correctamente."),
    [repository, run],
  );

  const archiveProject = useCallback(
    (id: string) =>
      run(async () => {
        await repository.archive(id);
      }, "Proyecto archivado. Puedes consultarlo desde el filtro Archivados."),
    [repository, run],
  );

  const setActiveProject = useCallback(
    (id: string) =>
      run(async () => {
        await repository.setActiveProjectId(id);
      }, "Proyecto activo actualizado."),
    [repository, run],
  );

  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? null;

  return {
    projects,
    activeProject,
    loading,
    saving,
    error,
    notice,
    createProject,
    updateProject,
    archiveProject,
    setActiveProject,
    clearNotice: () => setNotice(""),
  };
}
