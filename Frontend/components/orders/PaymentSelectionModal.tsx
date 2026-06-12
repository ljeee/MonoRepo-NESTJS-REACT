import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Pressable, View, Text, TouchableOpacity, TextInput, ScrollView } from '../../tw';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { BillCounter, COLOMBIAN_BILLS } from '../ui/BillCounter';
import { useBreakpoint } from '../../styles/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency, useApi } from '@/src/shared';
import type { DenominacionesMap } from '@/src/shared';

interface PaymentSelectionModalProps {
    visible: boolean;
    total: number;
    onClose: () => void;
    onSelect: (
        method: string,
        pagoEfectivo?: number,
        pagoTransferencia?: number,
        denominaciones?: DenominacionesMap,
        cambioDenominaciones?: DenominacionesMap,
    ) => void;
    loading?: boolean;
    /** 'partial' shows abono mode: single efectivo entry, monto libre ≤ totalPendiente */
    mode?: 'full' | 'partial';
    /** Monto pendiente — requerido cuando mode='partial' */
    totalPendiente?: number;
    /** IDs of methods that are locked (shown grayed-out). e.g. ['efectivo','efectivo_transferencia'] when no arqueo */
    disabledMethods?: string[];
}

const METHODS: { id: string; label: string; shortLabel: string; icon: IconName; color: string }[] = [
    { id: 'efectivo',               label: 'Efectivo',                  shortLabel: 'Efectivo', icon: 'cash',            color: '#10B981' },
    { id: 'transferencia',          label: 'Transferencia',             shortLabel: 'QR/Trans', icon: 'bank',            color: '#8B5CF6' },
    { id: 'efectivo_transferencia', label: 'Efectivo y Transferencia',  shortLabel: 'Mixto',    icon: 'swap-horizontal', color: '#F5A524' },
];

