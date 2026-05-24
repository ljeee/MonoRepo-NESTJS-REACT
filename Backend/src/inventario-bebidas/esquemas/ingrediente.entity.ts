import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ColumnNumericTransformer } from '../../common/utils/numeric.transformer';
import { VarianteIngrediente } from './variante-ingrediente.entity';

export type CategoriaBebida = 'pulpa' | 'jugo_directo' | 'gaseosa' | 'agua' | 'otro';

@Entity('ingredientes_bebidas')
export class Ingrediente {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'text' })
    nombre: string;

    @Column({ type: 'text', default: 'otro' })
    categoria: CategoriaBebida;

    /** e.g. "bolsa", "botella", "litro", "unidad" */
    @Column({ type: 'text', default: 'unidad' })
    unidad: string;

    /** Raw units currently in stock */
    @Column({ type: 'numeric', default: 0, transformer: new ColumnNumericTransformer() })
    stockActual: number;

    /**
     * How many portions (servings) one raw unit produces.
     * Pulpa 1kg → 3 jugos = rendimiento 3
     * Limonada de coco 1 bolsa → 1 jugo = rendimiento 1
     * Gaseosa 1 botella → 1 serving = rendimiento 1
     */
    @Column({ type: 'numeric', default: 1, transformer: new ColumnNumericTransformer() })
    rendimientoPorUnidad: number;

    /** Alert when stockActual drops below this (in raw units) */
    @Column({ type: 'numeric', nullable: true, transformer: new ColumnNumericTransformer() })
    alertaMinimo: number | null;

    /** Optional cost per raw unit (for costing) */
    @Column({ type: 'numeric', nullable: true, transformer: new ColumnNumericTransformer() })
    costo: number | null;

    @Column({ type: 'boolean', default: true })
    activo: boolean;

    @OneToMany(() => VarianteIngrediente, (vi) => vi.ingrediente, { cascade: true })
    variantes: VarianteIngrediente[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
