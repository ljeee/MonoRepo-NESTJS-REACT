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
        <PageContainer scrollable={false} maxWidthVariant="full">
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
                        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A524" />
                        }
                        keyExtractor={(u) => u.id?.toString()}
                        key={isMobile ? 'v' : 'h'}
                        numColumns={isMobile ? 1 : 2}
                        ListEmptyComponent={
                            <View className="items-center justify-center py-24">
                                <View className="w-16 h-16 rounded-full bg-slate-900 items-center justify-center mb-6">
                                    <Icon name="account-group-outline" size={32} color="#475569" />
                                </View>
                                <Text className="text-slate-400 font-black mb-6 uppercase tracking-widest text-[10px] text-center">
                                    No hay usuarios registrados o no se pudieron cargar
                                </Text>
                                <Button 
                                    title="Reintentar Carga" 
                                    onPress={loadUsuarios} 
                                    variant="secondary" 
                                    size="sm"
                                    icon="refresh"
                                />
                            </View>
                        }
                        renderItem={({ item: u }) => (
                            <View style={{ marginBottom: 10, flex: 1, paddingHorizontal: isMobile ? 0 : 4 }}>
                                <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(245,165,36,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,165,36,0.2)' }}>
                                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 16 }}>
                                                {(u.name || u.username)?.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <View>
                                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                {u.name || u.username}
                                            </Text>
                                            <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10 }}>@{u.username}</Text>
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            {u.roles?.map((role: string) => (
                                                <Badge 
                                                    key={role} 
                                                    label={role} 
                                                    variant={role === 'Admin' ? 'danger' : 'info'} 
                                                    size="sm" 
                                                />
                                            ))}
                                        </View>
                                        <Text style={{ fontFamily: 'Outfit', color: '#334155', fontSize: 9, textTransform: 'uppercase' }}>
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
