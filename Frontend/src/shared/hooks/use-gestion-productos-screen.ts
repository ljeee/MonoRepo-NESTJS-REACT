import { useEffect, useMemo, useState } from 'react';
import type { Producto, ProductoVariante, PizzaSabor } from '../types/models';
import { useProductos, useProductOperations } from './use-productos';
import { usePizzaSabores, useUpdatePizzaSabor, useCreatePizzaSabor, useDeletePizzaSabor } from './use-pizza-sabores';

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
  editingSabor: Partial<PizzaSabor> | null;
  prodName: string;
  prodDesc: string;
  prodActive: boolean;
  prodError: string;
  varName: string;
  varPrice: string;
  varDesc: string;
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
  editingSabor: null,
  prodName: '',
  prodDesc: '',
  prodActive: true,
  prodError: '',
  varName: '',
  varPrice: '',
  varDesc: '',
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
    editingSabor,
    prodName,
    prodDesc,
    prodActive,
    prodError,
    varName,
    varPrice,
    varDesc,
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

  const resetProductForm = () => {
    patchUi({
      prodName: '',
      prodDesc: '',
      prodActive: true,
      editingProduct: null,
      prodError: '',
    });
  };

  const resetVariantForm = () => {
    patchUi({
      varName: '',
      varPrice: '',
      varDesc: '',
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
        prodActive: product.activo,
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

    const payload = {
      productoNombre: prodName,
      descripcion: prodDesc,
      activo: prodActive,
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
    patchUi({ deleteLoading: true });
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
      
      patchUi({ deleteTarget: null, deleteLoading: false });
      return;
    } catch {
      patchUi({ deleteLoading: false });
    }
  };

  const handleSaveSabor = async (
    saborId: number | undefined,
    data: { nombre?: string; tipo?: 'tradicional' | 'especial' | 'configuracion'; recargoPequena: number; recargoMediana: number; recargoGrande: number },
  ) => {
    try {
      if (saborId !== undefined && saborId > 0) {
        await updateSabor(saborId, data);
      } else {
        await createSabor({ ...data, activo: true });
      }
      patchUi({ editingSabor: null });
      void fetchSabores();
    } catch {
      // Error handled in modal
    }
  };

  const handleCloseSabor = () => patchUi({ editingSabor: null });

  return {
    loading,
    error,
    opLoading,
    saborLoading,
    sabores,
    filteredProductos,
    search,
    refreshing,
    showProductModal,
    editingProduct,
    showVariantModal,
    editingVariant,
    deleteTarget,
    deleteLoading,
    editingSabor,
    prodName,
    prodDesc,
    prodError,
    varName,
    varPrice,
    varDesc,
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
