import {Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, Index} from 'typeorm';
import {SaborGrupo} from '../../pizza-sabores/esquemas/sabor-grupo.entity';
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

	/** Tipo de modal de personalización al agregar a una orden. Hoy solo importa 'jugo' (base leche/agua);
	 *  los sabores de pizza/calzone pasaron a `saborGrupoId`. 'pizza'/'calzone' quedan como valores heredados. */
	@Column({name: 'personalizacion', type: 'text', nullable: true})
	personalizacion: string | null;

	/** Categoría para analítica e inventario: ver CATEGORIAS_PRODUCTO (common/utils/catalogo.util).
	 *  null = sin configurar (la migración `productos-categoria-v1` la deriva del nombre). */
	@Column({name: 'categoria', type: 'varchar', length: 20, nullable: true})
	categoria: string | null;

	/**
	 * Grupo de sabores que ofrece el producto (Pizza, Calzone, Hamburguesa…): define cuántos sabores se
	 * piden y cómo se cobran. Null = el producto no lleva sabores.
	 */
	@Column({name: 'sabor_grupo_id', type: 'int', nullable: true})
	saborGrupoId: number | null;

	@ManyToOne(() => SaborGrupo, {nullable: true, onDelete: 'SET NULL'})
	@JoinColumn({name: 'sabor_grupo_id'})
	saborGrupo: SaborGrupo | null;

	@OneToMany(() => OrdenesProductos, (op) => op.productoObj)
	ordenesProductos: OrdenesProductos[];

	@OneToMany(() => ProductoVariantes, (pv) => pv.producto)
	variantes: ProductoVariantes[];
}
