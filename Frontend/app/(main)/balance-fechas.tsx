import React, { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { View, Text } from '../../tw';
import { useFacturasPagosRango, formatCOP, transferenciasPorCuenta, tipoDeGasto, nombreCategoria, TIPO_GASTO_META } from '@/src/shared';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';
import { exportPdf } from '../../utils/exportData';
import { FacturaCard } from '../../components/facturas/FacturaShared';
import { ResumenDinero } from '../../components/facturas/ResumenDinero';
import { useCuentasTransferencia } from '../../hooks/use-cuentas-transferencia';
import { useFacturasRangoScreen } from '../../hooks/use-facturas-rango-screen';
import { usePaginaLocal } from '../../hooks/use-pagina-local';
import { PaginadorLocal } from '../../components/contabilidad/PaginadorLocal';
import { FacturaToolbar } from '../../components/facturas/FacturaToolbar';
import { GastoCard } from '../../components/facturas/GastoCard';
import {
    PageContainer,
    PageHeader,
    Icon,
    ListSkeleton,
    Badge,
    Card,
    DateRangeFilter,
    PosRefreshControl,
    InlineError, SectionHeader, CardGrid } from '../../components/ui';

export default function BalanceFechasScreen() {
    const { cuentas } = useCuentasTransferencia();

    // Sin tope: se traen TODOS los gastos del rango (la paginación de abajo es solo visual).
    const gastosRango = useFacturasPagosRango();
    const { fetchData: fetchGastos, setFrom: setFromG, setTo: setToG } = gastosRango;
    const alBuscar = useCallback(
        (f: string, t: string, opciones?: { forzar?: boolean }) => {
            setFromG(f);
            setToG(t);
            return fetchGastos(f, t, 1, opciones);
        },
        [fetchGastos, setFromG, setToG],
    );
    const s = useFacturasRangoScreen({ alBuscar });

    // `s.facturas` y `gastosRango.data` ya son el rango COMPLETO (sin paginar) con los filtros que se ven:
    // lo que se exporta es exactamente lo que está en pantalla (antes se volvían a pedir hasta 9999
    // facturas y se ignoraba la cuenta elegida).
    const paginaFacturas = usePaginaLocal(s.facturas, 60);
    const paginaGastos = usePaginaLocal(gastosRango.data, 30);

    const exportarPdf = useCallback(() => {
        const mf = s.facturas;
        const mg = gastosRango.data;
        if (!mf.length && !mg.length) return;
        const r = s.resumen;
        exportPdf({
            title: `Balance ${s.searchedFrom} – ${s.searchedTo}`,
            subtitle: `${mf.length} facturas · ${mg.length} egresos`,
            headers: ['Tipo', 'ID', 'Nombre', 'Fecha', 'Método', 'Cuenta / Categoría', 'Estado', 'Total'],
            rows: [
                ...mf.map((f) => [
                    'Ingreso',
                    f.facturaId ?? '',
                    f.clienteNombre || '—',
                    f.fechaFactura || '',
                    f.metodo || '',
                    transferenciasPorCuenta(f).map((c) => `${c.cuenta ?? 'Sin asignar'} ${formatCOP(c.monto)}`).join(' + '),
                    f.estado || '',
                    formatCOP(Number(f.total) || 0),
                ]),
                ...mg.map((g) => [
                    'Egreso',
                    g.pagosId ?? '',
                    g.nombreGasto || '—',
                    g.fechaFactura || '',
                    g.metodo || '',
                    `${TIPO_GASTO_META[tipoDeGasto(g)].label} · ${nombreCategoria(g.categoria)}`,
                    g.estado || '',
                    formatCOP(Number(g.total) || 0),
                ]),
            ],
            // Totales del servidor para TODO el rango (definiciones únicas), no de lo exportado a mano.
            summaryRows: r
                ? [
                      { label: 'Facturado', value: formatCOP(r.ventas.facturado) },
                      { label: 'Cobrado', value: formatCOP(r.ventas.cobrado) },
                      { label: 'Egresos pagados', value: `−${formatCOP(r.gastos.pagados)}` },
                      { label: 'Balance (cobrado − egresos pagados)', value: formatCOP(r.balance.cobrado), bold: true },
                  ]
                : undefined,
        });
    }, [s.facturas, s.resumen, gastosRango.data, s.searchedFrom, s.searchedTo]);

    const exportarCsv = useCallback(async () => {
        const mf = s.facturas;
        const mg = gastosRango.data;
        if (!mf.length && !mg.length) return;
        downloadCsv(await buildCombinedBalanceCsv(mf, mg), `contabilidad_${s.searchedFrom}_${s.searchedTo}.csv`);
    }, [s.facturas, gastosRango.data, s.searchedFrom, s.searchedTo]);

    const chipCuenta = (activa: boolean) => ({
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: activa ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: activa ? '#A78BFA' : 'rgba(255,255,255,0.08)',
    });

    return (
        <PageContainer scrollable refreshControl={<PosRefreshControl refreshing={s.refreshing} onRefresh={s.handleRefresh} />}>
            <View className="pb-8">
                <PageHeader title="Balance Histórico" subtitle="Facturación por rango" icon="scale-balance" />

                <DateRangeFilter
                    from={s.from}
                    to={s.to}
                    onFromChange={s.setFrom}
                    onToChange={s.setTo}
                    onSearch={s.handleSearch}
                    loading={s.loadingFacturas || gastosRango.loading}
                />

                {!s.hasSearched ? (
                    <View className="items-center py-24 opacity-30">
                        <Icon name="calendar-search" size={64} color="#64748B" />
                        <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">Selecciona un rango de fechas y presiona Buscar</Text>
                    </View>
                ) : (
                    <>
                        <FacturaToolbar
                            metodo={{ value: s.metodoFilter, onChange: s.handleSelectMetodo, counts: s.metodoCounts }}
                            extra={
                                cuentas.length > 0 ? (
                                    <View style={{ gap: 6, marginTop: 2, paddingHorizontal: 2 }}>
                                        <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Filtrar por cuenta QR:</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                            {[{ id: undefined as number | undefined, nombre: 'Todas las cuentas' }, ...cuentas].map((c) => {
                                                const activa = s.cuentaId === c.id;
                                                return (
                                                    <TouchableOpacity key={c.id ?? 'todas'} onPress={() => s.handleSelectCuenta(c.id)} style={chipCuenta(activa)}>
                                                        <Text style={{ fontFamily: 'Outfit', color: activa ? '#F3E8FF' : '#94A3B8', fontSize: 11, fontWeight: '700' }}>{c.nombre}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>
                                ) : undefined
                            }
                            busqueda={{ value: s.nombreFilter, onChange: s.setNombreFilter }}
                            exportar={{ onPdf: exportarPdf, onCsv: exportarCsv, disabled: !s.resumen }}
                            resultados={s.total > 0 ? `${s.total} resultados${s.notaCooldown ? ` · ${s.notaCooldown}` : ''}` : undefined}
                        />

                        {/* Totales del rango completo (servidor), no de la página visible */}
                        {!!s.resumen && <ResumenDinero resumen={s.resumen} />}

                        <SeccionTitulo titulo="Facturas emitidas" color="#F5A524" cantidad={s.total} />
                        {!!s.errorFacturas && <AvisoError mensaje={s.errorFacturas} />}

                        {s.loadingFacturas ? (
                            <ListSkeleton count={4} />
                        ) : s.facturas.length === 0 ? (
                            <View className="items-center py-16 opacity-30">
                                <Icon name="email-off-outline" size={48} color="#64748B" />
                                <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">Sin facturas en este rango</Text>
                            </View>
                        ) : (
                            <View style={{ marginBottom: 4 }}>
                                <CardGrid
                                    kind="factura"
                                    data={paginaFacturas.items}
                                    keyExtractor={(item, i) => item.facturaId?.toString() ?? String(i)}
                                    renderItem={(item) => (
                                        <FacturaCard item={item} isUpdating={s.updatingId === item.facturaId} activeFilter={s.metodoFilter} {...s.accionesFactura} />
                                    )}
                                />
                            </View>
                        )}
                        <PaginadorLocal pagina={paginaFacturas} etiqueta="facturas" />

                        {(gastosRango.data.length > 0 || gastosRango.loading) && (
                            <View className="mt-8 mb-4">
                                <SeccionTitulo titulo="Gastos operativos" color="#EF4444" cantidad={gastosRango.total} />
                                {!!gastosRango.error && <AvisoError mensaje={gastosRango.error} />}
                                {gastosRango.loading ? (
                                    <ListSkeleton count={3} />
                                ) : (
                                    <CardGrid
                                        kind="panel"
                                        data={paginaGastos.items}
                                        keyExtractor={(g, i) => g.pagosId?.toString() ?? String(i)}
                                        renderItem={(g) => (
                                            <GastoCard gasto={g} nombreCuenta={g.cuentaOrigenId != null ? cuentas.find((c) => c.id === g.cuentaOrigenId)?.nombre : undefined} />
                                        )}
                                    />
                                )}
                                <PaginadorLocal pagina={paginaGastos} etiqueta="gastos" />
                            </View>
                        )}
                    </>
                )}
            </View>
        </PageContainer>
    );
}

function SeccionTitulo({ titulo, color, cantidad }: { titulo: string; color: string; cantidad: number }) {
    return <SectionHeader title={titulo} color={color} count={cantidad} />;
}

function AvisoError({ mensaje }: { mensaje: string }) {
    return <InlineError message={mensaje} className="mb-4" />;
}
