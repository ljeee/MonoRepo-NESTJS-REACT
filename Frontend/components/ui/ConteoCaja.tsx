/**
 * Piezas del conteo de caja (arqueo) compartidas por Balance del día y Gastos:
 *  - `ConteoCajaGrid`: cuadrícula para ESCRIBIR cuántos billetes hay de cada denominación y las monedas.
 *  - `EstadoCajaLista`: lista de solo lectura con lo que hay en caja hoy.
 * Ambas usan un `DenominacionesMap`; las monedas sueltas van en la clave `'coins'` (valen su cantidad en pesos).
 * Para sumar/restar billetes con botones (cobros, cambio, ajustes) está `DenominacionCounter`.
 */
import React from 'react';
import { TextInput } from 'react-native';
import { View, Text } from '../../tw';
import { DENOMINACIONES_COP, formatCurrency } from '@/src/shared';
import type { DenominacionesMap } from '@/src/shared';

const ETIQUETA_CORTA = (valor: number) => `$${valor / 1000}K`;

interface ConteoCajaGridProps {
    value: DenominacionesMap;
    /** Una denominación (o 'coins') cambió: `cantidad` ya viene limpia (entero ≥ 0; en monedas, el monto). */
    onChangeValue: (clave: string, cantidad: number) => void;
}

function CeldaConteo({
    titulo,
    detalle,
    colorTitulo,
    colorSubtotal,
    valor,
    subtotal,
    onChange,
}: {
    titulo: string;
    detalle: string;
    colorTitulo: string;
    colorSubtotal: string;
    valor: number;
    subtotal: number;
    onChange: (cantidad: number) => void;
}) {
    return (
        <View className="w-[48%] md:w-[23%] bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
            <View className="flex-row justify-between items-center mb-1">
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: colorTitulo, fontSize: 11 }}>{titulo}</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', fontSize: 9 }}>{detalle}</Text>
            </View>
            <TextInput
                className="text-white bg-white/5 border border-white/10 rounded-lg text-center font-bold text-sm h-8 p-0"
                placeholder="0"
                placeholderTextColor="#475569"
                keyboardType="numeric"
                value={valor ? String(valor) : ''}
                onChangeText={(texto) => onChange(Number(texto.replace(/[^0-9]/g, '')) || 0)}
            />
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: colorSubtotal, fontSize: 9, textAlign: 'right', marginTop: 4 }}>
                ${formatCurrency(subtotal)}
            </Text>
        </View>
    );
}

export function ConteoCajaGrid({ value, onChangeValue }: ConteoCajaGridProps) {
    return (
        <View className="flex-row flex-wrap gap-2.5">
            {DENOMINACIONES_COP.map(({ valor }) => {
                const cantidad = value[String(valor)] ?? 0;
                return (
                    <CeldaConteo
                        key={valor}
                        titulo={ETIQUETA_CORTA(valor)}
                        detalle={`x ${valor / 1000}k`}
                        colorTitulo="#F8FAFC"
                        colorSubtotal="#94A3B8"
                        valor={cantidad}
                        subtotal={cantidad * valor}
                        onChange={(n) => onChangeValue(String(valor), n)}
                    />
                );
            })}
            <CeldaConteo
                titulo="Monedas"
                detalle="Monto total"
                colorTitulo="#F5A524"
                colorSubtotal="#F5A524"
                valor={value['coins'] ?? 0}
                subtotal={value['coins'] ?? 0}
                onChange={(n) => onChangeValue('coins', n)}
            />
        </View>
    );
}

/** Lo que hay en caja ahora (solo lectura): una fila por denominación con existencias, las monedas y un aviso si está vacía. */
export function EstadoCajaLista({ estado }: { estado?: DenominacionesMap | null }) {
    const monedas = estado?.['coins'] ?? 0;
    const vacia = !estado || Object.values(estado).every((v) => (v ?? 0) <= 0);
    return (
        <View className="gap-1.5">
            {DENOMINACIONES_COP.map(({ valor, tipo, label }) => {
                const cantidad = estado?.[String(valor)] ?? 0;
                if (cantidad === 0) return null;
                return (
                    <View key={valor} className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03]">
                        <View className="flex-row items-center gap-2">
                            <View className={`w-1.5 h-1.5 rounded-full ${tipo === 'billete' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                            <Text className="text-sm text-slate-300 w-20">{label}</Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            <Text className="text-slate-500 text-xs">×{cantidad}</Text>
                            <Text className="text-sm text-emerald-400 font-bold w-24 text-right">${formatCurrency(cantidad * valor)}</Text>
                        </View>
                    </View>
                );
            })}

            {monedas > 0 && (
                <View className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                    <View className="flex-row items-center gap-2">
                        <View className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        <Text className="text-sm text-slate-300 w-20">Monedas</Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                        <Text className="text-slate-500 text-xs">total</Text>
                        <Text className="text-sm text-yellow-400 font-bold w-24 text-right">${formatCurrency(monedas)}</Text>
                    </View>
                </View>
            )}

            {vacia && <Text className="text-slate-600 text-xs text-center py-2">Sin denominaciones en caja</Text>}
        </View>
    );
}
