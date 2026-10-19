import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useResumenGeneral } from '../../hooks/use-resumen-general';
import { useCuentasTransferencia } from '../../hooks/use-cuentas-transferencia';
import { ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { View, Text } from '../../tw';
import {
    useFacturasRango,
    validateFlexibleDateRange,
    formatCurrency,
    useApi,
    useFacturasPagosRango,
    transferenciasPorCuenta,
    tipoDeGasto,
    tipoPorCategoria,
    nombreCategoria,
    CATEGORIAS_GASTO,
    TIPO_GASTO_META,
    isGastoPagado,
    Role,
} from '@/src/shared';
import type { FacturaVenta, FacturaPago, ParamsLibroDiario, TipoGastoFiltro } from '@/src/shared';
import { useAuth } from '../../contexts/AuthContext';
import { usePaginaLocal } from '../../hooks/use-pagina-local';
import { PaginadorLocal } from '../../components/contabilidad/PaginadorLocal';
import {
    buildCombinedBalanceCsv,
    buildEgresosCsv,
    buildFacturasBackupCsv,
    buildTransferenciasCsv,
    descargarBlob,
    downloadCsv,
} from '../../utils/csvExport';
import { isAxiosError } from 'axios';
import {
    exportFacturasPdf,
    abrirPdfDelServidor,
    exportBalanceDePrueba,
    exportBalancePorTercero,
    exportInformeImpuesto,
    exportEgresosPdf,
    exportTransferenciasPdf,
} from '../../utils/exportData';
import {
    PageContainer,
    PageHeader,
    Icon,
    Card,
    Badge,
    ListSkeleton,
    DateRangeFilter,
    PosRefreshControl,
    ChipGroup,
    OptionPickerModal, InlineError, StatCard } from '../../components/ui';
import { useBreakpoint } from '../../styles/responsive';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'resumen' | 'ventas' | 'egresos' | 'reportes';

const TABS: { id: TabId; label: string; icon: any }[] = [
    { id: 'resumen', label: 'Resumen', icon: 'chart-box-outline' },
    { id: 'ventas', label: 'Ventas', icon: 'receipt' },
    { id: 'egresos', label: 'Egresos', icon: 'cash-minus' },
    { id: 'reportes', label: 'Reportes', icon: 'file-chart-outline' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATE_FORMATTER = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });

function fmtDate(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return DATE_FORMATTER.format(d);
}

function metodoLabel(m?: string) {
    const map: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transfer.', mixto: 'Mixto', efectivo_transferencia: 'Mixto', tarjeta: 'Tarjeta', nequi: 'Nequi', daviplata: 'Daviplata' };
    return map[m?.toLowerCase() ?? ''] ?? m ?? '—';
}

function estadoBadge(estado?: string): 'success' | 'warning' | 'danger' | 'info' {
    if (estado === 'pagado') return 'success';
    if (estado === 'pendiente') return 'warning';
    if (estado === 'cancelado') return 'danger';
    return 'info';
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

// ─── Balance Banner ───────────────────────────────────────────────────────────

const BalanceBanner = memo(function BalanceBanner({ ingresos, gastos }: { ingresos: number; gastos: number }) {
    const neto = ingresos - gastos;
    const isPos = neto >= 0;
    const margen = ingresos > 0 ? ((neto / ingresos) * 100).toFixed(1) : '0.0';

    return (
        <View style={{ borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: isPos ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', backgroundColor: '#0A1520', overflow: 'hidden' }}>
            <View style={{ padding: 20, gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Balance del Período (cobrado − egresos pagados)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, backgroundColor: isPos ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderColor: isPos ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)' }}>
                        <Icon name={isPos ? 'trending-up' : 'trending-down'} size={12} color={isPos ? '#10B981' : '#EF4444'} />
                        <Text style={{ color: isPos ? '#10B981' : '#EF4444', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{isPos ? 'Superávit' : 'Déficit'}</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 14 }}>
                    {[
                        { label: 'Cobrado', value: `$${formatCurrency(ingresos)}`, color: '#10B981' },
                        { label: 'Egresos pagados', value: `−$${formatCurrency(gastos)}`, color: '#EF4444' },
                        { label: 'Margen', value: `${margen}%`, color: isPos ? '#F5A524' : '#EF4444' },
                    ].map(({ label, value, color }) => (
                        <View key={label} style={{ flex: 1 }}>
                            <Text style={{ color: '#475569', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>{label}</Text>
                            <Text style={{ color, fontFamily: 'SpaceGrotesk-Bold', fontSize: 17 }}>{value}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isPos ? 'rgba(245,165,36,0.15)' : 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="scale-balance" size={18} color={isPos ? '#F5A524' : '#EF4444'} />
                        </View>
                        <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, textTransform: 'uppercase' }}>Balance de caja</Text>
                    </View>
                    <Text style={{ color: isPos ? '#F5A524' : '#EF4444', fontFamily: 'SpaceGrotesk-Bold', fontSize: 24, letterSpacing: -1 }}>
                        {isPos ? '' : '−'}${formatCurrency(Math.abs(neto))}
                    </Text>
                </View>
            </View>
        </View>
    );
});

// ─── Métodos breakdown ────────────────────────────────────────────────────────

const MetodosBreakdown = memo(function MetodosBreakdown({ metodos }: { metodos: { metodo: string; total: number; porcentaje?: number }[] }) {
    if (!metodos || !metodos.length) return null;
    const total = metodos.reduce((s, m) => s + m.total, 0);

    return (
        <Card className="mb-4">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="credit-card-multiple-outline" size={15} color="#F5A524" />
                <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cobrado por método</Text>
            </View>
            {metodos.map((item) => {
                const pct = total > 0 ? (item.total / total) * 100 : 0;
                return (
                    <View key={item.metodo} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                            <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{metodoLabel(item.metodo)}</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <Text style={{ color: '#475569', fontSize: 11 }}>{pct.toFixed(1)}%</Text>
                                <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 12 }}>${formatCurrency(item.total)}</Text>
                            </View>
                        </View>
                        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                            <View style={{ height: 4, borderRadius: 2, backgroundColor: '#F5A524', width: `${pct}%` as any }} />
                        </View>
                    </View>
                );
            })}
        </Card>
    );
});

// ─── Table helpers ────────────────────────────────────────────────────────────

const TableHeader = memo(function TableHeader({ cols }: { cols: string[] }) {
    return (
        <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 8 }}>
            {cols.map((c, i) => (
                <Text key={i} style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: i === 1 ? 1 : undefined, width: i === 0 ? 44 : i === cols.length - 1 ? 80 : 72 }}>
                    {c}
                </Text>
            ))}
        </View>
    );
});

const VentaRow = memo(function VentaRow({ f, isMobile }: { f: FacturaVenta; isMobile: boolean }) {
    const cuentas = transferenciasPorCuenta(f);
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)', gap: 8 }}>
            <Text style={{ color: '#64748B', fontSize: 11, fontFamily: 'SpaceGrotesk-Bold', width: 44 }}>#{f.facturaId}</Text>
            <Text style={{ color: '#CBD5E1', fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{f.clienteNombre || '—'}</Text>
            {!isMobile && <Text style={{ color: '#475569', fontSize: 11, width: 72 }}>{fmtDate(f.fechaFactura)}</Text>}
            {!isMobile && <Text style={{ color: '#64748B', fontSize: 11, width: 72 }}>{metodoLabel(f.metodo)}</Text>}
            {!isMobile && (
                <Text style={{ color: cuentas.length ? '#A78BFA' : '#334155', fontSize: 10, width: 110 }} numberOfLines={2}>
                    {cuentas.length ? cuentas.map((c) => c.cuenta ?? 'Sin asignar').join(' + ') : '—'}
                </Text>
            )}
            <Badge label={f.estado || 'N/A'} variant={estadoBadge(f.estado)} size="sm" />
            <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, textAlign: 'right', minWidth: 80 }}>${formatCurrency(f.total ?? 0)}</Text>
        </View>
    );
});

