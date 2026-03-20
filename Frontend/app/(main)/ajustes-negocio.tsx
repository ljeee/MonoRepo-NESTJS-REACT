import React from 'react';
import { View } from '../../tw';
import { PageContainer, PageHeader } from '../../components/ui';
import { EmptyState } from '../../components/states/EmptyState';

export default function AjustesNegocioScreen() {
    return (
        <PageContainer>
            <PageHeader
                title="Perfil de Negocio"
                subtitle="Configuración"
                icon="storefront-outline"
            />
            
            <View className="flex-1 justify-center py-20">
                <EmptyState
                    icon="monitor-screenshot"
                    message="Disponible en Web"
                    subMessage="La configuración legal y de facturación avanzada solo está disponible en la versión de escritorio por seguridad y espacio."
                />
            </View>
        </PageContainer>
    );
}
