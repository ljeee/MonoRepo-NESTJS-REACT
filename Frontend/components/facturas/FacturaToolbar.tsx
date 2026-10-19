import React from 'react';
import { View, Text, TouchableOpacity } from '../../tw';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { MethodFilterChips } from '../ui/MethodFilterChips';
import type { MethodFilterChipsProps } from '../ui/MethodFilterChips';
import { SearchInput } from '../ui/SearchInput';

export interface FacturaToolbarProps {
    /** Chips de método de pago (con conteos). Sin esto no se muestran. */
    metodo?: Pick<MethodFilterChipsProps, 'value' | 'onChange' | 'counts' | 'includePendiente'>;
    /** Filtros propios de la pantalla (p. ej. por cuenta de transferencia): van entre los chips y el buscador. */
    extra?: React.ReactNode;
    busqueda: { value: string; onChange: (v: string) => void; placeholder?: string };
    /** Botón "Más recientes / Más antiguas". */
    orden?: { asc: boolean; onToggle: () => void };
    exportar?: {
        onPdf?: () => void;
        onCsv?: () => void;
        disabled?: boolean;
        csvLoading?: boolean;
        /** Etiquetas cortas por defecto ("PDF", "CSV"). */
        pdfLabel?: string;
        csvLabel?: string;
    };
    /** Texto a la derecha de la fila de acciones ("12 de 40 resultados"). */
    resultados?: string;
}

/**
 * Barra de filtros de las pantallas de facturas: método de pago, buscador por cliente, orden y exportar.
 * Es la misma en facturas del día, por rango, facturación neta, balance por fechas y QR/transferencias;
 * cada pantalla solo dice qué piezas lleva.
 */
export const FacturaToolbar = React.memo(function FacturaToolbar({ metodo, extra, busqueda, orden, exportar, resultados }: FacturaToolbarProps) {
    const hayAcciones = !!orden || !!exportar?.onPdf || !!exportar?.onCsv || !!resultados;
    return (
        <View className="rounded-2xl mb-5 p-3" style={{ gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
            {metodo && <MethodFilterChips {...metodo} />}
            {extra}
            <SearchInput value={busqueda.value} onChangeText={busqueda.onChange} placeholder={busqueda.placeholder ?? 'Buscar por nombre de cliente...'} />

            {hayAcciones && (
                <View className="flex-row items-center justify-between gap-3 flex-wrap">
                    <View className="flex-row items-center gap-2 flex-wrap">
                        {orden && (
                            <TouchableOpacity
                                onPress={orden.onToggle}
                                className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 active:bg-white/10"
                                accessibilityLabel="Cambiar el orden de las facturas"
                            >
                                <Icon name={orden.asc ? 'sort-clock-ascending' : 'sort-clock-descending'} size={16} color="#F5A524" />
                                <Text className="text-xs font-bold text-slate-300">{orden.asc ? 'Más antiguas' : 'Más recientes'}</Text>
                            </TouchableOpacity>
                        )}
                        {exportar?.onPdf && (
                            <Button
                                title={exportar.pdfLabel ?? 'PDF'}
                                icon="file-pdf-outline"
                                variant="secondary"
                                size="sm"
                                onPress={exportar.onPdf}
                                disabled={exportar.disabled}
                                className="bg-purple-600/20 border-purple-500/30"
                            />
                        )}
                        {exportar?.onCsv && (
                            <Button
                                title={exportar.csvLabel ?? 'CSV'}
                                icon="table-large"
                                variant="secondary"
                                size="sm"
                                onPress={exportar.onCsv}
                                loading={exportar.csvLoading}
                                disabled={exportar.disabled}
                                className="bg-emerald-600/20 border-emerald-500/30"
                            />
                        )}
                    </View>
                    {resultados ? <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{resultados}</Text> : null}
                </View>
            )}
        </View>
    );
});
