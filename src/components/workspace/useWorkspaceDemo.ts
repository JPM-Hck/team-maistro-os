"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlanningResult,
  RequisitionStatus,
  Requirement,
  TaskStatus,
} from "@/domain/operations";
import { matchEmployeeByName } from "@/infrastructure/workspace/workspace-migration";
import type { WorkspaceRepository } from "@/infrastructure/workspace/workspace-repository";

export type DemoTask = {
  id: string;
  name: string;
  project: string;
  quantity: number;
  unit: string;
  responsible: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
};

export type DemoRequisitionLine = Pick<
  Requirement,
  "itemId" | "itemName" | "unit" | "shortage"
>;

export function useWorkspaceDemo(storage: WorkspaceRepository) {
  const [workspace, setWorkspace] = useState(() => storage.getWorkspace());

  useEffect(
    () => storage.subscribe((snapshot) => setWorkspace(snapshot)),
    [storage],
  );

  const activeTask = useMemo(
    () =>
      workspace.tasks.find(
        (task) => task.id === workspace.demo.activeTaskId,
      ) ??
      workspace.tasks[0] ??
      null,
    [workspace],
  );
  const requisition =
    workspace.requisitions.find(
      (item) =>
        item.taskId === activeTask?.id &&
        item.status !== "cancelled",
    ) ?? null;
  const task: DemoTask = activeTask
    ? {
        id: activeTask.id,
        name: activeTask.name,
        project:
          workspace.projects.find(
            (project) => project.id === activeTask.projectId,
          )?.name ?? "Sin proyecto",
        quantity: activeTask.quantity,
        unit: activeTask.unit,
        responsible:
          workspace.employees.find(
            (employee) =>
              employee.id === activeTask.assigneeIds[0],
          )?.fullName ?? "Sin responsable",
        startDate: activeTask.startDate,
        endDate: activeTask.targetDate,
        status: activeTask.status,
      }
    : {
        id: "task-empty",
        name: "Sin tarea",
        project: "Sin proyecto",
        quantity: 20,
        unit: "m²",
        responsible: "Sin responsable",
        startDate: "2026-07-28",
        endDate: "2026-07-30",
        status: "draft",
      };
  const requisitionLines: DemoRequisitionLine[] =
    requisition?.items.map((item) => {
      const inventory = workspace.inventoryItems.find(
        (record) => record.id === item.inventoryItemId,
      );
      return {
        itemId: item.inventoryItemId,
        itemName: inventory?.name ?? item.inventoryItemId,
        unit: inventory?.unit ?? "",
        shortage: item.shortageQuantity,
      };
    }) ?? [];

  function applyPlanning(
    nextTask: DemoTask,
    result: PlanningResult,
  ) {
    storage.update((current) => {
      const timestamp = new Date().toISOString();
      const storedTask = current.tasks.find(
        (candidate) => candidate.id === nextTask.id,
      );
      if (!storedTask) return current;
      const employee = matchEmployeeByName(
        current.employees,
        nextTask.responsible,
      );
      storedTask.name = nextTask.name;
      storedTask.quantity = nextTask.quantity;
      storedTask.startDate = nextTask.startDate;
      storedTask.targetDate = nextTask.endDate;
      storedTask.status = result.status;
      storedTask.assigneeIds = employee
        ? [employee.id]
        : storedTask.assigneeIds;
      storedTask.updatedAt = timestamp;
      current.demo.phase =
        result.status === "blocked" ? "blocked" : "ready";
      current.demo.activeTaskId = storedTask.id;
      current.demo.activity = [
        result.status === "blocked"
          ? `Requisición creada por ${result.requisition?.lines.length ?? 0} faltante.`
          : `Tarea "${storedTask.name}" planeada y reservada.`,
        ...current.demo.activity,
      ];

      if (result.requisition) {
        const existing = current.requisitions.find(
          (item) =>
            item.taskId === storedTask.id &&
            !["received", "cancelled"].includes(item.status),
        );
        const items = result.requirements
          .filter((item) => item.shortage > 0)
          .map((item) => ({
            inventoryItemId: item.itemId,
            requiredQuantity: item.required,
            availableQuantity: item.available,
            shortageQuantity: item.shortage,
            receivedQuantity: 0,
          }));
        if (existing) {
          existing.items = items;
          existing.status = result.requisition.status;
          existing.updatedAt = timestamp;
        } else {
          current.requisitions.push({
            id: `requisition-${storedTask.id}`,
            folio: "RQ-024",
            projectId: storedTask.projectId,
            taskId: storedTask.id,
            status: result.requisition.status,
            items,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
      }
      return current;
    });
  }

  function markReceived(status: RequisitionStatus) {
    storage.update((current) => {
      const timestamp = new Date().toISOString();
      const stored = current.requisitions.find(
        (item) => item.id === requisition?.id,
      );
      if (stored) {
        stored.status = status;
        stored.items.forEach((item) => {
          item.receivedQuantity = item.shortageQuantity;
        });
        stored.updatedAt = timestamp;
      }
      current.demo.phase = "received";
      current.demo.activity = [
        "Compra RQ-024 recibida y movimiento de entrada registrado.",
        ...current.demo.activity,
      ];
      return current;
    });
  }

  function markReserved(result: PlanningResult) {
    storage.update((current) => {
      const storedTask = current.tasks.find(
        (candidate) => candidate.id === activeTask?.id,
      );
      if (storedTask) {
        storedTask.status = result.status;
        storedTask.updatedAt = new Date().toISOString();
      }
      current.demo.phase =
        result.status === "ready" ? "ready" : "blocked";
      current.demo.activity = [
        result.status === "ready"
          ? "Reserva confirmada. Tarea actualizada a Lista."
          : "La verificación encontró un bloqueo pendiente.",
        ...current.demo.activity,
      ];
      return current;
    });
  }

  function reset() {
    storage.update((current) => {
      const storedTask = current.tasks.find(
        (candidate) => candidate.id === current.demo.activeTaskId,
      );
      if (storedTask) {
        storedTask.status = "draft";
        storedTask.updatedAt = new Date().toISOString();
      }
      current.requisitions = current.requisitions.filter(
        (item) => item.taskId !== storedTask?.id,
      );
      current.demo.phase = "unplanned";
      current.demo.activity = [
        `Proyecto ${
          current.projects.find(
            (project) => project.id === current.activeProjectId,
          )?.name ?? "sin asignar"
        } cargado desde el workspace.`,
      ];
      return current;
    });
  }

  return {
    task,
    phase: workspace.demo.phase,
    activity: workspace.demo.activity,
    requisitionStatus: requisition?.status ?? null,
    requisitionLines,
    migrationReport: workspace.migrationReport,
    applyPlanning,
    markReceived,
    markReserved,
    reset,
  };
}
