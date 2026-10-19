/**
 * DenominacionCounter — único formulario de conteo de billetes COP (una fila `BillCounter` por denominación).
 * Lo usan el cobro/cambio (`PaymentSelectionModal`), el gasto en efectivo (`facturas-pagos`) y los ajustes de
 * caja (`AjusteCajaModal`). El valor es un `DenominacionesMap` ({"50000": 2, …}); las cantidades en 0 se quitan.
 * Las monedas sueltas son opcionales (campo de monto libre) y, si se piden, se muestra el total.
 */
import React from 'react';
import { TextInput } from 'react-native';
import { View, Text } from '../../tw';
import { BillCounter } from './BillCounter';
import type { BillCounterProps } from './BillCounter';
import { BILLETES_COP, formatCurrency, sumDenominaciones } from '@/src/shared';
import type { DenominacionesMap } from '@/src/shared';

export interface DenominacionCounterProps {
    value: DenominacionesMap;
    onChange: (map: DenominacionesMap) => void;
    /** Billetes en caja: se muestran como badge en cada fila. Sin esto no hay badge ni límite. */
    disponible?: DenominacionesMap | null;
    /** Con `disponible`, no deja subir una cantidad por encima de lo que hay en caja. */
    limitarPorDisponible?: boolean;
    /** Denominaciones a mostrar (por defecto todas, de mayor a menor). */
    denominaciones?: number[];
    variant?: BillCounterProps['variant'];
    titulo?: string;
    /** Con `onMonedasChange` aparece el campo de monedas y el total en efectivo. */
    monedas?: string;
    onMonedasChange?: (valor: string) => void;
}

export function DenominacionCounter({
    value,
    onChange,
    disponible,
    limitarPorDisponible = false,
    denominaciones = BILLETES_COP,
    variant = 'received',
    titulo,
    monedas,
    onMonedasChange,
}: DenominacionCounterProps) {
    const fijar = (billete: number, cantidad: number) => {
        const siguiente = { ...value };
        if (cantidad <= 0) delete siguiente[String(billete)];
        else siguiente[String(billete)] = cantidad;
        onChange(siguiente);
    };

    return (
        <View className="gap-1">
            {titulo ? (
                <Text className="text-xs font-bold text-(--color-pos-text-muted) mb-1 uppercase tracking-widest">{titulo}</Text>
            ) : null}

            {denominaciones.map((billete) => (
                <BillCounter
                    key={billete}
                    bill={billete}
                    count={value[String(billete)] ?? 0}
                    onChange={(n) => fijar(billete, n)}
                    enCaja={disponible ? (disponible[String(billete)] ?? 0) : undefined}
                    limitByStock={limitarPorDisponible && !!disponible}
                    variant={variant}
                />
            ))}

            {onMonedasChange !== undefined && (
                <>
                    <View className="flex-row items-center justify-between px-3 py-2.5 mt-1 rounded-xl bg-white/5">
                        <Text className="text-sm font-bold text-(--color-pos-text)">Monedas</Text>
                        <View className="flex-row items-center gap-2">
                            <Text className="text-slate-400 text-sm">$</Text>
                            <TextInput
                                keyboardType="numeric"
                                value={monedas ?? ''}
                                onChangeText={(t) => onMonedasChange(t.replace(/[^0-9]/g, ''))}
                                placeholder="0"
                                placeholderTextColor="#475569"
                                style={{ color: '#FFFFFF', minWidth: 80, textAlign: 'right', fontSize: 14, fontWeight: 'bold' }}
                            />
                        </View>
                    </View>
                    <View className="flex-row justify-between items-center px-3 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                        <Text className="text-sm font-semibold text-orange-300">Total en efectivo</Text>
                        <Text className="text-base font-bold text-orange-400">{formatCurrency(sumDenominaciones(value, monedas))}</Text>
                    </View>
                </>
            )}
        </View>
    );
}
