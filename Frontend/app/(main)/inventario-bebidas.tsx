import React, { useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, TextInput as RNTextInput, RefreshControl, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
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

type RowItem = {
    type: 'header';
    key: string;
    title: string;
    icon: string;
    color: string;
    count: number;
} | {
    type: 'variant';
    key: string;
    variante: ProductoVariante;
    productoNombre: string;
    color: string;
};

// ─── Variant Card (mobile) ────────────────────────────────────────────────────

const VarianteCard = React.memo(function VarianteCard({
    variante,
    productoNombre,
    stock,
    arrivalInput,
    saving,
    color,
    onAjustar,
    onArrivalChange,
    onRegisterArrival,
}: {
    variante: ProductoVariante;
    productoNombre: string;
    stock: number;
    arrivalInput: string;
    saving: boolean;
    color: string;
    onAjustar: (id: number, currentStock: number, delta: number) => void;
    onArrivalChange: (id: number, val: string) => void;
    onRegisterArrival: (id: number) => void;
}) {
    const arrivalNum = Number(arrivalInput);
    const canRegister = arrivalInput.trim().length > 0 && arrivalNum > 0;

    return (
        <View style={styles.cardContainer}>
            <View style={styles.nameRow}>
                <Text style={styles.variantName} numberOfLines={1}>
                    {variante.nombre}
                </Text>
                <Text style={styles.productName} numberOfLines={1}>
                    {productoNombre}
                </Text>
            </View>

            <View style={styles.controlsRow}>
                {/* -1 / Stock / +1 */}
                <View style={styles.stepperContainer}>
                    <TouchableOpacity
                        onPress={() => onAjustar(variante.varianteId, stock, -1)}
                        disabled={stock <= 0 || saving}
                        style={[
                            styles.stepperButton,
                            styles.stepperButtonMinus,
                            (stock <= 0 || saving) && styles.stepperButtonDisabled
                        ]}
                    >
                        <Text style={styles.stepperMinusText}>−</Text>
                    </TouchableOpacity>

                    <View style={styles.stockContainer}>
                        <Text style={[
                            styles.stockText,
                            stock === 0 ? styles.stockTextZero : styles.stockTextNormal
                        ]}>
                            {saving ? '…' : stock}
                        </Text>
                        <Text style={styles.stockLabel}>
                            uds
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => onAjustar(variante.varianteId, stock, 1)}
                        disabled={saving}
                        style={[
                            styles.stepperButton,
                            { backgroundColor: `${color}18`, borderColor: `${color}35` },
                            saving && styles.stepperButtonDisabledOpacity
                        ]}
                    >
                        <Text style={[styles.stepperPlusText, { color }]}>+</Text>
                    </TouchableOpacity>
                </View>

                {/* Arrival input */}
                <View style={styles.arrivalContainer}>
                    <RNTextInput
                        value={arrivalInput}
                        onChangeText={(val) => onArrivalChange(variante.varianteId, val)}
                        placeholder="Llegaron"
                        placeholderTextColor="#2D3D55"
                        keyboardType="numeric"
                        style={[
                            styles.arrivalInput,
                            canRegister ? { borderColor: `${color}45` } : styles.arrivalInputInactive
                        ] as any}
                    />
                    <TouchableOpacity
                        onPress={() => onRegisterArrival(variante.varianteId)}
                        disabled={!canRegister || saving}
                        style={[
                            styles.registerButton,
                            canRegister ? { backgroundColor: `${color}22`, borderColor: `${color}45` } : styles.registerButtonInactive,
                            (!canRegister || saving) && styles.registerButtonDisabled
                        ]}
                    >
                        <Icon name="check" size={17} color={canRegister ? color : '#475569'} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InventarioBebidasScreen() {
    const api = useApi();
    const { productos, loading, fetchProductos } = useProductos();
    const [stockMap, setStockMap] = useState<StockMap>({});
    const [arrivals, setArrivals] = useState<ArrivalMap>({});
    const [savingId, setSavingId] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchProductos();
        setRefreshing(false);
    }, [fetchProductos]);

    useEffect(() => {
        void fetchProductos();
    }, [fetchProductos]);

    const gaseosas = productos.filter((p) => p.productoNombre.toLowerCase().includes('gaseosa'));
    const jugos    = productos.filter((p) => p.productoNombre.toLowerCase().includes('jugo'));

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

    const handleArrivalChange = useCallback((varianteId: number, val: string) => {
        setArrivals((prev) => ({ ...prev, [varianteId]: val }));
    }, []);

    const renderItem = useCallback(({ item }: { item: RowItem }) => {
        if (item.type === 'header') {
            return (
                <View style={styles.headerRow}>
                    <View style={[styles.headerIconContainer, { backgroundColor: `${item.color}18`, borderColor: `${item.color}30` }]}>
                        <Icon name={item.icon} size={17} color={item.color} />
                    </View>
                    <Text style={[styles.headerTitle, { color: item.color }]} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <View style={[styles.headerCountContainer, { backgroundColor: `${item.color}18`, borderColor: `${item.color}30` }]}>
                        <Text style={[styles.headerCountText, { color: item.color }]}>{item.count}</Text>
                    </View>
                </View>
            );
        }

        const stock = stockMap[item.variante.varianteId] ?? item.variante.stockBebida ?? 0;
        return (
            <VarianteCard
                variante={item.variante}
                productoNombre={item.productoNombre}
                stock={stock}
                arrivalInput={arrivals[item.variante.varianteId] ?? ''}
                saving={savingId === item.variante.varianteId}
                color={item.color}
                onAjustar={handleAjustar}
                onArrivalChange={handleArrivalChange}
                onRegisterArrival={handleRegisterArrival}
            />
        );
    }, [stockMap, arrivals, savingId, handleAjustar, handleArrivalChange, handleRegisterArrival]);

    // Build flat list data for FlatList
    const listData: RowItem[] = [];

    const addSection = (title: string, icon: string, color: string, items: Producto[]) => {
        const variants = items.flatMap((p) =>
            (p.variantes ?? []).filter((v) => v.activo).map((v) => ({ variante: v, producto: p }))
        );
        if (variants.length === 0) return;
        listData.push({ type: 'header', key: `h-${title}`, title, icon, color, count: variants.length });
        variants.forEach(({ variante, producto }) => {
            listData.push({ type: 'variant', key: `v-${variante.varianteId}`, variante, productoNombre: producto.productoNombre, color });
        });
    };

    addSection('Gaseosas', 'bottle-soda', '#60A5FA', gaseosas);
    addSection('Jugos', 'cup', '#F59E0B', jugos);

    const hasData = listData.length > 0;

    return (
        <PageContainer scrollable={false}>
            <PageHeader
                title="Inventario Bebidas"
                subtitle="Stock de gaseosas y jugos"
                icon="bottle-soda-outline"
                rightContent={
                    <Button title="" icon="refresh" variant="ghost" size="sm"
                        onPress={() => fetchProductos()} loading={loading} />
                }
            />

            {loading && !hasData && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#F5A524" />
                </View>
            )}

            {!loading && !hasData && (
                <View style={styles.emptyContainer}>
                    <Icon name="bottle-soda-outline" size={48} color="#1E293B" />
                    <Text style={styles.emptyTitle}>
                        Sin gaseosas ni jugos en el catálogo
                    </Text>
                    <Text style={styles.emptySubtitle}>
                        Crea productos con nombre que contenga "gaseosa" o "jugo"
                    </Text>
                </View>
            )}

            <FlashList
                data={listData}
                keyExtractor={(item) => item.key}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60 }}
                ListFooterComponent={hasData ? <BebidaMovimientosWidget /> : null}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#F5A524"
                        colors={['#F5A524']}
                    />
                }
                renderItem={renderItem}
            />
        </PageContainer>
    );
}

