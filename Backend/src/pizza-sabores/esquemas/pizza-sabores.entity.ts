import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('pizza_sabores')
export class PizzaSabor {
	@PrimaryGeneratedColumn({ name: 'sabor_id' })
	saborId: number;

	@Column({ name: 'nombre', type: 'text', unique: true })
	@Index()
	nombre: string;

	/** 'tradicional' | 'especial' */
	@Column({ name: 'tipo', type: 'text', default: 'tradicional' })
	tipo: string;

	/** Recargo adicional para tamaño Pequeña */
	@Column({ name: 'recargo_pequena', type: 'numeric', default: 0 })
	recargoPequena: number;

	/** Recargo adicional para tamaño Mediana */
	@Column({ name: 'recargo_mediana', type: 'numeric', default: 0 })
	recargoMediana: number;

	/** Recargo adicional para tamaño Grande */
	@Column({ name: 'recargo_grande', type: 'numeric', default: 0 })
	recargoGrande: number;

	@Column({ name: 'activo', type: 'boolean', default: true })
	activo: boolean;
}
