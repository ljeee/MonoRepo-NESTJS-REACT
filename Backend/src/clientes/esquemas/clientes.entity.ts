import {Entity, PrimaryColumn, Column, OneToMany} from 'typeorm';
import {Domicilios} from '../../domicilios/esquemas/domicilios.entity';

@Entity('clientes')
export class Clientes {
	@PrimaryColumn({name: 'telefono', type: 'text'})
	telefono: string;

	@Column({name: 'direccion_dos', type: 'text', nullable: true})
	direccionDos: string;

	@Column({name: 'direccion', type: 'text', nullable: true})
	direccion: string;

	@Column({name: 'cliente_nombre', type: 'text', nullable: true})
	clienteNombre: string;

	@Column({name: 'direccion_tres', type: 'text', nullable: true})
	direccionTres: string;

	@OneToMany(() => Domicilios, (domicilio) => domicilio.cliente)
	domicilios: Domicilios[];
}
