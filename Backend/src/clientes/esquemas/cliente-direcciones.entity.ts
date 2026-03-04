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

	@ManyToOne(() => Clientes, (cliente) => cliente.direcciones, {onDelete: 'CASCADE'})
	@JoinColumn({name: 'telefono_cliente', referencedColumnName: 'telefono'})
	cliente: Clientes;
}
