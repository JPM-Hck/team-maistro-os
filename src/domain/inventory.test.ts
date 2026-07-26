import { describe, expect, it } from "vitest";
import type { InventoryCatalogItem } from "./entities";
import { applyInventoryAdjustment, canArchiveInventoryItem } from "./inventory";

const item: InventoryCatalogItem = {
  id: "marble",
  sku: "MAR-001",
  name: "Mármol",
  unit: "m²",
  physicalStock: 20,
  reservedStock: 5,
  safetyStock: 2,
  averageCost: 800,
  location: "Almacén A",
  active: true,
};

describe("inventory adjustments", () => {
  it("requires a project for an issue", () => {
    expect(() => applyInventoryAdjustment({
      item,
      kind: "issue",
      quantity: 2,
      reason: "Salida",
    })).toThrow("Selecciona el proyecto");
  });

  it("prevents consuming reserved or safety stock", () => {
    expect(() => applyInventoryAdjustment({
      item,
      kind: "consume",
      quantity: 14,
      projectId: "project-1",
      reason: "Consumo",
    })).toThrow("compromete reservas");
  });

  it("records a valid receipt", () => {
    expect(applyInventoryAdjustment({
      item,
      kind: "receipt",
      quantity: 5,
      reason: "Compra",
    }).physicalStock).toBe(25);
  });

  it("archives only empty unreserved items", () => {
    expect(canArchiveInventoryItem(item)).toBe(false);
    expect(canArchiveInventoryItem({ ...item, physicalStock: 0, reservedStock: 0 })).toBe(true);
  });
});
