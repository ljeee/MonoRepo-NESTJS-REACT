import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import type { Cliente, CreateClienteDto, ClienteFrecuente } from '@monorepo/shared';
import { useClientByPhone } from '@monorepo/shared';
import { useClientesList } from '@monorepo/shared';
import { useToast } from '@monorepo/shared';
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
    AlertCircle,
    Clock,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

type FormMode = 'closed' | 'create' | 'edit';

function formatCurrency(n: number) {
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
}

function timeAgo(dateStr: string): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `Hace ${days}d`;
    return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? 'es' : ''}`;
}

export function ClientesPage() {
    const { data, loading, error, refetch } = useClientesList();
    const { client, loading: searching, error: searchError, fetchClient } = useClientByPhone();
    const { showToast } = useToast();

    const [telefonoBusqueda, setTelefonoBusqueda] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [frecuentes, setFrecuentes] = useState<ClienteFrecuente[]>([]);

    // ── Form state ──
    const [formMode, setFormMode] = useState<FormMode>('closed');
    const [formData, setFormData] = useState<CreateClienteDto>({
        telefono: '',
        clienteNombre: '',
    });
    const [newAddress, setNewAddress] = useState('');
    const [addingAddress, setAddingAddress] = useState<string | null>(null);
    const [newAddressInput, setNewAddressInput] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [editingPhone, setEditingPhone] = useState('');

    // ── Delete modal state ──
    const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // ── Fetch frequent clients stats ──
    useEffect(() => {
        api.estadisticas.clientesFrecuentes(200)
            .then(setFrecuentes)
            .catch(() => { /* ignore */ });
    }, [data]);

    // Build lookup map: clienteNombre -> stats
    const statsMap = useMemo(() => {
        const map = new Map<string, ClienteFrecuente>();
        for (const f of frecuentes) {
            if (f.clienteNombre) map.set(f.clienteNombre.toLowerCase(), f);
        }
        return map;
    }, [frecuentes]);

    const getStats = (cliente: Cliente): ClienteFrecuente | undefined => {
        const name = (cliente.clienteNombre || '').toLowerCase();
        return name ? statsMap.get(name) : undefined;
    };

    const resetForm = () => {
        setFormMode('closed');
        setFormData({ telefono: '', clienteNombre: '', tipoDocumento: '', documento: '', correo: '' });
        setFormError('');
        setEditingPhone('');
    };

    const openCreate = () => {
        setFormMode('create');
        setFormData({ telefono: '', clienteNombre: '', tipoDocumento: '', documento: '', correo: '' });
        setFormError('');
    };

    const openEdit = (c: Cliente) => {
        setFormMode('edit');
        setEditingPhone(c.telefono);
        setFormData({
            telefono: c.telefono,
            clienteNombre: c.clienteNombre || '',
            tipoDocumento: c.tipoDocumento || '',
            documento: c.documento || '',
            correo: c.correo || '',
        });
        setFormError('');
    };

    const handleAddAddress = async (telefono: string) => {
        const dir = telefono === formData.telefono && formMode === 'create' ? newAddress : newAddressInput;
        if (!dir.trim()) return;
        try {
            await api.clientes.addDireccion(telefono, dir.trim());
            showToast('Dirección agregada', 'success');
            setAddingAddress(null);
            setNewAddressInput('');
            setNewAddress('');
            refetch();
        } catch {
            showToast('Error al agregar dirección', 'error');
        }
    };

    const handleRemoveAddress = async (id: number) => {
        try {
            await api.clientes.removeDireccion(id);
            showToast('Dirección eliminada', 'success');
            refetch();
        } catch {
            showToast('Error al eliminar dirección', 'error');
        }
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
                    <p className="page-description">
                        Gestiona el directorio de clientes para domicilios.
                        {data.length > 0 && <span className="text-muted"> — {data.length} registrados</span>}
                    </p>
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
                            <div className="form-group">
                                <label>Tipo Documento</label>
                                <select
                                    value={formData.tipoDocumento || ''}
                                    onChange={(e) => setFormData({ ...formData, tipoDocumento: e.target.value })}
                                    className="form-select"
                                >
                                    <option value="">— Sin documento —</option>
                                    <option value="CC">CC — Cédula</option>
                                    <option value="NIT">NIT — Empresa</option>
                                    <option value="CE">CE — Cédula Extranjería</option>
                                    <option value="TI">TI — Tarjeta de Identidad</option>
                                    <option value="PP">PP — Pasaporte</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Nº Documento</label>
                                <input
                                    type="text"
                                    value={formData.documento || ''}
                                    onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                                    placeholder="Ej. 1234567890"
                                />
                            </div>
                            <div className="form-group">
                                <label>Correo Electrónico</label>
                                <input
                                    type="email"
                                    value={formData.correo || ''}
                                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                                    placeholder="correo@ejemplo.com"
                                />
                            </div>
                        </div>

                        {formMode === 'create' && (
                            <div className="form-group mt-3">
                                <label>Dirección Principal (Opcional)</label>
                                <div className="input-with-icon">
                                    <MapPin size={16} />
                                    <input
                                        type="text"
                                        value={newAddress}
                                        onChange={(e) => setNewAddress(e.target.value)}
                                        placeholder="Ej. Calle 10 #20-30"
                                    />
                                </div>
                            </div>
                        )}

                        {formMode === 'edit' && (() => {
                            const editClient = data.find(c => c.telefono === editingPhone);
                            const editDirs = editClient?.direcciones || [];
                            return (
                                <div className="mt-4">
                                    <h3 className="text-lg font-semibold mb-2">Direcciones</h3>
                                    <div className="space-y-2">
                                        {editDirs.length > 0 ? (
                                            editDirs.map((dir) => (
                                                <div key={dir.id} className="address-row">
                                                    <MapPin size={14} className="text-muted" />
                                                    <span>{dir.direccion}</span>
                                                    <button
                                                        type="button"
                                                        className="btn-icon text-danger"
                                                        onClick={() => handleRemoveAddress(dir.id)}
                                                        title="Eliminar dirección"
                                                        style={{ marginLeft: 'auto', padding: '2px' }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="address-row text-muted">
                                                <MapPin size={14} />
                                                <span>Sin direcciones registradas</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="address-row mt-3" style={{ gap: '0.5rem' }}>
                                        <input
                                            type="text"
                                            value={newAddressInput}
                                            onChange={(e) => setNewAddressInput(e.target.value)}
                                            placeholder="Añadir nueva dirección"
                                            style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAddress(editingPhone); } }}
                                        />
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            onClick={() => handleAddAddress(editingPhone)}
                                            disabled={!newAddressInput.trim()}
                                            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                                        >
                                            Agregar
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

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
                                <strong>Direcciones:</strong>
                            </div>
                            {client.direcciones && client.direcciones.length > 0 ? (
                                client.direcciones.map((dir) => (
                                    <div key={dir.id} className="detail-row" style={{ paddingLeft: '1rem' }}>
                                        <MapPin size={14} className="text-muted" />
                                        <span>{dir.direccion}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="detail-row" style={{ paddingLeft: '1rem' }}>
                                    <span className="text-muted">Sin direcciones</span>
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
                    {data.map((item) => {
                        const stats = getStats(item);
                        return (
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

                                {/* ── Stats Row ── */}
                                {stats && (
                                    <>
                                        <div className="cliente-stats">
                                            <div className="cliente-stat">
                                                <span className="cliente-stat-value text-primary">{stats.totalOrdenes}</span>
                                                <span className="cliente-stat-label">Órdenes</span>
                                            </div>
                                            <div className="cliente-stat">
                                                <span className="cliente-stat-value text-success">{formatCurrency(stats.gastoTotal)}</span>
                                                <span className="cliente-stat-label">Gasto Total</span>
                                            </div>
                                            <div className="cliente-stat">
                                                <span className="cliente-stat-value text-info">{formatCurrency(Math.round(stats.gastoTotal / stats.totalOrdenes))}</span>
                                                <span className="cliente-stat-label">Ticket Promedio</span>
                                            </div>
                                        </div>
                                        {stats.ultimaVisita && (
                                            <div className="cliente-last-visit">
                                                <Clock size={12} />
                                                Última visita: {timeAgo(stats.ultimaVisita)}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* ── Addresses ── */}
                                <div className="cliente-addresses mt-3">
                                    {item.direcciones && item.direcciones.length > 0 ? (
                                        item.direcciones.map((dir) => (
                                            <div key={dir.id} className="address-row">
                                                <MapPin size={14} className="text-muted" />
                                                <span>{dir.direccion}</span>
                                                <button
                                                    type="button"
                                                    className="btn-icon text-danger"
                                                    onClick={() => handleRemoveAddress(dir.id)}
                                                    title="Eliminar dirección"
                                                    style={{ marginLeft: 'auto', padding: '2px' }}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="address-row text-muted">
                                            <MapPin size={14} />
                                            <span>Sin direcciones</span>
                                        </div>
                                    )}
                                    {addingAddress === item.telefono ? (
                                        <div className="address-row mt-2" style={{ gap: '0.5rem' }}>
                                            <input
                                                type="text"
                                                value={newAddressInput}
                                                onChange={(e) => setNewAddressInput(e.target.value)}
                                                placeholder="Nueva dirección"
                                                style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddAddress(item.telefono)}
                                            />
                                            <button type="button" className="btn-primary" onClick={() => handleAddAddress(item.telefono)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                                                Agregar
                                            </button>
                                            <button type="button" className="btn-ghost" onClick={() => { setAddingAddress(null); setNewAddressInput(''); }} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className="btn-ghost mt-2"
                                            onClick={() => setAddingAddress(item.telefono)}
                                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                                        >
                                            <PlusCircle size={14} />
                                            Agregar dirección
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
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
