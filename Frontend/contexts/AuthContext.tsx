import React, { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../src/shared/contexts/AuthContext';
import { Role } from '../src/shared/types/models';

export { AuthProvider, useAuth } from '../src/shared/contexts/AuthContext';

export function useAuthNavigation() {
    const { token, user, isLoading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const onLoginScreen = segments.includes('login' as any);
        const isDomiciliario = user?.roles?.includes(Role.Domiciliario);
        const isCocina = user?.roles?.includes(Role.Cocina);

        if (!token && !onLoginScreen) {
            router.replace('/login' as any);
        } else if (token && onLoginScreen) {
            if (isDomiciliario) {
                router.replace('/mis-domicilios' as any);
            } else if (isCocina) {
                router.replace('/ordenes' as any);
            } else {
                router.replace('/' as any);
            }
        } else if (token && isDomiciliario) {
            const currentPath = '/' + segments.filter((s: string) => !s.startsWith('(')).join('/');
            const allowedForDomiciliario = ['/mis-domicilios'];
            if (!allowedForDomiciliario.some(p => currentPath.startsWith(p))) {
                router.replace('/mis-domicilios' as any);
            }
        } else if (token && isCocina) {
            const currentPath = '/' + segments.filter((s: string) => !s.startsWith('(')).join('/');
            const allowedForCocina = ['/ordenes', '/ordenes-todas', '/orden-detalle'];
            if (!allowedForCocina.some(p => currentPath.startsWith(p))) {
                router.replace('/ordenes' as any);
            }
        }
    }, [token, user, segments, isLoading, router]);
}
