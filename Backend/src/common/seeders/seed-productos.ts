import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { Productos } from '../../productos/esquemas/productos.entity';
import { ProductoVariantes } from '../../productos/esquemas/producto-variantes.entity';

// Este seeder ya no es necesario en producción/Docker:
// - TypeORM crea las tablas automáticamente (synchronize: true)
// - Los datos del menú se cargan desde seed-menu.sql al iniciar Docker
// - pizza_sabores se auto-siembra vía OnModuleInit en PizzaSaboresService
//
// Solo usar este archivo si se necesita poblar una BD de desarrollo sin Docker.

type ProductoSeed = {
	productoNombre: string;
	descripcion: string;
	variantes: { nombre: string; precio: number; descripcion?: string }[];
};

export async function seedProductos() {
	const dataSource = await AppDataSource.initialize();
	const productoRepo = dataSource.getRepository(Productos);
	const varianteRepo = dataSource.getRepository(ProductoVariantes);

	try {
		console.log('🚀 Seeding productos...');

		const productos: ProductoSeed[] = [
			{
				productoNombre: 'Pizza',
				descripcion: 'Elige 1-3 sabores. Tradicionales y Especiales disponibles.',
				variantes: [
					{ nombre: 'Pequeña', precio: 16000 },
					{ nombre: 'Mediana', precio: 30000 },
					{ nombre: 'Grande',  precio: 43000 },
				],
			},
			{
				productoNombre: 'Hamburguesa',
				descripcion: 'Hamburguesa clásica con carne de res',
				variantes: [
					{ nombre: 'Sencilla',    precio: 17000 },
					{ nombre: 'Picosita',    precio: 20000 },
					{ nombre: 'Doble Carne', precio: 22000 },
				],
			},
			{
				productoNombre: 'Chuzo',
				descripcion: 'Incluye: Papitas a la francesa, Arepa con queso, Ensalada',
				variantes: [
					{ nombre: 'Mixto Jamon, Cerdo, Pollo', precio: 27000 },
					{ nombre: 'Pollo Y tocineta',          precio: 27000 },
				],
			},
			{
				productoNombre: 'Pizza Burguer',
				descripcion: 'Pizza en formato hamburguesa',
				variantes: [
					{ nombre: 'Original', precio: 20000 },
					{ nombre: "D'Firu",   precio: 20000 },
					{ nombre: 'Ranchera', precio: 20000 },
					{ nombre: 'Mexicana', precio: 20000 },
					{ nombre: 'Paisa',    precio: 20000 },
				],
			},
			{
				productoNombre: 'Torti Burger',
				descripcion: 'Tortilla con hamburguesa',
				variantes: [{ nombre: 'Unidad', precio: 18000 }],
			},
			{
				productoNombre: 'Calzone',
				descripcion: 'Pizza cerrada estilo calzone',
				variantes: [
					{ nombre: 'De Casa',           precio: 16000 },
					{ nombre: 'Napolitana',         precio: 16000 },
					{ nombre: 'Hawaiana',           precio: 16000 },
					{ nombre: 'Mexicana',           precio: 16000 },
					{ nombre: 'Carnes',             precio: 16000 },
					{ nombre: 'Pollo Tocineta',     precio: 16000 },
					{ nombre: 'Pollo Champiñones',  precio: 16000 },
					{ nombre: 'Pollo Maicitos',     precio: 16000 },
					{ nombre: 'Ranchera',           precio: 16000 },
				],
			},
			{
				productoNombre: 'Adición de Queso',
				descripcion: 'Queso extra para pizza',
				variantes: [
					{ nombre: 'Pequeña', precio:  5000 },
					{ nombre: 'Mediana', precio:  8000 },
					{ nombre: 'Grande',  precio: 12000 },
				],
			},
			{
				productoNombre: 'Combo Papas Hamburguesa',
				descripcion: 'Papas a la francesa para combo con hamburguesa',
				variantes: [{ nombre: 'Unidad', precio: 5000 }],
			},
			{
				productoNombre: 'Jugo',
				descripcion: '',
				variantes: [
					{ nombre: 'AGUA',  precio: 6000 },
					{ nombre: 'AGUA',  precio: 7000 },
					{ nombre: 'LECHE', precio: 8000 },
				],
			},
			{
				productoNombre: 'GASEOSA',
				descripcion: '',
				variantes: [
					{ nombre: 'PERSONAL',         precio:  4000 },
					{ nombre: '1,5L',             precio:  8000 },
					{ nombre: 'MEGA',             precio: 14000 },
					{ nombre: '2,25L',            precio: 10000 },
					{ nombre: 'LITRO DEL VALLE',  precio:  7000 },
				],
			},
			{
				productoNombre: 'pasteles',
				descripcion: '',
				variantes: [{ nombre: 'pasteles dulces', precio: 4000 }],
			},
		];

		for (const prodData of productos) {
			const existing = await productoRepo.findOne({ where: { productoNombre: prodData.productoNombre } });
			if (existing) {
				console.log(`ℹ️  "${prodData.productoNombre}" ya existe, omitiendo.`);
				continue;
			}
			const producto = await productoRepo.save(productoRepo.create({
				productoNombre: prodData.productoNombre,
				descripcion: prodData.descripcion,
			}));
			for (const v of prodData.variantes) {
				await varianteRepo.save(varianteRepo.create({
					productoId: producto.productoId,
					nombre: v.nombre,
					precio: v.precio,
					descripcion: v.descripcion,
				}));
			}
			console.log(`✅ ${prodData.productoNombre}`);
		}

		// Nota: pizza_sabores se auto-siembra en PizzaSaboresService.onModuleInit()
		console.log('✅ Seed de productos completado.');
	} catch (error) {
		console.error('❌ Error:', error);
		throw error;
	} finally {
		await dataSource.destroy();
	}
}

if (require.main === module) {
	seedProductos().catch(() => process.exit(1));
}