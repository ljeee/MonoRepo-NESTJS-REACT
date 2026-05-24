import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { RefreshControl } from 'react-native';
import { View, Text, ScrollView } from '../../tw';
import { api } from '../../services/api';
import { useRouter } from 'expo-router';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import PageContainer from '../../components/ui/PageContainer';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import { ListSkeleton } from '../../components/ui/SkeletonLoader';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Role } from '@/src/shared';
import { useBreakpoint } from '../../styles/responsive';

// ─── Extracted item — avoids re-creating the closure on every render ─────────
const UsuarioItem = memo(({ u }: { u: any }) => (
    <Card className="flex-row items-center justify-between p-5 bg-white/5 border border-white/5 rounded-[28px]">
        <View className="flex-row items-center flex-1 mr-4 gap-4">
            <View className="w-12 h-12 rounded-2xl bg-orange-500/10 items-center justify-center border border-orange-500/20">
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 18 }}>
                    {(u.name || u.username)?.charAt(0).toUpperCase()}
                </Text>
            </View>
            <View className="flex-1">
                <Text
                    className="text-white font-black text-xs uppercase tracking-widest"
                    style={{ fontFamily: 'Space Grotesk' }}
                    numberOfLines={1}
                >
                    {u.name || u.username}
                </Text>
                <Text className="text-slate-500 font-bold text-[10px] mt-1" numberOfLines={1}>
                    @{u.username}
                </Text>
            </View>
        </View>

        <View className="items-end gap-2">
            <View className="flex-row gap-1.5 flex-wrap justify-end">
                {(u.roles ?? []).map((role: string) => (
                    <Badge
                        key={role}
                        label={role}
                        variant={role?.toLowerCase() === 'admin' ? 'danger' : 'info'}
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
));

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function UsuariosScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const isAdmin = user?.roles?.includes(Role.Admin) === true;
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { isMobile } = useBreakpoint();

    // Prevent state updates after unmount (avoids memory leak warning)
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
            console.error('[Usuarios] Error loading users:', error);
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

    return (
        <PageContainer scrollable={false} maxWidthVariant="full">
            {/* PageHeader sits outside the scroll area — stays fixed at top */}
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

            {/*
             * ScrollView from ../../tw uses useCssElement, which correctly applies
             * className="flex-1" as an inline style — proven pattern used by all
             * other working list screens (ordenes, etc.).
             * Raw FlatList with style={{ flex: 1 }} does NOT get a concrete pixel
             * height from the flex chain on web, so it collapses and stays invisible.
             */}
            <ScrollView
                className="flex-1"
                contentContainerClassName="pb-20"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#F5A524"
                    />
                }
            >
                {loading && !refreshing ? (
                    <View className="px-6 pt-4">
                        <ListSkeleton count={6} />
                    </View>
                ) : usuarios.length === 0 ? (
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
                ) : (
                    /*
                     * Two-column grid on desktop, single column on mobile.
                     * Matches the masonry-grid pattern used by OrdersOfDayPending —
                     * avoids FlatList entirely (11 users ≠ virtualization needed).
                     */
                    <View className="flex-row flex-wrap px-2">
                        {usuarios.map((u: any) => (
                            <View
                                key={u.id?.toString()}
                                style={{
                                    width: isMobile ? '100%' : '50%',
                                    padding: 6,
                                    marginBottom: 6,
                                }}
                            >
                                <UsuarioItem u={u} />
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </PageContainer>
    );
}
