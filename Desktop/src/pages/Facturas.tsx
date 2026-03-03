import { useMemo, useState } from 'react';
import { useFacturasDia, useFacturasRango } from '../hooks/use-facturas';
import { formatCurrency, formatDate } from '../utils/formatNumber';
import {
  Receipt,
  RefreshCw,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle
} from 'lucide-react';

function getEstadoInfo(estado?: string) {
  switch (estado) {
    case 'pagado':
      return { icon: CheckCircle2, color: 'text-success', bg: 'badge-success', border: 'border-l-success', label: 'PAGADO' };
    case 'cancelado':
      return { icon: XCircle, color: 'text-danger', bg: 'badge-danger', border: 'border-l-danger', label: 'CANCELADO' };
    default:
      return { icon: Clock, color: 'text-warning', bg: 'badge-warning', border: 'border-l-warning', label: 'PENDIENTE' };
  }
}

export function FacturasPage() {
  const { data: dayFacturas, loading: dayLoading, error: dayError, stats, refetch, updateEstado } = useFacturasDia();
  const { data: rangeFacturas, loading: rangeLoading, error: rangeError, from, to, setFrom, setTo, fetchData } = useFacturasRango();
  const [rangeErrorLocal, setRangeErrorLocal] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const dayResumen = useMemo(
    () => ({
      total: stats.totalDia,
      pagado: stats.totalPagado,
      pendiente: stats.totalPendiente,
      count: stats.count,
    }),
    [stats],
  );

  const handleToggleEstado = async (facturaId: number, currentEstado?: string) => {
    const nuevoEstado = currentEstado === 'pagado' ? 'pendiente' : 'pagado';
    setUpdatingId(facturaId);
    try {
      await updateEstado(facturaId, nuevoEstado);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSearchRange = () => {
    if (!from || !to) {
      setRangeErrorLocal('Debes ingresar ambas fechas.');
      return;
    }
    if (new Date(from) > new Date(to)) {
      setRangeErrorLocal('"Desde" no puede ser posterior a "Hasta".');
      return;
    }
    setRangeErrorLocal('');
    fetchData(from, to);
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <Receipt className="page-icon" />
            Facturas del Día
          </h1>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-outline" onClick={refetch} disabled={dayLoading}>
            <RefreshCw size={16} className={dayLoading ? 'spinning' : ''} />
            <span>Refrescar</span>
          </button>
        </div>
      </header>

      {/* ── Resumen ── */}
      <div className="facturas-summary-bar mb-4">
        <div className="summary-item">
          <span className="summary-label">Total</span>
          <span className="summary-value">${formatCurrency(dayResumen.total)}</span>
        </div>
        <div className="summary-item summary-success">
          <span className="summary-label">Pagado</span>
          <span className="summary-value">${formatCurrency(dayResumen.pagado)}</span>
        </div>
        <div className="summary-item summary-warning">
          <span className="summary-label">Pendiente</span>
          <span className="summary-value">${formatCurrency(dayResumen.pendiente)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Facturas</span>
          <span className="summary-value">{dayResumen.count}</span>
        </div>
      </div>

      {dayError && (
        <div className="error-alert mb-4">
          <AlertCircle size={16} /> <span>{dayError}</span>
        </div>
      )}

      {/* ── Facturas del Día — Cards ── */}
      {dayLoading ? (
        <div className="loading-state">
          <RefreshCw size={32} className="spinning text-muted mb-2" />
          <p>Cargando facturas...</p>
        </div>
      ) : dayFacturas.length === 0 ? (
        <div className="empty-state pos-card mb-4">
          <Receipt size={48} className="text-muted mb-3" />
          <h3>Sin facturas hoy</h3>
          <p className="text-muted">No hay facturas registradas para el día de hoy.</p>
        </div>
      ) : (
        <div className="facturas-cards-grid mb-4">
          {dayFacturas.map((factura, index) => {
            const productos = (factura.ordenes || []).flatMap((orden) => orden.productos || []);
            const info = getEstadoInfo(factura.estado);
            const Icon = info.icon;

            return (
              <div key={factura.facturaId || index} className={`factura-card pos-card border-l-4 ${info.border}`}>
                {/* Header: client + total */}
                <div className="factura-card-header">
                  <div>
                    <strong className="factura-client">{factura.clienteNombre || 'Sin nombre'}</strong>
                    <div className="factura-meta">
                      {formatDate(factura.fechaFactura)}
                    </div>
                  </div>
                  <div className="factura-card-right">
                    <span className="factura-total">${formatCurrency(factura.total || 0)}</span>
                    <span className="factura-metodo">{factura.metodo || '—'}</span>
                  </div>
                </div>

                {/* Products */}
                {productos.length > 0 && (
                  <div className="factura-products">
                    {productos.map((p, i) => (
                      <span key={i} className="factura-product-item">
                        {p.cantidad || 1}x {p.productoNombre || 'Producto'}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer: estado + action */}
                <div className="factura-card-footer">
                  <span className={`factura-estado-badge ${info.color}`}>
                    <Icon size={14} />
                    {info.label}
                  </span>

                  {factura.estado !== 'cancelado' && (
                    <button
                      className={factura.estado === 'pagado' ? 'btn-factura-pendiente' : 'btn-factura-pagado'}
                      disabled={updatingId === factura.facturaId}
                      onClick={() => factura.facturaId && handleToggleEstado(factura.facturaId, factura.estado)}
                    >
                      {updatingId === factura.facturaId
                        ? '...'
                        : factura.estado === 'pagado'
                          ? 'Marcar Pendiente'
                          : 'Marcar Pagado'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Consulta por Rango ── */}
      <section className="pos-card">
        <h2 className="section-title mb-3">
          <Calendar size={20} />
          Consulta por Rango
        </h2>
        <div className="date-filters flex gap-4 flex-wrap items-end mb-3">
          <div className="form-group flex-1">
            <label className="text-xs text-muted mb-1 block">Desde</label>
            <div className="input-with-icon">
              <Calendar size={14} />
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
          </div>
          <div className="form-group flex-1">
            <label className="text-xs text-muted mb-1 block">Hasta</label>
            <div className="input-with-icon">
              <Calendar size={14} />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex-initial">
            <button type="button" className="btn-primary" onClick={handleSearchRange}>
              <Search size={16} /> Buscar
            </button>
          </div>
        </div>

        {(rangeErrorLocal || rangeError) && (
          <div className="error-alert mb-3">
            <AlertCircle size={16} /> <span>{rangeErrorLocal || rangeError}</span>
          </div>
        )}

        {rangeLoading ? (
          <div className="text-muted">Cargando...</div>
        ) : rangeFacturas.length === 0 ? (
          <div className="text-muted text-sm">Sin resultados en el rango seleccionado.</div>
        ) : (
          <>
            <div className="text-sm text-muted mb-3">{rangeFacturas.length} facturas encontradas</div>
            <div className="facturas-cards-grid">
              {rangeFacturas.map((factura, index) => {
                const productos = (factura.ordenes || []).flatMap((orden) => orden.productos || []);
                const info = getEstadoInfo(factura.estado);
                const Icon = info.icon;

                return (
                  <div key={factura.facturaId || index} className={`factura-card pos-card border-l-4 ${info.border}`}>
                    <div className="factura-card-header">
                      <div>
                        <strong className="factura-client">{factura.clienteNombre || 'Sin nombre'}</strong>
                        <div className="factura-meta">{formatDate(factura.fechaFactura)}</div>
                      </div>
                      <div className="factura-card-right">
                        <span className="factura-total">${formatCurrency(factura.total || 0)}</span>
                        <span className="factura-metodo">{factura.metodo || '—'}</span>
                      </div>
                    </div>

                    {productos.length > 0 && (
                      <div className="factura-products">
                        {productos.map((p, i) => (
                          <span key={i} className="factura-product-item">
                            {p.cantidad || 1}x {p.productoNombre || 'Producto'}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="factura-card-footer">
                      <span className={`factura-estado-badge ${info.color}`}>
                        <Icon size={14} />
                        {info.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}