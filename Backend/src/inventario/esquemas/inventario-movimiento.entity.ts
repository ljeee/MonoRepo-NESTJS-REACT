import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index} from 'typeorm';
import {InventarioItem} from './inventario-item.entity';
import type {TipoMovimiento} from '../inventario.util';

/**
 * Libro de movimientos. Invariante auditable: `cantidad_resultante` = stock anterior + `aplicado`.
 *  - `delta`    = lo pedido (negativo en salidas). Siempre se registra.
 *  - `aplicado` = lo que de verdad se movió tras topar en 0. Si difiere de `delta`,
 *    se vendió sin stock (faltante visible).
 * Las ventas se reconcilian sumando `delta`/`aplicado` de los movimientos de la orden
 * (`venta`/`devolucion`), por eso `orden_id` va indexado (sin FK: la orden puede borrarse).
 */
@Entity('inventario_movimientos')
@Index(['itemId', 'creadoEn'])
export class InventarioMovimiento {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({name: 'item_id', type: 'int'})
	itemId: number;

	@ManyToOne(() => InventarioItem, {onDelete: 'RESTRICT'})
	@JoinColumn({name: 'item_id'})
	item: InventarioItem;

	@Column({type: 'varchar', length: 20})
	tipo: TipoMovimiento;

	@Column({type: 'int'})
	delta: number;

	@Column({type: 'int'})
	aplicado: number;

	@Column({name: 'cantidad_resultante', type: 'int'})
	cantidadResultante: number;

	@Index()
	@Column({name: 'orden_id', type: 'int', nullable: true})
	ordenId: number | null;

	@Column({name: 'usuario_id', type: 'varchar', length: 64, nullable: true})
	usuarioId: string | null;

	@Column({type: 'varchar', length: 255, nullable: true})
	nota: string | null;

	@CreateDateColumn({name: 'creado_en', type: 'timestamptz'})
	creadoEn: Date;
}
