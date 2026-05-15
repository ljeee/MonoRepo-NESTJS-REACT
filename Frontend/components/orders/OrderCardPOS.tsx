import React, { useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity } from 'react-native';
import { View, Text } from '../../tw';
import Icon from '../ui/Icon';
import type { Orden } from '@monorepo/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

type Novedad = {
    adds: number[];
    removes: string[];
    modifies: Record<number, 'qty' | 'flavor' | 'both'>;
    timestamp: number;
};

type Props = {
    item: Orden;
    clientName: string;
    novedad?: Novedad;
    patchLoading?: boolean;
    onPress: () => void;
    onEdit?: () => void;
    onPrint?: () => void;
    onComplete?: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getStripeColor = (estado?: string): string => {
    switch ((estado || '').toLowerCase()) {
        case 'pendiente':      return '#F5A524'; // amber
        case 'en preparación':
        case 'en_preparacion':
        case 'preparacion':    return '#06B6D4'; // cyan
        case 'lista':
        case 'list':           return '#22C55E'; // green
        case 'completada':
        case 'entregado':      return '#10B981'; // emerald
        case 'cancelado':      return '#EF4444'; // red
        default:               return '#475569'; // slate
    }
};

const getStatusLabel = (estado?: string): string => {
    switch ((estado || '').toLowerCase()) {
        case 'pendiente':      return 'PENDIENTE';
        case 'en preparación':
        case 'en_preparacion':
        case 'preparacion':    return 'EN PREPARACIÓN';
        case 'lista':          return 'LISTA';
        case 'completada':     return 'COMPLETADA';
        case 'entregado':      return 'ENTREGADO';
        case 'cancelado':      return 'CANCELADO';
        default:               return (estado || '').toUpperCase();
    }
};

const getStatusBg = (estado?: string): string => {
    switch ((estado || '').toLowerCase()) {
        case 'pendiente':      return 'rgba(245,165,36,0.15)';
        case 'en preparación':
        case 'en_preparacion':
        case 'preparacion':    return 'rgba(6,182,212,0.15)';
        case 'lista':          return 'rgba(34,197,94,0.15)';
        case 'completada':
        case 'entregado':      return 'rgba(16,185,129,0.15)';
        case 'cancelado':      return 'rgba(239,68,68,0.15)';
        default:               return 'rgba(71,85,105,0.15)';
    }
};

const getTipoIcon = (tipo?: string) => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('domicilio')) return { icon: 'motorbike' as const, color: '#F5A524' };
    if (t.includes('llevar'))    return { icon: 'bag-personal-outline' as const, color: '#60A5FA' };
    return                              { icon: 'table-furniture' as const, color: '#94A3B8' };
};

const formatHora = (fecha: string | Date): string =>
    new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

const formatTotal = (total?: number | null): string =>
    total != null ? `$${Number(total).toLocaleString('es-CO')}` : '';

// ── Circular mini-timer ────────────────────────────────────────────────────────

function MiniTimer({ fechaOrden, estado }: { fechaOrden: string | Date; estado?: string }) {
    const [mins, setMins] = useState(() =>
        Math.max(0, Math.floor((Date.now() - new Date(fechaOrden).getTime()) / 60000))
    );

    useEffect(() => {
        const iv = setInterval(() => {
            setMins(Math.max(0, Math.floor((Date.now() - new Date(fechaOrden).getTime()) / 60000)));
        }, 30000);
        return () => clearInterval(iv);
    }, [fechaOrden]);

    let color = '#3B82F6';
    if (estado !== 'pendiente') color = '#10B981';
    else if (mins >= 30) color = '#EF4444';
    else if (mins >= 20) color = '#EAB308';
    else if (mins >= 5)  color = '#22C55E';

    const SIZE = 44;
    const STROKE = 3.5;
    return (
        <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: STROKE, borderColor: color, backgroundColor: `${color}1A`, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color, fontSize: 13, fontFamily: 'SpaceGrotesk-Bold', lineHeight: 14 }}>
                {mins > 0 ? mins : '<1'}
            </Text>
            <Text style={{ color, fontSize: 6, fontFamily: 'Outfit', opacity: 0.8, letterSpacing: 0.5 }}>
                MIN
            </Text>
        </View>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

