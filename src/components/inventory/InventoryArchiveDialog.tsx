"use client";

import type { InventoryRecord } from "@/domain/inventory/types";

export function InventoryArchiveDialog({
  item,
  saving,
  onCancel,
  onConfirm,
}: {
  item: InventoryRecord;
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
        aria-labelledby="archive-inventory-title"
      >
        <div className="archive-confirmation">
          <span className="archive-warning">!</span>
          <h2 id="archive-inventory-title">¿Archivar {item.name}?</h2>
          <p>
            Se ocultará del inventario activo y dejará de participar en la
            planeación. Su información permanecerá disponible en Archivados.
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
              {saving ? "Archivando…" : "Sí, archivar artículo"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
