import type { ProjectAssignment, WorkerRate } from "./entities";

function toDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha no es válida.");
  return date.getTime();
}

export function dateRangesOverlap(
  first: { startsOn: string; endsOn: string },
  second: { startsOn: string; endsOn: string },
) {
  return toDay(first.startsOn) <= toDay(second.endsOn)
    && toDay(second.startsOn) <= toDay(first.endsOn);
}

export function validateProjectDates(startsOn: string, targetEndOn: string) {
  if (toDay(targetEndOn) < toDay(startsOn)) {
    throw new Error("La fecha objetivo no puede ser anterior al inicio.");
  }
}

export function validateAssignment(
  candidate: Omit<ProjectAssignment, "id">,
  existing: ProjectAssignment[],
) {
  if (toDay(candidate.endsOn) < toDay(candidate.startsOn)) {
    throw new Error("La asignación termina antes de comenzar.");
  }

  const conflict = existing.find(
    (assignment) =>
      assignment.active
      && assignment.workerId === candidate.workerId
      && dateRangesOverlap(assignment, candidate),
  );
  if (conflict) {
    throw new Error("El trabajador ya tiene una asignación en esas fechas.");
  }
}

export function validateRateChange(
  candidate: Omit<WorkerRate, "id">,
  existing: WorkerRate[],
) {
  if (!Number.isFinite(candidate.amount) || candidate.amount <= 0) {
    throw new Error("La tarifa debe ser mayor que cero.");
  }
  const end = candidate.effectiveTo ?? "9999-12-31";
  if (toDay(end) < toDay(candidate.effectiveFrom)) {
    throw new Error("La vigencia de la tarifa no es válida.");
  }

  const overlaps = existing.some((rate) => {
    if (rate.workerId !== candidate.workerId) return false;
    return dateRangesOverlap(
      { startsOn: rate.effectiveFrom, endsOn: rate.effectiveTo ?? "9999-12-31" },
      { startsOn: candidate.effectiveFrom, endsOn: end },
    );
  });
  if (overlaps) throw new Error("La tarifa se traslapa con otra vigencia.");
}
