import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useOfflineQueue, formatDate } from '@monorepo/shared';
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

                    <Text className="text-slate-300 text-sm mb-8 leading-5 font-bold">
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
