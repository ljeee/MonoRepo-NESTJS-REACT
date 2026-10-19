import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Text, View } from '../../tw';
import { api } from '../../services/api';
import { useToast, formatCOP } from '@/src/shared';
import type { Domiciliario } from '@/src/shared';
import { CardGrid, Icon, IconButton, LoadingState, PageContainer, PageHeader, PosRefreshControl, SectionHeader, StatCard } from '../../components/ui';
import {
    DomicilioAsignadoCard,
    DomicilioSinAsignarCard,
    type DomicilioAsignacion,
} from '../../components/domiciliarios/AsignacionDomicilios';
import { sendWhatsAppDomicilio } from '../../utils/printReceipt';

const NARANJA = '#FB923C';
const VERDE = '#10B981';

const estaPagado = (d: DomicilioAsignacion) => d.factura?.estado === 'pagado' || d.factura?.estado === 'pagada';

/** Texto de pago para el mensaje al repartidor: lo que debe saber para cobrar (o no) al entregar. */
function textoPago(d: DomicilioAsignacion): string {
    const total = formatCOP(d.factura?.total);
    if (!estaPagado(d)) return `POR COBRAR ${total} al entregar`;
    const metodo = d.factura?.metodo;
    const como = metodo === 'efectivo' ? 'efectivo' : metodo === 'efectivo_transferencia' ? 'mixto' : metodo === 'qr' || metodo === 'transferencia' ? 'QR' : '';
    return `YA PAGADO${como ? ` (${como})` : ''} - no cobrar`;
}

/** Datos del mensaje de WhatsApp que recibe el domiciliario. */
function datosMensaje(d: DomicilioAsignacion) {
    return {
        clienteNombre: d.cliente?.clienteNombre || d.factura?.clienteNombre || 'Sin nombre',
        direccion: d.direccionEntrega || 'Sin dirección',
        referencia: d.referenciaDomicilio || undefined,
        telefonoCliente: d.telefono || undefined,
        productos: (d.orden?.productos || []).map((p) => ({
            nombre: p.producto,
            cantidad: p.cantidad,
            precioUnitario: Number(p.precioUnitario) || 0,
        })),
        total: Number(d.factura?.total || 0),
        costoDomicilio: Number(d.costoDomicilio || 0),
        metodo: textoPago(d),
    };
}

