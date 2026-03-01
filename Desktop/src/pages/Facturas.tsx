import { useMemo, useState } from 'react';
import { useFacturasDia, useFacturasRango } from '../hooks/use-facturas';
import { formatCurrency, formatDate } from '../utils/formatNumber';

function FacturaProducts({ facturaIndex, productos }: { facturaIndex: number; productos: Array<{ productoNombre?: string; cantidad?: number; subtotal?: number }> }) {
  return (
    <div className="desk-list-products">
      {productos.length === 0 ? (
        <span className="desk-subtle-text desk-font-13">Sin productos en factura #{facturaIndex + 1}</span>
      ) : (
        productos.map((producto, index) => (
          <div key={`${facturaIndex}-${index}`} className="desk-row-between desk-font-13">
            <span>{producto.cantidad || 1}x {producto.productoNombre || 'Producto'}</span>
            <span className="desk-subtle-text">${formatCurrency(producto.subtotal || 0)}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function FacturasPage() {
  const { data: dayFacturas, loading: dayLoading, error: dayError, stats, refetch, updateEstado } = useFacturasDia();
  const { data: rangeFacturas, loading: rangeLoading, error: rangeError, from, to, setFrom, setTo, fetchData } = useFacturasRango();
  const [rangeErrorLocal, setRangeErrorLocal] = useState('');

  const dayResumen = useMemo(
    () => ({
      total: stats.totalDia,
      pagado: stats.totalPagado,
      pendiente: stats.totalPendiente,
      count: stats.count,
    }),
    [stats],
  );

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
    <div className="desk-grid">
      <section className="desk-card">
        <div className="desk-header desk-header-gap">
          <h2 className="desk-title-no-margin">Facturas del Día</h2>
          <button type="button" className="btn-secondary desk-btn-auto" onClick={refetch}>Refrescar</button>
        </div>

        <div className="desk-grid-summary">
          <div>Total: ${formatCurrency(dayResumen.total)}</div>
          <div>Pagado: ${formatCurrency(dayResumen.pagado)}</div>
          <div>Pendiente: ${formatCurrency(dayResumen.pendiente)}</div>
          <div>Facturas: {dayResumen.count}</div>
        </div>

        {dayError && <div className="desk-danger-text desk-mb-8">{dayError}</div>}
        {dayLoading ? (
          <div>Cargando facturas del día...</div>
        ) : dayFacturas.length === 0 ? (
          <div className="desk-subtle-text">No hay facturas registradas hoy.</div>
        ) : (
          <div className="desk-stack">
            {dayFacturas.map((factura, index) => {
              const productos = (factura.ordenes || []).flatMap((orden) => orden.productos || []);
              return (
                <div key={factura.facturaId || index} className="desk-item">
                  <div className="desk-row-between">
                    <strong>Factura #{factura.facturaId || 'N/A'} · {factura.clienteNombre || 'Sin cliente'}</strong>
                    <button
                      type="button"
                      className="btn-secondary desk-btn-auto"
                      onClick={() => factura.facturaId && updateEstado(factura.facturaId, factura.estado === 'pagado' ? 'pendiente' : 'pagado')}
                      disabled={!factura.facturaId}
                    >
                      {factura.estado === 'pagado' ? 'Marcar pendiente' : 'Marcar pagado'}
                    </button>
                  </div>
                  <div className="desk-meta">
                    {formatDate(factura.fechaFactura)} · {factura.metodo || 'Sin método'} · Estado: {factura.estado || 'pendiente'}
                  </div>
                  <FacturaProducts facturaIndex={index} productos={productos} />
                  <div className="desk-total">
                    Total: ${formatCurrency(factura.total || 0)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="desk-card">
        <h2 className="desk-title-no-margin">Consulta por Rango</h2>
        <div className="desk-grid-3">
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Fecha desde" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Fecha hasta" />
          <button type="button" className="btn-primary desk-btn-auto" onClick={handleSearchRange}>Buscar</button>
        </div>
        {(rangeErrorLocal || rangeError) && <div className="desk-danger-text desk-mb-8">{rangeErrorLocal || rangeError}</div>}

        {rangeLoading ? (
          <div>Cargando facturas del rango...</div>
        ) : rangeFacturas.length === 0 ? (
          <div className="desk-subtle-text">Sin resultados en el rango seleccionado.</div>
        ) : (
          <div className="desk-results">Resultados: {rangeFacturas.length} facturas</div>
        )}
      </section>
    </div>
  );
}