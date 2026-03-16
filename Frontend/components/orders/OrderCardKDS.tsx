import React from 'react';
import { View, Text, TouchableOpacity } from '../../tw';
import Icon from '../ui/Icon';
import type { Orden } from '@monorepo/shared';

type Props = {
    orden: Orden;
    onPress?: () => void;
};

// Map order states to KDS header colors
const getKdsHeaderColor = (estado?: string, tipo?: string) => {
    // Red -> Delayed / Urgent (Or pending for more than X mins? We just map logic here)
    if (estado === 'pendiente') return 'bg-red-600'; 
    // Yellow -> Delivery / Rappi
    if (tipo?.toLowerCase()?.includes('domicilio') || tipo?.toLowerCase()?.includes('rappi')) return 'bg-amber-500';
    // Blue -> Standard / Dine-in
    return 'bg-slate-700';
};

const getKdsTextColor = (estado?: string, tipo?: string) => {
    if (estado === 'pendiente') return 'text-white';
    if (tipo?.toLowerCase()?.includes('domicilio') || tipo?.toLowerCase()?.includes('rappi')) return 'text-slate-900';
    return 'text-white';
};

const getProductoName = (p: any) => {
    return p.productoNombre || p.producto || 'Producto';
};

export default function OrderCardKDS({ orden, onPress }: Props) {
    const headerBg = getKdsHeaderColor(orden.estadoOrden, orden.tipoPedido);
    const headerText = getKdsTextColor(orden.estadoOrden, orden.tipoPedido);
    
    // Fake timer for demo according to KDS UI, in real app would calculate diff from orden.fechaOrden
    const diffMins = Math.floor((new Date().getTime() - new Date(orden.fechaOrden).getTime()) / 60000);
    const timeStr = diffMins > 0 ? `${diffMins}m` : '1m';

    // Subheader Logic
    let iconName: any = 'silverware-fork-knife';
    let subHeaderText = orden.observaciones || `MESA ${orden.mesa || 'LOCAL'}`;
    
    if (orden.tipoPedido?.toLowerCase().includes('domicilio')) {
        iconName = 'motorbike';
        subHeaderText = `DOMICILIO - ${orden.nombreCliente || 'General'}`;
    }

    // Checking for allergy or special instructions
    const hasWarnings = orden.observaciones?.toLowerCase().includes('alergia') || orden.observaciones?.toLowerCase().includes('sin') || orden.observaciones?.toLowerCase().includes('no');
    
    return (
        <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={onPress}
            className="rounded-xl overflow-hidden border border-white/5 bg-(--color-pos-surface) flex-1 shadow-lg shadow-black/50"
        >
            {/* Colored Header */}
            <View className={`${headerBg} px-4 py-3 flex-row justify-between items-center`}>
                <Text className={`text-xl font-black ${headerText}`}>#{orden.ordenId}</Text>
                <View className="flex-row items-center">
                    <Icon name="clock-outline" size={16} color={headerText === 'text-white' ? '#FFFFFF' : '#0F172A'} />
                    <Text className={`ml-1 font-bold ${headerText}`}>{timeStr}</Text>
                </View>
            </View>

            {/* Body */}
            <View className="p-4 bg-slate-900 flex-1">
                {/* Subheader */}
                <View className="flex-row items-center border-b border-white/10 pb-3 mb-3">
                    <Icon name={iconName} size={18} color="#94A3B8" />
                    <Text className="ml-2 text-sm font-bold text-slate-300 uppercase truncate" numberOfLines={1}>
                        {subHeaderText}
                    </Text>
                </View>

                {/* Items */}
                <View className="gap-3">
                    {orden.productos?.map((p, idx) => (
                        <View key={idx} className="flex-row items-start">
                            <View className="bg-white/10 rounded px-2 py-1 mr-3 min-w-[32px] items-center">
                                <Text className="text-white font-black text-lg leading-none">{p.cantidad}</Text>
                            </View>
                            <Text className="flex-1 text-slate-200 text-base font-medium leading-tight pt-1">
                                {getProductoName(p)}
                            </Text>
                        </View>
                    ))}
                    {!orden.productos?.length && (
                        <Text className="text-slate-500 italic">Sin productos cargados</Text>
                    )}
                </View>
            </View>

            {/* Warning Footer */}
            {(orden.observaciones && orden.observaciones.length > 0) && (
                <View className={`px-4 py-3 border-t flex-row items-center ${hasWarnings ? 'bg-red-950/80 border-red-900/50' : 'bg-amber-950/80 border-amber-900/50'}`}>
                    <Icon name="alert-triangle" size={16} color={hasWarnings ? '#F87171' : '#FBBF24'} />
                    <Text className={`ml-2 text-xs font-bold uppercase flex-1 ${hasWarnings ? 'text-red-400' : 'text-amber-400'}`} numberOfLines={2}>
                        {orden.observaciones}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}
