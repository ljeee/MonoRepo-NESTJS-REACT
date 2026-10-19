import React, { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View } from '../../tw';
import { GRID_KINDS, calcularColumnas, useBreakpoint } from '../../styles/responsive';
import type { GridKind } from '../../styles/responsive';

export interface CardGridProps<T> {
    data: readonly T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    keyExtractor: (item: T, index: number) => string;
    /** Tipo de tarjeta: fija el ancho mínimo y el máximo de columnas (ver `GRID_KINDS`). */
    kind?: GridKind;
    /** Para casos que no encajan en un `kind`. */
    minItemWidth?: number;
    maxColumns?: number;
    /** Espacio entre tarjetas. Por defecto 12 en móvil y 16 en el resto. */
    gap?: number;
    className?: string;
}

/**
 * Grilla de tarjetas con las columnas que caben en SU ancho real (se mide con `onLayout`, igual en web y
 * nativo): una sola regla responsive para todas las pantallas. Las filas son de igual altura; la última se
 * completa con huecos para que las tarjetas no se estiren. No virtualiza: úsala con listas ya paginadas o
 * cortas (en web va dentro del `ScrollView` de la pantalla). Envuelve cada tarjeta en `React.memo`.
 */
export function CardGrid<T>({ data, renderItem, keyExtractor, kind = 'panel', minItemWidth, maxColumns, gap, className = '' }: CardGridProps<T>) {
    const { isMobile } = useBreakpoint();
    const [ancho, setAncho] = useState(0);
    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        setAncho((prev) => (prev === w ? prev : w));
    }, []);

    const espacio = gap ?? (isMobile ? 12 : 16);
    const regla = GRID_KINDS[kind];
    const columnas = calcularColumnas(ancho, minItemWidth ?? regla.minItemWidth, maxColumns ?? regla.maxColumns, espacio);

    const filas: T[][] = [];
    for (let i = 0; i < data.length; i += columnas) filas.push(data.slice(i, i + columnas));

    return (
        <View className={`w-full ${className}`} onLayout={onLayout} style={{ gap: espacio }}>
            {filas.map((fila, f) => (
                <View key={keyExtractor(fila[0], f * columnas)} style={{ flexDirection: 'row', gap: espacio, alignItems: 'stretch' }}>
                    {fila.map((item, c) => (
                        <View key={keyExtractor(item, f * columnas + c)} style={{ flex: 1, minWidth: 0 }}>
                            {renderItem(item, f * columnas + c)}
                        </View>
                    ))}
                    {Array.from({ length: columnas - fila.length }, (_, k) => (
                        <View key={`hueco-${k}`} style={{ flex: 1, minWidth: 0 }} />
                    ))}
                </View>
            ))}
        </View>
    );
}
