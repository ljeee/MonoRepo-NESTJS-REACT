import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { ColumnNumericTransformer } from '../../common/utils/numeric.transformer';

@Entity('caja_movimientos')
export class CajaMovimiento {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'date' })
    @Index()
    fecha: string; // yyyy-mm-dd Bogotá

    @Column({ type: 'varchar', length: 20 })
    tipo: 'entrada' | 'salida' | 'apertura';

    // { "100000": 2, "50000": 1, "10000": 3, ... } — denomination: count
    @Column({ type: 'jsonb' })
    denominaciones: Record<string, number>;

    @Column({ type: 'numeric', transformer: new ColumnNumericTransformer() })
    total: number;

    @Column({ name: 'factura_venta_id', nullable: true, type: 'bigint' })
    facturaVentaId: number | null;

    @Column({ name: 'factura_pago_id', nullable: true, type: 'bigint' })
    facturaPagoId: number | null;

    @Column({ type: 'text', nullable: true })
    descripcion: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
