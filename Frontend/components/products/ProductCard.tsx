import React, { useState } from 'react';
import type { Producto, PizzaSabor } from '@/src/shared';
import { formatCurrency } from '@/src/shared';
import { View, Text, TouchableOpacity } from '../../tw';
import Card from '../ui/Card';
import Icon from '../ui/Icon';

/** How many variants to show before collapsing the rest */
const VARIANTS_INITIAL = 5;

interface ProductCardProps {
    product: Producto;
    isStarred?: boolean;
    onEdit: () => void;
    onToggleStar?: () => void;
    onEditVariant: (variantId: number) => void;
    onDeleteVariant: (variantId: number, variantName: string) => void;
    onAddVariant: () => void;
    sabores?: PizzaSabor[];
    onEditSabor?: (sabor: PizzaSabor) => void;
    onAddSabor?: () => void;
    onDeleteSabor?: (saborId: number, name: string) => void;
}

function ProductCardImpl({
    product,
    isStarred = false,
    onEdit,
    onToggleStar,
    onEditVariant,
    onDeleteVariant,
    onAddVariant,
    sabores,
    onEditSabor,
    onAddSabor,
    onDeleteSabor,
}: ProductCardProps) {
    const isPizza = product.productoNombre.toLowerCase().includes('pizza');
    const totalVariants = product.variantes?.length ?? 0;
    const hasOverflow = totalVariants > VARIANTS_INITIAL;
    const [showAllVariants, setShowAllVariants] = useState(false);

    const visibleVariants = hasOverflow && !showAllVariants
        ? (product.variantes ?? []).slice(0, VARIANTS_INITIAL)
        : (product.variantes ?? []);

    return (
        <Card
            padding="none"
            className="overflow-hidden rounded-[40px]"
            style={{
                borderWidth: 1,
                borderColor: isStarred ? 'rgba(245,165,36,0.25)' : 'rgba(255,255,255,0.05)',
                backgroundColor: isStarred ? 'rgba(245,165,36,0.03)' : 'rgba(255,255,255,0.03)',
            }}
        >
            {/* ── Product header ──────────────────────────────────────────── */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    backgroundColor: isStarred ? 'rgba(245,165,36,0.06)' : 'rgba(255,255,255,0.03)',
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.05)',
                }}
            >
                {/* Left: emoji + name */}
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                    <View
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: 16,
                            backgroundColor: 'rgba(245,165,36,0.1)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                            borderWidth: 1,
                            borderColor: 'rgba(245,165,36,0.2)',
                        }}
                    >
                        <Text style={{ fontSize: 24 }}>{product.emoji || (isPizza ? '🍕' : '🍔')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text
                            className="text-white font-black text-base uppercase tracking-widest"
                            style={{ fontFamily: 'Space Grotesk' }}
                            numberOfLines={1}
                        >
                            {product.productoNombre}
                        </Text>
                        {product.descripcion ? (
                            <Text
                                className="text-slate-500 text-[10px] font-bold italic tracking-tighter"
                                numberOfLines={1}
                            >
                                {product.descripcion}
                            </Text>
                        ) : null}
                        {/* Variant count badge */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <View
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderRadius: 6,
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.08)',
                                }}
                            >
                                <Text style={{ color: '#64748B', fontSize: 8, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    {totalVariants} variante{totalVariants !== 1 ? 's' : ''}
                                </Text>
                            </View>
                            {!product.activo && (
                                <View
                                    style={{
                                        backgroundColor: 'rgba(239,68,68,0.1)',
                                        borderRadius: 6,
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderWidth: 1,
                                        borderColor: 'rgba(239,68,68,0.2)',
                                    }}
                                >
                                    <Text style={{ color: '#EF4444', fontSize: 8, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
                                        Inactivo
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Right: star + edit */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {/* Star / Picstar button */}
                    {onToggleStar && (
                        <TouchableOpacity
                            onPress={onToggleStar}
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 16,
                                backgroundColor: isStarred ? 'rgba(245,165,36,0.15)' : 'rgba(255,255,255,0.05)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: isStarred ? 'rgba(245,165,36,0.3)' : 'rgba(255,255,255,0.08)',
                            }}
                            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        >
                            <Icon
                                name={isStarred ? 'star' : 'star-outline'}
                                size={20}
                                color={isStarred ? '#F5A524' : '#475569'}
                            />
                        </TouchableOpacity>
                    )}

                    {/* Edit button */}
                    <TouchableOpacity
                        onPress={onEdit}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 16,
                            backgroundColor: 'rgba(245,165,36,0.1)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: 'rgba(245,165,36,0.2)',
                        }}
                    >
                        <Icon name="pencil-outline" size={18} color="#F5A524" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Variants ────────────────────────────────────────────────── */}
            <View style={{ padding: 12 }}>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        paddingHorizontal: 4,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name="format-list-bulleted-type" size={13} color="#64748B" />
                        <Text className="text-slate-500 font-black text-[10px] uppercase tracking-widest">
                            Presentaciones
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={onAddVariant}
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.08)',
                        }}
                    >
                        <Text style={{ color: '#F8FAFC', fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            + Agregar
                        </Text>
                    </TouchableOpacity>
                </View>

                {totalVariants === 0 && (
                    <View
                        style={{
                            alignItems: 'center',
                            padding: 20,
                            backgroundColor: 'rgba(255,255,255,0.02)',
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.04)',
                            borderStyle: 'dashed',
                            marginBottom: 8,
                        }}
                    >
                        <Icon name="plus-circle-outline" size={24} color="#1E293B" />
                        <Text style={{ color: '#475569', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', marginTop: 6, textTransform: 'uppercase' }}>
                            Sin variantes
                        </Text>
                    </View>
                )}

                <View style={{ gap: 4, marginBottom: 2 }}>
                    {visibleVariants.map((v) => (
                        <View
                            key={v.varianteId}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                paddingVertical: 7,
                                paddingHorizontal: 12,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.04)',
                            }}
                        >
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Text
                                        className="text-white font-black text-xs uppercase"
                                        numberOfLines={1}
                                        style={{ maxWidth: '65%' }}
                                    >
                                        {v.nombre}
                                    </Text>
                                    <View
                                        style={{
                                            width: 3,
                                            height: 3,
                                            borderRadius: 2,
                                            backgroundColor: '#334155',
                                        }}
                                    />
                                    <Text
                                        className="text-orange-400 font-black text-xs"
                                        style={{ fontFamily: 'Space Grotesk' }}
                                    >
                                        ${formatCurrency(v.precio)}
                                    </Text>
                                    {!v.activo && (
                                        <View
                                            style={{
                                                backgroundColor: 'rgba(239,68,68,0.1)',
                                                borderRadius: 4,
                                                paddingHorizontal: 4,
                                                borderWidth: 1,
                                                borderColor: 'rgba(239,68,68,0.2)',
                                            }}
                                        >
                                            <Text style={{ color: '#EF4444', fontSize: 7, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
                                                off
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                {v.descripcion ? (
                                    <Text
                                        className="text-slate-600 text-[9px] font-bold mt-0.5"
                                        numberOfLines={1}
                                    >
                                        {v.descripcion}
                                    </Text>
                                ) : null}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                <TouchableOpacity
                                    onPress={() => onEditVariant(v.varianteId)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 10,
                                        backgroundColor: 'rgba(255,255,255,0.04)',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.08)',
                                    }}
                                >
                                    <Icon name="pencil" size={13} color="#64748B" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => onDeleteVariant(v.varianteId, v.nombre)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 10,
                                        backgroundColor: 'rgba(239,68,68,0.08)',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 1,
                                        borderColor: 'rgba(239,68,68,0.15)',
                                    }}
                                >
                                    <Icon name="trash-can-outline" size={13} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Show more / show less toggle */}
                {hasOverflow && (
                    <TouchableOpacity
                        onPress={() => setShowAllVariants((s) => !s)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 10,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.06)',
                            backgroundColor: 'rgba(255,255,255,0.02)',
                            marginTop: 4,
                        }}
                    >
                        <Icon
                            name={showAllVariants ? 'chevron-up' : 'chevron-down'}
                            size={14}
                            color="#64748B"
                        />
                        <Text style={{ color: '#64748B', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {showAllVariants
                                ? 'Ocultar variantes'
                                : `Ver todas (${totalVariants - VARIANTS_INITIAL} más)`}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Pizza Flavors Section ────────────────────────────────────── */}
            {isPizza && sabores && (
                <View
                    style={{
                        borderTopWidth: 1,
                        borderTopColor: 'rgba(255,255,255,0.05)',
                        padding: 12,
                        backgroundColor: 'rgba(245,165,36,0.03)',
                    }}
                >
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

export const ProductCard = React.memo(ProductCardImpl);

// ─── PizzaFlavorsSection ──────────────────────────────────────────────────────

const SABORES_INITIAL = 8;

function PizzaFlavorsSection({
    sabores,
    onEditSabor,
    onAddSabor,
    onDeleteSabor,
}: {
    sabores: PizzaSabor[];
    onEditSabor?: (sabor: PizzaSabor) => void;
    onAddSabor?: () => void;
    onDeleteSabor?: (saborId: number, name: string) => void;
}) {
    const tradicionales = sabores.filter((s) => s.tipo === 'tradicional' && s.activo);
    const especiales = sabores.filter((s) => s.tipo === 'especial' && s.activo);
    const [showAllTrad, setShowAllTrad] = useState(false);
    const [showAllEsp, setShowAllEsp] = useState(false);

    const visibleTrad = showAllTrad ? tradicionales : tradicionales.slice(0, SABORES_INITIAL);
    const visibleEsp = showAllEsp ? especiales : especiales.slice(0, SABORES_INITIAL);

    const config3Sabores = sabores.find(
        (s) => s.tipo === 'configuracion' && s.nombre === 'RECARGO_3_SABORES',
    );
    const extra3SaboresAmount = config3Sabores ? Number(config3Sabores.recargoGrande) : 3000;

    const renderChip = (sabor: PizzaSabor) => {
        const isEspecial = sabor.tipo === 'especial';
        return (
            <TouchableOpacity
                key={sabor.saborId}
                onPress={() => onEditSabor?.(sabor)}
                onLongPress={() => onDeleteSabor?.(sabor.saborId, sabor.nombre)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    minHeight: 36,
                    borderRadius: 10,
                    marginBottom: 6,
                    marginRight: 6,
                    borderWidth: 1,
                    backgroundColor: isEspecial ? 'rgba(245,165,36,0.08)' : 'rgba(255,255,255,0.04)',
                    borderColor: isEspecial ? 'rgba(245,165,36,0.25)' : 'rgba(255,255,255,0.08)',
                }}
            >
                {isEspecial && <Icon name="star" size={8} color="#FB923C" />}
                <Text
                    style={{
                        fontSize: 9,
                        fontFamily: 'SpaceGrotesk-Bold',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        color: isEspecial ? '#FB923C' : '#94A3B8',
                    }}
                    numberOfLines={1}
                >
                    {sabor.nombre}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="pizza-slice" size={13} color="#F5A524" />
                    <Text className="text-orange-400/80 font-black text-[10px] uppercase tracking-widest">
                        Sabores
                    </Text>
                </View>
                {onAddSabor && (
                    <TouchableOpacity
                        onPress={onAddSabor}
                        style={{
                            backgroundColor: 'rgba(245,165,36,0.1)',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: 'rgba(245,165,36,0.25)',
                        }}
                    >
                        <Text style={{ color: '#FB923C', fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
                            + Sabor
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Tradicionales */}
            <View style={{ marginBottom: 10 }}>
                <Text className="text-slate-600 text-[8px] font-black uppercase tracking-widest mb-2 ml-1">
                    Tradicionales ({tradicionales.length})
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {visibleTrad.map((s) => renderChip(s))}
                </View>
                {tradicionales.length > SABORES_INITIAL && (
                    <TouchableOpacity
                        onPress={() => setShowAllTrad((v) => !v)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
                    >
                        <Icon name={showAllTrad ? 'chevron-up' : 'chevron-down'} size={11} color="#475569" />
                        <Text style={{ color: '#475569', fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
                            {showAllTrad ? 'Ocultar' : `+${tradicionales.length - SABORES_INITIAL} más`}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Especiales */}
            <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <Icon name="star" size={8} color="rgba(249,115,22,0.4)" />
                    <Text className="text-orange-500/40 text-[8px] font-black uppercase tracking-widest">
                        Especialidades ({especiales.length})
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {visibleEsp.map((s) => renderChip(s))}
                </View>
                {especiales.length > SABORES_INITIAL && (
                    <TouchableOpacity
                        onPress={() => setShowAllEsp((v) => !v)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
                    >
                        <Icon name={showAllEsp ? 'chevron-up' : 'chevron-down'} size={11} color="#475569" />
                        <Text style={{ color: '#475569', fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
                            {showAllEsp ? 'Ocultar' : `+${especiales.length - SABORES_INITIAL} más`}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {config3Sabores && (
                <TouchableOpacity
                    onPress={() => onEditSabor?.(config3Sabores)}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        padding: 14,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.05)',
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 10,
                                backgroundColor: 'rgba(96,165,250,0.1)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(96,165,250,0.2)',
                            }}
                        >
                            <Icon name="information-outline" size={14} color="#60A5FA" />
                        </View>
                        <View>
                            <Text style={{ color: '#60A5FA', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Combinación 3 Sabores
                            </Text>
                            <Text style={{ color: '#475569', fontSize: 8, fontFamily: 'SpaceGrotesk-Bold' }}>
                                Recargo por unidad
                            </Text>
                        </View>
                    </View>
                    <Text style={{ fontFamily: 'Space Grotesk', color: '#F8FAFC', fontSize: 14, fontWeight: 'bold' }}>
                        +${formatCurrency(extra3SaboresAmount)}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
