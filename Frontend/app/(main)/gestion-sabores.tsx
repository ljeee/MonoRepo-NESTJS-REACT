import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal } from 'react-native';
import { View, Text, TouchableOpacity, ScrollView } from '../../tw';
import { api as apiService } from '../../services/api';
import { PizzaSabor, Producto, SaborGrupo, GuardarSaborGrupoDto, useToast, formatCOP, formatCurrency } from '@/src/shared';
import { FadeInUp } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { useBreakpoint } from '../../styles/responsive';
import {
    PageContainer,
    PageHeader,
    Card,
    Button,
    Icon,
    ListSkeleton,
    ConfirmModal,
    PosRefreshControl,
    IconButton,
    LoadingState,
    CardGrid,
} from '../../components/ui';
import { SaborModal } from '../../components/products/SaborModal';
import type { SaborModalSaveData } from '../../components/products/SaborModal';
import { GrupoSaborModal } from '../../components/products/GrupoSaborModal';
import {
    PersonalizacionSelector,
    personalizacionDeProducto,
} from '../../components/products/PersonalizacionSelector';
import type { PersonalizacionProducto } from '../../components/products/PersonalizacionSelector';

function formatFlavorName(name: string): string {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
}

/** Texto de la regla de recargo por cantidad de un grupo, o null si no aplica. */
function reglaExtra(grupo: SaborGrupo): string | null {
    if (grupo.recargoExtraDesde == null) return null;
    const montos = grupo.usaTamano
        ? [grupo.recargoExtraPequena, grupo.recargoExtraMediana, grupo.recargoExtraGrande].map(Number)
        : [Number(grupo.recargoExtraGrande)];
    const min = Math.min(...montos);
    const max = Math.max(...montos);
    const monto = min === max ? `$${formatCurrency(max)}` : `$${formatCurrency(min)} a $${formatCurrency(max)}`;
    return `Desde ${grupo.recargoExtraDesde} sabores: +${monto} por unidad`;
}

/** Los sabores con recargo muestran S/M/L; los de grupos sin tamaños, un solo valor. */
function RecargosSabor({ sabor, grupo }: { sabor: PizzaSabor; grupo?: SaborGrupo }) {
    const valores = [Number(sabor.recargoPequena), Number(sabor.recargoMediana), Number(sabor.recargoGrande)];
    if (valores.every((v) => v === 0)) {
        return (
            <View className="bg-black/20 p-4 rounded-2xl border border-white/5 items-center">
                <Text className="text-emerald-400 font-bold text-xs uppercase" style={{ fontFamily: 'Space Grotesk' }}>
                    Sin recargo
                </Text>
            </View>
        );
    }
    if (grupo && !grupo.usaTamano) {
        return (
            <View className="bg-black/20 p-4 rounded-2xl border border-white/5 items-center">
                <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Recargo</Text>
                <Text className="text-white font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>{formatCOP(valores[2])}</Text>
            </View>
        );
    }
    const celdas: [string, number][] = [['Pequeña', valores[0]], ['Mediana', valores[1]], ['Grande', valores[2]]];
    return (
        <View className="flex-row justify-between bg-black/20 p-4 rounded-2xl border border-white/5">
            {celdas.map(([etiqueta, valor], i) => (
                <View key={etiqueta} className={`items-center flex-1 ${i < 2 ? 'border-r border-white/5' : ''}`}>
                    <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">{etiqueta}</Text>
                    <Text className="text-white font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>{formatCOP(valor)}</Text>
                </View>
            ))}
        </View>
    );
}