const styles = StyleSheet.create({
    cardContainer: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 14, marginBottom: 10 },
    nameRow: { marginBottom: 12 },
    variantName: { color: '#F8FAFC', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
    productName: { color: '#475569', fontSize: 9, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
    controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepperContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    stepperButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    stepperButtonMinus: { backgroundColor: 'rgba(244,63,94,0.12)', borderColor: 'rgba(244,63,94,0.25)' },
    stepperButtonDisabled: { opacity: 0.35 },
    stepperButtonDisabledOpacity: { opacity: 0.5 },
    stepperMinusText: { color: '#F43F5E', fontWeight: '900', fontSize: 18, lineHeight: 20 },
    stepperPlusText: { fontWeight: '900', fontSize: 18, lineHeight: 20 },
    stockContainer: { alignItems: 'center', minWidth: 48 },
    stockText: { fontWeight: '900', fontSize: 26, letterSpacing: -1, lineHeight: 30 },
    stockTextZero: { color: '#475569' },
    stockTextNormal: { color: '#F8FAFC' },
    stockLabel: { color: '#334155', fontSize: 7, fontWeight: '700', textTransform: 'uppercase' },
    arrivalContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    arrivalInput: { width: 80, height: 36, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, color: '#F8FAFC', fontSize: 13, textAlign: 'center' },
    arrivalInputInactive: { borderColor: 'rgba(255,255,255,0.08)' },
    registerButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    registerButtonInactive: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.07)' },
    registerButtonDisabled: { opacity: 0.4 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 10 },
    headerIconContainer: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    headerTitle: { fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, flex: 1 },
    headerCountContainer: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    headerCountText: { fontSize: 9, fontWeight: '700' },
    loadingContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { color: '#475569', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 14, textAlign: 'center' },
    emptySubtitle: { color: '#334155', fontSize: 10, fontWeight: '700', marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }
});
