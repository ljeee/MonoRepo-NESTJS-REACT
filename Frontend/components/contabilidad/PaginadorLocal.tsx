import React from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable } from '../../tw';
import { Paginator } from '../ui';
import type { PaginaLocal } from '../../hooks/use-pagina-local';

/**
 * Controles de una paginación local (ver `usePaginaLocal`): "Mostrando 1–60 de 437", anterior/siguiente
 * y "Mostrar todas". Deja siempre a la vista cuántos registros hay: nada se corta en silencio.
 */
export function PaginadorLocal<T>({ pagina, etiqueta = 'registros' }: { pagina: PaginaLocal<T>; etiqueta?: string }) {
  if (pagina.total === 0) return null;
  return (
    <View style={styles.contenedor}>
      <Text style={styles.rango}>
        Mostrando {pagina.desde}–{pagina.hasta} de {pagina.total} {etiqueta}
      </Text>
      {!pagina.verTodo && pagina.totalPages > 1 && <Paginator page={pagina.page} totalPages={pagina.totalPages} onChange={pagina.setPage} />}
      {pagina.puedeAlternar && (
        <Pressable onPress={() => pagina.setVerTodo(!pagina.verTodo)} style={styles.boton}>
          <Text style={styles.botonTexto}>{pagina.verTodo ? 'Paginar' : `Mostrar todas (${pagina.total})`}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  rango: { color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  boton: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  botonTexto: { color: '#94A3B8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
});