function OrderCardPOS({
    item, clientName, novedad, patchLoading,
    onPress, onEdit, onPrint, onComplete,
}: Props) {
    const stripeColor = getStripeColor(item.estadoOrden);
    const statusLabel = getStatusLabel(item.estadoOrden);
    const statusBg    = getStatusBg(item.estadoOrden);
    const tipoInfo    = getTipoIcon(item.tipoPedido);
    const horaOrden   = formatHora(item.fechaOrden);
    const totalStr    = formatTotal(item.factura?.total);
    const canComplete = item.estadoOrden !== 'completada' && item.estadoOrden !== 'cancelado' && item.estadoOrden !== 'entregado';

    const hasObs = !!(item.observaciones?.trim());
    const isWarn = item.observaciones?.toLowerCase().includes('alergia') ||
                   item.observaciones?.toLowerCase().includes('sin ') ||
                   item.observaciones?.toLowerCase().includes('no ');

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={{
                borderRadius: 14, overflow: 'hidden',
                backgroundColor: '#080B14',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                marginBottom: 0,
            }}
        >
            {/* ── Left stripe ─────────────────────────────────────────────── */}
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: stripeColor }} />

            {/* ── Header ──────────────────────────────────────────────────── */}
            <View style={{ paddingLeft: 14, paddingRight: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>

                    {/* Left: icon + name + meta */}
                    <View style={{ flex: 1, paddingRight: 8 }}>
                        {/* Icon + Name row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                            <View style={{
                                width: 28, height: 28, borderRadius: 8,
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                            }}>
                                <Icon name={tipoInfo.icon} size={14} color={tipoInfo.color} />
                            </View>
                            <Text numberOfLines={1} style={{ color: '#F8FAFC', fontSize: 15, fontFamily: 'SpaceGrotesk-Bold', flex: 1 }}>
                                {clientName}
                            </Text>
                        </View>

                        {/* ID + hora */}
                        <Text style={{ color: '#64748B', fontSize: 10, fontFamily: 'Outfit', marginBottom: 6 }}>
                            #{item.ordenId} · {horaOrden}
                        </Text>

                        {/* Status badge */}
                        <View style={{ flexDirection: 'row', alignSelf: 'flex-start' }}>
                            <View style={{
                                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
                                backgroundColor: statusBg,
                                borderWidth: 1, borderColor: stripeColor + '40',
                            }}>
                                <Text style={{ color: stripeColor, fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', letterSpacing: 0.8 }}>
                                    {statusLabel}
                                </Text>
                            </View>
                        </View>

                        {/* Address for domicilio */}
                        {item.tipoPedido === 'domicilio' && item.domicilios?.[0]?.direccionEntrega && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                                <Icon name="map-marker-outline" size={11} color="#94A3B8" />
                                <Text numberOfLines={1} style={{ color: '#94A3B8', fontSize: 11, fontFamily: 'Outfit', flex: 1 }}>
                                    {item.domicilios[0].direccionEntrega}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Right: timer */}
                    <MiniTimer fechaOrden={item.fechaOrden} estado={item.estadoOrden} />
                </View>
            </View>

            {/* ── Products ────────────────────────────────────────────────── */}
            {item.productos && item.productos.length > 0 && (
                <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, gap: 5 }}>
                    {item.productos.slice(0, 5).map((prod) => {
                        const isNew  = novedad?.adds?.includes(prod.id!);
                        const modType = novedad?.modifies?.[prod.id!];
                        const nameColor = isNew ? '#4ADE80' : modType ? '#FBBF24' : '#CBD5E1';

                        return (
                            <View key={prod.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                                {/* ×qty badge */}
                                <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 12, lineHeight: 18, minWidth: 24 }}>
                                    ×{prod.cantidad}
                                </Text>
                                <View style={{ flex: 1 }}>
                                    <Text numberOfLines={2} style={{ color: nameColor, fontSize: 12, fontFamily: 'Outfit', lineHeight: 17 }}>
                                        {prod.producto}
                                    </Text>
                                </View>
                                {isNew && (
                                    <View style={{ backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }}>
                                        <Text style={{ color: '#4ADE80', fontSize: 7, fontFamily: 'SpaceGrotesk-Bold' }}>NUEVO</Text>
                                    </View>
                                )}
                                {modType && (
                                    <View style={{ backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' }}>
                                        <Text style={{ color: '#FBBF24', fontSize: 7, fontFamily: 'SpaceGrotesk-Bold' }}>EDIT</Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                    {novedad?.removes?.map((remName, idx) => (
                        <View key={`rem-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Icon name="close" size={12} color="#EF4444" />
                            <Text numberOfLines={1} style={{ color: '#F87171', fontSize: 11, fontFamily: 'Outfit', flex: 1, textDecorationLine: 'line-through' }}>{remName}</Text>
                        </View>
                    ))}
                    {item.productos.length > 5 && (
                        <Text style={{ color: '#475569', fontSize: 10, fontStyle: 'italic', fontFamily: 'Outfit' }}>
                            + {item.productos.length - 5} más...
                        </Text>
                    )}
                </View>
            )}

            {/* ── Observaciones ───────────────────────────────────────────── */}
            {hasObs && (
                <View style={{
                    marginHorizontal: 10, marginTop: 6,
                    paddingHorizontal: 10, paddingVertical: 7,
                    borderRadius: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 6,
                    backgroundColor: isWarn ? 'rgba(239,68,68,0.08)' : 'rgba(245,165,36,0.10)',
                    borderWidth: 1, borderColor: isWarn ? 'rgba(239,68,68,0.25)' : 'rgba(245,165,36,0.25)',
                }}>
                    <Icon name={isWarn ? 'alert-circle-outline' : 'note-text-outline'} size={12} color={isWarn ? '#F87171' : '#FBBF24'} />
                    <Text numberOfLines={2} style={{ flex: 1, fontSize: 11, fontFamily: 'Outfit', fontStyle: 'italic', color: isWarn ? '#FCA5A5' : '#FDE68A', lineHeight: 15 }}>
                        {item.observaciones}
                    </Text>
                </View>
            )}

            {/* ── Footer: total + actions ──────────────────────────────────── */}
            <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 14, paddingVertical: 10,
                marginTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
            }}>
                {/* Total */}
                <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 15 }}>
                    {totalStr}
                </Text>

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                    {onEdit && (
                        <TouchableOpacity
                            onPress={onEdit}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(245,165,36,0.10)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,165,36,0.2)' }}
                        >
                            <Icon name="pencil" size={14} color="#F5A524" />
                        </TouchableOpacity>
                    )}
                    {onPrint && (
                        <TouchableOpacity
                            onPress={onPrint}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(59,130,246,0.10)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}
                        >
                            <Icon name="printer" size={14} color="#3B82F6" />
                        </TouchableOpacity>
                    )}
                    {canComplete && onComplete && (
                        <TouchableOpacity
                            onPress={onComplete}
                            disabled={patchLoading}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', opacity: patchLoading ? 0.5 : 1 }}
                        >
                            {patchLoading ? (
                                <ActivityIndicator size="small" color="#10B981" />
                            ) : (
                                <Icon name="check" size={16} color="#10B981" />
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

export default React.memo(OrderCardPOS);
