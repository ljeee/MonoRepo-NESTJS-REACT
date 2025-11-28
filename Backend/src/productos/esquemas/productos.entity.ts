import {Entity, PrimaryColumn, Column, OneToMany} from 'typeorm';
import {OrdenesProductos} from '../../ordenes-productos/esquemas/ordenes-productos.entity';

@Entity('productos')
export class Productos {
	@PrimaryColumn({name: 'producto_nombre', type: 'text'})
	productoNombre: string;

	@Column({name: 'precio', type: 'numeric', nullable: true})
	precio: number;

	@OneToMany(() => OrdenesProductos, (op) => op.productoObj)
	ordenesProductos: OrdenesProductos[];
}
