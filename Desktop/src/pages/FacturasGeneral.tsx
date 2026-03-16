import { useState } from 'react';
import { useFacturasRango } from '@monorepo/shared';
import { formatCurrency, formatDate } from '@monorepo/shared';
import {
  Receipt,
  Calendar,
  Search,
  AlertCircle,
  Download,
  FileText,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { exportFacturasCsv, exportFacturasPdf } from '../../utils/exportData';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';

function getEstadoInfo(estado?: string) {
  switch (estado) {
    case 'pagado':
      return { icon: CheckCircle2, color: 'text-success', border: 'border-l-success', label: 'PAGADO' };
    case 'cancelado':
      return { icon: XCircle, color: 'text-danger', border: 'border-l-danger', label: 'CANCELADO' };
    default:
      return { icon: Clock, color: 'text-warning', border: 'border-l-warning', label: 'PENDIENTE' };
  }
}

export function FacturasGeneralPage() {
  const { data, loading, error, from, to, setFrom, setTo, fetchData } = useFacturasRango();
  const [rangeErrorLocal, setRangeErrorLocal] = useState('');

  const handleSearch = () => {
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

  const handleExportContabilidad = async () => {
    const csv = await buildCombinedBalanceCsv(data, []);
    const file = `${from || 'inicio'}_${to || 'fin'}`;
    downloadCsv(csv, `contabilidad_${file}.csv`);
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <Receipt className="page-icon" />
            Facturacion General
          </h1>
          <p className="page-description">Consulta y exportacion por rango de fechas.</p>
        </div>
      </header>

      <section className="pos-card">
        <h2 className="section-title mb-3">
          <Calendar size={20} />
          Rango de Facturacion
        </h2>

        <div className="date-filters flex gap-4 flex-wrap items-end mb-3">
          <div className="form-group flex-1">
            <label htmlFor="facturas-general-desde" className="text-xs text-muted mb-1 block">Desde</label>
            <div className="input-with-icon">
              <Calendar size={14} />
              <input id="facturas-general-desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
          </div>
          <div className="form-group flex-1">
            <label htmlFor="facturas-general-hasta" className="text-xs text-muted mb-1 block">Hasta</label>
            <div className="input-with-icon">
              <Calendar size={14} />
              <input id="facturas-general-hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex-initial">
            <button type="button" className="btn-primary" onClick={handleSearch}>
              <Search size={16} /> Buscar
            </button>
          </div>
        </div>

        {(rangeErrorLocal || error) && (
          <div className="error-alert mb-3">
            <AlertCircle size={16} /> <span>{rangeErrorLocal || error}</span>
          </div>
        )}

        {loading ? (
          <div className="text-muted">Cargando...</div>
        ) : data.length === 0 ? (
          <div className="text-muted text-sm">Sin resultados en el rango seleccionado.</div>
        ) : (
          <>
            <div className="text-sm text-muted mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{data.length} facturas encontradas</span>
              <div className="header-actions">
                <button type="button" className="btn-outline" onClick={() => exportFacturasPdf(data, `${from} a ${to}`)} title="Exportar PDF">
                  <FileText size={14} /> <span>PDF</span>
                </button>
                <button type="button" className="btn-outline" onClick={() => exportFacturasCsv(data, `${from}_${to}`)} title="Exportar CSV Backup">
                  <Download size={14} /> <span>CSV Backup</span>
                </button>
                <button type="button" className="btn-outline" onClick={handleExportContabilidad} title="Exportar Contabilidad">
                  <TrendingUp size={14} /> <span>Contabilidad</span>
                </button>
              </div>
            </div>

            <div className="facturas-cards-grid">
              {data.map((factura, index) => {
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
                        <span className="factura-metodo">{factura.metodo || '-'} </span>
                      </div>
                    </div>

                    {productos.length > 0 && (
                      <div className="factura-products">
                        {productos.map((p) => (
                          <span key={`${p.productoNombre || ''}-${p.cantidad || 1}`} className="factura-product-item">
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
