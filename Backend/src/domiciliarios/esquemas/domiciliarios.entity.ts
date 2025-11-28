import {Entity, PrimaryColumn, Column, OneToMany} from 'typeorm';
import {Domicilios} from '../../domicilios/esquemas/domicilios.entity';

@Entity('domiciliarios')
export class Domiciliarios {
	@PrimaryColumn({name: 'telefono', type: 'text'})
	telefono: string;

	@Column({name: 'domiciliario_nombre', type: 'text', nullable: true})
	domiciliarioNombre: string;

	@OneToMany(() => Domicilios, (domicilio) => domicilio.domiciliario)
	domicilios: Domicilios[];
}
