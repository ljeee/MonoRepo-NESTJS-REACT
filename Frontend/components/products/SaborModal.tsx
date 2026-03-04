import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PizzaSabor } from '../../hooks/use-pizza-sabores';
import { colors } from '../../styles/theme';
import { radius, spacing } from '../../styles/tokens';
import { Input, Button } from '../ui';

interface SaborModalProps {
    visible: boolean;
    sabor: PizzaSabor | null;
    loading?: boolean;
    onSave: (saborId: number, data: { recargoPequena: number; recargoMediana: number; recargoGrande: number }) => void;
    onClose: () => void;
}

export function SaborModal({ visible, sabor, loading, onSave, onClose }: SaborModalProps) {
    if (!sabor) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <Pressable
                style={saborStyles.overlay}
                onPress={onClose}
            >
                <SaborModalForm
                    key={`${sabor.saborId}-${visible ? 'open' : 'closed'}`}
                    sabor={sabor}
                    loading={loading}
                    onSave={onSave}
                    onClose={onClose}
                />
            </Pressable>
        </Modal>
    );
}

function SaborModalForm({
    sabor,
    loading,
    onSave,
    onClose,
}: {
    sabor: PizzaSabor;
    loading?: boolean;
    onSave: (saborId: number, data: { recargoPequena: number; recargoMediana: number; recargoGrande: number }) => void;
    onClose: () => void;
}) {
    const [pequena, setPequena] = useState(() => String(sabor.recargoPequena));
    const [mediana, setMediana] = useState(() => String(sabor.recargoMediana));
    const [grande, setGrande] = useState(() => String(sabor.recargoGrande));
    const [error, setError] = useState<string | null>(null);

    const handleSave = () => {
        const p = Number(pequena);
        const m = Number(mediana);
        const g = Number(grande);
        if (isNaN(p) || isNaN(m) || isNaN(g) || p < 0 || m < 0 || g < 0) {
            setError('Los recargos deben ser números positivos');
            return;
        }
        onSave(sabor.saborId, { recargoPequena: p, recargoMediana: m, recargoGrande: g });
    };

    const isEspecial = sabor.tipo === 'especial';

    return (
        <Pressable
            style={saborStyles.card}
            onPress={e => e.stopPropagation()}
        >
            <Text style={saborStyles.title}>
                {isEspecial ? '★ ' : ''}{sabor.nombre}
            </Text>
            <Text style={saborStyles.subtitle}>
                {sabor.tipo === 'configuracion'
                    ? 'Configura el valor de recargo global'
                    : (isEspecial ? 'Sabor especial — configura el recargo por tamaño' : 'Sabor tradicional — sin recargo aplicado')}
            </Text>

            {sabor.tipo !== 'configuracion' && (
                <>
                    <Input
                        label="Recargo Pequeña ($)"
                        value={pequena}
                        onChangeText={setPequena}
                        keyboardType="numeric"
                        placeholder="0"
                    />
                    <Input
                        label="Recargo Mediana ($)"
                        value={mediana}
                        onChangeText={setMediana}
                        keyboardType="numeric"
                        placeholder="0"
                    />
                </>
            )}
            <Input
                label={sabor.tipo === 'configuracion' ? "Valor Adicional ($)" : "Recargo Grande ($)"}
                value={grande}
                onChangeText={setGrande}
                keyboardType="numeric"
                placeholder="0"
            />

            {error && (
                <Text style={saborStyles.errorText}>{error}</Text>
            )}

            <View style={saborStyles.actionsRow}>
                <Button title="Cancelar" variant="ghost" onPress={onClose} style={saborStyles.actionBtn} />
                <Button title={loading ? 'Guardando...' : 'Guardar'} onPress={handleSave} loading={loading} style={saborStyles.actionBtn} />
            </View>
        </Pressable>
    );
}

const saborStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 380,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: colors.textMuted,
        marginBottom: spacing.lg,
    },
    errorText: {
        color: colors.danger,
        fontSize: 13,
        marginTop: 4,
        marginBottom: 8,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    actionBtn: {
        flex: 1,
    },
});
