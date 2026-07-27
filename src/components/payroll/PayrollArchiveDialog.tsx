"use client";

import type { PayrollWorker } from "@/domain/payroll/types";

export function PayrollArchiveDialog({
  worker,
  saving,
  onCancel,
  onConfirm,
}: {
  worker: PayrollWorker;
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
        aria-labelledby="archive-worker-title"
      >
        <div className="archive-confirmation">
          <span className="archive-warning">!</span>
          <h2 id="archive-worker-title">¿Quitar a {worker.name}?</h2>
          <p>
            La persona dejará de aparecer en la nómina activa, pero su
            información se conservará en Archivados.
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
              {saving ? "Archivando…" : "Sí, quitar persona"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
