import React from 'react';
import { View, Text } from '../../tw';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { formatCurrency, nombreCategoria, tipoDeGasto, TIPO_GASTO_META } from '@/src/shared';
import type { FacturaPago } from '@/src/shared';

const ICONO_METODO: Record<string, 'cash' | 'qrcode' | 'cash-off'> = { efectivo: 'cash', qr: 'qrcode', efectivo_no_caja: 'cash-off' };

export interface GastoCardProps {
    gasto: FacturaPago;
    /** Nombre de la cuenta de la que salió un egreso por QR (el que llama lo resuelve con `cuentaOrigenId`). */
    nombreCuenta?: string;
    /** Sin estos callbacks la tarjeta es de solo lectura (balance por fechas); con ellos muestra Editar / Eliminar. */
    onEdit?: (gasto: FacturaPago) => void;
    onDelete?: (gasto: FacturaPago) => void;
    disabled?: boolean;
}

/** Tarjeta única de un egreso: nombre, fecha, tipo y categoría, método (y cuenta si fue QR), estado, monto y nota. */
export const GastoCard = React.memo(function GastoCard({ gasto, nombreCuenta, onEdit, onDelete, disabled }: GastoCardProps) {
    const tipo = TIPO_GASTO_META[tipoDeGasto(gasto)];
    const metodo = gasto.metodo;
    const conAcciones = !!onEdit || !!onDelete;

    return (
        <Card padding="md">
            <View className="flex-row justify-between items-start gap-3">
                <View className="flex-1">
                    <Text className="text-base font-bold text-white mb-1" numberOfLines={2}>
                        {gasto.nombreGasto || 'Sin nombre'}
                    </Text>
                    <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                        {gasto.fechaFactura ? (
                            <View className="flex-row items-center gap-1.5">
                                <Icon name="calendar-outline" size={11} color="#7C8BA1" />
                                <Text style={{ fontFamily: 'Outfit', color: '#7C8BA1', fontSize: 10 }}>{gasto.fechaFactura}</Text>
                            </View>
                        ) : null}
                        <View className="flex-row items-center gap-1.5">
                            <Icon name="shape-outline" size={11} color={tipo.color} />
                            <Text style={{ fontFamily: 'Outfit', color: tipo.color, fontSize: 10, textTransform: 'uppercase' }}>
                                {tipo.label} · {nombreCategoria(gasto.categoria)}
                            </Text>
                        </View>
                        {metodo ? (
                            <View className="flex-row items-center gap-1.5">
                                <Icon name={ICONO_METODO[metodo] ?? 'credit-card-outline'} size={11} color="#7C8BA1" />
                                <Text style={{ fontFamily: 'Outfit', color: '#7C8BA1', fontSize: 10, textTransform: 'uppercase' }}>
                                    {metodo === 'efectivo_no_caja' ? 'Ef. No Caja' : metodo}
                                    {metodo === 'qr' ? (nombreCuenta ? ` · ${nombreCuenta}` : ' · sin cuenta') : ''}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>
                <View className="items-end gap-1.5">
                    {gasto.total !== undefined && (
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#EF4444', fontSize: 16 }}>−${formatCurrency(gasto.total)}</Text>
                    )}
                    {gasto.estado ? <Badge label={gasto.estado} variant={gasto.estado === 'pagado' ? 'success' : 'warning'} size="sm" /> : null}
                </View>
            </View>

            {gasto.descripcion ? (
                <Text className="text-xs text-slate-400 italic mt-3 pl-3 border-l-2 border-slate-700">{gasto.descripcion}</Text>
            ) : null}

            {conAcciones && (
                <View className="flex-row justify-end gap-2 pt-3 mt-3 border-t border-white/5">
                    {onEdit && <Button title="Editar" icon="pencil-outline" variant="ghost" size="sm" onPress={() => onEdit(gasto)} disabled={disabled} />}
                    {onDelete && (
                        <Button title="Eliminar" icon="trash-can-outline" variant="ghost" size="sm" onPress={() => onDelete(gasto)} disabled={disabled} className="opacity-70" />
                    )}
                </View>
            )}
        </Card>
    );
});
