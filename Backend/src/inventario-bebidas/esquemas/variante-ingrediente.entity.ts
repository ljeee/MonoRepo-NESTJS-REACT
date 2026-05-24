import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ColumnNumericTransformer } from '../../common/utils/numeric.transformer';
import { Ingrediente } from './ingrediente.entity';

/**
 * Links a ProductoVariante to an Ingrediente.
 * When 1 unit of the variant is sold, `cantidadPorVenta` units
 * of the raw ingredient are consumed.
 *
 * Example:
 *   Jugo de Maracuyá (variante) → Pulpa Maracuyá (ingrediente, rendimiento=3)
 *   cantidadPorVenta = 1/3 ≈ 0.333
 *
 *   Limonada de Coco (variante) → Limonada Coco Bolsa (ingrediente, rendimiento=1)
 *   cantidadPorVenta = 1
 */
@Entity('variantes_ingredientes')
export class VarianteIngrediente {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'variante_id', type: 'integer' })
    varianteId: number;

    @Column({ name: 'ingrediente_id', type: 'integer' })
    ingredienteId: number;

    /** Raw units consumed per 1 sale of the variant */
    @Column({ type: 'numeric', default: 1, transformer: new ColumnNumericTransformer() })
    cantidadPorVenta: number;

    @ManyToOne(() => Ingrediente, (i) => i.variantes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ingrediente_id' })
    ingrediente: Ingrediente;
}
