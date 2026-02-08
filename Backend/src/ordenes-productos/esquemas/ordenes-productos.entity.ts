import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn} from 'typeorm';
import {Ordenes} from '../../ordenes/esquemas/ordenes.entity';
import {Productos} from '../../productos/esquemas/productos.entity';
import {ProductoVariantes} from '../../productos/esquemas/producto-variantes.entity';

@Entity('ordenes_productos')
export class OrdenesProductos {
	@PrimaryGeneratedColumn({name: 'id', type: 'bigint'})
	id: number;

	@Column({name: 'orden_id', type: 'integer', nullable: true})
	ordenId: number;

	@Column({name: 'producto', type: 'text', nullable: true})
	producto: string;

	@Column({name: 'cantidad', type: 'numeric', nullable: true})
	cantidad: number;

	@Column({name: 'precio_unitario', type: 'numeric', nullable: true})
	precioUnitario: number | null;

	@Column({name: 'variante_id', type: 'integer', nullable: true})
	varianteId: number | null;

	@ManyToOne(() => Ordenes, (orden) => orden.productos)
	@JoinColumn({name: 'orden_id', referencedColumnName: 'ordenId'})
	orden: Ordenes;

	@ManyToOne(() => Productos, (producto) => producto.ordenesProductos)
	productoObj: Productos;

	@ManyToOne(() => ProductoVariantes, {nullable: true, eager: false})
	@JoinColumn({name: 'variante_id'})
	variante: ProductoVariantes;
}
