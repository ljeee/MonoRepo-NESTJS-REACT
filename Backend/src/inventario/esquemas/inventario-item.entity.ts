import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index} from 'typeorm';
import type {TipoItemInventario} from '../inventario.util';

/**
 * Cualquier cosa que lleva stock: cajas de empaque y bebidas embotelladas. Reemplaza a
 * `inventario_cajas` y al `stock_bebida` de las variantes (esas tablas/columnas quedan
 * intactas como respaldo). Los ítems se desactivan, nunca se borran: los movimientos
 * los referencian.
 */
@Entity('inventario_items')
@Index(['tipo', 'activo'])
export class InventarioItem {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({type: 'varchar', length: 20})
	tipo: TipoItemInventario;

	@Column({type: 'varchar', length: 150})
	nombre: string;

	/** Caja: pequena|mediana|grande|calzone|otra. Bebida: gaseosa|agua|cerveza|otra (jugo solo en inactivos migrados). */
	@Column({type: 'varchar', length: 30, nullable: true})
	categoria: string | null;

	/** Nunca negativa: lo vendido sin stock queda como faltante en el movimiento (delta ≠ aplicado). */
	@Column({type: 'int', default: 0})
	cantidad: number;

	@Column({name: 'alerta_minimo', type: 'int', nullable: true})
	alertaMinimo: number | null;

	/** Nivel "lleno" del medidor de la UI. */
	@Column({name: 'nivel_objetivo', type: 'int', nullable: true})
	nivelObjetivo: number | null;

	@Column({type: 'boolean', default: true})
	activo: boolean;

	/** De dónde vino en la migración ('caja:12', 'variante:45'). Único: hace la migración idempotente. */
	@Column({type: 'varchar', length: 50, nullable: true, unique: true})
	origen: string | null;

	@CreateDateColumn({name: 'creado_en', type: 'timestamptz'})
	creadoEn: Date;

	@UpdateDateColumn({name: 'actualizado_en', type: 'timestamptz'})
	actualizadoEn: Date;
}
