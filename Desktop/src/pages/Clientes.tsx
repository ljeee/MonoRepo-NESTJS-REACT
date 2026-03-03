import React, { useState } from 'react';
import { api } from '../services/api';
import { Cliente, CreateClienteDto } from '../types/models';
import { useClientByPhone } from '../hooks/use-client-by-phone';
import { useClientesList } from '../hooks/use-clientes-list';
import { useToast } from '../contexts/ToastContext';
import {
    Users,
    PlusCircle,
    Search,
    RefreshCw,
    UserPlus,
    Edit,
    Trash2,
    Phone,
    MapPin,
    AlertCircle
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

type FormMode = 'closed' | 'create' | 'edit';

export function ClientesPage() {
    const { data, loading, error, refetch } = useClientesList();
    const { client, loading: searching, error: searchError, fetchClient } = useClientByPhone();
    const { showToast } = useToast();

    const [telefonoBusqueda, setTelefonoBusqueda] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ── Form state ──
    const [formMode, setFormMode] = useState<FormMode>('closed');
    const [formData, setFormData] = useState<CreateClienteDto>({
        telefono: '',
        clienteNombre: '',
        direccion: '',
        direccionDos: '',
        direccionTres: '',
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [editingPhone, setEditingPhone] = useState('');

    // ── Delete modal state ──
    const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const resetForm = () => {
        setFormMode('closed');
        setFormData({ telefono: '', clienteNombre: '', direccion: '', direccionDos: '', direccionTres: '' });
        setFormError('');
        setEditingPhone('');
    };

    const openCreate = () => {
        setFormMode('create');
        setFormData({ telefono: '', clienteNombre: '', direccion: '', direccionDos: '', direccionTres: '' });
        setFormError('');
    };

    const openEdit = (c: Cliente) => {
        setFormMode('edit');
        setEditingPhone(c.telefono);
        setFormData({
            telefono: c.telefono,
            clienteNombre: c.clienteNombre || '',
            direccion: c.direccion || '',
            direccionDos: c.direccionDos || '',
            direccionTres: c.direccionTres || '',
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
                await api.clientes.create(formData);
                showToast('Cliente creado exitosamente', 'success');
            } else {
                await api.clientes.update(editingPhone, formData);
                showToast('Cliente actualizado', 'success');
            }
            resetForm();
            refetch();
        } catch (err: any) {
            setFormError(err.response?.data?.message || 'Error al guardar cliente');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            await api.clientes.delete(deleteTarget.telefono);
            showToast('Cliente eliminado', 'success');
            refetch();
            setDeleteTarget(null);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Error al eliminar cliente', 'error');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (telefonoBusqueda) {
            fetchClient(telefonoBusqueda);
        }
    };

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <Users className="page-icon" />
                        Clientes
                    </h1>
                    <p className="page-description">Gestiona el directorio de clientes para domicilios.</p>
                </div>
                <div className="header-actions">
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={openCreate}
                    >
                        <PlusCircle size={18} />
                        <span>Nuevo Cliente</span>
                    </button>
                </div>
            </header>

            {/* ── Formulario Crear/Editar ── */}
            {formMode !== 'closed' && (
                <div className="pos-card form-section mb-4">
                    <h2 className="section-title">
                        {formMode === 'create' ? <UserPlus size={20} /> : <Edit size={20} />}
                        {formMode === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
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
                                <label>Nombre</label>
                                <div className="input-with-icon">
                                    <Users size={16} />
                                    <input
                                        type="text"
                                        value={formData.clienteNombre}
                                        onChange={(e) => setFormData({ ...formData, clienteNombre: e.target.value })}
                                        placeholder="Nombre completo"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Dirección Principal</label>
                            <div className="input-with-icon">
                                <MapPin size={16} />
                                <input
                                    type="text"
                                    value={formData.direccion}
                                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                                    placeholder="Calle principal #123"
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label>Dirección Alternativa 1</label>
                                <div className="input-with-icon">
                                    <MapPin size={16} className="text-muted" />
                                    <input
                                        type="text"
                                        value={formData.direccionDos}
                                        onChange={(e) => setFormData({ ...formData, direccionDos: e.target.value })}
                                        placeholder="Opcional"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Dirección Alternativa 2</label>
                                <div className="input-with-icon">
                                    <MapPin size={16} className="text-muted" />
                                    <input
                                        type="text"
                                        value={formData.direccionTres}
                                        onChange={(e) => setFormData({ ...formData, direccionTres: e.target.value })}
                                        placeholder="Opcional"
                                    />
                                </div>
                            </div>
                        </div>

                        {formError && (
                            <div className="error-alert">
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
                                {formLoading ? 'Guardando...' : 'Guardar Cliente'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Búsqueda ── */}
            <div className="pos-card search-section mb-4">
                <form onSubmit={handleSearch} className="search-form">
                    <div className="input-with-icon search-input">
                        <Search size={18} />
                        <input
                            type="tel"
                            placeholder="Buscar por teléfono..."
                            value={telefonoBusqueda}
                            onChange={(e) => setTelefonoBusqueda(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={!telefonoBusqueda || searching}
                    >
                        {searching ? 'Buscando...' : 'Buscar'}
                    </button>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleRefresh}
                        disabled={isRefreshing || loading}
                        title="Recargar lista"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'spinning' : ''} />
                    </button>
                </form>

                {searchError && (
                    <div className="error-alert mt-3">
                        <AlertCircle size={16} />
                        <span>{searchError}</span>
                    </div>
                )}

                {client && (
                    <div className="search-result-card mt-3">
                        <div className="search-result-header">
                            <h3 className="result-title">Resultado de búsqueda</h3>
                            <div className="result-actions">
                                <button type="button" className="btn-icon" onClick={() => openEdit(client)} title="Editar">
                                    <Edit size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="result-details">
                            <div className="detail-row">
                                <strong>Nombre:</strong> {client.clienteNombre || '—'}
                            </div>
                            <div className="detail-row">
                                <strong>Teléfono:</strong> {client.telefono}
                            </div>
                            <div className="detail-row">
                                <strong>Dirección:</strong> {client.direccion || '—'}
                            </div>
                            {client.direccionDos && (
                                <div className="detail-row">
                                    <strong>Dir 2:</strong> {client.direccionDos}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Lista de Clientes ── */}
            {error && (
                <div className="error-alert mb-4">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {loading && !data.length && (
                <div className="loading-state">
                    <RefreshCw size={32} className="spinning text-muted mb-2" />
                    <p>Cargando directorio...</p>
                </div>
            )}

            {!loading && data.length === 0 && (
                <div className="empty-state pos-card">
                    <Users size={48} className="text-muted mb-3" />
                    <h3>Sin clientes registrados</h3>
                    <p className="text-muted">Añade tu primer cliente usando el botón de arriba.</p>
                </div>
            )}

            {!loading && data.length > 0 && (
                <div className="clientes-grid">
                    {data.map((item) => (
                        <div key={item.telefono} className="cliente-card pos-card p-3">
                            <div className="cliente-card-header">
                                <div>
                                    <h3 className="cliente-name">{item.clienteNombre || 'Sin nombre'}</h3>
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

                            <div className="cliente-addresses mt-3">
                                {item.direccion && (
                                    <div className="address-row">
                                        <MapPin size={14} className="text-muted" />
                                        <span>{item.direccion}</span>
                                    </div>
                                )}
                                {item.direccionDos && (
                                    <div className="address-row">
                                        <MapPin size={14} className="text-muted" />
                                        <span>{item.direccionDos}</span>
                                    </div>
                                )}
                                {item.direccionTres && (
                                    <div className="address-row">
                                        <MapPin size={14} className="text-muted" />
                                        <span>{item.direccionTres}</span>
                                    </div>
                                )}
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
                        <Dialog.Title className="dialog-title">Eliminar Cliente</Dialog.Title>
                        <Dialog.Description className="dialog-description">
                            ¿Estás seguro de eliminar a <strong>{deleteTarget?.clienteNombre || deleteTarget?.telefono}</strong>?
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
