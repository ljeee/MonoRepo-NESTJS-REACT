import 'reflect-metadata';
import 'dotenv/config'; // toma DATABASE_* de Backend/.env (no pisa lo que ya venga en el entorno)
import {AppDataSource} from '../../data-source';
import {Productos} from '../../productos/esquemas/productos.entity';
import {ProductoVariantes} from '../../productos/esquemas/producto-variantes.entity';
import {SaborGrupo} from '../../pizza-sabores/esquemas/sabor-grupo.entity';
import {PizzaSabor} from '../../pizza-sabores/esquemas/pizza-sabores.entity';
import {GRUPOS_BASE, GRUPO_CALZONE, GRUPO_PIZZA} from '../../pizza-sabores/grupos-base';

// Este seeder ya no es necesario en producción/Docker:
// - TypeORM crea las tablas automáticamente (synchronize: true)
// - Los datos del menú se cargan desde seed-menu.sql al iniciar Docker
// - los grupos de sabores y los sabores de pizza se auto-siembran vía OnModuleInit en PizzaSaboresService
//
// Solo usar este archivo si se necesita poblar una BD de desarrollo sin Docker.

type ProductoSeed = {
	productoNombre: string;
	descripcion: string;
	/** Grupo de sabores que ofrece el producto (nombre del grupo). Sin él, no lleva sabores. */
	grupo?: string;
	variantes: {nombre: string; precio: number; descripcion?: string}[];
};

// Variantes del calzone que no son un sabor (se pide "dos sabores" o por unidad).
const VARIANTES_CALZONE_NO_SABOR = /^(unidad|calzone de dos sabores)$/i;

