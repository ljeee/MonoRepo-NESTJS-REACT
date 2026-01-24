import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index} from 'typeorm';
import {Productos} from './productos.entity';

@Entity('producto_variantes')
export class ProductoVariantes {
	@PrimaryGeneratedColumn()
	varianteId: number;

	@Column({name: 'producto_id', type: 'integer'})
	productoId: number;

	@Column({name: 'nombre', type: 'text'})
	@Index()
	nombre: string;

	@Column({name: 'precio', type: 'numeric'})
	precio: number;

	@Column({name: 'descripcion', type: 'text', nullable: true})
	descripcion: string;

	@Column({name: 'activo', type: 'boolean', default: true})
	activo: boolean;

	@ManyToOne(() => Productos, (p) => p.variantes, {onDelete: 'CASCADE'})
	@JoinColumn({name: 'producto_id'})
	producto: Productos;
}
