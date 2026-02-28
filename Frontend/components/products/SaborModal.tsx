import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
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
    const [pequena, setPequena] = useState('0');
    const [mediana, setMediana] = useState('0');
    const [grande, setGrande] = useState('0');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (sabor) {
            setPequena(String(sabor.recargoPequena));
            setMediana(String(sabor.recargoMediana));
            setGrande(String(sabor.recargoGrande));
            setError(null);
        }
    }, [sabor]);

    const handleSave = () => {
        const p = Number(pequena);
        const m = Number(mediana);
        const g = Number(grande);
        if (isNaN(p) || isNaN(m) || isNaN(g) || p < 0 || m < 0 || g < 0) {
            setError('Los recargos deben ser números positivos');
            return;
        }
        onSave(sabor!.saborId, { recargoPequena: p, recargoMediana: m, recargoGrande: g });
    };

    if (!sabor) return null;

    const isEspecial = sabor.tipo === 'especial';

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <Pressable
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
                onPress={onClose}
            >
                <Pressable
                    style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, width: '100%', maxWidth: 380 }}
                    onPress={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                        {isEspecial ? '★ ' : ''}{sabor.nombre}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg }}>
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
                        <Text style={{ color: colors.danger, fontSize: 13, marginTop: 4, marginBottom: 8 }}>{error}</Text>
                    )}

                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                        <Button title="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
                        <Button title={loading ? 'Guardando...' : 'Guardar'} onPress={handleSave} loading={loading} style={{ flex: 1 }} />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