export async function seedProductos() {
	const dataSource = await AppDataSource.initialize();
	const productoRepo = dataSource.getRepository(Productos);
	const varianteRepo = dataSource.getRepository(ProductoVariantes);
	const grupoRepo = dataSource.getRepository(SaborGrupo);
	const saborRepo = dataSource.getRepository(PizzaSabor);

	try {
		console.log('🚀 Seeding productos...');

		// Los grupos los crea normalmente PizzaSaboresService al arrancar el backend; aquí se aseguran
		// por si el seeder corre antes.
		const grupos = new Map<string, SaborGrupo>();
		for (const base of GRUPOS_BASE) {
			const grupo = (await grupoRepo.findOne({where: {nombre: base.nombre}})) ?? (await grupoRepo.save(grupoRepo.create(base)));
			grupos.set(grupo.nombre, grupo);
		}

		const productos: ProductoSeed[] = [
			{
				productoNombre: 'ADICIÓNES',
				descripcion: '',
				variantes: [],
			},
			{
				productoNombre: 'Adición de Queso',
				descripcion: 'Queso extra para pizza',
				variantes: [
					{nombre: 'Grande', precio: 12000},
					{nombre: 'Mediana', precio: 8000},
					{nombre: 'Pequeña', precio: 5000},
				],
			},
			{
				productoNombre: 'BEBIDAS',
				descripcion: '',
				variantes: [{nombre: 'MILO', precio: 9000}],
			},
			{
				productoNombre: 'CALZONE DE DOS SABORES',
				descripcion: '',
				variantes: [{nombre: 'CALZONE DOS SABORES', precio: 25000}],
			},
			{
				productoNombre: 'Calzone',
				grupo: GRUPO_CALZONE.nombre,
				descripcion: 'Pizza cerrada estilo calzone',
				variantes: [
					{nombre: 'Carnes', precio: 25000},
					{nombre: 'De Casa', precio: 25000},
					{nombre: 'Hawaiana', precio: 25000},
					{nombre: 'Mexicana', precio: 25000},
					{nombre: 'Napolitana', precio: 25000},
					{nombre: 'Pollo Champiñones', precio: 25000},
					{nombre: 'Pollo Maicitos', precio: 25000},
					{nombre: 'Pollo Tocineta', precio: 25000},
					{nombre: 'Ranchera', precio: 25000},
					{nombre: 'UNIDAD', precio: 25000},
					{nombre: 'calzone de dos sabores', precio: 25000},
				],
			},
			{
				productoNombre: 'Chuzo',
				descripcion: 'Incluye: Papitas a la francesa, Arepa con queso, Ensalada',
				variantes: [
					{nombre: 'Mixto Jamon, Cerdo, Pollo', precio: 28000},
					{nombre: 'Pollo Y tocineta', precio: 28000},
				],
			},
			{
				productoNombre: 'GASEOSA',
				descripcion: '',
				variantes: [
					{nombre: '1,5L', precio: 8000},
					{nombre: '2,25L', precio: 10000},
					{nombre: 'AGUA', precio: 4000},
					{nombre: 'AGUA GAS', precio: 4000},
					{nombre: 'AGUA LIMON', precio: 4000},
					{nombre: 'COLA Y POLA', precio: 4000},
					{nombre: 'Coca Cola 1.5L', precio: 8000},
					{nombre: 'Coca Cola Personal', precio: 4000},
					{nombre: 'Coca cola 2.25L', precio: 10000},
					{nombre: 'Ginger Personal', precio: 4000},
					{nombre: 'LITRO DEL VALLE', precio: 7000},
					{nombre: 'MEGA', precio: 14000},
					{nombre: 'PERSONAL', precio: 4000},
					{nombre: 'PREMIO 1.5L', precio: 8000},
					{nombre: 'PREMIO PERSONAL', precio: 4000},
					{nombre: 'QUATRO 1.5L', precio: 8000},
					{nombre: 'QUATRO PERSONAL', precio: 4000},
					{nombre: 'SODA 1.5L', precio: 10000},
					{nombre: 'SODA PERSONAL', precio: 4000},
					{nombre: 'SPRITE 1.5L', precio: 8000},
					{nombre: 'Sprite Personal', precio: 4000},
					{nombre: 'Té Durazno', precio: 4000},
					{nombre: 'Té limón', precio: 4000},
				],
			},
			{
				productoNombre: 'Hamburguesa',
				descripcion: 'Hamburguesa clásica con carne de res',
				variantes: [
					{nombre: 'Doble Carne', precio: 22000},
					{nombre: 'Picosita', precio: 20000},
					{nombre: 'Sencilla', precio: 17000},
				],
			},
			{
				productoNombre: 'Jugo',
				descripcion: '',
				variantes: [
					{nombre: 'AGUA', precio: 7000},
					{nombre: 'AGUA', precio: 6000},
					{nombre: 'LECHE', precio: 8000},
					{nombre: 'LECHE MARACUYA O GUANABANA', precio: 9000},
				],
			},
			{
				productoNombre: 'KEBAB',
				descripcion: '',
				variantes: [{nombre: 'KEBAB', precio: 17000}],
			},
			{
				productoNombre: 'LASAGÑA',
				descripcion: '',
				variantes: [
					{nombre: 'LASAGÑA  CARNE', precio: 28000},
					{nombre: 'LASAGÑA DE POLLO', precio: 28000},
					{nombre: 'LASAGÑA MIXTA', precio: 28000},
				],
			},
			{
				productoNombre: 'LIMONADAS',
				descripcion: '',
				variantes: [
					{nombre: 'LIMONADA CEREZA', precio: 10000},
					{nombre: 'LIMONADA DE COCO', precio: 10000},
				],
			},
			{
				productoNombre: 'PAPAS ENCAJADAS',
				descripcion: '',
				variantes: [
					{nombre: 'ENCAJADAS MEXICANAS', precio: 28000},
					{nombre: 'ENCAJADAS PAISA', precio: 28000},
					{nombre: 'ENCAJADAS RANCHERA', precio: 28000},
				],
			},
			{
				productoNombre: 'PORCION DE PAPAS',
				descripcion: '',
				variantes: [{nombre: 'Unidad', precio: 5000}],
			},
			{
				productoNombre: 'Pizza',
				grupo: GRUPO_PIZZA.nombre,
				descripcion: 'Elige 1-3 sabores.',
				variantes: [
					{nombre: 'Grande', precio: 45000},
					{nombre: 'Mediana', precio: 32000},
					{nombre: 'Pequeña', precio: 17000},
				],
			},
			{
				productoNombre: 'Pizza Burguer',
				descripcion: 'Pizza en formato hamburguesa',
				variantes: [
					{nombre: "D'Firu", precio: 20000},
					{nombre: 'Mexicana', precio: 20000},
					{nombre: 'Original', precio: 20000},
					{nombre: 'Paisa', precio: 20000},
					{nombre: 'Ranchera', precio: 20000},
				],
			},
			{
				productoNombre: 'SALCHIPAPAS',
				descripcion: '',
				variantes: [{nombre: 'SALCHIPAPAS', precio: 7000}],
			},
			{
				productoNombre: 'Torti Burger',
				descripcion: 'Tortilla con hamburguesa',
				variantes: [{nombre: 'Unidad', precio: 18000}],
			},
			{
				productoNombre: 'pasteles',
				descripcion: '',
				variantes: [
					{nombre: 'PASTELES POR MAYOR', precio: 2500},
					{nombre: 'PASTELES POR MAYOR', precio: 2800},
					{nombre: 'PASTELES POR MAYOR', precio: 3000},
					{nombre: 'pasteles dulces', precio: 4000},
				],
			},
		];

		for (const prodData of productos) {
			const existing = await productoRepo.findOne({where: {productoNombre: prodData.productoNombre}});
			if (existing) {
				console.log(`ℹ️  "${prodData.productoNombre}" ya existe, omitiendo.`);
				continue;
			}
			const producto = await productoRepo.save(
				productoRepo.create({
					productoNombre: prodData.productoNombre,
					descripcion: prodData.descripcion,
					saborGrupoId: prodData.grupo ? (grupos.get(prodData.grupo)?.id ?? null) : null,
				}),
			);
			// Las variantes del calzone SON sus sabores: se crean en el grupo si todavía no tiene ninguno.
			if (prodData.grupo === GRUPO_CALZONE.nombre) {
				const calzone = grupos.get(GRUPO_CALZONE.nombre);
				if (calzone && (await saborRepo.count({where: {grupoId: calzone.id}})) === 0) {
					await saborRepo.save(
						prodData.variantes
							.filter((v) => !VARIANTES_CALZONE_NO_SABOR.test(v.nombre))
							.map((v) => saborRepo.create({nombre: v.nombre, grupoId: calzone.id, activo: true})),
					);
				}
			}
			for (const v of prodData.variantes) {
				await varianteRepo.save(
					varianteRepo.create({
						productoId: producto.productoId,
						nombre: v.nombre,
						precio: v.precio,
						descripcion: v.descripcion,
					}),
				);
			}
			console.log(`✅ ${prodData.productoNombre}`);
		}

		// Nota: los sabores de pizza se auto-siembran en PizzaSaboresService.onModuleInit()
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
