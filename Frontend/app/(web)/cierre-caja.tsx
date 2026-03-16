import React, { useState, useEffect, useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { View, Text, ScrollView, TextInput } from '../../tw';
import { PageContainer, PageHeader, Button, Icon, Card, Badge, ConfirmModal, ListSkeleton } from '../../components/ui';
import { api } from '../../services/api';
import { useToast, formatCurrency, formatDate, Role } from '@monorepo/shared';
import { useAuth } from '../../contexts/AuthContext';

export default function CierreCajaScreen() {
    const { showToast } = useToast();
    const [history, setHistory] = useState<any[]>([]);
    const [resumen, setResumen] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [observations, setObservations] = useState('');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [selectedCierreId, setSelectedCierreId] = useState<string | null>(null);
    const { user } = useAuth();
    const isAdmin = user?.roles.includes(Role.Admin);

    const today = (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();

    const fetchData = useCallback(async () => {
        try {
            const [hist, res] = await Promise.all([
                api.cierres.getHistory(),
                api.estadisticas.resumenPeriodo(today, today)
            ]);
            setHistory(hist);
            setResumen(res);
        } catch (error) {
            console.error(error);
            showToast('Error al cargar datos de cierre', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast, today]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCierre = async () => {
        try {
            setLoading(true);
            await api.cierres.ejecutar(today, observations);
            showToast('Cierre de caja realizado y enviado por correo 📧', 'success');
            setObservations('');
            fetchData();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Error al realizar el cierre';
            showToast(msg, 'error');
        } finally {
            setLoading(false);
            setIsConfirmOpen(false);
        }
    };

    const handleDeleteCierre = async () => {
        if (!selectedCierreId) return;
        try {
            setLoading(true);
            await api.cierres.delete(selectedCierreId);
            showToast('Cierre eliminado correctamente', 'success');
            fetchData();
        } catch (error: any) {
            showToast('Error al eliminar cierre', 'error');
        } finally {
            setLoading(false);
            setIsDeleteConfirmOpen(false);
            setSelectedCierreId(null);
        }
    };

    if (loading && !refreshing) return <PageContainer><ListSkeleton count={4} /></PageContainer>;

    return (
        <PageContainer>
            <PageHeader title="Cierre de Caja" icon="cash-register" />

            <ScrollView 
                contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={() => { setRefreshing(true); fetchData(); }} 
                        tintColor="#F5A524" 
                    />
                }
            >
                {/* ── Dashboard Hoy ── */}
                <View className="mb-8 px-2">
                    <Text className="text-white font-black text-xl mb-4" style={{ fontFamily: 'Space Grotesk' }}>Estado Actual (Hoy)</Text>
                    
                    <View className="flex-row gap-4 mb-4">
                        <Card className="flex-1 p-5 border border-white/5 bg-emerald-500/10">
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Ventas Brutas</Text>
                            <Text className="text-emerald-400 font-black text-2xl" style={{ fontFamily: 'Space Grotesk' }}>
                                ${formatCurrency(resumen?.totalVentas || 0)}
                            </Text>
                        </Card>
                        <Card className="flex-1 p-5 border border-white/5 bg-rose-500/10">
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Egresos/Gastos</Text>
                            <Text className="text-rose-400 font-black text-2xl" style={{ fontFamily: 'Space Grotesk' }}>
                                ${formatCurrency(resumen?.totalEgresos || 0)}
                            </Text>
                        </Card>
                    </View>

                    <Card className="p-6 border border-white/5 bg-(--color-pos-surface) mb-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Balance Neto</Text>
                                <Text className="text-white font-black text-3xl" style={{ fontFamily: 'Space Grotesk' }}>
                                    ${formatCurrency(resumen?.balanceNeto || 0)}
                                </Text>
                            </View>
                            <Icon name="finance" size={32} color="#F5A524" />
                        </View>

                        <View className="h-[1px] bg-white/5 mb-6" />

                        <View className="flex-row justify-between mb-6">
                            <View>
                                <Text className="text-slate-600 text-[10px] font-black uppercase mb-1">Órdenes</Text>
                                <Text className="text-slate-300 font-bold">{resumen?.ordenes || 0}</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-slate-600 text-[10px] font-black uppercase mb-1">Ticket Promedio</Text>
                                <Text className="text-slate-300 font-bold">${formatCurrency(resumen?.ticketPromedio || 0)}</Text>
                            </View>
                        </View>

                        <TextInput 
                            placeholder="Observaciones del cierre (opcional)..."
                            placeholderTextColor="#475569"
                            multiline
                            numberOfLines={3}
                            value={observations}
                            onChangeText={setObservations}
                            className="bg-black/20 rounded-2xl p-4 text-white font-bold border border-white/5 mb-6 text-sm"
                            style={{ textAlignVertical: 'top' }}
                        />

                        <Button 
                            title="Ejecutar Cierre Diario" 
                            icon="lock-check-outline" 
                            variant="primary" 
                            onPress={() => setIsConfirmOpen(true)}
                        />
                    </Card>
                </View>

                {/* ── Historial ── */}
                <View className="px-2">
                    <Text className="text-white font-black text-xl mb-4" style={{ fontFamily: 'Space Grotesk' }}>Últimos Cierres</Text>
                    
                    {history.length > 0 ? (
                        history.map(h => {
                            // Fix date formatting: if it ends in 00:00.000Z, it's a date-only field that toLocaleString shifts to 7PM
                            const displayDate = h.fecha.includes('T00:00:00') || h.fecha.length <= 10
                                ? h.fecha.split('T')[0].split('-').reverse().join('/')
                                : formatDate(h.fecha);

                            return (
                                <Card key={h.id} className="mb-3 p-4 border border-white/5 bg-white/5 flex-row justify-between items-center">
                                    <View className="flex-1">
                                        <Text className="text-white font-bold">{displayDate}</Text>
                                        <View className="flex-row items-center gap-2 mt-1">
                                            <Text className="text-slate-500 text-xs">Ventas:</Text>
                                            <Text className="text-emerald-400 text-xs font-bold">${formatCurrency(h.totalVentas)}</Text>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center gap-4">
                                        <View className="items-end">
                                            <Badge label="Finalizado" variant="success" />
                                            <Text className="text-slate-600 text-[10px] mt-1">ID: {h.id.slice(0, 8)}</Text>
                                        </View>
                                        {isAdmin && (
                                            <Button 
                                                title="" 
                                                icon="trash-can-outline" 
                                                variant="ghost" 
                                                size="sm" 
                                                onPress={() => {
                                                    setSelectedCierreId(h.id);
                                                    setIsDeleteConfirmOpen(true);
                                                }}
                                            />
                                        )}
                                    </View>
                                </Card>
                            );
                        })
                    ) : (
                        <View className="py-10 items-center opacity-30">
                            <Icon name="history" size={48} color="#94A3B8" />
                            <Text className="text-slate-400 font-bold mt-2">Sin cierres previos</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <ConfirmModal 
                visible={isConfirmOpen}
                title="¿Realizar Cierre?"
                message="Esta acción consolidará las ventas de hoy y enviará un reporte al administrador. No se podrán realizar más cambios en las órdenes de esta fecha."
                confirmText="SÍ, CERRAR DÍA"
                onConfirm={handleCierre}
                onCancel={() => setIsConfirmOpen(false)}
            />

            <ConfirmModal 
                visible={isDeleteConfirmOpen}
                title="¿Eliminar Cierre?"
                message="Esta acción es irreversible. El registro de cierre se eliminará permanentemente."
                confirmText="SÍ, ELIMINAR"
                variant="danger"
                onConfirm={handleDeleteCierre}
                onCancel={() => {
                    setIsDeleteConfirmOpen(false);
                    setSelectedCierreId(null);
                }}
            />
        </PageContainer>
    );
}
