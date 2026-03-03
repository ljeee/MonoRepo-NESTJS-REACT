import React from 'react';
import { useFacturasPagosScreen, todayISO } from '../hooks/use-facturas-pagos-screen';
import { formatCurrency, formatDate } from '../utils/formatNumber';
import { useToast } from '../contexts/ToastContext';
import * as Dialog from '@radix-ui/react-dialog';
import {
    CreditCard,
    PlusCircle,
    Search,
    RefreshCw,
    Edit,
    Trash2,
    AlertCircle,
    Calendar,
    Tag,
    DollarSign,
    QrCode,
    ListMinus
} from 'lucide-react';

export function FacturasPagosPage() {
    const { showToast } = useToast();

    const {
        creating,
        createError,
        success,
        loadingDia,
        loadingRango,
        updating,
        deleting,
        showForm,
        setShowForm,
        editingId,
        showRangeFilter,
        setShowRangeFilter,
        formError,
        refreshing,
        deleteTarget,
        setDeleteTarget,
        total,
        setTotal,
        nombreGasto,
        setNombreGasto,
        descripcion,
        setDescripcion,
        estado,
        setEstado,
        fechaFactura,
        setFechaFactura,
        metodo,
        setMetodo,
        from,
        to,
        setFrom,
        setTo,
        fetchDia,
        resetForm,
        handleRefresh,
        onSubmit,
        onEdit,
        onDelete,
        handleSearchRange,
        displayData,
        displayLoading,
        displayError,
    } = useFacturasPagosScreen();

    // Intercept the onSubmit to show a toast message
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit();

        // In a real scenario we'd check for success flag from the hook, 
        // but the hook modifies state. Let's just assume it worked if no formError.
        // The hook sets success=true temporarily.
    };

    React.useEffect(() => {
        if (success) {
            showToast(editingId ? 'Gasto actualizado' : 'Gasto registrado', 'success');
        }
    }, [success, editingId, showToast]);

    const handleDelete = async () => {
        await onDelete();
        showToast('Gasto eliminado', 'success');
    };

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <CreditCard className="page-icon" />
                        Gastos y Egresos
                    </h1>
                    <p className="page-description">Registra los pagos realizados y los gastos diarios.</p>
                </div>
                <div className="header-actions">
                    <button
                        type="button"
                        className={showForm ? 'btn-ghost' : 'btn-primary'}
                        onClick={() => {
                            if (showForm) resetForm();
                            setShowForm(!showForm);
                        }}
                    >
                        {showForm ? 'Cancelar' : <><PlusCircle size={18} /><span>Nuevo Gasto</span></>}
                    </button>
                </div>
            </header>

            {/* ── Formulario de Gasto ── */}
            {showForm && (
                <div className="pos-card form-section mb-6 border-l-4 border-l-primary">
                    <h2 className="section-title text-primary">
                        {editingId ? <Edit size={20} /> : <PlusCircle size={20} />}
                        {editingId ? 'Editar Gasto' : 'Registrar Pago / Gasto'}
                    </h2>

                    <form onSubmit={handleFormSubmit} className="cliente-form mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="form-group">
                                <label>Nombre del gasto *</label>
                                <div className="input-with-icon">
                                    <Tag size={16} />
                                    <input
                                        type="text"
                                        value={nombreGasto}
                                        onChange={(e) => setNombreGasto(e.target.value)}
                                        placeholder="Ej: Insumos, pago empleado, etc."
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Total *</label>
                                <div className="input-with-icon">
                                    <span className="text-muted pointer-events-none">$</span>
                                    <input
                                        type="number"
                                        value={total ? Number(total) : ''}
                                        onChange={(e) => setTotal(e.target.value)}
                                        min="0"
                                        step="100"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="form-group">
                                <label>Fecha</label>
                                <div className="input-with-icon">
                                    <Calendar size={16} />
                                    <input
                                        type="date"
                                        value={fechaFactura}
                                        onChange={(e) => setFechaFactura(e.target.value)}
                                        max={todayISO()}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="block mb-2 text-sm font-medium">Método</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        className={`flex-1 py-1.5 px-3 rounded text-sm border flex items-center justify-center gap-1 transition-colors ${metodo === 'efectivo' ? 'bg-primary-light border-primary text-primary font-medium' : 'bg-surface border-border text-muted hover:bg-border'}`}
                                        onClick={() => setMetodo('efectivo')}
                                    >
                                        <DollarSign size={14} /> Efectivo
                                    </button>
                                    <button
                                        type="button"
                                        className={`flex-1 py-1.5 px-3 rounded text-sm border flex items-center justify-center gap-1 transition-colors ${metodo === 'qr' ? 'bg-primary-light border-primary text-primary font-medium' : 'bg-surface border-border text-muted hover:bg-border'}`}
                                        onClick={() => setMetodo('qr')}
                                    >
                                        <QrCode size={14} /> Transferencia (QR)
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="block mb-2 text-sm font-medium">Estado</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        className={`flex-1 py-1.5 px-3 rounded text-sm border flex items-center justify-center gap-1 transition-colors ${estado === 'pagado' ? 'bg-success/10 border-success text-success font-medium' : 'bg-surface border-border text-muted hover:bg-border'}`}
                                        onClick={() => setEstado('pagado')}
                                    >
                                        Pagado
                                    </button>
                                    <button
                                        type="button"
                                        className={`flex-1 py-1.5 px-3 rounded text-sm border flex items-center justify-center gap-1 transition-colors ${estado === 'pendiente' ? 'bg-warning/10 border-warning text-warning-dark font-medium' : 'bg-surface border-border text-muted hover:bg-border'}`}
                                        onClick={() => setEstado('pendiente')}
                                    >
                                        Pendiente
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="form-group mb-4">
                            <label>Descripción / Notas Adicionales (Opcional)</label>
                            <textarea
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                                className="w-full form-input"
                                rows={2}
                            />
                        </div>

                        {(formError || createError) && (
                            <div className="error-alert mb-4">
                                <AlertCircle size={16} />
                                <span>{formError || createError}</span>
                            </div>
                        )}

                        <div className="form-actions border-t border-border pt-4 mt-2 flex justify-end gap-3">
                            {editingId && (
                                <button
                                    type="button"
                                    className="btn-ghost"
                                    onClick={() => { resetForm(); setShowForm(false); }}
                                    disabled={creating || updating}
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={creating || updating || !total || !nombreGasto}
                            >
                                {creating || updating ? 'Guardando...' : editingId ? 'Actualizar Gasto' : 'Guardar Gasto'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Acciones de filtrado ── */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={fetchDia}
                    disabled={loadingDia}
                >
                    <RefreshCw size={16} className={loadingDia ? 'spinning' : ''} /> Refrescar Hoy
                </button>

                <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setShowRangeFilter(!showRangeFilter)}
                >
                    <Calendar size={16} /> {showRangeFilter ? 'Ocultar Calendario' : 'Filtrar por Fechas'}
                </button>
            </div>

            {showRangeFilter && (
                <div className="pos-card filters-section mb-6 bg-surface-dark/30">
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
                            <button type="button" className="btn-primary" onClick={handleSearchRange} disabled={loadingRango || !from || !to}>
                                {loadingRango ? <RefreshCw size={18} className="spinning" /> : <Search size={18} />}
                                <span>Buscar Rangos</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Lista de Egresos ── */}
            {displayError && (
                <div className="error-alert mb-4">
                    <AlertCircle size={16} />
                    <span>{displayError}</span>
                </div>
            )}

            {displayLoading && !displayData.length && (
                <div className="loading-state mb-6">
                    <RefreshCw size={32} className="spinning text-muted mb-2" />
                    <p>Cargando registros...</p>
                </div>
            )}

            {!displayLoading && displayData.length === 0 && !displayError && (
                <div className="empty-state pos-card mb-6">
                    <ListMinus size={48} className="text-muted mb-3" />
                    <h3>Sin gastos registrados</h3>
                    <p className="text-muted">
                        {showRangeFilter ? 'No se encontraron gastos en este rango de fechas.' : 'No se han registrado gastos el día de hoy.'}
                    </p>
                </div>
            )}

            {displayData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {displayData.map(item => (
                        <div key={item.pagosId} className="pos-card p-4 border-l-4 border-l-danger hover:border-l-primary transition-colors flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-text text-lg">{item.nombreGasto || 'Gasto sin nombre'}</h3>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                                            <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(item.fechaFactura)}</span>
                                            <span className="flex items-center gap-1 uppercase">
                                                {item.metodo === 'efectivo' ? <DollarSign size={12} /> : <QrCode size={12} />}
                                                {item.metodo}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <span className="text-xl font-extrabold text-danger">-${formatCurrency(item.total ?? 0)}</span>
                                        <span className={`text-[0.65rem] font-bold uppercase mt-1 px-1.5 py-0.5 rounded ${item.estado === 'pagado' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-dark'}`}>
                                            {item.estado}
                                        </span>
                                    </div>
                                </div>

                                {item.descripcion && (
                                    <p className="text-sm text-text-secondary mt-2 pl-3 border-l-2 border-border italic">
                                        {item.descripcion}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-dashed border-border">
                                <button
                                    className="btn-ghost btn-sm text-muted hover:text-primary"
                                    onClick={() => onEdit(item)}
                                    title="Editar"
                                >
                                    <Edit size={16} className="mr-1 inline" /> Editar
                                </button>
                                <button
                                    className="btn-ghost btn-sm text-muted hover:text-danger hover:bg-danger/10"
                                    onClick={() => setDeleteTarget({ id: item.pagosId!, name: item.nombreGasto || 'este gasto' })}
                                    title="Eliminar"
                                >
                                    <Trash2 size={16} className="mr-1 inline" /> Eliminar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Dialogo Eliminar ── */}
            <Dialog.Root open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="dialog-overlay" />
                    <Dialog.Content className="dialog-content">
                        <Dialog.Title className="dialog-title text-danger flex items-center">
                            <AlertCircle size={20} className="mr-2 inline" /> Eliminar Gasto
                        </Dialog.Title>
                        <Dialog.Description className="dialog-description mt-2">
                            ¿Estás seguro de eliminar el gasto <strong>{deleteTarget?.name}</strong>?
                            <br /><br />Esta acción no se puede deshacer y afectará el balance.
                        </Dialog.Description>
                        <div className="dialog-actions mt-6 border-t border-border pt-4">
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn-danger"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? 'Eliminando...' : 'Sí, Eliminar Gasto'}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

        </div>
    );
}
