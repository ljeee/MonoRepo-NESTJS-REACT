import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { ColumnNumericTransformer } from '../../common/utils/numeric.transformer';

@Entity('caja_movimientos')
@Index(['fecha', 'cajaOrigen'])
export class CajaMovimiento {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'date' })
    @Index()
    fecha: string; // yyyy-mm-dd Bogotá

    @Column({ type: 'varchar', length: 20 })
    tipo: 'entrada' | 'salida' | 'apertura' | 'cambio';

    @Column({ name: 'caja_origen', type: 'varchar', length: 20, default: 'principal' })
    @Index()
    cajaOrigen: 'principal' | 'gastos';

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

    @Column({ type: 'text', nullable: true })
    metodo: string | null;

    @Column({ name: 'pago_transferencia', type: 'numeric', nullable: true, transformer: new ColumnNumericTransformer() })
    pagoTransferencia: number | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
