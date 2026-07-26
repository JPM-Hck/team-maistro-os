import { describe, expect, it } from "vitest";
import {
  CASA_LOMAS_PROJECT,
  type ProjectInput,
} from "./types";
import { validateProject } from "./project-validation";

const validInput: ProjectInput = {
  name: "Torre Centro",
  code: "TC",
  projectType: "Adecuación",
  description: "Adecuación de oficinas.",
  clientName: "Cliente Centro",
  location: "CDMX",
  responsible: "María L.",
  startDate: "2026-08-01",
  targetDate: "2026-10-30",
  budget: 750_000,
  progress: 10,
  status: "planned",
  currentTask: "Levantamiento",
};

describe("validación de proyectos", () => {
  it("rechaza un nombre vacío", () => {
    expect(validateProject({ ...validInput, name: " " }).name).toBe(
      "El nombre es obligatorio.",
    );
  });

  it("rechaza un presupuesto negativo", () => {
    expect(validateProject({ ...validInput, budget: -1 }).budget).toContain(
      "negativo",
    );
  });

  it.each([-1, 101])("rechaza el progreso %s", (progress) => {
    expect(validateProject({ ...validInput, progress }).progress).toContain(
      "0 y 100",
    );
  });

  it("rechaza una fecha objetivo anterior a la inicial", () => {
    expect(
      validateProject({
        ...validInput,
        startDate: "2026-09-10",
        targetDate: "2026-09-09",
      }).targetDate,
    ).toContain("anterior");
  });

  it("rechaza códigos duplicados sin distinguir mayúsculas", () => {
    expect(
      validateProject(
        { ...validInput, code: " cl " },
        [CASA_LOMAS_PROJECT],
      ).code,
    ).toContain("Ya existe");
  });
});
