import React, { useState } from 'react';
import type { Producto, PizzaSabor, SaborGrupo } from '@/src/shared';
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
    /** Grupo de sabores del producto (null/undefined = el producto no lleva sabores). */
    grupo?: SaborGrupo;
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
    grupo,
    sabores,
    onEditSabor,
    onAddSabor,
    onDeleteSabor,
}: ProductCardProps) {
    const conSabores = !!grupo;
    const totalVariants = product.variantes?.length ?? 0;
    const hasOverflow = totalVariants > VARIANTS_INITIAL;
    const [showAllVariants, setShowAllVariants] = useState(false);

    const visibleVariants = hasOverflow && !showAllVariants
        ? (product.variantes ?? []).slice(0, VARIANTS_INITIAL)
        : (product.variantes ?? []);

    return (
        <Card
            padding="none"
            className="overflow-hidden"
            // Radio, fondo y borde salen de <Card> (misma receta que el resto); solo el destacado se tiñe de ámbar.
            style={isStarred ? { borderColor: 'rgba(245,165,36,0.25)', backgroundColor: 'rgba(245,165,36,0.03)' } : undefined}
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
                        <Text style={{ fontSize: 24 }}>{product.emoji || (conSabores ? '🍕' : '🍔')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text
                            className="text-white font-black text-base uppercase tracking-widest"
                            style={{ fontFamily: 'SpaceGrotesk-Bold' }}
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
                                <Text style={{ color: '#7C8BA1', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
                                    <Text style={{ color: '#EF4444', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
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
                                color={isStarred ? '#F5A524' : '#7C8BA1'}
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
                        <Text style={{ color: '#F8FAFC', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
                        <Icon name="plus-circle-outline" size={24} color="#64748B" />
                        <Text style={{ color: '#7C8BA1', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', marginTop: 6, textTransform: 'uppercase' }}>
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
                                        style={{ fontFamily: 'SpaceGrotesk-Bold' }}
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
                                            <Text style={{ color: '#EF4444', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
                                                off
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                {v.descripcion ? (
                                    <Text
                                        className="text-slate-400 text-[10px] font-bold mt-0.5"
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
                                        width: 36,
                                        height: 36,
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
                                        width: 36,
                                        height: 36,
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
                        <Text style={{ color: '#7C8BA1', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {showAllVariants
                                ? 'Ocultar variantes'
                                : `Ver todas (${totalVariants - VARIANTS_INITIAL} más)`}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Sabores del grupo ────────────────────────────────────── */}
            {grupo && sabores && (
                <View
                    style={{
                        borderTopWidth: 1,
                        borderTopColor: 'rgba(255,255,255,0.05)',
                        padding: 12,
                        backgroundColor: 'rgba(245,165,36,0.03)',
                    }}
                >
                    <SaboresSection
                        grupo={grupo}
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

/** Texto corto de la regla de recargo por cantidad: "Desde 3 sabores +$3.000" (o el rango si hay tamaños). */
function reglaExtra(grupo: SaborGrupo): string | null {
    if (grupo.recargoExtraDesde == null) return null;
    const montos = grupo.usaTamano
        ? [grupo.recargoExtraPequena, grupo.recargoExtraMediana, grupo.recargoExtraGrande].map(Number)
        : [Number(grupo.recargoExtraGrande)];
    const min = Math.min(...montos);
    const max = Math.max(...montos);
    const texto = min === max ? `+$${formatCurrency(max)}` : `+$${formatCurrency(min)} a $${formatCurrency(max)}`;
    return `Desde ${grupo.recargoExtraDesde} sabores ${texto}`;
}

function SaboresSection({
    grupo,
    sabores,
    onEditSabor,
    onAddSabor,
    onDeleteSabor,
}: {
    grupo: SaborGrupo;
    sabores: PizzaSabor[];
    onEditSabor?: (sabor: PizzaSabor) => void;
    onAddSabor?: () => void;
    onDeleteSabor?: (saborId: number, name: string) => void;
}) {
    const activos = sabores.filter((s) => s.activo);
    const [showAll, setShowAll] = useState(false);
    const visibles = showAll ? activos : activos.slice(0, SABORES_INITIAL);
    const extra = reglaExtra(grupo);

    const cobraRecargo = (s: PizzaSabor) =>
        [s.recargoPequena, s.recargoMediana, s.recargoGrande].some((r) => Number(r) > 0);

    const renderChip = (sabor: PizzaSabor) => {
        const conRecargo = cobraRecargo(sabor);
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
                    backgroundColor: conRecargo ? 'rgba(245,165,36,0.08)' : 'rgba(255,255,255,0.04)',
                    borderColor: conRecargo ? 'rgba(245,165,36,0.25)' : 'rgba(255,255,255,0.08)',
                }}
            >
                {conRecargo && <Icon name="star" size={10} color="#FB923C" />}
                <Text
                    style={{
                        fontSize: 10,
                        fontFamily: 'SpaceGrotesk-Bold',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        color: conRecargo ? '#FB923C' : '#94A3B8',
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
                        Sabores · {grupo.nombre} ({activos.length})
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
                        <Text style={{ color: '#FB923C', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
                            + Sabor
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {visibles.map((s) => renderChip(s))}
                </View>
                {activos.length > SABORES_INITIAL && (
                    <TouchableOpacity
                        onPress={() => setShowAll((v) => !v)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
                    >
                        <Icon name={showAll ? 'chevron-up' : 'chevron-down'} size={11} color="#7C8BA1" />
                        <Text style={{ color: '#7C8BA1', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
                            {showAll ? 'Ocultar' : `+${activos.length - SABORES_INITIAL} más`}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {extra && (
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        padding: 14,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.05)',
                    }}
                >
                    <Icon name="information-outline" size={14} color="#60A5FA" />
                    <Text style={{ color: '#60A5FA', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {extra}
                    </Text>
                </View>
            )}
        </View>
    );
}
