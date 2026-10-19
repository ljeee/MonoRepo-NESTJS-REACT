import React, { memo } from 'react';
import { View, Text, ScrollView } from '../../tw';
import { useRouter } from 'expo-router';
import { Avatar, Badge, CardGrid, Icon, PageContainer, PageHeader, Card, ListSkeleton, Button, PosRefreshControl, EntityCard } from '../../components/ui';
import { ErrorState } from '../../components/states/ErrorState';
import { useAuth } from '../../contexts/AuthContext';
import { Role } from '@/src/shared';
import type { AuthUser } from '@/src/shared';
import { useUsuarios } from '../../hooks/use-usuarios';

const DATE_FORMATTER = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

const UsuarioItem = memo(function UsuarioItem({ u }: { u: AuthUser }) {
    return (
        <EntityCard
            title={u.name || u.username}
            subtitle={`@${u.username}`}
            aside={
                <>
                    <View className="flex-row gap-1.5 flex-wrap justify-end">
                        {(u.roles ?? []).map((role) => (
                            // Los roles llegan en minúscula: la versión nativa comparaba con 'Admin' y nunca pintaba el badge rojo.
                            <Badge key={role} label={role} variant={role === Role.Admin ? 'danger' : 'info'} size="sm" />
                        ))}
                    </View>
                    {!!u.createdAt && (
                        <View className="flex-row items-center gap-1 opacity-40">
                            <Icon name="clock-outline" size={10} color="#64748B" />
                            <Text className="text-slate-500 font-bold text-[8px] uppercase tracking-tighter">
                                {DATE_FORMATTER.format(new Date(u.createdAt))}
                            </Text>
                        </View>
                    )}
                </>
            }
        />
    );
});

/**
 * Un solo archivo para web y nativo. La lista es corta y acotada (el equipo de la
 * pizzería), así que usa el ScrollView de `tw`: recibe altura de la cadena flex en web,
 * donde FlatList/FlashList colapsaban invisibles.
 */
export default function UsuariosScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const isAdmin = user?.roles?.includes(Role.Admin) === true;
    const { usuarios, loading, refreshing, error, cargar, refrescar } = useUsuarios();

    return (
        <PageContainer scrollable={false}>
            <PageHeader
                title="Usuarios del Sistema"
                subtitle="Gestión de acceso y personal"
                icon="account-group"
                rightContent={isAdmin ? (
                    <Button title="Nuevo" icon="account-plus" variant="primary" size="sm" onPress={() => router.push('/registro-usuarios' as any)} />
                ) : undefined}
            />

            <ScrollView className="flex-1" contentContainerClassName="pb-20" refreshControl={<PosRefreshControl refreshing={refreshing} onRefresh={refrescar} />}>
                {loading && !refreshing ? (
                    <View className="pt-4">
                        <ListSkeleton count={6} />
                    </View>
                ) : error ? (
                    <ErrorState message={error} onRetry={cargar} />
                ) : usuarios.length === 0 ? (
                    <View className="items-center justify-center py-24 bg-white/5 m-4 rounded-[40px] border border-white/5">
                        <Icon name="account-group-outline" size={36} color="#475569" />
                        <Text className="text-slate-400 font-black my-6 uppercase tracking-widest text-[10px] text-center">Sin usuarios</Text>
                        <Button title="Consultar de nuevo" onPress={cargar} variant="secondary" size="sm" icon="refresh" />
                    </View>
                ) : (
                    <CardGrid kind="persona" data={usuarios} keyExtractor={(u) => u.id} renderItem={(u) => <UsuarioItem u={u} />} />
                )}
            </ScrollView>
        </PageContainer>
    );
}
