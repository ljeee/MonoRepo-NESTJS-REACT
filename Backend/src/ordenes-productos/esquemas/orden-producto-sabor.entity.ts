import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index} from 'typeorm';
import {OrdenesProductos} from './ordenes-productos.entity';
import {PizzaSabor} from '../../pizza-sabores/esquemas/pizza-sabores.entity';
import {ColumnNumericTransformer} from '../../common/utils/numeric.transformer';

/**
 * Sabores de una línea de venta (pizza o calzone), uno por fila. Permite contar
 * "sabor más vendido" y filtrarlo por tamaño sin parsear el texto de la línea.
 */
@Entity('ordenes_productos_sabores')
export class OrdenProductoSabor {
	// bigint: pg lo devuelve como string → compararlo siempre como string.
	@PrimaryGeneratedColumn({name: 'id', type: 'bigint'})
	id: string;

	@Index()
	@Column({name: 'orden_producto_id', type: 'bigint'})
	ordenProductoId: string;

	@ManyToOne(() => OrdenesProductos, (op) => op.saboresDetalle, {onDelete: 'CASCADE'})
	@JoinColumn({name: 'orden_producto_id'})
	ordenProducto: OrdenesProductos;

	/** null = sabor no reconocido en el catálogo ("sin clasificar") o sabor ya borrado. */
	@Index()
	@Column({name: 'sabor_id', type: 'integer', nullable: true})
	saborId: number | null;

	@ManyToOne(() => PizzaSabor, {nullable: true, onDelete: 'SET NULL'})
	@JoinColumn({name: 'sabor_id'})
	sabor: PizzaSabor | null;

	/** Snapshot del nombre (sobrevive si el sabor se renombra o borra). */
	@Column({name: 'sabor_nombre', type: 'text'})
	saborNombre: string;

	@Column({name: 'posicion', type: 'smallint'})
	posicion: number;

	/** 1/n de la pizza (mitad y mitad = 0.5). */
	@Column({name: 'fraccion', type: 'numeric', precision: 6, scale: 4, transformer: new ColumnNumericTransformer()})
	fraccion: number;
}