export default function GestionSaboresScreen() {
    const api = apiService;
    const { showToast } = useToast();
    const [grupos, setGrupos] = useState<SaborGrupo[]>([]);
    const [sabores, setSabores] = useState<PizzaSabor[]>([]);
    const [grupoSel, setGrupoSel] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [editingSabor, setEditingSabor] = useState<Partial<PizzaSabor> | null>(null);
    const [deleteSaborId, setDeleteSaborId] = useState<number | null>(null);
    const [editingGrupo, setEditingGrupo] = useState<Partial<SaborGrupo> | null>(null);
    const [deleteGrupo, setDeleteGrupo] = useState<SaborGrupo | null>(null);

    // Asignación de productos a grupos
    const [showProductosModal, setShowProductosModal] = useState(false);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loadingProductos, setLoadingProductos] = useState(false);
    const [savingProductoId, setSavingProductoId] = useState<number | null>(null);

    const { isMobile } = useBreakpoint();

    const load = useCallback(async () => {
        try {
            const [g, s] = await Promise.all([api.saborGrupos.getAll(), api.pizzaSabores.getAll()]);
            setGrupos(g);
            setSabores(s);
            setGrupoSel((prev) => (prev != null && g.some((x) => x.id === prev) ? prev : (g[0]?.id ?? null)));
        } catch {
            showToast('No se pudieron cargar los sabores', 'error');
        } finally {
            setLoading(false);
        }
    }, [api, showToast]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const grupoActual = useMemo(() => grupos.find((g) => g.id === grupoSel) ?? null, [grupos, grupoSel]);
    const saboresDelGrupo = useMemo(
        () => sabores.filter((s) => s.grupoId === grupoSel).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        [sabores, grupoSel],
    );
    // Sabores que no pertenecen a ningún grupo (no se ofrecen al pedir): se muestran aparte para poder asignarlos.
    const sinGrupo = useMemo(() => sabores.filter((s) => s.grupoId == null && s.tipo !== 'configuracion'), [sabores]);

    const handleSaveSabor = async (saborId: number | undefined, data: SaborModalSaveData) => {
        setSaving(true);
        try {
            if (saborId) await api.pizzaSabores.update(saborId, data);
            else await api.pizzaSabores.create(data);
            setEditingSabor(null);
            setGrupoSel(data.grupoId);
            await load();
            showToast('Sabor guardado correctamente', 'success');
        } finally {
            // El error lo muestra el modal (se propaga para que no se cierre).
            setSaving(false);
        }
    };

    const confirmDeleteSabor = async () => {
        if (!deleteSaborId) return;
        try {
            await api.pizzaSabores.delete(deleteSaborId);
            setDeleteSaborId(null);
            await load();
            showToast('Sabor eliminado', 'success');
        } catch {
            showToast('No se pudo eliminar el sabor', 'error');
        }
    };

    const handleSaveGrupo = async (id: number | undefined, data: GuardarSaborGrupoDto) => {
        setSaving(true);
        try {
            const guardado = id ? await api.saborGrupos.update(id, data) : await api.saborGrupos.create(data);
            setEditingGrupo(null);
            setGrupoSel(guardado.id);
            await load();
            showToast('Grupo guardado correctamente', 'success');
        } finally {
            setSaving(false);
        }
    };

    const confirmDeleteGrupo = async () => {
        if (!deleteGrupo) return;
        try {
            await api.saborGrupos.delete(deleteGrupo.id);
            setDeleteGrupo(null);
            setEditingGrupo(null);
            await load();
            showToast('Grupo eliminado', 'success');
        } catch {
            // El backend rechaza borrar un grupo con sabores o productos.
            setDeleteGrupo(null);
            showToast('El grupo tiene sabores o productos: muévelos o desactívalo', 'error');
        }
    };

    const openProductosModal = async () => {
        setShowProductosModal(true);
        setLoadingProductos(true);
        try {
            setProductos(await api.productos.getAll());
        } catch {
            showToast('No se pudieron cargar los productos', 'error');
        } finally {
            setLoadingProductos(false);
        }
    };

    const handlePersonalizacionChange = async (producto: Producto, value: PersonalizacionProducto) => {
        setSavingProductoId(producto.productoId);
        try {
            await api.productos.update(producto.productoId, value);
            setProductos((prev) => prev.map((p) => (p.productoId === producto.productoId ? { ...p, ...value } : p)));
        } catch {
            showToast('No se pudo actualizar', 'error');
        } finally {
            setSavingProductoId(null);
        }
    };

    if (loading) return <PageContainer scrollable={false}><ListSkeleton count={8} /></PageContainer>;

    const extra = grupoActual ? reglaExtra(grupoActual) : null;

    return (
        <PageContainer
            scrollable
            refreshControl={<PosRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
            <PageHeader
                title="Saborización"
                subtitle="Grupos de sabores, variedades y recargos"
                icon="pizza"
                rightContent={
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Button
                            title={isMobile ? '' : 'Productos'}
                            icon="view-grid-outline"
                            variant="outline"
                            size="sm"
                            onPress={openProductosModal}
                        />
                        <Button
                            title={isMobile ? '' : 'Nuevo Grupo'}
                            icon="shape-plus-outline"
                            variant="outline"
                            size="sm"
                            onPress={() => setEditingGrupo({ maxSabores: 1, usaTamano: false, varianteEsSabor: false, recargoExtraDesde: null, activo: true })}
                        />
                        <Button
                            title={isMobile ? '' : 'Nuevo Sabor'}
                            icon="plus"
                            variant="primary"
                            size="sm"
                            disabled={grupos.length === 0}
                            onPress={() =>
                                setEditingSabor({ grupoId: grupoSel, recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true })
                            }
                        />
                    </View>
                }
            />

            {/* ─── Selector de grupo ─────────────────────────────────────────────── */}
            <View className="flex-row flex-wrap gap-2 px-2 pt-4">
                {grupos.map((g) => {
                    const activo = g.id === grupoSel;
                    const cantidad = sabores.filter((s) => s.grupoId === g.id && s.activo).length;
                    return (
                        <TouchableOpacity
                            key={g.id}
                            onPress={() => setGrupoSel(g.id)}
                            className={`px-4 py-2.5 rounded-2xl border ${activo ? 'bg-orange-500/20 border-orange-500/40' : 'bg-white/5 border-white/10'}`}
                            style={{ opacity: g.activo ? 1 : 0.5 }}
                        >
                            <Text className={`text-xs font-black uppercase tracking-widest ${activo ? 'text-orange-300' : 'text-slate-400'}`}>
                                {g.nombre} · {cantidad}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {grupoActual && (
                <View className="px-2 pt-4">
                    <Card className="p-5 bg-white/5 border border-white/5 rounded-[28px]">
                        <View className="flex-row items-start justify-between gap-3">
                            <View className="flex-1">
                                <Text className="text-white font-black text-base uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                                    {grupoActual.nombre}{grupoActual.activo ? '' : ' (inactivo)'}
                                </Text>
                                <Text className="text-slate-400 text-xs mt-1">
                                    Hasta {grupoActual.maxSabores} {grupoActual.maxSabores === 1 ? 'sabor' : 'sabores'} por unidad
                                    {grupoActual.usaTamano ? ' · con tamaños' : ''}
                                    {grupoActual.varianteEsSabor ? ' · la variante es el sabor' : ''}
                                </Text>
                                {extra && <Text className="text-sky-400 text-xs font-bold mt-1">{extra}</Text>}
                            </View>
                            <IconButton icon="cog-outline" accessibilityLabel="Reglas del grupo" onPress={() => setEditingGrupo(grupoActual)} />
                        </View>
                    </Card>
                </View>
            )}

            {grupos.length === 0 && (
                <View className="px-4 py-16 items-center">
                    <Text className="text-slate-400 text-sm font-bold text-center">
                        Aún no hay grupos de sabores. Crea uno (por ejemplo &ldquo;Pizza&rdquo;) y luego agrégale sabores.
                    </Text>
                </View>
            )}

            {/* ─── Sabores del grupo ─────────────────────────────────────────────── */}
            <View className="pt-4 pb-20 gap-4">
                <CardGrid
                    kind="panel"
                    data={saboresDelGrupo}
                    keyExtractor={(sabor) => String(sabor.saborId)}
                    renderItem={(sabor, idx) => (
                    <Animated.View entering={FadeInUp.delay(Math.min(idx, 12) * 40)}>
                        <Card className="p-6 bg-white/5 border border-white/5 rounded-[32px]" style={{ opacity: sabor.activo ? 1 : 0.55 }}>
                            <View className="flex-row justify-between items-start mb-5">
                                <View className="flex-row items-center flex-1 mr-4">
                                    <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4 border bg-orange-500/10 border-orange-500/20">
                                        <Icon name="pizza" size={24} color="#F5A524" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white text-lg font-black uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }} numberOfLines={1}>
                                            {formatFlavorName(sabor.nombre)}
                                        </Text>
                                        {!sabor.activo && (
                                            <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1">Oculto al pedir</Text>
                                        )}
                                    </View>
                                </View>

                                <View className="flex-row gap-2">
                                    <IconButton icon="pencil-outline" accessibilityLabel="Editar sabor" onPress={() => setEditingSabor(sabor)} />
                                    <IconButton icon="trash-can-outline" tone="danger" accessibilityLabel="Eliminar sabor" onPress={() => setDeleteSaborId(sabor.saborId)} />
                                </View>
                            </View>

                            <RecargosSabor sabor={sabor} grupo={grupoActual ?? undefined} />
                        </Card>
                    </Animated.View>
                    )}
                />

                {grupoActual && saboresDelGrupo.length === 0 && (
                    <Text className="text-slate-500 text-sm italic px-2">Este grupo aún no tiene sabores.</Text>
                )}

                {sinGrupo.length > 0 && (
                    <View className="w-full mt-4">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">
                            Sin grupo (no se ofrecen al pedir) — toca para asignar
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                            {sinGrupo.map((s) => (
                                <TouchableOpacity
                                    key={s.saborId}
                                    onPress={() => setEditingSabor({ ...s, grupoId: grupoSel })}
                                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"
                                >
                                    <Text className="text-slate-400 text-xs font-bold">{s.nombre}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </View>

            <SaborModal
                visible={!!editingSabor}
                sabor={editingSabor}
                grupos={grupos}
                loading={saving}
                onSave={handleSaveSabor}
                onClose={() => setEditingSabor(null)}
            />

            <GrupoSaborModal
                visible={!!editingGrupo}
                grupo={editingGrupo}
                loading={saving}
                onSave={handleSaveGrupo}
                onDelete={setDeleteGrupo}
                onClose={() => setEditingGrupo(null)}
            />

            {/* ─── Modal: qué ofrece cada producto al pedirlo ────────────────────── */}
            <Modal visible={showProductosModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowProductosModal(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(5, 9, 20, 0.98)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Card style={{ width: '100%', maxWidth: 560, backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 40, overflow: 'hidden', maxHeight: '90%' }}>
                        <View style={{ padding: 28, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(100,116,139,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon name="view-grid-outline" size={22} color="#94A3B8" />
                                </View>
                                <View>
                                    <Text style={{ color: '#F8FAFC', fontWeight: '900', fontSize: 18, fontFamily: 'Space Grotesk' }}>Productos</Text>
                                    <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700' }}>Qué ofrece cada uno al pedirlo</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowProductosModal(false)}
                                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Icon name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 28 }}>
                            {loadingProductos ? (
                                <LoadingState size="small" />
                            ) : (
                                productos.map((producto) => {
                                    const isSaving = savingProductoId === producto.productoId;
                                    return (
                                        <View
                                            key={producto.productoId}
                                            style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                                {producto.emoji ? (
                                                    <Text style={{ fontSize: 20, marginRight: 8 }}>{producto.emoji}</Text>
                                                ) : (
                                                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                                        <Icon name="food-variant" size={14} color="#64748B" />
                                                    </View>
                                                )}
                                                <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 13, flex: 1 }} numberOfLines={1}>
                                                    {producto.productoNombre}
                                                </Text>
                                                {isSaving && <ActivityIndicator size="small" color="#F5A524" style={{ marginLeft: 8 }} />}
                                            </View>
                                            <PersonalizacionSelector
                                                grupos={grupos}
                                                value={personalizacionDeProducto(producto)}
                                                disabled={isSaving}
                                                onChange={(v) => handlePersonalizacionChange(producto, v)}
                                            />
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>
                    </Card>
                </View>
            </Modal>

            <ConfirmModal
                visible={!!deleteSaborId}
                title="Eliminar Sabor"
                message="¿Estás seguro de eliminar este sabor? Las órdenes ya hechas conservan su nombre."
                icon="trash-can-outline"
                variant="danger"
                onConfirm={confirmDeleteSabor}
                onCancel={() => setDeleteSaborId(null)}
            />

            <ConfirmModal
                visible={!!deleteGrupo}
                title="Eliminar Grupo"
                message={`¿Eliminar el grupo "${deleteGrupo?.nombre ?? ''}"? Solo se puede si no tiene sabores ni productos.`}
                icon="trash-can-outline"
                variant="danger"
                onConfirm={confirmDeleteGrupo}
                onCancel={() => setDeleteGrupo(null)}
            />
        </PageContainer>
    );
}
