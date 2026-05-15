import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from '../../tw';
import Icon from '../ui/Icon';
import type { Orden } from '@monorepo/shared';

type Props = {
    orden: Orden;
    onPress?: () => void;
    onListo?: () => void;
    /** Si es true, oculta el botón Listo (modo lectura KDS fullscreen) */
    readOnly?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getProductoName = (p: any) => p.productoNombre || p.producto || 'Producto';

const getTipoPedidoInfo = (tipo?: string) => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('domicilio')) return {
        label: 'DOMICILIO', icon: 'motorbike' as const,
        color: '#F5A524', bg: 'bg-amber-500/15', border: 'border-amber-500/30',
    };
    if (t.includes('llevar')) return {
        label: 'PARA LLEVAR', icon: 'bag-personal-outline' as const,
        color: '#60A5FA', bg: 'bg-blue-500/15', border: 'border-blue-500/30',
    };
    return {
        label: tipo ? tipo.toUpperCase() : 'MESA', icon: 'silverware-fork-knife' as const,
        color: '#94A3B8', bg: 'bg-slate-700/30', border: 'border-slate-600/30',
    };
};

/**
 * Returns urgency level + colors based on elapsed minutes.
 *   0–4 min   → blue    (nueva — recién llegó)
 *   5–19 min  → green   (a tiempo)
 *   20–29 min → yellow  (atención)
 *   30+ min   → red     (urgente)
 */
const getUrgencyInfo = (mins: number, estado?: string) => {
    if (estado !== 'pendiente') {
        return { level: 'done' as const, stripe: '#10B981', ring: '#10B981', text: '#10B981', label: 'LISTO' };
    }
    if (mins >= 30) return { level: 'urgente' as const, stripe: '#EF4444', ring: '#EF4444', text: '#F87171', label: 'URGENTE' };
    if (mins >= 20) return { level: 'atencion' as const, stripe: '#EAB308', ring: '#EAB308', text: '#FDE047', label: 'ATENCIÓN' };
    if (mins >= 5)  return { level: 'ok' as const, stripe: '#22C55E', ring: '#22C55E', text: '#86EFAC', label: 'A TIEMPO' };
    return           { level: 'nueva' as const, stripe: '#3B82F6', ring: '#60A5FA', text: '#93C5FD', label: 'NUEVA' };
};

