import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { View, Text } from '../../tw';
import { api } from '../../services/api';
import { useRouter } from 'expo-router';
import { Badge, Icon, PageContainer, PageHeader, Card, ListSkeleton, Button } from '../../components/ui';
import { EmptyState } from '../../components/states/EmptyState';
import { useAuth } from '../../contexts/AuthContext';
import { Role } from '@/src/shared';
import { useBreakpoint } from '../../styles/responsive';

// Extracted list item for better performance
const UsuarioItem = memo(({ u, isMobile }: { u: any, isMobile: boolean }) => (
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
));

export default function UsuariosScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const isAdmin = user?.roles?.includes(Role.Admin);
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { isMobile } = useBreakpoint();

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const loadUsuarios = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.auth.getUsers();
            if (mountedRef.current) setUsuarios(data);
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    useEffect(() => {
        loadUsuarios();
    }, [loadUsuarios]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadUsuarios();
    }, [loadUsuarios]);

    const renderItem = useCallback(({ item }: { item: any }) => (
        <UsuarioItem u={item} isMobile={isMobile} />
    ), [isMobile]);

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
                            <EmptyState icon="account-group" message="Sin usuarios" subMessage="Crea el primer usuario" />
                        }
                        renderItem={renderItem}
                    />
                )}
            </View>
        </PageContainer>
    );
}
