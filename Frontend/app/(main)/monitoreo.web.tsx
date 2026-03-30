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
                const skippedMsg = response.data.totalSkipped > 0 ? ` (${response.data.totalSkipped} ya existían)` : '';
                showToast(`Éxito: ${response.data.totalImported} facturas importadas${skippedMsg}.`, 'success');
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
                title="Sistema" 
                subtitle="Salud y Herramientas"
                icon="shield-check-outline" 
            />

            <Animated.View entering={FadeInUp.duration(600)} className="px-1 max-w-7xl mx-auto w-full pb-20">
                
                {/* TOOL GRID */}
                <View className="flex-row flex-wrap gap-4 mb-10">
                    
                    {/* CARD 1: SYNC */}
                    <View className="flex-1 min-w-[340px]">
                        <Card className="h-full p-6 border-white/5 bg-white/5 overflow-hidden relative">
                            <View className="flex-row items-center justify-between mb-8">
                                <View className="flex-row items-center gap-3">
                                    <View className={`w-3 h-3 rounded-full ${hasItems ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`} />
                                    <Text className="text-white font-black text-xs uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Sincronización</Text>
                                </View>
                                <Badge 
                                    label={hasItems ? `${queue.length} PEND` : 'OK'} 
                                    variant={hasItems ? 'warning' : 'success'} 
                                />
                            </View>

                            <Text className="text-slate-500 text-[11px] mb-8 leading-relaxed font-bold uppercase tracking-tight">
                                {hasItems 
                                    ? 'Transacciones locales pendientes de envío. Reintento automático activo.' 
                                    : 'Estado óptimo. Todas las operaciones están en la nube.'}
                            </Text>

                            <Button
                                title={isSyncing ? 'Sincronizando...' : 'Enviar Ahora'}
                                icon="sync"
                                variant={hasItems ? 'primary' : 'outline'}
                                onPress={handleSyncManual}
                                disabled={isSyncing || !hasItems}
                                loading={isSyncing}
                                className="h-12"
                            />
                        </Card>
                    </View>

                    {/* CARD 2: BACKUP */}
                    <View className="flex-1 min-w-[340px]">
                        <Card className="h-full p-6 border-white/5 bg-white/5 overflow-hidden relative">
                            <View className="flex-row items-center justify-between mb-8">
                                <View className="flex-row items-center gap-3">
                                    <View className="w-8 h-8 rounded-xl bg-blue-500/20 items-center justify-center">
                                         <Icon name="database" size={16} color="#3B82F6" />
                                    </View>
                                    <Text className="text-white font-black text-xs uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Base de Datos</Text>
                                </View>
                                <Badge label="CSV" variant="info" />
                            </View>

                            <View className="flex-row gap-2">
                                <TouchableOpacity 
                                    onPress={handleExportBackup}
                                    disabled={exporting || importing}
                                    className="flex-1 h-12 bg-white/5 border border-white/10 rounded-2xl items-center justify-center flex-row gap-2 active:bg-white/10"
                                >
                                    <Icon name="cloud-download-outline" size={16} color="#64748B" />
                                    <Text className="text-white font-black text-[10px] uppercase tracking-widest">{exporting ? '...' : 'Backup'}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => document.getElementById('csv-upload')?.click()}
                                    disabled={exporting || importing}
                                    className="flex-1 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl items-center justify-center flex-row gap-2 active:bg-emerald-500/40"
                                >
                                    <Icon name="cloud-upload-outline" size={16} color="#10B981" />
                                    <Text className="text-emerald-400 font-black text-[10px] uppercase tracking-widest">{importing ? '...' : 'Cargar'}</Text>
                                </TouchableOpacity>
                                <input id="csv-upload" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                            </View>
                        </Card>
                    </View>
                </View>

                {/* QUEUE DETAILS */}
                {hasItems && (
                    <Animated.View entering={FadeInDown.delay(200)}>
                        <View className="flex-row items-center gap-3 mb-4 ml-1">
                            <View className="w-1.5 h-4 bg-orange-500 rounded-full" />
                            <Text className="text-white font-black text-xs uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Cola de Procesamiento</Text>
                        </View>
                        
                        <View className="flex-row flex-wrap gap-2">
                            {queue.map((item, idx) => (
                                <Animated.View key={item.idempotencyKey} entering={FadeInUp.delay(idx * 40)} className="w-full md:w-[49.3%]">
                                    <View className="p-4 flex-row items-center justify-between border border-white/5 bg-white/5 rounded-2xl">
                                        <View>
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-white font-black text-sm uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>Orden #{item.ordenId}</Text>
                                                <View className="px-2 py-0.5 bg-white/5 rounded-md">
                                                    <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest">{item.metodo}</Text>
                                                </View>
                                            </View>
                                            <Text className="text-slate-600 text-[9px] mt-1 font-bold uppercase tracking-widest">
                                                ID: {item.idempotencyKey.slice(0, 12)}...
                                            </Text>
                                        </View>
                                        
                                        <View className="items-end">
                                            <View className="flex-row items-center gap-1.5 bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20">
                                                <Icon name="history" size={12} color="#F5A524" />
                                                <Text className="text-orange-500 text-[9px] font-black uppercase">Reintentando</Text>
                                            </View>
                                        </View>
                                    </View>
                                </Animated.View>
                            ))}
                        </View>
                    </Animated.View>
                )}
            </Animated.View>
        </PageContainer>
    );
}
