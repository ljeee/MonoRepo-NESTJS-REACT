import { useEffect, useMemo } from 'react';
import { useFacturasDia } from '../hooks/use-facturas';
import { useFacturasPagosDia } from '../hooks/use-create-factura-pago';
import { formatCurrency } from '../utils/formatNumber';

export function HistorialPage() {
  const { data: facturas, stats, loading: loadingFacturas, error: errorFacturas, refetch } = useFacturasDia();
  const { data: gastos, loading: loadingGastos, error: errorGastos, fetchData: fetchGastos } = useFacturasPagosDia();

  useEffect(() => {
    fetchGastos();
  }, [fetchGastos]);

  const totalGastos = useMemo(
    () => gastos.reduce((sum, gasto) => sum + (Number(gasto.total) || 0), 0),
    [gastos],
  );

  const balanceNeto = stats.totalPagado - totalGastos;

  return (
    <div className="desk-grid">
      <section className="desk-card">
        <div className="desk-header">
          <h2 className="desk-title-no-margin">Historial / Balance del Día</h2>
          <button
            type="button"
            className="btn-secondary desk-btn-auto"
            onClick={() => {
              refetch();
              fetchGastos();
            }}
          >
            Refrescar
          </button>
        </div>

        <div className="desk-grid-4">
          <div>Facturado: ${formatCurrency(stats.totalDia)}</div>
          <div>Pagado: ${formatCurrency(stats.totalPagado)}</div>
          <div>Gastos: ${formatCurrency(totalGastos)}</div>
          <div><strong>Neto: ${formatCurrency(balanceNeto)}</strong></div>
        </div>
      </section>

      {(errorFacturas || errorGastos) && (
        <section className="desk-danger-text">
          {errorFacturas || errorGastos}
        </section>
      )}

      <section className="desk-card">
        <h3 className="desk-title-no-margin">Últimas Facturas</h3>
        {loadingFacturas ? (
          <div>Cargando facturas...</div>
        ) : facturas.length === 0 ? (
          <div className="desk-subtle-text">No hay facturas registradas hoy.</div>
        ) : (
          <div className="desk-list">
            {facturas.slice(0, 10).map((factura, index) => (
              <div key={factura.facturaId || index} className="desk-list-row">
                <span>#{factura.facturaId || 'N/A'} · {factura.clienteNombre || 'Sin cliente'}</span>
                <span>{factura.estado || 'pendiente'} · ${formatCurrency(factura.total || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="desk-card">
        <h3 className="desk-title-no-margin">Gastos del Día</h3>
        {loadingGastos ? (
          <div>Cargando gastos...</div>
        ) : gastos.length === 0 ? (
          <div className="desk-subtle-text">No hay gastos registrados hoy.</div>
        ) : (
          <div className="desk-list">
            {gastos.slice(0, 10).map((gasto, index) => (
              <div key={gasto.pagosId || index} className="desk-list-row">
                <span>{gasto.nombreGasto || 'Sin nombre'} · {gasto.metodo || 'N/A'}</span>
                <span>${formatCurrency(gasto.total || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}