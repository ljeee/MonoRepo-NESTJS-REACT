import {Entity, PrimaryColumn, Column, OneToMany, OneToOne, JoinColumn} from 'typeorm';
import {Domicilios} from '../../domicilios/esquemas/domicilios.entity';
import {User} from '../../auth/esquemas/user.entity';

@Entity('domiciliarios')
export class Domiciliarios {
	@PrimaryColumn({name: 'telefono', type: 'text'})
	telefono: string;

	@Column({name: 'domiciliario_nombre', type: 'text', nullable: true})
	domiciliarioNombre: string;

	@Column({name: 'user_id', type: 'uuid', nullable: true, unique: true})
	userId: string;

	@OneToOne(() => User, (user) => user.domiciliario)
	@JoinColumn({name: 'user_id'})
	user: User;

	@OneToMany(() => Domicilios, (domicilio) => domicilio.domiciliario)
	domicilios: Domicilios[];
}