export default function AsignarDomiciliariosScreen() {
    const { showToast } = useToast();
    const [domicilios, setDomicilios] = useState<DomicilioAsignacion[]>([]);
    const [asignados, setAsignados] = useState<DomicilioAsignacion[]>([]);
    const [domiciliarios, setDomiciliarios] = useState<Domiciliario[]>([]);
    const [seleccion, setSeleccion] = useState<Record<number, string>>({});
    const [ocupados, setOcupados] = useState<Record<number, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [delDia, todos] = await Promise.all([api.domicilios.getAllDay(), api.domiciliarios.getAll()]);
            const lista = delDia as DomicilioAsignacion[];
            setDomicilios(lista.filter((d) => !d.telefonoDomiciliarioAsignado));
            setAsignados(lista.filter((d) => !!d.telefonoDomiciliarioAsignado));
            setDomiciliarios(todos);
        } catch {
            showToast('Error al cargar los datos', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    // Posición de los repartidores y pedidos nuevos: se refresca solo cada 30 s.
    useEffect(() => {
        const id = setInterval(() => void fetchData(), 30000);
        return () => clearInterval(id);
    }, [fetchData]);

    const marcarOcupado = useCallback((id: number, valor: boolean) => setOcupados((prev) => ({ ...prev, [id]: valor })), []);
    const seleccionar = useCallback((id: number, telefono: string) => setSeleccion((prev) => ({ ...prev, [id]: telefono })), []);

    const asignar = useCallback(
        async (domicilioId: number) => {
            const telefono = seleccion[domicilioId];
            if (!telefono) {
                showToast('Selecciona un domiciliario primero', 'warning');
                return;
            }
            marcarOcupado(domicilioId, true);
            try {
                await api.domicilios.update(domicilioId, { telefonoDomiciliarioAsignado: telefono });
                showToast('Domiciliario asignado correctamente', 'success');
                const entrada = domicilios.find((d) => d.domicilioId === domicilioId) || asignados.find((d) => d.domicilioId === domicilioId);
                if (entrada) sendWhatsAppDomicilio(telefono, datosMensaje(entrada));
                setSeleccion((prev) => {
                    const { [domicilioId]: _quitado, ...resto } = prev;
                    return resto;
                });
                void fetchData();
            } catch {
                showToast('Error al asignar el domiciliario', 'error');
            } finally {
                marcarOcupado(domicilioId, false);
            }
        },
        [seleccion, domicilios, asignados, showToast, fetchData, marcarOcupado],
    );

    const reenviar = useCallback(
        (domicilioId: number) => {
            const entrada = asignados.find((d) => d.domicilioId === domicilioId);
            if (entrada?.telefonoDomiciliarioAsignado) sendWhatsAppDomicilio(entrada.telefonoDomiciliarioAsignado, datosMensaje(entrada));
        },
        [asignados],
    );

    const ejecutarEliminar = useCallback(
        async (domicilioId: number) => {
            marcarOcupado(domicilioId, true);
            try {
                await api.domicilios.remove(domicilioId);
                showToast('Domicilio eliminado', 'success');
                void fetchData();
            } catch {
                showToast('Error al eliminar domicilio', 'error');
            } finally {
                marcarOcupado(domicilioId, false);
            }
        },
        [fetchData, showToast, marcarOcupado],
    );

    const eliminar = useCallback(
        (domicilioId: number) => {
            const mensaje = '¿Seguro que deseas eliminar este domicilio?';
            if (Platform.OS === 'web') {
                if (window.confirm(mensaje)) void ejecutarEliminar(domicilioId);
            } else {
                Alert.alert('Eliminar', mensaje, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => void ejecutarEliminar(domicilioId) },
                ]);
            }
        },
        [ejecutarEliminar],
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void fetchData();
    }, [fetchData]);

    // Plata que los repartidores deben cobrar hoy (pedidos no pagados), asignados o no.
    const porCobrar = useMemo(
        () => [...domicilios, ...asignados].filter((d) => !estaPagado(d)).reduce((t, d) => t + (Number(d.factura?.total) || 0), 0),
        [domicilios, asignados],
    );

    if (loading) {
        return (
            <PageContainer>
                <LoadingState className="flex-1" />
            </PageContainer>
        );
    }

    return (
        <PageContainer refreshControl={<PosRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            <PageHeader
                title="Asignar Domiciliarios"
                icon="map-marker-account-outline"
                subtitle="Operativo"
                rightContent={<IconButton icon="refresh" accessibilityLabel="Actualizar" onPress={onRefresh} />}
            />

            {/* Resumen: lo que falta por hacer, lo ya repartido y la plata en la calle */}
            <View className="flex-row flex-wrap gap-3 mb-6">
                <StatCard
                    variant="counter"
                    label="Sin asignar"
                    value={String(domicilios.length)}
                    color={domicilios.length > 0 ? NARANJA : VERDE}
                    urgent={domicilios.length > 0}
                    tinted={domicilios.length > 0}
                />
                <StatCard variant="counter" label="Asignados hoy" value={String(asignados.length)} color={VERDE} />
                <StatCard variant="counter" label="Por cobrar en calle" value={formatCOP(porCobrar)} color={porCobrar > 0 ? NARANJA : VERDE} urgent={porCobrar > 0} />
            </View>

            <SectionHeader title="Pedidos sin domiciliario" icon="truck-alert-outline" color={domicilios.length > 0 ? NARANJA : VERDE} count={domicilios.length} />
            {domicilios.length === 0 ? (
                <View className="items-center py-12 mb-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/5">
                    <Icon name="check-circle-outline" size={44} color={VERDE} />
                    <Text className="text-emerald-400 font-black text-base mt-3" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>
                        ¡Todo asignado!
                    </Text>
                    <Text className="text-slate-500 text-xs mt-1 text-center px-6">Todos los domicilios de hoy ya tienen un repartidor</Text>
                </View>
            ) : (
                <CardGrid
                    kind="panel"
                    minItemWidth={340}
                    data={domicilios}
                    keyExtractor={(d) => String(d.domicilioId)}
                    renderItem={(d) => (
                        <DomicilioSinAsignarCard
                            domicilio={d}
                            domiciliarios={domiciliarios}
                            seleccion={seleccion[d.domicilioId]}
                            ocupado={!!ocupados[d.domicilioId]}
                            onSeleccionar={seleccionar}
                            onAsignar={asignar}
                            onEliminar={eliminar}
                        />
                    )}
                />
            )}

            {asignados.length > 0 && (
                <View className="mt-8 mb-6">
                    <SectionHeader title="Asignados hoy" icon="check-all" color={VERDE} count={asignados.length} />
                    <CardGrid
                        kind="panel"
                        minItemWidth={340}
                        data={asignados}
                        keyExtractor={(d) => String(d.domicilioId)}
                        renderItem={(d) => (
                            <DomicilioAsignadoCard
                                domicilio={d}
                                domiciliarios={domiciliarios}
                                seleccion={seleccion[d.domicilioId]}
                                ocupado={!!ocupados[d.domicilioId]}
                                onSeleccionar={seleccionar}
                                onAsignar={asignar}
                                onEliminar={eliminar}
                                onReenviar={reenviar}
                            />
                        )}
                    />
                </View>
            )}
        </PageContainer>
    );
}
