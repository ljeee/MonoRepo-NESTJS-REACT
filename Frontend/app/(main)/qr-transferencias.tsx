import React, { useCallback, useMemo, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text } from '../../tw';
import { formatCOP } from '@/src/shared';
import type { CobradoPorCuenta } from '@/src/shared';
import { FacturaCard } from '../../components/facturas/FacturaShared';
import { PaginadorLocal } from '../../components/contabilidad/PaginadorLocal';
import { useCuentasTransferencia } from '../../hooks/use-cuentas-transferencia';
import { useFacturasRangoScreen } from '../../hooks/use-facturas-rango-screen';
import { usePaginaLocal } from '../../hooks/use-pagina-local';
import { buildTransferenciasCsv, downloadCsv, descargarBlob } from '../../utils/csvExport';
import { useApi } from '@/src/shared';
import { exportTransferenciasPdf } from '../../utils/exportData';
import type { FiltroCuentaTransferencia } from '../../utils/exportData';
import { PageContainer, PageHeader, Icon, ListSkeleton, Card, DateRangeFilter, PosRefreshControl, ChipGroup, InlineError, CardGrid } from '../../components/ui';
import { FacturaToolbar } from '../../components/facturas/FacturaToolbar';

/** -1 en el filtro = facturas sin cuenta asignada (así lo entiende el backend). */
const SIN_ASIGNAR = -1;
const TODAS = 'todas';

/**
 * Transferencias / QR por cuenta de destino. El total, el desglose por cuenta y los conteos salen del
 * servidor para TODO el rango; el listado trae TODAS las transferencias (sin tope de 50): la paginación
 * es solo visual y cada exportación incluye todo el rango.
 *
 * Una factura entra aquí si cobró algo por QR: pagada por QR, la parte QR de una mixta o los abonos
 * por QR de una parcial (una factura abonada a cuentas distintas aparece en cada una).
 */
