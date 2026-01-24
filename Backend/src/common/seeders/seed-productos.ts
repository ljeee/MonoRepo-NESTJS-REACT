import 'reflect-metadata';
import {DataSource} from 'typeorm';
import {AppDataSource} from '../../data-source';
// Assuming Producto and Variante entities exist
import {Productos} from '../../productos/esquemas/productos.entity';
import {ProductoVariantes} from '../../productos/esquemas/producto-variantes.entity';

type ProductoSeed = {
	productoNombre: string;
	categoria: string;
	descripcion: string;
	variantes: {
		nombre: string;
		precio: number;
		descripcion?: string;
	}[];
};

export async function seedProductos() {
	const dataSource = await AppDataSource.initialize();
	const productoRepository = dataSource.getRepository(Productos);
	const varianteRepository = dataSource.getRepository(ProductoVariantes);

	try {
		console.log('🚀 Seeding productos...');

		const productos: ProductoSeed[] = [
			{
				productoNombre: 'Pizza Paisa',
				categoria: 'Pizzas',
				descripcion: 'Pizza con carnes y salsas colombianas',
				variantes: [
					{nombre: 'Pequeña', precio: 15000, descripcion: 'Pizza pequeña'},
					{nombre: 'Mediana', precio: 28000, descripcion: 'Pizza mediana'},
					{nombre: 'Grande', precio: 40000, descripcion: 'Pizza grande'},
				],
			},
			{
				productoNombre: 'Pizza Hawaiana',
				categoria: 'Pizzas',
				descripcion: 'Pizza con piña y jamón',
				variantes: [
					{nombre: 'Pequeña', precio: 15000, descripcion: 'Pizza pequeña'},
					{nombre: 'Mediana', precio: 28000, descripcion: 'Pizza mediana'},
					{nombre: 'Grande', precio: 40000, descripcion: 'Pizza grande'},
				],
			},
			{
				productoNombre: 'Pizza Vegetariana',
				categoria: 'Pizzas',
				descripcion: 'Pizza con verduras frescas',
				variantes: [
					{nombre: 'Pequeña', precio: 14000, descripcion: 'Pizza pequeña'},
					{nombre: 'Mediana', precio: 26000, descripcion: 'Pizza mediana'},
					{nombre: 'Grande', precio: 38000, descripcion: 'Pizza grande'},
				],
			},
			{
				productoNombre: 'Coca-Cola',
				categoria: 'Bebidas',
				descripcion: 'Refresco Coca-Cola',
				variantes: [
					{nombre: 'Pequeña (250ml)', precio: 2500},
					{nombre: 'Mediana (400ml)', precio: 3500},
					{nombre: 'Grande (600ml)', precio: 5000},
				],
			},
			{
				productoNombre: 'Sprite',
				categoria: 'Bebidas',
				descripcion: 'Refresco Sprite',
				variantes: [
					{nombre: 'Pequeña (250ml)', precio: 2500},
					{nombre: 'Mediana (400ml)', precio: 3500},
					{nombre: 'Grande (600ml)', precio: 5000},
				],
			},
			{
				productoNombre: 'Jugo Natural',
				categoria: 'Bebidas',
				descripcion: 'Jugo de frutas frescas',
				variantes: [
					{nombre: 'Vaso (300ml)', precio: 4000},
					{nombre: 'Jarra (1L)', precio: 10000},
				],
			},
			{
				productoNombre: 'Alitas de Pollo',
				categoria: 'Extras',
				descripcion: 'Alitas de pollo crujientes',
				variantes: [
					{nombre: '6 Alitas', precio: 12000},
					{nombre: '12 Alitas', precio: 22000},
					{nombre: '18 Alitas', precio: 30000},
				],
			},
			{
				productoNombre: 'Papas Fritas',
				categoria: 'Extras',
				descripcion: 'Papas fritas crujientes',
				variantes: [
					{nombre: 'Pequeña', precio: 4000},
					{nombre: 'Mediana', precio: 6000},
					{nombre: 'Grande', precio: 8000},
				],
			},
			{
				productoNombre: 'Hamburguesa',
				categoria: 'Hamburguesas',
				descripcion: 'Hamburguesa clásica con carne de res',
				variantes: [
					{nombre: 'Sencilla', precio: 8000},
					{nombre: 'Doble', precio: 13000},
					{nombre: 'Triple', precio: 18000},
				],
			},
		];

		for (const prodData of productos) {
			const existing = await productoRepository.findOne({where: {productoNombre: prodData.productoNombre}});
			if (existing) {
				console.log(`ℹ️  Producto ${prodData.productoNombre} already exists, skipping.`);
				continue;
			}

			const producto = productoRepository.create({
				productoNombre: prodData.productoNombre,
				categoria: prodData.categoria,
				descripcion: prodData.descripcion,
			});
			const savedProducto = await productoRepository.save(producto);

			for (const varData of prodData.variantes) {
				const variante = varianteRepository.create({
					productoId: savedProducto.productoId,
					nombre: varData.nombre,
					precio: varData.precio,
					descripcion: varData.descripcion,
				});
				await varianteRepository.save(variante);
			}

			console.log(`✅ Producto created: ${prodData.productoNombre}`);
		}

		console.log('✅ Productos seeded successfully!');
	} catch (error) {
		console.error('❌ Error seeding productos:', error);
		throw error;
	} finally {
		await dataSource.destroy();
	}
}

// If run directly
if (require.main === module) {
	seedProductos().catch(() => process.exit(1));
}