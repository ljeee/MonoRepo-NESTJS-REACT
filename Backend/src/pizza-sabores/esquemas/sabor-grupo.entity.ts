import {Entity, PrimaryGeneratedColumn, Column} from 'typeorm';
import {ColumnNumericTransformer} from '../../common/utils/numeric.transformer';

/**
 * Grupo de sabores: el conjunto de sabores que ofrece un producto (Pizza, Calzone, Hamburguesa…) y las
 * reglas de cómo se piden y se cobran. Un producto nuevo con sabores se configura asignándole un grupo
 * (o creando uno), sin tocar código. Los recargos por tamaño de cada sabor viven en el sabor
 * (`pizza_sabores.recargo_*`: 0 = no cobra); aquí solo el recargo por pedir varios sabores.
 */
@Entity('sabor_grupos')
export class SaborGrupo {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({type: 'varchar', length: 60, unique: true})
	nombre: string;

	/** Tope de sabores por unidad (pizza 3, calzone 2). */
	@Column({name: 'max_sabores', type: 'int', default: 3})
	maxSabores: number;

	/** Las variantes del producto SON los sabores (calzone): no se suma "- variante" al texto de la línea. */
	@Column({name: 'variante_es_sabor', type: 'boolean', default: false})
	varianteEsSabor: boolean;

	/** El producto tiene tamaños (pequeña/mediana/grande): se usan los recargos por tamaño y se registra el tamaño. */
	@Column({name: 'usa_tamano', type: 'boolean', default: false})
	usaTamano: boolean;

	/** Desde cuántos sabores se cobra el recargo extra (pizza: 3). Null = nunca. */
	@Column({name: 'recargo_extra_desde', type: 'int', nullable: true})
	recargoExtraDesde: number | null;

	@Column({name: 'recargo_extra_pequena', type: 'numeric', default: 0, transformer: new ColumnNumericTransformer()})
	recargoExtraPequena: number;

	@Column({name: 'recargo_extra_mediana', type: 'numeric', default: 0, transformer: new ColumnNumericTransformer()})
	recargoExtraMediana: number;

	@Column({name: 'recargo_extra_grande', type: 'numeric', default: 0, transformer: new ColumnNumericTransformer()})
	recargoExtraGrande: number;

	@Column({type: 'boolean', default: true})
	activo: boolean;

	@Column({type: 'int', default: 0})
	orden: number;
}
