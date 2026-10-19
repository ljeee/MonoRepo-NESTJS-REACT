import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, Unique} from 'typeorm';
import {InventarioItem} from './inventario-item.entity';
import {ProductoVariantes} from '../../productos/esquemas/producto-variantes.entity';

/**
 * Regla de consumo: vender 1 de la variante descuenta `cantidad` del ítem. Reemplaza la
 * adivinanza por texto ("contiene 'grande'" → caja grande) por una relación explícita
 * que el admin puede revisar.
 */
@Entity('inventario_consumos')
@Unique('UQ_inventario_consumo_variante_item', ['varianteId', 'itemId'])
export class InventarioConsumo {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({name: 'item_id', type: 'int'})
	itemId: number;

	@ManyToOne(() => InventarioItem, {onDelete: 'CASCADE'})
	@JoinColumn({name: 'item_id'})
	item: InventarioItem;

	@Index()
	@Column({name: 'variante_id', type: 'int'})
	varianteId: number;

	@ManyToOne(() => ProductoVariantes, {onDelete: 'CASCADE'})
	@JoinColumn({name: 'variante_id'})
	variante: ProductoVariantes;

	@Column({type: 'int', default: 1})
	cantidad: number;

	/** Cajas: solo domicilio y para llevar (en mesa no se empaca). */
	@Column({name: 'solo_para_llevar', type: 'boolean', default: false})
	soloParaLlevar: boolean;

	/** 'auto' = creada por la migración (la UI la marca "revisar"); 'manual' = la puso alguien. */
	@Column({type: 'varchar', length: 10, default: 'manual'})
	origen: 'auto' | 'manual';

	@CreateDateColumn({name: 'creado_en', type: 'timestamptz'})
	creadoEn: Date;
}
