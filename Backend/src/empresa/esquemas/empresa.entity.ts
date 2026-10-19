import {Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn} from 'typeorm';

import {ColumnNumericTransformer} from '../../common/utils/numeric.transformer';

@Entity('empresa_config')
export class EmpresaConfig {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({type: 'text'})
	nit: string;

	@Column({name: 'razon_social', type: 'text'})
	razonSocial: string;

	@Column({name: 'nombre_comercial', type: 'text', nullable: true})
	nombreComercial: string;

	@Column({type: 'text', default: 'Régimen Simple'})
	regimen: string;

	@Column({type: 'text', nullable: true})
	direccion: string;

	@Column({type: 'text', nullable: true})
	telefono: string;

	@Column({type: 'text', nullable: true})
	municipio: string;

	@Column({type: 'text', nullable: true})
	departamento: string;

	@Column({name: 'tarifa_iva', type: 'numeric', default: 0, transformer: new ColumnNumericTransformer()})
	tarifaIva: number;

	@Column({name: 'recargo_leche', type: 'numeric', default: 1000, transformer: new ColumnNumericTransformer()})
	recargoLeche: number;

	/**
	 * Control de caja por arqueo. Encendido (por defecto): la caja se cuenta por billetes, el cambio
	 * se desglosa y no se puede sacar más de lo que hay. Apagado (lo decide el admin, p. ej. mientras
	 * el dueño atiende la caja): se cobra y se da cambio sin desglosar y no se valida contra el conteo.
	 */
	@Column({name: 'arqueo_caja', type: 'boolean', default: true})
	arqueoCaja: boolean;

	/**
	 * Momento en que el admin ENCENDIÓ el arqueo (null = nunca se apagó). Un arqueo cuenta como hecho
	 * solo si su conteo es posterior a este momento: al volver a activarlo hay que contar la caja a mano.
	 */
	@Column({name: 'arqueo_desde', type: 'timestamptz', nullable: true})
	arqueoDesde: Date | null;

	/**
	 * Correo(s) del contador, separados por coma: recibe el libro diario de cada cierre (y los que se envíen a mano
	 * desde Contabilidad). `select: false`: GET /empresa es PÚBLICO (ClientWeb) y no debe exponerlo; se lee con
	 * EmpresaService.getCorreoContador().
	 */
	@Column({name: 'correo_contador', type: 'text', nullable: true, select: false})
	correoContador: string | null;

	@UpdateDateColumn({name: 'updated_at'})
	updatedAt: Date;
}