export default function QrTransferenciasScreen() {
    const api = useApi();
    const [sortAsc, setSortAsc] = useState(false);
    const { cuentas } = useCuentasTransferencia({ incluirInactivas: true });
    const s = useFacturasRangoScreen({ soloTransferencias: true });

    const porCuenta = useMemo(() => s.resumen?.ventas.porCuenta ?? [], [s.resumen]);
    const sinAsignar = porCuenta.find((c) => c.sinAsignar);
    const totalTransferencias = s.resumen?.ventas.cobradoPorMetodo.transferencia ?? 0;
    // Egresos pagados por QR sin cuenta de origen (la fila "Sin asignar" del saldo por cuenta).
    const egresosSinCuenta = (s.resumen?.cuentas ?? []).filter((c) => c.sinAsignar).reduce((t, c) => t + c.salidas, 0);
    const router = useRouter();

    // Todas las cuentas (aunque no hayan recibido nada) + las que aparecen en el período y ya no están en la lista.
    const filasCuenta = useMemo(() => {
        const usadas = new Set<CobradoPorCuenta>();
        const base = cuentas
            .filter((c) => c.activa || porCuenta.some((p) => p.cuentaId === c.id))
            .map((c) => {
                const p = porCuenta.find((x) => x.cuentaId === c.id);
                if (p) usadas.add(p);
                return { id: c.id as number | null, nombre: c.nombre, facturas: p?.facturas ?? 0, monto: p?.monto ?? 0, inactiva: !c.activa };
            });
        const extras = porCuenta
            .filter((p) => !usadas.has(p) && !p.sinAsignar)
            .map((p) => ({ id: p.cuentaId, nombre: p.cuenta, facturas: p.facturas, monto: p.monto, inactiva: true }));
        return [...base, ...extras];
    }, [cuentas, porCuenta]);

    const opcionesCuenta = useMemo(
        () => [
            { value: TODAS as string | number, label: 'Todas', count: undefined as number | undefined },
            ...filasCuenta.filter((c) => c.id != null).map((c) => ({ value: c.id as number, label: c.nombre, count: c.facturas })),
            { value: SIN_ASIGNAR, label: 'Sin asignar', count: sinAsignar?.facturas ?? 0 },
        ],
        [filasCuenta, sinAsignar],
    );

    // Orden sobre TODAS las transferencias; la paginación (solo visual) reparte lo ya ordenado.
    const ordenadas = useMemo(() => (sortAsc ? [...s.facturas].reverse() : s.facturas), [s.facturas, sortAsc]);
    const pagina = usePaginaLocal(ordenadas, 60);

    const etiquetaFiltro = useMemo(() => {
        if (s.cuentaId === SIN_ASIGNAR) return 'Sin asignar';
        return cuentas.find((c) => c.id === s.cuentaId)?.nombre;
    }, [s.cuentaId, cuentas]);
    // Con una cuenta elegida, las exportaciones llevan SOLO su parte (una factura abonada a dos cuentas trae
    // también la fila de la otra, y antes se sumaba al total de la cuenta filtrada).
    const filtroCuenta = useMemo<FiltroCuentaTransferencia | undefined>(() => {
        if (s.cuentaId == null) return undefined;
        if (s.cuentaId === SIN_ASIGNAR) return { id: null };
        return { id: s.cuentaId, nombre: etiquetaFiltro };
    }, [s.cuentaId, etiquetaFiltro]);
    const periodo = `${s.searchedFrom} al ${s.searchedTo}`;
    const exportarPdf = useCallback(
        () => exportTransferenciasPdf(s.facturas, periodo, etiquetaFiltro, filtroCuenta),
        [s.facturas, periodo, etiquetaFiltro, filtroCuenta],
    );
    // El CSV lo arma el servidor por tandas: completo aunque el rango sea de años, sin depender de lo cargado en pantalla.
    const [exportando, setExportando] = useState(false);
    const exportarCsv = useCallback(async () => {
        setExportando(true);
        try {
            const archivo = await api.facturas.exportarCsv({
                from: s.searchedFrom,
                to: s.searchedTo,
                conTransferencia: true,
                cuentaTransferenciaId: s.cuentaId,
            });
            descargarBlob(archivo, `transferencias_${s.searchedFrom}_${s.searchedTo}${etiquetaFiltro ? `_${etiquetaFiltro}` : ''}.csv`);
        } catch {
            // Sin conexión con el servidor: se exporta lo que ya está cargado.
            downloadCsv(buildTransferenciasCsv(s.facturas, filtroCuenta), `transferencias_${s.searchedFrom}_${s.searchedTo}.csv`);
        } finally {
            setExportando(false);
        }
    }, [api, s.facturas, s.searchedFrom, s.searchedTo, s.cuentaId, etiquetaFiltro, filtroCuenta]);

    return (
        <PageContainer scrollable refreshControl={<PosRefreshControl refreshing={s.refreshing} onRefresh={s.handleRefresh} />}>
            <View className="pb-8">
                <PageHeader title="QR / Transferencias" subtitle="Desglose por cuenta de destino" icon="qrcode-scan" />

                <DateRangeFilter from={s.from} to={s.to} onFromChange={s.setFrom} onToChange={s.setTo} onSearch={s.handleSearch} loading={s.loadingFacturas} />

                {!s.hasSearched ? (
                    <View className="items-center py-24 opacity-30">
                        <Icon name="qrcode-scan" size={64} color="#64748B" />
                        <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">Selecciona un rango de fechas para ver transferencias</Text>
                    </View>
                ) : (
                    <>
                        <FacturaToolbar
                            extra={
                                <View style={{ gap: 6 }}>
                                    <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Filtrar por cuenta:</Text>
                                    <ChipGroup
                                        options={opcionesCuenta}
                                        value={s.cuentaId ?? TODAS}
                                        onChange={(v) => v != null && s.handleSelectCuenta(v === TODAS ? undefined : (v as number))}
                                        color="#A78BFA"
                                    />
                                </View>
                            }
                            busqueda={{ value: s.nombreFilter, onChange: s.setNombreFilter }}
                            orden={{ asc: sortAsc, onToggle: () => setSortAsc((prev) => !prev) }}
                            exportar={{ onPdf: exportarPdf, onCsv: exportarCsv, csvLoading: exportando, disabled: s.facturas.length === 0 }}
                            resultados={s.total > 0 ? `${s.total} facturas con transferencia${s.notaCooldown ? ` · ${s.notaCooldown}` : ''}` : undefined}
                        />

                        {(filasCuenta.length > 0 || !!sinAsignar) && (
                            <Card className="mb-4 p-5" style={{ overflow: 'hidden' }}>
                                <View className="flex-row justify-between items-center mb-5">
                                    <Text style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Desglose por cuenta (período)</Text>
                                    <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, borderWidth: 1, backgroundColor: 'rgba(96,165,250,0.2)', borderColor: 'rgba(96,165,250,0.3)' }}>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 10, textTransform: 'uppercase', color: '#60A5FA' }}>QR / Transfer</Text>
                                    </View>
                                </View>

                                <View style={{ gap: 12 }}>
                                    {filasCuenta.map((c) => (
                                        <FilaCuenta key={c.id ?? c.nombre} nombre={c.nombre} facturas={c.facturas} monto={c.monto} nota={c.inactiva ? 'inactiva' : undefined} />
                                    ))}
                                    {!!sinAsignar && <FilaCuenta nombre="Sin asignar" facturas={sinAsignar.facturas} monto={sinAsignar.monto} alerta />}

                                    <View className="h-[1px] bg-white/5" />

                                    <View className="flex-row justify-between items-center">
                                        <View className="flex-row items-center gap-3">
                                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(96,165,250,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon name="qrcode-scan" size={20} color="#60A5FA" />
                                            </View>
                                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 15, textTransform: 'uppercase' }}>Total transferencias</Text>
                                        </View>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 28, color: '#60A5FA' }}>{formatCOP(totalTransferencias)}</Text>
                                    </View>

                                    {(s.resumen?.cuentas ?? []).some((c) => c.salidas > 0) && (
                                        <View style={{ gap: 8 }}>
                                            <Text style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Saldo por cuenta (entró − salió por QR)</Text>
                                            {(s.resumen?.cuentas ?? []).filter((c) => !c.sinAsignar).map((c) => (
                                                <View key={`saldo-${c.cuentaId ?? c.cuenta}`} className="flex-row justify-between items-center">
                                                    <Text style={{ color: '#CBD5E1', fontSize: 12 }}>
                                                        {c.cuenta}: entró {formatCOP(c.entradas)} · salió {formatCOP(c.salidas)}
                                                    </Text>
                                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, color: c.saldo < 0 ? '#F87171' : '#34D399' }}>{formatCOP(c.saldo)}</Text>
                                                </View>
                                            ))}
                                            {egresosSinCuenta > 0 && (
                                                // No es una cuenta en negativo: son egresos pagados por QR sin la cuenta de la que salieron
                                                // (los anteriores a ese campo). Hasta asignarlos, los saldos de arriba se ven más altos.
                                                <TouchableOpacity
                                                    onPress={() =>
                                                        router.push(`/contabilidad?tab=egresos&qr=sin-cuenta&from=${s.searchedFrom}&to=${s.searchedTo}` as never)
                                                    }
                                                    style={{ backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                                                >
                                                    <Icon name="bank-off-outline" size={18} color="#A78BFA" />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#C4B5FD', fontSize: 12 }}>
                                                            {formatCOP(egresosSinCuenta)} en egresos por QR sin cuenta de origen
                                                        </Text>
                                                        <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
                                                            Pagos por QR registrados sin decir de qué cuenta salieron (sobre todo los de antes de esta versión). No restan a ninguna cuenta hasta asignarlos: toca aquí para asignarlos en Contabilidad › Egresos.
                                                        </Text>
                                                    </View>
                                                    <Icon name="chevron-right" size={18} color="#A78BFA" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}

                                    {!!sinAsignar && sinAsignar.facturas > 0 && (
                                        <TouchableOpacity
                                            onPress={() => s.handleSelectCuenta(SIN_ASIGNAR)}
                                            style={{ backgroundColor: 'rgba(244,63,94,0.08)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.2)', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                                        >
                                            <Icon name="alert-outline" size={18} color="#F43F5E" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F87171', fontSize: 11, textTransform: 'uppercase' }}>
                                                    {sinAsignar.facturas} {sinAsignar.facturas === 1 ? 'factura sin cuenta asignada' : 'facturas sin cuenta asignada'}
                                                </Text>
                                                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, marginTop: 2 }}>
                                                    {`${formatCOP(sinAsignar.monto)} sin cuenta: toca aquí para verlas y asígnalas con la etiqueta roja de cada factura`}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </Card>
                        )}

                        <View className="flex-row items-center gap-3 mb-4">
                            <View style={{ width: 6, height: 24, backgroundColor: '#60A5FA', borderRadius: 999 }} />
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 17, textTransform: 'uppercase', letterSpacing: 1 }}>Facturas con transferencia</Text>
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12 }}>{s.total}</Text>
                            </View>
                        </View>

                        <InlineError message={s.errorFacturas} className="mb-4" />

                        {s.loadingFacturas ? (
                            <ListSkeleton count={4} />
                        ) : pagina.items.length === 0 ? (
                            <View className="items-center py-16 opacity-30">
                                <Icon name="qrcode-scan" size={48} color="#64748B" />
                                <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">Sin transferencias en este rango</Text>
                            </View>
                        ) : (
                            <View className="pb-4">
                                <CardGrid
                                    kind="factura"
                                    data={pagina.items}
                                    keyExtractor={(item, i) => item.facturaId?.toString() ?? String(i)}
                                    renderItem={(item) => (
                                        <FacturaCard
                                            item={item}
                                            isUpdating={s.updatingId === item.facturaId}
                                            activeFilter="transferencia"
                                            {...s.accionesFactura}
                                            onUpdate={s.onUpdate}
                                        />
                                    )}
                                />
                            </View>
                        )}

                        <PaginadorLocal pagina={pagina} etiqueta="facturas con transferencia" />
                    </>
                )}
            </View>
        </PageContainer>
    );
}

function FilaCuenta({ nombre, facturas, monto, alerta = false, nota }: { nombre: string; facturas: number; monto: number; alerta?: boolean; nota?: string }) {
    return (
        <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-3">
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: alerta ? 'rgba(244,63,94,0.2)' : 'rgba(167,139,250,0.2)' }}>
                    <Icon name={alerta ? 'alert-circle-outline' : 'bank-outline'} size={16} color={alerta ? '#F43F5E' : '#A78BFA'} />
                </View>
                <View>
                    <Text style={{ fontFamily: 'Outfit', color: alerta ? '#F87171' : '#CBD5E1', fontSize: 13, fontWeight: 'bold' }}>
                        {nombre}
                        {nota ? <Text style={{ color: '#64748B', fontWeight: 'normal' }}>{` (${nota})`}</Text> : null}
                    </Text>
                    <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10, textTransform: 'uppercase' }}>
                        {facturas} {facturas === 1 ? 'factura' : 'facturas'}
                    </Text>
                </View>
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: alerta ? '#F87171' : monto > 0 ? '#A78BFA' : '#475569', fontSize: 16 }}>{formatCOP(monto)}</Text>
        </View>
    );
}
