import React from 'react';
import type { Producto, ProductoVariante, PizzaSabor } from '@monorepo/shared';
import ConfirmModal from '../ui/ConfirmModal';
import { ProductModal } from './ProductModal';
import { VariantModal } from './VariantModal';
import { SaborModal } from './SaborModal';

interface DeleteTarget {
    type: 'product' | 'variant' | 'sabor';
    id: number;
    name: string;
}

interface GestionProductosModalsProps {
    showProductModal: boolean;
    editingProduct: Producto | null;
    prodName: string;
    prodCategory: string;
    prodDesc: string;
    prodError: string;
    showVariantModal: boolean;
    editingVariant: ProductoVariante | null;
    varName: string;
    varPrice: string;
    varDesc: string;
    varError: string;
    deleteTarget: DeleteTarget | null;
    deleteLoading: boolean;
    editingSabor: PizzaSabor | null;
    opLoading: boolean;
    saborLoading: boolean;
    onCloseProductModal: () => void;
    onCloseVariantModal: () => void;
    onSaveProduct: () => void;
    onSaveVariant: () => void;
    onAskDeleteProduct: (product: Producto) => void;
    onProdNameChange: (name: string) => void;
    onProdCategoryChange: (category: string) => void;
    onProdDescriptionChange: (description: string) => void;
    onVarNameChange: (name: string) => void;
    onVarPriceChange: (price: string) => void;
    onVarDescriptionChange: (description: string) => void;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
    onSaveSabor: (saborId: number, data: { recargoPequena: number; recargoMediana: number; recargoGrande: number }) => void;
    onCloseSabor: () => void;
}

export function GestionProductosModals({
    showProductModal,
    editingProduct,
    prodName,
    prodCategory,
    prodDesc,
    prodError,
    showVariantModal,
    editingVariant,
    varName,
    varPrice,
    varDesc,
    varError,
    deleteTarget,
    deleteLoading,
    editingSabor,
    opLoading,
    saborLoading,
    onCloseProductModal,
    onCloseVariantModal,
    onSaveProduct,
    onSaveVariant,
    onAskDeleteProduct,
    onProdNameChange,
    onProdCategoryChange,
    onProdDescriptionChange,
    onVarNameChange,
    onVarPriceChange,
    onVarDescriptionChange,
    onConfirmDelete,
    onCancelDelete,
    onSaveSabor,
    onCloseSabor,
}: GestionProductosModalsProps) {
    return (
        <>
            <ProductModal
                visible={showProductModal}
                editing={!!editingProduct}
                name={prodName}
                category={prodCategory}
                description={prodDesc}
                error={prodError}
                loading={opLoading}
                onClose={onCloseProductModal}
                onSave={onSaveProduct}
                onDelete={editingProduct ? () => onAskDeleteProduct(editingProduct) : undefined}
                onNameChange={onProdNameChange}
                onCategoryChange={onProdCategoryChange}
                onDescriptionChange={onProdDescriptionChange}
            />

            <VariantModal
                visible={showVariantModal}
                editing={!!editingVariant}
                name={varName}
                price={varPrice}
                description={varDesc}
                error={varError}
                loading={opLoading}
                onClose={onCloseVariantModal}
                onSave={onSaveVariant}
                onNameChange={onVarNameChange}
                onPriceChange={onVarPriceChange}
                onDescriptionChange={onVarDescriptionChange}
            />

            <ConfirmModal
                visible={!!deleteTarget}
                title={`Eliminar ${deleteTarget?.type === 'product' ? 'producto' : 'variante'}`}
                message={`¿Estas seguro de eliminar "${deleteTarget?.name}"? ${deleteTarget?.type === 'product'
                    ? 'Esto tambien eliminara todas sus variantes.'
                    : ''
                    } Esta accion no se puede deshacer.`}
                icon="trash-can-outline"
                variant="danger"
                confirmText="Eliminar"
                loading={deleteLoading}
                onConfirm={onConfirmDelete}
                onCancel={onCancelDelete}
            />

            <SaborModal
                visible={!!editingSabor}
                sabor={editingSabor}
                loading={saborLoading}
                onSave={onSaveSabor}
                onClose={onCloseSabor}
            />
        </>
    );
}