/** Mensaje legible de un error del API (también cuando la respuesta pedida era texto o blob). */
async function mensajeDeError(err: unknown): Promise<string> {
    if (isAxiosError(err)) {
        let data: unknown = err.response?.data;
        if (typeof Blob !== 'undefined' && data instanceof Blob) data = await data.text();
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch { /* texto plano */ }
        }
        const msg = (data as { message?: unknown } | undefined)?.message;
        if (typeof msg === 'string') return msg;
        if (Array.isArray(msg) && msg.length) return String(msg[0]);
        return err.message;
    }
    return err instanceof Error ? err.message : 'No se pudo completar la acción';
}

/** Egreso pagado por QR sin cuenta de origen (anterior al campo): en el saldo por cuenta aparece "Sin asignar". */
const esQrSinCuenta = (g: FacturaPago) => g.metodo === 'qr' && g.cuentaOrigenId == null;

const GastoRow = memo(function GastoRow({ g, isMobile, onClasificar, nombreCuenta, onAsignarCuenta }: { g: FacturaPago; isMobile: boolean; onClasificar?: (g: FacturaPago) => void; nombreCuenta?: string; onAsignarCuenta?: (g: FacturaPago) => void }) {
    const tipo = tipoDeGasto(g);
    const esQr = g.metodo === 'qr';
    return (
        <TouchableOpacity
            disabled={!onClasificar}
            onPress={() => onClasificar?.(g)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)', gap: 8 }}
        >
            <Text style={{ color: '#64748B', fontSize: 11, fontFamily: 'SpaceGrotesk-Bold', width: 44 }}>#{g.pagosId}</Text>
            <View style={{ flex: 1 }}>
                <Text style={{ color: '#CBD5E1', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{g.nombreGasto || '—'}</Text>
                <Text style={{ color: TIPO_GASTO_META[tipo].color, fontSize: 10 }} numberOfLines={1}>
                    {TIPO_GASTO_META[tipo].label} · {nombreCategoria(g.categoria)}{onClasificar ? '  ✎' : ''}
                </Text>
                {esQr && (
                    <TouchableOpacity disabled={!onAsignarCuenta || g.cuentaOrigenId != null} onPress={() => onAsignarCuenta?.(g)}>
                        <Text style={{ color: g.cuentaOrigenId != null ? '#A78BFA' : '#F87171', fontSize: 10 }} numberOfLines={1}>
                            {g.cuentaOrigenId != null ? `Sale de: ${nombreCuenta ?? `cuenta #${g.cuentaOrigenId}`}` : `Sin cuenta de origen${onAsignarCuenta ? ' — toca para asignar' : ''}`}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
            {!isMobile && <Text style={{ color: '#475569', fontSize: 11, width: 72 }}>{fmtDate(g.fechaFactura)}</Text>}
            {!isMobile && <Text style={{ color: '#64748B', fontSize: 11, width: 72 }}>{metodoLabel(g.metodo)}</Text>}
            <Badge label={g.estado || 'N/A'} variant={estadoBadge(g.estado)} size="sm" />
            <Text style={{ color: '#EF4444', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, textAlign: 'right', minWidth: 80 }}>−${formatCurrency(g.total ?? 0)}</Text>
        </TouchableOpacity>
    );
});

// ─── Report card ──────────────────────────────────────────────────────────────

const ReportCard = memo(function ReportCard({ icon, title, description, tag, onPress, loading, disabled }: {
    icon: any; title: string; description: string; tag?: string;
    onPress: () => void; loading?: boolean; disabled?: boolean;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.78}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: '#0C1828', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', opacity: disabled ? 0.4 : 1, marginBottom: 10 }}
        >
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(245,165,36,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,165,36,0.2)', flexShrink: 0 }}>
                {loading ? <ActivityIndicator size="small" color="#F5A524" /> : <Icon name={icon} size={22} color="#F5A524" />}
            </View>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <Text style={{ color: '#F1F5F9', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14 }}>{title}</Text>
                    {tag ? <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(96,165,250,0.12)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)' }}>
                        <Text style={{ color: '#60A5FA', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>{tag}</Text>
                    </View> : null}
                </View>
                <Text style={{ color: '#475569', fontSize: 12, lineHeight: 17 }}>{description}</Text>
            </View>
            <Icon name="open-in-new" size={16} color="#334155" />
        </TouchableOpacity>
    );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ContabilidadScreen() {
    const { isMobile } = useBreakpoint();
    const api = useApi();
    const [activeTab, setActiveTab] = useState<TabId>('resumen');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [validRange, setValidRange] = useState({ from: '', to: '' });
    const [exportLoading, setExportLoading] = useState('');
    const [searched, setSearched] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const { cuentas: cuentasTransfer } = useCuentasTransferencia({ incluirInactivas: true });
    const { user } = useAuth();
    // El contador es de solo lectura (el backend lo bloquea); el resto del staff puede clasificar egresos.
    const puedeClasificar = !!user && (!user.roles.includes(Role.Contador) || user.roles.includes(Role.Admin));
    const [clasificando, setClasificando] = useState<FacturaPago | null>(null);
    const [asignandoCuenta, setAsignandoCuenta] = useState<FacturaPago | null>(null);
    const [filtroTipo, setFiltroTipo] = useState<TipoGastoFiltro | 'todos'>('todos');
    const [filtroCategoria, setFiltroCategoria] = useState<string | 'todas'>('todas');
    const [filtroCuenta, setFiltroCuenta] = useState<number | 'todas' | 'sin'>('todas');
    // Egresos pagados por QR sin cuenta de origen (los anteriores al campo): se asignan aquí, uno a uno o todos juntos.
    const [soloQrSinCuenta, setSoloQrSinCuenta] = useState(false);
    const [asignandoTodos, setAsignandoTodos] = useState(false);
    const params = useLocalSearchParams<{ tab?: string; qr?: string; from?: string; to?: string }>();
    const [exportOptions, setExportOptions] = useState<{
        incluirDomicilio: boolean;
        filtroDiario: 'completo' | 'solo_transferencias' | 'cuenta_especifica';
        cuentaId?: number;
        cuentaNombre?: string;
    }>({
        incluirDomicilio: true,
        filtroDiario: 'completo',
    });

    const {
        data: facturas, loading: loadingF, error: errorF,
        setFrom: setFromF, setTo: setToF, search: searchF, recargar: recargarF,
        total: totalFacturasCount,
    } = useFacturasRango(); // sin tope: TODO el rango (la paginación de abajo es solo visual)

    const {
        data: gastos, loading: loadingG, error: errorG,
        setFrom: setFromG, setTo: setToG, fetchData: fetchGastos,
        total: totalGastosCount,
    } = useFacturasPagosRango(); // sin tope: TODOS los egresos del rango

    // Totales del período: SIEMPRE del servidor (definiciones únicas). Antes la pestaña
    // Ventas mostraba la suma de la página visible de 50 facturas como si fuera del período.
    const [versionResumen, setVersionResumen] = useState(0);
    const { data: resumen, loading: loadingStats } = useResumenGeneral(validRange.from, validRange.to, versionResumen);

    const handleRefresh = useCallback(async () => {
        if (!searched || !validRange.from || !validRange.to) return;
        setRefreshing(true);
        try {
            // Recarga forzada: se salta el cooldown de la búsqueda repetida (con un mínimo de 5 s).
            await Promise.all([
                recargarF(),
                fetchGastos(validRange.from, validRange.to, 1, { forzar: true }),
                Promise.resolve(setVersionResumen((v) => v + 1)),
            ]);
        } catch (err) {
            console.error('Error refreshing contabilidad:', err);
        } finally {
            setRefreshing(false);
        }
    }, [searched, validRange, recargarF, fetchGastos]);

    const handleSearch = useCallback((fromOverride?: string, toOverride?: string) => {
        const fromInput = fromOverride ?? from;
        const toInput = toOverride ?? to;
        const { from: f, to: t, error } = validateFlexibleDateRange(fromInput, toInput);
        if (error) return;
        setValidRange({ from: f, to: t });
        setFromF(f); setToF(t);
        setFromG(f); setToG(t);
        searchF(f, t);
        fetchGastos(f, t, 1);
        setSearched(true);

    }, [from, to, setFromF, setToF, setFromG, setToG, searchF, fetchGastos]);

    // Enlace directo (p. ej. desde QR / Transferencias: «asignar los egresos QR sin cuenta»): abre la pestaña,
    // el filtro y busca el rango recibido. Solo una vez, al montar.
    const enlaceAplicado = useRef(false);
    useEffect(() => {
        if (enlaceAplicado.current) return;
        enlaceAplicado.current = true;
        if (params.tab === 'egresos' || params.tab === 'ventas' || params.tab === 'reportes') setActiveTab(params.tab);
        if (params.qr === 'sin-cuenta') setSoloQrSinCuenta(true);
        if (params.from && params.to) {
            setFrom(params.from);
            setTo(params.to);
            handleSearch(params.from, params.to);
        }
    }, [params, handleSearch]);

    // ── Libro diario: lo arma el servidor (el mismo que recibe el contador en cada cierre) ──
    const [errorExport, setErrorExport] = useState('');
    const [avisoExport, setAvisoExport] = useState('');
    const paramsLibro = useCallback(
        (): ParamsLibroDiario => ({
            from: validRange.from,
            to: validRange.to,
            filtro: exportOptions.filtroDiario,
            cuentaId: exportOptions.filtroDiario === 'cuenta_especifica' ? exportOptions.cuentaId : undefined,
        }),
        [validRange, exportOptions],
    );
    const accionLibro = useCallback(async (clave: string, fn: () => Promise<void>) => {
        setExportLoading(clave);
        setErrorExport('');
        setAvisoExport('');
        try {
            await fn();
        } catch (err) {
            setErrorExport(await mensajeDeError(err));
        } finally {
            setExportLoading('');
        }
    }, []);
    const libroDiarioPdf = () =>
        accionLibro('diario', () =>
            abrirPdfDelServidor(
                () => api.contabilidad.libroDiarioPdf(paramsLibro()),
                `libro-diario_${validRange.from}_${validRange.to}.pdf`,
                'Generando el libro diario…',
            ),
        );
    const libroDiarioCsv = () =>
        accionLibro('diario-csv', async () => descargarBlob(await api.contabilidad.libroDiarioCsv(paramsLibro()), `libro-diario_${validRange.from}_${validRange.to}.csv`));
    const enviarLibros = () =>
        accionLibro('enviar-libros', async () => {
            const r = await api.contabilidad.enviarLibros(validRange.from, validRange.to);
            setAvisoExport(`Libros enviados (completo y transferencias y mixto, en PDF) a ${r.enviadoA.join(', ')}.`);
        });

    const totalIngresos = resumen?.ventas.cobrado ?? 0;
    const totalGastos = resumen?.gastos.pagados ?? 0; // egresos PAGADOS (balance de caja)
    const pendientesF = resumen?.ventas.porCobrar ?? 0;
    const ticketProm = resumen?.ventas.ticket ?? 0;
    const facturasEstado = (clave: string) => resumen?.ventas.porEstado.find((e) => e.clave === clave)?.facturas ?? 0;
    const metodosResumen = resumen
        ? [
              { metodo: 'efectivo', total: resumen.ventas.cobradoPorMetodo.efectivo },
              { metodo: 'transferencia', total: resumen.ventas.cobradoPorMetodo.transferencia },
          ].filter((m) => m.total > 0)
        : [];

    const isWeb = Platform.OS === 'web';
    const loading = loadingF || loadingG;
    const periodLabel = searched ? `${validRange.from} al ${validRange.to}` : '';
    const totalRegistros = totalFacturasCount + totalGastosCount;
    const hasData = totalFacturasCount > 0 || totalGastosCount > 0;

    // `facturas` y `gastos` ya son el rango COMPLETO (sin paginar): las exportaciones usan exactamente eso.
    const runExport = useCallback(async (key: string, fn: (allF: FacturaVenta[], allG: FacturaPago[]) => void | Promise<void>) => {
        setExportLoading(key);
        try {
            await fn(facturas, gastos);
        } finally { setExportLoading(''); }
    }, [facturas, gastos]);

    // ── Ventas: filtro por cuenta de transferencia (sobre el conjunto completo) ──
    const facturasFiltradas = useMemo(() => {
        if (filtroCuenta === 'todas') return facturas;
        return facturas.filter((f) =>
            transferenciasPorCuenta(f).some((c) => (filtroCuenta === 'sin' ? c.cuentaId == null && !c.cuenta : c.cuentaId === filtroCuenta)),
        );
    }, [facturas, filtroCuenta]);
    const paginaVentas = usePaginaLocal(facturasFiltradas, 100);

    // ── Egresos: filtro por tipo y categoría (sobre el conjunto completo) ──
    const gastosFiltrados = useMemo(
        () =>
            gastos.filter(
                (g) =>
                    (filtroTipo === 'todos' || tipoDeGasto(g) === filtroTipo) &&
                    (filtroCategoria === 'todas' || (g.categoria || 'general') === filtroCategoria) &&
                    (!soloQrSinCuenta || esQrSinCuenta(g)),
            ),
        [gastos, filtroTipo, filtroCategoria, soloQrSinCuenta],
    );
    const qrSinCuenta = useMemo(() => gastos.filter(esQrSinCuenta), [gastos]);
    const paginaGastos = usePaginaLocal(gastosFiltrados, 100);
    const totalFiltradoGastos = gastosFiltrados.reduce((t, g) => t + (Number(g.total) || 0), 0);
    const pagadoFiltradoGastos = gastosFiltrados.filter(isGastoPagado).reduce((t, g) => t + (Number(g.total) || 0), 0);

    const clasificar = useCallback(
        async (categoria: string) => {
            if (!clasificando?.pagosId) return;
            try {
                await api.pagos.update(clasificando.pagosId, { categoria, tipoGasto: tipoPorCategoria(categoria) ?? undefined });
                setClasificando(null);
                await fetchGastos(validRange.from, validRange.to, 1);
                setVersionResumen((v) => v + 1);
            } catch (err) {
                console.error('Error clasificando egreso:', err);
            }
        },
        [api, clasificando, fetchGastos, validRange],
    );

    const nombresCuenta = useMemo(() => new Map(cuentasTransfer.map((c) => [c.id, c.nombre])), [cuentasTransfer]);

    // Egresos QR anteriores al campo "cuenta de origen": se asignan tocándolos (como la clasificación).
    const asignarCuenta = useCallback(
        async (cuentaId: number) => {
            if (!asignandoCuenta?.pagosId) return;
            try {
                await api.pagos.update(asignandoCuenta.pagosId, { cuentaOrigenId: cuentaId });
                setAsignandoCuenta(null);
                await fetchGastos(validRange.from, validRange.to, 1);
                setVersionResumen((v) => v + 1);
            } catch (err) {
                console.error('Error asignando cuenta al egreso:', err);
            }
        },
        [api, asignandoCuenta, fetchGastos, validRange],
    );

    // Todos los egresos QR sin cuenta que se ven ahora (con los filtros aplicados) a la misma cuenta.
    const [errorAsignarTodos, setErrorAsignarTodos] = useState('');
    const asignarCuentaATodos = useCallback(
        async (cuentaId: number) => {
            const pendientes = gastosFiltrados.filter(esQrSinCuenta);
            setAsignandoTodos(false);
            setErrorAsignarTodos('');
            let fallidos = 0;
            for (const g of pendientes) {
                if (!g.pagosId) continue;
                try {
                    await api.pagos.update(g.pagosId, { cuentaOrigenId: cuentaId });
                } catch (err) {
                    fallidos += 1;
                    console.error('Error asignando cuenta al egreso:', err);
                }
            }
            if (fallidos) setErrorAsignarTodos(`${fallidos} de ${pendientes.length} egresos no se pudieron asignar; vuelve a intentarlo.`);
            await fetchGastos(validRange.from, validRange.to, 1);
            setVersionResumen((v) => v + 1);
        },
        [api, gastosFiltrados, fetchGastos, validRange],
    );

    const DateBar = (
        <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            onSearch={(f, t) => { setFrom(f); setTo(t); handleSearch(f, t); }}
            loading={loading}
        />
    );

    // ── Tab bar ─────────────────────────────────────────────────────────────────
    const TabBar = (
        <View style={{ flexDirection: 'row', gap: 4, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 4, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                    <TouchableOpacity
                        key={tab.id}
                        onPress={() => setActiveTab(tab.id)}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: active ? 'rgba(245,165,36,0.14)' : 'transparent', borderWidth: 1, borderColor: active ? 'rgba(245,165,36,0.28)' : 'transparent' }}
                    >
                        <Icon name={tab.icon} size={14} color={active ? '#F5A524' : '#475569'} />
                        {!isMobile && <Text style={{ color: active ? '#F5A524' : '#475569', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{tab.label}</Text>}
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    if (!searched) {
        return (
            <PageContainer
                refreshControl={
                    <PosRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            >
                <PageHeader title="Contabilidad" subtitle="Libro contable" icon="book-account-outline" />
                {DateBar}
                <View style={{ alignItems: 'center', paddingTop: 60, opacity: 0.6 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(245,165,36,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,165,36,0.15)', marginBottom: 16 }}>
                        <Icon name="book-account-outline" size={36} color="#F5A524" />
                    </View>
                    <Text style={{ color: '#475569', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Selecciona un período</Text>
                    <Text style={{ color: '#334155', fontSize: 12, marginTop: 6 }}>Ingresa las fechas y pulsa Consultar</Text>
                </View>
            </PageContainer>
        );
    }

    return (
        <PageContainer
            refreshControl={
                <PosRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
        >
            <PageHeader
                title="Contabilidad"
                subtitle="Libro contable"
                icon="book-account-outline"
                rightContent={
                    loading
                        ? <ActivityIndicator size="small" color="#F5A524" />
                        : <Badge label={`${totalRegistros} registros`} variant="neutral" icon="database-outline" size="sm" />
                }
            />

            {DateBar}
            {TabBar}

            {/* ── RESUMEN ─────────────────────────────────────────────────────── */}
            {activeTab === 'resumen' && (
                <View>
                    {(loadingF || loadingStats) ? <ListSkeleton count={4} /> : (
                        <>
                            <BalanceBanner ingresos={totalIngresos} gastos={totalGastos} />

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                                <StatCard icon="arrow-down-circle-outline" label="Ingresos cobrados" value={`$${formatCurrency(totalIngresos)}`} sub={`${facturasEstado('cobrada')} cobradas · ${facturasEstado('parcial')} con abono`} color="#10B981" />
                                <StatCard icon="arrow-up-circle-outline" label="Egresos pagados" value={`$${formatCurrency(totalGastos)}`} sub={`${resumen?.gastos.cantidad ?? 0} gastos`} color="#EF4444" />
                                <StatCard icon="clock-alert-outline" label="Por cobrar" value={`$${formatCurrency(pendientesF)}`} sub={`${facturasEstado('pendiente') + facturasEstado('parcial')} facturas`} color="#F59E0B" />
                                <StatCard icon="ticket-percent-outline" label="Ticket promedio" value={`$${formatCurrency(ticketProm)}`} sub={`${resumen?.ventas.facturas ?? 0} facturas válidas`} color="#60A5FA" />
                            </View>

                            <MetodosBreakdown metodos={metodosResumen} />

                            {/* Cobrado por cuenta de transferencia (id; incluye "sin asignar") */}
                            {!!resumen && resumen.ventas.porCuenta.length > 0 && (
                                <Card className="mb-4">
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                        <Icon name="qrcode-scan" size={15} color="#A78BFA" />
                                        <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Transferencias por cuenta</Text>
                                    </View>
                                    {resumen.ventas.porCuenta.map((c) => (
                                        <View key={`${c.cuentaId ?? c.cuenta}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text style={{ color: c.sinAsignar ? '#F87171' : '#CBD5E1', fontSize: 12, fontWeight: '700' }}>
                                                {c.cuenta} <Text style={{ color: '#64748B', fontWeight: '400' }}>({c.facturas})</Text>
                                            </Text>
                                            <Text style={{ color: c.sinAsignar ? '#F87171' : '#A78BFA', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>${formatCurrency(c.monto)}</Text>
                                        </View>
                                    ))}
                                </Card>
                            )}

                            {/* Estado de resultados: costos vs gastos operativos */}
                            {!!resumen && (
                                <Card className="mb-4">
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                        <Icon name="scale-balance" size={15} color="#F5A524" />
                                        <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Estado de resultados (cobrado y pagado)</Text>
                                    </View>
                                    {[
                                        { l: 'Ingresos cobrados', v: resumen.resultado.ingresos, c: '#10B981' },
                                        { l: '− Costos (insumos, mercancía, empaques)', v: -resumen.resultado.costos, c: '#F59E0B' },
                                        { l: '= Utilidad bruta', v: resumen.resultado.utilidadBruta, c: '#F8FAFC', b: true },
                                        { l: '− Gastos operativos (nómina, servicios…)', v: -resumen.resultado.gastosOperativos, c: '#EF4444' },
                                        ...(resumen.resultado.sinClasificar > 0 ? [{ l: '− Egresos sin clasificar', v: -resumen.resultado.sinClasificar, c: '#94A3B8' }] : []),
                                        { l: '= Utilidad operativa (balance de caja)', v: resumen.resultado.utilidadOperativa, c: '#F5A524', b: true },
                                    ].map((r) => (
                                        <View key={r.l} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text style={{ color: r.b ? '#F8FAFC' : '#94A3B8', fontSize: 12, fontWeight: r.b ? '800' : '600', flex: 1 }}>{r.l}</Text>
                                            <Text style={{ color: r.c, fontFamily: 'SpaceGrotesk-Bold', fontSize: r.b ? 14 : 13 }}>{r.v < 0 ? '−' : ''}${formatCurrency(Math.abs(r.v))}</Text>
                                        </View>
                                    ))}
                                </Card>
                            )}

                            {/* Egresos por tipo y categoría */}
                            {!!resumen && resumen.gastos.cantidad > 0 && (
                                <Card className="mb-4">
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                        <Icon name="shape-outline" size={15} color="#EF4444" />
                                        <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Egresos por tipo y categoría</Text>
                                    </View>
                                    {resumen.gastos.porTipo.filter((t) => t.cantidad > 0).map((t) => (
                                        <View key={t.tipo} style={{ marginBottom: 12 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <Text style={{ color: TIPO_GASTO_META[t.tipo].color, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>{TIPO_GASTO_META[t.tipo].label} ({t.cantidad})</Text>
                                                <Text style={{ color: TIPO_GASTO_META[t.tipo].color, fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>${formatCurrency(t.total)}</Text>
                                            </View>
                                            {resumen.gastos.porCategoria.filter((c) => c.tipo === t.tipo).map((c) => (
                                                <View key={`${t.tipo}-${c.categoria}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 12, marginBottom: 2 }}>
                                                    <Text style={{ color: '#94A3B8', fontSize: 11 }}>{nombreCategoria(c.categoria)} ({c.cantidad})</Text>
                                                    <Text style={{ color: '#CBD5E1', fontSize: 12 }}>${formatCurrency(c.total)}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ))}
                                    {resumen.gastos.porTipo.some((t) => t.tipo === 'sin_clasificar' && t.cantidad > 0) && (
                                        <Text style={{ color: '#94A3B8', fontSize: 11 }}>Los egresos sin clasificar se clasifican desde la pestaña Egresos (toca el egreso).</Text>
                                    )}
                                </Card>
                            )}

                            <InlineError message={errorF ?? errorG} />
                        </>
                    )}
                </View>
            )}

            {/* ── VENTAS ──────────────────────────────────────────────────────── */}
            {activeTab === 'ventas' && (
                <View style={{ flex: 1 }}>
                    <View style={{ marginBottom: 10, gap: 8 }}>
                        <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
                            {resumen?.ventas.facturas ?? 0} ventas en el período · cobrado <Text style={{ color: '#10B981' }}>${formatCurrency(resumen?.ventas.cobrado ?? 0)}</Text>
                        </Text>
                        {(resumen?.ventas.porCuenta.length ?? 0) > 0 && (
                            <ChipGroup
                                options={[
                                    { value: 'todas' as string | number, label: 'Todas' },
                                    ...(resumen?.ventas.porCuenta ?? []).map((c) => ({ value: (c.sinAsignar ? 'sin' : c.cuentaId ?? c.cuenta) as string | number, label: c.cuenta, count: c.facturas })),
                                ]}
                                value={filtroCuenta}
                                onChange={(v) => v != null && setFiltroCuenta(v as number | 'todas' | 'sin')}
                                color="#A78BFA"
                            />
                        )}
                    </View>
                    {loadingF ? <ListSkeleton count={6} /> : (
                        <Card className="p-0 overflow-hidden mb-4">
                            <TableHeader cols={isMobile ? ['#', 'Cliente', 'Est.', 'Total'] : ['#', 'Cliente', 'Fecha', 'Método', 'Cuenta', 'Estado', 'Total']} />
                            {facturasFiltradas.length === 0 ? (
                                <View style={{ padding: 32, alignItems: 'center' }}><Text style={{ color: '#334155', fontSize: 13 }}>Sin ventas en el período</Text></View>
                            ) : (
                                paginaVentas.items.map(f => <VentaRow key={String(f.facturaId)} f={f} isMobile={isMobile} />)
                            )}
                        </Card>
                    )}
                    {!loadingF && <PaginadorLocal pagina={paginaVentas} etiqueta="ventas" />}
                </View>
            )}

            {/* ── EGRESOS ─────────────────────────────────────────────────────── */}
            {activeTab === 'egresos' && (
                <View style={{ flex: 1 }}>
                    <View style={{ marginBottom: 10, gap: 8 }}>
                        <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
                            {gastosFiltrados.length} egresos · <Text style={{ color: '#EF4444' }}>−${formatCurrency(totalFiltradoGastos)}</Text> (pagados −${formatCurrency(pagadoFiltradoGastos)})
                        </Text>
                        <ChipGroup
                            options={[
                                { value: 'todos', label: 'Todos', count: gastos.length },
                                ...(['costo', 'gasto', 'sin_clasificar'] as TipoGastoFiltro[]).map((t) => ({
                                    value: t as string,
                                    label: TIPO_GASTO_META[t].label,
                                    count: gastos.filter((g) => tipoDeGasto(g) === t).length,
                                })),
                            ]}
                            value={filtroTipo as string}
                            onChange={(v) => { if (v != null) { setFiltroTipo(v as TipoGastoFiltro | 'todos'); setFiltroCategoria('todas'); } }}
                            color="#EF4444"
                        />
                        <ChipGroup
                            options={[
                                { value: 'todas', label: 'Todas las categorías' },
                                ...['general', ...CATEGORIAS_GASTO.map((c) => c.id)]
                                    .map((id) => ({ value: id, label: nombreCategoria(id), count: gastos.filter((g) => (g.categoria || 'general') === id && (filtroTipo === 'todos' || tipoDeGasto(g) === filtroTipo)).length }))
                                    .filter((o) => o.count > 0),
                            ]}
                            value={filtroCategoria}
                            onChange={(v) => v != null && setFiltroCategoria(v as string)}
                            color="#F5A524"
                        />
                        {qrSinCuenta.length > 0 && (
                            <View style={{ backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)', borderRadius: 12, padding: 12, gap: 8 }}>
                                <Text style={{ color: '#C4B5FD', fontSize: 12, fontWeight: '700' }}>
                                    {qrSinCuenta.length} {qrSinCuenta.length === 1 ? 'egreso pagado' : 'egresos pagados'} por QR sin cuenta de origen · ${formatCurrency(qrSinCuenta.reduce((t, g) => t + (Number(g.total) || 0), 0))}
                                </Text>
                                <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                                    Son los «Sin asignar» del saldo por cuenta: no se sabe de qué cuenta salieron. Asigna cada uno tocándolo, o todos los de la lista a la misma cuenta.
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                    <TouchableOpacity
                                        onPress={() => setSoloQrSinCuenta((v) => !v)}
                                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#A78BFA', backgroundColor: soloQrSinCuenta ? 'rgba(167,139,250,0.25)' : 'transparent' }}
                                    >
                                        <Text style={{ color: '#E9D5FF', fontSize: 11, fontWeight: '800' }}>{soloQrSinCuenta ? 'Ver todos los egresos' : 'Ver solo estos'}</Text>
                                    </TouchableOpacity>
                                    {puedeClasificar && soloQrSinCuenta && (
                                        <TouchableOpacity
                                            onPress={() => setAsignandoTodos(true)}
                                            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#A78BFA' }}
                                        >
                                            <Text style={{ color: '#1E1B4B', fontSize: 11, fontWeight: '800' }}>Asignar los {gastosFiltrados.filter(esQrSinCuenta).length} a una cuenta</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <InlineError message={errorAsignarTodos} size="sm" onClose={() => setErrorAsignarTodos('')} />
                            </View>
                        )}
                    </View>
                    {loadingG ? <ListSkeleton count={6} /> : (
                        <Card className="p-0 overflow-hidden mb-4">
                            <TableHeader cols={isMobile ? ['#', 'Concepto', 'Est.', 'Total'] : ['#', 'Concepto', 'Fecha', 'Método', 'Estado', 'Total']} />
                            {gastosFiltrados.length === 0 ? (
                                <View style={{ padding: 32, alignItems: 'center' }}><Text style={{ color: '#334155', fontSize: 13 }}>Sin egresos en el período</Text></View>
                            ) : (
                                paginaGastos.items.map(g => <GastoRow key={String(g.pagosId)} g={g} isMobile={isMobile} onClasificar={puedeClasificar ? setClasificando : undefined} nombreCuenta={g.cuentaOrigenId != null ? nombresCuenta.get(g.cuentaOrigenId) : undefined} onAsignarCuenta={puedeClasificar ? setAsignandoCuenta : undefined} />)
                            )}
                        </Card>
                    )}
                    {!loadingG && <PaginadorLocal pagina={paginaGastos} etiqueta="egresos" />}
                </View>
            )}

            {/* ── REPORTES ────────────────────────────────────────────────────── */}
            {activeTab === 'reportes' && (
                <View>
                    {!isWeb && (
                        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(96,165,250,0.08)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)', marginBottom: 16 }}>
                            <Icon name="information-outline" size={18} color="#60A5FA" />
                            <Text style={{ color: '#60A5FA', fontSize: 13, flex: 1 }}>Los reportes solo están disponibles en la versión web del POS.</Text>
                        </View>
                    )}

                    {!hasData && (
                        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(245,158,11,0.08)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', marginBottom: 16 }}>
                            <Icon name="alert-outline" size={18} color="#F59E0B" />
                            <Text style={{ color: '#F59E0B', fontSize: 13, flex: 1 }}>No hay datos para el período consultado. Cambia el rango de fechas.</Text>
                        </View>
                    )}

                    {/* Opciones de Exportación */}
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 10, marginBottom: 10 }}>Opciones de Exportación</Text>
                    <Card style={{ marginBottom: 16, padding: 16, gap: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Icon name="bike" size={16} color="#38BDF8" />
                                <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}>Incluir valor de domicilios en reportes</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setExportOptions(prev => ({ ...prev, incluirDomicilio: !prev.incluirDomicilio }))}
                                style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 10,
                                    backgroundColor: exportOptions.incluirDomicilio ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                    borderWidth: 1,
                                    borderColor: exportOptions.incluirDomicilio ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
                                }}
                            >
                                <Text style={{ color: exportOptions.incluirDomicilio ? '#34D399' : '#F87171', fontSize: 11, fontWeight: '800' }}>
                                    {exportOptions.incluirDomicilio ? 'Sí (Con domicilio)' : 'No (Sin domicilio)'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />

                        <View style={{ gap: 10 }}>
                            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>Libro Diario (PDF / CSV)</Text>
                            <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                                Trae cada venta con su forma de pago y sus productos, los gastos con su método, los productos por precio (con los cambiados a mano) y las cuentas QR.
                            </Text>

                            <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '700', marginTop: 4 }}>Contenido:</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {[
                                    { key: 'completo', label: 'Completo (Todo)' },
                                    { key: 'solo_transferencias', label: 'Transferencias y mixto' },
                                    { key: 'cuenta_especifica', label: 'Cuenta Específica' },
                                ].map(f => {
                                    const active = exportOptions.filtroDiario === f.key;
                                    return (
                                        <TouchableOpacity
                                            key={f.key}
                                            onPress={() => setExportOptions(prev => ({ ...prev, filtroDiario: f.key as any }))}
                                            style={{
                                                paddingHorizontal: 10,
                                                paddingVertical: 6,
                                                borderRadius: 8,
                                                backgroundColor: active ? 'rgba(245,165,36,0.2)' : 'rgba(255,255,255,0.04)',
                                                borderWidth: 1,
                                                borderColor: active ? 'rgba(245,165,36,0.5)' : 'rgba(255,255,255,0.08)',
                                            }}
                                        >
                                            <Text style={{ color: active ? '#F5A524' : '#94A3B8', fontSize: 10, fontWeight: '800' }}>{f.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {exportOptions.filtroDiario === 'cuenta_especifica' && cuentasTransfer.length > 0 && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {cuentasTransfer.map(c => {
                                        const sel = exportOptions.cuentaNombre === c.nombre;
                                        return (
                                            <TouchableOpacity
                                                key={c.id}
                                                onPress={() => setExportOptions(prev => ({ ...prev, cuentaId: c.id, cuentaNombre: c.nombre }))}
                                                style={{
                                                    paddingHorizontal: 10,
                                                    paddingVertical: 5,
                                                    borderRadius: 8,
                                                    backgroundColor: sel ? 'rgba(167,139,250,0.25)' : 'rgba(0,0,0,0.3)',
                                                    borderWidth: 1,
                                                    borderColor: sel ? '#A78BFA' : 'rgba(255,255,255,0.1)',
                                                }}
                                            >
                                                <Text style={{ color: sel ? '#F3E8FF' : '#94A3B8', fontSize: 10, fontWeight: '700' }}>{c.nombre}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    </Card>

                    {/* Balances */}
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Balances Contables</Text>

                    <ReportCard
                        icon="scale-balance"
                        title="Balance de Prueba"
                        tag="PDF"
                        description="Estado de cuentas del período: activos, ingresos, gastos y resultado neto"
                        onPress={() => runExport('balance', (allF, allG) => exportBalanceDePrueba(allF, allG, validRange.from, validRange.to))}
                        loading={exportLoading === 'balance'}
                        disabled={!isWeb || !hasData}
                    />
                    <ReportCard
                        icon="account-group-outline"
                        title="Balance de Prueba por Tercero"
                        tag="PDF"
                        description="Resumen por cliente: total facturado, cobrado y saldo pendiente por cada tercero"
                        onPress={() => runExport('tercero', (allF) => exportBalancePorTercero(allF, validRange.from, validRange.to))}
                        loading={exportLoading === 'tercero'}
                        disabled={!isWeb || totalFacturasCount === 0}
                    />

                    {/* Libros */}
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 10 }}>Libros Contables</Text>

                    <ReportCard
                        icon="book-open-page-variant-outline"
                        title="Libro Diario"
                        tag="PDF"
                        description="Cada venta con su forma de pago (efectivo, QR por cuenta, mixto) y sus productos; productos vendidos y por precio (con los cambiados a mano); gastos; cuentas QR y domiciliarios. Es el mismo PDF del cierre."
                        onPress={libroDiarioPdf}
                        loading={exportLoading === 'diario'}
                        disabled={!isWeb || !searched}
                    />
                    <ReportCard
                        icon="file-table-outline"
                        title="Libro Diario"
                        tag="CSV"
                        description="El mismo libro diario en CSV para Excel (ventas, gastos, totales y productos por precio)"
                        onPress={libroDiarioCsv}
                        loading={exportLoading === 'diario-csv'}
                        disabled={!isWeb || !searched}
                    />
                    {puedeClasificar && (
                        <ReportCard
                            icon="email-send-outline"
                            title="Enviar libros por correo"
                            tag="CORREO"
                            description="Los dos libros del período en PDF (completo y transferencias y mixto) a tu correo (REPORT_EMAIL) y al de la contadora. En cada cierre se envían solos."
                            onPress={enviarLibros}
                            loading={exportLoading === 'enviar-libros'}
                            disabled={!searched}
                        />
                    )}
                    <InlineError message={errorExport} onClose={() => setErrorExport('')} />
                    {!!avisoExport && (
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                            <Icon name="check-circle-outline" size={16} color="#34D399" />
                            <Text style={{ color: '#6EE7B7', fontSize: 12, flex: 1 }}>{avisoExport}</Text>
                        </View>
                    )}
                    <ReportCard
                        icon="receipt"
                        title="Libro de Ventas"
                        tag="PDF"
                        description="Detalle de facturas de ventas con cliente, método de pago y estado"
                        onPress={() => runExport('ventas-pdf', (allF) => exportFacturasPdf(allF, periodLabel))}
                        loading={exportLoading === 'ventas-pdf'}
                        disabled={!isWeb || totalFacturasCount === 0}
                    />

                    {/* Transferencias y egresos */}
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 10 }}>Transferencias y Egresos</Text>

                    <ReportCard
                        icon="qrcode-scan"
                        title="Listado de Transferencias / QR"
                        tag="PDF"
                        description="TODAS las transferencias del período por cuenta de destino, con el total de cada cuenta"
                        onPress={() => runExport('transf-pdf', (allF) => exportTransferenciasPdf(allF, periodLabel))}
                        loading={exportLoading === 'transf-pdf'}
                        disabled={!isWeb || totalFacturasCount === 0}
                    />
                    <ReportCard
                        icon="file-table-outline"
                        title="Transferencias por cuenta"
                        tag="CSV"
                        description="Una fila por factura y cuenta (abonos a cuentas distintas separados) más el total por cuenta"
                        onPress={() => runExport('transf-csv', (allF) => downloadCsv(buildTransferenciasCsv(allF), `transferencias_${validRange.from}_${validRange.to}.csv`))}
                        loading={exportLoading === 'transf-csv'}
                        disabled={!isWeb || totalFacturasCount === 0}
                    />
                    <ReportCard
                        icon="cash-minus"
                        title="Egresos: costos y gastos"
                        tag="PDF"
                        description="Todos los egresos del período con su tipo (costo / gasto) y categoría (nómina, servicios, insumos…)"
                        onPress={() => runExport('egresos-pdf', (_f, allG) => exportEgresosPdf(allG, periodLabel))}
                        loading={exportLoading === 'egresos-pdf'}
                        disabled={!isWeb || totalGastosCount === 0}
                    />
                    <ReportCard
                        icon="file-table-outline"
                        title="Egresos por tipo y categoría"
                        tag="CSV"
                        description="Detalle de todos los egresos con tipo y categoría, más el total por categoría"
                        onPress={() => runExport('egresos-csv', (_f, allG) => downloadCsv(buildEgresosCsv(allG), `egresos_${validRange.from}_${validRange.to}.csv`))}
                        loading={exportLoading === 'egresos-csv'}
                        disabled={!isWeb || totalGastosCount === 0}
                    />

                    {/* Impuestos */}
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 10 }}>Informes Fiscales</Text>

                    <ReportCard
                        icon="percent-outline"
                        title="Informe de IVA"
                        tag="PDF"
                        description="Base gravable, IVA generado (8% restaurantes) e IVA total del período por método de pago"
                        onPress={() => runExport('iva', (allF) => exportInformeImpuesto(allF, validRange.from, validRange.to))}
                        loading={exportLoading === 'iva'}
                        disabled={!isWeb || totalFacturasCount === 0}
                    />

                    {/* CSV exports */}
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 10 }}>Exportar CSV</Text>

                    <ReportCard
                        icon="file-table-outline"
                        title="Balance Contable Completo"
                        tag="CSV"
                        description="Ventas + egresos + resumen por método de pago y productos más vendidos en 5 secciones"
                        onPress={() => runExport('combined', async (allF, allG) => {
                            const csv = await buildCombinedBalanceCsv(allF, allG, { incluirDomicilio: exportOptions.incluirDomicilio });
                            downloadCsv(csv, `balance_${validRange.from}_${validRange.to}.csv`);
                        })}
                        loading={exportLoading === 'combined'}
                        disabled={!isWeb || !hasData}
                    />
                    <ReportCard
                        icon="file-chart-outline"
                        title="Backup de Ventas"
                        tag="CSV"
                        description="Facturas con datos de cliente para importar al sistema o enviar al contador"
                        onPress={() => runExport('backup', async (allF) => {
                            const csv = await buildFacturasBackupCsv(allF);
                            downloadCsv(csv, `ventas_backup_${validRange.from}_${validRange.to}.csv`);
                        })}
                        loading={exportLoading === 'backup'}
                        disabled={!isWeb || totalFacturasCount === 0}
                    />
                </View>
            )}
            <OptionPickerModal
                visible={!!clasificando}
                title="Clasificar egreso"
                subtitle={clasificando ? `${clasificando.nombreGasto || 'Egreso'} — elige la categoría (define costo o gasto operativo)` : undefined}
                icon="shape-outline"
                color="#F5A524"
                options={CATEGORIAS_GASTO.map((c) => ({ value: c.id, label: `${c.nombre} · ${TIPO_GASTO_META[c.tipo].label}`, icon: c.icon as any }))}
                onSelect={(o) => void clasificar(o.value)}
                onCancel={() => setClasificando(null)}
            />
            <OptionPickerModal
                visible={!!asignandoCuenta}
                title="¿De qué cuenta salió?"
                subtitle={asignandoCuenta ? `${asignandoCuenta.nombreGasto || 'Egreso'} — pago por QR de $${formatCurrency(asignandoCuenta.total ?? 0)}` : undefined}
                icon="bank-outline"
                color="#A78BFA"
                options={cuentasTransfer.filter((c) => c.activa).map((c) => ({ value: c.id, label: c.nombre, icon: 'bank-outline' as any }))}
                onSelect={(o) => void asignarCuenta(o.value)}
                onCancel={() => setAsignandoCuenta(null)}
            />
            <OptionPickerModal
                visible={asignandoTodos}
                title="¿De qué cuenta salieron?"
                subtitle={`Se asigna la misma cuenta a ${gastosFiltrados.filter(esQrSinCuenta).length} egresos pagados por QR ($${formatCurrency(gastosFiltrados.filter(esQrSinCuenta).reduce((t, g) => t + (Number(g.total) || 0), 0))}). Para repartirlos entre cuentas, asígnalos uno a uno.`}
                icon="bank-outline"
                color="#A78BFA"
                options={cuentasTransfer.filter((c) => c.activa).map((c) => ({ value: c.id, label: c.nombre, icon: 'bank-outline' as any }))}
                onSelect={(o) => void asignarCuentaATodos(o.value)}
                onCancel={() => setAsignandoTodos(false)}
            />
        </PageContainer>
    );
}
