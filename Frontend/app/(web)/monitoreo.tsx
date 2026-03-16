import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from '../../tw';
import { ActivityIndicator } from 'react-native';
import { useOfflineQueue, useToast } from '@monorepo/shared';
import { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { api } from '../../services/api';
import {
    PageContainer,
    PageHeader,
    Card,
    Badge,
    Icon,
    Button
} from '../../components/ui';
import { buildFacturasBackupCsv, downloadCsv } from '../../utils/csvExport';

export default function MonitoreoScreen() {
    const { queue, isSyncing, syncPayments, hasItems } = useOfflineQueue();
    const { showToast } = useToast();
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);

    const handleSyncManual = async () => {
        try {
            await syncPayments();
            if (queue.length === 0) {
                showToast('Todos los pagos han sido sincronizados', 'success');
            }
        } catch (error) {
            showToast('Ocurrió un error durante la sincronización', 'error');
        }
    };

    const handleFileUpload = async (event: any) => {
        const file = event.target.files[0];
        if (!file) return;

        setImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Using the base axios instance from our api object
            const response = await api.http.post('/contabilidad/importar-csv', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                showToast(`Éxito: ${response.data.totalImported} facturas importadas.`, 'success');
            } else {
                showToast('Error parcial en la importación', 'warning');
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Error al importar CSV';
            showToast(msg, 'error');
        } finally {
            setImporting(false);
            // Reset input
            event.target.value = '';
        }
    };

    const handleExportBackup = async () => {
        setExporting(true);
        try {
            // Fetch all invoices for a full backup
            const data = await api.facturas.getAll();
            if (!data || data.length === 0) {
                showToast('No hay facturas para exportar', 'warning');
                return;
            }
            const csv = await buildFacturasBackupCsv(data);
            const today = new Date().toISOString().slice(0, 10);
            downloadCsv(csv, `backup_facturas_${today}.csv`);
            showToast('Copia de seguridad descargada', 'success');
        } catch (error) {
            console.error('Export Error:', error);
            showToast('Error al generar el backup', 'error');
        } finally {
            setExporting(false);
        }
    };

    return (
        <PageContainer scrollable>
            <PageHeader 
                title="Monitoreo de Sistema" 
                subtitle="Salud y Herramientas de Base de Datos"
                icon="shield-check-outline" 
            />

            <Animated.View entering={FadeInUp.duration(600)} className="px-2 max-w-5xl mx-auto w-full pb-20">
                
                {/* GRID LAYOUT FOR MONITORING CARDS */}
                <View className="flex-row flex-wrap gap-6 mb-12">
                    
                    {/* CARD 1: SYNC STATUS */}
                    <View className="flex-1 min-w-[320px]">
                        <Card className="h-full p-8 border-white/5 bg-slate-900 overflow-hidden relative">
                            <View className="absolute top-0 right-0 p-4 opacity-10">
                                <Icon name="sync" size={80} color="#F5A524" />
                            </View>
                            
                            <View className="flex-row items-center justify-between mb-8">
                                <View className="flex-row items-center gap-4">
                                    <View className={`w-3 h-3 rounded-full ${hasItems ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500 shadow-lg shadow-emerald-500/50'}`} />
                                    <Text className="text-white text-lg font-black uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Sincronización</Text>
                                </View>
                                <Badge 
                                    label={hasItems ? `${queue.length} PENDIENTES` : 'AL DÍA'} 
                                    variant={hasItems ? 'warning' : 'success'} 
                                />
                            </View>

                            <Text className="text-slate-400 text-sm mb-10 leading-6 font-medium">
                                {hasItems 
                                    ? 'Transacciones locales pendientes de envío. El sistema reintentará automáticamente.' 
                                    : 'Todas las operaciones locales están sincronizadas con el servidor central.'}
                            </Text>

                            <Button
                                title={isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                                icon="sync"
                                variant={hasItems ? 'primary' : 'outline'}
                                onPress={handleSyncManual}
                                disabled={isSyncing || !hasItems}
                                loading={isSyncing}
                                className="py-4"
                            />
                        </Card>
                    </View>

                    {/* CARD 2: DATA BACKUP / IMPORT */}
                    <View className="flex-1 min-w-[320px]">
                        <Card className="h-full p-8 border-white/5 bg-slate-900 overflow-hidden relative">
                             <View className="absolute top-0 right-0 p-4 opacity-10">
                                <Icon name="database-import" size={80} color="#F5A524" />
                            </View>

                            <View className="flex-row items-center justify-between mb-8">
                                <View className="flex-row items-center gap-4">
                                    <View className="w-8 h-8 rounded-xl bg-orange-500/20 items-center justify-center">
                                         <Icon name="file-upload-outline" size={18} color="#F5A524" />
                                    </View>
                                    <Text className="text-white text-lg font-black uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Carga de Datos</Text>
                                </View>
                                <Badge label="CSV / BACKUP" variant="info" />
                            </View>

                            <Text className="text-slate-400 text-sm mb-10 leading-6 font-medium">
                                Gestione sus facturas históricas mediante archivos CSV. Puede exportar un backup completo o cargar datos previos.
                            </Text>

                            <View className="gap-3">
                                <Button 
                                    title={exporting ? 'Generando...' : 'Exportar Copia de Seguridad'}
                                    variant="outline"
                                    icon="download-outline"
                                    onPress={handleExportBackup}
                                    loading={exporting}
                                    disabled={exporting || importing}
                                    className="h-14 border-white/10"
                                />

                                <View className="h-4 flex-row items-center gap-2">
                                    <View className="flex-1 h-[1px] bg-white/5" />
                                    <Text className="text-slate-600 text-[10px] uppercase font-black">O</Text>
                                    <View className="flex-1 h-[1px] bg-white/5" />
                                </View>

                                <View>
                                    <TouchableOpacity 
                                        disabled={importing}
                                        activeOpacity={0.7}
                                        onPress={() => document.getElementById('csv-upload')?.click()}
                                        className={`w-full h-14 rounded-2xl border-2 border-dashed border-white/10 items-center justify-center flex-row gap-3 ${importing ? 'opacity-50' : 'active:bg-white/5'}`}
                                    >
                                        {importing ? (
                                            <ActivityIndicator color="#F5A524" />
                                        ) : (
                                            <>
                                                <Icon name="cloud-upload-outline" size={20} color="#F5A524" />
                                                <Text className="text-white font-black text-sm uppercase tracking-widest">Seleccionar Archivo</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                    <input 
                                        id="csv-upload" 
                                        type="file" 
                                        accept=".csv" 
                                        style={{ display: 'none' }} 
                                        onChange={handleFileUpload}
                                    />
                                </View>
                            </View>
                        </Card>
                    </View>
                </View>

                {/* QUEUE DETAILS SECTION */}
                {hasItems && (
                    <Animated.View entering={FadeInDown.delay(200)}>
                        <View className="flex-row items-center gap-3 mb-6 ml-1">
                            <View className="w-1 h-6 bg-orange-500 rounded-full" />
                            <Text className="text-white text-lg font-black uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Cola en Espera</Text>
                        </View>
                        
                        <View className="gap-3">
                            {queue.map((item, idx) => (
                                <Animated.View key={item.idempotencyKey} entering={FadeInUp.delay(idx * 50)}>
                                    <Card className="p-5 flex-row items-center justify-between border-white/5 bg-white/5">
                                        <View>
                                            <View className="flex-row items-center gap-3">
                                                <Text className="text-white font-black text-base" style={{ fontFamily: 'Space Grotesk' }}>Orden #{item.ordenId}</Text>
                                                <Badge label={item.metodo} size="sm" variant="info" />
                                            </View>
                                            <View className="flex-row items-center gap-2 mt-2">
                                                <Icon name="clock-outline" size={12} color="#64748B" />
                                                <Text className="text-slate-500 text-[10px] font-bold">
                                                    {new Date(item.timestamp).toLocaleTimeString()}
                                                </Text>
                                            </View>
                                        </View>
                                        <View className="items-end gap-2">
                                            <View className="flex-row items-center gap-1.5 bg-orange-500/10 px-2 py-1 rounded-full border border-orange-500/20">
                                                <Icon name="refresh" size={12} color="#F5A524" />
                                                <Text className="text-orange-500 text-[9px] font-black uppercase">Falla Temporal</Text>
                                            </View>
                                            <Text className="text-slate-600 text-[8px] font-mono tracking-tighter">{item.idempotencyKey.slice(0, 32)}</Text>
                                        </View>
                                    </Card>
                                </Animated.View>
                            ))}
                        </View>
                    </Animated.View>
                )}
            </Animated.View>
        </PageContainer>
    );
}
