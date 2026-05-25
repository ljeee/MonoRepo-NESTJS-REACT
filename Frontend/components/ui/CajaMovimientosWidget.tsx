import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '../../tw';
import Card from './Card';
import Icon from './Icon';
import Button from './Button';
import { CajaMovimiento, CajaResumen, useApi } from '@/src/shared';
import { formatCurrency } from '@/src/shared';
import { getLocalDateString } from '../../src/shared/utils/dateRange';
import { AjusteCajaModal } from './AjusteCajaModal';

const PAGE_SIZE = 15;

interface Props {
    cajaResumen: CajaResumen | null | undefined;
    onRefresh: () => void;
    isLoading?: boolean;
    cajaOrigen?: 'principal' | 'gastos';
    title?: string;
}

function shiftDate(dateStr: string, deltaDays: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export default function CajaMovimientosWidget({ cajaResumen, onRefresh, isLoading, cajaOrigen = 'principal', title }: Props) {
    const api = useApi();
    const today = getLocalDateString();

    const [showHistorial, setShowHistorial] = useState(false);
    const [page, setPage] = useState(0);
    const [showAjusteModal, setShowAjusteModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [pastResumen, setPastResumen] = useState<CajaResumen | null>(null);
    const [loadingPast, setLoadingPast] = useState(false);

    const isToday = selectedDate === today;
    const displayResumen = isToday ? cajaResumen : pastResumen;

    useEffect(() => {
        if (isToday) {
            setPastResumen(null);
            return;
        }
        let cancelled = false;
        setLoadingPast(true);
        api.cajaDenominaciones.getResumen(selectedDate, cajaOrigen)
            .then((r) => { if (!cancelled) setPastResumen(r); })
            .catch(() => { if (!cancelled) setPastResumen(null); })
            .finally(() => { if (!cancelled) setLoadingPast(false); });
        return () => { cancelled = true; };
    }, [selectedDate, cajaOrigen, isToday, api]);

    if (isToday && (!cajaResumen || (cajaResumen.totalEntradas === 0 && cajaResumen.totalSalidas === 0))) {
        return null;
    }

    const movimientos = displayResumen?.movimientos || [];
    const sortedMovimientos = [...movimientos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const ultimaAperturaIndex = sortedMovimientos.findIndex(m => m.tipo === 'apertura');
    const movimientosActivos = ultimaAperturaIndex !== -1 ? sortedMovimientos.slice(0, ultimaAperturaIndex + 1) : sortedMovimientos;

    const totalPages = Math.ceil(movimientosActivos.length / PAGE_SIZE);
    const visibleMovimientos = showHistorial
        ? movimientosActivos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
        : [];

    const handleToggle = () => {
        setShowHistorial(v => !v);
        setPage(0);
    };

    const formatDen = (den: string, qty: number) => {
        const absQty = Math.abs(qty);
        if (den === 'coins') return `$${formatCurrency(absQty)} monedas`;
        return `$${formatCurrency(Number(den))} ×${absQty}`;
    };

    const renderDenomJSX = (denominaciones: Record<string, number>) => {
        if (!denominaciones || Object.keys(denominaciones).length === 0) return null;

        const entries = Object.entries(denominaciones).filter(([_, qty]) => qty !== 0);
        const hasMixed = entries.some(([_, qty]) => qty < 0) && entries.some(([_, qty]) => qty > 0);

        if (hasMixed) {
            // Cambio: split negative (sale) vs positive (entra)
            const sale  = entries.filter(([_, qty]) => qty < 0).map(([d, q]) => formatDen(d, q)).join(' · ');
            const entra = entries.filter(([_, qty]) => qty > 0).map(([d, q]) => formatDen(d, q)).join(' · ');
            return (
                <View style={{ gap: 2, marginTop: 3 }}>
                    {sale  ? <Text style={{ fontFamily: 'Outfit', color: '#F87171', fontSize: 9 }}>↑ Sale: {sale}</Text>  : null}
                    {entra ? <Text style={{ fontFamily: 'Outfit', color: '#34D399', fontSize: 9 }}>↓ Entra: {entra}</Text> : null}
                </View>
            );
        }

        // Normal: single line
        const text = entries.map(([d, q]) => formatDen(d, q)).join(' · ');
        return text ? (
            <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 9, marginTop: 2 }}>[{text}]</Text>
        ) : null;
    };

    const getIconInfo = (tipo: string) => {
        switch (tipo) {
            case 'entrada': return { name: 'arrow-down-circle', color: '#10B981' };
            case 'salida':  return { name: 'arrow-up-circle',   color: '#F43F5E' };
            case 'apertura': return { name: 'cash-register',    color: '#3B82F6' };
            default:         return { name: 'swap-horizontal',  color: '#94A3B8' };
        }
    };

    return (
        <>
        <Card className="mb-8 p-5">
            {/* ── Cabecera ── */}
            <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center gap-3">
                    <Icon name="cash-register" size={20} color="#F5A524" />
                    <Text className="text-white font-black text-base uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                        {title ?? 'Movimientos de Caja'}
                    </Text>
                </View>
                <View className="flex-row items-center gap-2">
                    {isToday && (
                        <Button title="Ajuste" icon="swap-horizontal" variant="ghost" size="sm" onPress={() => setShowAjusteModal(true)} disabled={isLoading} />
                    )}
                    <Button title="" icon="refresh" variant="ghost" size="sm" onPress={onRefresh} disabled={isLoading} />
                </View>
            </View>

            {/* ── Selector de fecha (Anterior / Hoy / Siguiente) ── */}
            <View className="flex-row items-center justify-between mb-3 px-1 flex-wrap gap-2">
                <TouchableOpacity
                    onPress={() => setSelectedDate(prev => shiftDate(prev, -1))}
                    className="flex-row items-center gap-1 px-2 py-1.5 rounded-xl bg-white/5 border border-white/10 active:bg-white/10"
                >
                    <Icon name="chevron-left" size={14} color="#94A3B8" />
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 10 }}>Anterior</Text>
                </TouchableOpacity>

                <View className="items-center">
                    <Text numberOfLines={1} style={{ fontFamily: 'SpaceGrotesk-Bold', color: isToday ? '#F5A524' : '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {isToday ? 'Hoy' : selectedDate}
                    </Text>
                    {!isToday && (
                        <TouchableOpacity onPress={() => setSelectedDate(today)}>
                            <Text style={{ fontFamily: 'Outfit', color: '#3B82F6', fontSize: 9, marginTop: 1 }}>Volver a hoy</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    onPress={() => setSelectedDate(prev => shiftDate(prev, 1))}
                    disabled={isToday}
                    className={`flex-row items-center gap-1 px-2 py-1.5 rounded-xl border ${isToday ? 'border-white/5 opacity-30' : 'border-white/10 bg-white/5 active:bg-white/10'}`}
                >
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 10 }}>Siguiente</Text>
                    <Icon name="chevron-right" size={14} color="#94A3B8" />
                </TouchableOpacity>
            </View>

            {/* ── Totales ── */}
            <View className="flex-row justify-between items-center mb-3 px-1">
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total efectivo {isToday ? 'actual' : 'del día'}</Text>
                <Text className="text-orange-400 font-black text-base" style={{ fontFamily: 'Space Grotesk' }}>
                    ${formatCurrency(displayResumen?.totalEfectivo ?? 0)}
                </Text>
            </View>
            <View className="pb-4 border-b border-white/5">
                <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                    Flujo bruto (billetes que pasaron)
                </Text>
                <View className="flex-row justify-between flex-wrap gap-1">
                    <Text className="text-slate-500 text-xs">Entradas: <Text className="text-emerald-400 font-bold">${formatCurrency(displayResumen?.totalEntradas ?? 0)}</Text></Text>
                    <Text className="text-slate-500 text-xs">Salidas: <Text className="text-red-400 font-bold">${formatCurrency(displayResumen?.totalSalidas ?? 0)}</Text></Text>
                </View>
            </View>

            {loadingPast && (
                <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11, textAlign: 'center', paddingVertical: 12 }}>
                    Cargando movimientos…
                </Text>
            )}

            {/* ── Botón ver historial ── */}
            {!loadingPast && movimientosActivos.length > 0 && (
                <TouchableOpacity
                    className="mt-4 p-3 bg-white/5 border border-white/10 rounded-xl flex-row items-center justify-between active:bg-white/10"
                    onPress={handleToggle}
                >
                    <View className="flex-row items-center gap-2">
                        <Icon name={showHistorial ? 'history' : 'history'} size={16} color="#94A3B8" />
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase' }}>
                            {showHistorial ? 'Ocultar historial' : `Ver historial (${movimientosActivos.length} mov.)`}
                        </Text>
                    </View>
                    <Icon name={showHistorial ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
                </TouchableOpacity>
            )}

            {!loadingPast && movimientosActivos.length === 0 && !isToday && (
                <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11, textAlign: 'center', paddingVertical: 12 }}>
                    Sin movimientos para {selectedDate}
                </Text>
            )}

            {/* ── Lista paginada ── */}
            {showHistorial && (
                <>
                    <View className="gap-2 mt-3">
                        {visibleMovimientos.map((mov: CajaMovimiento) => {
                            const { name: iconName, color: iconColor } = getIconInfo(mov.tipo);
                            const isPos = mov.tipo === 'entrada' || mov.tipo === 'apertura';
                            return (
                                <View key={mov.id} className="flex-row items-center justify-between p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                                    <View className="flex-row items-center gap-3 flex-1 mr-2">
                                        <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: `${iconColor}15` }}>
                                            <Icon name={iconName} size={16} color={iconColor} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontFamily: 'Outfit', color: '#E2E8F0', fontSize: 13, fontWeight: 'bold' }} numberOfLines={1}>
                                                {mov.descripcion || (mov.tipo.charAt(0).toUpperCase() + mov.tipo.slice(1))}
                                            </Text>
                                            <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, marginTop: 2 }}>
                                                {new Date(mov.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                            {renderDenomJSX(mov.denominaciones)}
                                            {mov.metodo === 'efectivo_transferencia' && (
                                                <Text style={{ fontFamily: 'Outfit', color: '#F59E0B', fontSize: 9, marginTop: 2 }}>
                                                    ◈ Mixto{mov.pagoTransferencia ? ` · 🔁 QR $${formatCurrency(mov.pagoTransferencia)}` : ''}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, color: isPos ? '#10B981' : '#F43F5E' }}>
                                        {isPos ? '+' : '-'}${formatCurrency(mov.total)}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>

                    {/* ── Paginación ── */}
                    {totalPages > 1 && (
                        <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-white/5">
                            <TouchableOpacity
                                onPress={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className={`flex-row items-center gap-1 px-3 py-2 rounded-xl border ${page === 0 ? 'border-white/5 opacity-30' : 'border-white/10 bg-white/5 active:bg-white/10'}`}
                            >
                                <Icon name="chevron-left" size={16} color="#94A3B8" />
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 11 }}>Anterior</Text>
                            </TouchableOpacity>

                            <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11 }}>
                                Pág. <Text style={{ color: '#94A3B8', fontWeight: 'bold' }}>{page + 1}</Text> / {totalPages}
                            </Text>

                            <TouchableOpacity
                                onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className={`flex-row items-center gap-1 px-3 py-2 rounded-xl border ${page >= totalPages - 1 ? 'border-white/5 opacity-30' : 'border-white/10 bg-white/5 active:bg-white/10'}`}
                            >
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 11 }}>Siguiente</Text>
                                <Icon name="chevron-right" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                    )}
                </>
            )}
        </Card>

        {showAjusteModal && (
            <AjusteCajaModal
                visible={showAjusteModal}
                onClose={() => setShowAjusteModal(false)}
                onSuccess={onRefresh}
                estadoActual={cajaResumen?.estadoActual || {}}
                cajaOrigen={cajaOrigen}
            />
        )}
        </>
    );
}
