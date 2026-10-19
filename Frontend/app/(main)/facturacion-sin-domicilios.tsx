import React, { useMemo, useState } from 'react';
import { View, Text } from '../../tw';
import { FacturaCard } from '../../components/facturas/FacturaShared';
import { ResumenDinero } from '../../components/facturas/ResumenDinero';
import { useFacturasRangoScreen } from '../../hooks/use-facturas-rango-screen';
import { usePaginaLocal } from '../../hooks/use-pagina-local';
import { PaginadorLocal } from '../../components/contabilidad/PaginadorLocal';
import { FacturaToolbar } from '../../components/facturas/FacturaToolbar';
import {
    PageContainer,
    PageHeader,
    Icon,
    ListSkeleton,
    DateRangeFilter,
    PosRefreshControl,
    InlineError, CardGrid } from '../../components/ui';

/**
 * Facturación neta: lo cobrado menos lo que se les paga a los
 * domiciliarios. Antes restaba solo los domicilios de la página visible (50 facturas)
 * a los ingresos de todo el período.
 */
export default function FacturacionSinDomiciliosScreen() {
    const [sortAsc, setSortAsc] = useState(false);
    const s = useFacturasRangoScreen();

    // Orden sobre TODO el rango; la paginación (solo visual) reparte lo ya ordenado.
    const ordenadas = useMemo(() => (sortAsc ? [...s.facturas].reverse() : s.facturas), [s.facturas, sortAsc]);
    const pagina = usePaginaLocal(ordenadas, 60);

    return (
        <PageContainer scrollable refreshControl={<PosRefreshControl refreshing={s.refreshing} onRefresh={s.handleRefresh} />}>
            <View className="pb-8">
                <PageHeader title="Facturación Neta" subtitle="Facturación sin costos de domicilio" icon="cash-remove" />

                <DateRangeFilter from={s.from} to={s.to} onFromChange={s.setFrom} onToChange={s.setTo} onSearch={s.handleSearch} loading={s.loadingFacturas} />

                {!s.hasSearched ? (
                    <View className="items-center py-24 opacity-30">
                        <Icon name="calendar-search" size={64} color="#64748B" />
                        <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">
                            Selecciona un rango de fechas y presiona Buscar
                        </Text>
                    </View>
                ) : (
                    <>
                        <FacturaToolbar
                            metodo={{ value: s.metodoFilter, onChange: s.handleSelectMetodo, counts: s.metodoCounts }}
                            busqueda={{ value: s.nombreFilter, onChange: s.setNombreFilter }}
                            orden={{ asc: sortAsc, onToggle: () => setSortAsc((prev) => !prev) }}
                            resultados={s.total > 0 ? `${s.total} resultados${s.notaCooldown ? ` · ${s.notaCooldown}` : ''}` : undefined}
                        />

                        {!!s.resumen && <ResumenDinero resumen={s.resumen} titulo="Facturación neta (sin domicilios)" sinDomicilios incluirGastos={false} mostrarCuentas={false} />}

                        <View className="flex-row items-center gap-3 mb-4">
                            <View style={{ width: 6, height: 24, backgroundColor: '#F5A524', borderRadius: 999 }} />
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 17, textTransform: 'uppercase', letterSpacing: 1 }}>Facturas emitidas</Text>
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12 }}>{s.total}</Text>
                            </View>
                        </View>

                        <InlineError message={s.errorFacturas} className="mb-4" />

                        {s.loadingFacturas ? (
                            <ListSkeleton count={4} />
                        ) : pagina.items.length === 0 ? (
                            <View className="items-center py-16 opacity-30">
                                <Icon name="email-off-outline" size={48} color="#64748B" />
                                <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">Sin facturas en este rango</Text>
                            </View>
                        ) : (
                            <View className="pb-4">
                                <CardGrid
                                    kind="factura"
                                    data={pagina.items}
                                    keyExtractor={(item, i) => item.facturaId?.toString() ?? String(i)}
                                    renderItem={(item) => (
                                        <FacturaCard item={item} isUpdating={s.updatingId === item.facturaId} activeFilter={s.metodoFilter} {...s.accionesFactura} />
                                    )}
                                />
                            </View>
                        )}

                        <PaginadorLocal pagina={pagina} etiqueta="facturas" />
                    </>
                )}
            </View>
        </PageContainer>
    );
}
