import {Entity, PrimaryGeneratedColumn, Column, OneToMany, Index} from 'typeorm';
import {OrdenesProductos} from '../../ordenes-productos/esquemas/ordenes-productos.entity';
import {ProductoVariantes} from './producto-variantes.entity';

@Entity('productos')
export class Productos {
	@PrimaryGeneratedColumn()
	productoId: number;

	@Column({name: 'producto_nombre', type: 'text', unique: true})
	@Index()
	productoNombre: string;

	@Column({name: 'categoria', type: 'text', default: 'Otros'})
	@Index()
	categoria: string;

	@Column({name: 'descripcion', type: 'text', nullable: true})
	descripcion: string;

	@Column({name: 'activo', type: 'boolean', default: true})
	activo: boolean;

	@OneToMany(() => OrdenesProductos, (op) => op.productoObj)
	ordenesProductos: OrdenesProductos[];

	@OneToMany(() => ProductoVariantes, (pv) => pv.producto)
	variantes: ProductoVariantes[];
}