export default function PaymentSelectionModal({ visible, total, onClose, onSelect, loading, mode = 'full', totalPendiente, disabledMethods = [] }: PaymentSelectionModalProps) {
    const isPartial = mode === 'partial';
    const api = useApi();
    const { height: screenHeight } = useWindowDimensions();
    const { isDesktop } = useBreakpoint();
    const insets = useSafeAreaInsets();
    // Default to first non-disabled method
    const firstAvailable = METHODS.find(m => !disabledMethods.includes(m.id))?.id ?? 'efectivo';
    const [selected, setSelected] = useState(firstAvailable);
    const [cajaEstado, setCajaEstado] = useState<DenominacionesMap>({});

    // ── Efectivo ──────────────────────────────────────────────────────────────
    const [billCountsEfectivo, setBillCountsEfectivo] = useState<Record<string, number>>({});
    const [monedasEfectivo, setMonedasEfectivo] = useState('');

    // ── Mixto ─────────────────────────────────────────────────────────────────
    /** Monto de la transferencia; el efectivo se calcula como total − transferencia */
    const [montoTransferencia, setMontoTransferencia] = useState('');
    const [billCountsMixto, setBillCountsMixto] = useState<Record<string, number>>({});
    const [monedaMixto, setMonedaMixto] = useState('');

    // ── Cambio a entregar ─────────────────────────────────────────────────────
    const [billCountsCambio, setBillCountsCambio] = useState<Record<string, number>>({});
    const [monedasCambio, setMonedasCambio] = useState('');

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
            setBillCountsMixto({});
            setMonedaMixto('');
            setBillCountsCambio({});
            setMonedasCambio('');
            fetchCaja();
            // Auto-switch if currently selected method is disabled
            if (disabledMethods.includes(selected)) {
                const available = METHODS.find(m => !disabledMethods.includes(m.id));
                if (available) setSelected(available.id);
            }
        }
    }, [visible, selected, fetchCaja]);

    // ── Monto efectivo en modo mixto = total − transferencia ─────────────────
    const montoEfectivoMixto = Math.max(0, total - (Number(montoTransferencia) || 0));

    const handleMontoTransferenciaChange = (text: string) => {
        const clean = text.replace(/[^0-9]/g, '');
        setMontoTransferencia(clean);
        setBillCountsMixto({});
        setMonedaMixto('');
        setBillCountsCambio({});
        setMonedasCambio('');
    };

    // ── Totales físicos ───────────────────────────────────────────────────────
    const totalEfectivoFisico = COLOMBIAN_BILLS.reduce(
        (sum, b) => sum + (billCountsEfectivo[String(b)] || 0) * b, 0,
    ) + (Number(monedasEfectivo) || 0);

    const totalMixtoFisico = COLOMBIAN_BILLS.reduce(
        (sum, b) => sum + (billCountsMixto[String(b)] || 0) * b, 0,
    ) + (Number(monedaMixto) || 0);

    const cashTarget   = isPartial ? (totalPendiente ?? total) : (selected === 'efectivo' ? total : montoEfectivoMixto);
    const cashReceived = selected === 'efectivo' ? totalEfectivoFisico : totalMixtoFisico;
    const cambio       = cashReceived > 0 ? cashReceived - cashTarget : 0;

    const hasEnteredEfectivo = totalEfectivoFisico > 0;
    const hasEnteredMixto    = totalMixtoFisico > 0;

    // ── Cambio ────────────────────────────────────────────────────────────────
    const changeBills = [...COLOMBIAN_BILLS].filter(
        d => cambio > 0 && (d <= cambio || (billCountsCambio[String(d)] || 0) > 0),
    );
    const totalCambioBilletes = COLOMBIAN_BILLS.reduce(
        (sum, d) => sum + (billCountsCambio[String(d)] || 0) * d, 0,
    );
    const totalCambioSeleccionado = totalCambioBilletes + (Number(monedasCambio) || 0);
    const cambioMatch  = cambio === 0 || totalCambioSeleccionado === cambio;
    const cambioExcede = totalCambioSeleccionado > cambio;

    const showCambioSection = cambio > 0 && (
        (selected === 'efectivo'               && hasEnteredEfectivo) ||
        (selected === 'efectivo_transferencia' && hasEnteredMixto)
    );

    function buildDenominaciones(billCounts: Record<string, number>, monedas?: string): DenominacionesMap | undefined {
        const map: DenominacionesMap = {};
        for (const [key, qty] of Object.entries(billCounts)) {
            if (qty > 0) map[key] = qty;
        }
        const coinsVal = Number(monedas) || 0;
        if (coinsVal > 0) map['coins'] = coinsVal;
        return Object.keys(map).length > 0 ? map : undefined;
    }

    const handleConfirm = () => {
        const cambioDens = buildDenominaciones(billCountsCambio, monedasCambio);
        if (isPartial) {
            onSelect('efectivo', totalEfectivoFisico, 0, buildDenominaciones(billCountsEfectivo, monedasEfectivo), cambioDens);
            return;
        }
        if (selected === 'efectivo') {
            onSelect('efectivo', total, 0, buildDenominaciones(billCountsEfectivo, monedasEfectivo), cambioDens);
        } else if (selected === 'transferencia') {
            onSelect('transferencia', 0, total);
        } else if (selected === 'efectivo_transferencia') {
            const transVal = Number(montoTransferencia) || 0;
            onSelect('efectivo_transferencia', montoEfectivoMixto, transVal, buildDenominaciones(billCountsMixto, monedaMixto), cambioDens);
        }
    };

    const isConfirmDisabled = (() => {
        if (isPartial) {
            if (!hasEnteredEfectivo) return true;
            if (showCambioSection && !cambioMatch) return true;
            return false;
        }
        if (selected === 'efectivo') {
            if (hasEnteredEfectivo && totalEfectivoFisico < total) return true;
            if (showCambioSection && !cambioMatch) return true;
            return false;
        }
        if (selected === 'efectivo_transferencia') {
            const tr = Number(montoTransferencia) || 0;
            if (tr <= 0) return true;
            if (tr > total) return true;
            if (hasEnteredMixto && totalMixtoFisico < montoEfectivoMixto) return true;
            if (showCambioSection && !cambioMatch) return true;
            return false;
        }
        return false;
    })();

    const clearEfectivo = () => { setBillCountsEfectivo({}); setMonedasEfectivo(''); setBillCountsCambio({}); setMonedasCambio(''); };
    const clearMixto    = () => { setBillCountsMixto({});    setMonedaMixto('');    setBillCountsCambio({}); setMonedasCambio(''); };
    const clearCambio   = () => { setBillCountsCambio({});   setMonedasCambio(''); };

    const compact = screenHeight < 680;

    // ── Sección de cambio a entregar (reutilizada en efectivo y mixto) ────────
    const CambioSection = showCambioSection ? (
        <View style={styles.cambioBox}>
            {/* Header */}
            <View style={styles.cambioHeaderRow}>
                <View style={styles.rowGap6}>
                    <Icon name="cash-refund" size={14} color="#F5A524" />
                    <Text className="text-amber-400 text-[10px] font-black uppercase tracking-wider">
                        Cambio a entregar
                    </Text>
                </View>
                <Text className="text-amber-400 font-black text-sm" style={{ fontFamily: 'Space Grotesk' }}>
                    ${formatCurrency(cambio)}
                </Text>
            </View>

            {/* Billetes del cambio — muestra stock disponible en caja */}
            <View style={styles.billsRow}>
                {changeBills.map(denom => (
                    <BillCounter
                        key={`cambio-${denom}`}
                        bill={denom}
                        count={billCountsCambio[String(denom)] || 0}
                        onChange={n => setBillCountsCambio(prev => ({ ...prev, [String(denom)]: n }))}
                        enCaja={cajaEstado[String(denom)] ?? 0}
                        limitByStock={true}
                        variant="change"
                    />
                ))}
            </View>

            {/* Monedas del cambio — monto total */}
            <View style={styles.mb8}>
                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1">Monedas ($)</Text>
                <View style={[styles.inputRow, styles.inputRowAmber]}>
                    <Text className="text-amber-400 font-black text-sm mr-2">$</Text>
                    <TextInput
                        keyboardType="numeric"
                        value={monedasCambio}
                        onChangeText={t => setMonedasCambio(t.replace(/[^0-9]/g, ''))}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        style={{ color: '#FFFFFF', fontFamily: 'Outfit', flex: 1, fontSize: 13 }}
                    />
                </View>
            </View>

            {/* Resumen */}
            <View style={[
                styles.summaryBarBase,
                {
                    backgroundColor: cambioExcede ? 'rgba(244,63,94,0.08)' : cambioMatch ? 'rgba(16,185,129,0.08)' : 'rgba(245,165,36,0.08)',
                    borderColor: cambioExcede ? 'rgba(244,63,94,0.25)' : cambioMatch ? 'rgba(16,185,129,0.25)' : 'rgba(245,165,36,0.2)',
                },
            ]}>
                <View>
                    <Text className="text-slate-400 text-[9px] font-bold">Seleccionado</Text>
                    <Text
                        className={`font-black text-sm ${cambioExcede ? 'text-red-400' : cambioMatch ? 'text-emerald-400' : 'text-amber-400'}`}
                        style={{ fontFamily: 'Space Grotesk' }}
                    >
                        ${formatCurrency(totalCambioSeleccionado)}
                    </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text className="text-slate-400 text-[9px] font-bold">Estado</Text>
                    <Text
                        className={`font-black text-sm ${cambioMatch ? 'text-emerald-400' : cambioExcede ? 'text-red-400' : 'text-amber-400'}`}
                        style={{ fontFamily: 'Space Grotesk' }}
                    >
                        {cambioMatch
                            ? '✓ Exacto'
                            : cambioExcede
                                ? `−$${formatCurrency(totalCambioSeleccionado - cambio)}`
                                : `$${formatCurrency(cambio - totalCambioSeleccionado)} falta`}
                    </Text>
                </View>
            </View>

            {totalCambioSeleccionado > 0 && (
                <TouchableOpacity onPress={clearCambio} style={styles.clearBtn}>
                    <Icon name="trash-can-outline" size={13} color="#EF4444" />
                    <Text className="text-red-400 text-[10px] font-black uppercase">Limpiar cambio</Text>
                </TouchableOpacity>
            )}
        </View>
    ) : null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType={isDesktop ? 'fade' : 'slide'}
            statusBarTranslucent
            onRequestClose={onClose}
        >
            {/*
             * Sin KeyboardAvoidingView: el KAV dentro de un Modal con statusBarTranslucent
             * colapsa el panel en Android. El manifest usa adjustResize y el ScrollView
             * interno (keyboardShouldPersistTaps) mantiene los inputs accesibles.
             * Desktop → modal centrado; mobile → bottom-sheet.
             */}
            <Pressable
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.88)',
                    justifyContent: isDesktop ? 'center' : 'flex-end',
                    alignItems: isDesktop ? 'center' : 'stretch',
                    padding: isDesktop ? 16 : 0,
                }}
                onPress={onClose}
            >
                <Pressable
                    style={[
                        styles.modalInner,
                        isDesktop
                            ? { maxWidth: 500, width: '100%', maxHeight: screenHeight * 0.9, borderRadius: 24 }
                            : { width: '100%', maxHeight: screenHeight * 0.9 },
                    ]}
                    onPress={e => e.stopPropagation()}
                >
                    {/* ── Fixed header ── */}
                    <View style={styles.fixedHeader}>
                        {!isDesktop && <View style={styles.dragHandle} />}

                            <View style={[styles.rowBetween, { marginBottom: compact ? 10 : 12 }]}>
                                <View>
                                    <Text className="text-white font-black text-lg" style={{ fontFamily: 'Space Grotesk' }}>
                                        {isPartial ? 'Registrar Abono' : 'Cobrar Factura'}
                                    </Text>
                                    <Text className="text-slate-400 text-xs">
                                        {isPartial ? 'Saldo pendiente' : 'Total a pagar'}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text className="text-[#F5A524] font-black text-2xl" style={{ fontFamily: 'Space Grotesk' }}>
                                        ${formatCurrency(isPartial ? (totalPendiente ?? total) : total)}
                                    </Text>
                                    {isPartial && (
                                        <Text className="text-slate-500 text-[10px] font-bold">de ${formatCurrency(total)}</Text>
                                    )}
                                </View>
                            </View>

                            {/* Method tab bar — hidden in partial mode (efectivo only) */}
                            {!isPartial && (
                            <View style={styles.tabBar}>
                                {METHODS.map(m => {
                                    const isActive = selected === m.id;
                                    const isDisabled = disabledMethods.includes(m.id);
                                    return (
                                        <TouchableOpacity
                                            key={m.id}
                                            onPress={() => !isDisabled && setSelected(m.id)}
                                            disabled={isDisabled}
                                            style={[styles.tabBtn, {
                                                backgroundColor: isActive && !isDisabled ? 'rgba(255,255,255,0.1)' : 'transparent',
                                                opacity: isDisabled ? 0.4 : 1,
                                            }]}
                                        >
                                            <Icon name={isDisabled ? 'lock-outline' : m.icon} size={13} color={isDisabled ? '#475569' : isActive ? m.color : '#64748B'} />
                                            <Text style={{ fontSize: 10, fontWeight: '800', color: isDisabled ? '#475569' : isActive ? '#FFFFFF' : '#64748B' }} numberOfLines={1}>
                                                {m.shortLabel}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            )}
                        </View>

                        {/* ── Scrollable content ── */}
                        {/* maxHeight propio (no flex:1): en un bottom-sheet sin altura fija,
                            flex:1 colapsa el ScrollView y se pierde el contenido. */}
                        <ScrollView
                            style={{ maxHeight: screenHeight * (isDesktop ? 0.62 : 0.5) }}
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            nestedScrollEnabled
                            bounces={false}
                            overScrollMode="never"
                        >
                            {/* ════════════════ EFECTIVO ════════════════ */}
                            {selected === 'efectivo' && (
                                <View style={styles.sectionBox}>
                                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-2">Billetes Recibidos</Text>

                                    <View style={styles.billsGap}>
                                        {[...COLOMBIAN_BILLS].map(bill => (
                                            <BillCounter
                                                key={bill}
                                                bill={bill}
                                                count={billCountsEfectivo[String(bill)] || 0}
                                                onChange={n => setBillCountsEfectivo(prev => ({ ...prev, [String(bill)]: n }))}
                                                enCaja={cajaEstado[String(bill)]}
                                            />
                                        ))}
                                    </View>

                                    {/* Monedas */}
                                    <View style={{ marginBottom: hasEnteredEfectivo ? 8 : 0 }}>
                                        <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1">Monedas ($)</Text>
                                        <View style={[styles.inputRow, styles.inputRowDefault]}>
                                            <Text className="text-slate-400 font-black text-sm mr-2">$</Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                value={monedasEfectivo}
                                                onChangeText={t => setMonedasEfectivo(t.replace(/[^0-9]/g, ''))}
                                                placeholder="0"
                                                placeholderTextColor="#94A3B8"
                                                style={{ color: '#FFFFFF', fontFamily: 'Outfit', flex: 1, fontSize: 13 }}
                                            />
                                        </View>
                                    </View>

                                    {/* Recibido / Cambio */}
                                    {hasEnteredEfectivo && (
                                        <View style={styles.receivedBar}>
                                            <View>
                                                <Text className="text-slate-400 text-[9px] font-bold">Recibido</Text>
                                                <Text className="text-white font-black text-sm" style={{ fontFamily: 'Space Grotesk' }}>${formatCurrency(totalEfectivoFisico)}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text className="text-slate-400 text-[9px] font-bold">Cambio</Text>
                                                <Text className={`font-black text-base ${cambio >= 0 ? 'text-emerald-400' : 'text-red-400'}`} style={{ fontFamily: 'Space Grotesk' }}>
                                                    {cambio >= 0 ? `$${formatCurrency(cambio)}` : `-$${formatCurrency(Math.abs(cambio))}`}
                                                </Text>
                                            </View>
                                        </View>
                                    )}

                                    {CambioSection}

                                    {hasEnteredEfectivo && (
                                        <TouchableOpacity onPress={clearEfectivo} style={[styles.clearBtn, styles.mt6]}>
                                            <Icon name="trash-can-outline" size={13} color="#EF4444" />
                                            <Text className="text-red-400 text-[10px] font-black uppercase">Limpiar</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {/* ════════════════ TRANSFERENCIA ════════════════ */}
                            {selected === 'transferencia' && (
                                <View style={styles.transferBox}>
                                    <View style={styles.transferIconCircle}>
                                        <Icon name="bank" size={22} color="#8B5CF6" />
                                    </View>
                                    <Text className="text-slate-300 font-bold text-sm text-center">Confirmar transacción por</Text>
                                    <Text className="font-black text-2xl mt-1" style={{ fontFamily: 'Space Grotesk', color: '#8B5CF6' }}>${formatCurrency(total)}</Text>
                                </View>
                            )}

                            {/* ════════════════ MIXTO ════════════════ */}
                            {selected === 'efectivo_transferencia' && (
                                <View style={styles.mixBox}>

                                    {/* Step 1: Transferencia */}
                                    <View>
                                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-2">
                                            Monto por Transferencia
                                        </Text>
                                        <View style={styles.mixTransferInput}>
                                            <Icon name="bank" size={16} color="#8B5CF6" />
                                            <Text className="text-slate-400 font-black text-sm mx-2">$</Text>
                                            <TextInput
                                                keyboardType="numeric"
                                                value={montoTransferencia}
                                                onChangeText={handleMontoTransferenciaChange}
                                                placeholder="0"
                                                placeholderTextColor="#94A3B8"
                                                style={{ color: '#FFFFFF', fontFamily: 'SpaceGrotesk-Bold', flex: 1, fontSize: 16 }}
                                            />
                                        </View>
                                        {Number(montoTransferencia) > total && (
                                            <View style={styles.mixExceedsWarn}>
                                                <Icon name="alert-circle" size={13} color="#FB7185" />
                                                <Text className="text-rose-400 text-[10px] font-bold" style={{ flex: 1 }}>Excede el total de ${formatCurrency(total)}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Step 2: Efectivo calculado */}
                                    {Number(montoTransferencia) > 0 && Number(montoTransferencia) <= total && (
                                        <View style={styles.mixEfectivoBar}>
                                            <View style={styles.rowGap8}>
                                                <Icon name="cash" size={16} color="#10B981" />
                                                <View>
                                                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider">Efectivo a cobrar</Text>
                                                    <Text className="text-slate-500 text-[8px]">Total − Transferencia</Text>
                                                </View>
                                            </View>
                                            <Text className="text-emerald-400 font-black text-lg" style={{ fontFamily: 'Space Grotesk' }}>
                                                ${formatCurrency(montoEfectivoMixto)}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Step 3: Billetes de la parte efectivo */}
                                    {montoEfectivoMixto > 0 && (
                                        <View style={styles.mixBillsStep}>
                                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Billetes Recibidos (Efectivo)</Text>

                                            <View style={styles.mixBillsGap}>
                                                {[...COLOMBIAN_BILLS].map(bill => (
                                                    <BillCounter
                                                        key={`mixto-${bill}`}
                                                        bill={bill}
                                                        count={billCountsMixto[String(bill)] || 0}
                                                        onChange={n => setBillCountsMixto(prev => ({ ...prev, [String(bill)]: n }))}
                                                        enCaja={cajaEstado[String(bill)]}
                                                    />
                                                ))}
                                            </View>

                                            {/* Monedas mixto */}
                                            <View>
                                                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-1">Monedas ($)</Text>
                                                <View style={[styles.inputRow, styles.inputRowDefault]}>
                                                    <Text className="text-slate-400 font-black text-sm mr-2">$</Text>
                                                    <TextInput
                                                        keyboardType="numeric"
                                                        value={monedaMixto}
                                                        onChangeText={t => setMonedaMixto(t.replace(/[^0-9]/g, ''))}
                                                        placeholder="0"
                                                        placeholderTextColor="#94A3B8"
                                                        style={{ color: '#FFFFFF', fontFamily: 'Outfit', flex: 1, fontSize: 13 }}
                                                    />
                                                </View>
                                            </View>

                                            {/* Recibido / Cambio */}
                                            {hasEnteredMixto && (
                                                <View style={styles.receivedBarNoMargin}>
                                                    <View>
                                                        <Text className="text-slate-400 text-[9px] font-bold">Recibido</Text>
                                                        <Text className="text-white font-black text-sm" style={{ fontFamily: 'Space Grotesk' }}>${formatCurrency(totalMixtoFisico)}</Text>
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end' }}>
                                                        <Text className="text-slate-400 text-[9px] font-bold">Cambio efectivo</Text>
                                                        <Text className={`font-black text-base ${cambio >= 0 ? 'text-emerald-400' : 'text-red-400'}`} style={{ fontFamily: 'Space Grotesk' }}>
                                                            {cambio >= 0 ? `$${formatCurrency(cambio)}` : `-$${formatCurrency(Math.abs(cambio))}`}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}

                                            {CambioSection}

                                            {hasEnteredMixto && (
                                                <TouchableOpacity onPress={clearMixto} style={[styles.clearBtn, styles.mt6]}>
                                                    <Icon name="trash-can-outline" size={13} color="#EF4444" />
                                                    <Text className="text-red-400 text-[10px] font-black uppercase">Limpiar efectivo</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}
                        </ScrollView>

                        {/* ── Fixed footer ── */}
                        <View style={[styles.footer, { paddingBottom: (Platform.OS === 'ios' ? 20 : 14) + Math.max(insets.bottom, 8) }]}>
                            <View style={styles.flex1}>
                                <Button title="Cancelar" variant="ghost" size="sm" onPress={onClose} disabled={loading} />
                            </View>
                            <View style={styles.flex2}>
                                <Button
                                    title={
                                        showCambioSection && !cambioMatch
                                            ? `Cambio: $${formatCurrency(cambio - totalCambioSeleccionado)} sin asignar`
                                            : isPartial ? 'Registrar Abono' : 'Confirmar Pago'
                                    }
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
        </Modal>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    // Layout primitives
    flex1:      { flex: 1 },
    flex2:      { flex: 2 },
    mt6:        { marginTop: 6 },
    mb8:        { marginBottom: 8 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowGap6:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowGap8:    { flexDirection: 'row', alignItems: 'center', gap: 8 },

    // Dark monedas input row (borderColor composed inline)
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    inputRowAmber:   { borderColor: 'rgba(245,165,36,0.2)' },
    inputRowDefault: { borderColor: 'rgba(255,255,255,0.08)' },

    // Clear (danger) button
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.2)',
    },

    // Cambio box
    cambioBox: {
        marginTop: 8,
        backgroundColor: 'rgba(245,165,36,0.05)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(245,165,36,0.2)',
        padding: 12,
        gap: 6,
    },
    cambioHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    billsRow: { gap: 4, marginBottom: 8 },

    // Summary bar base (bg + borderColor added inline based on state)
    summaryBarBase: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
    },

    // Modal chrome — explicit flexDirection so header + scroll + footer stack reliably
    modalInner: {
        backgroundColor: '#0F172A',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        flexDirection: 'column',
    },
    fixedHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
    dragHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignSelf: 'center',
        marginBottom: 14,
    },
    tabBar: {
        flexDirection: 'row',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 14,
        padding: 4,
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 10,
    },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 16 },

    // Generic section container
    sectionBox: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        marginBottom: 8,
    },
    billsGap: { gap: 4, marginBottom: 10 },
    receivedBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(16,185,129,0.08)',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.2)',
        marginBottom: 6,
    },
    receivedBarNoMargin: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(16,185,129,0.08)',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.2)',
    },

    // Transfer section
    transferBox: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 16,
        paddingVertical: 24,
        marginBottom: 8,
        alignItems: 'center',
    },
    transferIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(139,92,246,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },

    // Mixed mode
    mixBox: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        marginBottom: 8,
        gap: 12,
    },
    mixTransferInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(139,92,246,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.25)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    mixExceedsWarn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        backgroundColor: 'rgba(251,113,133,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(251,113,133,0.2)',
        padding: 8,
        borderRadius: 10,
    },
    mixEfectivoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(16,185,129,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.2)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    mixBillsStep: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        paddingTop: 10,
        gap: 6,
    },
    mixBillsGap: { gap: 4 },

    // Footer
    footer: {
        paddingHorizontal: 20,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        flexDirection: 'row',
        gap: 10,
    },
});
