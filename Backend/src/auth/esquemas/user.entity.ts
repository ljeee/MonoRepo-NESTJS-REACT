import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
	OneToOne,
} from 'typeorm';
import {Role} from '../roles.enum';
import {Domiciliarios} from '../../domiciliarios/esquemas/domiciliarios.entity';

@Entity({name: 'users'})
export class User {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({unique: true})
	username: string;

	@Column({nullable: true})
	name?: string;

	@Column({select: false})
	passwordHash: string;

	@Column({type: 'text', array: true, default: '{}'})
	roles: Role[];

	@Column({nullable: true, select: false})
	refreshTokenHash?: string;

	@OneToOne(() => Domiciliarios, (domiciliario) => domiciliario.user)
	domiciliario: Domiciliarios;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
