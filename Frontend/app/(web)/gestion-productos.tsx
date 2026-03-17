import React from 'react';
import { RefreshControl } from 'react-native';
import { useGestionProductosScreen } from '@monorepo/shared';
import {
    PageContainer,
    PageHeader,
    Button,
} from '../../components/ui';
import { GestionProductosList } from '../../components/products/GestionProductosList';
import { GestionProductosModals } from '../../components/products/GestionProductosModals';

export default function GestionProductosScreen() {
    const {
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
        prodCategory,
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
    } = useGestionProductosScreen();

    return (
        <PageContainer
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#F5A524"
                    colors={["#F5A524"]}
                />
            }
        >
            <PageHeader
                title="Productos y Precios"
                subtitle="Gestión de Inventario"
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
                onAddSabor={() => patchUi({ editingSabor: { nombre: '', tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0 } })}
                onDeleteSabor={(saborId, name) => patchUi({ deleteTarget: { type: 'sabor', id: saborId, name: name } })}
            />

            <GestionProductosModals
                showProductModal={showProductModal}
                editingProduct={editingProduct}
                prodName={prodName}
                prodCategory={prodCategory}
                prodDesc={prodDesc}
                prodError={prodError}
                showVariantModal={showVariantModal}
                editingVariant={editingVariant}
                varName={varName}
                varPrice={varPrice}
                varDesc={varDesc}
                varError={varError}
                deleteTarget={deleteTarget}
                deleteLoading={deleteLoading}
                editingSabor={editingSabor as any}
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
                onProdCategoryChange={(category) => patchUi({ prodCategory: category })}
                onProdDescriptionChange={(description) => patchUi({ prodDesc: description })}
                onVarNameChange={(name) => patchUi({ varName: name })}
                onVarPriceChange={(price) => patchUi({ varPrice: price })}
                onVarDescriptionChange={(description) => patchUi({ varDesc: description })}
                onConfirmDelete={handleDelete}
                onCancelDelete={() => patchUi({ deleteTarget: null })}
                onSaveSabor={handleSaveSabor}
                onCloseSabor={handleCloseSabor}
            />
        </PageContainer>
    );
}
