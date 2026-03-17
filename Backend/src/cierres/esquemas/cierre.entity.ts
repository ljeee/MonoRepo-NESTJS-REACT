import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { ColumnNumericTransformer } from '../../common/utils/numeric.transformer';

@Entity('cierres_caja')
export class CierreCaja {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'date' })
    @Index({ unique: true })
    fecha: string; // ISO yyyy-mm-dd

    @Column({ type: 'numeric', transformer: new ColumnNumericTransformer() })
    totalVentas: number;

    @Column({ type: 'numeric', transformer: new ColumnNumericTransformer() })
    totalEgresos: number;

    @Column({ type: 'numeric', transformer: new ColumnNumericTransformer() })
    balanceNeto: number;

    @Column({ type: 'integer' })
    totalOrdenes: number;

    @Column({ type: 'integer' })
    totalFacturas: number;

    @Column({ type: 'numeric', transformer: new ColumnNumericTransformer() })
    ticketPromedio: number;

    @Column({ type: 'jsonb', nullable: true })
    metodosPago: any; // Resumen por método

    @Column({ type: 'jsonb', nullable: true })
    productosTop: any;

    @Column({ type: 'text', nullable: true })
    observaciones: string;

    @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
    createdById: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
