import React from 'react';

function PaginationBar({ page, totalPages, totalRecords, onPrevious, onNext }) {
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  return (
    <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2 mt-3">
      <small className="text-muted fw-bold">
        Mostrando página {page} de {totalPages} {typeof totalRecords === 'number' ? `· ${totalRecords} registros` : ''}
      </small>
      <div className="btn-group">
        <button type="button" className="btn btn-outline-secondary" onClick={onPrevious} disabled={page <= 1}>
          ← Anterior
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={onNext} disabled={page >= totalPages}>
          Siguiente →
        </button>
      </div>
    </div>
  );
}

export default PaginationBar;