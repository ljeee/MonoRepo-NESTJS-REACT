import { useEffect, useMemo, useState } from 'react';
import type { Producto, ProductoVariante, PizzaSabor, SaborGrupo, CategoriaProducto, TamanoPizza } from '../types/models';
import { useProductos, useProductOperations } from './use-productos';
import { usePizzaSabores, useUpdatePizzaSabor, useCreatePizzaSabor, useDeletePizzaSabor } from './use-pizza-sabores';
import { useSaborGrupos } from './use-sabor-grupos';
import { resolverPersonalizacion } from '../utils/personalizacion';

type DeleteTarget = { type: 'product' | 'variant' | 'sabor'; id: number; name: string } | null;

type UiState = {
  search: string;
  refreshing: boolean;
  showProductModal: boolean;
  editingProduct: Producto | null;
  showVariantModal: boolean;
  editingVariant: ProductoVariante | null;
  parentProductId: number | null;
  deleteTarget: DeleteTarget;
  deleteLoading: boolean;
  deleteError: string;
  editingSabor: Partial<PizzaSabor> | null;
  prodName: string;
  prodDesc: string;
  prodEmoji: string;
  prodActive: boolean;
  prodPersonalizacion: 'ninguna' | 'jugo';
  prodSaborGrupoId: number | null;
  prodCategoria: CategoriaProducto | null;
  prodError: string;
  varName: string;
  varPrice: string;
  varDesc: string;
  varTamano: TamanoPizza | null;
  varError: string;
};

const initialUiState: UiState = {
  search: '',
  refreshing: false,
  showProductModal: false,
  editingProduct: null,
  showVariantModal: false,
  editingVariant: null,
  parentProductId: null,
  deleteTarget: null,
  deleteLoading: false,
  deleteError: '',
  editingSabor: null,
  prodName: '',
  prodDesc: '',
  prodEmoji: '',
  prodActive: true,
  prodPersonalizacion: 'ninguna',
  prodSaborGrupoId: null,
  prodCategoria: null,
  prodError: '',
  varName: '',
  varPrice: '',
  varDesc: '',
  varTamano: null,
  varError: '',
};

