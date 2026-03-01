import { useMemo, useState } from 'react';
import type { Producto, ProductoVariante } from '../../types/models';
import type { PizzaSabor } from '../../services/api';
import { formatCurrency } from '../../utils/formatNumber';

function getRecargo(sabor: PizzaSabor, varianteNombre: string): number {
  if (varianteNombre === 'Pequeña') return Number(sabor.recargoPequena);
  if (varianteNombre === 'Mediana') return Number(sabor.recargoMediana);
  return Number(sabor.recargoGrande);
}

function calcularPrecio(
  variante: ProductoVariante | null,
  saboresSeleccionados: string[],
  saboresCatalogo: PizzaSabor[],
): number {
  if (!variante) return 0;
  let precio = Number(variante.precio);

  const maxRecargo = saboresSeleccionados.reduce((max, nombre) => {
    const entry = saboresCatalogo.find((sabor) => sabor.nombre === nombre);
    if (!entry || entry.tipo !== 'especial') return max;
    return Math.max(max, getRecargo(entry, variante.nombre));
  }, 0);

  precio += maxRecargo;

  if (saboresSeleccionados.length >= 3) {
    const config3Sabores = saboresCatalogo.find(
      (sabor) => sabor.tipo === 'configuracion' && sabor.nombre === 'RECARGO_3_SABORES',
    );
    const extra3SaboresAmount = config3Sabores ? Number(config3Sabores.recargoGrande) : 3000;
    precio += extra3SaboresAmount;
  }

  return precio;
}

interface PizzaPersonalizadaModalProps {
  visible: boolean;
  variante: ProductoVariante | null;
  producto: Producto | null;
  saboresCatalogo: PizzaSabor[];
  loadingSabores?: boolean;
  onAdd: (producto: Producto, variante: ProductoVariante, sabores: string[]) => void;
  onClose: () => void;
}

export default function PizzaPersonalizadaModal({
  visible,
  variante,
  producto,
  saboresCatalogo,
  loadingSabores,
  onAdd,
  onClose,
}: PizzaPersonalizadaModalProps) {
  const [selectedSabores, setSelectedSabores] = useState<string[]>([]);

  const tradicionales = useMemo(
    () => saboresCatalogo.filter((sabor) => sabor.tipo === 'tradicional' && sabor.activo),
    [saboresCatalogo],
  );
  const especiales = useMemo(
    () => saboresCatalogo.filter((sabor) => sabor.tipo === 'especial' && sabor.activo),
    [saboresCatalogo],
  );
  const precioFinal = useMemo(
    () => calcularPrecio(variante, selectedSabores, saboresCatalogo),
    [variante, selectedSabores, saboresCatalogo],
  );

  const recargoEspecial = useMemo(
    () =>
      saboresCatalogo
        .filter((sabor) => sabor.tipo === 'especial' && selectedSabores.includes(sabor.nombre))
        .reduce((max, sabor) => Math.max(max, getRecargo(sabor, variante?.nombre ?? '')), 0),
    [saboresCatalogo, selectedSabores, variante?.nombre],
  );

  if (!visible) return null;

  const handleSaborPress = (nombre: string) => {
    setSelectedSabores((prev) => {
      if (prev.includes(nombre)) return prev.filter((sabor) => sabor !== nombre);
      if (prev.length >= 3) return prev;
      return [...prev, nombre];
    });
  };

  const handleAdd = () => {
    if (!producto || !variante || selectedSabores.length === 0) return;
    const adjustedVariante = { ...variante, precio: precioFinal };
    onAdd(producto, adjustedVariante, selectedSabores);
    setSelectedSabores([]);
  };

  const handleClose = () => {
    setSelectedSabores([]);
    onClose();
  };

  const renderChip = (sabor: PizzaSabor) => {
    const isSelected = selectedSabores.includes(sabor.nombre);
    const isEspecial = sabor.tipo === 'especial';
    const recargo = variante ? getRecargo(sabor, variante.nombre) : 0;

    return (
      <button
        key={sabor.saborId}
        type="button"
        onClick={() => handleSaborPress(sabor.nombre)}
        className={`chip ${isSelected ? 'active' : ''} ${isEspecial ? 'especial' : ''}`}
      >
        {isEspecial ? '★ ' : ''}
        {sabor.nombre}
        {isEspecial && recargo > 0 ? ` +$${formatCurrency(recargo)}` : ''}
        {isSelected ? ' ✓' : ''}
      </button>
    );
  };

  return (
    <div className="pizza-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="pizza-modal-title">
      <div className="pizza-modal">
        <h3 className="pizza-title" id="pizza-modal-title">Pizza {variante?.nombre}</h3>
        <p className="pizza-subtitle">
          Selecciona 1-3 sabores • Base ${formatCurrency(Number(variante?.precio ?? 0))}
        </p>

        {loadingSabores ? (
          <p>Cargando sabores...</p>
        ) : (
          <>
            <h4 className="pizza-subheading">Tradicionales</h4>
            <div className="chips-grid">{tradicionales.map((sabor) => renderChip(sabor))}</div>
            <h4 className="pizza-subheading">Especiales ★</h4>
            <div className="chips-grid">{especiales.map((sabor) => renderChip(sabor))}</div>
          </>
        )}

        {selectedSabores.length > 0 && (
          <div className="pizza-summary">
            <div className="pizza-summary-title">{selectedSabores.join(' + ')}</div>
            {recargoEspecial > 0 && (
              <div className="pizza-summary-meta">
                + ${formatCurrency(recargoEspecial)} sabor especial
              </div>
            )}
          </div>
        )}

        <div className="pizza-actions">
          <button type="button" className="btn-secondary" onClick={handleClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" disabled={selectedSabores.length === 0} onClick={handleAdd}>
            {selectedSabores.length === 0
              ? 'Elige sabores'
              : `Agregar • $${formatCurrency(precioFinal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}