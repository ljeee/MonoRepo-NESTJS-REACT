import React from 'react';
import type { Producto, ProductoVariante, PizzaSabor, SaborGrupo, CategoriaProducto, TamanoPizza } from '@/src/shared';
import ConfirmModal from '../ui/ConfirmModal';
import { ProductModal } from './ProductModal';
import { VariantModal } from './VariantModal';
import { SaborModal } from './SaborModal';
import type { SaborModalSaveData } from './SaborModal';
import type { PersonalizacionProducto } from './PersonalizacionSelector';

interface DeleteTarget {
    type: 'product' | 'variant' | 'sabor';
    id: number;
    name: string;
}

interface GestionProductosModalsProps {
    showProductModal: boolean;
    editingProduct: Producto | null;
    prodName: string;
    prodDesc: string;
    prodEmoji: string;
    prodPersonalizacion: PersonalizacionProducto;
    grupos: SaborGrupo[];
    prodCategoria: CategoriaProducto | null;
    prodError: string;
    showVariantModal: boolean;
    editingVariant: ProductoVariante | null;
    varName: string;
    varPrice: string;
    varDesc: string;
    varTamano: TamanoPizza | null;
    varUsaTamano: boolean;
    varError: string;
    deleteTarget: DeleteTarget | null;
    deleteLoading: boolean;
    deleteError?: string;
    editingSabor: Partial<PizzaSabor> | null;
    opLoading: boolean;
    saborLoading: boolean;
    onCloseProductModal: () => void;
    onCloseVariantModal: () => void;
    onSaveProduct: () => void;
    onSaveVariant: () => void;
    onAskDeleteProduct: (product: Producto) => void;
    onProdNameChange: (name: string) => void;
    onProdDescriptionChange: (description: string) => void;
    onProdEmojiChange: (emoji: string) => void;
    onProdPersonalizacionChange: (personalizacion: PersonalizacionProducto) => void;
    onProdCategoriaChange: (categoria: CategoriaProducto | null) => void;
    onVarNameChange: (name: string) => void;
    onVarPriceChange: (price: string) => void;
    onVarDescriptionChange: (description: string) => void;
    onVarTamanoChange: (tamano: TamanoPizza | null) => void;
    onConfirmDelete: () => void;
    onCancelDelete: () => void;
    onSaveSabor: (saborId: number | undefined, data: SaborModalSaveData) => void | Promise<void>;
    onCloseSabor: () => void;
}

export function GestionProductosModals({
    showProductModal,
    editingProduct,
    prodName,
    prodDesc,
    prodEmoji,
    prodPersonalizacion,
    grupos,
    prodCategoria,
    prodError,
    showVariantModal,
    editingVariant,
    varName,
    varPrice,
    varDesc,
    varTamano,
    varUsaTamano,
    varError,
    deleteTarget,
    deleteLoading,
    deleteError,
    editingSabor,
    opLoading,
    saborLoading,
    onCloseProductModal,
    onCloseVariantModal,
    onSaveProduct,
    onSaveVariant,
    onAskDeleteProduct,
    onProdNameChange,
    onProdDescriptionChange,
    onProdEmojiChange,
    onProdPersonalizacionChange,
    onProdCategoriaChange,
    onVarNameChange,
    onVarPriceChange,
    onVarDescriptionChange,
    onVarTamanoChange,
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
                description={prodDesc}
                emoji={prodEmoji}
                error={prodError}
                loading={opLoading}
                onClose={onCloseProductModal}
                onSave={onSaveProduct}
                onDelete={editingProduct ? () => onAskDeleteProduct(editingProduct) : undefined}
                onNameChange={onProdNameChange}
                onDescriptionChange={onProdDescriptionChange}
                onEmojiChange={onProdEmojiChange}
                personalizacion={prodPersonalizacion}
                grupos={grupos}
                onPersonalizacionChange={onProdPersonalizacionChange}
                categoria={prodCategoria}
                onCategoriaChange={onProdCategoriaChange}
            />

            <VariantModal
                visible={showVariantModal}
                editing={!!editingVariant}
                name={varName}
                price={varPrice}
                description={varDesc}
                tamano={varTamano}
                usaTamano={varUsaTamano}
                error={varError}
                loading={opLoading}
                onClose={onCloseVariantModal}
                onSave={onSaveVariant}
                onNameChange={onVarNameChange}
                onPriceChange={onVarPriceChange}
                onDescriptionChange={onVarDescriptionChange}
                onTamanoChange={onVarTamanoChange}
            />

            <ConfirmModal
                visible={!!deleteTarget}
                title={`Eliminar ${deleteTarget?.type === 'product' ? 'producto' : deleteTarget?.type === 'sabor' ? 'sabor' : 'variante'}`}
                message={`¿Estas seguro de eliminar "${deleteTarget?.name}"? ${deleteTarget?.type === 'product'
                    ? 'Esto tambien eliminara todas sus variantes.'
                    : ''
                    } Esta accion no se puede deshacer.`}
                icon="trash-can-outline"
                variant="danger"
                confirmText="Eliminar"
                loading={deleteLoading}
                error={deleteError}
                onConfirm={onConfirmDelete}
                onCancel={onCancelDelete}
            />

            <SaborModal
                visible={!!editingSabor}
                sabor={editingSabor}
                grupos={grupos}
                loading={saborLoading}
                onSave={onSaveSabor}
                onClose={onCloseSabor}
            />
        </>
    );
}
