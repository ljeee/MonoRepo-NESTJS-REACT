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
                <View style={{ marginBottom: 32, paddingHorizontal: 8 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 20, marginBottom: 16 }}>Estado Actual (Hoy)</Text>
                    
                    <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
                        <Card style={{ flex: 1, padding: 20, borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1, backgroundColor: 'rgba(16,185,129,0.1)' }}>
                            <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Ventas Brutas</Text>
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 24 }}>
                                ${formatCurrency(resumen?.totalVentas || 0)}
                            </Text>
                        </Card>
                        <Card style={{ flex: 1, padding: 20, borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1, backgroundColor: 'rgba(244,63,94,0.1)' }}>
                            <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Egresos/Gastos</Text>
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#FB7185', fontSize: 24 }}>
                                ${formatCurrency(resumen?.totalEgresos || 0)}
                            </Text>
                        </Card>
                    </View>

                    <Card style={{ padding: 24, borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1, backgroundColor: 'rgba(6,14,26,0.8)', marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <View>
                                <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Balance Neto</Text>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 30 }}>
                                    ${formatCurrency(resumen?.balanceNeto || 0)}
                                </Text>
                            </View>
                            <Icon name="finance" size={32} color="#F5A524" />
                        </View>

                        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 24 }} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
                            <View>
                                <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 4 }}>Órdenes</Text>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#CBD5E1', fontSize: 16 }}>{resumen?.ordenes || 0}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 4 }}>Ticket Promedio</Text>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#CBD5E1', fontSize: 16 }}>${formatCurrency(resumen?.ticketPromedio || 0)}</Text>
                            </View>
                        </View>

                        <TextInput 
                            placeholder="Observaciones del cierre (opcional)..."
                            placeholderTextColor="#475569"
                            multiline
                            numberOfLines={3}
                            value={observations}
                            onChangeText={setObservations}
                            style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: 16, color: '#F8FAFC', fontFamily: 'Outfit', borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1, marginBottom: 24, fontSize: 14, textAlignVertical: 'top' }}
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
                <View style={{ paddingHorizontal: 8 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 20, marginBottom: 16 }}>Últimos Cierres</Text>
                    
                    {history.length > 0 ? (
                        history.map(h => {
                            // Fix date formatting: if it ends in 00:00.000Z, it's a date-only field that toLocaleString shifts to 7PM
                            const displayDate = h.fecha.includes('T00:00:00') || h.fecha.length <= 10
                                ? h.fecha.split('T')[0].split('-').reverse().join('/')
                                : formatDate(h.fecha);

                            return (
                                <Card key={h.id} style={{ marginBottom: 12, padding: 16, borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 15 }}>{displayDate}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                            <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 12 }}>Ventas:</Text>
                                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 12 }}>${formatCurrency(h.totalVentas)}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Badge label="Finalizado" variant="success" />
                                            <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10, marginTop: 4 }}>ID: {h.id.slice(0, 8)}</Text>
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
