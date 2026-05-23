import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Platform, useWindowDimensions } from 'react-native';
import { Pressable, View, Text, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView } from '../../tw';
import { Button, Icon } from '../ui';
import type { IconName } from '../ui/Icon';
import { formatCurrency, useApi } from '@/src/shared';
import type { DenominacionesMap } from '@/src/shared';

interface PaymentSelectionModalProps {
    visible: boolean;
    total: number;
    onClose: () => void;
    onSelect: (method: string, pagoEfectivo?: number, pagoTransferencia?: number, denominaciones?: DenominacionesMap) => void;
    loading?: boolean;
}

const METHODS: { id: string; label: string; shortLabel: string; icon: IconName; color: string }[] = [
    { id: 'efectivo',              label: 'Efectivo',               shortLabel: 'Efectivo',  icon: 'cash',            color: '#10B981' },
    { id: 'transferencia',         label: 'Transferencia',          shortLabel: 'QR/Trans',  icon: 'bank',            color: '#8B5CF6' },
    { id: 'efectivo_transferencia', label: 'Efectivo y Transferencia', shortLabel: 'Mixto', icon: 'swap-horizontal', color: '#F5A524' },
];

const COLOMBIAN_BILLS = [200000, 100000, 50000, 20000, 10000, 5000, 2000];

