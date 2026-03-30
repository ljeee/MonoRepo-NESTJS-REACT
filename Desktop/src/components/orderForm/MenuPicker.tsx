import { useEffect, useMemo, useState } from 'react';
import { useProductos, usePizzaSabores } from '@monorepo/shared';
import type { Producto, ProductoVariante } from '@monorepo/shared';
import { formatCurrency } from '@monorepo/shared';
import PizzaPersonalizadaModal from './PizzaPersonalizadaModal';

interface MenuPickerProps {
  onAdd: (producto: Producto, variante: ProductoVariante, sabores?: string[]) => void;
}

const SIZE_ORDER: Record<string, number> = { Pequeña: 0, Mediana: 1, Grande: 2 };

function sortVariantes(variantes: ProductoVariante[]) {
  return [...variantes].sort((left, right) => (SIZE_ORDER[left.nombre] ?? 50) - (SIZE_ORDER[right.nombre] ?? 50));
}

export default function MenuPicker({ onAdd }: MenuPickerProps) {
  const { productos, loading, error, fetchProductos } = useProductos();
  const { sabores: saboresCatalogo, loading: loadingSabores } = usePizzaSabores();
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [selectedVariante, setSelectedVariante] = useState<ProductoVariante | null>(null);

  useEffect(() => {
    fetchProductos(true);
  }, [fetchProductos]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return productos;
    return productos.filter(
      (product: Producto) =>
        product.productoNombre.toLowerCase().includes(query) ||
        product.descripcion?.toLowerCase().includes(query),
    );
  }, [productos, searchQuery]);

  if (loading) return <p className="p-4 text-center text-muted">Cargando menú...</p>;

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-danger mb-4">{error}</p>
        <button type="button" className="btn-secondary" onClick={() => fetchProductos(true)}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="menu-container">
      <div className="search-bar mb-6">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar producto por nombre o descripción..."
          className="w-full p-3 rounded-xl border border-border bg-surface focus:border-primary outline-none transition-all"
          aria-label="Buscar producto en el menú"
        />
      </div>

      <div className="menu-products grid grid-cols-1 gap-3">
        {filteredProducts.length === 0 ? (
          <div className="cart-empty py-10 text-center text-muted border border-dashed border-border rounded-2xl">
            No se encontraron productos que coincidan con la búsqueda
          </div>
        ) : (
          filteredProducts.map((producto: Producto) => {
            const isExpanded = expandedProductId === producto.productoId;
            const isPizza = producto.productoNombre.toLowerCase().includes('pizza');

            return (
              <div key={producto.productoId} className="menu-product bg-surface border border-border rounded-2xl overflow-hidden transition-all hover:border-primary/30">
                <button
                  type="button"
                  className={`menu-product-header w-full flex justify-between items-center p-4 text-left transition-colors ${isExpanded ? 'bg-primary/5' : ''}`}
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedProductId(isExpanded ? null : producto.productoId)}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-text text-lg">{producto.productoNombre}</span>
                    {producto.descripcion && (
                        <span className="text-xs text-muted mt-1">{producto.descripcion}</span>
                    )}
                  </div>
                  <span className={`text-primary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {isExpanded && (
                  <div className="menu-variants p-3 pt-0 bg-surface-dark/30 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sortVariantes(producto.variantes)
                      .filter((variante: ProductoVariante) => variante.activo)
                      .map((variante: ProductoVariante) => (
                        <button
                          key={variante.varianteId}
                          type="button"
                          className="menu-variant flex justify-between items-center p-3 rounded-xl bg-surface border border-border hover:border-primary hover:bg-primary/5 transition-all text-sm group"
                          onClick={() => {
                            if (isPizza) {
                              setSelectedProducto(producto);
                              setSelectedVariante(variante);
                              setModalVisible(true);
                              return;
                            }
                            onAdd(producto, variante);
                          }}
                        >
                          <span className="font-medium text-text-secondary group-hover:text-text">{variante.nombre}</span>
                          <strong className="text-primary">${formatCurrency(Number(variante.precio))}</strong>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {selectedProducto && selectedVariante && (
        <PizzaPersonalizadaModal
          visible={modalVisible}
          producto={selectedProducto}
          variante={selectedVariante}
          saboresCatalogo={saboresCatalogo}
          loadingSabores={loadingSabores}
          onAdd={(producto, variante, sabores) => {
            onAdd(producto, variante, sabores);
            setModalVisible(false);
            setSelectedProducto(null);
            setSelectedVariante(null);
          }}
          onClose={() => {
            setModalVisible(false);
            setSelectedProducto(null);
            setSelectedVariante(null);
          }}
        />
      )}
    </div>
  );
}
