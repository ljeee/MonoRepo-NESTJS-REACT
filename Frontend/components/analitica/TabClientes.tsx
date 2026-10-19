import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text } from '../../tw';
import { DataTable, Paginator } from '../ui';
import type { DataTableColumn } from '../ui/DataTable';
import { ChartCard, formatearValor } from '../charts';
import { claveConsulta, useApi } from '@/src/shared';
import type { ClientesAnalitica, OrdenClientesAnalitica } from '@/src/shared';
import { useConsulta } from '../../hooks/use-consulta';
import type { PropsTabAnalitica } from './tipos';
import { TextoError } from './TabResumen';

type FilaCliente = ClientesAnalitica['filas'][number];
type OrdenCliente = OrdenClientesAnalitica;

/** Clientes por página. El orden y los totales salen del servidor sobre TODOS los clientes del período. */
const POR_PAGINA = 50;

const FECHA = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'America/Bogota' });

function fechaCorta(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : FECHA.format(d);
}

export function TabClientes({ consulta, version, onFiltrar, onIrA }: PropsTabAnalitica) {
  const api = useApi();
  const [orden, setOrden] = useState<OrdenCliente>('gasto');
  // La página vuelve a 1 al cambiar el período, los filtros o el orden, en el mismo render (una sola petición).
  const criterio = useMemo(() => claveConsulta('clientes', { ...consulta, orden }), [consulta, orden]);
  const [paginaDe, setPaginaDe] = useState({ criterio, pagina: 1 });
  const pagina = paginaDe.criterio === criterio ? paginaDe.pagina : 1;
  const irAPagina = useCallback((p: number) => setPaginaDe({ criterio, pagina: p }), [criterio]);

  // Antes: el top 200 por gasto, reordenado en la pantalla (ordenar por pedidos o última visita solo
  // reacomodaba esos 200) y con los totales de esos 200. Ahora el servidor pagina, ordena y totaliza.
  const params = useMemo(() => ({ ...consulta, orden, limit: POR_PAGINA, offset: (pagina - 1) * POR_PAGINA }), [consulta, orden, pagina]);
  const clientes = useConsulta(() => api.analitica.clientes(params), [api, params, version], {
    clave: claveConsulta('analitica:clientes', params),
  });

  const filas = useMemo(() => clientes.data?.filas ?? [], [clientes.data]);
  const total = clientes.data?.total ?? filas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const columnas = useMemo<DataTableColumn<FilaCliente>[]>(
    () => [
      {
        key: 'nombre',
        label: 'Cliente',
        render: (c) => (
          <View>
            <Text className="text-white text-xs font-bold" numberOfLines={1}>
              {c.nombre || 'Sin nombre'}
            </Text>
            {!!c.telefono && <Text className="text-slate-500 text-[10px] font-bold">{c.telefono}</Text>}
          </View>
        ),
      },
      { key: 'gasto', label: 'Gasto', width: 100, align: 'right', sortable: true, render: (c) => <Num v={formatearValor(c.gasto, 'monedaCompacta')} /> },
      { key: 'facturas', label: 'Pedidos', width: 76, align: 'right', sortable: true, render: (c) => <Num v={formatearValor(c.facturas)} /> },
      { key: 'ticket', label: 'Ticket', width: 92, align: 'right', sortable: true, render: (c) => <Num v={formatearValor(c.ticket, 'monedaCompacta')} /> },
      {
        key: 'ultimaVisita',
        label: 'Última',
        width: 92,
        align: 'right',
        sortable: true,
        render: (c) => <Text className="text-slate-400 text-[11px] font-bold">{fechaCorta(c.ultimaVisita)}</Text>,
      },
    ],
    [],
  );

  // Servidores viejos no traen `resumen`: entonces solo se puede resumir lo que llegó.
  const resumen = clientes.data?.resumen ?? {
    clientes: filas.length,
    recurrentes: filas.filter((c) => c.facturas > 1).length,
    gasto: filas.reduce((s, c) => s + c.gasto, 0),
  };

  return (
    <View style={styles.columna}>
      {clientes.error && <TextoError mensaje={clientes.error} />}
      <ChartCard
        title="Mejores clientes"
        subtitle={
          resumen.clientes
            ? `${formatearValor(resumen.clientes)} clientes · ${formatearValor(resumen.recurrentes)} repitieron · ${formatearValor(resumen.gasto, 'monedaCompacta')}`
            : undefined
        }
        icon="account-star-outline"
        color="#EAB308"
        loading={clientes.loading}
      >
        <DataTable
          columns={columnas}
          rows={filas}
          rowKey={(c) => c.clave}
          sortKey={orden}
          onSort={(k) => setOrden(k as OrdenCliente)}
          onRowPress={(c) => {
            if (!c.telefono) return;
            onFiltrar('cliente', c.telefono);
            onIrA('resumen');
          }}
          minWidth={520}
          emptyText="Sin clientes identificados en el período"
        />
        <Paginator page={pagina} totalPages={totalPaginas} onChange={irAPagina} caption={`${formatearValor(total)} clientes`} />
        <Text className="text-slate-600 text-[10px] font-bold mt-3">
          Solo pedidos con teléfono. Toca un cliente para ver su historial: qué pide, cuánto y cuándo.
        </Text>
      </ChartCard>
    </View>
  );
}

const Num = React.memo(function Num({ v }: { v: string }) {
  return <Text className="text-white text-xs font-black">{v}</Text>;
});

const styles = StyleSheet.create({
  columna: { gap: 16 },
});
