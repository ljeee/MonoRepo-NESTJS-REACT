import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index} from 'typeorm';
import {Ordenes} from '../../ordenes/esquemas/ordenes.entity';
import {Productos} from '../../productos/esquemas/productos.entity';
import {ProductoVariantes} from '../../productos/esquemas/producto-variantes.entity';
import {ColumnNumericTransformer} from '../../common/utils/numeric.transformer';
import {OrdenProductoSabor} from './orden-producto-sabor.entity';

@Entity('ordenes_productos')
export class OrdenesProductos {
	@PrimaryGeneratedColumn({name: 'id', type: 'bigint'})
	id: number;

	@Index()
	@Column({name: 'orden_id', type: 'integer', nullable: true})
	ordenId: number;

	/** Texto legible de la línea ("Pizza - Grande (Paisa + Carnes)"). Lo usan KDS, recibos y facturas. */
	@Column({name: 'producto', type: 'text', nullable: true})
	producto: string;

	@Column({name: 'cantidad', type: 'numeric', nullable: true, transformer: new ColumnNumericTransformer()})
	cantidad: number;

	@Column({name: 'precio_unitario', type: 'numeric', nullable: true, transformer: new ColumnNumericTransformer()})
	precioUnitario: number | null;

	@Index()
	@Column({name: 'variante_id', type: 'integer', nullable: true})
	varianteId: number | null;

	@Column({name: 'base', type: 'text', nullable: true})
	base: 'leche' | 'agua' | null;

	// ── Detalle estructurado (analítica) ──────────────────────────────────────
	// La columna "productoObjProductoId" ya existía (la generó TypeORM para la relación
	// `productoObj` sin @JoinColumn) pero nunca se escribía. Se mapea con el MISMO nombre
	// y tipo para que synchronize no emita DDL. No renombrar: renombrar = DROP + ADD.
	@Index()
	@Column({name: 'productoObjProductoId', type: 'integer', nullable: true})
	productoId: number | null;

	/**
	 * Snapshot del nombre del producto al vender. NO se llama `productoNombre` a
	 * propósito: KDS, RiderApp y varias pantallas prefieren `productoNombre` sobre
	 * `producto` y perderían el tamaño y los sabores del texto.
	 */
	@Column({name: 'producto_base', type: 'text', nullable: true})
	productoBase: string | null;

	@Column({name: 'variante_nombre', type: 'text', nullable: true})
	varianteNombre: string | null;

	/** Solo pizzas: 'pequena' | 'mediana' | 'grande'. */
	@Column({name: 'tamano', type: 'varchar', length: 20, nullable: true})
	tamano: string | null;

	/** Snapshot de `productos.categoria` al vender. */
	@Column({name: 'categoria', type: 'varchar', length: 20, nullable: true})
	categoria: string | null;

	/** Precio calculado (variante + recargos) antes de cualquier precio manual. */
	@Column({name: 'precio_lista', type: 'numeric', nullable: true, transformer: new ColumnNumericTransformer()})
	precioLista: number | null;

	/** true si el cajero fijó el precio a mano. null = desconocido (histórico). */
	@Column({name: 'precio_manual', type: 'boolean', nullable: true})
	precioManual: boolean | null;

	/** Marca del detalle estructurado: 'v1' (escrito o migrado) | 'v1-error' (no se pudo migrar). null = pendiente de backfill. */
	@Column({name: 'detalle_version', type: 'varchar', length: 20, nullable: true})
	detalleVersion: string | null;

	@ManyToOne(() => Ordenes, (orden) => orden.productos, {onDelete: 'CASCADE'})
	@JoinColumn({name: 'orden_id', referencedColumnName: 'ordenId'})
	orden: Ordenes;

	@ManyToOne(() => Productos, (producto) => producto.ordenesProductos)
	@JoinColumn({name: 'productoObjProductoId'})
	productoObj: Productos;

	@ManyToOne(() => ProductoVariantes, {nullable: true, eager: false})
	@JoinColumn({name: 'variante_id'})
	variante: ProductoVariantes;

	@OneToMany(() => OrdenProductoSabor, (s) => s.ordenProducto)
	saboresDetalle: OrdenProductoSabor[];
}
