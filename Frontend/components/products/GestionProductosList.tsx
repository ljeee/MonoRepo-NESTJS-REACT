import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Producto, PizzaSabor } from '@/src/shared';
import { View, Text } from '../../tw';
import Input from '../ui/Input';
import Icon from '../ui/Icon';
import { ListSkeleton } from '../ui/SkeletonLoader';
import { ProductCard } from './ProductCard';
import { useBreakpoint } from '../../styles/responsive';

const STORAGE_KEY = '@starred_products_v1';

interface GestionProductosListProps {
    search: string;
    loading: boolean;
    error: string | null;
    productos: Producto[];
    sabores: PizzaSabor[];
    onSearchChange: (value: string) => void;
    onEditProduct: (product: Producto) => void;
    onAddVariant: (productId: number) => void;
    onEditVariant: (productId: number, variantId: number) => void;
    onDeleteVariant: (variantId: number, variantName: string) => void;
    onEditSabor: (sabor: PizzaSabor) => void;
    onAddSabor: () => void;
    onDeleteSabor: (saborId: number, saborName: string) => void;
}

export function GestionProductosList({
    search,
    loading,
    error,
    productos,
    sabores,
    onSearchChange,
    onEditProduct,
    onAddVariant,
    onEditVariant,
    onDeleteVariant,
    onEditSabor,
    onAddSabor,
    onDeleteSabor,
}: GestionProductosListProps) {
    const { isMobile } = useBreakpoint();
    const isWeb = Platform.OS === 'web';

    // ── Picstar state ──────────────────────────────────────────────────────────
    const [starredIds, setStarredIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY)
            .then((raw) => {
                if (raw) {
                    const ids: number[] = JSON.parse(raw);
                    setStarredIds(new Set(ids));
                }
            })
            .catch(() => { /* ignore */ });
    }, []);

    const toggleStar = useCallback(async (id: number) => {
        setStarredIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            // Persist asynchronously
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => { });
            return next;
        });
    }, []);

    // ── Sort: starred first, then by name ──────────────────────────────────────
    const sortedProductos = useMemo(() => {
        return [...productos].sort((a, b) => {
            const aStarred = starredIds.has(a.productoId) ? 0 : 1;
            const bStarred = starredIds.has(b.productoId) ? 0 : 1;
            if (aStarred !== bStarred) return aStarred - bStarred;
            return a.productoNombre.localeCompare(b.productoNombre);
        });
    }, [productos, starredIds]);

    const starredCount = useMemo(
        () => productos.filter((p) => starredIds.has(p.productoId)).length,
        [productos, starredIds],
    );

    return (
        <View className="flex-1">
            {/* Search + starred count */}
            <View style={{ marginBottom: 8, paddingHorizontal: 4 }}>
                <Input
                    value={search}
                    onChangeText={onSearchChange}
                    placeholder="Búsqueda rápida por nombre..."
                    leftIcon={<Icon name="magnify" size={20} color="#64748B" />}
                    className="bg-white/5 border-white/5 rounded-[24px]"
                    containerStyle={{ marginBottom: 0 }}
                />
                {starredCount > 0 && (
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 10,
                            paddingHorizontal: 4,
                        }}
                    >
                        <Icon name="star" size={12} color="#F5A524" />
                        <Text style={{ color: '#F5A524', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {starredCount} destacado{starredCount !== 1 ? 's' : ''} — aparecen primero
                        </Text>
                    </View>
                )}
            </View>

            {loading && <ListSkeleton count={4} />}

            {error && (
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        backgroundColor: 'rgba(239,68,68,0.08)',
                        borderWidth: 1,
                        borderColor: 'rgba(239,68,68,0.2)',
                        padding: 20,
                        borderRadius: 24,
                        marginBottom: 24,
                    }}
                >
                    <Icon name="alert-circle-outline" size={22} color="#EF4444" />
                    <Text className="text-red-400 font-bold text-sm flex-1 leading-tight">{error}</Text>
                </View>
            )}

            {!loading && (
                isWeb && !isMobile ? (
                    <View className="flex-row gap-4 pb-10 items-start">
                        <View className="flex-1 flex-col gap-4">
                            {sortedProductos.filter((_, idx) => idx % 2 === 0).map((p) => (
                                <ProductCard
                                    key={p.productoId}
                                    product={p}
                                    isStarred={starredIds.has(p.productoId)}
                                    onToggleStar={() => toggleStar(p.productoId)}
                                    onEdit={() => onEditProduct(p)}
                                    onEditVariant={(variantId) => onEditVariant(p.productoId, variantId)}
                                    onDeleteVariant={onDeleteVariant}
                                    onAddVariant={() => onAddVariant(p.productoId)}
                                    sabores={p.productoNombre?.toLowerCase().includes('pizza') ? sabores : undefined}
                                    onEditSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onEditSabor : undefined}
                                    onAddSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onAddSabor : undefined}
                                    onDeleteSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onDeleteSabor : undefined}
                                />
                            ))}
                        </View>
                        <View className="flex-1 flex-col gap-4">
                            {sortedProductos.filter((_, idx) => idx % 2 !== 0).map((p) => (
                                <ProductCard
                                    key={p.productoId}
                                    product={p}
                                    isStarred={starredIds.has(p.productoId)}
                                    onToggleStar={() => toggleStar(p.productoId)}
                                    onEdit={() => onEditProduct(p)}
                                    onEditVariant={(variantId) => onEditVariant(p.productoId, variantId)}
                                    onDeleteVariant={onDeleteVariant}
                                    onAddVariant={() => onAddVariant(p.productoId)}
                                    sabores={p.productoNombre?.toLowerCase().includes('pizza') ? sabores : undefined}
                                    onEditSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onEditSabor : undefined}
                                    onAddSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onAddSabor : undefined}
                                    onDeleteSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onDeleteSabor : undefined}
                                />
                            ))}
                        </View>
                    </View>
                ) : (
                    <View className="flex-col gap-4 pb-10">
                        {sortedProductos.map((p) => (
                            <ProductCard
                                key={p.productoId}
                                product={p}
                                isStarred={starredIds.has(p.productoId)}
                                onToggleStar={() => toggleStar(p.productoId)}
                                onEdit={() => onEditProduct(p)}
                                onEditVariant={(variantId) => onEditVariant(p.productoId, variantId)}
                                onDeleteVariant={onDeleteVariant}
                                onAddVariant={() => onAddVariant(p.productoId)}
                                sabores={p.productoNombre?.toLowerCase().includes('pizza') ? sabores : undefined}
                                onEditSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onEditSabor : undefined}
                                onAddSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onAddSabor : undefined}
                                onDeleteSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onDeleteSabor : undefined}
                            />
                        ))}
                    </View>
                )
            )}

            {!loading && productos.length === 0 && !error && (
                <View
                    style={{
                        paddingVertical: 80,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: 40,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.05)',
                        borderStyle: 'dashed',
                        margin: 4,
                    }}
                >
                    <View
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: 28,
                            backgroundColor: '#0F172A',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 20,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.05)',
                        }}
                    >
                        <Icon name="food-off-outline" size={36} color="#1E293B" />
                    </View>
                    <Text className="text-slate-500 font-black uppercase tracking-widest text-xs">
                        Sin coincidencias registradas
                    </Text>
                    <Text className="text-slate-700 text-[10px] mt-2 font-bold max-w-[200px] text-center leading-relaxed">
                        Prueba con términos más generales para localizar productos más rápido
                    </Text>
                </View>
            )}
        </View>
    );
}
