import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { FacturasVentas } from '../../facturas-ventas/esquemas/facturas-ventas.entity';
import { Ordenes } from '../../ordenes/esquemas/ordenes.entity';
import { OrdenesProductos } from '../../ordenes-productos/esquemas/ordenes-productos.entity';
import { Domicilios } from '../../domicilios/esquemas/domicilios.entity';
import { ProductoVariantes } from '../../productos/esquemas/producto-variantes.entity';

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(n: number, offsetHours = 0): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(offsetHours, Math.floor(Math.random() * 59), 0, 0);
    return d;
}

// ── Data ─────────────────────────────────────────────────────────────────────

/** Domiciliarios from seed-users.ts */
const DOMICILIARIOS = [
    { telefono: '3117462406', nombre: 'CARACHO' },
    { telefono: '3058545970', nombre: 'GORDITO' },
    { telefono: '3194225123', nombre: 'JUANCHO' },
    { telefono: '3015324651', nombre: 'FELIPE' },
];

const CLIENTES = [
    { nombre: 'Carlos Morales',    tel: '3100001111', dir: 'Cra 5 # 12-34 Apto 201' },
    { nombre: 'Luisa Fernández',   tel: '3100002222', dir: 'Calle 8 # 3-10' },
    { nombre: 'Andrés Gómez',      tel: '3100003333', dir: 'Tv 9 # 7-15 Casa 2' },
    { nombre: 'María Rodríguez',   tel: '3100004444', dir: 'Cll 15 # 8-20 Bl 3 Ap 5' },
    { nombre: 'Pedro Jiménez',     tel: '3100005555', dir: 'Cra 12 # 18-40' },
    { nombre: 'Ana Martínez',      tel: '3100006666', dir: 'Diagonal 10 # 4-22' },
    { nombre: 'Santiago López',    tel: '3100007777', dir: 'Cll 22 # 6-18 Ap 302' },
    { nombre: 'Valentina Ruiz',    tel: '3100008888', dir: 'Cra 3 # 9-55 Casa 1' },
    { nombre: 'Camilo Herrera',    tel: '3100009999', dir: 'Cll 30 # 11-5 Of 201' },
    { nombre: 'Isabella Torres',   tel: '3101001010', dir: 'Cra 7 # 14-22' },
];

const PRODUCTOS = [
    { nombre: 'Pizza Grande Especial',    precio: 42000 },
    { nombre: 'Pizza Mediana BBQ',        precio: 28000 },
    { nombre: 'Pizza Pequeña Hawaiana',   precio: 18000 },
    { nombre: 'Lasaña Mixta',             precio: 14000 },
    { nombre: 'Hamburguesa Doble',        precio: 16000 },
    { nombre: 'Salchipapa Doble',         precio: 10000 },
    { nombre: 'Coca Cola 1.5L',           precio: 7000  },
    { nombre: 'Agua Cristal 600ml',       precio: 3000  },
    { nombre: 'Pan de Ajo',               precio: 5000  },
    { nombre: 'Alitas BBQ x6',            precio: 20000 },
];

const METODOS: string[] = ['efectivo', 'nequi', 'daviplata', 'transferencia'];
const SABORES = ['Hawaiana', 'Carnes', 'Pollo Champiñones', 'Mexicana', 'BBQ', 'Napolitana', 'Pepperoni'];

// ── Seeder ───────────────────────────────────────────────────────────────────

