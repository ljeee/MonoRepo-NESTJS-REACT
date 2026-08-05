import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn} from 'typeorm';

@Entity('cuentas_transferencia')
export class CuentaTransferencia {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({type: 'text'})
	nombre: string;

	@Column({type: 'boolean', default: true})
	activa: boolean;

	@CreateDateColumn({name: 'created_at'})
	createdAt: Date;
}
