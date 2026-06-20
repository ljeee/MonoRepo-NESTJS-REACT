import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn} from 'typeorm';
import {Clientes} from './clientes.entity';

@Entity('cliente_direcciones')
export class ClienteDirecciones {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({name: 'telefono_cliente', type: 'text'})
	telefonoCliente: string;

	@Column({name: 'direccion', type: 'text'})
	direccion: string;

	@Column({name: 'referencia', type: 'text', nullable: true})
	referencia: string;

	@Column({name: 'costo_domicilio', type: 'numeric', nullable: true})
	costoDomicilio: number;

	@Column({name: 'latitud', type: 'float', nullable: true})
	latitud: number;

	@Column({name: 'longitud', type: 'float', nullable: true})
	longitud: number;

	@ManyToOne(() => Clientes, (cliente) => cliente.direcciones, {onDelete: 'CASCADE'})
	@JoinColumn({name: 'telefono_cliente', referencedColumnName: 'telefono'})
	cliente: Clientes;
}
