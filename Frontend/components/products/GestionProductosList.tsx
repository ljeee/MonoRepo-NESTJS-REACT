import React from 'react';
import { Platform } from 'react-native';
import type { Producto, PizzaSabor } from '@monorepo/shared';
import { View, Text } from '../../tw';
import Input from '../ui/Input';
import Icon from '../ui/Icon';
import { ListSkeleton } from '../ui';
import { ProductCard } from './ProductCard';
import { useBreakpoint } from '../../styles/responsive';

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

    return (
        <View className="flex-1">
            <View className="mb-8 p-1">
                <Input
                    value={search}
                    onChangeText={onSearchChange}
                    placeholder="Búsqueda rápida por nombre..."
                    leftIcon={<Icon name="magnify" size={20} color="#64748B" />}
                    className="bg-white/5 border-white/5 rounded-[24px]"
                />
            </View>

            {loading && <ListSkeleton count={4} />}

            {error && (
                <View className="bg-red-500/10 border border-red-500/20 p-6 rounded-[32px] flex-row items-center gap-4 mb-8">
                    <Icon name="alert-circle-outline" size={24} color="#EF4444" />
                    <Text className="text-red-400 font-bold text-sm flex-1 leading-tight">{error}</Text>
                </View>
            )}

            {!loading && (
                <View className="flex-row flex-wrap gap-4 pb-10">
                    {productos.map((p) => (
                        <View key={p.productoId} className={`${isWeb ? 'w-full lg:w-[49%]' : 'w-full'}`}>
                            <ProductCard
                                product={p}
                                onEdit={() => onEditProduct(p)}
                                onEditVariant={(variantId) => onEditVariant(p.productoId, variantId)}
                                onDeleteVariant={onDeleteVariant}
                                onAddVariant={() => onAddVariant(p.productoId)}
                                sabores={p.productoNombre?.toLowerCase().includes('pizza') ? sabores : undefined}
                                onEditSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onEditSabor : undefined}
                                onAddSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onAddSabor : undefined}
                                onDeleteSabor={p.productoNombre?.toLowerCase().includes('pizza') ? onDeleteSabor : undefined}
                            />
                        </View>
                    ))}
                </View>
            )}

            {!loading && productos.length === 0 && !error && (
                <View className="py-24 items-center justify-center bg-white/5 rounded-[48px] border border-white/5 border-dashed m-1">
                    <View className="w-24 h-24 rounded-[32px] bg-slate-900 items-center justify-center mb-6 border border-white/5">
                        <Icon name="food-off-outline" size={40} color="#1E293B" />
                    </View>
                    <Text className="text-slate-500 font-black uppercase tracking-widest text-xs">Sin coincidencias registradas</Text>
                    <Text className="text-slate-700 text-[10px] mt-2 font-bold max-w-[200px] text-center leading-relaxed">Prueba con términos más generales para localizar productos más rápido</Text>
                </View>
            )}
        </View>
    );
}
