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

	/**
	 * Tamaño explícito (pequena | mediana | grande) para productos con tamaños. Null = se deduce del nombre
	 * ("Pequeña", "Personal", "Mediana", "Grande"); sin tamaño reconocible cuenta como grande.
	 */
	@Column({name: 'tamano', type: 'varchar', length: 20, nullable: true})
	tamano: string | null;

	@Column({name: 'precio_leche', type: 'numeric', nullable: true, transformer: new ColumnNumericTransformer()})
	precioLeche: number | null;

	/**
	 * @deprecated Inventario unificado (`inventario_items`). Se mantiene mapeada para que
	 * synchronize no borre la columna (respaldo de la migración `inventario-unificado-v1`);
	 * se quita en la limpieza final (Fase 7) junto con las otras `*_bebida`.
	 */
	@Column({name: 'stock_bebida', type: 'integer', default: 0})
	stockBebida: number;

	// ── @deprecated: configuración del inventario de bebidas anterior (ver stock_bebida) ──
	// Categoría para agrupar en la pantalla de inventario ('gaseosa' | 'jugo' |
	// 'cerveza' | 'agua' | 'otra'). Cuando es null, la variante NO se rastrea
	// como bebida salvo que el nombre del producto contenga "gaseosa"/"jugo"
	// (compatibilidad con el comportamiento anterior).
	@Column({name: 'categoria_bebida', type: 'varchar', length: 30, nullable: true})
	categoriaBebida: string | null;

	// Umbral de alerta de stock bajo para esta variante de bebida.
	@Column({name: 'alerta_bebida', type: 'integer', nullable: true})
	alertaBebida: number | null;

	// Nivel objetivo (barra "llena") para el medidor de la UI, análogo al de cajas.
	@Column({name: 'nivel_objetivo_bebida', type: 'integer', nullable: true})
	nivelObjetivoBebida: number | null;

	@Column({name: 'activo', type: 'boolean', default: true})
	activo: boolean;

	@ManyToOne(() => Productos, (p) => p.variantes, {onDelete: 'CASCADE'})
	@JoinColumn({name: 'producto_id'})
	producto: Productos;
}
