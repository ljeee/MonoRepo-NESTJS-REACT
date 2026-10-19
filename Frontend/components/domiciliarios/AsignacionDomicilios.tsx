import React, { useState } from 'react';
import { ActivityIndicator, Linking } from 'react-native';
import { Text, View, TouchableOpacity, Pressable } from '../../tw';
import { formatCOP, timeAgo } from '@/src/shared';
import type { Domiciliario } from '@/src/shared';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { DomiciliarioPicker } from './DomiciliarioPicker';

/** Domicilio del día tal como lo devuelve `GET /domicilios/dia/todos` (solo lo que esta pantalla usa). */
export type DomicilioAsignacion = {
    domicilioId: number;
    fechaCreado: string;
    direccionEntrega?: string;
    referenciaDomicilio?: string;
    costoDomicilio?: number;
    estadoDomicilio?: string;
    telefono?: string;
    telefonoDomiciliarioAsignado?: string;
    factura?: {
        clienteNombre?: string;
        total?: number;
        estado?: string;
        /** 'efectivo' | 'qr' | 'transferencia' | 'efectivo_transferencia' */
        metodo?: string;
        pagoEfectivo?: number;
        pagoTransferencia?: number;
    };
    orden?: { ordenId: number; estadoOrden?: string; productos?: { producto: string; cantidad: number; precioUnitario?: number }[] };
    cliente?: { clienteNombre?: string; telefono?: string };
};

const NARANJA = '#FB923C';
const VERDE = '#10B981';
const AZUL = '#60A5FA';

// ─── Estado de cobro ──────────────────────────────────────────────────────────

/**
 * Una sola línea de cobro: le dice al despachador si el repartidor debe cobrar al entregar y cuánto.
 * Pagado → verde/azul con el método; pendiente → naranja con el monto grande.
 */
export function PagoChip({ factura }: { factura?: DomicilioAsignacion['factura'] }) {
    const pagado = factura?.estado === 'pagado' || factura?.estado === 'pagada';
    const metodo = factura?.metodo;

    let icono: IconName = 'cash-clock';
    let color = NARANJA;
    let titulo = 'Por cobrar';
    let sub = 'El repartidor cobra al entregar';

    if (pagado) {
        sub = 'No cobrar al entregar';
        if (metodo === 'efectivo_transferencia') {
            icono = 'check-circle';
            color = VERDE;
            titulo = 'Pagado · Mixto';
            const partes = [(factura?.pagoEfectivo ?? 0) > 0 ? `Ef. ${formatCOP(factura?.pagoEfectivo)}` : '', (factura?.pagoTransferencia ?? 0) > 0 ? `QR ${formatCOP(factura?.pagoTransferencia)}` : ''];
            sub = partes.filter(Boolean).join(' · ') || sub;
        } else if (metodo === 'qr' || metodo === 'transferencia') {
            icono = 'qrcode-scan';
            color = AZUL;
            titulo = 'Pagado · QR';
        } else if (metodo === 'efectivo') {
            icono = 'cash-check';
            color = VERDE;
            titulo = 'Pagado · Efectivo';
        } else {
            icono = 'check-circle';
            color = VERDE;
            titulo = 'Pagado';
        }
    }

    return (
        <View className="flex-row items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: `${color}14`, borderWidth: 1, borderColor: `${color}33` }}>
            <Icon name={icono} size={18} color={color} />
            <View className="flex-1">
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color, fontSize: 12 }}>{titulo}</Text>
                <Text className="text-slate-500 text-[10px] mt-0.5" numberOfLines={1}>
                    {sub}
                </Text>
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color, fontSize: pagado ? 14 : 18 }}>{formatCOP(factura?.total)}</Text>
        </View>
    );
}

// ─── Piezas comunes ───────────────────────────────────────────────────────────

const nombreCliente = (d: DomicilioAsignacion) => d.cliente?.clienteNombre || d.factura?.clienteNombre || 'Sin nombre';

function Cabecera({ d, etiqueta, children }: { d: DomicilioAsignacion; etiqueta: React.ReactNode; children?: React.ReactNode }) {
    return (
        <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-(--color-pos-primary) font-black text-xs" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>
                        #{d.orden?.ordenId ?? d.domicilioId}
                    </Text>
                    {etiqueta}
                    <Text className="text-slate-600 text-[10px]">{timeAgo(d.fechaCreado)}</Text>
                </View>
                <Text className="text-white font-black text-base" style={{ fontFamily: 'SpaceGrotesk-Bold' }} numberOfLines={1}>
                    {nombreCliente(d)}
                </Text>
            </View>
            {children}
        </View>
    );
}