function BillCounter({
    bill,
    count,
    onChange,
    enCaja,
}: {
    bill: number;
    count: number;
    onChange: (newCount: number) => void;
    enCaja?: number;
}) {
    const subtotal = count * bill;
    const hasStock = enCaja !== undefined && enCaja > 0;

    return (
        <View className={`flex-row items-center rounded-lg px-2.5 py-1.5 border ${count > 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.03] border-white/5'}`}>
            {/* Label + en-caja badge + subtotal */}
            <View className="flex-1 flex-row items-center gap-1.5 flex-wrap">
                <Text
                    style={{ fontFamily: 'SpaceGrotesk-Bold', minWidth: 60 }}
                    className={`text-xs font-black ${count > 0 ? 'text-white' : 'text-slate-400'}`}
                >
                    ${formatCurrency(bill)}
                </Text>
                {enCaja !== undefined && (
                    <View className={`px-1 py-0.5 rounded ${hasStock ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-white/5'}`}>
                        <Text className={`text-[8px] font-black ${hasStock ? 'text-emerald-400' : 'text-slate-600'}`}>
                            {enCaja} ↓
                        </Text>
                    </View>
                )}
                {count > 0 && (
                    <Text className="text-emerald-400 text-[9px] font-bold">
                        =${formatCurrency(subtotal)}
                    </Text>
                )}
            </View>

            {/* Counter controls */}
            <View className="flex-row items-center gap-1.5">
                <TouchableOpacity
                    onPress={() => onChange(Math.max(0, count - 1))}
                    disabled={count === 0}
                    className={`w-7 h-7 rounded-lg items-center justify-center border ${
                        count > 0 ? 'bg-white/10 border-white/10' : 'bg-white/[0.03] border-white/5 opacity-30'
                    }`}
                >
                    <Icon name="minus" size={12} color={count > 0 ? '#94A3B8' : '#475569'} />
                </TouchableOpacity>

                <Text
                    style={{ fontFamily: 'SpaceGrotesk-Bold', minWidth: 22, textAlign: 'center' }}
                    className={`font-black text-sm ${count > 0 ? 'text-white' : 'text-slate-600'}`}
                >
                    {count}
                </Text>

                <TouchableOpacity
                    onPress={() => onChange(count + 1)}
                    className="w-7 h-7 rounded-lg items-center justify-center bg-emerald-500/10 border border-emerald-500/20"
                >
                    <Icon name="plus" size={12} color="#10B981" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function PaymentSelectionModal({ visible, total, onClose, onSelect, loading }: PaymentSelectionModalProps) {
    const api = useApi();
    const { height: screenHeight } = useWindowDimensions();
    const [selected, setSelected] = useState('efectivo');
    const [cajaEstado, setCajaEstado] = useState<DenominacionesMap>({});

    const [billCountsEfectivo, setBillCountsEfectivo] = useState<Record<string, number>>({});
    const [monedasEfectivo, setMonedasEfectivo] = useState('');

    const [montoTransferencia, setMontoTransferencia] = useState('');
    const [montoEfectivo, setMontoEfectivo] = useState('');
    const [billCountsMixto, setBillCountsMixto] = useState<Record<string, number>>({});
    const [monedaMixto, setMonedaMixto] = useState('');

    const fetchCaja = useCallback(async () => {
        try {
            const estado = await api.cajaDenominaciones.getEstado();
            setCajaEstado(estado);
        } catch {
            setCajaEstado({});
        }
    }, [api]);

    useEffect(() => {
        if (visible) {
            setBillCountsEfectivo({});
            setMonedasEfectivo('');
            setMontoTransferencia('');
            setMontoEfectivo('');
            setBillCountsMixto({});
            setMonedaMixto('');
            fetchCaja();
        }
    }, [visible, selected, fetchCaja]);

    const handleMontoTransferenciaChange = (text: string) => {
        const clean = text.replace(/[^0-9]/g, '');
        setMontoTransferencia(clean);
        const valTrans = Number(clean) || 0;
        setMontoEfectivo(String(valTrans > total ? 0 : total - valTrans));
    };

    const handleMontoEfectivoChange = (text: string) => {
        const clean = text.replace(/[^0-9]/g, '');
        setMontoEfectivo(clean);
        const valEf = Number(clean) || 0;
        setMontoTransferencia(String(valEf > total ? 0 : total - valEf));
    };

    const totalEfectivoFisico = COLOMBIAN_BILLS.reduce(
        (sum, b) => sum + (billCountsEfectivo[String(b)] || 0) * b, 0
    ) + (Number(monedasEfectivo) || 0);

    const totalMixtoFisico = COLOMBIAN_BILLS.reduce(
        (sum, b) => sum + (billCountsMixto[String(b)] || 0) * b, 0
    ) + (Number(monedaMixto) || 0);

    const cashTarget = selected === 'efectivo' ? total : (Number(montoEfectivo) || 0);
    const cashReceived = selected === 'efectivo' ? totalEfectivoFisico : totalMixtoFisico;
    const cambio = cashReceived > 0 ? cashReceived - cashTarget : 0;

    const hasEnteredEfectivo = totalEfectivoFisico > 0;
    const hasEnteredMixto = totalMixtoFisico > 0;

    function buildDenominaciones(billCounts: Record<string, number>): DenominacionesMap | undefined {
        const map: DenominacionesMap = {};
        for (const [key, qty] of Object.entries(billCounts)) {
            if (qty > 0) map[key] = qty;
        }
        return Object.keys(map).length > 0 ? map : undefined;
    }

    const handleConfirm = () => {
        if (selected === 'efectivo') {
            onSelect('efectivo', total, 0, buildDenominaciones(billCountsEfectivo));
        } else if (selected === 'transferencia') {
            onSelect('transferencia', 0, total);
        } else if (selected === 'efectivo_transferencia') {
            const efVal = Number(montoEfectivo) || 0;
            const transVal = Number(montoTransferencia) || 0;
            onSelect('efectivo_transferencia', efVal, transVal, buildDenominaciones(billCountsMixto));
        }
    };

    const isConfirmDisabled = (() => {
        if (selected === 'efectivo') {
            return hasEnteredEfectivo && totalEfectivoFisico < total;
        }
        if (selected === 'efectivo_transferencia') {
            const ef = Number(montoEfectivo) || 0;
            const tr = Number(montoTransferencia) || 0;
            if (ef + tr !== total) return true;
            if (hasEnteredMixto && totalMixtoFisico < ef) return true;
            return false;
        }
        return false;
    })();

    const clearEfectivo = () => { setBillCountsEfectivo({}); setMonedasEfectivo(''); };
    const clearMixto = () => { setBillCountsMixto({}); setMonedaMixto(''); };

    // Compact on small screens (< 680px height)
    const compact = screenHeight < 680;

    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <Pressable
                    className="flex-1 bg-black/90 justify-end"
                    onPress={onClose}
                >
                    <Pressable
                        style={{
                            backgroundColor: '#0F172A',
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            maxHeight: screenHeight * 0.90,
                            overflow: 'hidden',
                            borderTopWidth: 1,
                            borderLeftWidth: 1,
                            borderRightWidth: 1,
                            borderColor: 'rgba(255,255,255,0.07)',
                        }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* ── Fixed header ── */}
                        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 }}>
                            {/* Drag handle */}
                            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 14 }} />

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: compact ? 10 : 12 }}>
                                <View>
                                    <Text className="text-white font-black text-lg" style={{ fontFamily: 'Space Grotesk' }}>Cobrar Factura</Text>
                                    <Text className="text-slate-400 text-xs">Total a pagar</Text>
                                </View>
                                <Text className="text-[#F5A524] font-black text-2xl" style={{ fontFamily: 'Space Grotesk' }}>${formatCurrency(total)}</Text>
                            </View>

                            {/* ── Compact method tab bar ── */}
                            <View style={{ flexDirection: 'row', gap: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 14, padding: 4 }}>
                                {METHODS.map((m) => {
                                    const isSelected = selected === m.id;
                                    return (
                                        <TouchableOpacity
                                            key={m.id}
                                            onPress={() => setSelected(m.id)}
                                            style={{
                                                flex: 1,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 5,
                                                paddingVertical: 8,
                                                paddingHorizontal: 4,
                                                borderRadius: 10,
                                                backgroundColor: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent',
                                            }}
                                        >
                                            <Icon name={m.icon} size={13} color={isSelected ? m.color : '#64748B'} />
                                            <Text
                                                style={{ fontSize: 10, fontWeight: '800', color: isSelected ? '#FFFFFF' : '#64748B' }}
                                                numberOfLines={1}
                                            >
                                                {m.shortLabel}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* ── Scrollable content ── */}
                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {/* ── EFECTIVO FORM ── */}
                            {selected === 'efectivo' && (
                                <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 12, marginBottom: 8 }}>
                                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-2">Billetes Recibidos</Text>

                                    <View style={{ gap: 4, marginBottom: 10 }}>
                                        {COLOMBIAN_BILLS.map((bill) => (
                                            <BillCounter
                                                key={bill}
                                                bill={bill}
                                                count={billCountsEfectivo[String(bill)] || 0}
                                                onChange={(n) => setBillCountsEfectivo(prev => ({ ...prev, [String(bill)]: n }))}
                                                enCaja={cajaEstado[String(bill)]}
                                            />
                                        ))}
                                    </View>

                                    {/* Coins */}
                                    <View style={{ marginBottom: hasEnteredEfectivo ? 8 : 0 }}>
                                        <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1">Monedas ($)</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                                            <Text className="text-slate-400 font-black text-sm mr-2">$</Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                value={monedasEfectivo}
                                                onChangeText={(t) => setMonedasEfectivo(t.replace(/[^0-9]/g, ''))}
                                                placeholder="0"
                                                placeholderTextColor="#94A3B8"
                                                style={{ color: '#FFFFFF', fontFamily: 'Outfit', flex: 1, fontSize: 13 }}
                                            />
                                        </View>
                                    </View>

                                    {/* Total + Cambio */}
                                    {hasEnteredEfectivo && (
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.08)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', marginBottom: 6 }}>
                                            <View>
                                                <Text className="text-slate-400 text-[9px] font-bold">Recibido</Text>
                                                <Text className="text-white font-black text-sm" style={{ fontFamily: 'Space Grotesk' }}>${formatCurrency(totalEfectivoFisico)}</Text>
                                            </View>
                                            <View className="items-end">
                                                <Text className="text-slate-400 text-[9px] font-bold">Cambio</Text>
                                                <Text
                                                    className={`font-black text-base ${cambio >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                                                    style={{ fontFamily: 'Space Grotesk' }}
                                                >
                                                    {cambio >= 0 ? `$${formatCurrency(cambio)}` : `-$${formatCurrency(Math.abs(cambio))}`}
                                                </Text>
                                            </View>
                                        </View>
                                    )}

                                    {hasEnteredEfectivo && (
                                        <TouchableOpacity
                                            onPress={clearEfectivo}
                                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}
                                        >
                                            <Icon name="trash-can-outline" size={13} color="#EF4444" />
                                            <Text className="text-red-400 text-[10px] font-black uppercase">Limpiar</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {/* ── TRANSFERENCIA FORM ── */}
                            {selected === 'transferencia' && (
                                <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 16, marginBottom: 8, alignItems: 'center', paddingVertical: 24 }}>
                                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(139,92,246,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                        <Icon name="bank" size={22} color="#8B5CF6" />
                                    </View>
                                    <Text className="text-slate-300 font-bold text-sm text-center">Confirmar transacción por</Text>
                                    <Text className="font-black text-2xl mt-1" style={{ fontFamily: 'Space Grotesk', color: '#8B5CF6' }}>${formatCurrency(total)}</Text>
                                </View>
                            )}

                            {/* ── MIXED FORM ── */}
                            {selected === 'efectivo_transferencia' && (
                                <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 12, marginBottom: 8, gap: 10 }}>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text className="text-slate-400 text-[10px] font-bold mb-1">Transferencia $</Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                value={montoTransferencia}
                                                onChangeText={handleMontoTransferenciaChange}
                                                placeholder="0"
                                                placeholderTextColor="#94A3B8"
                                                style={{ color: '#FFFFFF', fontFamily: 'Outfit', backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontWeight: 'bold' }}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text className="text-slate-400 text-[10px] font-bold mb-1">Efectivo $</Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                value={montoEfectivo}
                                                onChangeText={handleMontoEfectivoChange}
                                                placeholder="0"
                                                placeholderTextColor="#94A3B8"
                                                style={{ color: '#FFFFFF', fontFamily: 'Outfit', backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontWeight: 'bold' }}
                                            />
                                        </View>
                                    </View>

                                    {/* Mismatch warning */}
                                    {montoEfectivo !== '' && montoTransferencia !== '' && (Number(montoEfectivo) + Number(montoTransferencia) !== total) && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(251,113,133,0.08)', borderWidth: 1, borderColor: 'rgba(251,113,133,0.2)', padding: 8, borderRadius: 10 }}>
                                            <Icon name="alert-circle" size={13} color="#FB7185" />
                                            <Text className="text-rose-400 text-[10px] font-bold flex-1">Suma no coincide con ${formatCurrency(total)}</Text>
                                        </View>
                                    )}

                                    {/* Bill counter for cash portion */}
                                    {Number(montoEfectivo) > 0 && (
                                        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 10, gap: 6 }}>
                                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Billetes en Efectivo</Text>

                                            <View style={{ gap: 4 }}>
                                                {COLOMBIAN_BILLS.map((bill) => (
                                                    <BillCounter
                                                        key={`mixto-${bill}`}
                                                        bill={bill}
                                                        count={billCountsMixto[String(bill)] || 0}
                                                        onChange={(n) => setBillCountsMixto(prev => ({ ...prev, [String(bill)]: n }))}
                                                        enCaja={cajaEstado[String(bill)]}
                                                    />
                                                ))}
                                            </View>

                                            {/* Coins mixto */}
                                            <View>
                                                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1">Monedas ($)</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                                                    <Text className="text-slate-400 font-black text-sm mr-2">$</Text>
                                                    <TextInput
                                                        keyboardType="numeric"
                                                        value={monedaMixto}
                                                        onChangeText={(t) => setMonedaMixto(t.replace(/[^0-9]/g, ''))}
                                                        placeholder="0"
                                                        placeholderTextColor="#94A3B8"
                                                        style={{ color: '#FFFFFF', fontFamily: 'Outfit', flex: 1, fontSize: 13 }}
                                                    />
                                                </View>
                                            </View>

                                            {hasEnteredMixto && (
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.08)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
                                                    <View>
                                                        <Text className="text-slate-400 text-[9px] font-bold">Recibido</Text>
                                                        <Text className="text-white font-black text-sm" style={{ fontFamily: 'Space Grotesk' }}>${formatCurrency(totalMixtoFisico)}</Text>
                                                    </View>
                                                    <View className="items-end">
                                                        <Text className="text-slate-400 text-[9px] font-bold">Cambio efectivo</Text>
                                                        <Text
                                                            className={`font-black text-base ${cambio >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                                                            style={{ fontFamily: 'Space Grotesk' }}
                                                        >
                                                            {cambio >= 0 ? `$${formatCurrency(cambio)}` : `-$${formatCurrency(Math.abs(cambio))}`}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}

                                            {hasEnteredMixto && (
                                                <TouchableOpacity
                                                    onPress={clearMixto}
                                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}
                                                >
                                                    <Icon name="trash-can-outline" size={13} color="#EF4444" />
                                                    <Text className="text-red-400 text-[10px] font-black uppercase">Limpiar</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}
                        </ScrollView>

                        {/* ── Fixed footer with actions ── */}
                        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Button title="Cancelar" variant="ghost" size="sm" onPress={onClose} disabled={loading} />
                            </View>
                            <View style={{ flex: 2 }}>
                                <Button
                                    title="Confirmar Pago"
                                    variant="primary"
                                    size="sm"
                                    onPress={handleConfirm}
                                    loading={loading}
                                    disabled={isConfirmDisabled}
                                />
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}
