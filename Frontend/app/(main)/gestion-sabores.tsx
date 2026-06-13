import React, { useEffect, useState } from 'react';
import { Platform, ActivityIndicator } from 'react-native';
import { View, Text, TouchableOpacity, ScrollView } from '../../tw';
import { api as apiService } from '../../services/api';
import { PizzaSabor, Producto, Personalizacion, PERSONALIZACION_OPCIONES, useToast } from '@/src/shared';
import { FadeInUp } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { useBreakpoint } from '../../styles/responsive';
import {
    PageContainer,
    PageHeader,
    Card,
    Input,
    Button,
    Icon,
    ListSkeleton,
    ConfirmModal
} from '../../components/ui';
import { Modal } from 'react-native';

function formatFlavorName(name: string): string {
    if (!name) return '';
    if (name.toUpperCase() === 'RECARGO_3_SABORES') return 'Recargo 3 Sabores';
    return name
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatCurrency(n: number) {
    return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

const PERSONALIZACION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    pizza:   { bg: 'rgba(245,165,36,0.18)', text: '#F5A524', border: 'rgba(245,165,36,0.4)' },
    calzone: { bg: 'rgba(56,189,248,0.15)', text: '#38BDF8', border: 'rgba(56,189,248,0.35)' },
    jugo:    { bg: 'rgba(52,211,153,0.15)', text: '#34D399', border: 'rgba(52,211,153,0.35)' },
    ninguna: { bg: 'rgba(100,116,139,0.12)', text: '#64748B', border: 'rgba(100,116,139,0.2)' },
};

export default function GestionSaboresScreen() {
    const api = apiService;
    const { showToast } = useToast();
    const [sabores, setSabores] = useState<PizzaSabor[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSabor, setEditingSabor] = useState<Partial<PizzaSabor> | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    // Productos modal state
    const [showProductosModal, setShowProductosModal] = useState(false);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loadingProductos, setLoadingProductos] = useState(false);
    const [savingProductoId, setSavingProductoId] = useState<number | null>(null);

    const { isMobile } = useBreakpoint();
    const isWeb = Platform.OS === 'web';

    const loadSabores = async () => {
        try {
            setLoading(true);
            const data = await api.pizzaSabores.getAll();
            setSabores(data);
        } catch (error) {
            showToast('No se pudieron cargar los sabores', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSabores();
    }, []);

    const handleSave = async () => {
        if (!editingSabor?.nombre) return showToast('El nombre es obligatorio', 'error');
        setSaving(true);
        try {
            const isPizza = editingSabor.tipo === 'tradicional' || editingSabor.tipo === 'especial' || (editingSabor.tipo as string) === 'pizza';
            const isCalzone = editingSabor.tipo === 'calzone';

            const recargoPequena = Number(isCalzone ? 0 : (editingSabor.recargoPequena ?? 0));
            const recargoMediana = Number(isCalzone ? 0 : (editingSabor.recargoMediana ?? 0));
            const recargoGrande = Number(isCalzone ? 0 : (editingSabor.recargoGrande ?? 0));

            const tipoFinal = isPizza
                ? (recargoPequena > 0 || recargoMediana > 0 || recargoGrande > 0 ? 'especial' : 'tradicional')
                : editingSabor.tipo;

            const dataToSave = {
                ...editingSabor,
                tipo: tipoFinal,
                recargoPequena,
                recargoMediana,
                recargoGrande,
            };
            if (editingSabor.saborId) {
                await api.pizzaSabores.update(editingSabor.saborId, dataToSave);
            } else {
                await api.pizzaSabores.create(dataToSave as any);
            }
            setIsModalVisible(false);
            setEditingSabor(null);
            loadSabores();
            showToast('Sabor guardado correctamente', 'success');
        } catch (error) {
            showToast('No se pudo guardar el sabor', 'error');
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await api.pizzaSabores.delete(deleteId);
            setDeleteId(null);
            loadSabores();
            showToast('Sabor eliminado', 'success');
        } catch (error) {
            showToast('No se pudo eliminar el sabor', 'error');
        }
    };

    const openProductosModal = async () => {
        setShowProductosModal(true);
        setLoadingProductos(true);
        try {
            const data = await api.productos.getAll();
            setProductos(data);
        } catch {
            showToast('No se pudieron cargar los productos', 'error');
        } finally {
            setLoadingProductos(false);
        }
    };

    const handlePersonalizacionChange = async (productoId: number, value: Personalizacion) => {
        setSavingProductoId(productoId);
        try {
            await api.productos.update(productoId, { personalizacion: value });
            setProductos(prev =>
                prev.map(p => p.productoId === productoId ? { ...p, personalizacion: value } : p)
            );
        } catch {
            showToast('No se pudo actualizar', 'error');
        } finally {
            setSavingProductoId(null);
        }
    };

    if (loading) return <PageContainer scrollable={false}><ListSkeleton count={8} /></PageContainer>;

    return (
        <PageContainer scrollable>
            <PageHeader
                title="Saborización"
                subtitle="Administración de variedades y recargos"
                icon="pizza"
                rightContent={
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Button
                            title={isMobile ? undefined : 'Productos'}
                            icon="view-grid-outline"
                            variant="outline"
                            size="sm"
                            onPress={openProductosModal}
                        />
                        <Button
                            title={isMobile ? undefined : 'Nuevo Sabor'}
                            icon="plus"
                            variant="primary"
                            size="sm"
                            onPress={() => {
                                setEditingSabor({ tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true });
                                setIsModalVisible(true);
                            }}
                        />
                    </View>
                }
            />

            <View className="flex-row flex-wrap gap-4 px-2 pt-4 pb-20">
                {sabores.map((sabor, idx) => (
                    <Animated.View
                        key={sabor.saborId}
                        entering={FadeInUp.delay(idx * 50)}
                        className={`${isWeb ? 'w-full lg:w-[49%]' : 'w-full'}`}
                    >
                        <Card className="p-6 bg-white/5 border border-white/5 rounded-[32px]">
                            <View className="flex-row justify-between items-start mb-6">
                                <View className="flex-row items-center flex-1 mr-4">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 border ${sabor.tipo === 'calzone' ? 'bg-sky-500/10 border-sky-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                                        <Icon name={sabor.tipo === 'calzone' ? 'food-variant' : 'pizza'} size={24} color={sabor.tipo === 'calzone' ? '#38BDF8' : '#F5A524'} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white text-lg font-black uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }} numberOfLines={1}>
                                            {formatFlavorName(sabor.nombre)}
                                        </Text>
                                        <View className="flex-row items-center mt-1">
                                            <View className={`w-1.5 h-1.5 rounded-full mr-2 ${sabor.tipo === 'especial' ? 'bg-amber-400' : sabor.tipo === 'calzone' ? 'bg-sky-400' : sabor.tipo === 'configuracion' ? 'bg-slate-400' : 'bg-emerald-400'}`} />
                                            <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">
                                                {sabor.tipo === 'tradicional' || sabor.tipo === 'especial' ? 'pizza' : sabor.tipo}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        onPress={() => {
                                            setEditingSabor(sabor);
                                            setIsModalVisible(true);
                                        }}
                                        className="w-10 h-10 rounded-xl bg-white/5 items-center justify-center border border-white/10 active:bg-white/10"
                                    >
                                        <Icon name="pencil-outline" size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setDeleteId(sabor.saborId)}
                                        className="w-10 h-10 rounded-xl bg-red-500/10 items-center justify-center border border-red-500/20 active:bg-red-500/20"
                                    >
                                        <Icon name="trash-can-outline" size={16} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {sabor.tipo === 'calzone' ? (
                                <View className="flex-row justify-between bg-black/20 p-4 rounded-2xl border border-white/5">
                                    <View className="items-center flex-1">
                                        <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Precio Calzone</Text>
                                        <Text className="text-sky-400 font-bold text-sm uppercase" style={{ fontFamily: 'Space Grotesk' }}>Precio Plano (Sin Recargos)</Text>
                                    </View>
                                </View>
                            ) : (sabor.tipo !== 'configuracion' && Number(sabor.recargoPequena) === 0 && Number(sabor.recargoMediana) === 0 && Number(sabor.recargoGrande) === 0) ? (
                                <View className="flex-row justify-between bg-black/20 p-4 rounded-2xl border border-white/5">
                                    <View className="items-center flex-1">
                                        <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Precio Pizza</Text>
                                        <Text className="text-emerald-400 font-bold text-sm uppercase" style={{ fontFamily: 'Space Grotesk' }}>Precio Regular (Sin Recargo)</Text>
                                    </View>
                                </View>
                            ) : (
                                <View className="flex-row justify-between bg-black/20 p-4 rounded-2xl border border-white/5">
                                    <View className="items-center flex-1 border-r border-white/5">
                                        <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Pequeña</Text>
                                        <Text className="text-white font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(Number(sabor.recargoPequena))}</Text>
                                    </View>
                                    <View className="items-center flex-1 border-r border-white/5">
                                        <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Mediana</Text>
                                        <Text className="text-orange-400 font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(Number(sabor.recargoMediana))}</Text>
                                    </View>
                                    <View className="items-center flex-1">
                                        <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Grande</Text>
                                        <Text className="text-white font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(Number(sabor.recargoGrande))}</Text>
                                    </View>
                                </View>
                            )}
                        </Card>
                    </Animated.View>
                ))}
            </View>

            {/* ─── Modal: editar/crear sabor ─────────────────────────────────────────── */}
            <Modal visible={isModalVisible && !!editingSabor} transparent animationType="fade" statusBarTranslucent>
                <View style={{ flex: 1, backgroundColor: 'rgba(5, 9, 20, 1)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Card className="w-full max-w-[500px] bg-[#0F172A] border border-white/10 overflow-hidden rounded-[40px]">
                        <ScrollView contentContainerStyle={{ padding: 32 }}>
                            <View className="flex-row items-center gap-4 mb-8">
                                <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${editingSabor?.tipo === 'calzone' ? 'bg-sky-500/10 border-sky-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                                    <Icon name={editingSabor?.tipo === 'calzone' ? 'food-variant' : 'pizza'} size={24} color={editingSabor?.tipo === 'calzone' ? '#38BDF8' : '#F5A524'} />
                                </View>
                                <Text className="text-white font-black text-2xl uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>
                                    {editingSabor?.saborId ? 'Editar Sabor' : 'Nuevo Sabor'}
                                </Text>
                            </View>

                            <View className="mb-6">
                                <Input
                                    label="Nombre del Sabor"
                                    value={editingSabor?.nombre || ''}
                                    onChangeText={(t) => setEditingSabor({...editingSabor, nombre: t})}
                                    placeholder="Ej: Paisa, Mexicana..."
                                    leftIcon={<Icon name="tag-outline" size={16} color="#64748B" />}
                                />
                            </View>

                            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Clasificación de Sabor</Text>
                            <View className="flex-row flex-wrap gap-1.5 mb-8">
                                {['pizza', 'calzone', 'configuracion'].map((type) => {
                                    const isSelected = type === 'pizza'
                                        ? (editingSabor?.tipo === 'tradicional' || editingSabor?.tipo === 'especial' || (editingSabor?.tipo as string) === 'pizza')
                                        : editingSabor?.tipo === type;
                                    return (
                                        <TouchableOpacity
                                            key={type}
                                            onPress={() => setEditingSabor({...editingSabor, tipo: (type === 'pizza' ? 'tradicional' : type) as any})}
                                            className={`flex-1 min-w-[75px] py-3 items-center rounded-2xl border ${isSelected ? 'bg-orange-500/20 border-orange-500/40' : 'bg-white/5 border-white/5'}`}
                                        >
                                            <Text className={`font-black text-[10px] uppercase ${isSelected ? 'text-orange-400' : 'text-slate-500'}`}>{type.substring(0, 5)}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {(editingSabor?.tipo === 'tradicional' || editingSabor?.tipo === 'especial' || editingSabor?.tipo === 'configuracion' || (editingSabor?.tipo as string) === 'pizza') ? (
                                <>
                                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Recargos Adicionales ($)</Text>
                                    <View className="flex-row gap-4 mb-10">
                                        <View className="flex-1">
                                            <Input
                                                label="S"
                                                keyboardType="numeric"
                                                value={editingSabor?.recargoPequena?.toString()}
                                                onChangeText={(v) => setEditingSabor({...editingSabor, recargoPequena: parseInt(v) || 0})}
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Input
                                                label="M"
                                                keyboardType="numeric"
                                                value={editingSabor?.recargoMediana?.toString()}
                                                onChangeText={(v) => setEditingSabor({...editingSabor, recargoMediana: parseInt(v) || 0})}
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Input
                                                label="L"
                                                keyboardType="numeric"
                                                value={editingSabor?.recargoGrande?.toString()}
                                                onChangeText={(v) => setEditingSabor({...editingSabor, recargoGrande: parseInt(v) || 0})}
                                            />
                                        </View>
                                    </View>
                                </>
                            ) : (
                                <View className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-10 items-center">
                                    <Icon name="information-outline" size={20} color="#38BDF8" />
                                    <Text className="text-slate-400 text-xs font-bold text-center mt-2">
                                        Los calzones manejan precio plano (definido en variantes de producto). No requieren recargos por tamaño.
                                    </Text>
                                </View>
                            )}

                            <View className="flex-row gap-4">
                                <Button title="Cerrar" variant="ghost" style={{ flex: 1 }} onPress={() => setIsModalVisible(false)} />
                                <Button
                                    title={saving ? 'Salvando...' : 'Guardar'}
                                    variant="primary"
                                    style={{ flex: 1 }}
                                    onPress={handleSave}
                                    loading={saving}
                                />
                            </View>
                        </ScrollView>
                    </Card>
                </View>
            </Modal>

            {/* ─── Modal: personalización de productos ───────────────────────────────── */}
            <Modal visible={showProductosModal} transparent animationType="fade" statusBarTranslucent>
                <View style={{ flex: 1, backgroundColor: 'rgba(5, 9, 20, 0.98)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Card style={{ width: '100%', maxWidth: 560, backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 40, overflow: 'hidden', maxHeight: '90%' }}>
                        <View style={{ padding: 28, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(100,116,139,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon name="view-grid-outline" size={22} color="#94A3B8" />
                                </View>
                                <View>
                                    <Text style={{ color: '#F8FAFC', fontWeight: '900', fontSize: 18, fontFamily: 'Space Grotesk' }}>Productos</Text>
                                    <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700' }}>Asignar tipo de saborización</Text>
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
                                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                                    <ActivityIndicator color="#F5A524" />
                                </View>
                            ) : (
                                productos.map((producto) => {
                                    const current = (producto.personalizacion || 'ninguna') as Personalizacion;
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
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                {PERSONALIZACION_OPCIONES.map((op) => {
                                                    const isActive = current === op.value;
                                                    const colors = PERSONALIZACION_COLORS[op.value];
                                                    return (
                                                        <TouchableOpacity
                                                            key={op.value}
                                                            onPress={() => !isSaving && handlePersonalizacionChange(producto.productoId!, op.value)}
                                                            style={{
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 6,
                                                                borderRadius: 10,
                                                                backgroundColor: isActive ? colors.bg : 'rgba(255,255,255,0.04)',
                                                                borderWidth: 1,
                                                                borderColor: isActive ? colors.border : 'rgba(255,255,255,0.06)',
                                                                opacity: isSaving ? 0.5 : 1,
                                                            }}
                                                        >
                                                            <Text style={{
                                                                color: isActive ? colors.text : '#64748B',
                                                                fontSize: 11,
                                                                fontWeight: '800',
                                                            }}>
                                                                {op.label}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>
                    </Card>
                </View>
            </Modal>

            <ConfirmModal
                visible={!!deleteId}
                title="Eliminar Sabor"
                message="¿Estás seguro de eliminar este sabor? Esto podría afectar a órdenes existentes en el historial."
                icon="trash-can-outline"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteId(null)}
            />
        </PageContainer>
    );
}
