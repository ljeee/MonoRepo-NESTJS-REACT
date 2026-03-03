import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useFacturasRango } from '../hooks/use-facturas';
import { useFacturasPagosRango, useDeleteFacturaPago } from '../hooks/use-create-factura-pago';
import { buildCombinedBalanceCsv, downloadCsv } from '../utils/csvExport';
import { validateFlexibleDateRange } from '../utils/dateRange';
import { formatCurrency, formatDate } from '../utils/formatNumber';
import { useToast } from '../contexts/ToastContext';
import * as Dialog from '@radix-ui/react-dialog';
import {
    Scale,
    Download,
    Calendar,
    Search,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Receipt,
    CreditCard,
    Trash2,
    CheckCircle2,
    Clock,
    XCircle,
    QrCode,
    DollarSign
} from 'lucide-react';
import { FacturaItem, FacturaPago } from '../types/models';

export function BalanceFechasPage() {
    const { showToast } = useToast();

    // Fechas (Single Source of Truth)
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [filterError, setFilterError] = useState('');
    const [searchTrigger, setSearchTrigger] = useState(0);

    // Modals & Interactivity
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    // Hooks
    const {
        data: facturas,
        loading: loadingFacturas,
        error: errorFacturas,
        setFrom: setFromF,
        setTo: setToF,
        fetchData: fetchFacturas,
        stats,
        updateEstado,
    } = useFacturasRango();

    const {
        data: gastos,
        loading: loadingGastos,
        error: errorGastos,
        setFrom: setFromG,
        setTo: setToG,
        fetchData: fetchGastos,
    } = useFacturasPagosRango();

    const { deletePago, loading: deletingGasto } = useDeleteFacturaPago();

    // Execution
    useEffect(() => {
        if (searchTrigger === 0) {
            // Initialize with today's date if empty
            const today = new Date().toISOString().split('T')[0];
            setFrom(today);
            setTo(today);
            setFromF(today);
            setToF(today);
            setFromG(today);
            setToG(today);
            setSearchTrigger(1);
            return;
        }
        fetchFacturas(undefined, true);
        fetchGastos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTrigger]);

    const handleSearch = useCallback(() => {
        const { from: fromParsed, to: toParsed, error } = validateFlexibleDateRange(from, to);
        if (error) {
            setFilterError(error);
            return;
        }
        setFilterError('');
        setFrom(fromParsed);
        setTo(toParsed);
        setFromF(fromParsed);
        setToF(toParsed);
        setFromG(fromParsed);
        setToG(toParsed);
        setSearchTrigger((n) => n + 1);
    }, [from, to, setFromF, setToF, setFromG, setToG]);

    const handleExportCsv = useCallback(() => {
        const safeFrom = from || 'inicio';
        const safeTo = to || 'fin';
        downloadCsv(buildCombinedBalanceCsv(facturas, gastos), `balance_${safeFrom}_${safeTo}.csv`);
    }, [facturas, gastos, from, to]);

    const handleToggleEstado = async (facturaId: number, currentEstado?: string) => {
        const nuevoEstado = currentEstado === 'pagado' ? 'pendiente' : 'pagado';
        setUpdatingId(facturaId);
        try {
            await updateEstado(facturaId, nuevoEstado);
            showToast(`Factura marcada como ${nuevoEstado}`, 'success');
            fetchFacturas(); // Refresh after update
        } catch {
            showToast('Error al actualizar estado', 'error');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDeleteGasto = async () => {
        if (!deleteTarget) return;
        const ok = await deletePago(deleteTarget.id);
        if (ok) {
            showToast('Gasto eliminado exitosamente', 'success');
            fetchGastos();
        } else {
            showToast('Error al eliminar Gasto', 'error');
        }
        setDeleteTarget(null);
    };

    // Derived State
    const loading = loadingFacturas || loadingGastos;
    const hasData = facturas.length > 0 || gastos.length > 0;
    const ingresos = stats?.totalPagado ?? 0;
    const totalGastos = gastos.reduce((sum, g) => sum + (Number(g.total) || 0), 0);
    const neto = ingresos - totalGastos;

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <Scale className="page-icon" />
                        Balance por Fechas
                    </h1>
                    <p className="page-description">Consulta ingresos y egresos de tu negocio.</p>
                </div>
                <div className="header-actions">
                    <button
                        type="button"
                        className="btn-outline"
                        onClick={handleExportCsv}
                        disabled={!hasData}
                    >
                        <Download size={18} />
                        <span>Exportar CSV</span>
                    </button>
                </div>
            </header>

            {/* ── Filtros de Fecha ── */}
            <div className="pos-card filters-section mb-6">
                <div className="date-filters flex gap-4 flex-wrap items-end">
                    <div className="form-group flex-1 min-w-[150px]">
                        <label className="text-sm font-medium mb-1 block">Desde</label>
                        <div className="input-with-icon">
                            <Calendar size={16} />
                            <input
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                className="w-full form-input"
                            />
                        </div>
                    </div>
                    <div className="form-group flex-1 min-w-[150px]">
                        <label className="text-sm font-medium mb-1 block">Hasta</label>
                        <div className="input-with-icon">
                            <Calendar size={16} />
                            <input
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className="w-full form-input"
                            />
                        </div>
                    </div>
                    <div className="flex-initial">
                        <button type="button" className="btn-primary" onClick={handleSearch} disabled={loading || !from || !to}>
                            {loading ? <RefreshCw size={18} className="spinning" /> : <Search size={18} />}
                            <span>Buscar</span>
                        </button>
                    </div>
                </div>
                {filterError && (
                    <div className="error-text mt-2 text-sm text-danger flex items-center">
                        <AlertCircle size={14} className="mr-1" /> {filterError}
                    </div>
                )}
            </div>

            {loading && !hasData && (
                <div className="loading-state mb-6">
                    <RefreshCw size={32} className="spinning text-muted mb-2" />
                    <p>Calculando balance...</p>
                </div>
            )}

            {/* ── Tarjeta de Resumen de Balance ── */}
            {hasData && (
                <div className="balance-summary-card pos-card mb-8 p-6 bg-gradient-to-br from-surface to-background border-l-4 border-l-primary">
                    <h2 className="text-lg font-bold mb-4 flex items-center">
                        <Scale size={20} className="mr-2 text-primary" />
                        Resumen del Período
                    </h2>

                    <div className="flex flex-col md:flex-row gap-6 md:gap-12">
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                                <span className="flex items-center text-success font-medium">
                                    <TrendingUp size={18} className="mr-1" /> Ingresos
                                </span>
                                <span className="text-xl font-bold text-success">${formatCurrency(ingresos)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="flex items-center text-danger font-medium">
                                    <TrendingDown size={18} className="mr-1" /> Egresos
                                </span>
                                <span className="text-xl font-bold text-danger">-${formatCurrency(totalGastos)}</span>
                            </div>
                        </div>

                        <div className="md:w-px md:bg-border my-2 md:my-0 h-px w-full bg-border"></div>

                        <div className="flex-1 flex flex-col justify-center">
                            <span className="text-sm text-muted font-medium mb-1">Balance Neto</span>
                            <span className={`text-4xl font-extrabold ${neto >= 0 ? 'text-primary' : 'text-danger'}`}>
                                {neto < 0 ? '-' : ''}${formatCurrency(Math.abs(neto))}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {!loading && !hasData && (
                <div className="empty-state pos-card mb-6">
                    <Scale size={48} className="text-muted mb-3" />
                    <h3>Sin registros</h3>
                    <p className="text-muted">No encontramos facturas ni gastos para estas fechas.</p>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                {/* ── Columna Facturas ── */}
                <div className="facturas-column">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                        <h3 className="text-lg font-bold flex items-center">
                            <Receipt size={20} className="mr-2 text-primary" />
                            Facturas Pagadas
                        </h3>
                        <span className="badge badge-info">{facturas.length}</span>
                    </div>

                    {errorFacturas && (
                        <div className="error-alert mb-4">
                            <AlertCircle size={16} /> <span>{errorFacturas}</span>
                        </div>
                    )}

                    <div className="facturas-list flex flex-col gap-4">
                        {facturas.map(factura => (
                            <div key={factura.facturaId} className={`pos-card p-4 border-l-4 ${factura.estado === 'pagado' ? 'border-l-success' : factura.estado === 'cancelado' ? 'border-l-danger' : 'border-l-warning'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <strong>{factura.clienteNombre || 'Cliente sin nombre'}</strong>
                                        <p className="text-xs text-muted mt-1">{formatDate(factura.fechaFactura)}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-text">${formatCurrency(factura.total ?? 0)}</div>
                                        <span className="text-xs uppercase font-medium text-muted">{factura.metodo}</span>
                                    </div>
                                </div>

                                {factura.descripcion && (
                                    <div className="bg-background rounded p-2 text-xs text-text-secondary mt-2 mb-3">
                                        <span className="font-medium">Notas: </span>{factura.descripcion}
                                    </div>
                                )}

                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-border">
                                    <span className={`text-xs font-bold uppercase flex items-center ${factura.estado === 'pagado' ? 'text-success' : factura.estado === 'cancelado' ? 'text-danger' : 'text-warning'}`}>
                                        {factura.estado === 'pagado' && <CheckCircle2 size={14} className="mr-1" />}
                                        {factura.estado === 'pendiente' && <Clock size={14} className="mr-1" />}
                                        {factura.estado === 'cancelado' && <XCircle size={14} className="mr-1" />}
                                        {factura.estado}
                                    </span>

                                    {factura.estado !== 'cancelado' && (
                                        <button
                                            className={`btn-sm ${factura.estado === 'pagado' ? 'btn-outline border-warning text-warning' : 'btn-primary'}`}
                                            disabled={updatingId === factura.facturaId}
                                            onClick={() => factura.facturaId && handleToggleEstado(factura.facturaId, factura.estado)}
                                        >
                                            {updatingId === factura.facturaId ? 'Actualizando...' : factura.estado === 'pagado' ? 'Marcar Pendiente' : 'Marcar Pagado'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {facturas.length === 0 && !loadingFacturas && (
                            <p className="text-muted text-sm italic">No hay facturas en este rango.</p>
                        )}
                    </div>
                </div>

                {/* ── Columna Gastos ── */}
                <div className="gastos-column">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                        <h3 className="text-lg font-bold flex items-center">
                            <CreditCard size={20} className="mr-2 text-danger" />
                            Egresos del Día
                        </h3>
                        <span className="badge badge-danger">{gastos.length}</span>
                    </div>

                    {errorGastos && (
                        <div className="error-alert mb-4">
                            <AlertCircle size={16} /> <span>{errorGastos}</span>
                        </div>
                    )}

                    <div className="gastos-list flex flex-col gap-4">
                        {gastos.map(gasto => (
                            <div key={gasto.pagosId} className="pos-card p-4 flex items-center justify-between border-l-4 border-l-danger">
                                <div className="flex items-center gap-3">
                                    <div className="bg-danger/10 p-2 rounded-full text-danger">
                                        {gasto.metodo === 'efectivo' ? <DollarSign size={20} /> : <QrCode size={20} />}
                                    </div>
                                    <div>
                                        <strong className="block text-text">{gasto.nombreGasto || 'Gasto registrado'}</strong>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-muted">{formatDate(gasto.fechaFactura)}</span>
                                            <span className="text-[0.65rem] uppercase bg-surface border border-border px-1.5 rounded text-text-secondary">{gasto.metodo}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className="text-lg font-bold text-danger">
                                        -${formatCurrency(gasto.total ?? 0)}
                                    </span>
                                    <button
                                        className="btn-icon text-muted hover:text-danger hover:bg-danger/10"
                                        onClick={() => setDeleteTarget({ id: gasto.pagosId!, name: gasto.nombreGasto || 'este gasto' })}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {gastos.length === 0 && !loadingGastos && (
                            <p className="text-muted text-sm italic">No hay gastos registrados en este rango.</p>
                        )}
                    </div>
                </div>

            </div>

            {/* ── Dialogo Eliminar Gasto ── */}
            <Dialog.Root open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="dialog-overlay" />
                    <Dialog.Content className="dialog-content">
                        <Dialog.Title className="dialog-title">Eliminar Gasto</Dialog.Title>
                        <Dialog.Description className="dialog-description mt-2">
                            ¿Estás seguro de eliminar el gasto <strong>"{deleteTarget?.name}"</strong>?
                            <br /><br />Esta acción modificará el balance y no se puede deshacer.
                        </Dialog.Description>
                        <div className="dialog-actions mt-4">
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => setDeleteTarget(null)}
                                disabled={deletingGasto}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn-danger"
                                onClick={handleDeleteGasto}
                                disabled={deletingGasto}
                            >
                                {deletingGasto ? 'Eliminando...' : 'Eliminar Gasto'}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

        </div>
    );
}
