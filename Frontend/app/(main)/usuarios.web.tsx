import React, { useState, useEffect, useCallback } from 'react';
import { FlatList, RefreshControl, Platform } from 'react-native';
import { View, Text } from '../../tw';
import { api } from '../../services/api';
import { useRouter } from 'expo-router';
import { Badge, Icon, PageContainer, PageHeader, Card, ListSkeleton, Button } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { Role } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';

export default function UsuariosScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const isAdmin = user?.roles?.includes(Role.Admin);
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { isMobile } = useBreakpoint();
    const isWeb = Platform.OS === 'web';

    const loadUsuarios = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.auth.getUsers();
            setUsuarios(data);
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadUsuarios();
    }, [loadUsuarios]);

    const onRefresh = () => {
        setRefreshing(refreshing);
        loadUsuarios();
    };

    return (
        <PageContainer scrollable={false} maxWidthVariant="full">
            <View className="flex-1">
                <PageHeader
                    title="Gestión de Equipo"
                    subtitle="Administración de permisos y acceso al sistema"
                    icon="account-settings-outline"
                    rightContent={isAdmin ? (
                        <Button
                            title="Nuevo Usuario"
                            icon="account-plus-outline"
                            variant="primary"
                            size="sm"
                            onPress={() => router.push('/registro-usuarios' as any)}
                        />
                    ) : undefined}
                />

                {loading && !refreshing ? (
                    <View className="px-6">
                        <ListSkeleton count={6} />
                    </View>
                ) : (
                    <FlatList
                        data={usuarios}
                        className="flex-1"
                        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A524" />
                        }
                        keyExtractor={(u) => u.id?.toString()}
                        key={isMobile ? 'v' : 'h'}
                        numColumns={isMobile ? 1 : 2}
                        ListEmptyComponent={
                            <View className="items-center justify-center py-24 bg-white/5 m-4 rounded-[40px] border border-white/5">
                                <View className="w-20 h-20 rounded-[28px] bg-slate-900 items-center justify-center mb-6 border border-white/5">
                                    <Icon name="account-group-outline" size={36} color="#475569" />
                                </View>
                                <Text className="text-slate-400 font-black mb-6 uppercase tracking-widest text-[10px] text-center max-w-[200px] leading-relaxed">
                                    No se encontraron usuarios activos en la plataforma
                                </Text>
                                <Button 
                                    title="Consultar de nuevo" 
                                    onPress={loadUsuarios} 
                                    variant="secondary" 
                                    size="sm"
                                    icon="refresh"
                                />
                            </View>
                        }
                        renderItem={({ item: u }) => (
                            <View style={{ marginBottom: 12, flex: 1, paddingHorizontal: isWeb ? 6 : 0 }}>
                                <Card className="flex-row items-center justify-between p-5 bg-white/5 border border-white/5 rounded-[28px]">
                                    <View className="flex-row items-center flex-1 mr-4 gap-4">
                                        <View className="w-12 h-12 rounded-2xl bg-orange-500/10 items-center justify-center border border-orange-500/20">
                                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 18 }}>
                                                {(u.name || u.username)?.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-white font-black text-xs uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }} numberOfLines={1}>
                                                {u.name || u.username}
                                            </Text>
                                            <Text className="text-slate-500 font-bold text-[10px] mt-1" numberOfLines={1}>@{u.username}</Text>
                                        </View>
                                    </View>
                                    
                                    <View className="items-end gap-2">
                                        <View className="flex-row gap-1.5 flex-wrap justify-end">
                                            {u.roles?.map((role: string) => (
                                                <Badge 
                                                    key={role} 
                                                    label={role} 
                                                    variant={role.toLowerCase() === 'admin' ? 'danger' : 'info'} 
                                                    size="sm" 
                                                />
                                            ))}
                                        </View>
                                        <View className="flex-row items-center gap-1 opacity-40">
                                            <Icon name="clock-outline" size={10} color="#64748B" />
                                            <Text className="text-slate-500 font-bold text-[8px] uppercase tracking-tighter">
                                                {new Date(u.createdAt).toLocaleDateString()}
                                            </Text>
                                        </View>
                                    </View>
                                </Card>
                            </View>
                        )}
                    />
                )}
            </View>
        </PageContainer>
    );
}
