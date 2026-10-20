import React, { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { View, Text, TextInput } from '../../tw';
import { PageContainer, PageHeader, Button, Icon, IconButton, Card, Badge, ConfirmModal, ListSkeleton, PosRefreshControl } from '../../components/ui';
import { api } from '../../services/api';
import { useToast, formatCurrency, formatDate, Role, bogotaToday, nombreArchivoLibroDiario } from '@/src/shared';
import type { ResumenGeneral } from '@/src/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useBreakpoint } from '../../styles/responsive';
import { ResumenDiaCompleto } from '../../components/contabilidad/ResumenDiaCompleto';
import { PaginadorLocal } from '../../components/contabilidad/PaginadorLocal';
import { usePaginaLocal } from '../../hooks/use-pagina-local';
import { abrirPdfDelServidor } from '../../utils/visor-pdf';

export default function CierreCajaScreen() {
    const { showToast } = useToast();
    const { isMobile } = useBreakpoint();
    const [history, setHistory] = useState<any[]>([]);
    const [resumen, setResumen] = useState<ResumenGeneral | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [observations, setObservations] = useState('');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [selectedCierreId, setSelectedCierreId] = useState<string | null>(null);
    const paginaHistorial = usePaginaLocal(history, 15);
    const { user } = useAuth();
    const isAdmin = user?.roles.includes(Role.Admin);

    // Día contable de Bogotá (el del dispositivo puede estar desfasado).
    const today = bogotaToday();

    // Los mismos dos PDF que llegan por correo con el cierre (el servidor los arma). Solo en la web.
    const puedeAbrirPdf = Platform.OS === 'web';
    const abrirLibro = useCallback(
        async (fecha: string, filtro: 'completo' | 'solo_transferencias') => {
            try {
                await abrirPdfDelServidor(
                    () => api.contabilidad.libroDiarioPdf({ from: fecha, to: fecha, filtro }),
                    nombreArchivoLibroDiario({ from: fecha, to: fecha, filtro }, 'pdf'),
                    'Generando el libro diario…',
                );
            } catch (error: any) {
                showToast(error?.response?.status === 403 ? 'No tienes permiso para ver el libro diario' : 'No se pudo generar el PDF', 'error');
            }
        },
        [showToast],
    );

    const fetchData = useCallback(async () => {
        try {
            const [hist, res] = await Promise.all([
                api.cierres.getHistory(),
                api.analitica.resumenGeneral(today, today)
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
            await api.cierres.ejecutar(today, observations, true);
            showToast('Cierre realizado: se enviaron los dos libros diarios por correo 📧', 'success');
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
        <PageContainer
            refreshControl={<PosRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        >
            <PageHeader title="Cierre de Caja" subtitle="Resumen y cierre del día" icon="cash-register" />

            <View style={{ paddingBottom: 40, paddingTop: 16 }}>
                {/* ── Dashboard Hoy ── */}
                <View style={{ marginBottom: 32, paddingHorizontal: 8 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 20, marginBottom: 16 }}>Estado Actual (Hoy)</Text>
                    
                    {/* Mismas 7 secciones, en el mismo orden, que el correo de cierre (todo viene de /estadisticas/resumen). */}
                    {resumen && <ResumenDiaCompleto resumen={resumen} />}

                    <Card style={{ padding: 24, borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1, backgroundColor: 'rgba(6,14,26,0.8)', marginBottom: 24, marginTop: 16 }}>
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
                        {puedeAbrirPdf && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                                <Button title="Libro diario de hoy (PDF)" icon="book-open-page-variant-outline" variant="secondary" size="sm" onPress={() => void abrirLibro(today, 'completo')} />
                                <Button title="Transferencias y mixto (PDF)" icon="qrcode-scan" variant="secondary" size="sm" onPress={() => void abrirLibro(today, 'solo_transferencias')} />
                            </View>
                        )}
                    </Card>
                </View>

                {/* ── Historial ── */}
                <View style={{ paddingHorizontal: 8 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 20, marginBottom: 16 }}>Cierres anteriores</Text>
                    
                    {history.length > 0 ? (
                        paginaHistorial.items.map(h => {
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
                                        {puedeAbrirPdf && (
                                            <View style={{ flexDirection: 'row', gap: 4 }}>
                                                <IconButton icon="book-open-page-variant-outline" size="sm" accessibilityLabel={`Libro diario del ${displayDate}`} onPress={() => void abrirLibro(h.fecha.slice(0, 10), 'completo')} />
                                                <IconButton icon="qrcode-scan" size="sm" accessibilityLabel={`Transferencias y mixto del ${displayDate}`} onPress={() => void abrirLibro(h.fecha.slice(0, 10), 'solo_transferencias')} />
                                            </View>
                                        )}
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
                    <PaginadorLocal pagina={paginaHistorial} etiqueta="cierres" />
                </View>
            </View>

            <ConfirmModal 
                visible={isConfirmOpen}
                title="¿Realizar Cierre?"
                message="Esta acción consolidará las ventas de hoy y enviará los dos libros diarios en PDF (completo y transferencias y mixto) a tu correo y al de la contadora. No se podrán realizar más cambios en las órdenes de esta fecha."
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