function Pildora({ texto, color }: { texto: string; color: string }) {
    return (
        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}1A`, borderWidth: 1, borderColor: `${color}33` }}>
            <Text style={{ color, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 }}>{texto}</Text>
        </View>
    );
}

function DatosEntrega({ d }: { d: DomicilioAsignacion }) {
    const [verTodos, setVerTodos] = useState(false);
    const productos = d.orden?.productos ?? [];
    const visibles = verTodos ? productos : productos.slice(0, 2);
    return (
        <View className="gap-1.5">
            {d.direccionEntrega ? (
                <View className="flex-row items-start gap-2">
                    <Icon name="map-marker-outline" size={14} color="#64748B" />
                    <Text className="text-slate-300 text-xs flex-1" numberOfLines={2}>
                        {d.direccionEntrega}
                    </Text>
                </View>
            ) : null}
            <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
                {d.telefono ? (
                    <View className="flex-row items-center gap-1.5">
                        <Icon name="phone-outline" size={13} color="#64748B" />
                        <Text className="text-slate-400 text-xs">{d.telefono}</Text>
                    </View>
                ) : null}
                {d.costoDomicilio ? (
                    <View className="flex-row items-center gap-1.5">
                        <Icon name="moped-outline" size={13} color="#64748B" />
                        <Text className="text-slate-400 text-xs">Envío {formatCOP(d.costoDomicilio)}</Text>
                    </View>
                ) : null}
            </View>
            {productos.length > 0 ? (
                <View className="mt-1">
                    {visibles.map((p, i) => (
                        <Text key={i} className="text-slate-500 text-[11px] leading-5" numberOfLines={1}>
                            {p.cantidad}× {p.producto}
                        </Text>
                    ))}
                    {productos.length > 2 ? (
                        <Pressable onPress={() => setVerTodos((v) => !v)} hitSlop={8}>
                            <Text className="text-(--color-pos-primary) text-[11px] font-bold mt-0.5">{verTodos ? 'Ver menos' : `Ver los ${productos.length} productos`}</Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

// ─── Pedido sin domiciliario ──────────────────────────────────────────────────

interface PropsComunes {
    domicilio: DomicilioAsignacion;
    domiciliarios: Domiciliario[];
    /** Teléfono elegido en el selector (vacío = ninguno). */
    seleccion?: string;
    ocupado: boolean;
    onSeleccionar: (domicilioId: number, telefono: string) => void;
    onAsignar: (domicilioId: number) => void;
    onEliminar: (domicilioId: number) => void;
}

export const DomicilioSinAsignarCard = React.memo(function DomicilioSinAsignarCard({ domicilio: d, domiciliarios, seleccion, ocupado, onSeleccionar, onAsignar, onEliminar }: PropsComunes) {
    const listo = !!seleccion;
    return (
        <Card padding="md" className="gap-3">
            <Cabecera d={d} etiqueta={<Pildora texto="Sin asignar" color={NARANJA} />}>
                <IconButton icon="trash-can-outline" tone="danger" size="sm" accessibilityLabel="Eliminar domicilio" onPress={() => onEliminar(d.domicilioId)} disabled={ocupado} />
            </Cabecera>

            <PagoChip factura={d.factura} />
            <DatosEntrega d={d} />

            {/* Asignación: selector y botón en la misma fila */}
            <View className="flex-row items-stretch gap-2 pt-1">
                <View className="flex-1 bg-black/30 rounded-xl border border-white/10 overflow-hidden min-h-[46px] justify-center">
                    <DomiciliarioPicker
                        value={seleccion ?? ''}
                        onChange={(tel) => onSeleccionar(d.domicilioId, tel)}
                        domiciliarios={domiciliarios}
                        placeholder="Elegir domiciliario…"
                        emptyText="No hay domiciliarios registrados"
                    />
                </View>
                <TouchableOpacity
                    onPress={() => onAsignar(d.domicilioId)}
                    disabled={ocupado || !listo}
                    accessibilityLabel="Asignar domiciliario"
                    className={`px-5 rounded-xl items-center justify-center flex-row gap-2 ${listo ? 'bg-(--color-pos-primary)' : 'bg-white/5 border border-white/10'} ${ocupado ? 'opacity-60' : ''}`}
                >
                    {ocupado ? (
                        <ActivityIndicator size="small" color="#000" />
                    ) : (
                        <>
                            <Icon name="account-check-outline" size={16} color={listo ? '#000' : '#475569'} />
                            <Text className={`font-black text-[11px] uppercase tracking-widest ${listo ? 'text-black' : 'text-slate-500'}`}>Asignar</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </Card>
    );
});

// ─── Pedido ya asignado ───────────────────────────────────────────────────────

function abrirMapa(lat: number, lng: number) {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {});
}

/** Verde ≤ 3 min, naranja ≤ 10 min, rojo si hace más: el despachador ve de un vistazo si el repartidor reporta. */
function colorFrescura(fecha: string): string {
    const minutos = (Date.now() - new Date(fecha).getTime()) / 60000;
    return minutos <= 3 ? VERDE : minutos <= 10 ? NARANJA : '#F43F5E';
}

export const DomicilioAsignadoCard = React.memo(function DomicilioAsignadoCard({
    domicilio: d,
    domiciliarios,
    seleccion,
    ocupado,
    onSeleccionar,
    onAsignar,
    onEliminar,
    onReenviar,
}: PropsComunes & { onReenviar: (domicilioId: number) => void }) {
    const actual = domiciliarios.find((x) => x.telefono === d.telefonoDomiciliarioAsignado);
    const cambiado = !!seleccion && seleccion !== d.telefonoDomiciliarioAsignado;
    const tieneUbicacion = !!actual?.ultimaUbicacionFecha && actual.ultimaLatitud != null && actual.ultimaLongitud != null;

    return (
        <Card padding="md" className="gap-3">
            <Cabecera d={d} etiqueta={<Pildora texto="Asignado" color={VERDE} />}>
                <IconButton icon="trash-can-outline" tone="danger" size="sm" accessibilityLabel="Eliminar domicilio" onPress={() => onEliminar(d.domicilioId)} disabled={ocupado} />
            </Cabecera>

            {/* Quién lo lleva y si está reportando su ubicación */}
            <View className="rounded-xl px-3 py-2.5 bg-white/[0.03] border border-white/5">
                <Text className="text-white text-sm font-bold" numberOfLines={1}>
                    {actual?.domiciliarioNombre || d.telefonoDomiciliarioAsignado}
                </Text>
                {tieneUbicacion ? (
                    <TouchableOpacity className="flex-row items-center gap-2 mt-1" onPress={() => abrirMapa(actual!.ultimaLatitud!, actual!.ultimaLongitud!)} accessibilityLabel="Ver ubicación del domiciliario en el mapa">
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorFrescura(actual!.ultimaUbicacionFecha!) }} />
                        <Text className="text-slate-400 text-[11px] font-bold flex-1">Ubicación {timeAgo(actual!.ultimaUbicacionFecha!)} · Ver en mapa</Text>
                        <Icon name="open-in-new" size={12} color="#64748B" />
                    </TouchableOpacity>
                ) : (
                    <View className="flex-row items-center gap-2 mt-1">
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#475569' }} />
                        <Text className="text-slate-600 text-[11px]">Sin ubicación reciente</Text>
                    </View>
                )}
            </View>

            <PagoChip factura={d.factura} />
            <DatosEntrega d={d} />

            {/* Reasignar o reenviar al mismo */}
            <View className="flex-row items-stretch gap-2 pt-1">
                <View className="flex-1 bg-black/30 rounded-xl border border-white/10 overflow-hidden min-h-[46px] justify-center">
                    <DomiciliarioPicker
                        value={seleccion ?? d.telefonoDomiciliarioAsignado ?? ''}
                        onChange={(tel) => onSeleccionar(d.domicilioId, tel)}
                        domiciliarios={domiciliarios}
                        placeholder="Reasignar a otro…"
                    />
                </View>
                <TouchableOpacity
                    onPress={() => onReenviar(d.domicilioId)}
                    disabled={ocupado}
                    accessibilityLabel="Reenviar el pedido por WhatsApp"
                    className={`w-12 rounded-xl items-center justify-center bg-emerald-500/10 border border-emerald-500/20 ${ocupado ? 'opacity-50' : ''}`}
                >
                    <Icon name="whatsapp" size={18} color={VERDE} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onAsignar(d.domicilioId)}
                    disabled={ocupado || !cambiado}
                    accessibilityLabel="Confirmar reasignación"
                    className={`w-12 rounded-xl items-center justify-center ${cambiado ? 'bg-(--color-pos-primary)' : 'bg-white/5 border border-white/10'} ${ocupado ? 'opacity-50' : ''}`}
                >
                    {ocupado ? <ActivityIndicator size="small" color="#000" /> : <Icon name="send-outline" size={17} color={cambiado ? '#000' : '#475569'} />}
                </TouchableOpacity>
            </View>
        </Card>
    );
});
