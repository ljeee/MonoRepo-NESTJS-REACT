import React, { useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, TextInput as RNTextInput } from 'react-native';
import { View, Text, TouchableOpacity } from '../../tw';
import { useApi, useProductos } from '@/src/shared';
import type { Producto, ProductoVariante } from '@/src/shared';
import PageContainer from '../../components/ui/PageContainer';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import { BebidaMovimientosWidget } from '../../components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type StockMap   = Record<number, number>;
type ArrivalMap = Record<number, string>;

// ─── Variant Row ──────────────────────────────────────────────────────────────

function VarianteRow({
    variante,
    productoNombre,
    stock,
    arrivalInput,
    saving,
    onAjustar,
    onArrivalChange,
    onRegisterArrival,
    color,
}: {
    variante: ProductoVariante;
    productoNombre: string;
    stock: number;
    arrivalInput: string;
    saving: boolean;
    onAjustar: (delta: number) => void;
    onArrivalChange: (val: string) => void;
    onRegisterArrival: () => void;
    color: string;
}) {
    const arrivalNum = Number(arrivalInput);
    const canRegister = arrivalInput.trim().length > 0 && arrivalNum > 0;

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
            borderRadius: 16,
            paddingHorizontal: 18,
            paddingVertical: 14,
            marginBottom: 8,
        }}>
            {/* Name */}
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={1}>
                    {variante.nombre}
                </Text>
                <Text style={{ color: '#475569', fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', marginTop: 2, textTransform: 'uppercase' }} numberOfLines={1}>
                    {productoNombre}
                </Text>
            </View>

            {/* Stock control */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                    onPress={() => onAjustar(-1)}
                    disabled={stock <= 0 || saving}
                    style={{
                        width: 36, height: 36, borderRadius: 10,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(244,63,94,0.12)',
                        borderWidth: 1, borderColor: 'rgba(244,63,94,0.25)',
                        opacity: stock <= 0 || saving ? 0.35 : 1,
                    }}
                >
                    <Text style={{ color: '#F43F5E', fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, lineHeight: 20 }}>−</Text>
                </TouchableOpacity>

                <View style={{ minWidth: 56, alignItems: 'center' }}>
                    <Text style={{
                        color: stock === 0 ? '#475569' : '#F8FAFC',
                        fontFamily: 'SpaceGrotesk-Bold',
                        fontSize: 28,
                        letterSpacing: -1,
                        lineHeight: 32,
                    }}>
                        {saving ? '…' : stock}
                    </Text>
                    <Text style={{ color: '#334155', fontSize: 7, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', marginTop: 1 }}>
                        uds
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => onAjustar(1)}
                    disabled={saving}
                    style={{
                        width: 36, height: 36, borderRadius: 10,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: `${color}18`,
                        borderWidth: 1, borderColor: `${color}35`,
                        opacity: saving ? 0.5 : 1,
                    }}
                >
                    <Text style={{ color, fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, lineHeight: 20 }}>+</Text>
                </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.07)' }} />

            {/* Arrivals */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <RNTextInput
                    value={arrivalInput}
                    onChangeText={onArrivalChange}
                    placeholder="¿Cuántas llegaron?"
                    placeholderTextColor="#2D3D55"
                    keyboardType="numeric"
                    style={{
                        width: 130,
                        height: 36,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderWidth: 1,
                        borderColor: canRegister ? `${color}45` : 'rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        color: '#F8FAFC',
                        fontFamily: 'SpaceGrotesk-Bold',
                        fontSize: 13,
                        textAlign: 'center',
                    } as any}
                />
                <TouchableOpacity
                    onPress={onRegisterArrival}
                    disabled={!canRegister || saving}
                    style={{
                        width: 36, height: 36, borderRadius: 10,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: canRegister ? `${color}22` : 'rgba(255,255,255,0.04)',
                        borderWidth: 1,
                        borderColor: canRegister ? `${color}45` : 'rgba(255,255,255,0.07)',
                        opacity: !canRegister || saving ? 0.4 : 1,
                    }}
                >
                    <Icon name="check" size={17} color={canRegister ? color : '#475569'} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function BebidaSection({
    title, icon, color, productos,
    stockMap, arrivals, savingId,
    onAjustar, onArrivalChange, onRegisterArrival,
}: {
    title: string;
    icon: string;
    color: string;
    productos: Producto[];
    stockMap: StockMap;
    arrivals: ArrivalMap;
    savingId: number | null;
    onAjustar: (varianteId: number, currentStock: number, delta: number) => void;
    onArrivalChange: (varianteId: number, val: string) => void;
    onRegisterArrival: (varianteId: number) => void;
}) {
    const rows: { variante: ProductoVariante; producto: Producto }[] = productos.flatMap((p) =>
        (p.variantes ?? []).filter((v) => v.activo).map((v) => ({ variante: v, producto: p }))
    );

    if (rows.length === 0) return null;

    return (
        <View style={{ marginBottom: 32 }}>
            {/* Section header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <View style={{
                    width: 38, height: 38, borderRadius: 12,
                    backgroundColor: `${color}18`,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: `${color}30`,
                }}>
                    <Icon name={icon} size={20} color={color} />
                </View>
                <Text style={{
                    color,
                    fontFamily: 'SpaceGrotesk-Bold',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                }}>
                    {title}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: `${color}20` }} />
                <View style={{
                    backgroundColor: `${color}18`,
                    paddingHorizontal: 9, paddingVertical: 4,
                    borderRadius: 8, borderWidth: 1, borderColor: `${color}30`,
                }}>
                    <Text style={{ color, fontSize: 10, fontFamily: 'SpaceGrotesk-Bold' }}>
                        {rows.length} variante{rows.length !== 1 ? 's' : ''}
                    </Text>
                </View>
            </View>

            {/* Column headers */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 6, gap: 14 }}>
                <Text style={{ flex: 1, color: '#334155', fontSize: 8, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Variante
                </Text>
                <Text style={{ width: 120, textAlign: 'center', color: '#334155', fontSize: 8, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Stock actual
                </Text>
                <View style={{ width: 1 }} />
                <Text style={{ width: 176, textAlign: 'center', color: '#334155', fontSize: 8, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Llegaron
                </Text>
            </View>

            {rows.map(({ variante, producto }) => {
                const stock = stockMap[variante.varianteId] ?? variante.stockBebida ?? 0;
                return (
                    <VarianteRow
                        key={variante.varianteId}
                        variante={variante}
                        productoNombre={producto.productoNombre}
                        stock={stock}
                        arrivalInput={arrivals[variante.varianteId] ?? ''}
                        saving={savingId === variante.varianteId}
                        onAjustar={(delta) => onAjustar(variante.varianteId, stock, delta)}
                        onArrivalChange={(val) => onArrivalChange(variante.varianteId, val)}
                        onRegisterArrival={() => onRegisterArrival(variante.varianteId)}
                        color={color}
                    />
                );
            })}
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InventarioBebidasScreen() {
    const api = useApi();
    const { productos, loading, fetchProductos } = useProductos();
    const [stockMap, setStockMap] = useState<StockMap>({});
    const [arrivals, setArrivals] = useState<ArrivalMap>({});
    const [savingId, setSavingId] = useState<number | null>(null);

    // Load products on mount
    useEffect(() => {
        void fetchProductos();
    }, [fetchProductos]);

    // Filter sections
    const gaseosas = productos.filter((p) => p.productoNombre.toLowerCase().includes('gaseosa'));
    const jugos = productos.filter((p) => p.productoNombre.toLowerCase().includes('jugo'));

    const handleAjustar = useCallback(async (varianteId: number, currentStock: number, delta: number) => {
        const newStock = Math.max(0, currentStock + delta);
        setSavingId(varianteId);
        setStockMap((prev) => ({ ...prev, [varianteId]: newStock }));
        try {
            const updated = await api.productos.ajustarStockBebida(varianteId, delta);
            setStockMap((prev) => ({ ...prev, [varianteId]: updated.stockBebida ?? newStock }));
        } catch {
            setStockMap((prev) => ({ ...prev, [varianteId]: currentStock }));
        } finally {
            setSavingId(null);
        }
    }, [api]);

    const handleRegisterArrival = useCallback(async (varianteId: number) => {
        const input = arrivals[varianteId] ?? '';
        const n = Number(input);
        if (!n || n <= 0) return;
        setArrivals((prev) => ({ ...prev, [varianteId]: '' }));

        // Get current stock (from local map or from products)
        const currentStock = (() => {
            if (stockMap[varianteId] !== undefined) return stockMap[varianteId];
            for (const p of productos) {
                const v = p.variantes?.find((vv) => vv.varianteId === varianteId);
                if (v) return v.stockBebida ?? 0;
            }
            return 0;
        })();

        await handleAjustar(varianteId, currentStock, n);
    }, [arrivals, stockMap, productos, handleAjustar]);

    const hasData = gaseosas.length > 0 || jugos.length > 0;

    return (
        <PageContainer>
            <PageHeader
                title="Inventario Bebidas"
                subtitle="Gaseosas y jugos — stock rápido"
                icon="bottle-soda-outline"
                rightContent={
                    <Button
                        title=""
                        icon="refresh"
                        variant="ghost"
                        size="sm"
                        onPress={() => fetchProductos()}
                        loading={loading}
                    />
                }
            />

            {loading && !hasData && (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                    <ActivityIndicator size="large" color="#F5A524" />
                </View>
            )}

            {!loading && !hasData && (
                <View style={{
                    alignItems: 'center', paddingVertical: 80,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 40, borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.05)',
                    borderStyle: 'dashed',
                }}>
                    <Icon name="bottle-soda-outline" size={52} color="#1E293B" />
                    <Text style={{ color: '#475569', fontFamily: 'SpaceGrotesk-Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 18 }}>
                        Sin gaseosas ni jugos en el catálogo
                    </Text>
                    <Text style={{ color: '#334155', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
                        Crea productos con nombre que contenga "gaseosa" o "jugo" en Gestión de Productos
                    </Text>
                </View>
            )}

            <BebidaSection
                title="Gaseosas"
                icon="bottle-soda"
                color="#60A5FA"
                productos={gaseosas}
                stockMap={stockMap}
                arrivals={arrivals}
                savingId={savingId}
                onAjustar={handleAjustar}
                onArrivalChange={(id, val) => setArrivals((prev) => ({ ...prev, [id]: val }))}
                onRegisterArrival={handleRegisterArrival}
            />

            <BebidaSection
                title="Jugos"
                icon="cup"
                color="#F59E0B"
                productos={jugos}
                stockMap={stockMap}
                arrivals={arrivals}
                savingId={savingId}
                onAjustar={handleAjustar}
                onArrivalChange={(id, val) => setArrivals((prev) => ({ ...prev, [id]: val }))}
                onRegisterArrival={handleRegisterArrival}
            />

            {hasData && <BebidaMovimientosWidget />}
        </PageContainer>
    );
}
