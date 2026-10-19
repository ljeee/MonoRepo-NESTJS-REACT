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
        const isContador = user?.roles?.includes(Role.Contador);
        // Mesero puro (sin admin ni cajero): mismo criterio que el Navbar
        const isMesero = user?.roles?.includes(Role.Mesero)
            && !user?.roles?.includes(Role.Admin)
            && !user?.roles?.includes(Role.Cajero);

        if (!token && !onLoginScreen) {
            router.replace('/login' as any);
        } else if (token && onLoginScreen) {
            if (isDomiciliario) {
                router.replace('/mis-domicilios' as any);
            } else if (isCocina) {
                router.replace('/ordenes' as any);
            } else if (isContador) {
                router.replace('/contabilidad' as any);
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
        } else if (token && isContador) {
            const currentPath = '/' + segments.filter((s: string) => !s.startsWith('(')).join('/');
            // Comparación exacta: startsWith dejaría pasar cualquier ruta que empiece igual
            const allowedForContador = ['/contabilidad', '/estadisticas'];
            if (!allowedForContador.includes(currentPath)) {
                router.replace('/contabilidad' as any);
            }
        } else if (token && isMesero) {
            const currentPath = '/' + segments.filter((s: string) => !s.startsWith('(')).join('/');
            const blockedForMesero = ['/estadisticas'];
            if (blockedForMesero.includes(currentPath)) {
                router.replace('/' as any);
            }
        }
    }, [token, user, segments, isLoading, router]);
}
