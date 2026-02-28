import { Platform } from 'react-native';
import type { FacturaPago } from '../types/models';
import type { FacturaItem } from '../components/facturas/FacturaShared';

type BalanceGastoItem = FacturaPago;

export function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function downloadCsv(csv: string, filename: string) {
  if (Platform.OS !== 'web') return;
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export function buildCombinedBalanceCsv(facturas: FacturaItem[], gastos: BalanceGastoItem[]): string {
  const rows: string[] = ['Tipo,ID,Nombre/Cliente,Fecha,Total,Estado,Método'];

  for (const factura of facturas) {
    const fecha = factura.fechaFactura ? new Date(factura.fechaFactura).toLocaleDateString('es-CO') : '';
    rows.push(
      `Factura,${factura.facturaId ?? ''},${escapeCsvValue(factura.clienteNombre || '')},${fecha},${factura.total ?? 0},${factura.estado || ''},${factura.metodo || ''}`,
    );
  }

  for (const gasto of gastos) {
    const fecha = gasto.fechaFactura ? new Date(gasto.fechaFactura).toLocaleDateString('es-CO') : '';
    rows.push(
      `Gasto,${gasto.pagosId ?? ''},${escapeCsvValue(gasto.nombreGasto || '')},${fecha},${gasto.total ?? 0},${gasto.estado || ''},${gasto.metodo || ''}`,
    );
  }

  return rows.join('\n');
}