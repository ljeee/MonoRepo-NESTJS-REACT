import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text } from '../../tw';
import { Paginator, SegmentedControl } from '../ui';
import { useApi } from '@/src/shared';
import type { TipoItemInventario } from '@/src/shared';
import { useConsulta } from '../../hooks/use-consulta';
import { MovementRow } from './MovementRow';

const POR_PAGINA = 30;
type Filtro = 'todos' | TipoItemInventario;

/** Libro de movimientos de cajas y bebidas, paginado en el servidor. */
export function TabMovimientos({ version }: { version: number }) {
  const api = useApi();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [filtro]);

  const datos = useConsulta(
    () =>
      api.inventario.movimientos({
        tipoItem: filtro === 'todos' ? undefined : filtro,
        limit: POR_PAGINA,
        offset: (pagina - 1) * POR_PAGINA,
      }),
    [api, filtro, pagina, version],
  );
  const total = datos.data?.total ?? 0;

  return (
    <View style={styles.columna}>
      <SegmentedControl
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'caja', label: 'Cajas', icon: 'package-variant-closed' },
          { value: 'bebida', label: 'Bebidas', icon: 'bottle-soda' },
        ]}
        value={filtro}
        onChange={setFiltro}
      />
      {datos.error && <Text style={styles.error}>{datos.error}</Text>}
      {!datos.loading && !datos.data?.filas.length && <Text style={styles.vacio}>Sin movimientos.</Text>}
      <View>
        {(datos.data?.filas ?? []).map((m) => (
          <MovementRow key={m.id} mov={m} />
        ))}
      </View>
      {total > POR_PAGINA && (
        <Paginator page={pagina} totalPages={Math.ceil(total / POR_PAGINA)} onChange={setPagina} caption={`${total} movimientos`} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  columna: { gap: 14, marginBottom: 40 },
  error: { color: '#FB7185', fontWeight: '700' },
  vacio: { color: '#475569', fontSize: 13 },
});
