import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { FacturasVentas } from '../../facturas-ventas/esquemas/facturas-ventas.entity';
import { Ordenes } from '../../ordenes/esquemas/ordenes.entity';
import { OrdenesProductos } from '../../ordenes-productos/esquemas/ordenes-productos.entity';
import { Domicilios } from '../../domicilios/esquemas/domicilios.entity';

export async function seedOrders() {
    const dataSource = await AppDataSource.initialize();

    const facturaRepo = dataSource.getRepository(FacturasVentas);
    const ordenRepo = dataSource.getRepository(Ordenes);
    const ordenProdRepo = dataSource.getRepository(OrdenesProductos);
    const domicilioRepo = dataSource.getRepository(Domicilios);

    try {
        console.log('🚀 Seeding demo orders...');

        // 1. Crear Facturas
        const facturasData = [
            {
                clienteNombre: 'Familia Perez (Mesa 1)',
                descripcion: 'Consumo familiar',
                estado: 'pagada',
                metodo: 'efectivo',
                total: 55000,
            },
            {
                clienteNombre: 'Juan Domicilio',
                descripcion: 'Pedido para la cena',
                estado: 'pendiente',
                metodo: 'nequi',
                total: 32000,
            },
            {
                clienteNombre: 'Cliente Paso (Para llevar)',
                descripcion: 'Pasó, pagó y llevó',
                estado: 'pagada',
                metodo: 'efectivo',
                total: 15000,
            }
        ];

        const facturas = await facturaRepo.save(
            facturasData.map(f => facturaRepo.create(f))
        );

        // 2. Crear Ordenes asociadas
        const ordenesData = [
            {
                factura: facturas[0],
                tipoPedido: 'mesa',
                estadoOrden: 'completada',
                observaciones: 'Sin mucha sal por favor',
            },
            {
                factura: facturas[1],
                tipoPedido: 'domicilio',
                estadoOrden: 'pendiente',
                observaciones: 'Timbre malo, llamar al llegar',
            },
            {
                factura: facturas[2],
                tipoPedido: 'llevar',
                estadoOrden: 'completada',
                observaciones: 'Bien empacado',
            },
            // Orden suelta sin factura aún
            {
                factura: null as any,
                tipoPedido: 'mesa',
                estadoOrden: 'pendiente',
                observaciones: 'Mesa 4, ir cobrando adelantado',
            }
        ];

        const ordenes = await ordenRepo.save(
            ordenesData.map(o => ordenRepo.create(o))
        );

        // 3. Crear Domicilio para la orden 2
        const domicilioData = {
            facturaId: facturas[1].facturaId,
            ordenId: ordenes[1].ordenId,
            telefono: '3001234567',
            direccionEntrega: 'Calle 10 # 5-20, Apartamento 301',
            costoDomicilio: 2000,
            estadoDomicilio: 'pendiente'
        };

        const domicilio = domicilioRepo.create(domicilioData);
        await domicilioRepo.save(domicilio);

        // 4. Crear Productos para las ordenes
        const productosData = [
            // Mesa 1
            { ordenId: ordenes[0].ordenId, producto: 'Pizza - Grande (Carnes + Hawaiana)', cantidad: 1, precioUnitario: 45000 },
            { ordenId: ordenes[0].ordenId, producto: 'Coca Cola 1.5L', cantidad: 1, precioUnitario: 10000 },
            
            // Domicilio
            { ordenId: ordenes[1].ordenId, producto: 'Pizza - Pequeña (Pollo BBQ)', cantidad: 1, precioUnitario: 18000 },
            { ordenId: ordenes[1].ordenId, producto: 'Lasaña Mixta', cantidad: 1, precioUnitario: 12000 },
            
            // Llevar
            { ordenId: ordenes[2].ordenId, producto: 'Hamburguesa Sencilla', cantidad: 1, precioUnitario: 15000 },

            // Mesa suelta
            { ordenId: ordenes[3].ordenId, producto: 'Salchipapa Doble', cantidad: 2, precioUnitario: 16000 }
        ];

        await ordenProdRepo.save(
            productosData.map(p => ordenProdRepo.create(p))
        );

        console.log('✅ Demo orders seeded successfully!');
    } catch (error) {
        console.error('❌ Error seeding orders:', error);
        throw error;
    } finally {
        await dataSource.destroy();
    }
}

// If run directly
if (require.main === module) {
    seedOrders().catch(() => process.exit(1));
}
