import type { InventoryItem, RecipeLine, ToolRequirement } from "./operations";

export const marbleRecipe: RecipeLine[] = [
  {
    itemId: "marble",
    itemName: "Mármol crema marfil",
    unit: "m²",
    consumptionPerUnit: 1,
    wasteRate: 0.08,
  },
  {
    itemId: "adhesive",
    itemName: "Adhesivo para mármol",
    unit: "bulto",
    consumptionPerUnit: 0.25,
    wasteRate: 0,
  },
  {
    itemId: "grout",
    itemName: "Boquilla",
    unit: "kg",
    consumptionPerUnit: 0.04,
    wasteRate: 0,
  },
];

export const initialInventory: InventoryItem[] = [
  {
    id: "marble",
    name: "Mármol crema marfil",
    unit: "m²",
    physicalStock: 18,
    reservedStock: 1,
    safetyStock: 0.5,
  },
  {
    id: "adhesive",
    name: "Adhesivo para mármol",
    unit: "bulto",
    physicalStock: 9,
    reservedStock: 1,
    safetyStock: 2,
  },
  {
    id: "grout",
    name: "Boquilla",
    unit: "kg",
    physicalStock: 3,
    reservedStock: 0.5,
    safetyStock: 0.5,
  },
];

export const demoTools: ToolRequirement[] = [
  { toolType: "Cortadora de piso", critical: true, available: true },
  { toolType: "Nivel láser", critical: true, available: true },
];
