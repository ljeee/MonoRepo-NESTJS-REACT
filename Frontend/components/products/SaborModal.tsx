import React, { useState } from 'react';
import { Modal, Platform } from 'react-native';
import { View, Text, ScrollView, KeyboardAvoidingView, Pressable } from '../../tw';
import type { PizzaSabor, SaborGrupo } from '@/src/shared';
import { Input, Button, Icon, Card, InlineError } from '../ui';

export interface SaborModalSaveData {
    nombre: string;
    grupoId: number;
    activo: boolean;
    recargoPequena: number;
    recargoMediana: number;
    recargoGrande: number;
}

interface SaborModalProps {
    visible: boolean;
    /** Sabor a editar. Sin `saborId` el modal funciona en modo creación. */
    sabor: Partial<PizzaSabor> | null;
    grupos: SaborGrupo[];
    loading?: boolean;
    onSave: (saborId: number | undefined, data: SaborModalSaveData) => void | Promise<void>;
    onClose: () => void;
}

/** Crea o edita un sabor: nombre, grupo y recargos. Es el único editor de sabores de la app. */
export function SaborModal({ visible, sabor, grupos, loading, onSave, onClose }: SaborModalProps) {
    if (!sabor) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(5, 9, 20, 1)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <SaborModalForm
                        key={`${sabor.saborId ?? 'nuevo'}-${visible ? 'open' : 'closed'}`}
                        sabor={sabor}
                        grupos={grupos}
                        loading={loading}
                        onSave={onSave}
                        onClose={onClose}
                    />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function SaborModalForm({
    sabor,
    grupos,
    loading,
    onSave,
    onClose,
}: {
    sabor: Partial<PizzaSabor>;
    grupos: SaborGrupo[];
    loading?: boolean;
    onSave: (saborId: number | undefined, data: SaborModalSaveData) => void | Promise<void>;
    onClose: () => void;
}) {
    const isNuevo = !sabor.saborId;
    const [nombre, setNombre] = useState(() => sabor.nombre ?? '');
    const [grupoId, setGrupoId] = useState<number | null>(() => sabor.grupoId ?? grupos[0]?.id ?? null);
    const [activo, setActivo] = useState(() => sabor.activo ?? true);
    const [pequena, setPequena] = useState(() => String(sabor.recargoPequena ?? 0));
    const [mediana, setMediana] = useState(() => String(sabor.recargoMediana ?? 0));
    const [grande, setGrande] = useState(() => String(sabor.recargoGrande ?? 0));
    const [error, setError] = useState<string | null>(null);

    const grupo = grupos.find((g) => g.id === grupoId) ?? null;
    // Un grupo sin tamaños cobra un solo recargo (se guarda en la columna "grande").
    const usaTamano = grupo?.usaTamano ?? false;

    const handleSave = async () => {
        const p = usaTamano ? Number(pequena) : 0;
        const m = usaTamano ? Number(mediana) : 0;
        const g = Number(grande);
        if ([p, m, g].some((n) => isNaN(n) || n < 0)) {
            setError('Los recargos deben ser números positivos');
            return;
        }
        if (!nombre.trim()) {
            setError('Escribe el nombre del sabor');
            return;
        }
        if (grupoId == null) {
            setError('Elige el grupo del sabor');
            return;
        }
        setError(null);
        try {
            await onSave(sabor.saborId, {
                nombre: nombre.trim(),
                grupoId,
                activo,
                recargoPequena: p,
                recargoMediana: m,
                recargoGrande: g,
            });
        } catch {
            setError('No se pudo guardar el sabor. Revisa que el nombre no exista ya en ese grupo.');
        }
    };

    return (
        <Card
            className="w-full max-w-[500px] bg-[#0F172A] border border-white/10 overflow-hidden rounded-[40px]"
        >
            <ScrollView contentContainerStyle={{ padding: 32 }}>
                <View className="flex-row items-center gap-4 mb-8">
                    <View className="w-12 h-12 rounded-2xl bg-purple-500/10 items-center justify-center border border-purple-500/20">
                        <Icon name="pizza" size={24} color="#A855F7" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-white font-black text-2xl uppercase tracking-tighter leading-none" style={{ fontFamily: 'Space Grotesk' }}>
                            {isNuevo ? 'Nuevo sabor' : sabor.nombre}
                        </Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mt-1">
                            {grupo ? `Grupo ${grupo.nombre}` : 'Sin grupo'}
                        </Text>
                    </View>
                </View>

                <View className="gap-y-6">
                    <Input
                        label="Nombre"
                        value={nombre}
                        onChangeText={setNombre}
                        placeholder="Ej: Hawaiana"
                        leftIcon={<Icon name="format-letter-case" size={16} color="#64748B" />}
                    />

                    {grupos.length > 1 && (
                        <View>
                            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Grupo</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {grupos.map((g) => {
                                    const seleccionado = g.id === grupoId;
                                    return (
                                        <Pressable
                                            key={g.id}
                                            onPress={() => setGrupoId(g.id)}
                                            className={`px-4 py-3 rounded-2xl items-center border ${seleccionado ? 'bg-purple-500/20 border-purple-500/40' : 'bg-white/5 border-white/10'}`}
                                        >
                                            <Text className={`text-xs font-black uppercase tracking-widest ${seleccionado ? 'text-purple-300' : 'text-slate-400'}`}>
                                                {g.nombre}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {usaTamano ? (
                        <View>
                            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">
                                Recargo por tamaño ($) — 0 = sin recargo
                            </Text>
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Input label="Pequeña" value={pequena} onChangeText={setPequena} keyboardType="numeric" placeholder="0" />
                                </View>
                                <View className="flex-1">
                                    <Input label="Mediana" value={mediana} onChangeText={setMediana} keyboardType="numeric" placeholder="0" />
                                </View>
                                <View className="flex-1">
                                    <Input label="Grande" value={grande} onChangeText={setGrande} keyboardType="numeric" placeholder="0" />
                                </View>
                            </View>
                        </View>
                    ) : (
                        <Input
                            label="Recargo del sabor ($) — 0 = sin recargo"
                            value={grande}
                            onChangeText={setGrande}
                            keyboardType="numeric"
                            placeholder="0"
                            leftIcon={<Icon name="currency-usd" size={16} color="#F5A524" />}
                        />
                    )}

                    <Pressable
                        onPress={() => setActivo((v) => !v)}
                        className={`flex-row items-center gap-3 px-4 py-3 rounded-2xl border ${activo ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}
                    >
                        <Icon name={activo ? 'check-circle' : 'circle-outline'} size={18} color={activo ? '#34D399' : '#64748B'} />
                        <Text className={`text-xs font-black uppercase tracking-widest ${activo ? 'text-emerald-300' : 'text-slate-400'}`}>
                            {activo ? 'Disponible al pedir' : 'Oculto al pedir'}
                        </Text>
                    </Pressable>

                    <InlineError message={error} size="sm" />

                    <View className="flex-row gap-4 mt-2">
                        <Button
                            title="Cancelar"
                            variant="ghost"
                            onPress={onClose}
                            style={{ flex: 1 }}
                        />
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
