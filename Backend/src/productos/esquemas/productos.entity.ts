import {Entity, PrimaryGeneratedColumn, Column, OneToMany, Index} from 'typeorm';
import {OrdenesProductos} from '../../ordenes-productos/esquemas/ordenes-productos.entity';
import {ProductoVariantes} from './producto-variantes.entity';

@Entity('productos')
export class Productos {
	@PrimaryGeneratedColumn({name: 'producto_id'})
	productoId: number;

	@Column({name: 'producto_nombre', type: 'text', unique: true})
	@Index()
	productoNombre: string;

	@Column({name: 'descripcion', type: 'text', nullable: true})
	descripcion: string;

	@Column({name: 'activo', type: 'boolean', default: true})
	activo: boolean;

	@Column({name: 'emoji', type: 'text', nullable: true})
	emoji: string;

	/** Tipo de modal de personalización al agregar a una orden:
	 *  'pizza' | 'calzone' | 'jugo' | 'ninguna'. null = sin configurar → fallback por nombre. */
	@Column({name: 'personalizacion', type: 'text', nullable: true})
	personalizacion: string | null;

	@OneToMany(() => OrdenesProductos, (op) => op.productoObj)
	ordenesProductos: OrdenesProductos[];

	@OneToMany(() => ProductoVariantes, (pv) => pv.producto)
	variantes: ProductoVariantes[];
}
