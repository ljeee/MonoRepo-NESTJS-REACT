import React from 'react';
import { View, Text, TouchableOpacity } from '../../tw';
import Icon from '../ui/Icon';
import type { Orden } from '@monorepo/shared';

type Props = {
    orden: Orden;
    onPress?: () => void;
    onListo?: () => void;
};

const getProductoName = (p: any) => {
    return p.productoNombre || p.producto || 'Producto';
};

const getTipoPedidoInfo = (tipo?: string) => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('domicilio')) return { label: 'DOMICILIO', icon: 'motorbike' as const, color: '#F5A524', bg: 'bg-amber-500/15', border: 'border-amber-500/30', accent: 'bg-amber-500' };
    if (t.includes('llevar') || t.includes('para llevar')) return { label: 'PARA LLEVAR', icon: 'bag-personal-outline' as const, color: '#8B5CF6', bg: 'bg-violet-500/15', border: 'border-violet-500/30', accent: 'bg-violet-500' };
    return { label: tipo ? tipo.toUpperCase() : 'MESA', icon: 'silverware-fork-knife' as const, color: '#64748B', bg: 'bg-slate-700/30', border: 'border-slate-600/30', accent: 'bg-slate-500' };
};

const getAccentColor = (estado?: string) => {
    if (estado === 'pendiente') return 'bg-orange-500';
    if (estado === 'completada' || estado === 'entregado') return 'bg-emerald-500';
    return 'bg-slate-500';
};

export default function OrderCardKDS({ orden, onPress, onListo }: Props) {
    const tipoInfo = getTipoPedidoInfo(orden.tipoPedido);
    const accentColor = getAccentColor(orden.estadoOrden);

    const diffMins = Math.max(0, Math.floor((new Date().getTime() - new Date(orden.fechaOrden).getTime()) / 60000));
    const isUrgente = diffMins >= 15 && orden.estadoOrden === 'pendiente';

    const displayName = orden.nombreCliente?.trim() ||
        (orden.tipoPedido?.toLowerCase() === 'mesa' ? `Mesa ${orden.mesa || ''}` : 'Sin nombre');

    const hasNotas = !!(orden.observaciones?.trim());
    const hasWarnings = orden.observaciones?.toLowerCase().includes('alergia') ||
        orden.observaciones?.toLowerCase().includes('sin ') ||
        orden.observaciones?.toLowerCase().includes('no ');

    return (
        <View className="rounded-2xl overflow-hidden border border-white/8 bg-[#0F1A2E] shadow-xl shadow-black/60 flex-1">
            {/* Accent bar left */}
            <View className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />

            {/* Header */}
            <View className="pl-4 pr-4 pt-4 pb-3 border-b border-white/5">
                <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-3">
                        {/* Tipo badge */}
                        <View className={`flex-row items-center gap-1.5 mb-2 self-start px-2 py-1 rounded-lg ${tipoInfo.bg} border ${tipoInfo.border}`}>
                            <Icon name={tipoInfo.icon} size={12} color={tipoInfo.color} />
                            <Text style={{ color: tipoInfo.color }} className="text-[10px] font-black uppercase tracking-widest">
                                {tipoInfo.label}
                            </Text>
                        </View>
                        {/* Client name */}
                        <Text className="text-white font-black text-lg uppercase leading-tight" numberOfLines={1}>
                            {displayName}
                        </Text>
                    </View>

                    {/* Timer + Orden ID */}
                    <View className="items-end gap-1">
                        <Text className="text-[#F5A524] font-black text-xs">#{orden.ordenId}</Text>
                        <View className={`flex-row items-center gap-1 px-2 py-1 rounded-lg ${
                            isUrgente ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/5'
                        }`}>
                            <Icon name="clock-outline" size={12} color={isUrgente ? '#F87171' : '#64748B'} />
                            <Text className={`font-black text-xs ${
                                isUrgente ? 'text-red-400' : 'text-slate-400'
                            }`}>{diffMins > 0 ? `${diffMins}m` : '<1m'}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Notas */}
            {hasNotas && (
                <View className={`mx-3 mt-3 px-3 py-2 rounded-xl flex-row items-start gap-2 ${
                    hasWarnings ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'
                }`}>
                    <Icon
                        name={hasWarnings ? 'alert-circle-outline' : 'note-text-outline'}
                        size={14}
                        color={hasWarnings ? '#F87171' : '#FBBF24'}
                    />
                    <Text className={`text-xs font-bold flex-1 leading-relaxed italic ${
                        hasWarnings ? 'text-red-300' : 'text-amber-300'
                    }`} numberOfLines={3}>
                        "{orden.observaciones}"
                    </Text>
                </View>
            )}

            {/* Products */}
            <View className="px-4 pt-3 pb-2 gap-2">
                <Text className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Productos</Text>
                {orden.productos?.map((p: any, idx: number) => (
                    <View key={idx} className="flex-row items-center gap-3">
                        <View className="bg-[#F5A524]/20 border border-[#F5A524]/30 rounded-lg px-2 py-1 min-w-[32px] items-center">
                            <Text className="text-[#F5A524] font-black text-sm leading-none">{p.cantidad}</Text>
                        </View>
                        <Text className="flex-1 text-slate-200 text-sm font-bold" numberOfLines={2}>
                            {getProductoName(p)}
                        </Text>
                    </View>
                ))}
                {!orden.productos?.length && (
                    <Text className="text-slate-500 italic text-xs">Sin productos cargados</Text>
                )}
            </View>

            {/* LISTO button */}
            <TouchableOpacity
                onPress={onListo || onPress}
                activeOpacity={0.75}
                className="mx-3 mb-3 mt-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl py-3 flex-row items-center justify-center gap-2"
            >
                <Icon name="check-circle-outline" size={16} color="#10B981" />
                <Text className="text-emerald-400 font-black text-xs uppercase tracking-widest">✓ Listo</Text>
            </TouchableOpacity>
        </View>
    );
}
