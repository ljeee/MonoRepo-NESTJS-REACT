import React, { useState, useEffect, useCallback } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { View, Text } from '../../tw';
import { Ionicons } from '@expo/vector-icons';
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
        setRefreshing(true);
        loadUsuarios();
    };

    const { isMobile } = useBreakpoint();

    return (
        <PageContainer scrollable={false}>
            <View className="flex-1">
                <PageHeader
                    title="Usuarios del Sistema"
                    subtitle="Gestión de acceso y personal"
                    icon="account-group"
                    rightContent={isAdmin ? (
                        <Button
                            title="Nuevo"
                            icon="account-plus"
                            variant="primary"
                            size="sm"
                            onPress={() => router.push('/registro-usuarios' as any)}
                        />
                    ) : undefined}
                />

                {loading && !refreshing ? (
                    <View className="px-6">
                        <ListSkeleton count={5} />
                    </View>
                ) : (
                    <FlatList
                        data={usuarios}
                        className="flex-1"
                        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A524" />
                        }
                        keyExtractor={(u) => u.id?.toString()}
                        key={isMobile ? 'v' : 'h'}
                        numColumns={isMobile ? 1 : 2}
                        ListEmptyComponent={
                            <View className="items-center justify-center py-20 opacity-30">
                                <Icon name="account-group-outline" size={64} color="#64748B" />
                                <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs">
                                    No hay usuarios registrados
                                </Text>
                            </View>
                        }
                        renderItem={({ item: u }) => (
                            <View className={`mb-4 flex-1 ${isMobile ? '' : 'px-2'}`}>
                                <Card className="flex-row items-center justify-between p-4 bg-white/5 border-white/5">
                                    <View className="flex-row items-center gap-4">
                                        <View className="w-12 h-12 rounded-full bg-amber-500/10 items-center justify-center border border-amber-500/20">
                                            <Text className="text-amber-500 font-black text-lg">
                                                {(u.name || u.username)?.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <View>
                                            <Text className="text-white font-black text-sm uppercase" style={{ fontFamily: 'Space Grotesk' }}>
                                                {u.name || u.username}
                                            </Text>
                                            <Text className="text-zinc-500 text-[10px] font-bold">@{u.username}</Text>
                                        </View>
                                    </View>
                                    <View className="items-end gap-2">
                                        <View className="flex-row gap-2">
                                            {u.roles?.map((role: string) => (
                                                <Badge 
                                                    key={role} 
                                                    label={role} 
                                                    variant={role === 'Admin' ? 'danger' : 'info'} 
                                                    size="sm" 
                                                />
                                            ))}
                                        </View>
                                        <Text className="text-zinc-600 text-[8px] font-black uppercase">
                                            {new Date(u.createdAt).toLocaleDateString()}
                                        </Text>
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
