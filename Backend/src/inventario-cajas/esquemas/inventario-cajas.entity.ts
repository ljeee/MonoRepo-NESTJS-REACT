import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('inventario_cajas')
export class InventarioCajas {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: 'int', default: 0 })
	cantidad: number;

	@Column({ type: 'int', nullable: true })
	alertaMinimo: number | null;

	@CreateDateColumn({ type: 'timestamptz' })
	actualizadoEn: Date;
}

@Entity('inventario_cajas_movimientos')
export class InventarioCajasMovimiento {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: 'int' })
	delta: number;

	@Column({ type: 'int' })
	cantidadResultante: number;

	@Column({ type: 'varchar', length: 50, default: 'ajuste' })
	tipo: string; // 'entrada' | 'salida' | 'ajuste'

	@Column({ type: 'varchar', length: 255, nullable: true })
	nota: string | null;

	@CreateDateColumn({ type: 'timestamptz' })
	creadoEn: Date;
}
