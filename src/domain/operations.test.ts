import { describe, expect, it } from "vitest";
import { initialInventory, marbleRecipe } from "./demo-data";
import {
  calculateRequirements,
  planTask,
  receivePurchase,
  wouldCreateDependencyCycle,
} from "./operations";

const baseInput = {
  taskId: "task-marble",
  quantity: 20,
  unit: "m²",
  recipeApproved: true,
  recipeLines: marbleRecipe,
  inventory: initialInventory,
  predecessorsComplete: true,
  tools: [{ toolType: "Cortadora", critical: true, available: true }],
  workerHasConflict: false,
  idempotencyKey: "plan-task-marble-v1",
};

describe("planeación de tareas", () => {
  it("rechaza cantidades iguales a cero", () => {
    expect(() => calculateRequirements(0, marbleRecipe, initialInventory)).toThrow(
      "mayor que cero",
    );
  });

  it("calcula la receta de 20 m² de mármol", () => {
    const requirements = calculateRequirements(20, marbleRecipe, initialInventory);
    expect(requirements.map((item) => item.required)).toEqual([21.6, 5, 0.8]);
  });

  it("bloquea la tarea y genera la requisición por faltante", () => {
    const result = planTask(baseInput);
    expect(result.status).toBe("blocked");
    expect(result.requisition?.lines).toEqual([
      {
        itemId: "marble",
        itemName: "Mármol crema marfil",
        unit: "m²",
        shortage: 5.1,
      },
    ]);
  });

  it("mantiene la requisición parcial y permite reservar tras la recepción completa", () => {
    const partial = receivePurchase(
      initialInventory,
      [{ itemId: "marble", quantity: 2 }],
      [{ itemId: "marble", shortage: 5.1 }],
    );
    expect(partial.status).toBe("partially_received");
    expect(planTask({ ...baseInput, inventory: partial.inventory }).status).toBe("blocked");

    const complete = receivePurchase(
      partial.inventory,
      [{ itemId: "marble", quantity: 3.1 }],
      [{ itemId: "marble", shortage: 3.1 }],
    );
    const planned = planTask({ ...baseInput, inventory: complete.inventory });
    expect(planned.status).toBe("ready");
    expect(planned.reservationCreated).toBe(true);
  });

  it("no duplica una reserva con la misma clave de idempotencia", () => {
    const result = planTask({
      ...baseInput,
      inventory: receivePurchase(
        initialInventory,
        [{ itemId: "marble", quantity: 5.1 }],
        [{ itemId: "marble", shortage: 5.1 }],
      ).inventory,
      usedIdempotencyKeys: new Set(["plan-task-marble-v1"]),
    });
    expect(result.reservationCreated).toBe(false);
  });

  it("bloquea una herramienta crítica no disponible", () => {
    const result = planTask({
      ...baseInput,
      tools: [{ toolType: "Cortadora", critical: true, available: false }],
    });
    expect(result.blockingReasons.join(" ")).toContain("Cortadora");
  });

  it("detecta una dependencia circular", () => {
    expect(
      wouldCreateDependencyCycle(
        [
          ["nivelar", "impermeabilizar"],
          ["impermeabilizar", "colocar-marmol"],
        ],
        ["colocar-marmol", "nivelar"],
      ),
    ).toBe(true);
  });
});
