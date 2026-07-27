import {
  EQUIPMENT_STATUS_LABELS,
  type EquipmentStatus,
} from "@/domain/equipment/types";

export function EquipmentStatusBadge({
  status,
}: {
  status: EquipmentStatus;
}) {
  return (
    <span className={`equipment-status equipment-status-${status}`}>
      {EQUIPMENT_STATUS_LABELS[status]}
    </span>
  );
}
