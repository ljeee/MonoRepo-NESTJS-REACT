/**
 * BillCounter — contador de billetes/monedas para denominaciones COP.
 * Usado en PaymentSelectionModal (billetes recibidos y cambio a entregar)
 * y en el formulario de gastos (facturas-pagos).
 */
import React from 'react';
import { View, Text, TouchableOpacity } from '../../tw';
import Icon from './Icon';
import { formatCurrency } from '@/src/shared';

export const COLOMBIAN_BILLS = [200000, 100000, 50000, 20000, 10000, 5000, 2000] as const;

export interface BillCounterProps {
    bill: number;
    count: number;
    onChange: (newCount: number) => void;
    /** Cuántos hay disponibles en la caja — se muestra como badge y limita el máximo si limitByStock=true */
    enCaja?: number;
    /** Si true, no permite seleccionar más del stock disponible en caja */
    limitByStock?: boolean;
    /**
     * 'received' → verde (billetes que entran: cobro de cliente)
     * 'change'   → ámbar (billetes que salen como cambio)
     * 'expense'  → ámbar/rojo (billetes que salen para pagar un gasto)
     */
    variant?: 'received' | 'change' | 'expense';
}

export function BillCounter({
    bill,
    count,
    onChange,
    enCaja,
    limitByStock = false,
    variant = 'received',
}: BillCounterProps) {
    const subtotal = count * bill;
    const isAmber   = variant === 'change' || variant === 'expense';
    const activeColor  = isAmber ? '#F5A524' : '#10B981';
    const activeBg     = isAmber ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20';
    const subtotalCls  = isAmber ? 'text-amber-400' : 'text-emerald-400';
    const hasStock     = enCaja !== undefined && enCaja > 0;
    const atMax        = limitByStock && enCaja !== undefined && count >= enCaja;

    const handleInc = () => {
        if (atMax) return;
        onChange(count + 1);
    };

    const handleDec = () => {
        if (count === 0) return;
        onChange(Math.max(0, count - 1));
    };

    return (
        <View className={`flex-row items-center rounded-lg px-2.5 py-1.5 border ${count > 0 ? activeBg : 'bg-white/[0.03] border-white/5'}`}>
            {/* Label + en-caja badge + subtotal */}
            <View className="flex-1 flex-row items-center gap-1.5 flex-wrap">
                <Text
                    style={{ fontFamily: 'SpaceGrotesk-Bold', minWidth: 60 }}
                    className={`text-xs font-black ${count > 0 ? 'text-white' : 'text-slate-400'}`}
                >
                    ${formatCurrency(bill)}
                </Text>
                {enCaja !== undefined && (
                    <View className={`px-1 py-0.5 rounded ${hasStock ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-white/5'}`}>
                        <Text className={`text-[8px] font-black ${hasStock ? 'text-emerald-400' : 'text-slate-600'}`}>
                            {enCaja} ↓
                        </Text>
                    </View>
                )}
                {count > 0 && (
                    <Text className={`${subtotalCls} text-[9px] font-bold`}>
                        =${formatCurrency(subtotal)}
                    </Text>
                )}
            </View>

            {/* Counter controls */}
            <View className="flex-row items-center gap-1.5">
                <TouchableOpacity
                    onPress={handleDec}
                    disabled={count === 0}
                    className={`w-7 h-7 rounded-lg items-center justify-center border ${
                        count > 0 ? 'bg-white/10 border-white/10' : 'bg-white/[0.03] border-white/5 opacity-30'
                    }`}
                >
                    <Icon name="minus" size={12} color={count > 0 ? '#94A3B8' : '#475569'} />
                </TouchableOpacity>

                <Text
                    style={{ fontFamily: 'SpaceGrotesk-Bold', minWidth: 22, textAlign: 'center' }}
                    className={`font-black text-sm ${count > 0 ? 'text-white' : 'text-slate-600'}`}
                >
                    {count}
                </Text>

                <TouchableOpacity
                    onPress={handleInc}
                    disabled={atMax}
                    style={{ backgroundColor: `${activeColor}1A`, borderWidth: 1, borderColor: `${activeColor}33`, opacity: atMax ? 0.3 : 1 }}
                    className="w-7 h-7 rounded-lg items-center justify-center"
                >
                    <Icon name="plus" size={12} color={activeColor} />
                </TouchableOpacity>
            </View>
        </View>
    );
}