export function useGestionProductosScreen() {
  const { productos, loading, error, fetchProductos } = useProductos();
  const {
    createProducto,
    updateProducto,
    deleteProducto,
    createVariante,
    updateVariante,
    deleteVariante,
    loading: opLoading,
  } = useProductOperations();

  const { sabores, fetchSabores } = usePizzaSabores();
  const { grupos } = useSaborGrupos();
  const { updateSabor, loading: updateSaborLoading } = useUpdatePizzaSabor();
  const { createSabor, loading: createSaborLoading } = useCreatePizzaSabor();
  const { deleteSabor, loading: deleteSaborLoading } = useDeletePizzaSabor();
  const saborLoading = updateSaborLoading || createSaborLoading || deleteSaborLoading;

  const [uiState, setUiState] = useState<UiState>(initialUiState);
  const patchUi = (patch: Partial<UiState>) => {
    setUiState((prev) => ({ ...prev, ...patch }));
  };

  const {
    search,
    refreshing,
    showProductModal,
    editingProduct,
    showVariantModal,
    editingVariant,
    parentProductId,
    deleteTarget,
    deleteLoading,
    deleteError,
    editingSabor,
    prodName,
    prodDesc,
    prodEmoji,
    prodActive,
    prodPersonalizacion,
    prodSaborGrupoId,
    prodCategoria,
    prodError,
    varName,
    varPrice,
    varDesc,
    varTamano,
    varError,
  } = uiState;

  useEffect(() => {
    void fetchProductos();
  }, [fetchProductos]);

  const filteredProductos = useMemo(() => {
    if (search.trim() === '') {
      return productos;
    }
    const lower = search.toLowerCase();
    return productos.filter(
      (p) =>
        p.productoNombre.toLowerCase().includes(lower)
    );
  }, [search, productos]);

  // El selector de tamaño de la variante solo aplica si el grupo de sabores de su producto usa tamaños.
  const varUsaTamano = useMemo(() => {
    const producto = productos.find((p) => p.productoId === parentProductId);
    return grupos.find((g) => g.id === producto?.saborGrupoId)?.usaTamano ?? false;
  }, [productos, grupos, parentProductId]);

  const resetProductForm = () => {
    patchUi({
      prodName: '',
      prodDesc: '',
      prodEmoji: '',
      prodActive: true,
      prodPersonalizacion: 'ninguna',
      prodSaborGrupoId: null,
      prodCategoria: null,
      editingProduct: null,
      prodError: '',
    });
  };

  const resetVariantForm = () => {
    patchUi({
      varName: '',
      varPrice: '',
      varDesc: '',
      varTamano: null,
      editingVariant: null,
      parentProductId: null,
      varError: '',
    });
  };

  const handleRefresh = async () => {
    patchUi({ refreshing: true });
    await fetchProductos();
    patchUi({ refreshing: false });
  };

  const openProductModal = (product?: Producto) => {
    if (product) {
      patchUi({
        editingProduct: product,
        prodName: product.productoNombre,
        prodDesc: product.descripcion || '',
        prodEmoji: product.emoji || '',
        prodActive: product.activo,
        prodPersonalizacion: resolverPersonalizacion(product) === 'jugo' ? 'jugo' : 'ninguna',
        prodSaborGrupoId: product.saborGrupoId ?? null,
        prodCategoria: product.categoria ?? null,
      });
    } else {
      resetProductForm();
    }
    patchUi({ prodError: '', showProductModal: true });
  };

  const openVariantModal = (productId: number, variant?: ProductoVariante) => {
    patchUi({ parentProductId: productId });
    if (variant) {
      patchUi({
        editingVariant: variant,
        varName: variant.nombre,
        varPrice: variant.precio.toString(),
        varDesc: variant.descripcion || '',
        varTamano: variant.tamano ?? null,
      });
    } else {
      resetVariantForm();
      patchUi({ parentProductId: productId });
    }
    patchUi({ varError: '', showVariantModal: true });
  };

  const handleSaveProduct = async () => {
    if (!prodName) {
      patchUi({ prodError: 'El nombre es obligatorio' });
      return;
    }

    // La categoría solo viaja si cambió: al crear sin elegirla el backend la deduce del
    // nombre, y al editar no se pisa la guardada si la respuesta no trajo el campo.
    const categoriaCambio = prodCategoria !== (editingProduct?.categoria ?? null);
    const payload = {
      productoNombre: prodName,
      descripcion: prodDesc,
      emoji: prodEmoji || undefined,
      activo: prodActive,
      personalizacion: prodPersonalizacion,
      saborGrupoId: prodSaborGrupoId,
      ...(categoriaCambio ? { categoria: prodCategoria } : {}),
    };

    try {
      if (editingProduct) {
        await updateProducto(editingProduct.productoId, payload);
      } else {
        await createProducto(payload);
      }
      patchUi({ showProductModal: false });
      resetProductForm();
      void fetchProductos();
    } catch {
      patchUi({ prodError: 'No se pudo guardar el producto' });
    }
  };

  const handleSaveVariant = async () => {
    if (!varName || !varPrice || !parentProductId) {
      patchUi({ varError: 'Nombre, Precio y Producto son requeridos' });
      return;
    }

    const payload = {
      nombre: varName,
      precio: Number(varPrice),
      descripcion: varDesc,
      // null = volver a deducir el tamaño del nombre
      tamano: varTamano,
      activo: true,
    };

    try {
      if (editingVariant) {
        await updateVariante(editingVariant.varianteId, payload);
      } else {
        await createVariante(parentProductId, payload);
      }
      patchUi({ showVariantModal: false });
      resetVariantForm();
      void fetchProductos();
    } catch {
      patchUi({ varError: 'No se pudo guardar la variante' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    patchUi({ deleteLoading: true, deleteError: '' });
    try {
      if (deleteTarget.type === 'product') {
        await deleteProducto(deleteTarget.id);
      } else if (deleteTarget.type === 'variant') {
        await deleteVariante(deleteTarget.id);
      } else if (deleteTarget.type === 'sabor') {
        await deleteSabor(deleteTarget.id);
        void fetchSabores();
      }
      
      if (deleteTarget.type !== 'sabor') {
        void fetchProductos();
      }
      
      patchUi({ deleteTarget: null, deleteLoading: false, deleteError: '' });
    } catch {
      patchUi({ deleteLoading: false, deleteError: 'No se pudo eliminar. Intenta de nuevo.' });
    }
  };

  const handleSaveSabor = async (
    saborId: number | undefined,
    data: { nombre: string; grupoId: number; activo: boolean; recargoPequena: number; recargoMediana: number; recargoGrande: number },
  ) => {
    // El error se propaga: el modal lo atrapa y lo muestra (antes se tragaba aquí y la
    // creación fallida parecía no hacer nada).
    if (saborId !== undefined && saborId > 0) {
      await updateSabor(saborId, data);
    } else {
      await createSabor(data);
    }
    patchUi({ editingSabor: null });
    void fetchSabores();
  };

  const handleCloseSabor = () => patchUi({ editingSabor: null });

  return {
    loading,
    error,
    opLoading,
    saborLoading,
    sabores,
    grupos: grupos as SaborGrupo[],
    filteredProductos,
    search,
    refreshing,
    showProductModal,
    editingProduct,
    showVariantModal,
    editingVariant,
    deleteTarget,
    deleteLoading,
    deleteError,
    editingSabor,
    prodName,
    prodDesc,
    prodEmoji,
    prodPersonalizacion,
    prodSaborGrupoId,
    prodCategoria,
    prodError,
    varName,
    varPrice,
    varDesc,
    varTamano,
    varUsaTamano,
    varError,
    patchUi,
    openProductModal,
    openVariantModal,
    handleRefresh,
    handleSaveProduct,
    handleSaveVariant,
    handleDelete,
    handleSaveSabor,
    handleCloseSabor,
  };
}
