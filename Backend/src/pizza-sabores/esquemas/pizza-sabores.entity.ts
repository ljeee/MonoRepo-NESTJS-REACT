import {Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn} from 'typeorm';
import {SaborGrupo} from './sabor-grupo.entity';

/**
 * Sabor de un grupo (ver `SaborGrupo`). Mantiene su nombre histórico de tabla (`pizza_sabores`)
 * aunque ya no es solo de pizza. El recargo por tamaño es del propio sabor: 0 = no cobra.
 */
@Index(['grupoId', 'nombre'], {unique: true})
@Entity('pizza_sabores')
export class PizzaSabor {
	@PrimaryGeneratedColumn({name: 'sabor_id'})
	saborId: number;

	@Column({name: 'nombre', type: 'text'})
	@Index()
	nombre: string;

	/**
	 * @deprecated La carta ya no distingue tradicional/especial: el recargo vive en cada sabor y el grupo
	 * al que pertenece en `grupoId`. Se conserva mapeada (synchronize borraría la columna) y la migración
	 * `sabor-grupos-v1` la lee una vez para asignar el grupo; nada más la usa.
	 */
	@Column({name: 'tipo', type: 'text', default: 'tradicional'})
	tipo: string;

	/** Grupo al que pertenece. Null solo en filas heredadas sin clasificar (p. ej. la fila de configuración vieja). */
	@Column({name: 'grupo_id', type: 'int', nullable: true})
	grupoId: number | null;

	@ManyToOne(() => SaborGrupo, {nullable: true, onDelete: 'SET NULL'})
	@JoinColumn({name: 'grupo_id'})
	grupo: SaborGrupo | null;

	/** Recargo adicional para tamaño Pequeña */
	@Column({name: 'recargo_pequena', type: 'numeric', default: 0})
	recargoPequena: number;

	/** Recargo adicional para tamaño Mediana */
	@Column({name: 'recargo_mediana', type: 'numeric', default: 0})
	recargoMediana: number;

	/** Recargo adicional para tamaño Grande */
	@Column({name: 'recargo_grande', type: 'numeric', default: 0})
	recargoGrande: number;

	@Column({name: 'activo', type: 'boolean', default: true})
	activo: boolean;
}
