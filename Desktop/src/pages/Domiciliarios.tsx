import React, { useState } from 'react';
import { api } from '../services/api';
import { useDomiciliariosList } from '../hooks/use-domiciliarios-list';
import { useToast } from '../contexts/ToastContext';
import {
    Bike,
    PlusCircle,
    Search,
    RefreshCw,
    UserPlus,
    Edit,
    Trash2,
    Phone,
    AlertCircle
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

type FormMode = 'closed' | 'create' | 'edit';

export function DomiciliariosPage() {
    const { data, loading, error, refetch } = useDomiciliariosList();
    const { showToast } = useToast();

    const [telefonoBusqueda, setTelefonoBusqueda] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ── Form state ──
    const [formMode, setFormMode] = useState<FormMode>('closed');
    const [formData, setFormData] = useState({ telefono: '', domiciliarioNombre: '' });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [editingPhone, setEditingPhone] = useState('');

    // ── Delete modal state ──
    const [deleteTarget, setDeleteTarget] = useState<{ telefono: string; domiciliarioNombre?: string } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const resetForm = () => {
        setFormMode('closed');
        setFormData({ telefono: '', domiciliarioNombre: '' });
        setFormError('');
        setEditingPhone('');
    };

    const openCreate = () => {
        setFormMode('create');
        setFormData({ telefono: '', domiciliarioNombre: '' });
        setFormError('');
    };

    const openEdit = (d: { telefono: string; domiciliarioNombre?: string }) => {
        setFormMode('edit');
        setEditingPhone(d.telefono);
        setFormData({
            telefono: d.telefono,
            domiciliarioNombre: d.domiciliarioNombre || '',
        });
        setFormError('');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.telefono) {
            setFormError('El teléfono es obligatorio');
            return;
        }
        setFormLoading(true);
        setFormError('');
        try {
            if (formMode === 'create') {
                await api.domiciliarios.create(formData);
                showToast('Domiciliario creado exitosamente', 'success');
            } else {
                await api.domiciliarios.update(editingPhone, formData);
                showToast('Domiciliario actualizado', 'success');
            }
            resetForm();
            refetch();
        } catch (err: any) {
            setFormError(err.response?.data?.message || 'Error al guardar domiciliario');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            await api.domiciliarios.delete(deleteTarget.telefono);
            showToast('Domiciliario eliminado', 'success');
            refetch();
            setDeleteTarget(null);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Error al eliminar domiciliario', 'error');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    const filteredData = data.filter(d => d.telefono.includes(telefonoBusqueda));

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <Bike className="page-icon" />
                        Domiciliarios
                    </h1>
                    <p className="page-description">Gestiona el equipo de despachos y sus datos de contacto.</p>
                </div>
                <div className="header-actions">
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={openCreate}
                    >
                        <PlusCircle size={18} />
                        <span>Nuevo Domiciliario</span>
                    </button>
                </div>
            </header>

            {/* ── Formulario Crear/Editar ── */}
            {formMode !== 'closed' && (
                <div className="pos-card form-section mb-4">
                    <h2 className="section-title">
                        {formMode === 'create' ? <UserPlus size={20} /> : <Edit size={20} />}
                        {formMode === 'create' ? 'Nuevo Domiciliario' : 'Editar Domiciliario'}
                    </h2>

                    <form onSubmit={handleSave} className="cliente-form">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Teléfono *</label>
                                <div className="input-with-icon">
                                    <Phone size={16} />
                                    <input
                                        type="tel"
                                        value={formData.telefono}
                                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                        required
                                        disabled={formMode === 'edit'}
                                        placeholder="Ej. 3001234567"
                                        title="Solo números"
                                        pattern="[0-9]*"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Nombre *</label>
                                <div className="input-with-icon">
                                    <Bike size={16} />
                                    <input
                                        type="text"
                                        value={formData.domiciliarioNombre}
                                        onChange={(e) => setFormData({ ...formData, domiciliarioNombre: e.target.value })}
                                        placeholder="Nombre del repartidor"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {formError && (
                            <div className="error-alert mt-2">
                                <AlertCircle size={16} />
                                <span>{formError}</span>
                            </div>
                        )}

                        <div className="form-actions mt-4">
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={resetForm}
                                disabled={formLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={formLoading}
                            >
                                {formLoading ? 'Guardando...' : 'Guardar Domiciliario'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Búsqueda ── */}
            <div className="pos-card search-section mb-4">
                <div className="search-form">
                    <div className="input-with-icon search-input">
                        <Search size={18} />
                        <input
                            type="tel"
                            placeholder="Buscar por teléfono en la lista..."
                            value={telefonoBusqueda}
                            onChange={(e) => setTelefonoBusqueda(e.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleRefresh}
                        disabled={isRefreshing || loading}
                        title="Recargar lista"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'spinning' : ''} />
                    </button>
                </div>
            </div>

            {/* ── Lista de Domiciliarios ── */}
            {error && (
                <div className="error-alert mb-4">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {loading && !data.length && (
                <div className="loading-state">
                    <RefreshCw size={32} className="spinning text-muted mb-2" />
                    <p>Cargando escuadra de domiciliarios...</p>
                </div>
            )}

            {!loading && data.length === 0 && (
                <div className="empty-state pos-card">
                    <Bike size={48} className="text-muted mb-3" />
                    <h3>Sin domiciliarios registrados</h3>
                    <p className="text-muted">Añade tu primer domiciliario usando el botón superior.</p>
                </div>
            )}

            {!loading && data.length > 0 && (
                <div className="clientes-grid">
                    {filteredData.length === 0 ? (
                        <p className="text-muted ml-2">No se encontraron domiciliarios para la búsqueda actual.</p>
                    ) : (
                        filteredData.map((item) => (
                            <div key={item.telefono} className="cliente-card pos-card p-3">
                                <div className="cliente-card-header">
                                    <div>
                                        <h3 className="cliente-name">{item.domiciliarioNombre || 'Sin nombre'}</h3>
                                        <div className="cliente-phone">
                                            <Phone size={14} />
                                            <span>{item.telefono}</span>
                                        </div>
                                    </div>
                                    <div className="cliente-actions">
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={() => openEdit(item)}
                                            title="Editar"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-icon text-danger"
                                            onClick={() => setDeleteTarget(item)}
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Dialogo Eliminar ── */}
            <Dialog.Root open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="dialog-overlay" />
                    <Dialog.Content className="dialog-content">
                        <Dialog.Title className="dialog-title">Eliminar Domiciliario</Dialog.Title>
                        <Dialog.Description className="dialog-description">
                            ¿Estás seguro de eliminar a <strong>{deleteTarget?.domiciliarioNombre || deleteTarget?.telefono}</strong>?
                            <br />Esta acción no se puede deshacer.
                        </Dialog.Description>
                        <div className="dialog-actions mt-4">
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleteLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn-danger"
                                onClick={handleDelete}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

        </div>
    );
}