export async function seedOrders() {
    const dataSource = await AppDataSource.initialize();

    const facturaRepo  = dataSource.getRepository(FacturasVentas);
    const ordenRepo    = dataSource.getRepository(Ordenes);
    const prodRepo     = dataSource.getRepository(OrdenesProductos);
    const domRepo      = dataSource.getRepository(Domicilios);
    const varianteRepo = dataSource.getRepository(ProductoVariantes);

    // Fetch actual variants with products
    const dbVariantes: ProductoVariantes[] = await varianteRepo.find({ relations: ['producto'] });
    if (dbVariantes.length === 0) {
        console.error('❌ No hay productos en la BD. Ejecuta seed-productos primero.');
        await dataSource.destroy();
        return;
    }

    try {
        console.log('🚀 Seeding demo orders (30 domicilios + mesa/llevar)...');

        // ── 30 domicilios distribuidos entre 4 domiciliarios ──────────────────
        for (let i = 0; i < 30; i++) {
            const dom     = DOMICILIARIOS[i % DOMICILIARIOS.length];
            const cliente = randomFrom(CLIENTES);
            
            // Pick 1-2 random products
            const numProds = Math.random() > 0.7 ? 2 : 1;
            const items = Array.from({ length: numProds }).map(() => {
                const v = randomFrom(dbVariantes);
                const isPizza = v.producto?.categoria?.toLowerCase() === 'pizzas';
                const s1 = isPizza ? randomFrom(SABORES) : undefined;
                const s2 = isPizza && Math.random() > 0.5 ? randomFrom(SABORES) : undefined;
                
                let nombre = `${v.producto?.productoNombre} - ${v.nombre}`;
                if (s1 && s2) nombre += ` (${s1} + ${s2})`;
                else if (s1) nombre += ` (${s1})`;

                return {
                    varianteId: v.varianteId,
                    nombre,
                    precio: Number(v.precio),
                    cantidad: 1,
                    sabor1: s1,
                    sabor2: s2
                };
            });

            const fecha   = daysAgo(Math.floor(i / 6), 10 + (i % 12));
            const subtotal = items.reduce((sum, item) => sum + item.precio, 0);
            const total   = subtotal + 3000;
            const estado  = i < 20 ? 'pendiente' : 'entregado';
            const pagada  = estado === 'entregado';

            const factura = await facturaRepo.save(facturaRepo.create({
                clienteNombre: cliente.nombre,
                descripcion:   `Domicilio #${i + 1}`,
                fechaFactura:  fecha,
                estado:        pagada ? 'pagada' : 'pendiente',
                metodo:        pagada ? randomFrom(METODOS) : undefined,
                total,
            }));

            const orden = await ordenRepo.save(ordenRepo.create({
                factura,
                tipoPedido:  'domicilio',
                estadoOrden: pagada ? 'completada' : 'pendiente',
                fechaOrden:  fecha,
                observaciones: i % 3 === 0 ? 'Llamar al llegar' : undefined,
            }));

            for (const item of items) {
                await prodRepo.save(prodRepo.create({
                    ordenId: orden.ordenId,
                    producto: item.nombre,
                    cantidad: item.cantidad,
                    precioUnitario: item.precio,
                    varianteId: item.varianteId,
                    // Note: flavors are currently part of the string in the DB schema
                }));
            }

            await domRepo.save(domRepo.create({
                facturaId:                    factura.facturaId,
                ordenId:                      orden.ordenId,
                fechaCreado:                  fecha,
                telefono:                     cliente.tel,
                telefonoDomiciliarioAsignado: dom.telefono,
                direccionEntrega:             cliente.dir,
                costoDomicilio:               3000,
                estadoDomicilio:              estado,
            }));

            console.log(`  ✅ Domicilio ${i + 1}/30 → ${dom.nombre} | ${cliente.nombre} | ${estado}`);
        }

        // ── 10 órdenes de mesa ────────────────────────────────────────────────
        for (let i = 0; i < 10; i++) {
            const v = randomFrom(dbVariantes);
            const fecha = daysAgo(Math.floor(i / 3), 12 + i);
            const pagada = i % 2 === 0;
            const precio = Number(v.precio);
            
            const nombre = `${v.producto?.productoNombre} - ${v.nombre}`;

            const factura = await facturaRepo.save(facturaRepo.create({
                clienteNombre: `Mesa ${(i % 5) + 1}`,
                descripcion:   'Consumo en local',
                fechaFactura:  fecha,
                estado:        pagada ? 'pagada' : 'pendiente',
                metodo:        pagada ? randomFrom(METODOS) : undefined,
                total:         precio,
            }));

            const orden = await ordenRepo.save(ordenRepo.create({
                factura,
                tipoPedido:  'mesa',
                estadoOrden: pagada ? 'completada' : 'pendiente',
                fechaOrden:  fecha,
            }));

            await prodRepo.save(prodRepo.create({
                ordenId: orden.ordenId,
                producto: nombre,
                cantidad: 1,
                precioUnitario: precio,
                varianteId: v.varianteId
            }));
        }

        // ── 5 órdenes para llevar ────────────────────────────────────────────
        for (let i = 0; i < 5; i++) {
            const v = randomFrom(dbVariantes);
            const fecha = daysAgo(i, 16);
            const precio = Number(v.precio);
            const nombre = `${v.producto?.productoNombre} - ${v.nombre}`;

            const factura = await facturaRepo.save(facturaRepo.create({
                clienteNombre: `Cliente Paso ${i + 1}`,
                descripcion:   'Para llevar',
                fechaFactura:  fecha,
                estado:        'pagada',
                metodo:        randomFrom(METODOS),
                total:         precio,
            }));

            const orden = await ordenRepo.save(ordenRepo.create({
                factura,
                tipoPedido:  'llevar',
                estadoOrden: 'completada',
                fechaOrden:  fecha,
            }));

            await prodRepo.save(prodRepo.create({
                ordenId: orden.ordenId,
                producto: nombre,
                cantidad: 1,
                precioUnitario: precio,
                varianteId: v.varianteId
            }));
        }

        console.log('');
        console.log('✅ Seed completado:');
        console.log('   • 30 domicilios (10 pendiente, 10 en_camino, 10 entregado)');
        console.log('   • 10 órdenes de mesa');
        console.log('   • 5 órdenes para llevar');
        console.log('   • 45 facturas y productos relacionados');

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
