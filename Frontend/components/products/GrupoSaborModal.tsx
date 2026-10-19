import React, { useState } from 'react';
import { Modal, Platform } from 'react-native';
import { View, Text, ScrollView, KeyboardAvoidingView, Pressable } from '../../tw';
import type { SaborGrupo, GuardarSaborGrupoDto } from '@/src/shared';
import { Input, Button, Icon, Card, InlineError } from '../ui';

interface GrupoSaborModalProps {
    visible: boolean;
    /** Grupo a editar. Sin `id` el modal funciona en modo creación. */
    grupo: Partial<SaborGrupo> | null;
    loading?: boolean;
    onSave: (id: number | undefined, data: GuardarSaborGrupoDto) => void | Promise<void>;
    onDelete?: (grupo: SaborGrupo) => void;
    onClose: () => void;
}

/** Reglas de un grupo de sabores: cuántos sabores admite, si tiene tamaños y el recargo por pedir varios. */
export function GrupoSaborModal({ visible, grupo, loading, onSave, onDelete, onClose }: GrupoSaborModalProps) {
    if (!grupo) return null;
    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <View style={{ flex: 1, backgroundColor: 'rgba(5, 9, 20, 1)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <GrupoForm
                        key={`${grupo.id ?? 'nuevo'}-${visible ? 'open' : 'closed'}`}
                        grupo={grupo}
                        loading={loading}
                        onSave={onSave}
                        onDelete={onDelete}
                        onClose={onClose}
                    />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function Opcion({ activo, titulo, detalle, onPress }: { activo: boolean; titulo: string; detalle: string; onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            className={`flex-row items-center gap-3 px-4 py-3 rounded-2xl border ${activo ? 'bg-purple-500/15 border-purple-500/40' : 'bg-white/5 border-white/10'}`}
        >
            <Icon name={activo ? 'check-circle' : 'circle-outline'} size={18} color={activo ? '#C084FC' : '#64748B'} />
            <View className="flex-1">
                <Text className={`text-xs font-black uppercase tracking-widest ${activo ? 'text-purple-300' : 'text-slate-300'}`}>{titulo}</Text>
                <Text className="text-slate-500 text-[11px] mt-0.5">{detalle}</Text>
            </View>
        </Pressable>
    );
}

function GrupoForm({
    grupo,
    loading,
    onSave,
    onDelete,
    onClose,
}: {
    grupo: Partial<SaborGrupo>;
    loading?: boolean;
    onSave: (id: number | undefined, data: GuardarSaborGrupoDto) => void | Promise<void>;
    onDelete?: (grupo: SaborGrupo) => void;
    onClose: () => void;
}) {
    const isNuevo = !grupo.id;
    const [nombre, setNombre] = useState(() => grupo.nombre ?? '');
    const [maxSabores, setMaxSabores] = useState(() => String(grupo.maxSabores ?? 1));
    const [usaTamano, setUsaTamano] = useState(() => grupo.usaTamano ?? false);
    const [varianteEsSabor, setVarianteEsSabor] = useState(() => grupo.varianteEsSabor ?? false);
    const [cobraExtra, setCobraExtra] = useState(() => grupo.recargoExtraDesde != null);
    const [extraDesde, setExtraDesde] = useState(() => String(grupo.recargoExtraDesde ?? 3));
    const [extraP, setExtraP] = useState(() => String(grupo.recargoExtraPequena ?? 0));
    const [extraM, setExtraM] = useState(() => String(grupo.recargoExtraMediana ?? 0));
    const [extraG, setExtraG] = useState(() => String(grupo.recargoExtraGrande ?? 0));
    const [activo, setActivo] = useState(() => grupo.activo ?? true);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        const max = Number(maxSabores);
        const desde = Number(extraDesde);
        const [p, m, g] = [extraP, extraM, extraG].map(Number);
        if (!nombre.trim()) return setError('Escribe el nombre del grupo');
        if (!Number.isInteger(max) || max < 1 || max > 10) return setError('El tope de sabores va de 1 a 10');
        if (cobraExtra) {
            if (!Number.isInteger(desde) || desde < 2 || desde > max) return setError('El recargo extra debe empezar entre 2 y el tope de sabores');
            if ([p, m, g].some((n) => isNaN(n) || n < 0)) return setError('Los recargos deben ser números positivos');
        }
        setError(null);
        try {
            await onSave(grupo.id, {
                nombre: nombre.trim(),
                maxSabores: max,
                usaTamano,
                varianteEsSabor,
                recargoExtraDesde: cobraExtra ? desde : null,
                // Sin tamaños se cobra un solo valor: la columna "grande".
                recargoExtraPequena: cobraExtra && usaTamano ? p : 0,
                recargoExtraMediana: cobraExtra && usaTamano ? m : 0,
                recargoExtraGrande: cobraExtra ? g : 0,
                activo,
            });
        } catch {
            setError('No se pudo guardar el grupo. Revisa que el nombre no exista ya.');
        }
    };

    return (
        <Card className="w-full max-w-[520px] bg-[#0F172A] border border-white/10 overflow-hidden rounded-[40px]">
            <ScrollView contentContainerStyle={{ padding: 32 }}>
                <View className="flex-row items-center gap-4 mb-8">
                    <View className="w-12 h-12 rounded-2xl bg-purple-500/10 items-center justify-center border border-purple-500/20">
                        <Icon name="shape-outline" size={24} color="#A855F7" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-white font-black text-2xl uppercase tracking-tighter leading-none" style={{ fontFamily: 'Space Grotesk' }}>
                            {isNuevo ? 'Nuevo grupo' : grupo.nombre}
                        </Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mt-1">Reglas de los sabores</Text>
                    </View>
                </View>

                <View className="gap-y-5">
                    <Input
                        label="Nombre del grupo"
                        value={nombre}
                        onChangeText={setNombre}
                        placeholder="Ej: Hamburguesa, Pizza, Calzone"
                        leftIcon={<Icon name="format-letter-case" size={16} color="#64748B" />}
                    />
                    <Input
                        label="Máximo de sabores por unidad"
                        value={maxSabores}
                        onChangeText={setMaxSabores}
                        keyboardType="numeric"
                        placeholder="1"
                    />

                    <Opcion
                        activo={usaTamano}
                        titulo="Tiene tamaños"
                        detalle="Pequeña / mediana / grande: cada sabor puede tener un recargo distinto por tamaño."
                        onPress={() => setUsaTamano((v) => !v)}
                    />
                    <Opcion
                        activo={varianteEsSabor}
                        titulo="La variante es el sabor"
                        detalle="Como el calzone: las variantes del producto son los sabores (no se repite el nombre en la orden)."
                        onPress={() => setVarianteEsSabor((v) => !v)}
                    />
                    <Opcion
                        activo={cobraExtra}
                        titulo="Recargo por pedir varios sabores"
                        detalle="Se suma al precio cuando la unidad lleva muchos sabores."
                        onPress={() => setCobraExtra((v) => !v)}
                    />

                    {cobraExtra && (
                        <View className="gap-y-4">
                            <Input
                                label="Desde cuántos sabores"
                                value={extraDesde}
                                onChangeText={setExtraDesde}
                                keyboardType="numeric"
                                placeholder="3"
                            />
                            {usaTamano ? (
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <Input label="Pequeña ($)" value={extraP} onChangeText={setExtraP} keyboardType="numeric" placeholder="0" />
                                    </View>
                                    <View className="flex-1">
                                        <Input label="Mediana ($)" value={extraM} onChangeText={setExtraM} keyboardType="numeric" placeholder="0" />
                                    </View>
                                    <View className="flex-1">
                                        <Input label="Grande ($)" value={extraG} onChangeText={setExtraG} keyboardType="numeric" placeholder="0" />
                                    </View>
                                </View>
                            ) : (
                                <Input label="Recargo ($)" value={extraG} onChangeText={setExtraG} keyboardType="numeric" placeholder="0" />
                            )}
                        </View>
                    )}

                    <Opcion
                        activo={activo}
                        titulo="Grupo activo"
                        detalle="Desactívalo para dejar de ofrecer sus sabores sin borrarlos."
                        onPress={() => setActivo((v) => !v)}
                    />

                    <InlineError message={error} size="sm" />

                    <View className="flex-row gap-3 mt-2">
                        {!isNuevo && onDelete && (
                            <Button title="" icon="trash-can-outline" variant="danger" onPress={() => onDelete(grupo as SaborGrupo)} />
                        )}
                        <Button title="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
                        <Button
                            title={loading ? 'Salvando...' : 'Guardar'}
                            variant="primary"
                            onPress={handleSave}
                            loading={loading}
                            style={{ flex: 1 }}
                        />
                    </View>
                </View>
            </ScrollView>
        </Card>
    );
}
