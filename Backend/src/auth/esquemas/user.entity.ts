import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import {Role} from '../roles.enum';

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

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
