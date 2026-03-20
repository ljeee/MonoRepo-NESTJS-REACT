import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useOfflineQueue, formatDate, useToast } from '@monorepo/shared';
import { api } from '../../services/api';
import { buildFacturasBackupCsv, downloadCsv } from '../../utils/csvExport';
import { Ionicons } from '@expo/vector-icons';
import { FadeInUp } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import {
    PageContainer,
    PageHeader,
    Card,
    Badge,
    Icon,
    Button
} from '../../components/ui';

export default function MonitoreoScreen() {
    const { queue, isSyncing, syncPayments, hasItems } = useOfflineQueue();
    const { showToast } = useToast();
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);

    const handleSyncManual = async () => {
        try {
            await syncPayments();
            if (queue.length === 0) {
                Alert.alert('Éxito', 'Todos los pagos han sido sincronizados');
            }
        } catch (error) {
            Alert.alert('Error', 'Ocurrió un error durante la sincronización');
        }
    };

    const handleFileUpload = async (event: any) => {
        const file = event.target.files[0];
        if (!file) return;

        setImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.http.post('/contabilidad/importar-csv', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
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
            event.target.value = '';
        }
    };

    const handleExportBackup = async () => {
        setExporting(true);
        try {
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
                subtitle="Estado de sincronización y salud"
                icon="shield-check-outline" 
            />

            <Animated.View entering={FadeInUp.duration(600)} className="px-2">
                {/* Status Card */}
                <Card className="mb-8 p-6 bg-(--color-pos-surface)">
                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-row items-center gap-3">
                            <View className={`w-3 h-3 rounded-full ${hasItems ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
                            <Text className="text-white text-lg font-black uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Estado Sincronización</Text>
                        </View>
                        <Badge 
                            label={hasItems ? `${queue.length} PENDIENTES` : 'AL DÍA'} 
                            variant={hasItems ? 'warning' : 'success'} 
                        />
                    </View>

                    <Text className="text-sm mb-8 leading-5 font-bold" style={{ color: '#94A3B8' }}>
                        {hasItems 
                            ? 'Hay transacciones guardadas localmente esperando ser enviadas al servidor. La sincronización ocurre automáticamente cada 60 segundos.' 
                            : 'Todos los pagos locales han sido procesados correctamente por el servidor central.'}
                    </Text>

                    <Button
                        title={isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                        icon="sync"
                        variant="primary"
                        onPress={handleSyncManual}
                        disabled={isSyncing || !hasItems}
                        loading={isSyncing}
                    />
                </Card>

                {Platform.OS === 'web' && (
                    <Card className="mb-8 p-6 bg-(--color-pos-surface)">
                        <View className="flex-row items-center justify-between mb-6">
                            <View className="flex-row items-center gap-3">
                                <View className="w-8 h-8 rounded-xl bg-orange-500/20 items-center justify-center border border-orange-500/30">
                                     <Icon name="file-upload-outline" size={18} color="#F5A524" />
                                </View>
                                <Text className="text-white text-lg font-black uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Recuperación Web</Text>
                            </View>
                            <Badge label="BACKUP / CSV" variant="info" />
                        </View>

                        <Text className="text-sm mb-8 leading-5 font-bold" style={{ color: '#94A3B8' }}>
                            Cargue facturaciones históricas en formato CSV para mantener operaciones seguras o exporte todas las transacciones generadas.
                        </Text>

                        <View className="gap-3">
                            <Button 
                                title={exporting ? 'Generando...' : 'Exportar Copia de Seguridad'}
                                variant="outline"
                                icon="download-outline"
                                onPress={handleExportBackup}
                                loading={exporting}
                                disabled={exporting || importing}
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
                                    onPress={() => document.getElementById('csv-upload-app')?.click()}
                                    className={`w-full h-14 rounded-2xl border-2 border-dashed border-white/10 items-center justify-center flex-row gap-3 ${importing ? 'opacity-50' : 'active:bg-white/5'}`}
                                >
                                    {importing ? (
                                        <ActivityIndicator color="#F5A524" />
                                    ) : (
                                        <>
                                            <Icon name="cloud-upload-outline" size={20} color="#F5A524" />
                                            <Text className="text-white font-black text-sm uppercase tracking-widest">Cargar Archivo .CSV</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                                <input 
                                    id="csv-upload-app" 
                                    type="file" 
                                    accept=".csv" 
                                    style={{ display: 'none' }} 
                                    onChange={handleFileUpload}
                                />
                            </View>
                        </View>
                    </Card>
                )}

                {/* Queue List */}
                {hasItems && (
                    <View className="mb-12">
                        <View className="flex-row items-center gap-2 mb-4 ml-1">
                            <Icon name="format-list-bulleted" size={16} color="#64748B" />
                            <Text className="text-slate-500 text-[10px] uppercase font-black tracking-widest">Cola de Pagos en Espera</Text>
                        </View>
                        
                        {queue.map((item, idx) => (
                            <Card key={item.idempotencyKey} className="mb-3 p-5 flex-row items-center justify-between border-white/5 bg-white/5">
                                <View>
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-white font-black" style={{ fontFamily: 'Space Grotesk' }}>Orden #{item.ordenId}</Text>
                                        <Badge label={item.metodo} size="sm" variant="info" />
                                    </View>
                                    <Text className="text-slate-500 text-[10px] font-bold mt-1">
                                        Generado: {new Date(item.timestamp).toLocaleTimeString()}
                                    </Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-orange-500 text-[10px] font-black uppercase">Reintentos: {item.retryCount}</Text>
                                    <Text className="text-slate-600 text-[8px] font-mono mt-1">{item.idempotencyKey.slice(0, 16)}</Text>
                                </View>
                            </Card>
                        ))}
                    </View>
                )}
            </Animated.View>
        </PageContainer>
    );
}
