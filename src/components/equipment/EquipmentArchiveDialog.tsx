"use client";

import type { EquipmentRecord } from "@/domain/equipment/types";

export function EquipmentArchiveDialog({
  item,
  saving,
  onCancel,
  onConfirm,
}: {
  item: EquipmentRecord;
  saving: boolean;
  onCancel(): void;
  onConfirm(): Promise<void>;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="planner-modal archive-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-equipment-title"
      >
        <div className="archive-confirmation">
          <span className="archive-warning">!</span>
          <h2 id="archive-equipment-title">¿Archivar {item.name}?</h2>
          <p>
            Dejará de aparecer como recurso para la planeación, pero su
            información e historial permanecerán disponibles en Archivados.
          </p>
          <div className="planner-actions">
            <button
              className="secondary-button"
              onClick={onCancel}
              disabled={saving}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="danger-button"
              onClick={() => void onConfirm()}
              disabled={saving}
              type="button"
            >
              {saving ? "Archivando…" : "Sí, archivar equipo"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
