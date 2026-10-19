import {Entity, PrimaryColumn, Column, UpdateDateColumn} from 'typeorm';

export type EstadoMigracionDatos = 'ok' | 'error' | 'en_progreso';

/**
 * Registro de las migraciones de DATOS (backfills, copias entre tablas) que el
 * backend ejecuta al arrancar. El esquema lo maneja `synchronize`; esto cubre lo que
 * synchronize no hace: mover o derivar datos. Una fila por paso.
 */
@Entity('migraciones_datos')
export class MigracionDatos {
	@PrimaryColumn({name: 'id', type: 'varchar', length: 100})
	id: string;

	@Column({name: 'estado', type: 'varchar', length: 20})
	estado: EstadoMigracionDatos;

	/** Momento en que el paso terminó bien (null mientras corre o si falló). */
	@Column({name: 'ejecutada_en', type: 'timestamptz', nullable: true})
	ejecutadaEn: Date | null;

	/** Conteos y detalles del paso (o el error). Se consulta para auditar. */
	@Column({name: 'resultado', type: 'jsonb', nullable: true})
	resultado: Record<string, unknown> | null;

	@UpdateDateColumn({name: 'actualizada_en', type: 'timestamptz'})
	actualizadaEn: Date;
}