/** Formatea la hora de la orden: "10:34 a. m." */
function formatHora(fechaStr: string | Date): string {
    const d = new Date(fechaStr);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

// ── Circular Timer ────────────────────────────────────────────────────────────
function CircularTimer({ mins, urgency }: { mins: number; urgency: ReturnType<typeof getUrgencyInfo> }) {
    const SIZE = 56;
    const STROKE = 4;
    return (
        <View style={{
            width: SIZE, height: SIZE, borderRadius: SIZE / 2,
            borderWidth: STROKE, borderColor: urgency.ring,
            backgroundColor: `${urgency.ring}1A`,
            alignItems: 'center', justifyContent: 'center',
        }}>
            <Text style={{ color: urgency.text, fontSize: 16, fontFamily: 'SpaceGrotesk-Bold', lineHeight: 18 }}>
                {mins > 0 ? mins : '<1'}
            </Text>
            <Text style={{ color: urgency.text, fontSize: 7, fontFamily: 'Outfit', opacity: 0.8, letterSpacing: 0.5 }}>
                MIN
            </Text>
        </View>
    );
}

// ── Main card ─────────────────────────────────────────────────────────────────
function OrderCardKDS({ orden, onPress, onListo, readOnly = false }: Props) {
    const [diffMins, setDiffMins] = useState(() =>
        Math.max(0, Math.floor((Date.now() - new Date(orden.fechaOrden).getTime()) / 60000))
    );

    useEffect(() => {
        const iv = setInterval(() => {
            setDiffMins(Math.max(0, Math.floor((Date.now() - new Date(orden.fechaOrden).getTime()) / 60000)));
        }, 30000);
        return () => clearInterval(iv);
    }, [orden.fechaOrden]);

    const tipoInfo = getTipoPedidoInfo(orden.tipoPedido);
    const urgency = getUrgencyInfo(diffMins, orden.estadoOrden);

    // Mirror the getClientName logic from OrdersOfDayPending
    const rawName = (orden as any).factura?.clienteNombre || orden.nombreCliente;
    let displayName: string;
    if (!rawName) {
        displayName = orden.tipoPedido?.toLowerCase() === 'mesa'
            ? `Mesa ${(orden as any).mesa || ''}`
            : 'Sin nombre';
    } else if (orden.tipoPedido?.toLowerCase() === 'mesa') {
        displayName = /^\d+$/.test(rawName)
            ? `Mesa ${rawName}`
            : rawName.startsWith('Mesa') ? rawName : `Mesa ${rawName}`;
    } else {
        displayName = rawName;
    }

    const hasNotas = !!(orden.observaciones?.trim());
    const hasWarnings = orden.observaciones?.toLowerCase().includes('alergia') ||
        orden.observaciones?.toLowerCase().includes('sin ') ||
        orden.observaciones?.toLowerCase().includes('no ');

    const horaOrden = formatHora(orden.fechaOrden);

    return (
        <View style={{
            borderRadius: 16, overflow: 'hidden', flex: 1,
            backgroundColor: '#080B14',           // negro profundo
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        }}>
            {/* ── Color stripe (left edge) ───────────────────────────────────── */}
            <View style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                backgroundColor: urgency.stripe,
                ...(urgency.level === 'urgente' ? { shadowColor: urgency.stripe, shadowOpacity: 0.9, shadowRadius: 8 } : {}),
            }} />

            {/* ── Header ────────────────────────────────────────────────────── */}
            <View style={{ paddingLeft: 16, paddingRight: 12, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>

                    {/* Left: tipo badge + order ID + hora + name + address */}
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        {/* Row: tipo + ID */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                            <View style={{
                                flexDirection: 'row', alignItems: 'center', gap: 4,
                                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                                backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                                alignSelf: 'flex-start',
                            }}>
                                <Icon name={tipoInfo.icon} size={11} color={tipoInfo.color} />
                                <Text style={{ color: tipoInfo.color, fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', letterSpacing: 1 }}>
                                    {tipoInfo.label}
                                </Text>
                            </View>
                            <Text style={{ color: '#F5A524', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold' }}>
                                #{orden.ordenId}
                            </Text>
                        </View>

                        {/* Client name */}
                        <Text
                            numberOfLines={1}
                            style={{ color: '#F8FAFC', fontSize: 17, fontFamily: 'SpaceGrotesk-Bold', lineHeight: 21 }}
                        >
                            {displayName}
                        </Text>

                        {/* Hora de la orden */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <Icon name="clock-outline" size={11} color="#94A3B8" />
                            <Text style={{ color: '#94A3B8', fontSize: 11, fontFamily: 'Outfit' }}>
                                {horaOrden}
                            </Text>
                        </View>

                        {/* Address for domicilio */}
                        {orden.tipoPedido === 'domicilio' && orden.domicilios?.[0]?.direccionEntrega && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                <Icon name="map-marker-outline" size={11} color="#94A3B8" />
                                <Text
                                    numberOfLines={1}
                                    style={{ color: '#94A3B8', fontSize: 11, fontFamily: 'Outfit', flex: 1 }}
                                >
                                    {orden.domicilios[0].direccionEntrega}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Right: Circular timer */}
                    <CircularTimer mins={diffMins} urgency={urgency} />
                </View>
            </View>

            {/* ── Notas ─────────────────────────────────────────────────────── */}
            {hasNotas && (
                <View style={{
                    marginHorizontal: 12, marginTop: 10,
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderRadius: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                    backgroundColor: hasWarnings ? 'rgba(239,68,68,0.08)' : 'rgba(245,165,36,0.08)',
                    borderWidth: 1,
                    borderColor: hasWarnings ? 'rgba(239,68,68,0.25)' : 'rgba(245,165,36,0.25)',
                }}>
                    <Icon
                        name={hasWarnings ? 'alert-circle-outline' : 'note-text-outline'}
                        size={13}
                        color={hasWarnings ? '#F87171' : '#FBBF24'}
                    />
                    <Text
                        numberOfLines={4}
                        style={{
                            flex: 1, fontSize: 11, fontFamily: 'Outfit', fontStyle: 'italic', lineHeight: 17,
                            color: hasWarnings ? '#FCA5A5' : '#FDE68A',
                        }}
                    >
                        "{orden.observaciones}"
                    </Text>
                </View>
            )}

            {/* ── Products ──────────────────────────────────────────────────── */}
            <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: readOnly ? 14 : 6, gap: 7 }}>
                <Text style={{ fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', color: '#334155', letterSpacing: 1.5, marginBottom: 2, textTransform: 'uppercase' }}>
                    Productos
                </Text>
                {orden.productos?.map((p: any, idx: number) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{
                            backgroundColor: 'rgba(245,165,36,0.12)', borderWidth: 1,
                            borderColor: 'rgba(245,165,36,0.25)', borderRadius: 8,
                            paddingHorizontal: 8, paddingVertical: 3, minWidth: 34, alignItems: 'center',
                        }}>
                            <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, lineHeight: 17 }}>
                                {p.cantidad}
                            </Text>
                        </View>
                        <Text numberOfLines={2} style={{ flex: 1, color: '#CBD5E1', fontSize: 13, fontFamily: 'Outfit', lineHeight: 18 }}>
                            {getProductoName(p)}
                        </Text>
                    </View>
                ))}
                {!orden.productos?.length && (
                    <Text style={{ color: '#475569', fontStyle: 'italic', fontSize: 11, fontFamily: 'Outfit' }}>
                        Sin productos cargados
                    </Text>
                )}
            </View>

            {/* ── LISTO button (oculto en modo readOnly) ────────────────────── */}
            {!readOnly && (
                <TouchableOpacity
                    onPress={onListo || onPress}
                    activeOpacity={0.75}
                    style={{
                        marginHorizontal: 12, marginBottom: 12, marginTop: 4,
                        backgroundColor: 'rgba(16,185,129,0.10)',
                        borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
                        borderRadius: 12, paddingVertical: 11,
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                >
                    <Icon name="check-circle-outline" size={15} color="#10B981" />
                    <Text style={{ color: '#10B981', fontFamily: 'SpaceGrotesk-Bold', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                        Listo
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

export default React.memo(OrderCardKDS);
