import React from 'react';
import type { Producto, PizzaSabor } from '@monorepo/shared';
import { View, Text } from '../../tw';
import Input from '../ui/Input';
import Icon from '../ui/Icon';
import { ListSkeleton } from '../ui';
import { ProductCard } from './ProductCard';

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
    return (
        <View className="flex-1">
            <View className="mb-6">
                <Input
                    value={search}
                    onChangeText={onSearchChange}
                    placeholder="Buscar producto o categoría..."
                    leftIcon={<Icon name="magnify" size={18} color="#64748B" />}
                    className="bg-slate-900 border-white/5"
                />
            </View>

            {loading && <ListSkeleton count={3} />}

            {error && (
                <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex-row items-center gap-3 mb-6">
                    <Icon name="alert-circle-outline" size={20} color="#EF4444" />
                    <Text className="text-red-400 font-bold text-sm flex-1">{error}</Text>
                </View>
            )}

            {!loading && (
                <View className="gap-y-1">
                    {productos.map((p) => (
                        <ProductCard
                            key={p.productoId}
                            product={p}
                            onEdit={() => onEditProduct(p)}
                            onEditVariant={(variantId) => onEditVariant(p.productoId, variantId)}
                            onDeleteVariant={onDeleteVariant}
                            onAddVariant={() => onAddVariant(p.productoId)}
                            sabores={p.categoria.toLowerCase() === 'pizzas' ? sabores : undefined}
                            onEditSabor={p.categoria.toLowerCase() === 'pizzas' ? onEditSabor : undefined}
                            onAddSabor={p.categoria.toLowerCase() === 'pizzas' ? onAddSabor : undefined}
                            onDeleteSabor={p.categoria.toLowerCase() === 'pizzas' ? onDeleteSabor : undefined}
                        />
                    ))}
                </View>
            )}

            {!loading && productos.length === 0 && !error && (
                <View className="py-20 items-center justify-center bg-slate-900/50 rounded-3xl border border-white/5 border-dashed">
                    <View className="w-16 h-16 rounded-full bg-slate-800 items-center justify-center mb-4">
                        <Icon name="food-off" size={32} color="#64748B" />
                    </View>
                    <Text className="text-slate-400 font-black uppercase tracking-widest text-xs">Sin productos encontrados</Text>
                    <Text className="text-slate-600 text-[10px] mt-1 font-bold">Intenta con otros términos de búsqueda</Text>
                </View>
            )}
        </View>
    );
}
