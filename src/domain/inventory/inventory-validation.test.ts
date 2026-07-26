import { describe, expect, it } from "vitest";
import {
  isInventoryValid,
  validateInventory,
} from "./inventory-validation";
import type { InventoryInput, InventoryRecord } from "./types";

const validInput: InventoryInput = {
  sku: "MAT-100",
  name: "Cemento gris",
  description: "",
  unit: "bulto",
  physicalStock: 20,
  reservedStock: 2,
  safetyStock: 3,
  projectId: null,
  status: "active",
};

describe("inventory validation", () => {
  it("accepts a valid unassigned item", () => {
    expect(isInventoryValid(validateInventory(validInput))).toBe(true);
  });

  it("rejects required fields", () => {
    const errors = validateInventory({
      ...validInput,
      sku: "",
      name: "",
      unit: "",
    });
    expect(errors.sku).toBeTruthy();
    expect(errors.name).toBeTruthy();
    expect(errors.unit).toBeTruthy();
  });

  it("rejects negative stock quantities", () => {
    const errors = validateInventory({
      ...validInput,
      physicalStock: -1,
      safetyStock: -2,
    });
    expect(errors.physicalStock).toBeTruthy();
    expect(errors.safetyStock).toBeTruthy();
  });

  it("rejects reservations greater than physical stock", () => {
    expect(
      validateInventory({
        ...validInput,
        physicalStock: 2,
        reservedStock: 3,
      }).reservedStock,
    ).toBeTruthy();
  });

  it("rejects duplicated SKU regardless of casing", () => {
    const existing = {
      ...validInput,
      id: "existing",
      sku: "mat-100",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies InventoryRecord;
    expect(validateInventory(validInput, [existing]).sku).toBeTruthy();
  });
});
