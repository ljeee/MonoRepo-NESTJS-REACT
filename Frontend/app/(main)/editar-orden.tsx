import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { ScrollView, View, Text, TextInput } from '../../tw';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Animated } from '../../tw/animated';
import { FadeInUp, FadeInRight, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Easing, useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, withSpring, withDelay } from 'react-native-reanimated';
import { api } from '../../services/api';
import { useToast } from '@monorepo/shared';
import { Icon, PageContainer, PageHeader, Card, Button } from '../../components/ui';
import { ErrorState } from '../../components/states/ErrorState';
import MenuPicker from '../../components/orderForm/MenuPicker';
import type { Producto, ProductoVariante } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductoEdit {
    _clientId: string;
    varianteId?: number;
    tipo: string;       // nombre legible para display
    cantidad: number;
    precioUnitario: number;
    sabores?: string[];
    tamano?: string;
}

interface OrdenInfo {
    ordenId: number;
    tipoPedido?: string;
    estadoOrden?: string;
    observaciones?: string;
    factura?: { facturaId?: number; clienteNombre?: string; estado?: string; total?: number; metodo?: string };
    domicilios?: { costoDomicilio?: number; direccionEntrega?: string }[];
    productos?: any[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _counter = 0;
function nextId() { return `ep-${++_counter}-${Date.now()}`; }

function formatCOP(n: number) {
    return n.toLocaleString('es-CO');
}

// ── Animated Decorative Component ───────────────────────────────────────────
function AnimatedOrb({ delay = 0, size = 200, color = '#F5A524', style }: any) {
    const opacity = useSharedValue(0.15);
    const scale = useSharedValue(1);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.25, { duration: 3000 + delay * 500 }),
                withTiming(0.12, { duration: 3000 + delay * 500 }),
            ),
            -1,
            true,
        );
        scale.value = withRepeat(
            withSequence(
                withTiming(1.08, { duration: 4000 + delay * 600, easing: Easing.inOut(Easing.sin) }),
                withTiming(0.95, { duration: 4000 + delay * 600, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View
            style={[
                animStyle,
                {
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    zIndex: -1,
                },
                style,
            ]}
        />
    );
}

// ─── ProductRow ───────────────────────────────────────────────────────────────

function ProductRow({ item, index, onRemove, onQtyChange, isPaid }: {
    item: ProductoEdit; index: number; onRemove: () => void;
    onQtyChange: (qty: number) => void; isPaid: boolean;
}) {
    const subtotal = item.precioUnitario * item.cantidad;
    return (
        <Animated.View entering={FadeInRight.delay(index * 50).springify()}>
            <View className="flex-row items-center bg-white/5 rounded-2xl p-4 mb-3 border border-white/5">
                {/* Acento izquierdo */}
                <View className={`w-1 self-stretch rounded-full ${isPaid ? 'bg-slate-400/30' : 'bg-(--color-pos-primary)/50'} mr-3`} />

                {/* Info */}
                <View className="flex-1 mr-3">
                    <Text className="font-black text-white text-[13px] uppercase" style={{ fontFamily: 'Space Grotesk' }} numberOfLines={1}>
                        {item.tipo}
                    </Text>
                    {item.sabores && item.sabores.length > 0 && (
                        <Text className="font-bold text-slate-400 text-[11px] mt-1" numberOfLines={1}>
                            {item.sabores.join(' / ')}
                        </Text>
                    )}
                    <Text className="font-black text-(--color-pos-primary) text-[12px] mt-1" style={{ fontFamily: 'Space Grotesk' }}>
                        ${formatCOP(subtotal)}
                    </Text>
                </View>

                {/* Quantity stepper */}
                {!isPaid && (
                    <View className="flex-row items-center gap-2 mr-3">
                        <TouchableOpacity
                            onPress={() => item.cantidad > 1 ? onQtyChange(item.cantidad - 1) : onRemove()}
                            className={`w-8 h-8 rounded-lg items-center justify-center border ${item.cantidad <= 1 ? 'bg-red-500/15 border-red-500/30' : 'bg-white/10 border-white/10'}`}
                        >
                            <Icon name={item.cantidad <= 1 ? 'trash-can-outline' : 'minus'} size={14}
                                color={item.cantidad <= 1 ? '#F43F5E' : '#94A3B8'} />
                        </TouchableOpacity>
                        <View className="w-8 h-8 rounded-lg bg-(--color-pos-primary)/10 items-center justify-center border border-(--color-pos-primary)/20">
                            <Text className="font-black text-(--color-pos-primary) text-[13px]" style={{ fontFamily: 'Space Grotesk' }}>{item.cantidad}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => onQtyChange(item.cantidad + 1)}
                            className="w-8 h-8 rounded-lg bg-emerald-500/10 items-center justify-center border border-emerald-500/20"
                        >
                            <Icon name="plus" size={14} color="#10B981" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* If paid — just show qty badge */}
                {isPaid && (
                    <View className="px-3 py-1.5 rounded-lg bg-slate-400/10 mr-2">
                        <Text className="font-black text-slate-400 text-[12px]" style={{ fontFamily: 'Space Grotesk' }}>x{item.cantidad}</Text>
                    </View>
                )}


            </View>
        </Animated.View>
    );
}

// ─── Add Product Panel ────────────────────────────────────────────────────────

function AddProductPanel({ onAdd, onClose }: { onAdd: (p: ProductoEdit) => void; onClose: () => void }) {
    const handleAdd = (producto: Producto, variante: ProductoVariante, sabores?: string[]) => {
        const name = `${producto.productoNombre}${variante.nombre ? ' — ' + variante.nombre : ''}`;
        onAdd({
            _clientId: nextId(),
            varianteId: variante.varianteId,
            tipo: name,
            cantidad: 1,
            precioUnitario: Number(variante.precio),
            sabores: sabores?.length ? sabores : undefined,
        });
    };

    return (
        <View className="fixed inset-0 bg-black/60 z-[99999] justify-end">
            <TouchableOpacity className="flex-1" onPress={onClose} activeOpacity={1} />
            <View className="bg-(--color-pos-surface) rounded-t-[32px] border border-white/10 min-h-[70%] pb-10">
                <View className="flex-row justify-between items-center p-6 border-b border-white/5">
                    <Text className="font-black text-white text-lg uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk' }}>
                        Añadir Producto
                    </Text>
                    <TouchableOpacity onPress={onClose} className="w-10 h-10 rounded-xl bg-white/5 items-center justify-center">
                        <Icon name="close" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerClassName="p-4" showsVerticalScrollIndicator={false}>
                    <MenuPicker onAdd={handleAdd} />
                </ScrollView>
            </View>
        </View>
    );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function EditarOrdenScreen() {
    const { ordenId } = useLocalSearchParams();
    const router = useRouter();
    const { showToast } = useToast();
    const { isMobile, isTablet } = useBreakpoint();
    const isWeb = Platform.OS === 'web';

    const [loadingOrden, setLoadingOrden] = useState(true);
    const [saving, setSaving] = useState(false);
    const [orden, setOrden] = useState<OrdenInfo | null>(null);
    const [products, setProducts] = useState<ProductoEdit[]>([]);
    const [observaciones, setObservaciones] = useState('');
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load order
    useEffect(() => {
        if (!ordenId) { setError('No se proporcionó ID'); setLoadingOrden(false); return; }
        api.ordenes.getById(Number(ordenId)).then((o: any) => {
            setOrden(o);
            setObservaciones(o.observaciones || '');
            // Map existing products to ProductoEdit
            const mapped: ProductoEdit[] = (o.productos || []).map((p: any) => ({
                _clientId: nextId(),
                varianteId: p.varianteId || p.variante?.varianteId || p.productoObj?.variantes?.[0]?.varianteId,
                tipo: p.producto || `${p.productoObj?.productoNombre || ''} ${p.variante?.nombre || ''}`.trim() || 'Producto',
                cantidad: p.cantidad || 1,
                precioUnitario: p.precioUnitario ?? p.variante?.precio ?? p.productoObj?.precio ?? 0,
                sabores: [p.sabor1, p.sabor2, p.sabor3].filter(Boolean) as string[],
            }));
            setProducts(mapped);
        }).catch(() => setError('Error al cargar la orden')).finally(() => setLoadingOrden(false));
    }, [ordenId]);

    const isPaid = (orden?.factura?.estado || '').toLowerCase() === 'pagada';
    const costoDom = Number(orden?.domicilios?.[0]?.costoDomicilio || 0);
    const subtotal = products.reduce((s: number, p: ProductoEdit) => s + p.precioUnitario * p.cantidad, 0);
    const total = subtotal + costoDom;

    const handleSave = useCallback(async () => {
        if (isPaid) { showToast('Esta orden ya está pagada y no puede modificarse', 'error'); return; }
        if (products.length === 0) { showToast('Debe tener al menos un producto', 'error'); return; }
        setSaving(true);
        try {
            await api.ordenes.update(Number(ordenId), {
                observaciones: observaciones || undefined,
                productos: products
                    .filter(p => p.varianteId !== undefined && p.varianteId !== null)
                    .map((p: ProductoEdit) => ({
                        producto: p.tipo, // For frontend type compatibility
                        tipo: p.tipo,     // For backend DTO compatibility
                        varianteId: Number(p.varianteId),
                        cantidad: p.cantidad,
                        sabor1: p.sabores?.[0],
                        sabor2: p.sabores?.[1],
                        sabor3: p.sabores?.[2],
                    })) as any,
            });
            showToast('✅ Orden actualizada correctamente', 'success');
            setTimeout(() => router.back(), 1000); // Volver al detalle original
        } catch (e: any) {
            showToast(e?.response?.data?.message || 'Error al guardar cambios', 'error');
        } finally {
            setSaving(false);
        }
    }, [isPaid, products, observaciones, ordenId, router, showToast]);

    // ── Loading ──
    if (loadingOrden) {
        return (
            <PageContainer className="items-center justify-center">
                <ActivityIndicator size="large" color="#F5A524" />
                <Text className="text-slate-500 font-bold mt-4">Cargando orden...</Text>
            </PageContainer>
        );
    }

    // ── Error ──
    if (error || !orden) {
        return (
            <PageContainer className="items-center justify-center p-6">
                <ErrorState message={error || 'Error desconocido'} onRetry={() => router.back()} />
            </PageContainer>
        );
    }

    const clienteName = orden.factura?.clienteNombre || 'Sin nombre';

    return (
        <PageContainer scrollable={false} className="bg-(--color-pos-bg)">
            {/* Orbs de fondo */}
            <AnimatedOrb size={400} color="#F5A524" delay={0} style={{ top: -100, right: -100 }} />
            <AnimatedOrb size={300} color="#8B5CF6" delay={1} style={{ bottom: -50, left: -100 }} />

            <View className={`px-4 pt-4 ${!isMobile ? 'px-8' : ''}`}>
               <Animated.View entering={FadeInDown.springify()}>
                   <PageHeader 
                       title={`Editar Orden #${orden.ordenId}`}
                       icon="pencil-circle-outline"
                       rightContent={
                          <View className="flex-row items-center gap-3">
                             <Button
                                title="Volver"
                                icon="arrow-left"
                                variant="ghost"
                                size="sm"
                                onPress={() => router.back()}
                             />
                             {!isPaid && (
                                 <Button
                                    title="Guardar"
                                    icon="content-save"
                                    variant="primary"
                                    size="sm"
                                    loading={saving}
                                    onPress={handleSave}
                                 />
                             )}
                          </View>
                       }
                   />
               </Animated.View>
               <Animated.Text entering={FadeInDown.delay(100).springify()} className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-[-8px] mb-6">
                    {clienteName} • {orden.tipoPedido}
               </Animated.Text>
            </View>

            <ScrollView 
                showsVerticalScrollIndicator={false} 
                className="flex-1 px-4"
                contentContainerClassName={`pb-20 ${!isMobile ? 'px-4' : ''}`}
                keyboardShouldPersistTaps="handled"
            >
                <View className="max-w-4xl mx-auto w-full">
                    
                    {/* ── Status card ── */}
                    <Animated.View entering={FadeInUp.delay(200).springify()}>
                        <Card className={`mb-6 p-5 border shadow-2xl ${isPaid ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/10 bg-white/5'} rounded-3xl flex-row items-center gap-5`}>
                            <View className={`w-14 h-14 rounded-2xl items-center justify-center ${isPaid ? 'bg-emerald-500/15 border border-emerald-500/20' : 'bg-(--color-pos-primary)/15 border border-(--color-pos-primary)/20'}`}>
                                <Icon name={isPaid ? 'lock-outline' : 'pencil-outline'} size={28} color={isPaid ? '#10B981' : '#F5A524'} />
                            </View>
                            <View className="flex-1">
                                <Text className={`font-black text-lg uppercase tracking-wider ${isPaid ? 'text-emerald-500' : 'text-(--color-pos-primary)'}`} style={{ fontFamily: 'Space Grotesk' }}>
                                    {isPaid ? 'Orden Pagada' : 'Modo Edición'}
                                </Text>
                                <Text className="font-bold text-slate-400 text-xs mt-1 leading-relaxed">
                                    {isPaid ? 'Esta orden ya fue cobrada y no puede modificarse.' : 'Gestiona los productos. El total se actualizará automáticamente.'}
                                </Text>
                            </View>
                        </Card>
                    </Animated.View>

                    <View className={isTablet || !isMobile ? 'flex-row gap-6 items-start' : ''}>
                        
                        {/* ── Left Column: Products ── */}
                        <View className={isTablet || !isMobile ? 'flex-[2]' : ''}>
                            <Animated.View entering={FadeInUp.delay(300)}>
                                <View className="flex-row items-center gap-3 mb-6 bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <View className="w-1.5 h-6 rounded-full bg-(--color-pos-primary)" />
                                    <Text className="font-black text-white text-base uppercase tracking-[2px] flex-1" style={{ fontFamily: 'Space Grotesk' }}>
                                        Productos ({products.length})
                                    </Text>
                                    {!isPaid && (
                                        <Button
                                            title="Añadir"
                                            icon="plus"
                                            variant="primary"
                                            size="sm"
                                            onPress={() => setShowAddPanel(true)}
                                            className="h-9 px-4 min-w-0 rounded-xl" 
                                        />
                                    )}
                                </View>

                                {products.length === 0 ? (
                                    <View className="bg-white/5 rounded-[32px] border border-white/10 border-dashed py-16 items-center mb-6">
                                        <Icon name="food-off-outline" size={64} color="#334155" />
                                        <Text className="font-black text-slate-500 text-sm mt-6 uppercase tracking-[3px]" style={{ fontFamily: 'Space Grotesk' }}>
                                            Sin productos
                                        </Text>
                                    </View>
                                ) : (
                                    <View className="gap-y-1">
                                        {products.map((p: ProductoEdit, idx: number) => (
                                            <ProductRow
                                                key={p._clientId}
                                                item={p}
                                                index={idx}
                                                isPaid={isPaid}
                                                onRemove={() => setProducts((prev: ProductoEdit[]) => prev.filter((x: ProductoEdit) => x._clientId !== p._clientId))}
                                                onQtyChange={(qty: number) => setProducts((prev: ProductoEdit[]) => prev.map((x: ProductoEdit) => x._clientId === p._clientId ? { ...x, cantidad: qty } : x))}
                                            />
                                        ))}
                                    </View>
                                )}
                            </Animated.View>
                        </View>

                        {/* ── Right Column: Info & Summary ── */}
                        <View className={isTablet || !isMobile ? 'flex-1' : ''}>
                            <Animated.View entering={FadeInUp.delay(400)}>
                                <Card className="bg-white/5 border border-white/10 p-6 rounded-[28px] mb-6">
                                    <View className="flex-row items-center gap-3 mb-5">
                                        <View className="w-1.5 h-6 rounded-full bg-violet-500" />
                                        <Text className="font-black text-white text-base uppercase tracking-[2px]" style={{ fontFamily: 'Space Grotesk' }}>
                                            Observaciones
                                        </Text>
                                    </View>
                                    <TextInput
                                        value={observaciones}
                                        onChangeText={setObservaciones}
                                        placeholder="Algún detalle adicional..."
                                        placeholderTextColor="#475569"
                                        multiline
                                        numberOfLines={4}
                                        editable={!isPaid}
                                        style={{ color: '#F8FAFC', fontSize: 16, textAlignVertical: 'top' }}
                                        className={`bg-black/20 rounded-2xl p-4 border border-white/5 text-white font-medium min-h-[140px] ${isPaid ? 'opacity-50' : ''}`}
                                    />
                                </Card>
                            </Animated.View>

                            <Animated.View entering={FadeInUp.delay(500)}>
                                <Card className="bg-(--color-pos-primary)/5 border border-(--color-pos-primary)/20 p-6 rounded-[28px] mb-6 shadow-2xl">
                                    <View className="flex-row items-center gap-3 mb-6">
                                        <View className="w-1.5 h-6 rounded-full bg-(--color-pos-primary)" />
                                        <Text className="font-black text-white text-base uppercase tracking-[2px]" style={{ fontFamily: 'Space Grotesk' }}>
                                            Resumen
                                        </Text>
                                    </View>
                                    <View className="gap-y-4">
                                        <View className="flex-row justify-between">
                                            <Text className="font-bold text-slate-400 text-sm">Productos</Text>
                                            <Text className="font-black text-white text-sm" style={{ fontFamily: 'Space Grotesk' }}>${formatCOP(subtotal)}</Text>
                                        </View>
                                        {costoDom > 0 && (
                                            <View className="flex-row justify-between">
                                                <Text className="font-bold text-slate-400 text-sm">Domicilio</Text>
                                                <Text className="font-black text-emerald-500 text-sm" style={{ fontFamily: 'Space Grotesk' }}>+${formatCOP(costoDom)}</Text>
                                            </View>
                                        )}
                                        <View className="h-[1px] bg-white/5 my-2" />
                                        <View className="flex-row justify-between items-center">
                                            <Text className="font-black text-white text-lg uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk' }}>Total</Text>
                                            <View className="items-end">
                                                <Text className="font-black text-(--color-pos-primary) text-4xl" style={{ fontFamily: 'Space Grotesk' }}>
                                                    ${formatCOP(total)}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </Card>
                            </Animated.View>

                            {/* ── Actions ── */}
                            <Animated.View entering={FadeInUp.delay(600)}>
                                {isPaid ? (
                                    <View className="flex-row items-center justify-center gap-3 bg-red-500/10 rounded-2xl py-6 border border-red-500/20">
                                        <Icon name="lock-outline" size={24} color="#F43F5E" />
                                        <Text className="font-black text-red-500 text-[13px] uppercase tracking-[2px]" style={{ fontFamily: 'Space Grotesk' }}>
                                            Orden Bloqueada
                                        </Text>
                                    </View>
                                ) : (
                                    <View className="flex-col gap-3">
                                        <Button
                                            title="Guardar Cambios"
                                            icon="check-circle-outline"
                                            variant="primary"
                                            size="lg"
                                            loading={saving}
                                            onPress={handleSave}
                                            className="h-14 rounded-2xl"
                                        />
                                        <Button
                                            title="Cancelar"
                                            variant="ghost"
                                            onPress={() => router.back()}
                                            className="h-12"
                                        />
                                    </View>
                                )}
                            </Animated.View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* ── Add Product Panel (Bottom Sheet) ── */}
            {showAddPanel && (
                <AddProductPanel
                    onAdd={(p: ProductoEdit) => { setProducts((prev: ProductoEdit[]) => [...prev, p]); }}
                    onClose={() => setShowAddPanel(false)}
                />
            )}
        </PageContainer>
    );
}
