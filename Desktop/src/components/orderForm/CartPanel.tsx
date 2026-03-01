import { formatCurrency } from '../../utils/formatNumber';
import type { OrderCartItem } from '../../types/models';

export type CartItem = OrderCartItem;

interface CartPanelProps {
  items: CartItem[];
  onRemove: (id: string) => void;
  onUpdateCantidad: (id: string, cantidad: number) => void;
  costoDomicilio?: number;
}

export default function CartPanel({
  items,
  onRemove,
  onUpdateCantidad,
  costoDomicilio = 0,
}: CartPanelProps) {
  const subtotal = items.reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);
  const total = subtotal + costoDomicilio;

  if (items.length === 0) {
    return <div className="cart-empty">Agrega productos desde el menú</div>;
  }

  return (
    <div>
      <div className="cart-list">
        {items.map((item) => (
          <div key={item.id} className="cart-row">
            <div>
              <div className="cart-item-name">{item.productoNombre}</div>
              <div className="cart-item-variant">{item.varianteNombre}</div>
              {item.sabores && item.sabores.length > 0 && (
                <div className="cart-item-sabores">
                  Sabores: {item.sabores.join(', ')}
                </div>
              )}
            </div>

            <div className="cart-actions">
              <button
                type="button"
                aria-label={`Reducir cantidad de ${item.productoNombre}`}
                onClick={() => (item.cantidad > 1 ? onUpdateCantidad(item.id, item.cantidad - 1) : onRemove(item.id))}
              >
                -
              </button>
              <span>{item.cantidad}</span>
              <button type="button" aria-label={`Aumentar cantidad de ${item.productoNombre}`} onClick={() => onUpdateCantidad(item.id, item.cantidad + 1)}>
                +
              </button>
            </div>

            <div className="cart-price-wrap">
              <strong>${formatCurrency(item.precioUnitario * item.cantidad)}</strong>
              <button type="button" className="cart-remove" aria-label={`Quitar ${item.productoNombre} del carrito`} onClick={() => onRemove(item.id)}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {costoDomicilio > 0 && (
        <div className="cart-total cart-total-light">
          <span>Domicilio</span>
          <span>${formatCurrency(costoDomicilio)}</span>
        </div>
      )}

      <div className="cart-total">
        <span>TOTAL</span>
        <span>${formatCurrency(total)}</span>
      </div>
    </div>
  );
}