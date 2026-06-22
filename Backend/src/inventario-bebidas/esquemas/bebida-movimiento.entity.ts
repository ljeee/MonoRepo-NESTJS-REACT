import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index} from 'typeorm';

/**
 * Ledger de movimientos de stock de bebidas (gaseosas/jugos), por variante.
 * Espejo de InventarioCajasMovimiento: descuenta al crear la orden, registra el
 * delta solicitado aunque no haya stock (-1 en historial), y permite restaurar al cancelar.
 *
 * Invariante auditable: cantidadResultante = stockAnterior + aplicado.
 *  - `delta`     = lo solicitado (negativo en salida), SIEMPRE se registra.
 *  - `aplicado`  = lo realmente movido tras el clamp a 0 (≤0 en salida, ≥0 en entrada).
 *    Si delta ≠ aplicado, se vendió sin inventario (faltante visible en el historial).
 */
@Entity('bebidas_movimientos')
@Index(['varianteId', 'creadoEn'])
export class BebidaMovimiento {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({type: 'int'})
	varianteId: number;

	@Column({type: 'int'})
	delta: number;

	@Column({type: 'int', default: 0})
	aplicado: number;

	@Column({type: 'int'})
	cantidadResultante: number;

	@Column({type: 'varchar', length: 50, default: 'salida'})
	tipo: string; // 'salida' | 'entrada' | 'ajuste'

	@Column({type: 'varchar', length: 255, nullable: true})
	nota: string | null;

	@CreateDateColumn({type: 'timestamptz'})
	creadoEn: Date;
}
