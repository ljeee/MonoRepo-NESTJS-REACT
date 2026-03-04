import {Entity, PrimaryColumn, Column, OneToMany} from 'typeorm';
import {Domicilios} from '../../domicilios/esquemas/domicilios.entity';
import {ClienteDirecciones} from './cliente-direcciones.entity';

@Entity('clientes')
export class Clientes {
	@PrimaryColumn({name: 'telefono', type: 'text'})
	telefono: string;

	@Column({name: 'cliente_nombre', type: 'text', nullable: true})
	clienteNombre: string;

	@Column({name: 'tipo_documento', type: 'text', nullable: true})
	tipoDocumento: string;

	@Column({name: 'documento', type: 'text', nullable: true})
	documento: string;

	@Column({name: 'correo', type: 'text', nullable: true})
	correo: string;

	@OneToMany(() => ClienteDirecciones, (dir) => dir.cliente, {cascade: true, eager: true})
	direcciones: ClienteDirecciones[];

	@OneToMany(() => Domicilios, (domicilio) => domicilio.cliente)
	domicilios: Domicilios[];
}
