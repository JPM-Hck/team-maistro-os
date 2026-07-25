export type AppRole = "administrator" | "supervisor" | "warehouse";

export type TaskStatus =
  | "draft"
  | "planned"
  | "blocked"
  | "ready"
  | "in_progress"
  | "in_review"
  | "completed"
  | "cancelled";

export type RequisitionStatus =
  | "draft"
  | "pending"
  | "approved"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export type ToolStatus =
  | "available"
  | "reserved"
  | "assigned"
  | "maintenance"
  | "lost"
  | "retired";

export interface RecipeLine {
  itemId: string;
  itemName: string;
  unit: string;
  consumptionPerUnit: number;
  wasteRate: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  physicalStock: number;
  reservedStock: number;
  safetyStock: number;
}

export interface Requirement {
  itemId: string;
  itemName: string;
  unit: string;
  required: number;
  available: number;
  shortage: number;
}

export interface ToolRequirement {
  toolType: string;
  critical: boolean;
  available: boolean;
}

export interface PlanningInput {
  taskId: string;
  quantity: number;
  unit: string;
  recipeApproved: boolean;
  recipeLines: RecipeLine[];
  inventory: InventoryItem[];
  predecessorsComplete: boolean;
  tools: ToolRequirement[];
  workerHasConflict: boolean;
  idempotencyKey: string;
  usedIdempotencyKeys?: Set<string>;
}

export interface PlanningResult {
  status: TaskStatus;
  requirements: Requirement[];
  blockingReasons: string[];
  requisition:
    | {
        status: RequisitionStatus;
        lines: Array<Pick<Requirement, "itemId" | "itemName" | "unit" | "shortage">>;
      }
    | null;
  inventory: InventoryItem[];
  reservationCreated: boolean;
}

const precision = 100;

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * precision) / precision;
}

export function getAvailableStock(item: InventoryItem) {
  return round2(Math.max(item.physicalStock - item.reservedStock - item.safetyStock, 0));
}

export function calculateRequirements(
  quantity: number,
  recipeLines: RecipeLine[],
  inventory: InventoryItem[],
): Requirement[] {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("La cantidad de la tarea debe ser mayor que cero.");
  }

  const inventoryById = new Map(inventory.map((item) => [item.id, item]));

  return recipeLines.map((line) => {
    const item = inventoryById.get(line.itemId);
    const required = round2(quantity * line.consumptionPerUnit * (1 + line.wasteRate));
    const available = item ? getAvailableStock(item) : 0;

    return {
      itemId: line.itemId,
      itemName: line.itemName,
      unit: line.unit,
      required,
      available,
      shortage: round2(Math.max(required - available, 0)),
    };
  });
}

export function planTask(input: PlanningInput): PlanningResult {
  const usedKeys = input.usedIdempotencyKeys ?? new Set<string>();
  if (usedKeys.has(input.idempotencyKey)) {
    return {
      status: "ready",
      requirements: calculateRequirements(input.quantity, input.recipeLines, input.inventory),
      blockingReasons: [],
      requisition: null,
      inventory: input.inventory,
      reservationCreated: false,
    };
  }

  if (!input.recipeApproved) {
    return blockedResult(input, ["La receta necesita aprobación."]);
  }

  const blockingReasons: string[] = [];
  if (!input.predecessorsComplete) {
    blockingReasons.push("Hay tareas predecesoras sin terminar.");
  }

  const missingCriticalTool = input.tools.find((tool) => tool.critical && !tool.available);
  if (missingCriticalTool) {
    blockingReasons.push(`La herramienta crítica "${missingCriticalTool.toolType}" no está disponible.`);
  }

  if (input.workerHasConflict) {
    blockingReasons.push("El trabajador asignado tiene un conflicto de horario.");
  }

  const requirements = calculateRequirements(input.quantity, input.recipeLines, input.inventory);
  const shortages = requirements.filter((requirement) => requirement.shortage > 0);
  if (shortages.length > 0) {
    blockingReasons.push("Faltan materiales para reservar la tarea.");
  }

  if (blockingReasons.length > 0) {
    return {
      status: "blocked",
      requirements,
      blockingReasons,
      requisition:
        shortages.length > 0
          ? {
              status: "pending",
              lines: shortages.map(({ itemId, itemName, unit, shortage }) => ({
                itemId,
                itemName,
                unit,
                shortage,
              })),
            }
          : null,
      inventory: input.inventory,
      reservationCreated: false,
    };
  }

  const requirementByItem = new Map(requirements.map((item) => [item.itemId, item]));
  const reservedInventory = input.inventory.map((item) => {
    const requirement = requirementByItem.get(item.id);
    if (!requirement) return item;

    return {
      ...item,
      reservedStock: round2(item.reservedStock + requirement.required),
    };
  });

  return {
    status: "ready",
    requirements,
    blockingReasons: [],
    requisition: null,
    inventory: reservedInventory,
    reservationCreated: true,
  };
}

function blockedResult(input: PlanningInput, blockingReasons: string[]): PlanningResult {
  return {
    status: "blocked",
    requirements:
      input.quantity > 0
        ? calculateRequirements(input.quantity, input.recipeLines, input.inventory)
        : [],
    blockingReasons,
    requisition: null,
    inventory: input.inventory,
    reservationCreated: false,
  };
}

export function receivePurchase(
  inventory: InventoryItem[],
  receipts: Array<{ itemId: string; quantity: number }>,
  requisitionLines: Array<{ itemId: string; shortage: number }>,
) {
  const receiptByItem = new Map(receipts.map((receipt) => [receipt.itemId, receipt.quantity]));
  const updatedInventory = inventory.map((item) => ({
    ...item,
    physicalStock: round2(item.physicalStock + (receiptByItem.get(item.id) ?? 0)),
  }));

  const fullyReceived = requisitionLines.every(
    (line) => (receiptByItem.get(line.itemId) ?? 0) >= line.shortage,
  );

  return {
    inventory: updatedInventory,
    status: fullyReceived ? ("received" as const) : ("partially_received" as const),
  };
}

export function wouldCreateDependencyCycle(
  edges: Array<[string, string]>,
  candidate: [string, string],
) {
  const adjacency = new Map<string, string[]>();
  for (const [from, to] of [...edges, candidate]) {
    adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(node: string): boolean {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);

    for (const next of adjacency.get(node) ?? []) {
      if (visit(next)) return true;
    }

    visiting.delete(node);
    visited.add(node);
    return false;
  }

  return [...adjacency.keys()].some(visit);
}
