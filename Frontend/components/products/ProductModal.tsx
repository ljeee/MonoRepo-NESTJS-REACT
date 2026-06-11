import React, { useState } from 'react';
import { Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { View, Text, ScrollView, TouchableOpacity } from '../../tw';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Icon from '../ui/Icon';
import { PERSONALIZACION_OPCIONES } from '@/src/shared';

// ─── Emoji catalogue ──────────────────────────────────────────────────────────

const EMOJI_GROUPS = [
    {
        label: 'Pizzas & Pastas',
        emojis: ['🍕', '🫓', '🥧', '🍝', '🍜', '🍲', '🧀', '🌶️', '🫛', '🧄', '🫑', '🍅'],
    },
    {
        label: 'Carnes & Burgers',
        emojis: ['🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🫔', '🥩', '🍖', '🍗', '🥓', '🍤', '🍣', '🍱'],
    },
    {
        label: 'Snacks & Sides',
        emojis: ['🥗', '🥙', '🧆', '🫕', '🥟', '🍢', '🍡', '🍘', '🍙', '🍚', '🍛', '🍥', '🥚', '🧇', '🥞', '🍳'],
    },
    {
        label: 'Bebidas',
        emojis: ['🥤', '🧃', '🧋', '☕', '🍵', '🥛', '💧', '🍶', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🧊'],
    },
    {
        label: 'Postres & Dulces',
        emojis: ['🍰', '🎂', '🧁', '🥮', '🍮', '🍯', '🍦', '🍧', '🍨', '🍩', '🍪', '🍫', '🍬', '🍭', '🍡', '🥧'],
    },
    {
        label: 'Frutas',
        emojis: ['🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🫒', '🥑'],
    },
    {
        label: 'Vegetales',
        emojis: ['🌽', '🥕', '🧅', '🧄', '🥔', '🍠', '🥒', '🥬', '🥦', '🫛', '🫑', '🌶️', '🍄', '🥜', '🌰', '🫘'],
    },
    {
        label: 'Combos & Especiales',
        emojis: ['🍱', '🥡', '🥠', '🎁', '⭐', '🌟', '✨', '🔥', '💯', '🆕', '🎉', '👑', '💎', '🏆', '❤️', '🌈'],
    },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductModalProps {
    visible: boolean;
    editing: boolean;
    name: string;
    description: string;
    emoji: string;
    error: string;
    loading: boolean;
    personalizacion: string;
    onClose: () => void;
    onSave: () => void;
    onDelete?: () => void;
    onNameChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onEmojiChange: (value: string) => void;
    onPersonalizacionChange: (value: string) => void;
}

export function ProductModal({
    visible,
    editing,
    name,
    description,
    emoji,
    error,
    loading,
    personalizacion,
    onClose,
    onSave,
    onDelete,
    onNameChange,
    onDescriptionChange,
    onEmojiChange,
    onPersonalizacionChange,
}: ProductModalProps) {
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const displayEmoji = emoji || (name.toLowerCase().includes('pizza') ? '🍕' : '🍔');

    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }}>
                <Pressable
                    style={{ flex: 1, backgroundColor: 'rgba(5,9,20,0.92)', justifyContent: 'flex-end' }}
                    onPress={onClose}
                >
                    <Pressable
                        style={{
                            backgroundColor: '#0F172A',
                            borderTopLeftRadius: 32,
                            borderTopRightRadius: 32,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.07)',
                            maxHeight: '92%',
                        }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 14,
                                padding: 20,
                                borderBottomWidth: 1,
                                borderBottomColor: 'rgba(255,255,255,0.05)',
                            }}
                        >
                            {/* Emoji preview — tap to open picker */}
                            <TouchableOpacity
                                onPress={() => setShowEmojiPicker((v) => !v)}
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 16,
                                    backgroundColor: showEmojiPicker
                                        ? 'rgba(245,165,36,0.15)'
                                        : 'rgba(245,165,36,0.08)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: showEmojiPicker
                                        ? 'rgba(245,165,36,0.4)'
                                        : 'rgba(245,165,36,0.2)',
                                }}
                            >
                                <Text style={{ fontSize: 26 }}>{displayEmoji}</Text>
                            </TouchableOpacity>

                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        fontFamily: 'SpaceGrotesk-Bold',
                                        color: '#F8FAFC',
                                        fontSize: 16,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1,
                                    }}
                                >
                                    {editing ? 'Editar Producto' : 'Nuevo Producto'}
                                </Text>
                                <Text style={{ color: '#475569', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', marginTop: 2 }}>
                                    Toca el icono para cambiarlo
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={onClose}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 12,
                                    backgroundColor: 'rgba(255,255,255,0.04)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.06)',
                                }}
                            >
                                <Icon name="close" size={16} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={{ maxHeight: 520 }}
                            contentContainerStyle={{ padding: 20, gap: 16 }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {/* ── Emoji picker ── */}
                            {showEmojiPicker && (
                                <View
                                    style={{
                                        backgroundColor: 'rgba(0,0,0,0.3)',
                                        borderRadius: 20,
                                        borderWidth: 1,
                                        borderColor: 'rgba(245,165,36,0.2)',
                                        padding: 14,
                                        marginBottom: 4,
                                    }}
                                >
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 6,
                                            marginBottom: 12,
                                        }}
                                    >
                                        <Icon name="emoticon-outline" size={14} color="#F5A524" />
                                        <Text
                                            style={{
                                                color: '#F5A524',
                                                fontSize: 9,
                                                fontFamily: 'SpaceGrotesk-Bold',
                                                textTransform: 'uppercase',
                                                letterSpacing: 1,
                                            }}
                                        >
                                            Selecciona un icono
                                        </Text>
                                        {emoji ? (
                                            <TouchableOpacity
                                                onPress={() => { onEmojiChange(''); setShowEmojiPicker(false); }}
                                                style={{
                                                    marginLeft: 'auto',
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 3,
                                                    borderRadius: 8,
                                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                                    borderWidth: 1,
                                                    borderColor: 'rgba(255,255,255,0.08)',
                                                }}
                                            >
                                                <Text style={{ color: '#64748B', fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
                                                    Restablecer
                                                </Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>

                                    {EMOJI_GROUPS.map((group) => (
                                        <View key={group.label} style={{ marginBottom: 10 }}>
                                            <Text
                                                style={{
                                                    color: '#334155',
                                                    fontSize: 8,
                                                    fontFamily: 'SpaceGrotesk-Bold',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                    marginBottom: 6,
                                                }}
                                            >
                                                {group.label}
                                            </Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                {group.emojis.map((e) => (
                                                    <TouchableOpacity
                                                        key={e}
                                                        onPress={() => { onEmojiChange(e); setShowEmojiPicker(false); }}
                                                        style={{
                                                            width: 44,
                                                            height: 44,
                                                            borderRadius: 12,
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            backgroundColor: emoji === e
                                                                ? 'rgba(245,165,36,0.15)'
                                                                : 'rgba(255,255,255,0.04)',
                                                            borderWidth: 1,
                                                            borderColor: emoji === e
                                                                ? 'rgba(245,165,36,0.4)'
                                                                : 'rgba(255,255,255,0.06)',
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 22 }}>{e}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* ── Fields ── */}
                            <Input
                                label="Nombre del Producto"
                                value={name}
                                onChangeText={onNameChange}
                                placeholder="Ej: Pizza Hawaiana"
                                leftIcon={<Icon name="tag-outline" size={16} color="#64748B" />}
                            />
                            <Input
                                label="Descripción"
                                value={description}
                                onChangeText={onDescriptionChange}
                                placeholder="Descripción opcional"
                                multiline
                                numberOfLines={3}
                            />

                            {/* ── Personalización (modal de sabores al agregar a una orden) ── */}
                            <View>
                                <Text style={{ color: '#94A3B8', fontSize: 11, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 2 }}>
                                    Personalización al pedir
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {PERSONALIZACION_OPCIONES.map((opt) => {
                                        const isSelected = (personalizacion || 'ninguna') === opt.value;
                                        return (
                                            <TouchableOpacity
                                                key={opt.value}
                                                onPress={() => onPersonalizacionChange(opt.value)}
                                                style={{
                                                    paddingHorizontal: 14,
                                                    paddingVertical: 9,
                                                    borderRadius: 14,
                                                    borderWidth: 1,
                                                    backgroundColor: isSelected ? 'rgba(245,165,36,0.18)' : 'rgba(255,255,255,0.04)',
                                                    borderColor: isSelected ? 'rgba(245,165,36,0.45)' : 'rgba(255,255,255,0.08)',
                                                }}
                                            >
                                                <Text style={{ fontSize: 11, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', color: isSelected ? '#F5A524' : '#64748B' }}>
                                                    {opt.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <Text style={{ color: '#475569', fontSize: 10, marginTop: 6, marginLeft: 2 }}>
                                    Define qué modal se abre al agregarlo a una orden (sabores, calzone, base de jugo o ninguno).
                                </Text>
                            </View>

                            {/* Error */}
                            {error ? (
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 8,
                                        backgroundColor: 'rgba(239,68,68,0.08)',
                                        padding: 12,
                                        borderRadius: 14,
                                        borderWidth: 1,
                                        borderColor: 'rgba(239,68,68,0.2)',
                                    }}
                                >
                                    <Icon name="alert-circle" size={14} color="#EF4444" />
                                    <Text style={{ color: '#F87171', fontSize: 12, fontFamily: 'SpaceGrotesk-Bold', flex: 1 }}>
                                        {error}
                                    </Text>
                                </View>
                            ) : null}
                        </ScrollView>

                        {/* Footer */}
                        <View
                            style={{
                                flexDirection: 'row',
                                gap: 10,
                                padding: 16,
                                borderTopWidth: 1,
                                borderTopColor: 'rgba(255,255,255,0.05)',
                            }}
                        >
                            {editing && onDelete && (
                                <TouchableOpacity
                                    onPress={onDelete}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 14,
                                        backgroundColor: 'rgba(239,68,68,0.08)',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 1,
                                        borderColor: 'rgba(239,68,68,0.2)',
                                    }}
                                >
                                    <Icon name="trash-can-outline" size={18} color="#EF4444" />
                                </TouchableOpacity>
                            )}
                            <Button
                                title="Cancelar"
                                variant="ghost"
                                onPress={onClose}
                                style={{ flex: 1 }}
                            />
                            <Button
                                title={loading ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
                                variant="primary"
                                icon="content-save-outline"
                                onPress={onSave}
                                loading={loading}
                                disabled={!name.trim()}
                                style={{ flex: 2 }}
                            />
                        </View>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}
