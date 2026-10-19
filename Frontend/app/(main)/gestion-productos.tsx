import React from 'react';

import { useGestionProductosScreen } from '@/src/shared';
import {
    PageContainer,
    PageHeader,
    Button,
} from '../../components/ui';
import { GestionProductosList } from '../../components/products/GestionProductosList';
import { GestionProductosModals } from '../../components/products/GestionProductosModals';
import { PosRefreshControl } from '../../components/ui/PosRefreshControl';

export default function GestionProductosScreen() {
    const {
        loading,
        error,
        opLoading,
        saborLoading,
        sabores,
        grupos,
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
    } = useGestionProductosScreen();

    return (
        <PageContainer
            refreshControl={
                <PosRefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                />
            }
        >
            <PageHeader
                title="Gestión de Productos"
                subtitle="Administra tu carta y precios"
                icon="food-variant"
                rightContent={
                    <Button
                        title="Nuevo Producto"
                        icon="plus"
                        variant="primary"
                        size="sm"
                        onPress={() => openProductModal()}
                    />
                }
            />

            <GestionProductosList
                search={search}
                loading={loading}
                error={error}
                productos={filteredProductos}
                sabores={sabores}
                grupos={grupos}
                onSearchChange={(value) => patchUi({ search: value })}
                onEditProduct={openProductModal}
                onAddVariant={(productId) => openVariantModal(productId)}
                onEditVariant={(productId, variantId) => {
                    const product = filteredProductos.find((p) => p.productoId === productId);
                    const variant = product?.variantes?.find((v) => v.varianteId === variantId);
                    if (variant) {
                        openVariantModal(productId, variant);
                    }
                }}
                onDeleteVariant={(variantId, variantName) => {
                    patchUi({
                        deleteTarget: {
                            type: 'variant',
                            id: variantId,
                            name: variantName,
                        },
                    });
                }}
                onEditSabor={(sabor) => patchUi({ editingSabor: sabor })}
                onAddSabor={(grupoId) => patchUi({ editingSabor: { nombre: '', grupoId, recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true } })}
                onDeleteSabor={(saborId, name) => patchUi({ deleteTarget: { type: 'sabor', id: saborId, name: name } })}
            />

            <GestionProductosModals
                showProductModal={showProductModal}
                editingProduct={editingProduct}
                prodName={prodName}
                prodDesc={prodDesc}
                prodEmoji={prodEmoji}
                prodPersonalizacion={{ saborGrupoId: prodSaborGrupoId, personalizacion: prodPersonalizacion }}
                grupos={grupos}
                prodCategoria={prodCategoria}
                prodError={prodError}
                showVariantModal={showVariantModal}
                editingVariant={editingVariant}
                varName={varName}
                varPrice={varPrice}
                varDesc={varDesc}
                varTamano={varTamano}
                varUsaTamano={varUsaTamano}
                varError={varError}
                deleteTarget={deleteTarget}
                deleteLoading={deleteLoading}
                deleteError={deleteError}
                editingSabor={editingSabor}
                opLoading={opLoading}
                saborLoading={saborLoading}
                onCloseProductModal={() => patchUi({ showProductModal: false })}
                onCloseVariantModal={() => patchUi({ showVariantModal: false })}
                onSaveProduct={handleSaveProduct}
                onSaveVariant={handleSaveVariant}
                onAskDeleteProduct={(product) => {
                    patchUi({
                        showProductModal: false,
                        deleteTarget: {
                            type: 'product',
                            id: product.productoId,
                            name: product.productoNombre,
                        },
                    });
                }}
                onProdNameChange={(name) => patchUi({ prodName: name })}
                onProdDescriptionChange={(description) => patchUi({ prodDesc: description })}
                onProdEmojiChange={(emoji) => patchUi({ prodEmoji: emoji })}
                onProdPersonalizacionChange={(v) => patchUi({ prodPersonalizacion: v.personalizacion, prodSaborGrupoId: v.saborGrupoId })}
                onProdCategoriaChange={(v) => patchUi({ prodCategoria: v })}
                onVarNameChange={(name) => patchUi({ varName: name })}
                onVarPriceChange={(price) => patchUi({ varPrice: price })}
                onVarDescriptionChange={(description) => patchUi({ varDesc: description })}
                onVarTamanoChange={(tamano) => patchUi({ varTamano: tamano })}
                onConfirmDelete={handleDelete}
                onCancelDelete={() => patchUi({ deleteTarget: null })}
                onSaveSabor={handleSaveSabor}
                onCloseSabor={() => patchUi({ editingSabor: null })}
            />
        </PageContainer>
    );
}

