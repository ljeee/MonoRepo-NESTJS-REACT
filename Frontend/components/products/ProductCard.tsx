import React from 'react';
import type { Producto, PizzaSabor } from '@monorepo/shared';
import { formatCurrency } from '@monorepo/shared';
import { View, Text, TouchableOpacity } from '../../tw';
import { Button, Card, Icon, Badge } from '../ui';

interface ProductCardProps {
    product: Producto;
    onEdit: () => void;
    onEditVariant: (variantId: number) => void;
    onDeleteVariant: (variantId: number, variantName: string) => void;
    onAddVariant: () => void;
    /** Only relevant if product.categoria === 'Pizzas' */
    sabores?: PizzaSabor[];
    onEditSabor?: (sabor: PizzaSabor) => void;
    onAddSabor?: () => void;
    onDeleteSabor?: (saborId: number, name: string) => void;
}

export function ProductCard({
    product,
    onEdit,
    onEditVariant,
    onDeleteVariant,
    onAddVariant,
    sabores,
    onEditSabor,
    onAddSabor,
    onDeleteSabor,
}: ProductCardProps) {
    const isPizza = product.categoria.toLowerCase() === 'pizzas';

    return (
        <Card className="mb-6 bg-slate-900 border-white/5 overflow-hidden">
            {/* Product header */}
            <View className="flex-row items-start justify-between p-5 bg-white/5">
                <View className="flex-1 mr-4">
                    <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-white font-black text-lg uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                            {product.productoNombre}
                        </Text>
                        <Badge 
                            label={product.categoria} 
                            variant={isPizza ? 'secondary' : 'primary'} 
                            size="sm" 
                        />
                    </View>
                    {product.descripcion ? (
                        <Text className="text-slate-400 text-xs italic leading-tight" numberOfLines={2}>
                            {product.descripcion}
                        </Text>
                    ) : null}
                </View>
                <TouchableOpacity 
                    onPress={onEdit} 
                    className="w-12 h-12 rounded-full bg-orange-500/10 items-center justify-center active:bg-orange-500/20"
                >
                    <Icon name="pencil" size={20} color="#F5A524" />
                </TouchableOpacity>
            </View>

            {/* Variants */}
            <View className="p-5">
                <View className="flex-row items-center gap-2 mb-4">
                    <Icon name="format-list-bulleted-type" size={14} color="#64748B" />
                    <Text className="text-slate-500 font-black text-[10px] uppercase tracking-widest">Variantes y Precios</Text>
                </View>

                <View className="gap-y-3 mb-5">
                    {product.variantes &&
                        product.variantes.map((v) => (
                            <View key={v.varianteId} className="flex-row items-center bg-black/20 p-3 rounded-xl border border-white/5">
                                <View className="flex-1">
                                    <Text className="text-slate-200 font-bold text-sm uppercase">{v.nombre}</Text>
                                    {v.descripcion ? (
                                        <Text className="text-slate-500 text-[10px] italic">{v.descripcion}</Text>
                                    ) : null}
                                </View>
                                <Text className="text-(--color-pos-primary) font-black text-sm mx-4" style={{ fontFamily: 'Space Grotesk' }}>
                                    ${formatCurrency(v.precio)}
                                </Text>
                                <View className="flex-row gap-2">
                                    <TouchableOpacity 
                                        onPress={() => onEditVariant(v.varianteId)}
                                        className="w-11 h-11 rounded-xl bg-white/5 active:bg-white/10 items-center justify-center border border-white/5"
                                    >
                                        <Icon name="pencil" size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => onDeleteVariant(v.varianteId, v.nombre)}
                                        className="w-11 h-11 rounded-xl bg-red-500/10 active:bg-red-500/20 items-center justify-center border border-red-500/10"
                                    >
                                        <Icon name="trash-can-outline" size={16} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                </View>

                <Button
                    title="Nueva Variante"
                    icon="plus"
                    variant="outline"
                    size="sm"
                    onPress={onAddVariant}
                    className="border-dashed border-white/10"
                />
            </View>

            {/* Pizza Flavors Section */}
            {isPizza && sabores && (
                <View className="border-t border-white/5 p-5 bg-black/40">
                    <PizzaFlavorsSection sabores={sabores} onEditSabor={onEditSabor} />
                </View>
            )}
        </Card>
    );
}

function PizzaFlavorsSection({ 
    sabores, 
    onEditSabor,
    onAddSabor,
    onDeleteSabor
}: { 
    sabores: PizzaSabor[]; 
    onEditSabor?: (sabor: PizzaSabor) => void;
    onAddSabor?: () => void;
    onDeleteSabor?: (saborId: number, name: string) => void;
}) {
    const tradicionales = sabores.filter(s => s.tipo === 'tradicional' && s.activo);
    const especiales = sabores.filter(s => s.tipo === 'especial' && s.activo);

    const renderChip = (sabor: PizzaSabor) => {
        const isEspecial = sabor.tipo === 'especial';
        const hasRecargo = isEspecial && (Number(sabor.recargoPequena) > 0 || Number(sabor.recargoMediana) > 0);
        return (
            <TouchableOpacity
                key={sabor.saborId}
                onPress={() => onEditSabor?.(sabor)}
                onLongPress={() => onDeleteSabor?.(sabor.saborId, sabor.nombre)}
                activeOpacity={0.7}
                className={`flex-row items-center px-4 py-3 rounded-xl mb-2 mr-2 border ${isEspecial ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/10'}`}
            >
                <View className={`flex-row items-center gap-1.5 ${onEditSabor ? 'mr-3' : ''}`}>
                    <Text className={`text-[10px] font-black uppercase ${isEspecial ? 'text-purple-400' : 'text-slate-300'}`} numberOfLines={1}>
                        {isEspecial ? '★ ' : ''}{sabor.nombre}
                    </Text>
                    {hasRecargo && (
                        <Text className="text-purple-400/60 text-[8px] font-bold">
                            +${formatCurrency(Number(sabor.recargoPequena))}/${formatCurrency(Number(sabor.recargoMediana))}
                        </Text>
                    )}
                </View>
                {onEditSabor && (
                    <Icon name="pencil" size={10} color="#64748B" />
                )}
            </TouchableOpacity>
        );
    };

    const config3Sabores = sabores.find(s => s.tipo === 'configuracion' && s.nombre === 'RECARGO_3_SABORES');
    const extra3SaboresAmount = config3Sabores ? Number(config3Sabores.recargoGrande) : 3000;

    return (
        <View>
            <View className="flex-row items-center gap-2 mb-4">
                <Icon name="pizza" size={14} color="#A855F7" />
                <Text className="text-purple-400/80 font-black text-[10px] uppercase tracking-widest">Sabores y Recargos</Text>
            </View>

            <View className="mb-4">
                <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-2 ml-1">Tradicionales</Text>
                <View className="flex-row flex-wrap">
                    {tradicionales.map(s => renderChip(s))}
                </View>
            </View>

            <View className="mb-4">
                <Text className="text-purple-500/50 text-[8px] font-black uppercase tracking-widest mb-2 ml-1">Especiales ★</Text>
                <View className="flex-row flex-wrap">
                    {especiales.map(s => renderChip(s))}
                </View>
            </View>

            <View className="flex-row items-center gap-3 mt-2">
                {/* Recargo 3 sabores */}
                <TouchableOpacity
                    onPress={() => {
                        if (onEditSabor && config3Sabores) {
                            onEditSabor(config3Sabores);
                        }
                    }}
                    disabled={!onEditSabor || !config3Sabores}
                    activeOpacity={0.7}
                    className="flex-1 flex-row items-center gap-2 bg-purple-500/5 p-3 rounded-xl border border-purple-500/10"
                >
                    <Icon name="information-outline" size={14} color="#8B5CF6" />
                    <View className="flex-1 flex-row items-center justify-between">
                        <Text className="text-purple-400/70 text-[10px] font-bold uppercase tracking-tighter">
                            3 sabores: <Text className="text-purple-400">+${formatCurrency(extra3SaboresAmount)}</Text>
                        </Text>
                        {onEditSabor && config3Sabores && (
                            <Icon name="pencil" size={12} color="#8B5CF6" />
                        )}
                    </View>
                </TouchableOpacity>

                {/* Nuevo Sabor Button */}
                {onAddSabor && (
                    <TouchableOpacity
                        onPress={onAddSabor}
                        activeOpacity={0.7}
                        className="flex-row items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-purple-500/30 bg-purple-500/5"
                    >
                        <Icon name="plus" size={16} color="#A855F7" />
                        <Text className="text-purple-400 font-bold text-xs uppercase">Nuevo</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

