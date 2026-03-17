import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('empresa_config')
export class EmpresaConfig {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'text' })
    nit: string;

    @Column({ name: 'razon_social', type: 'text' })
    razonSocial: string;

    @Column({ name: 'nombre_comercial', type: 'text', nullable: true })
    nombreComercial: string;

    @Column({ type: 'text', default: 'Régimen Simple' })
    regimen: string;

    @Column({ type: 'text', nullable: true })
    direccion: string;

    @Column({ type: 'text', nullable: true })
    telefono: string;

    @Column({ type: 'text', nullable: true })
    municipio: string;

    @Column({ type: 'text', nullable: true })
    departamento: string;

    @Column({ name: 'tarifa_iva', type: 'numeric', default: 0 })
    tarifaIva: number;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
