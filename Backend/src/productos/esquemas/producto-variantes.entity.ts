import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index} from 'typeorm';
import {Productos} from './productos.entity';
import {ColumnNumericTransformer} from '../../common/utils/numeric.transformer';

@Entity('producto_variantes')
export class ProductoVariantes {
	@PrimaryGeneratedColumn({name: 'variante_id'})
	varianteId: number;

	@Column({name: 'producto_id', type: 'integer'})
	productoId: number;

	@Column({name: 'nombre', type: 'text'})
	@Index()
	nombre: string;

	@Column({name: 'precio', type: 'numeric', transformer: new ColumnNumericTransformer()})
	precio: number;

	@Column({name: 'descripcion', type: 'text', nullable: true})
	descripcion: string;

	@Column({name: 'precio_leche', type: 'numeric', nullable: true, transformer: new ColumnNumericTransformer()})
	precioLeche: number | null;

	@Column({name: 'stock_bebida', type: 'integer', default: 0})
	stockBebida: number;

	@Column({name: 'activo', type: 'boolean', default: true})
	activo: boolean;

	@ManyToOne(() => Productos, (p) => p.variantes, {onDelete: 'CASCADE'})
	@JoinColumn({name: 'producto_id'})
	producto: Productos;
}
