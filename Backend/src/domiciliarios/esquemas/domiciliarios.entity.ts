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

	/** Última posición GPS reportada por la app del domiciliario (RiderApp) */
	@Column({name: 'ultima_latitud', type: 'float', nullable: true})
	ultimaLatitud: number;

	@Column({name: 'ultima_longitud', type: 'float', nullable: true})
	ultimaLongitud: number;

	@Column({name: 'ultima_ubicacion_fecha', type: 'timestamptz', nullable: true})
	ultimaUbicacionFecha: Date;

	@OneToOne(() => User, (user) => user.domiciliario)
	@JoinColumn({name: 'user_id'})
	user: User;

	@OneToMany(() => Domicilios, (domicilio) => domicilio.domiciliario)
	domicilios: Domicilios[];
}
