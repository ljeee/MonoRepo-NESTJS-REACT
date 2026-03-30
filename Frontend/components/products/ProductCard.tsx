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
    const isPizza = product.productoNombre.toLowerCase().includes('pizza');
 
    return (
        <Card className="bg-white/5 border border-white/5 overflow-hidden rounded-[40px]">
            {/* Product header */}
            <View className="flex-row items-center justify-between p-6 bg-white/5 border-b border-white/5">
                <View className="flex-row items-center flex-1 mr-4">
                    <View className="w-14 h-14 rounded-2xl bg-orange-500/10 items-center justify-center mr-4 border border-orange-500/20">
                        <Text className="text-2xl">{product.emoji || (isPizza ? '🍕' : '🍔')}</Text>
                    </View>
                    <View className="flex-1">
                        <View className="flex-row flex-wrap items-center gap-2 mb-1">
                            <Text className="text-white font-black text-lg uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }} numberOfLines={1}>
                                {product.productoNombre}
                            </Text>
                        </View>
                        {product.descripcion ? (
                            <Text className="text-slate-500 text-[10px] font-bold italic leading-tight uppercase tracking-tighter" numberOfLines={1}>
                                {product.descripcion}
                            </Text>
                        ) : null}
                    </View>
                </View>
                <TouchableOpacity 
                    onPress={onEdit} 
                    className="w-12 h-12 rounded-[20px] bg-orange-500/10 items-center justify-center active:bg-orange-500/20 border border-orange-500/20"
                >
                    <Icon name="pencil-outline" size={20} color="#F5A524" />
                </TouchableOpacity>
            </View>

            {/* Variants */}
            <View className="p-6">
                <View className="flex-row items-center justify-between mb-4 px-1">
                    <View className="flex-row items-center gap-2">
                        <Icon name="format-list-bulleted-type" size={14} color="#64748B" />
                        <Text className="text-slate-500 font-black text-[10px] uppercase tracking-widest">Variantes de Presentación</Text>
                    </View>
                    <TouchableOpacity onPress={onAddVariant} className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 active:bg-white/10">
                         <Text className="text-white font-black text-[9px] uppercase tracking-widest">+ Agregar</Text>
                    </TouchableOpacity>
                </View>

                <View className="gap-y-3 mb-2">
                    {product.variantes &&
                        product.variantes.map((v) => (
                            <View key={v.varianteId} className="flex-row items-center bg-black/20 p-4 rounded-3xl border border-white/5">
                                <View className="flex-1 mr-2">
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-white font-black text-xs uppercase" numberOfLines={1}>{v.nombre}</Text>
                                        <View className="w-1 h-1 rounded-full bg-slate-700" />
                                        <Text className="text-orange-400 font-black text-xs" style={{ fontFamily: 'Space Grotesk' }}>
                                             ${formatCurrency(v.precio)}
                                        </Text>
                                    </View>
                                    {v.descripcion ? (
                                        <Text className="text-slate-600 text-[9px] font-bold mt-0.5" numberOfLines={1}>{v.descripcion}</Text>
                                    ) : null}
                                </View>
                                
                                <View className="flex-row gap-2">
                                    <TouchableOpacity 
                                        onPress={() => onEditVariant(v.varianteId)}
                                        className="w-9 h-9 rounded-xl bg-white/5 active:bg-white/10 items-center justify-center border border-white/10"
                                    >
                                        <Icon name="pencil" size={14} color="#64748B" />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => onDeleteVariant(v.varianteId, v.nombre)}
                                        className="w-9 h-9 rounded-xl bg-red-500/10 active:bg-red-500/20 items-center justify-center border border-red-500/20"
                                    >
                                        <Icon name="trash-can-outline" size={14} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                </View>
            </View>

            {/* Pizza Flavors Section */}
            {isPizza && sabores && (
                <View className="border-t border-white/5 p-6 bg-orange-500/5">
                    <PizzaFlavorsSection 
                        sabores={sabores} 
                        onEditSabor={onEditSabor} 
                        onAddSabor={onAddSabor}
                        onDeleteSabor={onDeleteSabor}
                    />
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
        return (
            <TouchableOpacity
                key={sabor.saborId}
                onPress={() => onEditSabor?.(sabor)}
                onLongPress={() => onDeleteSabor?.(sabor.saborId, sabor.nombre)}
                activeOpacity={0.7}
                className={`flex-row items-center px-3 py-2 rounded-xl mb-2 mr-2 border ${isEspecial ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/10'}`}
            >
                <Text className={`text-[9px] font-black uppercase tracking-widest ${isEspecial ? 'text-orange-400' : 'text-slate-400'}`} numberOfLines={1}>
                    {isEspecial ? '★ ' : ''}{sabor.nombre}
                </Text>
            </TouchableOpacity>
        );
    };

    const config3Sabores = sabores.find(s => s.tipo === 'configuracion' && s.nombre === 'RECARGO_3_SABORES');
    const extra3SaboresAmount = config3Sabores ? Number(config3Sabores.recargoGrande) : 3000;

    return (
        <View>
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2">
                    <Icon name="pizza-slice" size={14} color="#F5A524" />
                    <Text className="text-orange-400/80 font-black text-[10px] uppercase tracking-widest">Personalización de Sabores</Text>
                </View>
                {onAddSabor && (
                    <TouchableOpacity onPress={onAddSabor} className="bg-orange-500/10 px-3 py-1.5 rounded-xl border border-orange-500/30">
                        <Text className="text-orange-400 font-black text-[9px] uppercase">+ Sabor</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View className="mb-4">
                <Text className="text-slate-600 text-[8px] font-black uppercase tracking-widest mb-2 ml-1">Variedades Tradicionales</Text>
                <View className="flex-row flex-wrap">
                    {tradicionales.map(s => renderChip(s))}
                </View>
            </View>

            <View className="mb-4">
                <Text className="text-orange-500/40 text-[8px] font-black uppercase tracking-widest mb-2 ml-1">Especialidades de la Casa ★</Text>
                <View className="flex-row flex-wrap">
                    {especiales.map(s => renderChip(s))}
                </View>
            </View>

            {config3Sabores && (
                <TouchableOpacity
                    onPress={() => onEditSabor?.(config3Sabores)}
                    className="flex-row items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5"
                >
                    <View className="flex-row items-center gap-3">
                         <View className="w-8 h-8 rounded-full bg-blue-500/10 items-center justify-center border border-blue-500/20">
                             <Icon name="information-outline" size={14} color="#60A5FA" />
                         </View>
                         <View>
                            <Text className="text-blue-400 text-[10px] font-black uppercase tracking-widest">Combinación 3 Sabores</Text>
                            <Text className="text-slate-500 text-[8px] font-bold">Recargo aplicado por unidad</Text>
                         </View>
                    </View>
                    <Text className="text-white font-black text-sm" style={{ fontFamily: 'Space Grotesk' }}>+${formatCurrency(extra3SaboresAmount)}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
