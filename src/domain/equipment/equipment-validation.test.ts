import { describe, expect, it } from "vitest";
import {
  isEquipmentValid,
  validateEquipment,
} from "./equipment-validation";
import type { EquipmentInput, EquipmentRecord } from "./types";

const validInput: EquipmentInput = {
  code: "TL-100",
  name: "Taladro inalámbrico",
  category: "Perforación",
  description: "",
  serialNumber: "SERIE-100",
  location: "Almacén central",
  responsible: "",
  status: "available",
  critical: false,
  projectId: null,
  acquiredDate: "2026-01-01",
  nextMaintenanceDate: "2026-08-01",
};

describe("equipment validation", () => {
  it("accepts valid unassigned equipment", () => {
    expect(isEquipmentValid(validateEquipment(validInput))).toBe(true);
  });

  it("rejects required fields", () => {
    const errors = validateEquipment({
      ...validInput,
      code: "",
      name: "",
      category: "",
      location: "",
    });
    expect(errors.code).toBeTruthy();
    expect(errors.name).toBeTruthy();
    expect(errors.category).toBeTruthy();
    expect(errors.location).toBeTruthy();
  });

  it("rejects duplicated codes and serial numbers", () => {
    const existing = {
      ...validInput,
      id: "existing",
      code: "tl-100",
      serialNumber: "serie-100",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies EquipmentRecord;
    const errors = validateEquipment(validInput, [existing]);
    expect(errors.code).toBeTruthy();
    expect(errors.serialNumber).toBeTruthy();
  });

  it("requires a project for reserved or assigned equipment", () => {
    expect(
      validateEquipment({ ...validInput, status: "assigned" }).projectId,
    ).toBeTruthy();
  });

  it("rejects maintenance before acquisition", () => {
    expect(
      validateEquipment({
        ...validInput,
        acquiredDate: "2026-08-01",
        nextMaintenanceDate: "2026-07-01",
      }).nextMaintenanceDate,
    ).toBeTruthy();
  });
});
