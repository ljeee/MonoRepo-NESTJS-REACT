import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { ScrollView, Text, View, TouchableOpacity, Pressable } from '../../tw';
import { api } from '../../services/api';
import { useToast } from '@monorepo/shared';
import type { Domiciliario } from '@monorepo/shared';
import { PageContainer, PageHeader, Card } from '../../components/ui';
import Icon from '../../components/ui/Icon';
import { useBreakpoint } from '../../styles/responsive';
import { sendWhatsAppDomicilio } from '../../utils/printReceipt';

type DomicilioSinAsignar = {
    domicilioId: number;
    fechaCreado: string;
    direccionEntrega?: string;
    costoDomicilio?: number;
    estadoDomicilio?: string;
    telefono?: string;
    factura?: { clienteNombre?: string; total?: number; estado?: string };
    orden?: { ordenId: number; estadoOrden?: string; productos?: Array<{ producto: string; cantidad: number }> };
    cliente?: { clienteNombre?: string; telefono?: string };
};

function formatCurrency(n?: number) {
    if (!n) return '$0';
    return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h`;
}

export default function AsignarDomiciliariosScreen() {
    const { showToast } = useToast();
    const { isMobile } = useBreakpoint();
    const [domicilios, setDomicilios] = useState<DomicilioSinAsignar[]>([]);
    const [domiciliarios, setDomiciliarios] = useState<Domiciliario[]>([]);
    const [selectedDomiciliario, setSelectedDomiciliario] = useState<Record<number, string>>({});
    const [assigning, setAssigning] = useState<Record<number, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [sinAsignar, todos] = await Promise.all([
                api.domicilios.getSinAsignar(),
                api.domiciliarios.getAll(),
            ]);
            setDomicilios(sinAsignar as DomicilioSinAsignar[]);
            setDomiciliarios(todos);
        } catch {
            showToast('Error al cargar los datos', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    useEffect(() => {
        const id = setInterval(() => void fetchData(), 30000);
        return () => clearInterval(id);
    }, [fetchData]);

    const handleAsignar = async (domicilioId: number) => {
        const telefono = selectedDomiciliario[domicilioId];
        if (!telefono) {
            showToast('Selecciona un domiciliario primero', 'warning');
            return;
        }
        setAssigning(prev => ({ ...prev, [domicilioId]: true }));
        try {
            await api.domicilios.update(domicilioId, { telefonoDomiciliarioAsignado: telefono });
            showToast('Domiciliario asignado correctamente', 'success');
            const entry = domicilios.find(d => d.domicilioId === domicilioId);
            if (entry && typeof window !== 'undefined') {
                sendWhatsAppDomicilio(telefono, {
                    clienteNombre: entry.cliente?.clienteNombre || entry.factura?.clienteNombre || 'Sin nombre',
                    direccion: entry.direccionEntrega || 'Sin dirección',
                    telefonoCliente: entry.telefono || undefined,
                    productos: (entry.orden?.productos || []).map(p => ({
                        nombre: p.producto, cantidad: p.cantidad, precioUnitario: 0,
                    })),
                    total: Number(entry.factura?.total || 0),
                    costoDomicilio: Number(entry.costoDomicilio || 0),
                    metodo: entry.factura?.estado || 'N/A',
                });
            }
            setDomicilios(prev => prev.filter(d => d.domicilioId !== domicilioId));
        } catch {
            showToast('Error al asignar el domiciliario', 'error');
        } finally {
            setAssigning(prev => ({ ...prev, [domicilioId]: false }));
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        void fetchData();
    };

    if (loading) {
        return (
            <PageContainer>
                <View className="flex-1 items-center justify-center py-20">
                    <ActivityIndicator size="large" color="#F5A524" />
                </View>
            </PageContainer>
        );
    }

    return (
        <PageContainer
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A524" />
            }
        >
            <PageHeader
                title="Asignar Domiciliarios"
                icon="map-marker-account-outline"
                subtitle="Operativo"
                rightContent={
                    <Pressable
                        onPress={onRefresh}
                        className="p-3 bg-white/5 rounded-xl border border-white/10 active:bg-white/10"
                    >
                        <Icon name="refresh" size={18} color="#64748B" />
                    </Pressable>
                }
            />

            {/* Resumen */}
            <View className={`flex-row items-center gap-4 p-4 rounded-2xl border mb-6 ${domicilios.length > 0 ? 'bg-amber-500/5 border-amber-500/15' : 'bg-emerald-500/5 border-emerald-500/15'}`}>
                <View className={`w-10 h-10 rounded-xl items-center justify-center ${domicilios.length > 0 ? 'bg-amber-500/15' : 'bg-emerald-500/15'}`}>
                    <Icon
                        name={domicilios.length > 0 ? 'truck-alert-outline' : 'check-circle-outline'}
                        size={20}
                        color={domicilios.length > 0 ? '#F59E0B' : '#10B981'}
                    />
                </View>
                <View className="flex-1">
                    <Text
                        className={`font-black text-xl ${domicilios.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}
                        style={{ fontFamily: 'Space Grotesk' }}
                    >
                        {domicilios.length === 0
                            ? '¡Todo asignado!'
                            : `${domicilios.length} ${domicilios.length === 1 ? 'pedido' : 'pedidos'} sin domiciliario`}
                    </Text>
                    <Text className="text-slate-500 text-[11px]">
                        {domicilios.length === 0
                            ? 'No hay pedidos pendientes de asignación hoy'
                            : 'Asigna un domiciliario a cada pedido de domicilio'}
                    </Text>
                </View>
            </View>

            {domicilios.length === 0 ? (
                <View className="items-center py-16">
                    <Icon name="check-circle-outline" size={56} color="#10B981" />
                    <Text className="text-emerald-400 font-black text-lg mt-5" style={{ fontFamily: 'Space Grotesk' }}>
                        Sin pendientes
                    </Text>
                    <Text className="text-slate-500 text-sm mt-1 text-center">
                        Todos los domicilios de hoy ya tienen un repartidor asignado
                    </Text>
                </View>
            ) : (
                <View className="flex-row flex-wrap gap-4">
                    {domicilios.map(d => {
                        const clienteNombre =
                            d.cliente?.clienteNombre ||
                            d.factura?.clienteNombre ||
                            'Sin nombre';
                        const total = d.factura?.total;
                        const isAssigning = !!assigning[d.domicilioId];
                        const hasDomSelected = !!selectedDomiciliario[d.domicilioId];

                        return (
                            <Card
                                key={d.domicilioId}
                                className={`p-4 ${isMobile ? 'w-full' : 'min-w-[320px] max-w-[480px] flex-1'}`}
                            >
                                {/* Cabecera */}
                                <View className="flex-row items-start justify-between mb-3 pb-3 border-b border-white/5">
                                    <View className="flex-1 mr-3">
                                        <View className="flex-row items-center gap-2 mb-1">
                                            <Text
                                                className="text-(--color-pos-primary) font-black text-xs"
                                                style={{ fontFamily: 'Space Grotesk' }}
                                            >
                                                #{d.orden?.ordenId ?? d.domicilioId}
                                            </Text>
                                            <View className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                                                <Text className="text-amber-400 text-[8px] font-black uppercase tracking-wider">
                                                    Sin asignar
                                                </Text>
                                            </View>
                                        </View>
                                        <Text
                                            className="text-white font-black text-base"
                                            style={{ fontFamily: 'Space Grotesk' }}
                                            numberOfLines={1}
                                        >
                                            {clienteNombre}
                                        </Text>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-emerald-400 font-black text-sm">
                                            {formatCurrency(total)}
                                        </Text>
                                        <Text className="text-slate-600 text-[9px] mt-0.5">
                                            {timeAgo(d.fechaCreado)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Dirección */}
                                {d.direccionEntrega ? (
                                    <View className="flex-row items-center gap-2 mb-2">
                                        <Icon name="map-marker-outline" size={14} color="#64748B" />
                                        <Text className="text-slate-400 text-xs flex-1" numberOfLines={1}>
                                            {d.direccionEntrega}
                                        </Text>
                                    </View>
                                ) : null}

                                {/* Teléfono cliente */}
                                {d.telefono ? (
                                    <View className="flex-row items-center gap-2 mb-2">
                                        <Icon name="phone-outline" size={14} color="#64748B" />
                                        <Text className="text-slate-400 text-xs">{d.telefono}</Text>
                                    </View>
                                ) : null}

                                {/* Costo domicilio */}
                                {d.costoDomicilio ? (
                                    <View className="flex-row items-center gap-2 mb-2">
                                        <Icon name="moped-outline" size={14} color="#64748B" />
                                        <Text className="text-slate-400 text-xs">
                                            Envío: {formatCurrency(d.costoDomicilio)}
                                        </Text>
                                    </View>
                                ) : null}

                                {/* Productos */}
                                {d.orden?.productos && d.orden.productos.length > 0 ? (
                                    <View className="mb-3 mt-1 p-2.5 bg-black/20 rounded-xl">
                                        {d.orden.productos.slice(0, 3).map((p, idx) => (
                                            <Text key={idx} className="text-slate-400 text-[11px] leading-5" numberOfLines={1}>
                                                · {p.cantidad}× {p.producto}
                                            </Text>
                                        ))}
                                        {d.orden.productos.length > 3 && (
                                            <Text className="text-slate-600 text-[10px] mt-0.5">
                                                +{d.orden.productos.length - 3} producto(s) más
                                            </Text>
                                        )}
                                    </View>
                                ) : <View className="mb-2" />}

                                {/* Selector domiciliario */}
                                <View className="mb-3">
                                    <Text className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Domiciliario
                                    </Text>
                                    <View className="bg-black/30 rounded-xl border border-white/10 overflow-hidden min-h-[44px] justify-center">
                                        <Picker
                                            selectedValue={selectedDomiciliario[d.domicilioId] ?? ''}
                                            onValueChange={(val) =>
                                                setSelectedDomiciliario(prev => ({
                                                    ...prev,
                                                    [d.domicilioId]: val as string,
                                                }))
                                            }
                                            style={{ color: 'white' }}
                                            itemStyle={{ color: 'white', fontSize: 14 }}
                                            dropdownIconColor="#94A3B8"
                                        >
                                            <Picker.Item
                                                label={domiciliarios.length === 0 ? 'No hay domiciliarios registrados' : 'Seleccionar domiciliario...'}
                                                value=""
                                                color="#64748B"
                                            />
                                            {domiciliarios.map(dom => (
                                                <Picker.Item
                                                    key={dom.telefono}
                                                    label={dom.domiciliarioNombre || dom.telefono}
                                                    value={dom.telefono}
                                                />
                                            ))}
                                        </Picker>
                                    </View>
                                </View>

                                {/* Botón asignar */}
                                <TouchableOpacity
                                    className={`py-3 rounded-xl items-center flex-row justify-center gap-2 ${
                                        hasDomSelected
                                            ? 'bg-(--color-pos-primary)'
                                            : 'bg-white/5 border border-white/10'
                                    } ${isAssigning ? 'opacity-60' : ''}`}
                                    onPress={() => handleAsignar(d.domicilioId)}
                                    disabled={isAssigning || !hasDomSelected}
                                >
                                    {isAssigning ? (
                                        <ActivityIndicator size="small" color="#000" />
                                    ) : (
                                        <>
                                            <Icon
                                                name="account-check-outline"
                                                size={16}
                                                color={hasDomSelected ? '#000' : '#475569'}
                                            />
                                            <Text
                                                className={`font-black text-[10px] uppercase tracking-widest ${
                                                    hasDomSelected ? 'text-black' : 'text-slate-500'
                                                }`}
                                            >
                                                Asignar
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </Card>
                        );
                    })}
                </View>
            )}

            {isMobile && <View className="h-16" />}
        </PageContainer>
    );
}
