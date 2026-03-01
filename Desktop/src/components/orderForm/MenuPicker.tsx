import { useEffect, useMemo, useState } from 'react';
import { useProductos, Producto, ProductoVariante } from '../../hooks/use-productos';
import { usePizzaSabores } from '../../hooks/use-pizza-sabores';
import { formatCurrency } from '../../utils/formatNumber';
import PizzaPersonalizadaModal from './PizzaPersonalizadaModal';

interface MenuPickerProps {
  onAdd: (producto: Producto, variante: ProductoVariante, sabores?: string[]) => void;
}

const CATEGORY_ORDER: Record<string, number> = {
  Pizzas: 0,
  Hamburguesas: 1,
  Chuzos: 2,
  'Pizza Burguer': 3,
  Tortiburger: 4,
  Calzones: 5,
  Adiciones: 99,
};

const SIZE_ORDER: Record<string, number> = { Pequeña: 0, Mediana: 1, Grande: 2 };

function sortVariantes(variantes: ProductoVariante[]) {
  return [...variantes].sort((left, right) => (SIZE_ORDER[left.nombre] ?? 50) - (SIZE_ORDER[right.nombre] ?? 50));
}

export default function MenuPicker({ onAdd }: MenuPickerProps) {
  const { productos, loading, error, fetchProductos } = useProductos();
  const { sabores: saboresCatalogo, loading: loadingSabores } = usePizzaSabores();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [selectedVariante, setSelectedVariante] = useState<ProductoVariante | null>(null);

  useEffect(() => {
    fetchProductos(undefined, true);
  }, [fetchProductos]);

  const categories = useMemo(
    () =>
      productos.reduce<Record<string, Producto[]>>((acc, producto) => {
        const cat = producto.categoria || 'Otros';
        (acc[cat] ??= []).push(producto);
        return acc;
      }, {}),
    [productos],
  );

  const categoryNames = useMemo(
    () => Object.keys(categories).sort((left, right) => (CATEGORY_ORDER[left] ?? 50) - (CATEGORY_ORDER[right] ?? 50)),
    [categories],
  );

  useEffect(() => {
    if (categoryNames.length > 0 && !activeCategory) {
      setActiveCategory(categoryNames[0]);
    }
  }, [categoryNames, activeCategory]);

  const filteredProducts = useMemo(() => {
    if (!activeCategory) return [];
    const products = categories[activeCategory] || [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (product) =>
        product.productoNombre.toLowerCase().includes(query) ||
        product.descripcion?.toLowerCase().includes(query),
    );
  }, [activeCategory, categories, searchQuery]);

  if (loading) return <p>Cargando menú...</p>;

  if (error) {
    return (
      <div>
        <p>{error}</p>
        <button type="button" className="btn-secondary" onClick={() => fetchProductos(undefined, true)}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Buscar producto..."
        aria-label="Buscar producto en el menú"
      />

      <div className="menu-tabs">
        {categoryNames.map((categoryName) => (
          <button
            key={categoryName}
            type="button"
            className={`menu-tab ${activeCategory === categoryName ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory(categoryName);
              setExpandedProductId(null);
            }}
          >
            {categoryName} ({categories[categoryName].length})
          </button>
        ))}
      </div>

      <div className="menu-products">
        {filteredProducts.length === 0 ? (
          <div className="cart-empty">No se encontraron productos</div>
        ) : (
          filteredProducts.map((producto) => {
            const isExpanded = expandedProductId === producto.productoId;
            return (
              <div key={producto.productoId} className="menu-product">
                <button
                  type="button"
                  className="menu-product-header"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedProductId(isExpanded ? null : producto.productoId)}
                >
                  <span>{producto.productoNombre}</span>
                  <span>{isExpanded ? '▾' : '▸'}</span>
                </button>

                {isExpanded && (
                  <div className="menu-variants">
                    {sortVariantes(producto.variantes)
                      .filter((variante) => variante.activo)
                      .map((variante) => (
                        <button
                          key={variante.varianteId}
                          type="button"
                          className="menu-variant"
                          onClick={() => {
                            if (producto.categoria === 'Pizzas') {
                              setSelectedProducto(producto);
                              setSelectedVariante(variante);
                              setModalVisible(true);
                              return;
                            }
                            onAdd(producto, variante);
                          }}
                        >
                          <span>{variante.nombre}</span>
                          <strong>${formatCurrency(Number(variante.precio))}</strong>
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